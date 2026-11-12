require "runeui/version"
require "runeui/icons"
require "runeui/attributes"
require "runeui/helper"
require "runeui/form_builder"
require "runeui/turbo_stream_actions"
require "runeui/engine"

# runeui: a component library for Rails with no build step. Each component is an ERB partial and a
# stylesheet you can own (bin/rails g runeui:add select), on UI SDK's accessible behaviours,
# vendored as plain ES modules and loaded through importmap the first time a tag appears, and
# made to live with Turbo: morphs keep component state, frames and streams upgrade what they
# bring, and data-turbo-confirm, flash and stream actions use the components.
module Runeui
  # The components runeui ships, for the docs and the generator: a partial in app/views/ui and,
  # for most, a stylesheet in app/assets/stylesheets/runeui/components.
  # Read from disk each time while code reloads (development), so a new component shows up
  # without a restart; once otherwise.
  def self.components
    cached(:@components) { Dir[Engine.root.join("app/views/ui/_*.html.erb")].map { File.basename(it, ".html.erb").delete_prefix("_") }.sort }
  end

  def self.stylesheets
    cached(:@stylesheets) { Dir[Engine.root.join("app/assets/stylesheets/runeui/components/*.css")].map { File.basename(it, ".css") }.sort }
  end

  def self.cached(name)
    return yield if Rails.application && !Rails.application.config.cache_classes
    instance_variable_get(name) || instance_variable_set(name, yield)
  end
end
