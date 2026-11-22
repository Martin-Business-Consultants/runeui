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
import FilterController from "runeui/controllers/filter_controller"
import ColumnsController from "runeui/controllers/columns_controller"
import HoldController from "runeui/controllers/hold_controller"
import PluckController from "runeui/controllers/pluck_controller"
import TabsController from "runeui/controllers/tabs_controller"
import CarouselController from "runeui/controllers/carousel_controller"
import ResizableController from "runeui/controllers/resizable_controller"
import GooeyController from "runeui/controllers/gooey_controller"

export const CONTROLLERS = {
  "runeui--sidebar": SidebarController,
  "runeui--selection": SelectionController,
  "runeui--board": BoardController,
  "runeui--autosubmit": AutosubmitController,
  "runeui--side-panel": SidePanelController,
  "runeui--filter": FilterController,
  "runeui--columns": ColumnsController,
  "runeui--hold": HoldController,
  "runeui--pluck": PluckController,
  "runeui--tabs": TabsController,
  "runeui--carousel": CarouselController,
  "runeui--resizable": ResizableController,
  "runeui--gooey": GooeyController
}

export function registerControllers(application = window.Stimulus) {
  application ||= Application.start()
  for (const [ name, controller ] of Object.entries(CONTROLLERS)) {
    if (!application.router.modulesByIdentifier.has(name)) application.register(name, controller)
  }
  return application
}
