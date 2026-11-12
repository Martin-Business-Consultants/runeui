require_relative "boot"

require "rails"
require "action_controller/railtie"
require "action_view/railtie"
require "propshaft"
require "importmap-rails"
require "turbo-rails"
require "runeui"

module Dummy
  class Application < Rails::Application
    config.load_defaults 8.1
    config.root = File.expand_path("..", __dir__)
    config.eager_load = false
    config.secret_key_base = "runeui-dummy"
    config.hosts.clear
    config.logger = Logger.new($stdout) if ENV["LOG"]
    config.log_level = :warn
  end
end
