import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("otp_input", async (page) => {
  await check("submits the server's code", async () => {
    assert((await formData(page)).pin === "12", JSON.stringify(await formData(page)))
  })
  await check("typing fills the boxes and submits the code; letters are refused", async () => {
    await page.click("#code")
    await page.keyboard.type("12a3456")
    assert((await formData(page)).code === "123456", `code ${(await formData(page)).code}`)
    const shown = await page.locator("#code [data-slot=otp-input-slot]").allInnerTexts()
    assert(shown.join("") === "123456", `boxes show ${shown.join("")}`)
    assert(await page.getAttribute("#code", "data-complete") !== null, "not complete")
  })
  await check("pasting fills it", async () => {
    await page.click("#otp-pin")
    await page.keyboard.press("Control+A")
    await page.evaluate(() => {
      const input = document.querySelector("#otp-pin input")
      const data = new DataTransfer(); data.setData("text/plain", "9876")
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
    })
    assert((await formData(page)).pin === "9876", `pin ${(await formData(page)).pin}`)
  })
})
