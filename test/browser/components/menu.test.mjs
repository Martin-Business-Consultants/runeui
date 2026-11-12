import { component, check, assert } from "../component.mjs"

await component("menu", async (page) => {
  const highlighted = () => page.evaluate(() => document.querySelector("#account-menu > ui-menu-content[data-open] [data-highlighted]")?.textContent.trim())

  await check("opens from the keyboard and arrows move through its items", async () => {
    await page.focus("#account-menu ui-menu-trigger button")
    await page.keyboard.press("ArrowDown")
    await page.waitForSelector("#account-menu [data-slot=menu-content][data-open]")
    await page.waitForTimeout(150)
    const first = await highlighted()
    await page.keyboard.press("ArrowDown")
    const second = await highlighted()
    assert(first && second && first !== second, `highlight ${first} → ${second}`)
  })
  await check("a submenu opens toward its arrow and Escape closes just it", async () => {
    await page.hover("#account-menu ui-menu-sub-trigger")
    await page.waitForSelector("#account-menu ui-menu-sub-content[data-open]", { timeout: 3000 })
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Escape")
    await page.waitForSelector("#account-menu ui-menu-sub-content[data-open]", { state: "detached" })
    assert(await page.$("#account-menu > ui-menu-content[data-open]"), "the whole menu closed")
    await page.keyboard.press("Escape")
  })
  await check("choosing an action fires action with its value and closes the menu", async () => {
    await page.evaluate(() => { window.chosen = null; document.querySelector("#account-menu").addEventListener("action", (e) => { window.chosen = e.detail.value }, { once: true }) })
    await page.click("#account-menu ui-menu-trigger button")
    await page.click("#account-menu ui-menu-item[value=new-team]")
    await page.waitForFunction(() => window.chosen === "new-team")
    await page.waitForSelector("#account-menu [data-slot=menu-content][data-open]", { state: "detached" })
  })
  await check("a link item is a real link", async () => {
    assert(await page.getAttribute("#account-menu a[href='#profile']", "role") === "menuitem", "link isn't a menuitem")
  })
  await check("a disabled item can't be chosen; a destructive one is marked", async () => {
    assert(await page.getAttribute("#account-menu ui-menu-item[value=api]", "aria-disabled") === "true", "API not disabled")
    assert(await page.getAttribute("#account-menu ui-menu-item[value=logout]", "data-variant") === "destructive", "logout not destructive")
  })
  await check("check and radio items toggle and stay open", async () => {
    await page.click("#view-menu ui-menu-trigger button")
    await page.click("#view-menu ui-menu-checkbox-item[value=activity-bar]")
    assert(await page.getAttribute("#view-menu ui-menu-checkbox-item[value=activity-bar]", "aria-checked") === "true", "checkbox didn't check")
    await page.click("#view-menu ui-menu-radio-item[value=top]")
    assert(await page.getAttribute("#view-menu ui-menu-radio-item[value=top]", "aria-checked") === "true", "radio didn't move")
    assert(await page.getAttribute("#view-menu ui-menu-radio-item[value=bottom]", "aria-checked") === "false", "old radio still on")
    assert(await page.$("#view-menu [data-slot=menu-content][data-open]"), "menu closed")
    await page.keyboard.press("Escape")
  })
  await check("a context menu opens on right-click", async () => {
    await page.click(".ui-context-area", { button: "right" })
    await page.waitForSelector("#context-menu [data-slot=menu-content][data-open]", { timeout: 3000 })
    await page.keyboard.press("Escape")
  })
})
