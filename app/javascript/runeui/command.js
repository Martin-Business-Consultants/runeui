// Commands that go somewhere: an item with data-href (ui :command's href:) visits it when it runs
// (Enter, a click or its shortcut), through Turbo when the page has it; an item with
// data-runeui-open opens that dialog or popover. A palette in a dialog closes as a command runs.
// UI SDK's action event doesn't bubble, so this listens in the capture phase. Imports nothing.

document.addEventListener("action", (event) => {
  const command = event.target
  if (!(command instanceof HTMLElement) || command.localName !== "ui-command") return
  const value = event.detail?.value
  const item = value == null ? null : command.querySelector(`ui-command-item[value="${CSS.escape(String(value))}"]`)
  if (!item) return

  const dialog = command.closest("ui-dialog")
  if (dialog && !item.hasAttribute("data-keep-open")) dialog.api?.close?.()

  const href = item.dataset.href
  if (href) {
    if (item.dataset.target === "_blank") window.open(href, "_blank", "noopener")
    else if (window.Turbo && item.dataset.turbo !== "false") window.Turbo.visit(href, { action: item.dataset.turboAction || "advance" })
    else location.href = href
  }

  const opens = item.dataset.runeuiOpen && document.getElementById(item.dataset.runeuiOpen)
  if (opens && "open" in opens) opens.open = true
}, true)
