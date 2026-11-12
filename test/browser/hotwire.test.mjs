// The Hotwire claims: a Turbo morph keeps component state, frames and streams upgrade what they
// bring, values reach the form and fire change, data-turbo-confirm asks with the alert dialog,
// and the flash and ui_toast show as toasts. Run against the dummy app (test/dummy).
import { open, check, assert, done } from "./helpers.mjs"

const { browser, page, errors } = await open("/?reset=1")
// The form redirects to /, so start there: a redirect to the page you're on is what Turbo morphs.
await page.goto(page.url().replace("/?reset=1", "/"))
await page.waitForFunction(() => customElements.get("ui-select"))
const attr = (selector, name) => page.locator(selector).first().getAttribute(name)
const text = (selector) => page.locator(selector).first().innerText()

console.log("hotwire")

await check("components upgrade on load", async () => {
  assert(await attr("#status [data-slot=select-trigger]", "role") === "combobox", "the status trigger has no combobox role")
  assert(await text("#status [data-slot=select-value]") === "Draft", "status doesn't show Draft")
})

await check("a select's value reaches the form and fires change", async () => {
  await page.evaluate(() => { window.changes = 0; document.querySelector("#status").addEventListener("change", () => window.changes++) })
  await page.click("#status [data-slot=select-trigger]")
  await page.click("#status ui-select-item[value=live]")
  await page.waitForFunction(() => window.changes > 0, null, { timeout: 2000 })
  const data = await page.evaluate(() => Object.fromEntries(new FormData(document.getElementById("settings"))))
  assert(data.status === "live", `FormData has status ${data.status}`)
})

await check("a morph keeps state the server doesn't know", async () => {
  await page.click("#unsaved [data-slot=select-trigger]")
  await page.click("#unsaved ui-select-item[value=two]")
  await page.click("#public")
  await page.click("#save")
  await page.waitForFunction(() => document.querySelector("#saves").textContent === "1")
  assert(await text("#status [data-slot=select-value]") === "Live", "status lost its value")
  assert(await text("#unsaved [data-slot=select-value]") === "two", `unsaved shows ${await text("#unsaved [data-slot=select-value]")}`)
  assert(await attr("#status [data-slot=select-trigger]", "aria-expanded") === "false", "status trigger lost aria-expanded")
  assert(await attr("#status [data-slot=select-trigger]", "role") === "combobox", "status trigger lost its role")
  assert(await page.locator("#public").getAttribute("data-checked") !== null, "public switch isn't on")
})

await check("a refresh after someone else's save shows their change and keeps yours", async () => {
  await page.evaluate(async () => {
    const token = document.querySelector("meta[name=csrf-token]").content
    await fetch("/", { method: "PATCH", headers: { "X-CSRF-Token": token, "Content-Type": "application/x-www-form-urlencoded" }, body: "status=archived&public=1", redirect: "manual" })
    Turbo.session.refresh(location.href)
  })
  await page.waitForFunction(() => document.querySelector("#saves").textContent === "2", null, { timeout: 3000 })
  await page.waitForFunction(() => document.querySelector("#status").value === "archived", null, { timeout: 2000 })
  assert(await text("#status [data-slot=select-value]") === "Archived", `status shows ${await text("#status [data-slot=select-value]")}`)
  assert(await text("#unsaved [data-slot=select-value]") === "two", "unsaved lost its pick")
})

await check("the flash shows as a toast", async () => {
  await page.waitForSelector("[data-slot=toast] >> text=Saved 1", { timeout: 3000 })
})

await check("a select still opens after the morph", async () => {
  await page.click("#status [data-slot=select-trigger]")
  await page.waitForSelector("#status [data-slot=select-content]:not([hidden])", { timeout: 2000 })
  await page.keyboard.press("Escape")
  await page.waitForSelector("#status [data-slot=select-content][hidden]", { state: "attached", timeout: 2000 })
})

await check("a dialog opens from its trigger and closes with Escape", async () => {
  await page.click("#dlg ui-dialog-trigger button")
  await page.waitForSelector("#dlg [data-slot=dialog-content]:not([hidden])", { timeout: 2000 })
  await page.keyboard.press("Escape")
  await page.waitForSelector("#dlg [data-slot=dialog-content][hidden]", { state: "attached", timeout: 2000 })
})

await check("data-turbo-confirm asks in the alert dialog; Cancel stops it", async () => {
  await page.click("#delete")
  await page.waitForSelector("#runeui-confirm [data-slot=alert-dialog-content]:not([hidden])", { timeout: 3000 })
  assert(await text("#runeui-confirm ui-alert-dialog-title") === "Really?", "the question isn't the title")
  assert(await text("#runeui-confirm [data-confirm-accept]") === "Delete", "the button isn't Delete")
  await page.click("#runeui-confirm [data-confirm-cancel]")
  await page.waitForTimeout(400)
  assert(await text("#saves") === "2", "it submitted anyway")
})

await check("…and agreeing submits", async () => {
  await page.click("#delete")
  await page.waitForSelector("#runeui-confirm [data-slot=alert-dialog-content]:not([hidden])", { timeout: 3000 })
  await page.click("#runeui-confirm [data-confirm-accept]")
  await page.waitForFunction(() => document.querySelector("#saves").textContent === "3", null, { timeout: 3000 })
})

await check("a lazy frame's component upgrades", async () => {
  await page.waitForSelector("#framed [data-slot=select-trigger][role=combobox]", { timeout: 3000 })
  assert(await text("#framed [data-slot=select-value]") === "green", "framed select doesn't show green")
})

await check("a stream's component upgrades, and ui_toast shows", async () => {
  await page.click("#stream")
  await page.waitForSelector("#streamed-select [data-slot=select-trigger][role=combobox]", { timeout: 3000 })
  await page.waitForSelector("[data-slot=toast] >> text=Streamed", { timeout: 3000 })
})

await check("no errors in the console", async () => {
  assert(errors.length === 0, errors.join(" | "))
})

await browser.close()
done()
