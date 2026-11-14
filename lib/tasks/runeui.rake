namespace :runeui do
  desc "Check the app keeps to runeui: its Herb rule for templates (installed in .herb/rules/), and tokens, colours, retired classes and native controls in stylesheets, helpers and JavaScript (config/runeui.yml)"
  task :lint do
    require "runeui/lint"

    lint = Runeui::Lint.new(root: Rails.root)
    puts "runeui: installed its Herb rule in .herb/rules/#{Runeui::Lint::HERB_RULE} (commit it; herb lint now checks templates)" if lint.install_herb_rule

    offenses = lint.run
    offenses.each { puts it }
    if offenses.any?
      puts "\n#{offenses.size} #{offenses.size == 1 ? "offense" : "offenses"}. Templates: bundle exec herb lint."
      exit 1
    end
    puts "runeui: stylesheets, helpers and JavaScript keep to runeui. Templates: bundle exec herb lint."
  end
end
