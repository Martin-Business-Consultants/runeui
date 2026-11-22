import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("radio_group", async (page) => {
  await check("submits the server's value", async () => {
    const data = await formData(page)
    assert(data.density === "comfortable" && data.plan === "Monthly", JSON.stringify(data))
  })
  await check("a click and the arrow keys choose; disabled is skipped", async () => {
    await page.click("text=Compact")
    assert((await formData(page)).density === "compact", "click didn't choose")
    await page.keyboard.press("ArrowDown")
    const after = (await formData(page)).density
    assert(after === "default", `ArrowDown chose ${after} (Spacious is disabled, so it wraps to Default)`)
  })
  await check("fires change for Rails", async () => {
    await page.evaluate(() => { window.changed = 0; document.getElementById("density").addEventListener("change", () => window.changed++) })
    await page.click("text=Comfortable")
    await page.waitForFunction(() => window.changed > 0, null, { timeout: 2000 })
  })
  await check("gooey: the dot sits on the chosen radio and pours to the next", async () => {
    const group = page.locator("#delivery")
    await page.waitForSelector("#delivery[data-goo-ready]")
    const centres = () => group.evaluate((element) => {
      const blob = element.querySelector("[data-slot=radio-goo-blob]").getBoundingClientRect()
      const radio = element.querySelector("[data-slot=radio][data-checked]").getBoundingClientRect()
      return { dx: Math.abs(blob.left + blob.width / 2 - (radio.left + radio.width / 2)), dy: Math.abs(blob.top + blob.height / 2 - (radio.top + radio.height / 2)), moving: [ ...element.querySelectorAll("[data-slot=radio-goo-blob]") ].some((b) => b.getAnimations().length) }
    })
    let at = await centres()
    assert(at.dx < 1 && at.dy < 1, `the dot isn't on Standard: ${JSON.stringify(at)}`)
    await page.click("text=Next day")
    await page.waitForTimeout(80)
    assert((await centres()).moving, "the dot didn't pour")
    await page.waitForTimeout(400)
    at = await centres()
    assert(at.dx < 1 && at.dy < 1 && (await formData(page)).delivery === "next-day", `after: ${JSON.stringify(at)}`)
  })
  await check("gooey: the keyboard moves the dot at once", async () => {
    await page.keyboard.press("ArrowDown")
    await page.waitForTimeout(60)
    const moving = await page.locator("#delivery").evaluate((element) => [ ...element.querySelectorAll("[data-slot=radio-goo-blob]") ].some((b) => b.getAnimations().length))
    assert(!moving && (await formData(page)).delivery === "pickup", "it animated, or didn't move")
  })
})
