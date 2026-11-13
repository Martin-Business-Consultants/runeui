import { Controller } from "@hotwired/stimulus"

// A combobox with its input in the popup, opened by a button: a filter whose list can be
// searched (ui :filter, search: true) and a combobox behind a trigger (ui :combobox, trigger:).
// UI SDK leaves the button's words, the box's text and where focus goes back to the page, so
// this keeps them: the button says what's chosen (every choice, with multiple), the box starts
// empty and focused each time it opens, and closing hands focus back to the button, or to
// whatever opened it from elsewhere (data-runeui-open, with no trigger of its own).
export default class extends Controller {
  static targets = [ "trigger", "value" ]
  static values = { placeholder: String }

  connect() {
    this.onValue = (event) => this.show(event.detail.value)
    this.onOpen = (event) => {
      if (!event.detail.value) return
      this.element.query = ""
      requestAnimationFrame(() => this.element.querySelector("ui-combobox-input input")?.focus())
    }
    this.onClosed = (event) => {
      const within = !document.activeElement || document.activeElement === document.body || this.element.contains(document.activeElement)
      if (!event.detail.value && within) (this.hasTriggerTarget ? this.triggerTarget : this.element.runeuiOpener)?.focus()
    }
    // UI SDK's events don't bubble: they're heard on the element itself.
    this.element.addEventListener("valuechange", this.onValue)
    this.element.addEventListener("openchange", this.onOpen)
    this.element.addEventListener("openchangecomplete", this.onClosed)
  }

  disconnect() {
    this.element.removeEventListener("valuechange", this.onValue)
    this.element.removeEventListener("openchange", this.onOpen)
    this.element.removeEventListener("openchangecomplete", this.onClosed)
  }

  show(value) {
    if (!this.hasValueTarget) return
    const values = [].concat(value ?? []).filter((one) => one !== "").map(String)
    const items = [ ...this.element.querySelectorAll("ui-combobox-item") ]
    const labels = values.map((one) => items.find((item) => item.getAttribute("value") === one)?.getAttribute("label")).filter(Boolean)
    this.valueTarget.textContent = labels.length ? labels.join(", ") : this.placeholderValue
    this.valueTarget.toggleAttribute("data-placeholder", !labels.length)
  }
}
