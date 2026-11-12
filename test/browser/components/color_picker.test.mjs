// Color picker: the server's colour submits, a preset sets it, typing a code sets it, the
// popover opens from its swatch and its hue slider moves with the keys.
import { component, check, assert } from "../component.mjs"

const data = (page) => page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("#brand").closest("form"))))

await component("color_picker", async (page) => {
  await check("the server's colours submit", async () => {
    const d = await data(page)
    assert(d.brand === "#0ea5e9" && d.accent === "#a855f7", JSON.stringify(d))
  })

  await check("a preset sets it", async () => {
    await page.click("#brand ui-color-picker-swatch-item[value='#22c55e']")
    assert((await data(page)).brand === "#22c55e", JSON.stringify(await data(page)))
  })

  await check("a typed code sets it on Enter", async () => {
    await page.fill("#brand ui-color-picker-input input", "#ff0000")
    await page.keyboard.press("Enter")
    assert((await data(page)).brand === "#ff0000", JSON.stringify(await data(page)))
  })

  await check("the popover opens from its swatch; the hue slider takes the keys", async () => {
    await page.click("#accent [data-color-trigger]")
    await page.waitForSelector("#accent ui-popover-content:not([hidden])")
    await page.focus("#accent ui-color-picker-slider[channel=hue] [data-slot=color-picker-slider-thumb]")
    await page.keyboard.press("Home")
    assert((await data(page)).accent !== "#a855f7", JSON.stringify(await data(page)))
    assert(await page.inputValue("#accent ui-color-picker-input input") === (await data(page)).accent, "the code doesn't follow")
    await page.keyboard.press("Escape")
  })
})
