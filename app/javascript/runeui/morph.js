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
//     aria-description may be added or changed by the server, not removed; aria-invalid is the
//     server's outright (a refused save marks a field, the next answer clears it).
//   - A ui-* element the server sends empty keeps the children the element made for itself (the
//     chosen label in ui-select-value, a calendar's grid); its attributes still morph.
//   - Nodes an element adds inside itself (an OTP input's native field, a slider's thumb inputs,
//     a file input's <input type=file>) aren't in the server's HTML; a morph doesn't remove them.
//   - Before a morph, the parts' generated ids are copied onto the server's copy of the same
//     part (found by position under a ui-* root with the same id), so the morph pairs them up
//     rather than adding the server's beside the live one.
//   - What the server changes, the element follows: a default-value (or default-checked,
//     default-pressed) that differs from the one the page has becomes the value. One that's the
//     same leaves whatever the person picked since. So a page refreshed by someone else's save
//     shows their change, and your own unsaved choice in another field survives.
// data-morph="replace" on an element opts its subtree out: the morph does as it likes there.
// data-morph="keep" keeps an element exactly as it is, children and all.

const SERVER_DATA = /^data-(controller|action|turbo.*|testid|variant|size|morph|props|triggers|src|label|.+-target|.+-value|.+-param|.+-outlet|.+-class)$/
const SERVER_ARIA = /^aria-(label|description)$/
const SERVER_VERDICT = "aria-invalid"
const OWNED = /^(aria-.*|role|tabindex|hidden|inert|style|data-.*)$/
const DEFAULTS = { "default-value": "setValue", "default-checked": "setChecked", "default-pressed": "setPressed" }

