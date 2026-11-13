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
  await check("a morph follows the server's verdict: marked invalid, then cleared", async () => {
    const morph = (invalid) => page.evaluate(async (invalid) => {
      const field = document.querySelector("input[name=bad]").closest("ui-input")
      field.id ||= "bad-field"
      const copy = field.cloneNode(true)
      copy.querySelector("input").toggleAttribute("aria-invalid", false)
      if (invalid) copy.querySelector("input").setAttribute("aria-invalid", "true")
      Turbo.renderStreamMessage(`<turbo-stream action="replace" method="morph" target="${field.id}"><template>${copy.outerHTML}</template></turbo-stream>`)
      await new Promise((resolve) => setTimeout(resolve, 300))
      return document.querySelector("input[name=bad]").getAttribute("aria-invalid")
    }, invalid)
    assert(await morph(false) === null, "a morph without aria-invalid left it on")
    assert(await morph(true) === "true", "a morph with aria-invalid didn't add it (a refused save's field stays unmarked)")
  })
  await check("values submit with the form", async () => {
    await page.fill("input[name=email]", "a@b.co")
    const data = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form"))))
    assert(data.email === "a@b.co" && !("off" in data), JSON.stringify(data))
  })
})
