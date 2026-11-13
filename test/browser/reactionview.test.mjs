// runeui inside ReActionView (the dummy app with REACTIONVIEW=1): a client-mode template with
// herb:state around a form of components, the way ReActionView apps write an in-place form
// (always rendered, hidden by state). form.ui partials render inside form_with, state changes
// don't touch the components, and what someone picked survives them.
//
//   REACTIONVIEW=1 test/dummy/bin/restart 3316 && RV_URL=http://localhost:3316 node reactionview.test.mjs
import { createRequire } from "node:module"
import { check, assert, done } from "./helpers.mjs"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT || "playwright-core")
const BASE = process.env.RV_URL || "http://localhost:3316"

console.log("reactionview")
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })

for (const path of [ "/reactive", "/reactive_server" ]) {
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
  await page.goto(`${BASE}${path}?reset=1`)
  await page.waitForFunction(() => customElements.get("ui-select"))
  await page.waitForSelector("#status [role=combobox]", { state: "attached" })

  await check(`${path}: components inside form_with render with their attributes`, async () => {
    const select = await page.evaluate(() => { const s = document.querySelector("#status"); return [ s.getAttribute("name"), s.value, s.closest("form")?.id ] })
    assert(JSON.stringify(select) === JSON.stringify([ "status", "draft", "inside-form" ]), JSON.stringify(select))
  })
  await check(`${path}: a state change shows the form without replacing its components`, async () => {
    await page.evaluate(() => { window.mark = document.querySelector("#status") })
    await page.click("#toggle")
    await page.waitForSelector("#details:not([hidden])")
    assert(await page.evaluate(() => window.mark === document.querySelector("#status")), "the select was replaced")
  })
  await check(`${path}: what was picked survives closing and reopening`, async () => {
    await page.click("#status [data-slot=select-trigger]")
    await page.click("#status ui-select-item[value=archived]")
    await page.click("#outside [data-slot=select-trigger]")
    await page.click("#outside ui-select-item[value=two]")
    await page.click("#toggle")
    await page.waitForSelector("#details[hidden]", { state: "attached" })
    await page.click("#toggle")
    await page.waitForSelector("#details:not([hidden])")
    const values = await page.evaluate(() => [ document.querySelector("#status").value, document.querySelector("#outside").value ])
    assert(JSON.stringify(values) === JSON.stringify([ "archived", "two" ]), JSON.stringify(values))
  })
  await check(`${path}: the form submits the components' values, and the morph keeps the rest`, async () => {
    await page.click("#save")
    await page.waitForFunction(() => document.querySelector("#saves").textContent === "1", null, { timeout: 4000 })
    const values = await page.evaluate(() => [ document.querySelector("#status").value, document.querySelector("#outside").value ])
    assert(values[0] === "archived", `status is ${values[0]}`)
  })
  await check(`${path}: no errors`, async () => assert(errors.length === 0, errors.join(" | ")))
  await page.close()
}

await browser.close()
done()
