# A page for the browser tests: a form whose save redirects back (Turbo morphs the page), a
# frame and a stream that bring components with them.
class PagesController < ApplicationController
  STATE = { "status" => "draft", "public" => "0", "note" => "", "saves" => 0 }

  def show
    STATE.replace("status" => "draft", "public" => "0", "note" => "", "saves" => 0) if params[:reset]
    @state = STATE
  end

  def update
    STATE.merge!(params.permit(:status, :public, :note).to_h)
    STATE["saves"] += 1
    redirect_to root_path, notice: "Saved #{STATE["saves"]}"
  end

  # A page with ReActionView state around runeui components (REACTIONVIEW=1).
  def reactive
    STATE.replace("status" => "draft", "public" => "0", "note" => "", "saves" => 0) if params[:reset]
    @state = STATE
  end

  def reactive_server
    STATE.replace("status" => "draft", "public" => "0", "note" => "", "saves" => 0) if params[:reset]
    @state = STATE
  end

  def reactive_update
    STATE.merge!(params.permit(:status, :public, :note).to_h)
    STATE["saves"] += 1
    redirect_to request.path, notice: "Saved #{STATE["saves"]}"
  end

  def frame
    render layout: false
  end

  # The side panel: a list whose links open in ui :side_panel, and what they answer with.
  def panel
    @state = STATE
  end

  def peek
    render layout: false
  end

  # runeui under rune_ui's tokens, through the bridge stylesheet.
  def bridge
    render layout: false
  end

  def stream
    render turbo_stream: [
      turbo_stream.append("streamed", partial: "pages/streamed"),
      turbo_stream.ui_toast("Streamed", type: :info, description: "A select arrived")
    ]
  end
end
