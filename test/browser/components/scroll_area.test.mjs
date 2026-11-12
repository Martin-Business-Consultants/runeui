import { component, check, assert } from "../component.mjs"

await component("scroll_area", async (page) => {
  await check("scrolls inside its box with its own thumb", async () => {
    const area = page.locator("ui-scroll-area").first()
    const box = await area.boundingBox()
    assert(box.height > 200 && box.height < 320, `height is ${box.height}`)
    assert(await area.getAttribute("data-overflow-y") !== null, "no overflow detected")
    const thumb = await area.locator("[data-slot=scroll-area-thumb]").first().boundingBox()
    assert(thumb && thumb.height > 10 && thumb.height < box.height, "thumb isn't sized")
    await area.locator("[data-slot=scroll-area-viewport]").evaluate((v) => v.scrollTo(0, 400))
    await page.waitForTimeout(200)
    assert(await area.getAttribute("data-at-y-start") === null, "still at the top after scrolling")
  })
})