// An attribute's value as the element's setter takes it. UI SDK writes lists as "a,b" (a
// slider's range as "20/80"), a few as JSON.
function parse(element, value) {
  if (value === null) return element.multiple ? [] : null
  if (/^[\[{]/.test(value)) {
    try { return JSON.parse(value) } catch {}
  }
  if (element.localName === "ui-slider" && value.includes("/")) return value.split("/").map(Number)
  if (element.multiple || /^\d{4}-\d{2}-\d{2}[^,]*,/.test(value)) return value === "" ? [] : value.split(",")
  return value
}

// Elements a component added inside itself, as opposed to what the server sent: anything added
// inside a ui-* element outside a morph. What a morph adds is the server's, and dropped.
const made = new WeakSet()
const watcher = new MutationObserver(note)

function note(records) {
  for (const record of records) {
    if (!(record.target instanceof Element) || !inComponent(record.target)) continue
    for (const node of record.addedNodes) if (node instanceof Element) made.add(node)
  }
}

function watchMadeNodes() {
  watcher.observe(document.documentElement, { childList: true, subtree: true })
  const before = () => note(watcher.takeRecords())
  const after = () => watcher.takeRecords()
  document.addEventListener("turbo:before-render", before)
  document.addEventListener("turbo:render", after)
  document.addEventListener("turbo:before-frame-render", before)
  document.addEventListener("turbo:frame-render", after)
  document.addEventListener("turbo:before-stream-render", (event) => {
    before()
    const render = event.detail.render
    event.detail.render = async (stream) => { await render(stream); after() }
  })
}

// After the morph has written the new default, make it the value. Quietly: the element fires
// change as it would for a person, and a form that saves as it changes mustn't submit because
// someone else's save refreshed the page.
const following = new WeakSet()

function follow(element, name, mutationType) {
  const setter = element.api?.[DEFAULTS[name]]
  if (!setter) return
  queueMicrotask(() => {
    following.add(element)
    if (name === "default-value") setter(parse(element, element.getAttribute(name)))
    else setter(mutationType !== "remove")
    setTimeout(() => following.delete(element), 50)
  })
}

for (const type of [ "change", "input" ]) {
  document.addEventListener(type, (event) => {
    if (following.has(event.target)) event.stopImmediatePropagation()
  }, true)
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
  alignIdsBeforeMorphs()
  watchMadeNodes()
  document.addEventListener("turbo:before-morph-attribute", (event) => {
    const element = event.target
    const { attributeName: name, mutationType } = event.detail
    if (!inComponent(element)) return
    if (name in DEFAULTS) return
    if (SERVER_ARIA.test(name) && mutationType !== "remove") return
    if (name === SERVER_VERDICT) return
    if (ownedByElement(name, element)) event.preventDefault()
  })

  document.addEventListener("turbo:before-morph-element", (event) => {
    const element = event.target
    const incoming = event.detail.newElement
    if (!(element instanceof Element)) return
    if (element.dataset?.morph === "keep") return event.preventDefault()
    // A removal (no incoming element): keep what a component made inside itself.
    if (!incoming) {
      if (made.has(element) && element.parentElement && inComponent(element.parentElement)) event.preventDefault()
      return
    }
    if (!element.localName.startsWith("ui-")) return
    // A default the server changed becomes the value; an unchanged one leaves the person's.
    for (const name in DEFAULTS) {
      const was = element.getAttribute(name)
      const now = incoming.getAttribute(name)
      if (was !== now) follow(element, name, now === null ? "remove" : "update")
    }
    if (!incoming.hasChildNodes() && element.hasChildNodes() && element.dataset?.morph !== "replace") {
      // Keep what the element made inside itself; the server's attributes still apply.
      for (const { name, value } of incoming.attributes) if (element.getAttribute(name) !== value) element.setAttribute(name, value)
      event.preventDefault()
    }
  })
}

// Gives the incoming copy of each ui-* root (matched by id) the ids its live parts were given
// after upgrade, walking both trees by position, so idiomorph pairs each part with itself.
// Gives the incoming copy of each ui-* component the ids its live parts were given after
// upgrade, walking both trees by position, so idiomorph pairs each part with itself rather than
// adding the server's beside the live one. A component is found by its own id, or, without one,
// by its place: the nth of its tag under the nearest ancestor that has an id (the page's body for
// a page, the frame for a frame).
function alignIds(fragment, liveRoot = null) {
  for (const incoming of fragment.querySelectorAll?.("[id]") ?? []) {
    if (!incoming.localName.startsWith("ui-")) continue
    const live = document.getElementById(incoming.id)
    if (!live || live.localName !== incoming.localName || live === incoming) continue
    copyIds(live, incoming)
  }

  for (const incoming of fragment.querySelectorAll?.("*") ?? []) {
    const tag = incoming.localName
    if (!tag.startsWith("ui-") || incoming.id || !outermost(incoming, fragment)) continue
    const anchor = anchorOf(incoming, fragment)
    const liveAnchor = anchor ? document.getElementById(anchor.id) : liveRoot
    if (!liveAnchor) continue
    const index = components(anchor || fragment, tag, anchor || fragment).indexOf(incoming)
    const live = components(liveAnchor, tag, liveAnchor)[index]
    if (live && live !== incoming && !live.id) copyIds(live, incoming)
  }
}

// Not inside another ui-* component: its parts are paired with it.
function outermost(element, root) {
  for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
    if (node.localName.startsWith("ui-")) return false
  }
  return true
}

function anchorOf(element, root) {
  for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
    if (node.id) return node
  }
  return null
}

function components(scope, tag, root) {
  return [ ...scope.querySelectorAll(tag) ].filter((element) => !element.id && outermost(element, root))
}

// Pairs the two trees' children in order by tag, passing over children only the live tree has
// (chips a combobox added, a viewport a drawer wrapped its content in), and copies each live
// child's id onto its incoming twin.
function copyIds(live, incoming) {
  const a = [ ...live.children ]
  let next = 0
  for (const child of incoming.children) {
    let index = next
    while (index < a.length && a[index].localName !== child.localName) index++
    if (index === a.length) continue
    if (a[index].id && !child.id) child.id = a[index].id
    copyIds(a[index], child)
    next = index + 1
  }
}

export function alignIdsBeforeMorphs() {
  document.addEventListener("turbo:before-render", (event) => {
    if (event.detail.renderMethod === "morph") alignIds(event.detail.newBody, document.body)
  })
  document.addEventListener("turbo:before-stream-render", (event) => {
    const stream = event.detail.newStream ?? event.target
    if (stream.getAttribute?.("method") !== "morph" || !stream.templateElement) return
    // One target: id-less components are paired by their place within it.
    const targets = stream.targetElements ?? []
    alignIds(stream.templateElement.content, targets.length === 1 ? targets[0] : null)
  })
  document.addEventListener("turbo:before-frame-render", (event) => {
    if (event.detail.renderMethod === "morph" || event.target.getAttribute("refresh") === "morph") alignIds(event.detail.newFrame, event.target)
  })
}
