import { Controller } from "@hotwired/stimulus"

// Hold to confirm (ui :hold_button; after microinteractions.dev's hold-to-confirm button). A press
// starts a timer and a linear fill on the same duration; holding to the end confirms, anything
// else cancels: letting go, the pointer cancelled, the button or the window losing focus, the
// tab hidden, Escape. The next press starts from zero, even while the fill still retracts.
//
// Space and Enter hold as a press does (key repeat doesn't restart it; only the key that started
// it ends it). A click with no press behind it (event.detail 0: a screen reader's, a switch's)
// opens the alert dialog beside it instead, focus on Cancel; accepting it confirms the same way.
//
// Confirming fires holdconfirm on the button (bubbling, cancelable) and, when the dialog holds a
// form (href:), submits it through Turbo unless that event was cancelled. One live region says
// Confirmed, or Cancelled after a hold longer than 300ms; brief taps stay silent.
export default class extends Controller {
  static targets = [ "button", "status" ]
  static values = {
    duration: { type: Number, default: 1200 },
    confirmed: { type: String, default: "Confirmed" },
    cancelled: { type: String, default: "Cancelled" },
    dialog: String
  }

  connect() {
    this.input = null
    this.abort = new AbortController()
    const { signal } = this.abort
    const button = this.buttonTarget
    const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { signal, ...options })

    on(button, "pointerdown", (event) => this.pointerDown(event))
    // Fires after pointerup and pointercancel, even outside the button.
    on(button, "lostpointercapture", (event) => { if (this.input === event.pointerId) this.cancel() })
    on(button, "contextmenu", (event) => { if (this.state === "holding") event.preventDefault() })
    on(button, "blur", () => { delete button.dataset.pointerFocus; this.cancel() })
    on(button, "keydown", (event) => this.keyDown(event))
    on(button, "keyup", (event) => {
      // Space clicks on keyup, even after Escape cancelled its hold.
      if (event.key === " ") event.preventDefault()
      if (this.input === event.key) this.cancel()
    })
    on(button, "click", (event) => this.click(event))
    on(window, "blur", () => this.cancel())
    on(document, "visibilitychange", () => { if (document.hidden) this.cancel() })
    // A morph outside a component drops the duration set here: set it again.
    on(document, "turbo:morph", () => this.time())

    const dialog = this.dialog
    if (dialog) {
      // UI SDK's events don't bubble: listen on the dialog, in the capture phase.
      on(dialog, "openchange", (event) => {
        if (event.detail?.value) return
        if (event.detail?.returnValue === "confirm") this.confirm("virtual")
        else if (this.asking) {
          // Its own Delete button (with href:) closes it without a value, then submits.
          setTimeout(() => { if (this.state !== "confirmed") this.say(this.cancelledValue) }, 0)
        }
        this.asking = false
      }, { capture: true })
      // The dialog's own Delete button submits its form: that's an accepted dialog too.
      on(dialog, "submit", () => { if (!this.submitting) this.confirm("virtual", { submit: false }) }, { capture: true })
    }
    this.time()
  }

  disconnect() {
    this.abort?.abort()
    clearTimeout(this.timer)
    clearTimeout(this.resetTimer)
    this.reset()
  }

  get dialog() { return this.dialogValue ? document.getElementById(this.dialogValue) : null }
  get state() { return this.buttonTarget.dataset.state }
  set state(value) { this.buttonTarget.dataset.state = value }
  get form() { return this.dialog?.querySelector("form") }

  // The timer and the fill read one duration, so they can't drift apart.
  time() { this.buttonTarget.style.setProperty("--ui-hold-duration", `${this.durationValue}ms`) }

  pointerDown(event) {
    const button = this.buttonTarget
    // A disabled button (or fieldset) still gets pointer events; only clicks are blocked.
    if (event.button !== 0 || !event.isPrimary || button.matches(":disabled")) return
    // Keeps Escape working without WebKit's mouse default blurring the button.
    event.preventDefault()
    button.dataset.pointerFocus = ""
    button.focus({ preventScroll: true })
    if (this.input !== null || this.state === "confirmed") return
    button.setPointerCapture(event.pointerId)
    button.dataset.pressed = ""
    this.start(event.pointerId, "pointer")
  }

  keyDown(event) {
    const button = this.buttonTarget
    delete button.dataset.pointerFocus
    if (event.key === "Escape" && this.state === "holding") {
      // Only during a hold, so Escape still closes a dialog around the button otherwise.
      event.preventDefault()
      event.stopPropagation()
      this.cancel()
      return
    }
    if (event.key !== " " && event.key !== "Enter") return
    if (event.metaKey || event.ctrlKey || event.altKey || button.matches(":disabled")) return
    event.preventDefault()
    if (event.repeat || this.input !== null || this.state === "confirmed") return
    this.start(event.key, "keyboard")
  }

  click(event) {
    if (event.detail !== 0 || this.input !== null || this.state === "confirmed") return
    const dialog = this.dialog
    if (!dialog) return
    this.say("")
    this.asking = true
    dialog.open = true
  }

  start(input, type) {
    const button = this.buttonTarget
    // A new press starts at zero, even while the last fill is still retracting.
    for (const animation of button.querySelector("[data-slot=hold-fill]")?.getAnimations() ?? []) animation.finish()
    this.input = input
    this.started = performance.now()
    this.say("")
    button.dataset.input = type
    this.state = "holding"
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.confirm(type), this.durationValue)
  }

  cancel() {
    this.input = null
    delete this.buttonTarget.dataset.pressed
    clearTimeout(this.timer)
    if (this.state !== "holding") return
    this.state = "idle"
    if (performance.now() - this.started > 300) this.say(this.cancelledValue)
  }

  confirm(type, { submit = true } = {}) {
    const button = this.buttonTarget
    clearTimeout(this.timer)
    this.input = null
    delete button.dataset.pressed
    button.dataset.input = type
    this.state = "confirmed"
    button.setAttribute("aria-disabled", "true")
    this.say(this.confirmedValue)
    const event = new CustomEvent("holdconfirm", { bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    const form = this.form
    if (form && submit && !event.defaultPrevented) {
      this.submitting = true
      // Back to idle once the request is done, in case the page stays (a stream answered it).
      form.addEventListener("turbo:submit-end", () => this.later(), { once: true })
      form.requestSubmit()
      this.submitting = false
    } else if (form && !submit) {
      form.addEventListener("turbo:submit-end", () => this.later(), { once: true })
    } else {
      this.later()
    }
  }

  later() {
    clearTimeout(this.resetTimer)
    this.resetTimer = setTimeout(() => this.reset(), 1400)
  }

  reset() {
    if (!this.hasButtonTarget) return
    this.state = "idle"
    this.buttonTarget.removeAttribute("aria-disabled")
    delete this.buttonTarget.dataset.pressed
    this.say("")
  }

  say(message) {
    if (this.hasStatusTarget) this.statusTarget.textContent = message
  }
}
