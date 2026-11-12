import { component, check, assert } from "../component.mjs"

await component("navigation_menu", async (page) => {
  await check("a trigger opens its panel of links in the viewport", async () => {
    await page.click("ui-navigation-menu-trigger button >> text=Getting started")
    await page.waitForSelector("[data-slot=navigation-menu-viewport] [data-slot=navigation-menu-content][data-open]", { timeout: 3000 })
    assert(await page.isVisible("a[href='#installation']"), "links not shown")
  })
  await check("hovering the next trigger switches panels", async () => {
    await page.hover("ui-navigation-menu-trigger button >> text=Components")
    await page.waitForSelector("a[href='#tooltip']", { state: "visible", timeout: 3000 })
  })
  await check("Escape closes it and the trigger keeps focus", async () => {
    await page.focus("ui-navigation-menu-trigger button >> text=Components")
    await page.keyboard.press("Escape")
    await page.waitForSelector("[data-slot=navigation-menu-viewport] [data-slot=navigation-menu-content][data-open]", { state: "detached", timeout: 3000 })
  })
  await check("the current page's link says so", async () => {
    assert(await page.getAttribute("a[href='#docs']", "aria-current") === "page", "no aria-current")
  })
})
