import { component, check, assert } from "../component.mjs"

await component("meter", async (page) => {
  await check("is a meter at its value, toned", async () => {
    const meter = page.locator("ui-meter").nth(1)
    assert(await meter.getAttribute("role") === "meter", "no meter role")
    assert(await meter.getAttribute("aria-valuetext") === "80%", "aria-valuetext isn't 80%")
    const color = await meter.locator("[data-slot=meter-indicator]").evaluate((e) => getComputedStyle(e).backgroundColor)
    const plain = await page.locator("ui-meter").first().locator("[data-slot=meter-indicator]").evaluate((e) => getComputedStyle(e).backgroundColor)
    assert(color !== plain, "the warning tone looks the same as the default")
  })
})
