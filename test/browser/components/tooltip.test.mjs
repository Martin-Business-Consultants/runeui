import { component, check, assert } from "../component.mjs"

await component("tooltip", async (page) => {
  await check("hover shows the hint; it describes a button with text", async () => {
    const button = page.locator("ui-tooltip").first().locator("button")
    await button.hover()
    await page.waitForSelector("[data-slot=tooltip-content][data-open] >> text=Add to library", { timeout: 3000 })
    const id = await button.getAttribute("aria-describedby")
    assert(id && await page.$(`#${id}`), "not described by the tooltip")
  })
  await check("focus shows it too, and it names an icon-only button", async () => {
    await page.mouse.move(1000, 600)
    await page.waitForTimeout(400)
    await page.locator("ui-tooltip").first().locator("button").focus()
    await page.keyboard.press("Tab")
    await page.waitForSelector("[data-slot=tooltip-content][data-open] >> text=New task", { timeout: 3000 })
    const button = page.locator("ui-tooltip").nth(1).locator("button")
    assert(await button.getAttribute("aria-labelledby") || await button.getAttribute("aria-label"), "icon button has no name")
  })
  await check("a shortcut shows the platform's keys", async () => {
    await page.keyboard.press("Tab")
    await page.waitForSelector("[data-slot=tooltip-shortcut] >> text=/B/", { timeout: 3000 })
    assert(await page.locator("ui-tooltip").nth(2).locator("button").getAttribute("aria-keyshortcuts"), "no aria-keyshortcuts")
  })
})
