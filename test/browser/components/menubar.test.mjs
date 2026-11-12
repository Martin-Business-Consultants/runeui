import { component, check, assert } from "../component.mjs"

await component("menubar", async (page) => {
  const openMenu = () => page.evaluate(() => document.querySelector("[data-slot=menubar] [data-slot=menu-trigger][data-open]")?.textContent.trim())

  await check("a press opens a menu; arrows move to the next menu, open", async () => {
    await page.click("ui-menubar ui-menu-trigger button >> text=File")
    await page.waitForFunction(() => document.querySelector("[data-slot=menubar] [data-slot=menu-content][data-open]"))
    assert(await openMenu() === "File", `open: ${await openMenu()}`)
    await page.keyboard.press("ArrowRight")
    await page.waitForFunction(() => document.querySelector("[data-slot=menubar] [data-slot=menu-trigger][data-open]")?.textContent.trim() === "Edit", null, { timeout: 2000 })
  })
  await check("hovering another trigger while one is open switches to it", async () => {
    await page.hover("ui-menubar ui-menu-trigger button >> text=View")
    await page.waitForFunction(() => document.querySelector("[data-slot=menubar] [data-slot=menu-trigger][data-open]")?.textContent.trim() === "View", null, { timeout: 2000 })
    await page.keyboard.press("Escape")
  })
  await check("the bar is a menubar", async () => {
    assert(await page.getAttribute("ui-menubar", "role") === "menubar", "no menubar role")
  })
})
