import { component, check, assert } from "../component.mjs"

await component("separator", async (page) => {
  await check("is a separator, or nothing to screen readers when decorative", async () => {
    assert(await page.locator("ui-separator").first().getAttribute("role") === "separator", "no separator role")
    assert(await page.locator("ui-separator[decorative]").first().getAttribute("role") === "none", "decorative isn't role none")
    const box = await page.locator("ui-separator[orientation=vertical]").first().boundingBox()
    assert(box.width === 1 && box.height > 8, `vertical is ${box.width}×${box.height}`)
  })
})
