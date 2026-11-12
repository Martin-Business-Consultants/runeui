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
})
