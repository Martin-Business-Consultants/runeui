require "rails/generators"

module Runeui
  module Generators
    # bin/rails g runeui:add select dialog (or all): copies components into the app, shadcn's
    # way, to change as you like. The copies sit at the same paths as the gem's, so they're used
    # instead of the gem's from then on: app/views/ui/_select.html.erb and
    # app/assets/stylesheets/runeui/components/select.css. Delete a copy to go back to the gem's.
    class AddGenerator < Rails::Generators::Base
      desc "Copies runeui components into the app to own and change"
      argument :components, type: :array, banner: "select dialog … | all"
      class_option :force, type: :boolean, default: false, desc: "Overwrite copies already in the app"
      source_root Runeui::Engine.root

      def copy_components
        names = components == [ "all" ] ? Runeui.components : components
        names.each do |name|
          partial = "app/views/ui/_#{name}.html.erb"
          sheet = "app/assets/stylesheets/runeui/components/#{name}.css"
          unless File.exist?(Runeui::Engine.root.join(partial))
            say_status :missing, "no runeui component #{name} (#{Runeui.components.join(", ")})", :red
            next
          end
          copy_file partial, partial, force: options[:force]
          copy_file sheet, sheet, force: options[:force] if File.exist?(Runeui::Engine.root.join(sheet))
        end
      end

      def tokens
        return unless components == [ "all" ]
        %w[tokens base].each do |sheet|
          copy_file "app/assets/stylesheets/runeui/#{sheet}.css", "app/assets/stylesheets/runeui/#{sheet}.css", force: options[:force]
        end
      end
    end
  end
end
