// UI SDK's form controls are form-associated custom elements: they submit, reset and validate
// with their form like native ones. What they don't do is fire the native change and input
// events: they fire their own (valuechange, checkedchange, pressedchange…), cancelable, before
// the value moves. Rails apps listen for change (data-action="change->form#requestSubmit", an
// auto-saving field, a filter that submits as it changes), so once a value has really moved this
// fires change, bubbling, from the element, as a native control would.

const VALUE_EVENTS = [ "valuechange", "checkedchange", "pressedchange", "valuecommit" ]

function current(element) {
  for (const property of [ "checked", "pressed", "value" ]) {
    if (property in element) {
      const value = element[property]
      return JSON.stringify(value instanceof Date ? value.toISOString() : value)
    }
  }
  return undefined
}

const known = new WeakMap()

export function bridgeFormEvents() {
  for (const type of VALUE_EVENTS) {
    document.addEventListener(type, (event) => {
      const element = event.target
      if (!(element instanceof HTMLElement) || !element.localName.startsWith("ui-")) return
      if (!element.constructor.formAssociated) return
      if (!known.has(element)) known.set(element, current(element))
      // After the element has applied (or refused) the change.
      requestAnimationFrame(() => {
        const now = current(element)
        if (now === known.get(element)) return
        known.set(element, now)
        element.dispatchEvent(new Event("input", { bubbles: true }))
        element.dispatchEvent(new Event("change", { bubbles: true }))
      })
    }, true)
  }

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
