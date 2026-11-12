import { Controller } from "@hotwired/stimulus"

// The app shell's sidebar (ui :app_shell). toggle collapses it to icons and back, remembered in
// a cookie the server reads so the next page draws it the same way from the first paint; on a
// phone the same toggle slides it in over the page, and close (the scrim, Escape, following a
// link) puts it away. The [ key toggles from anywhere outside a field.
export default class extends Controller {
  static values = { cookie: { type: String, default: "runeui_sidebar" } }

  connect() {
    this.phone = matchMedia("(max-width: 767px)")
  }

  toggle() {
    if (this.phone.matches) {
      this.element.toggleAttribute("data-mobile-open")
      return
    }
    const collapsed = this.element.dataset.sidebar !== "collapsed"
    this.element.dataset.sidebar = collapsed ? "collapsed" : "expanded"
    document.cookie = `${this.cookieValue}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`
  }

  close() {
    this.element.removeAttribute("data-mobile-open")
  }

  // click->runeui--sidebar#closeOnLink on the sidebar: a link followed closes the phone sheet.
  closeOnLink(event) {
    if (event.target.closest("a")) this.close()
  }

  // keydown@window->runeui--sidebar#key
  key(event) {
    if (event.key === "Escape") return this.close()
    if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest?.("input, textarea, select, [contenteditable], ui-input, ui-combobox, ui-autocomplete, ui-token-input, ui-trigger-menu")) return
    event.preventDefault()
    this.toggle()
  }
}
