// Date picker: the popup, picking, typing, the submitted YYYY-MM-DD, ranges, and a morph.
import { component, check, assert } from "../component.mjs"
import { morph, formData } from "./_dates.mjs"

const input = (page, id) => page.locator(`#${id} input`).first()

await component("date_picker", async (page) => {
  await check("the server's date shows and submits as YYYY-MM-DD", async () => {
    assert(await input(page, "due-on").inputValue() === "10/16/2026", `shows ${await input(page, "due-on").inputValue()}`)
    const data = await formData(page, "#due-on")
    assert(data.due_on === "2026-10-16", `due_on is ${data.due_on}`)
    assert(data.starts_on === "", `starts_on is ${JSON.stringify(data.starts_on)}`)
  })

  await check("the trigger opens a calendar on the chosen month, a day closes it", async () => {
    await page.click("#due-on [data-slot=date-picker-trigger]")
    await page.waitForSelector("#due-on [data-slot=date-picker-content]:not([hidden])", { timeout: 2000 })
    assert(await page.locator("#due-on [data-slot=calendar-heading]").innerText() === "October 2026", "wrong month")
    await page.click("#due-on [data-value='2026-10-22']")
    await page.waitForSelector("#due-on [data-slot=date-picker-content][hidden]", { state: "attached", timeout: 2000 })
    assert(await input(page, "due-on").inputValue() === "10/22/2026", `shows ${await input(page, "due-on").inputValue()}`)
    assert((await formData(page, "#due-on")).due_on === "2026-10-22", "didn't submit the pick")
  })

  await check("keys: arrows move in the open calendar, Enter picks, Escape closes", async () => {
    await page.click("#due-on [data-slot=date-picker-trigger]")
    await page.waitForSelector("#due-on [data-slot=date-picker-content]:not([hidden])")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")
    await page.waitForSelector("#due-on [data-slot=date-picker-content][hidden]", { state: "attached", timeout: 2000 })
    assert((await formData(page, "#due-on")).due_on === "2026-10-23", `due_on ${(await formData(page, "#due-on")).due_on}`)
    await page.click("#due-on [data-slot=date-picker-trigger]")
    await page.keyboard.press("Escape")
    await page.waitForSelector("#due-on [data-slot=date-picker-content][hidden]", { state: "attached", timeout: 2000 })
  })

  await check("a typed date commits on Enter; one before min is refused", async () => {
    await input(page, "starts-on").fill("12/25/2030")
    await input(page, "starts-on").press("Enter")
    assert((await formData(page, "#starts-on")).starts_on === "2030-12-25", "typed date didn't commit")
    await input(page, "starts-on").fill("1/2/2020")
    await input(page, "starts-on").press("Enter")
    assert(await page.locator("#starts-on[data-invalid]").count() === 1, "a date before min isn't invalid")
    assert(await page.evaluate(() => !document.querySelector("#starts-on").closest("form").checkValidity()), "the form would still submit")
    await page.click("#starts-on [data-slot=date-picker-clear]")
  })

  await check("range submits both ends", async () => {
    const data = await formData(page, "#stay")
    assert(data.from === "2026-10-12" && data.to === "2026-10-16", JSON.stringify(data))
    await page.click("#stay [data-slot=date-picker-trigger]")
    await page.click("#stay [data-value='2026-10-20']")
    await page.click("#stay [data-value='2026-11-02']")
    const after = await formData(page, "#stay")
    assert(after.from === "2026-10-20" && after.to === "2026-11-02", JSON.stringify(after))
  })

  await check("a morph keeps the typed field and the pick", async () => {
    await morph(page, "due-on")
    assert(await input(page, "due-on").inputValue() === "10/23/2026", `shows ${await input(page, "due-on").inputValue()}`)
    assert((await formData(page, "#due-on")).due_on === "2026-10-23", "value lost")
    await page.click("#due-on [data-slot=date-picker-trigger]")
    await page.waitForSelector("#due-on [data-slot=calendar-day]", { timeout: 2000 })
    await page.keyboard.press("Escape")
  })

  await check("a pick, a typed date and Clear each reach the form as one change, with the new date", async () => {
    await page.evaluate(() => {
      window.dateChanges = []
      window.onPicker = []
      document.getElementById("starts-on").addEventListener("change", (event) => window.onPicker.push(event.target.localName))
      document.querySelector("form:has(#starts-on)").addEventListener("change", (event) => window.dateChanges.push([ event.target.id, new FormData(event.target.closest("form") || document.getElementById(event.target.getAttribute("form"))).get("starts_on") ]))
    })
    const changes = () => page.evaluate(() => window.dateChanges.splice(0))
    await input(page, "starts-on").fill("12/24/2030")
    await input(page, "starts-on").press("Tab")
    await page.waitForTimeout(150)
    let seen = await changes()
    assert(seen.length === 1 && seen[0][0] === "starts-on" && seen[0][1] === "2030-12-24", `typed: ${JSON.stringify(seen)}`)
    const heard = await page.evaluate(() => window.onPicker.splice(0))
    assert(heard.length === 1 && heard[0] === "ui-date-picker", `data-action on the picker heard ${JSON.stringify(heard)}`)
    await page.click("#starts-on [data-slot=date-picker-trigger]")
    await page.click("#starts-on [data-value='2030-12-26']")
    await page.waitForTimeout(150)
    seen = await changes()
    assert(seen.length === 1 && seen[0][1] === "2030-12-26", `picked: ${JSON.stringify(seen)}`)
    await page.click("#starts-on [data-slot=date-picker-clear]")
    await page.waitForTimeout(150)
    seen = await changes()
    assert(seen.length === 1 && seen[0][1] === "", `cleared: ${JSON.stringify(seen)}`)
  })

  await check("submitting sends the date", async () => {
    await page.click("form:has(#due-on) button[type=submit]")
    await page.waitForSelector("[data-slot=toast] >> text=2026-10-23", { timeout: 3000 })
  })
})
