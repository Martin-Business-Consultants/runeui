import { Controller } from "@hotwired/stimulus"

// A form that submits as it changes: data-controller="runeui--autosubmit" on a <form> (ui :filter
// uses it; a settings form that saves as you go can too). A change in any of its fields, native
// or a runeui component, submits it with requestSubmit, so Turbo handles it as it would a click
// on Submit (frames, streams and data-turbo-* on the form all apply). Text typed into a field
// submits after a pause when debounceValue says how long (milliseconds; 0, the default, waits
// for the field's own change: Enter or leaving it).
//
// A GET form leaves blank fields out of the address (cleanValue: false keeps them), so a filter
// set back to "any" drops its param. A field marked data-autosubmit="false" never triggers it.
//
// To wire it yourself, call its actions: data-action="change->runeui--autosubmit#submit" or
// "input->runeui--autosubmit#later".
export default class extends Controller {
  static values = {
    debounce: { type: Number, default: 0 },
    clean: { type: Boolean, default: true }
  }

  connect() {
    this.onChange = (event) => { if (this.triggers(event)) this.submit() }
    this.onInput = (event) => { if (this.debounceValue > 0 && this.typed(event) && this.triggers(event)) this.later() }
    this.onFormData = (event) => this.dropBlanks(event.formData)
    this.element.addEventListener("change", this.onChange)
    this.element.addEventListener("input", this.onInput)
    this.element.addEventListener("formdata", this.onFormData)
  }

  disconnect() {
    clearTimeout(this.timer)
    this.element.removeEventListener("change", this.onChange)
    this.element.removeEventListener("input", this.onInput)
    this.element.removeEventListener("formdata", this.onFormData)
  }

  submit() {
    clearTimeout(this.timer)
    // One submit per change: a component's change can arrive twice, a frame apart, and a field
    // typed into fires change again as it's left with what was already sent.
    const sending = new URLSearchParams(new FormData(this.element)).toString()
    if (sending === this.sent && Date.now() - this.sentAt < 500) return
    this.sent = sending
    this.sentAt = Date.now()
    this.element.requestSubmit()
  }

  later() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.submit(), this.debounceValue)
  }

  triggers(event) {
    return !event.target.closest?.("[data-autosubmit=false]")
  }

  typed(event) {
    return event.target.matches?.("input:not([type=checkbox], [type=radio], [type=file], [type=range], [type=color]), textarea")
  }

  // Blank fields out of a GET form's address, as the form's data is gathered (the formdata
  // event), so it covers native fields and components alike and nothing is disabled.
  dropBlanks(data) {
    if (!this.cleanValue || (this.element.getAttribute("method") || "get").toLowerCase() !== "get") return
    for (const [ name, value ] of [ ...data.entries() ]) {
      if (value !== "") continue
      const kept = data.getAll(name).filter((other) => other !== "")
      data.delete(name)
      for (const other of kept) data.append(name, other)
    }
  }
}
