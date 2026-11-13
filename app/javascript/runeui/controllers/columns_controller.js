import { Controller } from "@hotwired/stimulus"

// Hiding a table's columns (ui :table, columns: "key" with ui :columns_menu). Each checkbox in
// the menu shows or hides the cells of one column: every th and td carrying data-column="name".
// The choice is this browser's, per table (localStorage, under the table's key), and holds as
// rows come and go (a Turbo stream, a morph, the next page): new cells are hidden as they arrive.
export default class extends Controller {
  static targets = [ "menu" ]
  static values = { key: String }

  connect() {
    this.hidden = this.stored
    this.apply()
    this.observer = new MutationObserver(() => this.apply())
    this.observer.observe(this.element, { childList: true, subtree: true })
  }

  disconnect() {
    this.observer?.disconnect()
  }

  menuTargetConnected(menu) {
    // UI SDK's events don't bubble: an item's change is caught on its menu, on the way down.
    menu.addEventListener("checkedchange", this.toggle, { capture: true })
    this.hidden ||= this.stored
    for (const item of menu.querySelectorAll("ui-menu-checkbox-item")) this.check(item, !this.hidden.includes(item.getAttribute("value")))
  }

  menuTargetDisconnected(menu) {
    menu.removeEventListener("checkedchange", this.toggle, { capture: true })
  }

  toggle = (event) => {
    const name = event.target.getAttribute?.("value")
    if (name == null || this.setting) return
    this.hidden = event.detail.value ? this.hidden.filter((other) => other !== name) : [ ...new Set([ ...this.hidden, name ]) ]
    this.stored = this.hidden
    this.apply()
    this.dispatch("change", { detail: { hidden: this.hidden } })
  }

  apply() {
    for (const cell of this.element.querySelectorAll("[data-column]")) {
      const hide = this.hidden.includes(cell.dataset.column)
      if (cell.hidden !== hide) cell.hidden = hide
    }
  }

  // The stored choice onto a menu's item, before or after it upgrades, without counting as a toggle.
  check(item, checked) {
    this.setting = true
    item.toggleAttribute("default-checked", checked)
    if ("checked" in item && item.checked !== checked) item.checked = checked
    this.setting = false
  }

  get storageKey() {
    return `runeui:columns:${this.keyValue}`
  }

  get stored() {
    try { return JSON.parse(localStorage.getItem(this.storageKey)) || [] } catch { return [] }
  }

  set stored(names) {
    try { localStorage.setItem(this.storageKey, JSON.stringify(names)) } catch {}
  }
}
