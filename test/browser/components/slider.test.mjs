import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("slider", async (page) => {
  await check("submits a number and a range as low/high", async () => {
    const data = await formData(page)
    assert(data.volume === "50" && data.price === "20/80", JSON.stringify(data))
    assert(!("off" in data), "a disabled slider submitted")
  })
  await check("arrow keys move a thumb by its step", async () => {
    await page.focus("#volume input")
    await page.keyboard.press("ArrowRight")
    await page.focus("#price ui-slider-thumb[data-index='1'] input")
    await page.keyboard.press("ArrowLeft")
    const data = await formData(page)
    assert(data.volume === "51" && data.price === "20/75", JSON.stringify(data))
  })
  await check("dragging moves it", async () => {
    const box = await page.locator("#volume [data-slot=slider-track]").boundingBox()
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2)
    const volume = Number((await formData(page)).volume)
    assert(volume >= 85 && volume <= 95, `volume ${volume}`)
  })
  await check("the range shows its value", async () => {
    const text = await page.locator("#price [data-slot=slider-value]").innerText()
    assert(text.includes("20") && text.includes("75"), `shows ${text}`)
  })
  await check("show_value rides over the thumb, kept inside at the ends, its arrow on the thumb", async () => {
    const opacity = page.locator("#opacity")
    const geometry = () => opacity.evaluate((slider) => {
      const box = (selector) => slider.querySelector(selector).getBoundingClientRect()
      const label = box("[data-slot=slider-value]"), arrow = box("[data-slot=slider-value-arrow]"), thumb = box("[data-slot=slider-thumb]"), root = slider.getBoundingClientRect()
      const centre = (b) => b.left + b.width / 2
      return { label: centre(label) - centre(thumb), arrow: centre(arrow) - centre(thumb), inside: label.left >= root.left - 0.5 && label.right <= root.right + 0.5, transition: getComputedStyle(slider.querySelector("[data-slot=slider-value]")).transitionProperty }
    })
    await page.focus("#opacity input")
    await page.keyboard.press("Home")
    for (let i = 0; i < 50; i++) await page.keyboard.press("ArrowRight")
    let at = await geometry()
    assert(Math.abs(at.label) < 1 && Math.abs(at.arrow) < 1, `not centred mid-track: ${JSON.stringify(at)}`)
    assert(at.transition === "none", `the label transitions (${at.transition})`)
    await page.keyboard.press("End")
    at = await geometry()
    assert(at.inside && at.label < -1 && Math.abs(at.arrow) < 1, `at the end: ${JSON.stringify(at)}`)
    await page.keyboard.press("Home")
    at = await geometry()
    assert(at.inside && at.label > 1 && Math.abs(at.arrow) < 1, `at the start: ${JSON.stringify(at)}`)
  })
  await check("format: shows the value with its unit and says it (aria-valuetext)", async () => {
    await page.keyboard.press("End")
    const text = await page.locator("#opacity [data-slot=slider-value]").innerText()
    const said = await page.locator("#opacity input").getAttribute("aria-valuetext")
    assert(/100\s?%/.test(text) && /100\s?%/.test(said ?? ""), `shows ${text}, says ${said}`)
  })
})
