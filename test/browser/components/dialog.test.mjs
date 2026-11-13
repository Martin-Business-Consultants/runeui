import { component, check, assert } from "../component.mjs"

await component("dialog", async (page) => {
  const content = "#edit-profile [data-slot=dialog-content]"
  await check("the trigger opens it and focus moves inside", async () => {
    await page.click("#edit-profile ui-dialog-trigger button")
    await page.waitForSelector(`${content}:not([hidden])`)
    assert(await page.evaluate(() => document.querySelector("#edit-profile [data-slot=dialog-content]").contains(document.activeElement)), "focus is outside the dialog")
    assert(await page.getByRole("dialog", { name: "Edit profile" }).count() === 1, "not named by its title")
  })
  await check("Escape closes it and focus returns to the trigger", async () => {
    await page.keyboard.press("Escape")
    await page.waitForSelector(`${content}[hidden]`, { state: "attached" })
    assert(await page.evaluate(() => document.activeElement === document.querySelector("#edit-profile ui-dialog-trigger button")), "focus didn't return")
  })
  await check("a button elsewhere opens it by id, and the X closes it", async () => {
    await page.click("[data-runeui-open=edit-profile]")
    await page.waitForSelector(`${content}:not([hidden])`)
    await page.click("#edit-profile [data-dialog-x]")
    await page.waitForSelector(`${content}[hidden]`, { state: "attached" })
  })
  await check("a form inside submits from the footer's button", async () => {
    await page.click("#edit-profile ui-dialog-trigger button")
    await page.waitForSelector(`${content}:not([hidden])`)
    await page.click("#edit-profile [data-slot=dialog-footer] button")
    await page.waitForSelector("[data-slot=toast] >> text=Pedro", { timeout: 4000 })
  })
})
