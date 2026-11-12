module Runeui
  class Engine < ::Rails::Engine
    # Off by default in production: the component gallery at /runeui.
    config.runeui = ActiveSupport::OrderedOptions.new
    config.runeui.docs = nil

    initializer "runeui.assets" do |app|
      if app.config.respond_to?(:assets)
        app.config.assets.paths << root.join("app/javascript")
      end
    end

    initializer "runeui.importmap", before: "importmap" do |app|
      if app.config.respond_to?(:importmap)
        app.config.importmap.paths << root.join("config/importmap.rb")
        app.config.importmap.cache_sweepers << root.join("app/javascript")
      end
    end

    initializer "runeui.helpers" do
      ActiveSupport.on_load(:action_view) do
        include Runeui::Helper
        ActionView::Helpers::FormBuilder.include Runeui::FormBuilder
      end
    end

    initializer "runeui.turbo_streams" do
      ActiveSupport.on_load(:turbo_streams_tag_builder) { include Runeui::TurboStreamActions }
    end

    initializer "runeui.docs" do |app|
      docs = app.config.runeui.docs
      docs = Rails.env.local? if docs.nil?
      if docs
        app.routes.prepend do
          get "runeui", to: "runeui/docs#index", as: :runeui_docs
          get "runeui/:component", to: "runeui/docs#show", as: :runeui_doc
          post "runeui/:component/echo", to: "runeui/docs#echo", as: :runeui_echo
        end
      end
    end
  end
end
