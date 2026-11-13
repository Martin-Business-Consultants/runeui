import { component, check, assert } from "../component.mjs"

await component("button", async (page) => {
  await check("a link button is an <a>, a disabled one can't be pressed", async () => {
    assert(await page.locator("a.ui-button").count() === 1, "no link button")
    assert(await page.locator("button.ui-button:disabled").count() === 1, "no disabled button")
  })
  await check("an icon-only button has a name", async () => {
    assert(await page.getByRole("button", { name: "Next" }).count() === 1, "icon button isn't named")
  })
  await check("data-turbo-confirm asks, then submits", async () => {
    await page.click("text=Delete project")
    await page.waitForSelector("#runeui-confirm [data-slot=alert-dialog-content]:not([hidden])")
    assert((await page.locator("#runeui-confirm ui-alert-dialog-description").innerText()).includes("can't be undone"), "no description")
    await page.click("#runeui-confirm [data-confirm-accept]")
    await page.waitForSelector("[data-slot=toast] >> text=Received", { timeout: 4000 })
  })
})
