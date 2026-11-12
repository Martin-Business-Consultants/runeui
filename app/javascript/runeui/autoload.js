// Imports a component's module the first time one of its tags is on the page: <ui-select> or any
// of its parts loads runeui/sdk/select. Watches the whole document, so whatever Turbo Drive, a
// frame or a stream brings is upgraded as it arrives. Bare specifiers, so importmap resolves the
// digested file in production.
import { ENTRIES } from "runeui/sdk/entries"

const requested = new Map()

// The longest entry whose name (or its singular) begins the tag: ui-alert-dialog-title →
// alert-dialog, ui-overlay-host → overlays.
export function entryFor(tag) {
  if (!tag.startsWith("ui-")) return null
  let match = null
  for (const entry of ENTRIES) {
    const stems = [ entry, entry.replace(/s$/, "") ]
    if (stems.some((stem) => tag === `ui-${stem}` || tag.startsWith(`ui-${stem}-`)) && entry.length > (match?.length ?? 0)) {
      match = entry
    }
  }
  return match
}

// Loads a component's module by entry name ("select") and resolves once it's loaded.
export function load(entry) {
  if (!requested.has(entry)) {
    requested.set(entry, import(`runeui/sdk/${entry}`).catch((error) => {
      requested.delete(entry)
      console.error(`runeui: couldn't load ${entry}`, error)
    }))
  }
  return requested.get(entry)
}

// Resolves when a tag's element is defined, loading its module if nothing has yet.
export function defined(tag) {
  const entry = entryFor(tag)
  if (entry) load(entry)
  return customElements.whenDefined(tag)
}

function scan(node) {
  if (!(node instanceof Element)) return
  for (const element of [ node, ...node.querySelectorAll("*") ]) {
    const tag = element.localName
    if (!tag.startsWith("ui-") || customElements.get(tag)) continue
    const entry = entryFor(tag)
    if (entry) load(entry)
  }
}

export function autoload({ root = document } = {}) {
  scan(root.documentElement)
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) scan(node)
  })
  observer.observe(root.documentElement, { childList: true, subtree: true })
  return () => observer.disconnect()
}
