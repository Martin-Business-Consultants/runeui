import { component, check, assert } from "../component.mjs"

await component("collapsible", async (page) => {
  await check("the trigger shows and hides the panel", async () => {
    const panel = page.locator("[data-slot=collapsible-panel]")
    assert(!(await panel.isVisible()), "open at first")
    await page.click("[data-slot=collapsible-trigger]")
    await page.waitForTimeout(400)
    assert(await panel.isVisible(), "didn't open")
    assert(await page.locator("[data-slot=collapsible-trigger]").getAttribute("aria-expanded") === "true", "aria-expanded isn't true")
  })
})
