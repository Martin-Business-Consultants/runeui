import { Controller } from "@hotwired/stimulus"

// A filter whose list can be searched (ui :filter, search: true): a combobox with its input in
// the popup, opened by the pill. UI SDK leaves the pill's words, the box's text and where focus
// goes back to the page, so this keeps them: the pill says what's chosen, the box starts empty
// and focused each time it opens, and closing hands focus back to the pill.
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
      if (!event.detail.value && within) this.triggerTarget.focus()
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
    const chosen = value == null || value === "" ? null : [ ...this.element.querySelectorAll("ui-combobox-item") ].find((item) => item.getAttribute("value") === String(value))
    this.valueTarget.textContent = chosen ? chosen.getAttribute("label") : this.placeholderValue
    this.valueTarget.toggleAttribute("data-placeholder", !chosen)
  }
}
