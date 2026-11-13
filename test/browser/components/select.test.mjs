import { component, check, assert } from "../component.mjs"

await component("select", async (page) => {
  const data = () => page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form"))))
  await check("the server's value shows its label and submits", async () => {
    assert((await page.locator("ui-select[name=timezone] [data-slot=select-value]").innerText()) === "Central", "label")
    assert((await data()).timezone === "cst", JSON.stringify(await data()))
  })
  await check("a placeholder shows while nothing is chosen, and nothing submits", async () => {
    assert((await page.locator("ui-select[name=fruit] [data-slot=select-value]").innerText()) === "Select a fruit", "placeholder")
    assert(!("fruit" in await data()) || (await data()).fruit === "", JSON.stringify(await data()))
  })
  await check("typing finds an item", async () => {
    await page.locator("ui-select[name=fruit] [data-slot=select-trigger]").click()
    await page.waitForSelector("ui-select[name=fruit] [data-slot=select-content]:not([hidden]):not([data-starting-style])")
    await page.waitForFunction(() => document.querySelector("ui-select[name=fruit] [data-highlighted], ui-select[name=fruit] ui-select-content:focus-within"))
    await page.keyboard.type("pine", { delay: 60 })
    await page.waitForSelector("ui-select[name=fruit] ui-select-item[value=Pineapple][data-highlighted]")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => new FormData(document.querySelector("form")).get("fruit") === "Pineapple", null, { timeout: 3000 })
  })
  await check("the keyboard opens it, moves and picks", async () => {
    await page.locator("ui-select[name=fruit] [data-slot=select-trigger]").focus()
    await page.keyboard.press("Enter")
    await page.waitForSelector("ui-select[name=fruit] [data-slot=select-content]:not([hidden])")
    await page.keyboard.press("Home")
    await page.keyboard.press("Enter")
    await page.waitForSelector("ui-select[name=fruit] [data-slot=select-content][hidden]", { state: "attached" })
    assert((await data()).fruit !== "Pineapple" && (await data()).fruit, JSON.stringify(await data()))
  })
  await check("a disabled item can't be chosen", async () => {
    await page.locator("ui-select[name=size] [data-slot=select-trigger]").click()
    await page.locator("ui-select[name=size] ui-select-item[value=l]").click({ force: true })
    assert((await data()).size === "m", JSON.stringify(await data()))
    await page.keyboard.press("Escape")
  })
  await check("a form that submits as it changes sends the pick", async () => {
    await page.locator("#autosave-status [data-slot=select-trigger]").click()
    await page.locator("#autosave-status ui-select-item[value=live]").click()
    await page.waitForSelector("[data-slot=toast] >> text=live", { timeout: 4000 })
  })
})
