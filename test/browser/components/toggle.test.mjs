import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("toggle", async (page) => {
  await check("pressing toggles aria-pressed", async () => {
    const bold = page.getByRole("button", { name: "Bold" })
    await bold.click()
    assert(await bold.getAttribute("aria-pressed") === "true", "not pressed")
    await page.keyboard.press("Space")
    assert(await bold.getAttribute("aria-pressed") === "false", "Space didn't unpress")
  })
  await check("a disabled toggle doesn't press", async () => {
    assert(await page.getByRole("button", { name: "Underline" }).isDisabled(), "not disabled")
  })
  await check("with name:, its hidden field submits the off value, then the on value once pressed (needs the forms.js toggle sync)", async () => {
    assert((await formData(page)).favourite === "0", "off value not submitted")
    await page.click("#favourite button")
    await page.waitForTimeout(100)
    const value = (await formData(page)).favourite
    assert(value === "1", `pressed submits ${value}`)
  })
})
