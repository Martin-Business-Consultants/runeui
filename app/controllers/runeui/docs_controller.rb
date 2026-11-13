module Runeui
  # The component gallery: /runeui in development and test (config.runeui.docs to change that).
  # Each component's page renders its examples (app/views/runeui/docs/examples/_<name>.html.erb)
  # beside their ERB, and forms in them post to echo, which answers with a toast saying what came.
  class DocsController < ActionController::Base
    # Fixtures for the tests, reachable by address but not listed.
    HIDDEN = %w[contract].freeze

    layout "runeui/docs"
    helper Runeui::Helper

    def index
      @components = examples.reject { HIDDEN.include?(it) }
    end

    def show
      @component = params[:component]
      raise ActionController::RoutingError, "No runeui component #{@component}" unless examples.include?(@component)
      @components = examples.reject { HIDDEN.include?(it) }
      @source = File.read(Engine.root.join("app/views/runeui/docs/examples/_#{@component}.html.erb"))
      render "runeui/docs/shell", layout: "runeui/blank" if @component == "app_shell" && params[:full]
    end

    def echo
      received = request.request_parameters.except("authenticity_token", "component").to_h
      respond_to do |format|
        format.turbo_stream { render turbo_stream: turbo_stream.ui_toast("Received", type: :success, description: received.to_json) }
        format.html { redirect_to runeui_doc_path(params[:component]), notice: "Received #{received.to_json}" }
      end
    end

    private
      def examples
        Dir[Engine.root.join("app/views/runeui/docs/examples/_*.html.erb")].map { File.basename(it, ".html.erb").delete_prefix("_") }.sort
      end
  end
end
