// Server-side search for a combobox or autocomplete with data-src (ui :combobox, src: …): as
// someone types, GET <src>?q=<text> (JSON: [{ value, label }] for a combobox, strings for an
// autocomplete; groups as { type: "group", label, items }) and hand the results to the element as its items. Waits for
// typing to pause, cancels a request a newer one replaces, and loads the first page as the list
// opens. Listens on the document (UI SDK's events don't bubble, so in the capture phase), so
// whatever Turbo brings is covered with nothing to set up. Imports nothing.

const DELAY = 250
const state = new WeakMap()
// Searches waiting or in flight, so a Turbo visit can drop them (WeakMaps can't be walked).
const pending = new Set()

function settle(entry) {
  clearTimeout(entry.timer)
  entry.controller.abort()
  pending.delete(entry)
}

function remote(event) {
  const element = event.target
  return element instanceof HTMLElement && element.dataset.src && /^ui-(combobox|autocomplete)$/.test(element.localName) ? element : null
}

function search(element, query) {
  const current = state.get(element) || {}
  if (current.query === query && current.items) return
  if (current.entry) settle(current.entry)
  const controller = new AbortController()
  const entry = { controller, element }
  entry.timer = setTimeout(async () => {
    if (!element.isConnected) return pending.delete(entry)
    element.setAttribute("status", "loading")
    try {
      const url = new URL(element.dataset.src, location.href)
      url.searchParams.set("q", query)
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal, credentials: "same-origin" })
      if (!response.ok) throw new Error(`${response.status}`)
      const items = await response.json()
      if (!Array.isArray(items)) throw new Error("expected a JSON array")
      element.items = items
      state.set(element, { query, items })
      element.setAttribute("status", "idle")
    } catch (error) {
      if (error.name !== "AbortError") {
        element.setAttribute("status", "error")
        console.error(`runeui: search at ${element.dataset.src} failed`, error)
      }
    } finally {
      pending.delete(entry)
    }
  }, current.items === undefined && query === "" ? 0 : DELAY)
  pending.add(entry)
  state.set(element, { ...current, entry })
}

// Leaving the page: nothing should answer into a snapshot, or show as loading in it.
document.addEventListener("turbo:before-cache", () => {
  for (const entry of [ ...pending ]) {
    settle(entry)
    if (entry.element.getAttribute("status") === "loading") entry.element.setAttribute("status", "idle")
  }
})

// A combobox's text is its query; an autocomplete's text is its value.
document.addEventListener("querychange", (event) => {
  const element = remote(event)
  if (element) search(element, event.detail?.value ?? "")
}, true)

document.addEventListener("valuechange", (event) => {
  const element = remote(event)
  if (element?.localName === "ui-autocomplete") search(element, event.detail?.value ?? "")
}, true)

document.addEventListener("openchange", (event) => {
  const element = remote(event)
  if (element && event.detail?.value) search(element, (element.localName === "ui-autocomplete" ? element.value : element.query) ?? "")
}, true)

// Labels for values chosen from results the list no longer holds.
document.addEventListener("valuechange", (event) => {
  const element = remote(event)
  if (!element || element.localName !== "ui-combobox" || element.itemToLabel?.runeui) return
  const labels = new Map()
  const remember = (items) => { for (const item of items || []) item.type === "group" ? remember(item.items) : labels.set(String(item.value), item.label) }
  const lookup = (value) => { remember(state.get(element)?.items); return labels.get(String(value)) ?? element.querySelector(`[value="${CSS.escape(String(value))}"]`)?.getAttribute("label") ?? String(value) }
  lookup.runeui = true
  element.itemToLabel = lookup
}, true)
