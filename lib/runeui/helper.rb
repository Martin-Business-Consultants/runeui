module Runeui
  module Helper
    VOID_ELEMENTS = %w[area base br col embed hr img input link meta source track wbr].freeze

    # Everything the layout's <head> needs: the cascade layer order, the stylesheets, the CSP
    # nonce UI SDK uses for the little CSS it injects, and the theme script (light or dark before
    # the first paint, so nothing flashes). Put it before the app's own stylesheets.
    #
    #   <%= runeui_tags %>
    #   <%= runeui_tags components: %w[button select dialog] %>   # only these components' CSS
    #   <%= runeui_tags lexxy: true %>                            # with the Lexxy editor's skin
    #   <%= runeui_tags theme: false %>                           # the app sets light and dark
    #   <%= runeui_tags page: false %>                            # no reset or body styles
    #   <%= runeui_tags tokens: false, page: false, theme: false %>  # beside another kit, with a bridge
    #   <%= runeui_tags confirm: false, toasts: false %>          # keep the app's own confirm and flash
    #   <%= runeui_tags agent: true %>                            # offer the page to a browser's agent
    def runeui_tags(components: nil, theme: true, lexxy: false, tokens: true, page: true, confirm: true, toasts: true, agent: false, **options)
      # page: false leaves the body and the reset to the app (one with its own base styles).
      # tokens: false leaves runeui's tokens out too, for a bridge that defines them from the
      # app's own (runeui/bridges/rune_ui): nothing of runeui's then lands on :root.
      sheets = [ ("runeui/tokens" if tokens), ("runeui/page" if page), "runeui/base" ].compact
      sheets += (components || Runeui.stylesheets).map { "runeui/components/#{it}" }
      # Lexxy's own sheet, then runeui's skin over it (ui :editor).
      sheets += [ "lexxy", "runeui/lexxy" ] if lexxy
      settings = { confirm: confirm, toasts: toasts, agent: agent }
      safe_join([
        nonce_meta_tag,
        # What import "runeui" reads as it starts (an import runs before the file that imports
        # it, so options can't be set in JavaScript beside the import).
        tag.meta(name: "runeui", content: settings.to_json),
        # theme: false leaves light and dark to the app (one themed another way, as through
        # runeui/bridges/rune_ui.css): no script before paint, and runeui's JavaScript keeps off
        # .dark and data-theme.
        (theme ? runeui_theme_script : tag.meta(name: "runeui-theme", content: "off")),
        stylesheet_link_tag(*sheets, **options)
      ].compact, "\n")
    end

    # Renders a component's partial, the block (if any) captured as its content: local.
    #   ui :button, variant: :outline, content: "Save"
    #   <%= ui :card, title: "Team" do %> … <% end %>
    # Works inside form_with too. Partials never yield: a partial rendered without a block
    # would yield the page's layout content.
    def ui(name, **locals, &block)
      locals[:content] = capture(&block) if block
      render(partial: "ui/#{name}", locals: locals)
    end

    # A component's attributes merged with the caller's (class joins, data and aria merge), as a
    # hash for tag helpers: tag.ui_select(**ui_attrs({ name: "x" }, attrs)) { … }. (Herb doesn't
    # take ERB output where an attribute goes, so roots are built with tag.)
    def ui_attrs(base, extra = {})
      Runeui::Attributes.merge(base, extra || {})
    end

    # An element with a component's attributes merged with the caller's: what partials build
    # their roots with.
    #   <%= ui_tag "ui-select", { name: name, data: { slot: "select" } }, attrs do %> … <% end %>
    #   ui_tag :span, { data: { slot: "badge" } }, attrs, content
    # A helper of runeui's own, not tag.ui_select(**hash): Herb's engine (ReActionView) rewrites
    # tag.* and content_tag calls into HTML when it compiles a template, and drops attributes
    # that arrive as a splatted hash. Void elements (input, img…) take no content.
    def ui_tag(name, base = {}, extra = {}, content = nil, &block)
      options = Runeui::Attributes.merge(base, extra || {})
      # true writes the bare attribute (hidden, disabled), false and nil leave it out, as tag does.
      name = name.to_s.tr("_", "-")
      return tag(name, options) if VOID_ELEMENTS.include?(name)
      content = capture(&block) if block
      content_tag(name, content, options)
    end

    # One of runeui's icons (Lucide's shapes, ISC), 16 by 16, stroked with currentColor.
    #   ui_icon :check
    #   ui_icon :search, size: 20, aria: { label: "Search" }
    def ui_icon(name, size: 16, **attrs)
      shapes = Runeui::Icons.fetch(name)
      labelled = attrs.dig(:aria, :label) || attrs[:"aria-label"]
      base = { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
        class: "ui-icon", data: { icon: name }, aria: { hidden: (labelled ? nil : true) } }
      merged = Runeui::Attributes.merge(base, attrs)
      merged[:role] ||= "img" if labelled
      content_tag(:svg, shapes.html_safe, merged)
    end

    # Choices as Rails' select takes them, made uniform: [{ label:, value:, disabled: }] or, for
    # grouped ones, [{ group:, options: [...] }].
    #   %w[draft live]                       labels and values the same
    #   [["Draft", "draft"], ["Live", "live", { disabled: true }]]
    #   { "Draft" => "draft", "Live" => "live" }
    #   { "Recent" => [...], "All" => [...] }    groups
    def ui_options(options)
      list = options.respond_to?(:to_h) && !options.is_a?(Array) ? options.to_h.to_a : Array(options)
      list.map do |item|
        if item.is_a?(Array) && item.size == 2 && (item.last.is_a?(Array) || item.last.is_a?(Hash))
          { group: item.first.to_s, options: ui_options(item.last) }
        elsif item.is_a?(Array)
          label, value, extra = item
          { label: label.to_s, value: (value.nil? ? label : value).to_s, disabled: (extra.is_a?(Hash) && extra[:disabled]) || false }
        else
          { label: item.to_s, value: item.to_s, disabled: false }
        end
      end
    end

    # The label of the chosen value(s) among options, for showing before the element upgrades.
    def ui_selected_label(options, value)
      values = Array(value).map(&:to_s)
      flat = options.flat_map { it[:group] ? it[:options] : [ it ] }
      flat.select { values.include?(it[:value]) }.map { it[:label] }.join(", ").presence
    end

    # An id for a component that's the same every time the page renders, so a morph doesn't
    # change it (labels' for= and the ids UI SDK derives from it stay linked): the one given,
    # else one from the field's name, else a count through the page.
    def ui_id(prefix, given = nil, name: nil)
      return given if given.present?
      return "#{prefix}-#{name.to_s.parameterize}" if name.present?
      "#{prefix}-#{(@runeui_ids = (@runeui_ids || 0) + 1)}"
    end

    # The flash as toasts: rendered once in the layout, each message becomes a toast as the page
    # (or a Turbo visit) arrives. Notices go by themselves; alerts stay until closed.
    def ui_flash_toasts(flash = self.flash)
      messages = flash.to_h.filter_map do |kind, message|
        next if message.blank?
        { type: (kind.to_s == "alert" ? "error" : (kind.to_s == "notice" ? "success" : kind.to_s)), title: message.to_s }
      end
      tag.template(data: { runeui_toasts: messages.to_json }) if messages.any?
    end

    private
      def nonce_meta_tag
        nonce = respond_to?(:content_security_policy_nonce) ? content_security_policy_nonce : nil
        nonce ? tag.meta(property: "csp-nonce", nonce: nonce) : tag.meta(property: "csp-nonce")
      end

      # Puts .dark on <html> from the saved choice, else the system's, before anything paints.
      # The same class shadcn themes use, so a pasted theme's .dark block applies.
      def runeui_theme_script
        script = <<~JS.squish
          (function(){var d=document.documentElement,s=null;try{s=localStorage.getItem("runeui-theme")}catch(e){}
          var t=s||d.dataset.defaultTheme||"system";var dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
          d.classList.toggle("dark",dark);d.dataset.theme=dark?"dark":"light"})()
        JS
        javascript_tag(script, nonce: true)
      end
  end
end
