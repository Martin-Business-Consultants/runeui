import { component, check, assert } from "../component.mjs"

await component("waterfall", async (page) => {
  await check("rows are placed on the axis from the spans", async () => {
    const start = await page.locator("ui-waterfall-row[value=pay]").evaluate((e) => getComputedStyle(e).getPropertyValue("--waterfall-size"))
    assert(start.trim() !== "" && start.trim() !== "0%", "--waterfall-size is 0: the spans never reached the element (data-props)")
  })
  await check("Left folds a span with children", async () => {
    await page.locator("ui-waterfall-row[value=checkout]").focus()
    await page.keyboard.press("ArrowLeft")
    await page.waitForTimeout(200)
    assert(!(await page.locator("ui-waterfall-row[value=auth]").isVisible()), "children still show")
  })
})
