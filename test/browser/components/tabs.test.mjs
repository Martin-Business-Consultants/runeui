import { component, check, assert } from "../component.mjs"

await component("tabs", async (page) => {
  const tabs = page.locator("ui-tabs").first()
  await check("shows the chosen tab's panel only", async () => {
    assert(await tabs.locator("ui-tabs-panel[value=account]").isVisible(), "account panel hidden")
    assert(!(await tabs.locator("ui-tabs-panel[value=password]").isVisible()), "password panel shown")
  })
  await check("arrow keys move and select", async () => {
    await tabs.locator("ui-tabs-tab[value=account] button").focus()
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(200)
    assert(await tabs.locator("ui-tabs-panel[value=password]").isVisible(), "ArrowRight didn't select password")
  })
  await check("a src: tab loads its frame when first chosen", async () => {
    assert(await page.locator("#lazy_tab").getAttribute("complete") === null, "the frame loaded before it was shown")
    await tabs.locator("ui-tabs-tab[value=lazy] button").click()
    await page.waitForSelector("#lazy_tab ui-progress[role=progressbar]", { timeout: 5000 })
  })
  await check("a disabled tab can't be chosen", async () => {
    await tabs.locator("ui-tabs-tab[value=off] button").click({ force: true })
    await page.waitForTimeout(200)
    assert(await tabs.locator("ui-tabs-panel[value=lazy]").isVisible(), "the selection moved")
  })
  await check("link tabs: the current one marked, a link to each page, the panel under them", async () => {
    const links = page.locator("[data-slot=tabs][data-links]:not([data-variant=line])")
    assert(await links.locator("a[aria-current=page]").innerText() === "Profile", "Profile not current")
    assert((await links.locator("[data-slot=tabs-panel]").innerText()).includes("profile page"), "panel")
    await links.locator("a[data-slot=tabs-tab]").nth(1).focus()
    await Promise.all([ page.waitForURL(/section=team/), page.keyboard.press("Enter") ])
    await page.waitForSelector("#tabs-link-panel")
    assert((await page.locator("#tabs-link-panel").innerText()).includes("team page"), "didn't follow")
    assert((await page.locator("[data-slot=tabs][data-links]:not([data-variant=line]) a[aria-current=page]").innerText()).startsWith("Team"), "Team not current")
  })
  // The line's left edge and width (from its transform) against the chosen tab's box.
  const fit = (root) => root.evaluate((element) => {
    const line = element.querySelector("[data-slot=tabs-indicator]")
    const list = element.querySelector("[data-slot=tabs-list]").getBoundingClientRect()
    const tab = [ ...element.querySelectorAll("[data-slot=tabs-tab]") ].find((t) => t.hasAttribute("data-selected") || t.getAttribute("aria-current") === "page").getBoundingClientRect()
    const m = new DOMMatrix(getComputedStyle(line).transform)
    return { dx: Math.abs(m.e - (tab.left - list.left)), dw: Math.abs(m.a - tab.width), moving: line.getAnimations().length }
  })
  await check("line tabs: one line under the chosen tab, sliding to the next", async () => {
    const line = page.locator("ui-tabs[data-variant=line]")
    await page.waitForSelector("ui-tabs[data-variant=line][data-indicator-ready]")
    let at = await fit(line)
    assert(at.dx < 1 && at.dw < 1, `line isn't under Overview: ${JSON.stringify(at)}`)
    await line.locator("ui-tabs-tab[value=settings] button").click()
    await page.waitForTimeout(40)
    assert((await fit(line)).moving > 0, "the line didn't travel")
    await page.waitForTimeout(350)
    at = await fit(line)
    assert(at.dx < 1 && at.dw < 1, `line isn't under Settings: ${JSON.stringify(at)}`)
  })
  await check("line tabs: the keyboard moves the line at once", async () => {
    const line = page.locator("ui-tabs[data-variant=line]")
    await line.locator("ui-tabs-tab[value=settings] button").focus()
    await page.keyboard.press("ArrowLeft")
    await page.waitForTimeout(30)
    const at = await fit(line)
    assert(at.moving === 0 && at.dx < 1, `the line animated or missed: ${JSON.stringify(at)}`)
  })
  await check("line link tabs: a tab loading a frame becomes current and the line travels", async () => {
    const parts = page.locator("#tabs-parts")
    await parts.locator("a", { hasText: "Files" }).click()
    await page.waitForTimeout(40)
    assert(await parts.locator("a[aria-current=page]").innerText() === "Files and folders", "Files isn't current")
    assert((await fit(parts)).moving > 0, "the line didn't travel")
    await page.waitForFunction(() => document.querySelector("#tabs-part-panel")?.textContent.includes("files"))
    await page.waitForTimeout(300)
    const at = await fit(parts)
    assert(at.dx < 1 && at.dw < 1, `line isn't under Files: ${JSON.stringify(at)}`)
  })
})
