import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("rating", async (page) => {
  await check("submits the score; a click sets it", async () => {
    assert((await formData(page)).score === "3", "initial")
    await page.click("#score [data-slot=rating-item] >> nth=4")
    assert((await formData(page)).score === "5", `after click ${(await formData(page)).score}`)
  })
  await check("arrow keys move it", async () => {
    await page.keyboard.press("ArrowLeft")
    assert((await formData(page)).score === "4", `ArrowLeft ${(await formData(page)).score}`)
  })
  await check("half stars submit halves; read-only submits nothing", async () => {
    const data = await formData(page)
    assert(data.half === "2.5", `half ${data.half}`)
    assert(Object.keys(data).length === 2, JSON.stringify(data))
  })
  await check("the server's stars are hidden once it upgrades", async () => {
    assert(await page.locator("[data-slot=rating-placeholder]:visible").count() === 0, "placeholders still show")
  })
})
