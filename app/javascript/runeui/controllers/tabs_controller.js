import { Controller } from "@hotwired/stimulus"

// The sliding line under underlined tabs (ui :tabs, variant: :line; after microinteractions.dev's
// tab indicator). One element, the list's data-slot="tabs-indicator", moved with a single
// transform: translate to the chosen tab and scaleX to its width (scaleY down the side), measured
// with getBoundingClientRect so it keeps subpixel widths. A CSS transition takes it there, so a
// tab chosen mid-move turns the line from where it is. Keyboard changes land at once (a held
// arrow repeats faster than the line travels), and so does a resize, unless it's already moving.
//
// Until it has measured, the line is hidden and the chosen tab draws its own underline, so the
// first paint is right. For tabs that are links (href:), a click on one that loads a Turbo Frame
// marks it current and the line travels; when the tabs themselves come back inside that frame,
// the line starts from where it was. A full page load (Turbo Drive's too) places it at once.
const remembered = new Map()
document.addEventListener("turbo:before-render", () => remembered.clear())

export default class extends Controller {
  connect() {
    this.list = this.element.querySelector("[data-slot=tabs-list]")
    this.line = this.list?.querySelector(":scope > [data-slot=tabs-indicator]")
    if (!this.line) return
    this.abort = new AbortController()
    const { signal } = this.abort
    const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { signal, ...options })

    // UI SDK's valuechange doesn't bubble: capture it on the root. Arrow keys (and Enter with
    // manual activation) choose instantly.
    on(this.element, "valuechange", (event) => {
      const reason = event.detail?.reason
      this.changing = true
      this.instant = reason === "list-navigation" || event.detail?.event instanceof KeyboardEvent
    }, { capture: true })
    on(this.list, "keydown", () => { this.keyboard = true })
    on(this.list, "pointerdown", () => { this.keyboard = false })
    on(this.list, "click", (event) => this.follow(event))
    on(document, "turbo:morph", () => this.ready(true))
    // A page Turbo Drive has just rendered computes its styles only now: land there at once.
    on(document, "turbo:render", () => this.ready(true))

    // The chosen tab changes: UI SDK's data-selected, or a link tab's aria-current. Only a
    // person's choice travels; anything else (the element upgrading, a morph) lands at once.
    this.mutations = new MutationObserver(() => {
      this.place(this.instant || !this.changing)
      this.instant = false
      this.changing = false
    })
    this.mutations.observe(this.list, { subtree: true, attributes: true, attributeFilter: [ "data-selected", "aria-current" ] })

    // Fonts loading and the container changing move the tabs; the line follows at once unless
    // it's moving, in which case the transition retargets.
    this.resize = new ResizeObserver(() => this.place(this.line.getAnimations().length === 0))
    this.resize.observe(this.list)
    for (const tab of this.tabs) this.resize.observe(tab)

    const before = this.element.id && remembered.get(this.element.id)
    remembered.delete(this.element.id)
    if (before && performance.now() - before.at < 2000) {
      this.write(before.transform, true)
      this.ready(false)
      requestAnimationFrame(() => this.place(false))
    } else {
      this.ready(true)
    }
  }

  disconnect() {
    this.abort?.abort()
    this.mutations?.disconnect()
    this.resize?.disconnect()
    // Kept a moment, for the same tabs coming back in a frame's render.
    if (this.line && this.element.id) remembered.set(this.element.id, { transform: getComputedStyle(this.line).transform, at: performance.now() })
  }

  get tabs() { return [ ...this.list.querySelectorAll("[data-slot=tabs-tab]") ] }
  get vertical() { return this.element.dataset.orientation === "vertical" }

  get chosen() {
    return this.tabs.find((tab) => tab.hasAttribute("data-selected") || tab.getAttribute("aria-current") === "page")
  }

  ready(instant) {
    this.place(instant)
    this.element.setAttribute("data-indicator-ready", "")
  }

  // Boxes come back scaled by any transformed ancestor; dividing by the list's scale returns to
  // the line's own units. Scroll offsets keep it under its tab in a list that scrolls.
  place(instant) {
    const tab = this.chosen
    if (!tab) { this.line.hidden = true; return }
    this.line.hidden = false
    const list = this.list.getBoundingClientRect()
    const scale = list.width / this.list.offsetWidth || 1
    const box = tab.getBoundingClientRect()
    const left = (box.left - list.left) / scale + this.list.scrollLeft - this.list.clientLeft
    const top = (box.top - list.top) / scale + this.list.scrollTop - this.list.clientTop
    const transform = this.vertical
      ? `translate(${left + box.width / scale + 3}px, ${top}px) scaleY(${box.height / scale})`
      : `translate(${left}px, ${top + box.height / scale + 3}px) scaleX(${box.width / scale})`
    this.write(transform, instant)
  }

  write(transform, instant) {
    const line = this.line
    const token = this.token = (this.token ?? 0) + 1
    if (instant) {
      line.style.transition = "none"
      line.style.transform = transform
      void line.offsetWidth
      for (const animation of line.getAnimations()) animation.finish()
      // Turned back on once the instant style has surely been painted (a page Turbo has just
      // rendered may not have computed it yet), unless a later write already moved on.
      requestAnimationFrame(() => requestAnimationFrame(() => { if (this.token === token) line.style.transition = "" }))
    } else {
      line.style.transition = ""
      line.style.transform = transform
    }
  }

  // A link tab that loads a Turbo Frame: it becomes current now, and the line travels. A full
  // page load (or a click with a modifier, which opens elsewhere) leaves the line where it is.
  follow(event) {
    const link = event.target.closest?.("a[data-slot=tabs-tab]")
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const frame = link.dataset.turboFrame || link.closest("turbo-frame:not([target=_top])")?.id
    if (!frame || frame === "_top" || link.getAttribute("aria-disabled") === "true") return
    this.instant = event.detail === 0 && this.keyboard
    this.changing = true
    for (const tab of this.tabs) tab.setAttribute("aria-current", tab === link ? "page" : "false")
  }
}
