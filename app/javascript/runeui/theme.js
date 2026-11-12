// Light, dark or the system's, as shadcn themes expect: .dark on <html>. runeui_tags sets it
// before the first paint; this keeps it current. A button with data-runeui-theme="dark" (or
// "light", "system", "toggle") sets it, remembered per browser.

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

export function setTheme(choice) {
  if (choice === "toggle") choice = document.documentElement.classList.contains("dark") ? "light" : "dark"
  try { choice === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice) } catch {}
  apply(choice)
}

export function wireTheme() {
  const choice = () => saved() || document.documentElement.dataset.defaultTheme || "system"
  apply(choice())
  media.addEventListener("change", () => apply(choice()))
  document.addEventListener("turbo:render", () => apply(choice()))
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-runeui-theme]")
    if (button) setTheme(button.dataset.runeuiTheme)
  })
}
