// Time input: 24-hour values whatever the clock, stepping, seconds, a morph.
import { component, check, assert } from "../component.mjs"
import { morph, formData } from "./_dates.mjs"

await component("time_input", async (page) => {
  await check("submits 24-hour times", async () => {
    const data = await formData(page, "#meets-at")
    assert(data.meets_at === "09:30", `meets_at ${data.meets_at}`)
    assert(data.precise === "14:05:30", `precise ${data.precise}`)
  })

  await check("ArrowUp on the hour steps it; PM makes it afternoon", async () => {
    await page.locator("#meets-at input[data-type=hour]").focus()
    await page.keyboard.press("ArrowUp")
    assert((await formData(page, "#meets-at")).meets_at === "10:30", "hour didn't step")
    await page.locator("#meets-at input[data-type=dayPeriod]").focus()
    await page.keyboard.type("P")
    assert((await formData(page, "#meets-at")).meets_at === "22:30", `meets_at ${(await formData(page, "#meets-at")).meets_at}`)
  })

  await check("outside min/max is invalid", async () => {
    await page.locator("#office input[data-type=hour]").focus()
    await page.keyboard.type("0700")
    await page.keyboard.type("A")
    assert(await page.locator("#office[data-invalid]").count() === 1, "7:00 AM isn't invalid")
  })

  await check("a morph keeps the segments and the value", async () => {
    await morph(page, "meets-at")
    assert(await page.locator("#meets-at input[data-slot=time-input-segment]").count() >= 2, "segments stripped")
    assert((await formData(page, "#meets-at")).meets_at === "22:30", "value lost")
  })
})
