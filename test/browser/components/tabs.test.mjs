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
})
