// Shared by the browser tests: a Chromium page on the dummy app, with every console error and
// page error collected. PLAYWRIGHT names a playwright-core to use (else the installed one);
// CHROMIUM a browser binary (else Playwright's own).
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core")

export const BASE = process.env.BASE_URL || "http://localhost:3311"

export async function open(path = "/", { colorScheme = "light" } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
  const page = await browser.newPage({ colorScheme, viewport: { width: 1100, height: 800 } })
  const errors = []
  // Turbo cancels a frame request a newer one replaces; the browser reports the abort.
  page.on("pageerror", (error) => /signal is aborted/.test(error.message) || errors.push(error.message))
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
  await page.goto(BASE + path)
  await page.waitForFunction(() => customElements.get("ui-select") || !document.querySelector("ui-select"))
  return { browser, page, errors }
}

let failures = 0
export async function check(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failures++
    console.log(`  ✗ ${name}\n      ${error.message.split("\n")[0]}`)
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function done() {
  console.log(failures ? `${failures} failed` : "all passed")
  process.exitCode = failures ? 1 : 0
}
