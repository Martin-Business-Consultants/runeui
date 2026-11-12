import { component, check, assert } from "../component.mjs"

await component("progress", async (page) => {
  await check("fills to the value and reads it out", async () => {
    const bar = page.locator("ui-progress").nth(1)
    assert(await bar.getAttribute("aria-valuenow") === "66", "aria-valuenow isn't 66")
    const track = await bar.locator("[data-slot=progress-track]").boundingBox()
    const fill = await bar.locator("[data-slot=progress-indicator]").boundingBox()
    assert(Math.abs(fill.width / track.width - 0.66) < 0.02, `fill is ${fill.width / track.width}`)
    assert((await bar.locator("[data-slot=progress-value]").innerText()) === "66%", "value text isn't 66%")
  })
  await check("no value is indeterminate", async () => {
    assert(await page.locator("ui-progress").nth(3).getAttribute("data-indeterminate") !== null, "not indeterminate")
  })
})
