import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("textarea", async (page) => {
  await check("types and submits; data-filled follows", async () => {
    await page.fill("#message", "Hello there")
    const data = await formData(page)
    assert(data.message === "Hello there", `message is ${data.message}`)
    assert(await page.locator("#message").getAttribute("data-filled") !== null, "no data-filled")
    assert(!("off" in data), "a disabled textarea submitted")
  })
  await check("the field label names it", async () => {
    assert(await page.getByRole("textbox", { name: "Your message" }).count() === 1, "not named by its label")
  })
})
