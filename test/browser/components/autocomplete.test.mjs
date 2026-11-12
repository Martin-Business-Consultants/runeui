// Autocomplete: suggestions filter as you type, the text is the value (chosen or typed), inline
// completion, and submit-on-select for a search box.
import { component, check, assert } from "../component.mjs"

const formData = (page, selector) => page.evaluate((s) => [ ...new FormData(document.querySelector(s).closest("form")) ].map((p) => p.join("=")), selector)

await component("autocomplete", async (page) => {
  await check("typing filters the suggestions; choosing one fills the text", async () => {
    await page.fill("#fruit input", "ap")
    await page.waitForSelector("#fruit [data-slot=autocomplete-content]:not([hidden])")
    const shown = await page.locator("#fruit ui-autocomplete-item:visible").allInnerTexts()
    assert(shown.join() === "Apple,Apricot,Grape,Pineapple", `shown: ${shown}`)
    await page.click("#fruit ui-autocomplete-item[value=Apricot]")
    assert(await page.inputValue("#fruit input") === "Apricot", "text isn't Apricot")
  })

  await check("what's typed submits, once, chosen or not", async () => {
    await page.fill("#fruit input", "Kiwi")
    await page.keyboard.press("Escape")
    const data = await formData(page, "#fruit")
    assert(data.filter((p) => p.startsWith("fruit=")).join() === "fruit=Kiwi", data.join("&"))
    assert(data.includes("city=Lisbon"), data.join("&"))
  })

  await check("inline completion fills the rest", async () => {
    await page.fill("#city input", "")
    await page.type("#city input", "Pa")
    await page.keyboard.press("End")
    assert(await page.inputValue("#city input") === "Paris", `city is ${await page.inputValue("#city input")}`)
  })

  await check("choosing a search suggestion submits", async () => {
    await page.fill("#search input", "over")
    await page.keyboard.press("Enter")
    await page.waitForSelector("[data-slot=toast] >> text=invoices overdue", { timeout: 3000 })
  })
})
