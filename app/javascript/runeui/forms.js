// UI SDK's form controls are form-associated custom elements: they submit, reset and validate
// with their form like native ones. What they don't do is fire the native change and input
// events: they fire their own (valuechange, checkedchange, pressedchange…), cancelable, before
// the value moves. Rails apps listen for change (data-action="change->form#requestSubmit", an
// auto-saving field, a filter that submits as it changes), so once a value has really moved this
// fires change, bubbling, from the element, as a native control would.

const VALUE_EVENTS = [ "valuechange", "checkedchange", "pressedchange", "valuecommit" ]

function current(element) {
  for (const property of [ "value", "checked", "pressed" ]) {
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
