// Server-side search for a combobox or autocomplete with data-src (ui :combobox, src: …): as
// someone types, GET <src>?q=<text> (JSON: [{ value, label }] for a combobox, strings for an
// autocomplete; groups as { type: "group", label, items }) and hand the results to the element as its items. Waits for
// typing to pause, cancels a request a newer one replaces, and loads the first page as the list
// opens. Listens on the document (UI SDK's events don't bubble, so in the capture phase), so
// whatever Turbo brings is covered with nothing to set up. Imports nothing.
//
// A command with data-src (ui :command, src: …) asks for HTML instead: from data-src-min
// characters, GET <src>?q=<text> with the header Runeui-Command (the command's id, or ""), and
// the answer (ui-command-group and ui-command-item parts) becomes its list. Shorter than that, the
// list goes back to what the server drew, and data-searched comes off (the prompt shows again).

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

function command(event) {
  const element = event.target
  return element instanceof HTMLElement && element.localName === "ui-command" && element.dataset.src ? element : null
}

function searchCommands(element, query) {
  const list = element.querySelector("ui-command-list")
  if (!list) return
  const current = state.get(element) || { drawn: list.innerHTML }
  if (current.entry) settle(current.entry)
  const min = Math.max(1, Number(element.dataset.srcMin) || 1)
  if (query.trim().length < min) {
    if (current.query !== undefined) list.innerHTML = current.drawn
    element.removeAttribute("data-searched")
    element.setAttribute("status", "idle")
    state.set(element, { drawn: current.drawn })
    return
  }
  if (current.query === query) return
  const controller = new AbortController()
  const entry = { controller, element }
  entry.timer = setTimeout(async () => {
    if (!element.isConnected) return pending.delete(entry)
    element.setAttribute("status", "loading")
    try {
      const url = new URL(element.dataset.src, location.href)
      url.searchParams.set("q", query)
      const id = element.id || element.closest("ui-dialog")?.id || ""
      const response = await fetch(url, { headers: { Accept: "text/html", "Runeui-Command": id }, signal: controller.signal, credentials: "same-origin" })
      if (!response.ok || response.redirected) throw new Error(`${response.status}${response.redirected ? " (redirected)" : ""}`)
      const html = await response.text()
      if (controller.signal.aborted) return
      const template = document.createElement("template")
      template.innerHTML = html
      list.replaceChildren(template.content)
      element.setAttribute("data-searched", "")
      element.setAttribute("status", "idle")
      state.set(element, { drawn: current.drawn, query })
    } catch (error) {
      if (error.name !== "AbortError") {
        element.setAttribute("status", "error")
        console.error(`runeui: search at ${element.dataset.src} failed`, error)
      }
    } finally {
      pending.delete(entry)
    }
  }, DELAY)
  pending.add(entry)
  state.set(element, { ...current, entry })
}

document.addEventListener("querychange", (event) => {
  const element = command(event)
  if (element) searchCommands(element, event.detail?.value ?? "")
}, true)

// Leaving the page: nothing should answer into a snapshot, or show as loading in it.
document.addEventListener("turbo:before-cache", () => {
  for (const entry of [ ...pending ]) {
    settle(entry)
    if (entry.element.getAttribute("status") === "loading") entry.element.setAttribute("status", "idle")
  }
})

// A combobox's text is its query; an autocomplete's text is its value. (Behind a button, the box
// takes the choice's words as it closes: nothing to search for.)
document.addEventListener("querychange", (event) => {
  const element = remote(event)
  if (!element || (element.querySelector("[data-slot=combobox-trigger]") && !element.open)) return
  search(element, event.detail?.value ?? "")
}, true)

document.addEventListener("valuechange", (event) => {
  const element = remote(event)
  if (element?.localName === "ui-autocomplete") search(element, event.detail?.value ?? "")
}, true)

// A combobox behind a button (trigger:) opens with its box empty (runeui--filter), whatever the
// box said last: its first page is the empty search's.
document.addEventListener("openchange", (event) => {
  const element = remote(event)
  if (!element || !event.detail?.value) return
  const query = element.localName === "ui-autocomplete" ? element.value : (element.querySelector("[data-slot=combobox-trigger]") ? "" : element.query)
  search(element, query ?? "")
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
