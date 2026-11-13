// UI SDK's form controls are form-associated custom elements: they submit, reset and validate
// with their form like native ones, and fire native, bubbling input and change events when
// their value moves, so data-action="change->form#requestSubmit" and the runeui--autosubmit
// controller work with nothing added (test/browser/contract.test.mjs checks they still do).
// What's left for runeui is the one control that isn't form-associated: the toggle.

export function bridgeFormEvents() {}

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
