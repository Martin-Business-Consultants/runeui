import { Controller } from "@hotwired/stimulus"

// A carousel's dots (ui :carousel, indicators: true; after microinteractions.dev's worm dots).
// The worm, the mark over the current dot, is drawn in CSS from UI SDK's --carousel-progress,
// which follows every frame of a scroll: it stretches from one dot to the next as the slides
// move and has no clock of its own. This controller tells it how many pages there are
// (--ui-carousel-pages, which only UI SDK knows once it has measured the slides) and lets the
// dots be scrubbed: drag across them and the slides follow the pointer, snapping to the nearest
// page on release. A tap is still the indicator's own (UI SDK's), and so is the keyboard.
const SCRUB = 4
const CATCH_UP = 60
const DOTS = "[data-slot=carousel-indicator]"

export default class extends Controller {
  connect() {
    this.group = this.element.querySelector("[data-slot=carousel-indicator-group]")
    this.viewport = this.element.querySelector("[data-slot=carousel-viewport]")
    if (!this.group || !this.viewport) return
    this.abort = new AbortController()
    const { signal } = this.abort
    const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { signal, ...options })
    on(this.element, "pagechangecomplete", () => this.count(), { capture: true })
    on(document, "turbo:morph", () => this.count())
    on(this.group, "pointerdown", (event) => this.press(event))
    on(this.group, "pointermove", (event) => this.move(event))
    on(this.group, "pointerup", (event) => this.release(event, true))
    on(this.group, "pointercancel", (event) => this.release(event, false))
    on(this.group, "lostpointercapture", (event) => this.release(event, false))
    // The click after a scrub isn't a tap on the dot it ended over.
    on(this.group, "click", (event) => {
      if (!this.swallow) return
      this.swallow = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }, { capture: true })
    this.resize = new ResizeObserver(() => this.count())
    this.resize.observe(this.viewport)
    customElements.whenDefined("ui-carousel").then(() => this.count())
    this.count()
  }

  disconnect() {
    this.abort?.abort()
    this.resize?.disconnect()
    this.stop()
  }

  get dots() { return [ ...this.group.querySelectorAll(DOTS) ].filter((dot) => !dot.hidden && dot.offsetParent) }
  get pages() { return this.element.api?.getPageCount?.() || this.dots.length || 1 }
  get horizontal() { return this.element.dataset.orientation !== "vertical" }

  count() {
    this.element.style.setProperty("--ui-carousel-pages", this.pages)
    this.element.setAttribute("data-worm", "")
  }

  // Where along the dots the pointer is, in pages (0 to pages - 1), measured from the first
  // dot's box so the padding around the strip doesn't shift it.
  positionAt(clientX) {
    const dots = this.dots
    if (dots.length < 2) return 0
    const first = dots[0].getBoundingClientRect()
    const second = dots[1].getBoundingClientRect()
    const step = second.left - first.left
    const position = (clientX - (first.left + first.width / 2)) / step
    return Math.min(Math.max(position, 0), dots.length - 1)
  }

  press(event) {
    if (this.drag || event.button !== 0 || !event.isPrimary || this.element.hasAttribute("loop")) return
    this.drag = { id: event.pointerId, x: event.clientX, scrubbing: false }
  }

  move(event) {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.id) return
    if (!drag.scrubbing) {
      if (Math.abs(event.clientX - drag.x) < SCRUB) return
      drag.scrubbing = true
      this.group.setPointerCapture(event.pointerId)
      this.group.setAttribute("data-scrubbing", "")
      // Snapping would fight the pointer; it comes back on release.
      drag.snap = this.viewport.style.scrollSnapType
      this.viewport.style.scrollSnapType = "none"
      drag.last = performance.now()
      this.frame = requestAnimationFrame((now) => this.follow(now))
    }
    drag.target = this.positionAt(event.clientX)
  }

  // Each frame the slides catch up with the pointer (a 60ms time constant), so a press far from
  // the worm glides there rather than jumping. Under reduced motion they follow it directly.
  follow(now) {
    const drag = this.drag
    if (!drag?.scrubbing) return
    const viewport = this.viewport
    const pages = Math.max(this.dots.length - 1, 1)
    const span = this.horizontal ? viewport.scrollWidth - viewport.clientWidth : viewport.scrollHeight - viewport.clientHeight
    const goal = (drag.target / pages) * span
    const current = this.horizontal ? viewport.scrollLeft : viewport.scrollTop
    const elapsed = Math.max(now - drag.last, 0)
    drag.last = now
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const next = reduce ? goal : current + (goal - current) * (1 - Math.exp(-elapsed / CATCH_UP))
    if (this.horizontal) viewport.scrollLeft = next
    else viewport.scrollTop = next
    this.frame = requestAnimationFrame((time) => this.follow(time))
  }

  // Up: the page nearest where the pointer let go. Cancelled: the page nearest where the slides are.
  release(event, committed) {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.id) return
    this.drag = null
    if (!drag.scrubbing) return
    this.stop(drag)
    const progress = this.element.api?.getProgress?.() ?? 0
    const page = committed ? Math.round(drag.target ?? 0) : Math.round(progress * Math.max(this.dots.length - 1, 0))
    this.swallow = committed
    setTimeout(() => { this.swallow = false }, 0)
    this.element.api?.setPage?.(page + 1)
    if (this.group.contains(document.activeElement)) this.dots[page]?.focus({ preventScroll: true })
  }

  stop(drag) {
    cancelAnimationFrame(this.frame)
    this.group?.removeAttribute("data-scrubbing")
    if (drag && this.viewport) this.viewport.style.scrollSnapType = drag.snap ?? ""
  }
}
