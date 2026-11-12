import { component, check, assert } from "../component.mjs"

await component("label", async (page) => {
  await check("names an input and a radio group", async () => {
    assert(await page.getByRole("textbox", { name: "Email" }).count() === 1, "input not named")
    assert(await page.getByRole("radiogroup", { name: "Plan" }).count() === 1, "radio group not named")
  })
  await check("clicking it focuses the control", async () => {
    await page.click("ui-label[for=label-email]")
    assert(await page.evaluate(() => document.activeElement.id) === "label-email", "input not focused")
  })
})
