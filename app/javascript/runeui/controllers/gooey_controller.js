import { Controller } from "@hotwired/stimulus"

// A radio group whose dot pours into the radio chosen (ui :radio_group, variant: :gooey; after
// microinteractions.dev's gooey radio group). The radios stay UI SDK's: one Tab stop, arrow keys,
// the form value. The dot is eight small circles in one layer under an SVG filter (blur, then a
// sharp alpha cut, then the circles' own colour painted inside), so circles near each other fuse.
// At rest they sit stacked on the chosen radio; a change sends a head on the ease-in-out and a
// tail 40ms behind it on the same curve, with circles between them tapering towards the tail, so
// it reads as a drop. Chosen again mid-pour, it turns from where it is on the ease-out. Keyboard
// changes and reduced motion land at once; the first choice swells in place.
const DURATION = 300
const LAG = 40
const FRAMES = 60

function bezier(x1, y1, x2, y2) {
  const curve = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let low = 0
    let high = 1
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2
      if (curve(mid, x1, x2) < x) low = mid
      else high = mid
    }
    return curve((low + high) / 2, y1, y2)
  }
}
const pour = bezier(0.65, 0, 0.35, 1)
const redirect = bezier(0.23, 1, 0.32, 1)
const clamp = (value) => Math.min(Math.max(value, 0), 1)

export default class extends Controller {
  static targets = [ "layer", "blob", "filter" ]

  connect() {
    if (!this.hasLayerTarget) return
    this.abort = new AbortController()
    const { signal } = this.abort
    this.animations = []
    // The filter's id is the server's (one per group, so two groups never share one).
    if (this.hasFilterTarget) this.layerTarget.style.filter = `url(#${this.filterTarget.id})`
    this.element.addEventListener("keydown", () => this.element.setAttribute("data-keyboard", ""), { signal })
    this.element.addEventListener("pointerdown", () => this.element.removeAttribute("data-keyboard"), { signal })
    // UI SDK's valuechange doesn't bubble: capture it on the group.
    this.element.addEventListener("valuechange", (event) => {
      const keyboard = event.detail?.reason === "list-navigation" || event.detail?.event instanceof KeyboardEvent
      if (keyboard) this.element.setAttribute("data-keyboard", "")
      requestAnimationFrame(() => this.change(event.detail?.value))
    }, { capture: true })
    this.element.addEventListener("reset", () => requestAnimationFrame(() => this.rest()), { signal })
    document.addEventListener("turbo:morph", () => this.rest(), { signal })
    this.resize = new ResizeObserver(() => { if (!this.running) this.rest() })
    this.resize.observe(this.element)
    customElements.whenDefined("ui-radio").then(() => requestAnimationFrame(() => this.rest()))
  }

  disconnect() {
    this.abort?.abort()
    this.resize?.disconnect()
    for (const animation of this.animations ?? []) animation.cancel()
  }

  get radios() { return [ ...this.element.querySelectorAll("[data-slot=radio]") ] }
  get checked() { return this.radios.find((radio) => radio.hasAttribute("data-checked") || radio.getAttribute("aria-checked") === "true") }
  get running() { return this.animations.some((animation) => animation.playState === "running") }

  // A radio's centre in the layer's coordinates.
  centre(radio) {
    const layer = this.layerTarget.getBoundingClientRect()
    const box = radio.getBoundingClientRect()
    return { x: box.left + box.width / 2 - layer.left, y: box.top + box.height / 2 - layer.top }
  }

  rest() {
    const radio = this.checked
    this.element.toggleAttribute("data-goo-chosen", Boolean(radio))
    this.current = radio ? this.centre(radio) : null
    if (this.current) for (const blob of this.blobTargets) blob.style.transform = this.at(this.current, 1)
    this.element.setAttribute("data-goo-ready", "")
  }

  at({ x, y }, scale) { return `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})` }

  change(value) {
    const radio = this.radios.find((element) => element.getAttribute("value") === String(value)) || this.checked
    if (!radio) return
    const to = this.centre(radio)
    const from = this.current
    const running = this.animations[0]
    const redirected = this.positionAt && running?.playState === "running"
    let [ head, tail ] = [ from ?? to, from ?? to ]
    if (redirected) [ head, tail ] = this.positionAt(Number(running.currentTime))
    for (const animation of this.animations) animation.cancel()
    this.animations = []
    this.positionAt = null
    this.current = to
    this.element.setAttribute("data-goo-chosen", "")
    for (const blob of this.blobTargets) blob.style.transform = this.at(to, 1)
    if (this.element.hasAttribute("data-keyboard") || matchMedia("(prefers-reduced-motion: reduce)").matches) return

    if (!from) {
      // Nothing to pour from: the dot swells into its radio. Scale only, since the filter's
      // alpha cut turns a fade into a pop.
      this.animations = this.blobTargets.map((blob) => blob.animate(
        [ { transform: this.at(to, 0.3) }, { transform: this.at(to, 1) } ],
        { duration: DURATION, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      ))
      return
    }

    const ease = redirected ? redirect : pour
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    const positionAt = (ms) => [ lerp(head, to, ease(clamp(ms / DURATION))), lerp(tail, to, ease(clamp((ms - LAG) / DURATION))) ]
    this.positionAt = positionAt
    // The distance between neighbouring radios: a drop stretched over 2.2 of them is at its thinnest.
    const [ first, second ] = this.radios.map((element) => this.centre(element))
    const pitch = second ? Math.max(Math.hypot(second.x - first.x, second.y - first.y), 1) : 28
    const blobs = this.blobTargets
    const frames = blobs.map(() => [])
    for (let frame = 0; frame <= FRAMES; frame++) {
      const [ front, back ] = positionAt((frame / FRAMES) * (DURATION + LAG))
      // The tail thins as the drop stretches (to a third at most).
      const gap = Math.hypot(front.x - back.x, front.y - back.y)
      const thin = Math.max(1 - gap / (pitch * 2.2), 0.3)
      blobs.forEach((_, index) => {
        const share = index / (blobs.length - 1)
        frames[index].push({ transform: this.at(lerp(back, front, share), thin + (1 - thin) * share * share) })
      })
    }
    this.animations = blobs.map((blob, index) => blob.animate(frames[index], { duration: DURATION + LAG, easing: "linear" }))
  }
}
