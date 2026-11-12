// runeui's Stimulus controllers, registered as runeui--<name>. Stateful pieces runeui adds
// itself are controllers, so an app can read them, extend them and wire them with data-action;
// page-wide plumbing (autoloading, the morph guard, toasts, data-runeui-* attributes) is plain
// modules, as Turbo's own data-turbo-* handling is.
//
// They register on the app's Stimulus application when there is one (window.Stimulus, as
// Rails' generated controllers/application.js sets), else on one runeui starts. To register
// them yourself: import { registerControllers } from "runeui/controllers".
import { Application } from "@hotwired/stimulus"
import SidebarController from "runeui/controllers/sidebar_controller"
import SelectionController from "runeui/controllers/selection_controller"
import BoardController from "runeui/controllers/board_controller"
import AutosubmitController from "runeui/controllers/autosubmit_controller"
import SidePanelController from "runeui/controllers/side_panel_controller"

export const CONTROLLERS = {
  "runeui--sidebar": SidebarController,
  "runeui--selection": SelectionController,
  "runeui--board": BoardController,
  "runeui--autosubmit": AutosubmitController,
  "runeui--side-panel": SidePanelController
}

export function registerControllers(application = window.Stimulus) {
  application ||= Application.start()
  for (const [ name, controller ] of Object.entries(CONTROLLERS)) {
    if (!application.router.modulesByIdentifier.has(name)) application.register(name, controller)
  }
  return application
}
