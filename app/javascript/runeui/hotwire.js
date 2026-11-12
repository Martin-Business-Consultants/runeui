// What makes UI SDK's components at home in a Hotwire app. Each piece is its own module, so an
// app can take only some: import { guardMorphs } from "runeui/morph".
import { guardMorphs } from "runeui/morph"
import { bridgeFormEvents } from "runeui/forms"
import { wireFeedback } from "runeui/feedback"
import { wireTheme } from "runeui/theme"
import { registerControllers } from "runeui/controllers"
import { wireProps } from "runeui/props"
// These listen on the document as they load: server search for comboboxes and autocompletes,
// commands that visit a page, and a trigger menu's triggers from markup.
import "runeui/remote"
import "runeui/command"
import "runeui/triggers"

// Turbo snapshots the page for Back before it leaves. A popup open in that snapshot would come
// back open, so popups close first. (Dialogs and menus close themselves on a visit anyway.)
function closePopupsBeforeCache() {
  document.addEventListener("turbo:before-cache", () => {
    for (const element of document.querySelectorAll("[data-open]")) {
      const host = element.closest("ui-select, ui-combobox, ui-menu, ui-popover, ui-dialog, ui-drawer, ui-alert-dialog, ui-hover-card, ui-tooltip, ui-date-picker, ui-autocomplete, ui-trigger-menu, ui-navigation-menu, ui-menubar")
      if (host && "open" in host && host.open) host.open = false
    }
  })
}

export function hotwire(options = {}) {
  guardMorphs()
  bridgeFormEvents()
  closePopupsBeforeCache()
  wireFeedback(options)
  wireTheme()
  registerControllers()
  wireProps()
}

// A button anywhere opening or closing a dialog, sheet, popover or menu by its id:
// <button data-runeui-open="settings">Settings</button>, data-runeui-close="settings".
document.addEventListener("click", (event) => {
  const opener = event.target.closest?.("[data-runeui-open], [data-runeui-close]")
  if (!opener) return
  const opening = opener.hasAttribute("data-runeui-open")
  const target = document.getElementById(opening ? opener.dataset.runeuiOpen : opener.dataset.runeuiClose)
  if (target && "open" in target) target.open = opening
})
