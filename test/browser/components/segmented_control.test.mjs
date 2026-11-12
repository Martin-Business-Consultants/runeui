import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("segmented_control", async (page) => {
  await check("submits its value; a click and arrows change it", async () => {
    assert((await formData(page)).view === "list", "initial value")
    await page.click("#view >> text=Board")
    assert((await formData(page)).view === "board", "click")
    await page.keyboard.press("ArrowRight")
    assert((await formData(page)).view === "calendar", "ArrowRight")
  })
  await check("the pill moves under the chosen item", async () => {
    await page.waitForTimeout(300)
    const [pill, item] = await page.evaluate(() => [document.querySelector("#view [data-slot=segmented-control-indicator]").getBoundingClientRect().left, document.querySelector("#view [value=calendar]").getBoundingClientRect().left])
    assert(Math.abs(pill - item) < 2, `pill at ${pill}, item at ${item}`)
  })
})
