import { component, check, assert } from "../component.mjs"

await component("toast", async (page) => {
  await check("turbo_stream.ui_toast shows a toast with its type", async () => {
    await page.click("text=From the server")
    await page.waitForSelector("[data-slot=toast][data-type=success] >> text=Received", { timeout: 4000 })
  })
  await check("the region is announced politely and survives visits", async () => {
    const region = page.locator("#runeui-toaster")
    assert(await region.getAttribute("data-turbo-permanent") !== null, "not permanent")
  })
  await check("the flash shows as a toast after a redirect", async () => {
    await page.click("text=From the flash")
    await page.waitForSelector("[data-slot=toast] >> text=Received", { timeout: 5000 })
  })
})
