// Calendar: picking with the pointer and the keys, months, ranges, and a morph keeping it whole.
import { component, check, assert } from "../component.mjs"
import { morph } from "./_dates.mjs"

const value = (page, id) => page.evaluate((id) => document.getElementById(id).value, id)

await component("calendar", async (page) => {
  await check("the server's date is selected", async () => {
    assert(await value(page, "cal-single") === "2026-10-16", `value is ${await value(page, "cal-single")}`)
    assert(await page.locator("#cal-single [data-value='2026-10-16'][data-selected]").count() === 1, "16th isn't marked selected")
    assert(await page.locator("#cal-single [data-slot=calendar-heading]").innerText() === "October 2026", "heading")
  })

  await check("a click picks a day", async () => {
    await page.click("#cal-single [data-value='2026-10-20']")
    assert(await value(page, "cal-single") === "2026-10-20", `value is ${await value(page, "cal-single")}`)
  })

  await check("arrow keys move and Enter picks", async () => {
    await page.focus("#cal-single [data-value='2026-10-20']")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    assert(await value(page, "cal-single") === "2026-10-28", `value is ${await value(page, "cal-single")}`)
  })

  await check("Next shows the next month", async () => {
    await page.click("#cal-single [data-slot=calendar-next]")
    assert(await page.locator("#cal-single [data-slot=calendar-heading]").innerText() === "November 2026", "heading didn't move")
  })

  await check("multiple toggles days and keeps min", async () => {
    await page.click("#cal-multiple [data-value='2026-10-20']")
    const v = await value(page, "cal-multiple")
    assert(JSON.stringify(v) === JSON.stringify([ "2026-10-06", "2026-10-09", "2026-10-20" ]), `value is ${JSON.stringify(v)}`)
    assert(await page.locator("#cal-multiple [data-value='2026-10-02'][data-disabled]").count() === 1, "a day before min isn't disabled")
  })

  await check("range: two clicks make a range, shown start to end", async () => {
    await page.click("#cal-range [data-value='2026-10-20']")
    await page.click("#cal-range [data-value='2026-11-03']")
    const v = await value(page, "cal-range")
    assert(JSON.stringify(v) === JSON.stringify([ "2026-10-20", "2026-11-03" ]), `value is ${JSON.stringify(v)}`)
    assert(await page.locator("#cal-range [data-range-middle]").count() >= 10, "no middle band")
  })

  await check("a morph keeps the days, the heading and the pick", async () => {
    await morph(page, "cal-range")
    assert(await page.locator("#cal-range [data-slot=calendar-day]").count() > 60, "days were stripped")
    assert(await page.locator("#cal-range [data-slot=calendar-heading]").innerText() !== "", "heading emptied")
    const v = await value(page, "cal-range")
    assert(JSON.stringify(v) === JSON.stringify([ "2026-10-20", "2026-11-03" ]), `value is ${JSON.stringify(v)}`)
  })
})
