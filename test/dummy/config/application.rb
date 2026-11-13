require_relative "boot"

require "rails"
require "action_controller/railtie"
require "action_view/railtie"
require "propshaft"
require "importmap-rails"
require "turbo-rails"
require "stimulus-rails"
require "runeui"

# REACTIONVIEW=1 runs the app through ReActionView (Herb's engine, reactive state), to check
# runeui's partials and components inside its templates.
if ENV["REACTIONVIEW"]
  require "herb"
  require "reactionview"
end

module Dummy
  class Application < Rails::Application
    config.load_defaults 8.1

    # rune_ui's stylesheets, from a checkout named by RUNE_UI (its app/assets/stylesheets), for
    # /bridge: runeui under rune_ui's tokens through runeui/bridges/rune_ui.css.
    config.assets.paths << File.join(ENV["RUNE_UI"], "app/assets/stylesheets") if ENV["RUNE_UI"]

    # Lexxy's assets, for ui :editor and its skin (runeui/lexxy.css). Not its engine.
    if (lexxy = Gem.loaded_specs["lexxy"])
      config.assets.paths << File.join(lexxy.full_gem_path, "app/assets/javascript")
      config.assets.paths << File.join(lexxy.full_gem_path, "app/assets/stylesheets")
    end
    config.root = File.expand_path("..", __dir__)
    config.eager_load = false
    config.secret_key_base = "runeui-dummy"
    config.hosts.clear
    config.logger = Logger.new($stdout) if ENV["LOG"]
    config.log_level = :warn

    if ENV["REACTIONVIEW"]
      initializer "dummy.reactionview" do
        ReActionView.configure do |config|
          config.intercept_erb = true
          config.slots = true
          config.debug_mode = false
          config.validation_mode = :raise
          config.external_template_mode = ENV["REACTIONVIEW"].to_sym if %w[fallback skip compile].include?(ENV["REACTIONVIEW"])
        end
      end
    end
  end
end
