import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("password_input", async (page) => {
  await check("submits what's typed", async () => {
    await page.fill("#password", "hunter22")
    assert((await formData(page)).password === "hunter22", "not submitted")
  })
  await check("the button shows and hides it", async () => {
    const toggle = page.locator("[data-slot=password-input-toggle] >> nth=0")
    await toggle.click()
    assert(await page.getAttribute("#password", "type") === "text", "not shown")
    assert(await toggle.getAttribute("aria-pressed") === "true", "toggle not pressed")
    await toggle.click()
    assert(await page.getAttribute("#password", "type") === "password", "not hidden again")
  })
  await check("named by its field label", async () => {
    assert(await page.getByLabel("Password", { exact: true }).count() >= 1, "not named")
  })
})
