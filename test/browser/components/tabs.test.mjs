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
    const links = page.locator("[data-slot=tabs][data-links]")
    assert(await links.locator("a[aria-current=page]").innerText() === "Profile", "Profile not current")
    assert((await links.locator("[data-slot=tabs-panel]").innerText()).includes("profile page"), "panel")
    await links.locator("a[data-slot=tabs-tab]").nth(1).focus()
    await Promise.all([ page.waitForURL(/section=team/), page.keyboard.press("Enter") ])
    await page.waitForSelector("#tabs-link-panel")
    assert((await page.locator("#tabs-link-panel").innerText()).includes("team page"), "didn't follow")
    assert((await page.locator("[data-slot=tabs][data-links] a[aria-current=page]").innerText()).startsWith("Team"), "Team not current")
  })
})
