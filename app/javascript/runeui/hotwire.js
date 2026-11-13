// What makes UI SDK's components at home in a Hotwire app. Each piece is its own module, so an
// app can take only some: import { guardMorphs } from "runeui/morph".
import { guardMorphs } from "runeui/morph"
import { bridgeFormEvents } from "runeui/forms"
import { wireFeedback, showToast } from "runeui/feedback"
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
      // The side panel's state is the address: a restored page comes back with it open.
      if (host && !host.hasAttribute("data-side-panel") && "open" in host && host.open) host.open = false
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
// And one that shows a toast: data-runeui-toast='{"title": "Copied", "type": "success"}'.
//
// A popup placed beside something (a menu, a popover, a select, a combobox, a date picker) opens
// beside the button that opened it, so one on the page can serve many buttons (a menu per table,
// not per row): the button is its anchor for that open, gets aria-expanded while it's open and
// focus back when it closes, pressing it again closes the popup, and the popup's element says
// who opened it (runeuiOpener) and fires runeui:open (not bubbling, detail.opener) just before.
const ANCHORED = "ui-menu-content, ui-popover-content, ui-select-content, ui-combobox-content, ui-date-picker-content"

function anchoredContent(target) {
  return [ ...target.querySelectorAll(ANCHORED) ].find((content) => content.parentElement === target) || null
}

// A press on the button that opened a popup dismisses it (a press outside), and the click that
// follows would open it again: remember it was open, and leave it closed.
let pressedOpen = null
let openers = 0
document.addEventListener("pointerdown", (event) => {
  const opener = event.target.closest?.("[data-runeui-open]")
  const target = opener && document.getElementById(opener.dataset.runeuiOpen)
  pressedOpen = target && target.open && sameOpener(target, opener) ? opener : null
}, true)

// The same button, or the one a stream or a morph put in its place (the same id).
function sameOpener(target, opener) {
  const last = target.runeuiOpener
  return last === opener || (!!last && !!opener.id && last.id === opener.id && !last.isConnected)
}

// Through the element's controller where it has one, so it fires openchange as it would for a
// person (setting the open property is silent on some).
function setOpen(target, open) {
  const api = target.api
  if (open && api?.open) api.open()
  else if (!open && api?.close) api.close()
  else target.open = open
}

function openBeside(target, content, opener) {
  if (pressedOpen === opener || (target.open && sameOpener(target, opener))) {
    pressedOpen = null
    setOpen(target, false)
    return
  }
  if (target.open) setOpen(target, false)
  target.runeuiOpener = opener
  // The content takes its anchor as a selector, so the button needs an id.
  if (!opener.id) opener.id = `runeui-opener-${++openers}`
  content.setAttribute("anchor", `#${CSS.escape(opener.id)}`)
  target.dispatchEvent(new CustomEvent("runeui:open", { detail: { opener } }))
  opener.setAttribute("aria-expanded", "true")
  const closed = (event) => {
    if (event.detail?.value !== false) return
    target.removeEventListener("openchange", closed)
    opener.setAttribute("aria-expanded", "false")
    const active = document.activeElement
    // A stream or a morph may have put a new button in its place: the one with its id now.
    const back = opener.isConnected ? opener : document.getElementById(opener.id)
    if (back && (!active || active === document.body || target.contains(active))) back.focus({ preventScroll: true })
  }
  target.addEventListener("openchange", closed)
  setOpen(target, true)
}

document.addEventListener("click", (event) => {
  const toaster = event.target.closest?.("[data-runeui-toast]")
  if (toaster) {
    const { title, ...options } = JSON.parse(toaster.dataset.runeuiToast)
    showToast(title, options)
  }
  const opener = event.target.closest?.("[data-runeui-open], [data-runeui-close]")
  if (!opener) return
  const opening = opener.hasAttribute("data-runeui-open")
  // A submit button that closes its dialog leaves it open while its form won't send (a field
  // still to fill in).
  if (!opening && opener.type === "submit" && opener.form && !opener.form.checkValidity()) return
  const target = document.getElementById(opening ? opener.dataset.runeuiOpen : opener.dataset.runeuiClose)
  if (!target || !("open" in target)) return
  const content = opening && anchoredContent(target)
  if (content) openBeside(target, content, opener)
  else target.open = opening
})
