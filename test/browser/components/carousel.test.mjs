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
  await check("the worm sits on the current dot and reaches for the next mid-scroll", async () => {
    await page.reload()
    const first = page.locator("ui-carousel").first()
    await page.waitForSelector("ui-carousel[data-worm]")
    await page.waitForTimeout(300)
    const worm = () => first.evaluate((element) => {
      const w = element.querySelector("[data-slot=carousel-worm]").getBoundingClientRect()
      const dots = [ ...element.querySelectorAll("[data-slot=carousel-indicator]") ].map((d) => d.getBoundingClientRect())
      return { left: w.left - dots[0].left, width: w.width, dot: dots[0].width, step: dots[1].left - dots[0].left }
    })
    let at = await worm()
    assert(Math.abs(at.left) < 1 && Math.abs(at.width - at.dot) < 1, `at rest: ${JSON.stringify(at)}`)
    // Halfway between the first two slides it spans both dots.
    const second = await first.evaluate(async (element) => {
      element.api.setPage(2)
      await new Promise((resolve) => setTimeout(resolve, 700))
      return element.querySelector("[data-slot=carousel-viewport]").scrollLeft
    })
    // Read on the frame after the scroll: the carousel then snaps on to a page, as it should.
    at = await first.evaluate(async (element, second) => {
      const viewport = element.querySelector("[data-slot=carousel-viewport]")
      viewport.style.scrollSnapType = "none"
      viewport.scrollLeft = second / 2
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const w = element.querySelector("[data-slot=carousel-worm]").getBoundingClientRect()
      const dots = [ ...element.querySelectorAll("[data-slot=carousel-indicator]") ].map((d) => d.getBoundingClientRect())
      return { left: w.left - dots[0].left, width: w.width, dot: dots[0].width, step: dots[1].left - dots[0].left, scroll: viewport.scrollLeft }
    }, second)
    assert(Math.abs(at.left) < 1 && Math.abs(at.width - (at.dot + at.step)) < 1.5, `halfway: ${JSON.stringify(at)}`)
  })
  await check("dragging across the dots scrubs to the slide let go over", async () => {
    await page.reload()
    const first = page.locator("ui-carousel").first()
    await page.waitForSelector("ui-carousel[data-worm]")
    const dots = first.locator("[data-slot=carousel-indicator]")
    const from = await dots.nth(0).boundingBox()
    const to = await dots.nth(3).boundingBox()
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
    await page.waitForTimeout(150)
    assert(await first.locator("[data-slot=carousel-indicator-group]").getAttribute("data-scrubbing") === "", "not scrubbing")
    await page.mouse.up()
    await page.waitForTimeout(700)
    const selected = await first.locator("[data-slot=carousel-indicator][data-selected]").getAttribute("aria-label")
    assert(selected === "Slide 4", `selected is ${selected}`)
  })
  await check("Previous and Next grow their chevrons into arrows on hover", async () => {
    const next = page.locator("ui-carousel").first().locator("[data-slot=carousel-next]")
    await next.hover()
    await page.waitForTimeout(300)
    const stem = await next.locator("[data-part=stem]").evaluate((element) => getComputedStyle(element).opacity)
    assert(stem === "1", `stem opacity ${stem}`)
  })
})
