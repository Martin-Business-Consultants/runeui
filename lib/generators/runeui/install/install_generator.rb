require "rails/generators"

module Runeui
  module Generators
    # bin/rails g runeui:install: wires runeui into the app's layout and JavaScript.
    class InstallGenerator < Rails::Generators::Base
      desc "Adds runeui to the layout (stylesheets, toasts, the confirm dialog) and to application.js"

      def import_javascript
        entry = "app/javascript/application.js"
        return say_status(:skip, "#{entry} not found: import \"runeui\" from your entry point", :yellow) unless File.exist?(entry)
        return if File.read(entry).include?('import "runeui"')
        append_to_file entry, %(import "runeui"\n)
      end

      def add_to_layout
        layout = "app/views/layouts/application.html.erb"
        return say_status(:skip, "#{layout} not found", :yellow) unless File.exist?(layout)
        content = File.read(layout)

        unless content.include?("runeui_tags")
          anchor = content[/^\s*<%= stylesheet_link_tag.*$/] || content[/^\s*<\/head>/]
          insert_into_file layout, "    <%= runeui_tags %>\n", before: anchor
        end

        unless content.include?("ui :toaster")
          insert_into_file layout, "    <%= ui :toaster %>\n    <%= ui :confirm %>\n    <%= ui_flash_toasts %>\n", before: %r{^\s*</body>}
        end
      end

      def done
        say <<~TEXT

          runeui is in. In any view:

            <%= ui :button, content: "Save", type: :submit %>
            <%= form.ui :select, :status, options: Project::STATUSES %>

          The gallery is at /runeui while the app runs in development. To own a component (change
          its markup or CSS in your app): bin/rails g runeui:add select
        TEXT
      end
    end
  end
end
