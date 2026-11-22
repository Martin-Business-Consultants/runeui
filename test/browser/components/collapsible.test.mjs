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
  await check("the content arrives from slightly behind as the panel opens", async () => {
    const content = page.locator("[data-slot=collapsible-content]").first()
    const delay = await content.evaluate((element) => getComputedStyle(element).transitionDelay)
    assert(delay.startsWith("0.09s"), `transition delay ${delay}`)
  })
})
