// UI SDK's form controls are form-associated custom elements: they submit, reset and validate
// with their form like native ones, and fire native, bubbling input and change events when
// their value moves, so data-action="change->form#requestSubmit" and the runeui--autosubmit
// controller work with nothing added (test/browser/contract.test.mjs checks they still do).
// What's left for runeui: the one control that isn't form-associated (the toggle), the date
// picker, which moves its value without a change event, and the inputs controls keep inside
// themselves, whose own native change would reach the form as a second one.

export function bridgeFormEvents() {}

// UI SDK's date picker fires valuechange alone, for a day picked, a date typed and committed, and
// Clear: the change a form listens for comes from here, from the picker, once per change.
const SILENT = new Set([ "ui-date-picker" ])
document.addEventListener("valuechange", (event) => {
  const control = event.target
  if (!SILENT.has(control.localName)) return
  queueMicrotask(() => control.isConnected && control.dispatchEvent(new Event("change", { bubbles: true })))
}, true)

// A control built around an input of its own (a date picker's field, a number's, a combobox's box
// to type in) fires its change itself, with its new value; the inner input's native change (on
// blur, unnamed: it's no field of the form's) goes no further than the input. Without this a form
// that saves on change heard two: the date picker's input before the date was even read, a
// number's beside the number's own; and data-action="change->…" on the control heard both too.
// Seen first in the capture phase, then stopped on the input itself, after the control's own
// listeners there.
const guarded = new WeakSet()
document.addEventListener("change", (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.name || guarded.has(input) || !formControlAround(input)) return
  guarded.add(input)
  input.addEventListener("change", (inner) => inner.stopPropagation())
}, true)

function formControlAround(input) {
  for (let element = input.parentElement; element; element = element.parentElement) {
    if (element.localName.startsWith("ui-") && customElements.get(element.localName)?.formAssociated) return element
  }
  return null
}

// Toggles aren't form-associated. One rendered with name: (ui :toggle, ui :toggle_group) carries
// hidden fields marked data-toggle-field; these follow what's pressed, then fire change.
function syncToggleFields(element) {
  const host = element.closest?.("ui-toggle-group[data-name], ui-toggle[data-name]")
  if (!host) return
  requestAnimationFrame(() => {
    if (host.localName === "ui-toggle") {
      const field = host.querySelector(":scope > [data-toggle-field]")
      if (!field) return
      const on = host.pressed ?? host.querySelector("button")?.getAttribute("aria-pressed") === "true"
      field.value = on ? host.dataset.onValue : (host.dataset.offValue ?? "")
      field.disabled = !on && host.dataset.offValue === undefined
    } else {
      for (const field of host.querySelectorAll(":scope > [data-toggle-field]")) field.remove()
      for (const value of [].concat(host.value ?? [])) {
        const field = Object.assign(document.createElement("input"), { type: "hidden", name: host.dataset.name, value, autocomplete: "off" })
        field.dataset.toggleField = ""
        host.append(field)
      }
    }
    host.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

for (const type of [ "pressedchange", "valuechange" ]) {
  document.addEventListener(type, (event) => syncToggleFields(event.target), true)
}
