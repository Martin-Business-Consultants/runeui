# runeui's own modules. The app imports "runeui" once (app/javascript/application.js); it starts
# the autoloader, which imports a component's module the first time its tag is on the page.
pin "runeui", to: "runeui/index.js"
pin "runeui/autoload", to: "runeui/autoload.js"
pin "runeui/hotwire", to: "runeui/hotwire.js"
pin "runeui/morph", to: "runeui/morph.js"
pin "runeui/forms", to: "runeui/forms.js"
pin "runeui/feedback", to: "runeui/feedback.js"
pin "runeui/agent", to: "runeui/agent.js", preload: false
pin "runeui/theme", to: "runeui/theme.js"
# runeui's Stimulus controllers (runeui--sidebar, runeui--selection…). Stimulus itself is pinned
# here too (to stimulus-rails' file, as an app's own pin is), so runeui works in an app whose
# importmap doesn't name it.
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "runeui/controllers", to: "runeui/controllers/index.js"
Dir[File.expand_path("../app/javascript/runeui/controllers/*_controller.js", __dir__)].sort.each do |file|
  name = File.basename(file, ".js")
  pin "runeui/controllers/#{name}", to: "runeui/controllers/#{name}.js"
end
pin "runeui/props", to: "runeui/props.js"
pin "runeui/remote", to: "runeui/remote.js"
pin "runeui/command", to: "runeui/command.js"
pin "runeui/triggers", to: "runeui/triggers.js"

# UI SDK's components, vendored by script/vendor-ui-sdk.
instance_eval File.read(File.expand_path("sdk_pins.rb", __dir__))

# The gallery's entry (/runeui), which loads Turbo then runeui.
pin "runeui/docs", to: "runeui/docs.js", preload: false
