// Light, dark or the system's, as shadcn themes expect: .dark on <html>. runeui_tags sets it
// before the first paint; this keeps it current. A button with data-runeui-theme="dark" (or
// "light", "system", "toggle") sets it, remembered per browser; so does a menu item carrying it,
// chosen with the pointer or the keys.

const KEY = "runeui-theme"
const media = matchMedia("(prefers-color-scheme: dark)")

function saved() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

function apply(choice) {
  const root = document.documentElement
  const dark = choice === "dark" || (choice === "system" && media.matches)
  root.classList.toggle("dark", dark)
  root.dataset.theme = dark ? "dark" : "light"
  root.dataset.themeChoice = choice
}

// The person's choice, else the page's default (data-default-theme on <html>), else the system's.
const choice = () => saved() || document.documentElement.dataset.defaultTheme || "system"

export function setTheme(choice) {
  if (choice === "toggle") choice = document.documentElement.classList.contains("dark") ? "light" : "dark"
  try { choice === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice) } catch {}
  apply(choice)
}

// Applies the choice again: after an app changes data-default-theme (a settings page previewing
// its default) or forgets the person's own.
export function refreshTheme() {
  apply(choice())
}

export function wireTheme() {
  // runeui_tags(theme: false): the app owns light and dark.
  if (document.querySelector('meta[name="runeui-theme"][content="off"]')) return
  refreshTheme()
  media.addEventListener("change", refreshTheme)
  document.addEventListener("turbo:render", refreshTheme)
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-runeui-theme]")
    // A menu item answers its select below: a pointer press fires both, and toggling twice is no toggle.
    if (button && !button.closest("ui-menu-item")) setTheme(button.dataset.runeuiTheme)
  })
  // UI SDK's menu items fire select (which doesn't bubble: the capture phase) when chosen with
  // Enter or Space, and with the pointer.
  document.addEventListener("select", (event) => {
    const item = event.target.closest?.("ui-menu-item[data-runeui-theme]")
    if (item) setTheme(item.dataset.runeuiTheme)
  }, true)
}
