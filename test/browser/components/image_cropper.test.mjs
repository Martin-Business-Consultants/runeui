import { component, check, assert } from "../component.mjs"

await component("image_cropper", async (page) => {
  await check("the image loads and the selection shows", async () => {
    await page.waitForFunction(() => !document.querySelector("ui-image-cropper").hasAttribute("data-loading"), null, { timeout: 4000 })
    assert(await page.locator("ui-image-cropper-selection").first().isVisible(), "no selection")
  })
  await check("arrow keys move the crop", async () => {
    const cropper = page.locator("ui-image-cropper").first()
    const before = await cropper.evaluate((e) => JSON.stringify(e.crop))
    await cropper.locator("ui-image-cropper-selection").focus()
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowUp")
    const after = await cropper.evaluate((e) => JSON.stringify(e.crop))
    assert(before !== after, "the crop didn't move")
  })
  await check("the crop reaches the form", async () => {
    const data = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form"))))
    assert(data["crop[width]"] && Number(data["crop[width]"]) > 0, `crop[width] is ${JSON.stringify(data["crop[width]"])}`)
  })
})
