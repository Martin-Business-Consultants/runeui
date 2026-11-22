import { Controller } from "@hotwired/stimulus"

// A link's underline as a plucked string (ui :button, variant: :link; after microinteractions.dev's
// plucked underline). The underline is one quadratic curve in an SVG (data-slot="button-string"):
// the pointer bends it where it comes in, and it rings out flat at a speed set by its width, the
// way a longer string rings slower. Only transform and clip-path move; the path's d is written
// once per pluck, never animated.
//
// data-plucked opens the underline from the pluck point (clip-path), data-ringing runs the ring
// (scaleY to flat on a damped linear() curve). Leaving closes it while the string keeps ringing.
// Keyboard focus shows it flat at once (CSS). A touch plucks on press and closes after the ring.
// Without this controller (or before it connects) the link underlines as usual on hover.
const MS_PER_PX = 13
const MIN_MS = 400
const MAX_MS = 1200

export default class extends Controller {
  connect() {
    this.string = this.element.querySelector("[data-slot=button-string]")
    if (!this.string) return
    this.path = this.string.querySelector("path")
    this.abort = new AbortController()
    const { signal } = this.abort
    const on = (target, type, handler) => target.addEventListener(type, handler, { signal })

    on(this.element, "pointerenter", (event) => { if (event.pointerType === "mouse") this.pluck(event.clientX) })
    on(this.element, "pointerleave", (event) => { if (event.pointerType === "mouse") this.release() })
    on(this.element, "pointerdown", (event) => {
      if (event.pointerType === "mouse") return
      this.touch = true
      this.pluck(event.clientX)
    })
    on(this.string, "transitionend", (event) => {
      // The ring ending on a touch: let the settled line show, then close it.
      if (event.target === this.path && this.touch) {
        clearTimeout(this.closing)
        this.closing = setTimeout(() => this.release(), 400)
      }
      this.settle()
    })

    // A morph outside a component takes the attributes this controller set: put them back.
    on(document, "turbo:morph", () => this.ready())

    this.resize = new ResizeObserver(() => this.tune())
    this.resize.observe(this.element)
    this.ready()
  }

  ready() {
    this.element.setAttribute("data-pluck", "")
    this.tune()
  }

  disconnect() {
    this.abort?.abort()
    this.resize?.disconnect()
    clearTimeout(this.closing)
    this.element.removeAttribute("data-plucked")
    this.element.removeAttribute("data-ringing")
    this.element.removeAttribute("data-pluck")
  }

  // A longer string rings longer: 13ms a pixel, 400 to 1200ms. Only the duration changes, never the curve.
  tune() {
    const width = this.string.getBoundingClientRect().width
    const ms = Math.min(Math.max(width * MS_PER_PX, MIN_MS), MAX_MS)
    this.element.style.setProperty("--ui-pluck-duration", `${Math.round(ms)}ms`)
  }

  pluck(clientX) {
    clearTimeout(this.closing)
    const box = this.string.getBoundingClientRect()
    if (!box.width) return
    const x = Math.min(Math.max(((clientX - box.left) / box.width) * 100, 15), 85)
    // A longer string bends further under the same pull; a quadratic peaks halfway to its control point.
    const bend = Math.min(Math.max(box.width / 18, 2), 5)
    const { element, string, path } = this
    // Commit the starting state (closed at the new point, fully bent) with transitions off, so
    // each pluck starts clean even while the last one still rings.
    element.removeAttribute("data-plucked")
    element.removeAttribute("data-ringing")
    string.style.transition = path.style.transition = "none"
    element.style.setProperty("--ui-pluck-x", `${x}%`)
    path.setAttribute("d", `M0 6 Q${x.toFixed(1)} ${(6 + bend * 2).toFixed(1)} 100 6`)
    void getComputedStyle(string).clipPath
    void getComputedStyle(path).transform
    string.style.transition = path.style.transition = ""
    element.setAttribute("data-plucked", "")
    element.setAttribute("data-ringing", "")
  }

  release() {
    this.touch = false
    this.element.removeAttribute("data-plucked")
    this.settle()
  }

  // The ring stops once the underline has closed: never by freezing the string mid-swing.
  settle() {
    if (this.element.hasAttribute("data-plucked")) return
    if (this.string.getAnimations().length === 0) this.element.removeAttribute("data-ringing")
  }
}
