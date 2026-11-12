import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("number_input", async (page) => {
  await check("submits its number; + and − step, clamped to max", async () => {
    assert((await formData(page)).quantity === "1", "initial")
    await page.click("#quantity ~ * button, ui-number-input-increment button >> nth=0")
    assert((await formData(page)).quantity === "2", `after + ${JSON.stringify(await formData(page))}`)
    await page.click("ui-number-input-decrement button >> nth=0")
    assert((await formData(page)).quantity === "1", "after −")
  })
  await check("typing past max commits clamped on Enter… or blur", async () => {
    await page.fill("#quantity", "40")
    await page.keyboard.press("Tab")
    assert((await formData(page)).quantity === "10", `got ${(await formData(page)).quantity}`)
    assert(await page.inputValue("#quantity") === "10", "the field doesn't show 10")
  })
  await check("arrow keys step; empty submits empty", async () => {
    await page.focus("#quantity")
    await page.keyboard.press("ArrowDown")
    assert((await formData(page)).quantity === "9", "ArrowDown")
    assert((await formData(page)).amount === "", `amount is ${(await formData(page)).amount}`)
  })
})
