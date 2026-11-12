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

# UI SDK's components, vendored by script/vendor-ui-sdk.
instance_eval File.read(File.expand_path("sdk_pins.rb", __dir__))

# The gallery's entry (/runeui), which loads Turbo then runeui.
pin "runeui/docs", to: "runeui/docs.js", preload: false
