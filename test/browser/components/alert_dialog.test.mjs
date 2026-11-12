import { component, check, assert } from "../component.mjs"

await component("alert_dialog", async (page) => {
  await check("opens from its trigger, and Cancel closes it", async () => {
    await page.click("#delete-account ui-alert-dialog-trigger button")
    await page.waitForSelector("#delete-account [data-slot=alert-dialog-content][data-open]")
    assert(await page.getAttribute("#delete-account [data-slot=alert-dialog-content]", "role") === "alertdialog", "no alertdialog role")
    await page.click("#delete-account [data-slot=alert-dialog-close] >> text=Cancel")
    await page.waitForSelector("#delete-account [data-slot=alert-dialog-content][hidden]", { state: "attached" })
  })
  await check("Escape doesn't dismiss an alert dialog's question", async () => {
    await page.click("#delete-account ui-alert-dialog-trigger button")
    await page.waitForSelector("#delete-account [data-slot=alert-dialog-content][data-open]")
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    const open = await page.$("#delete-account [data-slot=alert-dialog-content][data-open]")
    if (open) await page.click("#delete-account [data-slot=alert-dialog-close] >> text=Cancel")
    await page.waitForSelector("#delete-account [data-slot=alert-dialog-content][hidden]", { state: "attached" })
  })
  await check("the action submits its form, and the dialog closes", async () => {
    await page.click("#delete-project ui-alert-dialog-trigger button")
    await page.waitForSelector("#delete-project [data-slot=alert-dialog-content][data-open]")
    await page.click("#delete-project button[type=submit]")
    await page.waitForSelector("[data-slot=toast] >> text=project", { timeout: 4000 })
    await page.waitForSelector("#delete-project [data-slot=alert-dialog-content][hidden]", { state: "attached" })
  })
})
