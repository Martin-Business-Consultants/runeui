require "yaml"
require "pathname"
require "fileutils"

module Runeui
  # Keeps an app on runeui, as a linter keeps a shadcn app on its components (bin/rails runeui:lint).
  # Templates are Herb's (the runeui-native-controls rule this installs in .herb/rules/); this reads
  # what Herb doesn't:
  #
  #   unknown-token   var(--x) that neither runeui, the app's own stylesheets nor its JavaScript
  #                   define (an old kit's names, a typo)
  #   hard-coded-colour  a colour literal (#hex, rgb(), oklch()…, white/black) in a property, outside
  #                   a token's definition: colours come from tokens
  #   colour-mix      color-mix in a space other than the app's (OKLab, as runeui mixes)
  #   denied-class    a class config/runeui.yml retires (deny_classes), in views, helpers or JavaScript
  #   native-control  a Ruby helper building the browser's own control (tag.button, check_box_tag,
  #                   button_to without ui-button…) outside the wrappers that make it runeui's
  #
  # A deliberate exception says why, on its line or the line above, in a comment:
  #   /* runeui:allow hard-coded-colour — the logo's own blue */      # runeui:allow native-control — …
  class Lint
    Offense = Data.define(:path, :line, :rule, :message) do
      def to_s = "#{path}:#{line}  #{rule}  #{message}"
    end

    RULES = %w[unknown-token hard-coded-colour colour-mix denied-class native-control].freeze
    HERB_RULE = "runeui-native-controls.mjs"
    HERB_RULE_SOURCE = Pathname(__dir__).join("lint", HERB_RULE)
    MANAGED = "// Managed by runeui (bin/rails runeui:lint keeps it current): edit runeui, not this copy.\n"

    DEFAULTS = {
      "stylesheets" => [ "app/assets/stylesheets/**/*.css" ],
      "views" => [ "app/views/**/*.erb" ],
      "helpers" => [ "app/helpers/**/*.rb", "app/components/**/*.rb" ],
      "javascript" => [ "app/javascript/**/*.js" ],
      "skip" => [],
      "tokens" => [],
      "deny_classes" => [],
      "wrappers" => [],
      "form_builder" => [],
      "colour_mix" => "oklab"
    }.freeze

    COLOUR_FUNCTIONS = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/
    HEX = /(?<![\w-])#(?:\h{3,4}|\h{6}|\h{8})\b/
    NAMED = /(?<![\w-])(white|black)(?![\w-])/
    COLOUR_PROPERTIES = /color|background|border|outline|fill|stroke|shadow|caret|accent|decoration|column-rule/

    TAG_HELPERS = /\b(button_tag|submit_tag|image_submit_tag|check_box_tag|checkbox_tag|radio_button_tag|text_field_tag|email_field_tag|password_field_tag|search_field_tag|number_field_tag|telephone_field_tag|phone_field_tag|url_field_tag|date_field_tag|datetime_field_tag|datetime_local_field_tag|time_field_tag|month_field_tag|week_field_tag|color_field_tag|range_field_tag|file_field_tag|text_area_tag|textarea_tag|select_tag)\b/
    TAG_BUILDER = /\btag\.(button|input|select|textarea|dialog|table)\b|\bcontent_tag[ (]+:(button|input|select|textarea|dialog|table)\b/
    BUTTON_TO = /\bbutton_to\b/

    attr_reader :root, :config

    def initialize(root:, config: nil)
      @root = Pathname(root)
      @config = DEFAULTS.merge(config || load_config)
    end

    def run
      [ *stylesheet_offenses, *class_offenses, *helper_offenses ].sort_by { [ it.path, it.line ] }
    end

    # Puts runeui's Herb rule in the app's .herb/rules/, or brings it up to date. Returns true if it
    # wrote it.
    def install_herb_rule
      target = root.join(".herb/rules", HERB_RULE)
      content = MANAGED + HERB_RULE_SOURCE.read
      return false if target.exist? && target.read == content

      FileUtils.mkdir_p target.dirname
      target.write content
      true
    end

    private
      def load_config
        path = root.join("config/runeui.yml")
        path.exist? ? (YAML.safe_load(path.read) || {}) : {}
      end

      def files(key)
        Array(config[key]).flat_map { Dir.glob(root.join(it).to_s) }.uniq.map { Pathname(it) }
          .reject { |file| skipped?(file) }.sort
      end

      def skipped?(file)
        path = file.relative_path_from(root).to_s
        Array(config["skip"]).any? { File.fnmatch?(it, path, File::FNM_PATHNAME | File::FNM_EXTGLOB) || File.fnmatch?(it, path, File::FNM_EXTGLOB) }
      end

      def relative(file) = file.relative_path_from(root).to_s

      # Lines a runeui:allow comment for this rule covers (its own and the next); a marker without a
      # reason is an offense of its own.
      def allowances(file, lines, offenses, rules: RULES)
        allowed = Hash.new { |hash, key| hash[key] = Set.new }
        lines.each_with_index do |line, index|
          line.scan(/runeui:allow\s+([\w-]+)([^\n]*)/) do |rule, rest|
            next unless rules.include?(rule)

            reason = rest.sub(%r{\*/.*|%>.*|-->.*}, "").sub(/\A[\s—–:-]+/, "").strip
            if reason.empty?
              offenses << Offense.new(relative(file), index + 1, rule, "say why after runeui:allow #{rule} (runeui:allow #{rule} — why)")
            else
              allowed[rule] << index + 1 << index + 2
            end
          end
        end
        allowed
      end

      def report(offenses, allowed, file, line, rule, message)
        offenses << Offense.new(relative(file), line, rule, message) unless allowed[rule].include?(line)
      end

      # ----- Stylesheets -----

      def stylesheet_offenses
        sheets = files("stylesheets")
        known = runeui_tokens | defined_tokens(sheets) | script_tokens
        extra = Array(config["tokens"])
        mix = config["colour_mix"].to_s

        sheets.flat_map do |file|
          source = file.read
          offenses = []
          allowed = allowances(file, source.lines, offenses, rules: %w[unknown-token hard-coded-colour colour-mix])

          declarations(strip_comments(source)).each do |line, property, value|
            value.scan(/var\(\s*--([\w-]+)/).flatten.each do |name|
              next if known.include?(name) || extra.any? { token_match?(it, name) }

              report offenses, allowed, file, line, "unknown-token", "--#{name} isn't one of runeui's tokens or the app's own (an old kit's name, or a typo?)"
            end

            value.scan(/color-mix\(\s*in\s+([\w-]+)/).flatten.each do |space|
              next if space == mix

              report offenses, allowed, file, line, "colour-mix", "color-mix in #{space}: mix in #{mix}"
            end

            next if property.start_with?("--")

            value = without_relative_colours(value)
            colour = value[HEX] || value[COLOUR_FUNCTIONS] || (property.match?(COLOUR_PROPERTIES) && value[NAMED])
            next unless colour

            report offenses, allowed, file, line, "hard-coded-colour", "#{property}: #{colour.chomp("(")}… is a colour of its own: use a token (var(--primary), var(--muted-foreground)…)"
          end
          offenses
        end
      end

      # A relative colour from a token (oklch(from var(--primary) l c h)) is the token's colour, moved:
      # taken out, with its parentheses, before looking for literals.
      def without_relative_colours(value)
        out = value.dup
        while (start = out =~ /\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(\s*from\s+var\(/)
          depth = 0
          finish = (start...out.length).find do |index|
            depth += 1 if out[index] == "("
            depth -= 1 if out[index] == ")"
            depth.zero? && out[index] == ")"
          end
          out[start..(finish || out.length - 1)] = "var(--relative)"
        end
        out
      end

      def token_match?(pattern, name)
        pattern = pattern.delete_prefix("--")
        pattern.end_with?("*") ? name.start_with?(pattern.chomp("*")) : name == pattern
      end

      def runeui_tokens
        @runeui_tokens ||= Dir.glob(Pathname(__dir__).join("../../app/assets/stylesheets/**/*.css").to_s)
          .flat_map { defined_in(File.read(it)) }.to_set
      end

      def defined_tokens(sheets)
        sheets.flat_map { defined_in(it.read) }.to_set
      end

      # Custom properties a page's JavaScript sets (style.setProperty("--x", …)).
      def script_tokens
        files("javascript").flat_map { it.read.scan(/setProperty\(\s*["'`]--([\w-]+)/).flatten }.to_set
      end

      def defined_in(css) = strip_comments(css).scan(/(?<![\w-])--([\w-]+)\s*:/).flatten

      # Comments blanked out, newlines kept, so line numbers still match.
      def strip_comments(css) = css.gsub(%r{/\*.*?\*/}m) { it.gsub(/[^\n]/, " ") }

      # [line, property, value] for each declaration: text ending in ; or } that holds a colon and
      # didn't open a block.
      def declarations(css)
        out = []
        start = 0
        css.to_enum(:scan, /[;{}]/).each do
          match = Regexp.last_match
          chunk = css[start...match.begin(0)]
          if match[0] != "{" && (colon = chunk.index(":")) && !chunk.strip.start_with?("@")
            property = chunk[0...colon].strip
            if property.match?(/\A-{0,2}[\w-]+\z/)
              line = css[0, start + chunk.index(/\S/).to_i].count("\n") + 1
              out << [ line, property.downcase, chunk[(colon + 1)..].strip ]
            end
          end
          start = match.end(0)
        end
        out
      end

      # ----- Classes the app retired -----

      def class_offenses
        denied = Array(config["deny_classes"]).map(&:to_s)
        return [] if denied.empty?

        names = denied.map { Regexp.escape(it) }.join("|")
        token = /(?<![\w-])(#{names})(?![\w-])/
        [ *files("views"), *files("helpers"), *files("javascript") ].flat_map do |file|
          lines = file.read.lines
          offenses = []
          allowed = allowances(file, lines, offenses, rules: %w[denied-class])
          lines.each_with_index do |line, index|
            class_strings(file, line).each do |string|
              string.scan(token).flatten.uniq.each do |name|
                report offenses, allowed, file, index + 1, "denied-class", "class #{name} is retired (deny_classes in config/runeui.yml): use runeui's component"
              end
            end
          end
          offenses
        end
      end

      # The strings on a line that name classes: class attributes and options in templates and
      # helpers; classList calls and selectors in JavaScript.
      def class_strings(file, line)
        if file.extname == ".js"
          [ *line.scan(/classList\.\w+\(([^)]*)\)/).flatten,
            *line.scan(/(?:querySelector(?:All)?|closest|matches)\(\s*["'`]([^"'`]*)/).flatten.map { it.scan(/\.([\w-]+)/).join(" ") } ]
        else
          [ *line.scan(/class(?:=|:\s*|\s*=>\s*)["']([^"']*)["']/).flatten,
            *line.scan(/class:\s*%w\[([^\]]*)\]/).flatten,
            *line.scan(/class_names\(([^)]*)\)/).flatten,
            *line.scan(/classes:\s*["']([^"']*)["']/).flatten ]
        end
      end

      # ----- Ruby helpers that build the browser's own controls -----

      def helper_offenses
        wrappers = Array(config["wrappers"]).map { Regexp.escape(it) }
        wrapped = wrappers.empty? ? nil : /\b(#{wrappers.join("|")})\b/
        files("helpers").flat_map do |file|
          lines = file.read.lines
          offenses = []
          allowed = allowances(file, lines, offenses, rules: %w[native-control])
          lines.each_with_index do |line, index|
            code = line.sub(/(?<!["'])#(?![{]).*$/, "")
            next if code.strip.empty? || (wrapped && code.match?(wrapped)) || code.match?(/["' ]ui-|\bslot:/)

            if (helper = code[TAG_HELPERS])
              report offenses, allowed, file, index + 1, "native-control", "#{helper} is the browser's own control: build runeui's (ui :input, :checkbox, :select, :button…)"
            end
            if (built = code.match(TAG_BUILDER))
              report offenses, allowed, file, index + 1, "native-control", "#{built[0]} draws a bare <#{built[1] || built[2]}>: use runeui's component"
            end
            if code.match?(BUTTON_TO) && !lines[index, 3].join.include?("ui-button")
              report offenses, allowed, file, index + 1, "native-control", "button_to without class \"ui-button\" is a bare <button>: give it class: \"ui-button\""
            end
          end
          offenses
        end
      end
  end
end
