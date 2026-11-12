// What a trigger menu offers, from the server's markup: ui :token_input's triggers: become
// data-triggers JSON on its <ui-trigger-menu>, and this hands them to the element (UI SDK takes
// triggers only as a property). A trigger's src: becomes a loader: GET src?q=<text after the
// trigger> answering [{ value, label }]. Watches the page, so whatever Turbo brings is set up
// too. Imports nothing.

function loader(src) {
  return async (query, { signal } = {}) => {
    const url = new URL(src, location.href)
    url.searchParams.set("q", query ?? "")
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal, credentials: "same-origin" })
    if (!response.ok) throw new Error(`${response.status}`)
    return response.json()
  }
}

function configure(menu) {
  if (menu.runeuiTriggers === menu.dataset.triggers) return
  let triggers
  try { triggers = JSON.parse(menu.dataset.triggers) } catch { return }
  menu.triggers = triggers.map(({ src, ...trigger }) => (src ? { ...trigger, items: loader(src) } : trigger))
  menu.runeuiTriggers = menu.dataset.triggers
}

function scan(root) {
  if (!(root instanceof Element)) return
  const menus = root.matches?.("ui-trigger-menu[data-triggers]") ? [ root ] : root.querySelectorAll("ui-trigger-menu[data-triggers]")
  if (menus.length === 0) return
  customElements.whenDefined("ui-trigger-menu").then(() => menus.forEach(configure))
}

scan(document.documentElement)
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "attributes") scan(record.target)
    else for (const node of record.addedNodes) scan(node)
  }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [ "data-triggers" ] })
