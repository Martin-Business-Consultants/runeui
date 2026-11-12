import { component, check, assert } from "../component.mjs"

await component("toolbar", async (page) => {
  await check("one Tab stop; arrows move along it", async () => {
    const buttons = page.locator("[data-slot=toolbar] [data-slot=toolbar-button]")
    assert(await buttons.first().getAttribute("tabindex") === "0", "first isn't the tab stop")
    await buttons.first().focus()
    await page.keyboard.press("ArrowRight")
    const label = await page.evaluate(() => document.activeElement.getAttribute("aria-label"))
    assert(label === "Italic", `focus on ${label}`)
    await page.keyboard.press("End")
    const last = await page.evaluate(() => document.activeElement.textContent.trim())
    assert(last === "Share", `End landed on ${last}`)
  })
})
