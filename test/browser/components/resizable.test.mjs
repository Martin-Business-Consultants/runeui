import { component, check, assert } from "../component.mjs"

await component("resizable", async (page) => {
  await check("arrow keys on a handle move it", async () => {
    const handle = page.locator("ui-resizable-handle").first()
    const before = Number(await handle.getAttribute("aria-valuenow"))
    await handle.focus()
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(150)
    const after = Number(await handle.getAttribute("aria-valuenow"))
    assert(after > before, `${before} → ${after}`)
  })
  await check("dragging resizes", async () => {
    const one = page.locator("ui-resizable-panel#one")
    const width = (await one.boundingBox()).width
    const handle = await page.locator("ui-resizable-handle").first().boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x - 80, handle.y + handle.height / 2, { steps: 5 })
    await page.mouse.up()
    assert((await one.boundingBox()).width < width - 40, "didn't shrink")
  })
})
