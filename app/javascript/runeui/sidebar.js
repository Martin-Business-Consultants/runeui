// The app shell's sidebar (ui :app_shell): a [data-runeui-sidebar="toggle"] button or the [ key
// collapses it to icons and back, remembered in a cookie the server reads so the next page draws
// it the same way from the first paint. On a phone the same toggle slides it in over the page;
// the scrim, Escape or following a link closes it.

const PHONE = matchMedia("(max-width: 767px)")

function shell() { return document.querySelector("[data-slot=app-shell]") }

function toggle() {
  const element = shell()
  if (!element) return
  if (PHONE.matches) {
    element.toggleAttribute("data-mobile-open")
    return
  }
  const collapsed = element.dataset.sidebar !== "collapsed"
  element.dataset.sidebar = collapsed ? "collapsed" : "expanded"
  document.cookie = `runeui_sidebar=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`
}

function closeOnPhone() { shell()?.removeAttribute("data-mobile-open") }

export function wireSidebar() {
  document.addEventListener("click", (event) => {
    const control = event.target.closest?.("[data-runeui-sidebar]")
    if (control) return control.dataset.runeuiSidebar === "close" ? closeOnPhone() : toggle()
    if (event.target.closest?.("[data-slot=sidebar] a")) closeOnPhone()
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOnPhone()
    if (event.key !== "[" || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target.closest?.("input, textarea, select, [contenteditable], ui-input, ui-combobox, ui-autocomplete, ui-token-input")) return
    if (!shell()) return
    event.preventDefault()
    toggle()
  })
  document.addEventListener("turbo:before-cache", closeOnPhone)
}
