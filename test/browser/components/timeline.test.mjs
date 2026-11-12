// Timeline: a list with one tab stop and arrow keys between events; statuses.
import { component, check, assert } from "../component.mjs"

await component("timeline", async (page) => {
  await check("a list of items with times", async () => {
    assert(await page.locator("#activity").getAttribute("role") === "list", "not a list")
    assert(await page.locator("#activity [role=listitem]").count() === 4, "items")
    assert(await page.locator("#activity time[datetime]").count() === 4, "times")
  })

  await check("one tab stop; arrows move between events", async () => {
    assert(await page.locator("#activity [data-slot=timeline-item][tabindex='0']").count() === 1, "not one tab stop")
    await page.locator("#activity [data-slot=timeline-item][tabindex='0']").focus()
    await page.keyboard.press("ArrowDown")
    const focused = await page.evaluate(() => document.activeElement.querySelector("[data-slot=timeline-title]")?.textContent)
    assert(focused === "Checks passed", `focused ${focused}`)
  })

  await check("steps carry their status; the current one is the tab stop", async () => {
    assert(await page.locator("#order [data-slot=timeline-item][data-complete]").count() === 2, "complete")
    assert(await page.locator("#order [data-slot=timeline-item][data-current]").getAttribute("aria-current") === "step", "current")
  })
})
