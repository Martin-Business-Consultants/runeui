require_relative "lib/runeui/version"

Gem::Specification.new do |spec|
  spec.name = "runeui"
  spec.version = Runeui::VERSION
  spec.authors = [ "Martin Business Consultants" ]
  spec.summary = "Components for Rails with no build step: ERB, CSS and UI SDK's behaviours, at home in Hotwire"
  spec.description = "A component library for Rails apps on importmap, Propshaft and Hotwire. Each component is an ERB partial " \
    "and a stylesheet you can own, on UI SDK's accessible behaviours (vendored as plain ES modules), themed with shadcn/ui's " \
    "tokens, and made to survive Turbo morphs, frames and streams."
  spec.homepage = "https://github.com/Martin-Business-Consultants/runeui"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.3"

  spec.files = Dir[ "{app,config,lib}/**/*", "LICENSE.md", "NOTICE", "README.md", "llms.txt" ]

  spec.add_dependency "railties", ">= 7.2"
  spec.add_dependency "actionview", ">= 7.2"
  spec.add_dependency "importmap-rails", ">= 2.0"
  spec.add_dependency "turbo-rails", ">= 2.0"
end
