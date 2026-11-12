import { component, check, assert } from "../component.mjs"

await component("carousel", async (page) => {
  const carousel = page.locator("ui-carousel").first()
  await check("Next moves a page and selects the next dot", async () => {
    assert(await carousel.locator("[data-slot=carousel-previous]").getAttribute("aria-disabled") === "true", "Previous isn't disabled on the first page")
    await carousel.locator("[data-slot=carousel-next]").click()
    await page.waitForTimeout(600)
    const selected = await carousel.locator("[data-slot=carousel-indicator][data-selected]").getAttribute("aria-label")
    assert(selected === "Slide 2", `selected is ${selected}`)
  })
  await check("a dot goes to its slide", async () => {
    await carousel.locator("[data-slot=carousel-indicator]").nth(4).click()
    await page.waitForTimeout(700)
    assert(await carousel.locator("[data-slot=carousel-next]").getAttribute("aria-disabled") === "true", "Next isn't disabled on the last page")
  })
  await check("three at a time shows three", async () => {
    const wide = page.locator("ui-carousel").nth(1)
    assert(await wide.locator("ui-carousel-item[data-in-view]").count() === 3, `${await wide.locator("ui-carousel-item[data-in-view]").count()} in view`)
  })
})
