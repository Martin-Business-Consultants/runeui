// Turbo morphs (page refreshes with refresh="morph", and streams with method="morph") compare
// the page with the server's HTML and make them match. A component's live state isn't in the
// server's HTML: UI SDK writes it as attributes once the element upgrades (aria-expanded,
// data-open, generated ids, hidden on a closed popup, the trigger's text). Left alone, a morph
// would strip all of it and leave the component broken.
//
// So inside a ui-* element the rule is: the server owns configuration, the element owns state.
//   - The server's attributes morph as usual: name, value, default-value, disabled, placeholder,
//     class, data-controller / -action / -*-target / -*-value, data-variant, data-size. A
//     component sees the change (attributeChangedCallback) and follows it.
//   - The element's own (aria-*, role, tabindex, hidden, inert, style, generated ids, any other
//     data-* attribute) are never added, changed or removed by a morph. aria-label and
//     aria-description may be added or changed by the server, not removed.
//   - A part whose text the element writes (ui-select-value and the like) keeps its text: the
//     server renders it empty.
//   - What the server changes, the element follows: a default-value (or default-checked,
//     default-pressed) that differs from the one the page has becomes the value. One that's the
//     same leaves whatever the person picked since. So a page refreshed by someone else's save
//     shows their change, and your own unsaved choice in another field survives.
// data-morph="replace" on an element opts its subtree out: the morph does as it likes there.
// data-morph="keep" keeps an element exactly as it is, children and all.

const SERVER_DATA = /^data-(controller|action|turbo.*|testid|variant|size|morph|.+-target|.+-value|.+-param|.+-outlet|.+-class)$/
const SERVER_ARIA = /^aria-(label|description)$/
const OWNED = /^(aria-.*|role|tabindex|hidden|inert|style|data-.*)$/
const WRITES_TEXT = /-value$/
const DEFAULTS = { "default-value": "setValue", "default-checked": "setChecked", "default-pressed": "setPressed" }

function parse(element, value) {
  if (value === null) return element.multiple ? [] : null
  if (element.multiple || /^[\[{]/.test(value)) {
    try { return JSON.parse(value) } catch {}
  }
  return value
}

// After the morph has written the new default, make it the value.
function follow(element, name, mutationType) {
  const setter = element.api?.[DEFAULTS[name]]
  if (!setter) return
  queueMicrotask(() => {
    if (name === "default-value") setter(parse(element, element.getAttribute(name)))
    else setter(mutationType !== "remove")
  })
}

// Whether an element is a component or inside one (and not opted out with data-morph="replace").
function inComponent(element) {
  for (let node = element; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) {
    if (node.dataset?.morph === "replace") return false
    if (node.localName.startsWith("ui-")) return true
  }
  return false
}

function ownedByElement(name, element) {
  if (name === "id") return element.id?.startsWith("ui-sdk-")
  if (SERVER_DATA.test(name)) return false
  return OWNED.test(name)
}

export function guardMorphs() {
  document.addEventListener("turbo:before-morph-attribute", (event) => {
    const element = event.target
    const { attributeName: name, mutationType } = event.detail
    if (!inComponent(element)) return
    if (name in DEFAULTS) return follow(element, name, mutationType)
    if (SERVER_ARIA.test(name) && mutationType !== "remove") return
    if (ownedByElement(name, element)) event.preventDefault()
  })

  document.addEventListener("turbo:before-morph-element", (event) => {
    const element = event.target
    const incoming = event.detail.newElement
    if (!(element instanceof Element)) return
    if (element.dataset?.morph === "keep") return event.preventDefault()
    if (!incoming || !element.localName.startsWith("ui-")) return
    if (WRITES_TEXT.test(element.localName) && !incoming.hasChildNodes()) {
      // Keep the text the element wrote; the server's attributes still apply.
      for (const { name, value } of incoming.attributes) if (element.getAttribute(name) !== value) element.setAttribute(name, value)
      event.preventDefault()
    }
  })
}
