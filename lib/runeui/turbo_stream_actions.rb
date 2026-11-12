module Runeui
  # Turbo Stream actions the components answer to:
  #
  #   turbo_stream.ui_toast "Saved"
  #   turbo_stream.ui_toast "Couldn't save", type: :error, description: "The name is taken"
  #   turbo_stream.ui_open  "settings-dialog"     # a dialog, sheet, popover or menu by id
  #   turbo_stream.ui_close "settings-dialog"
  module TurboStreamActions
    def ui_toast(title, type: nil, **options)
      turbo_stream_action_tag :ui_toast, title: title, options: options.merge(type: type).compact.to_json
    end

    def ui_open(target)
      turbo_stream_action_tag :ui_open, target: target
    end

    def ui_close(target)
      turbo_stream_action_tag :ui_close, target: target
    end
  end
end
