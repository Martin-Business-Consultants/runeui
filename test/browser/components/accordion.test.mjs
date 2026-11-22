import { component, check, assert } from "../component.mjs"

await component("accordion", async (page) => {
  const first = page.locator("ui-accordion").first()
  await check("opens the item named in open:", async () => {
    assert(await first.locator("ui-accordion-item[value=shipping] [data-slot=accordion-panel]").isVisible(), "shipping isn't open")
    assert(!(await first.locator("ui-accordion-item[value=product] [data-slot=accordion-panel]").isVisible()), "product is open")
  })
  await check("a click opens one and closes the other", async () => {
    await first.locator("ui-accordion-item[value=product] button").click()
    await page.waitForTimeout(400)
    assert(await first.locator("ui-accordion-item[value=product] [data-slot=accordion-panel]").isVisible(), "product didn't open")
    assert(!(await first.locator("ui-accordion-item[value=shipping] [data-slot=accordion-panel]").isVisible()), "shipping stayed open")
  })
  await check("Enter on a focused trigger toggles it", async () => {
    await first.locator("ui-accordion-item[value=returns] button").focus()
    await page.keyboard.press("Enter")
    await page.waitForTimeout(400)
    assert(await first.locator("ui-accordion-item[value=returns] [data-slot=accordion-panel]").isVisible(), "returns didn't open")
  })
  await check("multiple keeps several open; a disabled item stays shut", async () => {
    const second = page.locator("ui-accordion").nth(1)
    assert(await second.locator("ui-accordion-item[value=a] [data-slot=accordion-panel]").isVisible(), "a isn't open")
    assert(await second.locator("ui-accordion-item[value=b] [data-slot=accordion-panel]").isVisible(), "b isn't open")
    await second.locator("ui-accordion-item[value=c] button").click({ force: true })
    await page.waitForTimeout(300)
    assert(!(await second.locator("ui-accordion-item[value=c] [data-slot=accordion-panel]").isVisible()), "the disabled one opened")
  })
  await check("the panel travels on the panel's curve and its chevron turns with it", async () => {
    const panel = page.locator("[data-slot=accordion-panel]").first()
    const style = await panel.evaluate((element) => { const s = getComputedStyle(element); return `${s.transitionDuration} ${s.transitionTimingFunction}` })
    assert(style === "0.3s cubic-bezier(0.64, 0, 0.2, 1)", style)
  })
  await check("keyboard focus grows the chevron into an arrow at once", async () => {
    await page.keyboard.press("Shift")
    await page.locator("[data-slot=accordion-trigger]").first().focus()
    const stem = await page.locator("[data-slot=accordion-trigger]").first().locator("[data-part=stem]").evaluate((element) => getComputedStyle(element).opacity)
    assert(stem === "1", `stem opacity ${stem}`)
  })
})
