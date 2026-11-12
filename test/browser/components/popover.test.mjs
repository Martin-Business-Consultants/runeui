import { component, check, assert } from "../component.mjs"

await component("popover", async (page) => {
  await check("opens beside its trigger, focus moves in, Escape returns it", async () => {
    const trigger = page.locator("ui-popover").first().locator("ui-popover-trigger button")
    await trigger.click()
    await page.waitForSelector("[data-slot=popover-content][data-open]")
    assert(await page.evaluate(() => !!document.activeElement.closest("[data-slot=popover-content]")), "focus didn't move in")
    await page.keyboard.press("Escape")
    await page.waitForSelector("[data-slot=popover-content][data-open]", { state: "detached" })
    assert(await page.evaluate(() => document.activeElement.dataset.slot === "popover-trigger"), "focus didn't return")
  })
  await check("a form inside submits", async () => {
    await page.locator("ui-popover").first().locator("ui-popover-trigger button").click()
    await page.waitForSelector("[data-slot=popover-content][data-open]")
    await page.click("[data-slot=popover-content][data-open] >> text=Apply")
    await page.waitForSelector("[data-slot=toast] >> text=25px", { timeout: 4000 })
  })
  await check("the arrow points at the trigger", async () => {
    await page.keyboard.press("Escape")
    await page.locator("ui-popover").nth(1).locator("ui-popover-trigger button").click()
    await page.waitForSelector("[data-slot=popover-arrow][data-side=right]")
  })
})
