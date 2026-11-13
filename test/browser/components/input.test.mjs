import { component, check, assert } from "../component.mjs"

await component("input", async (page) => {
  await check("the clear button shows once there's text, and empties it", async () => {
    const clear = page.locator("[data-slot=input-clear] button")
    assert(!(await clear.isVisible()), "clear shows on an empty field")
    await page.fill("input[name=q]", "invoices")
    await clear.click()
    assert(await page.inputValue("input[name=q]") === "", "didn't clear")
  })
  await check("an invalid input says so", async () => {
    assert(await page.locator("input[name=bad]").getAttribute("aria-invalid") === "true", "no aria-invalid")
  })
  await check("values submit with the form", async () => {
    await page.fill("input[name=email]", "a@b.co")
    const data = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form"))))
    assert(data.email === "a@b.co" && !("off" in data), JSON.stringify(data))
  })
})
