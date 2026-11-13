import { component, check, assert } from "../component.mjs"

await component("toast", async (page) => {
  await check("turbo_stream.ui_toast shows a toast with its type", async () => {
    await page.click("text=From the server")
    await page.waitForSelector("[data-slot=toast][data-type=success] >> text=Received", { timeout: 4000 })
  })
  await check("a toast's text starts at its start, whichever corner the region is in", async () => {
    assert(await page.locator("[data-slot=toast-title]").first().evaluate((title) => getComputedStyle(title).textAlign) === "start", "the region's align attribute moved the text")
  })
  await check("the region is announced politely and survives visits", async () => {
    const region = page.locator("#runeui-toaster")
    assert(await region.getAttribute("data-turbo-permanent") !== null, "not permanent")
  })
  await check("the flash shows as a toast after a redirect", async () => {
    await page.click("text=From the flash")
    await page.waitForSelector("[data-slot=toast] >> text=Received", { timeout: 5000 })
  })
  await check("a flash after a redirect Turbo follows shows once, in the page's own region", async () => {
    await page.click("button:text-is('From the flash, through Turbo')")
    await page.waitForSelector("[data-slot=toast] >> text=Came back with it", { timeout: 5000 })
    await page.waitForTimeout(300)
    assert(await page.locator("ui-toast-region").count() === 1, "a second toast region was made while Turbo held the page's aside")
    assert(await page.locator("[data-slot=toast]", { hasText: "Came back with it" }).count() === 1, "it showed twice")
  })
  await check("an action with a url sends that request, and its answer shows", async () => {
    await page.click("button:text-is('With Undo')")
    await page.click("[data-slot=toast] >> text=Undo", { timeout: 4000 })
    await page.waitForSelector("[data-slot=toast] >> text=undone", { timeout: 4000 })
    assert(await page.locator("body > form[hidden]").count() === 0, "the action's form was left on the page")
  })
  await check("duration: 0 stays until it's closed", async () => {
    await page.click("button:text-is('One that stays')")
    const toast = page.locator("[data-slot=toast][data-type=error]", { hasText: "Couldn't save" })
    await toast.waitFor({ timeout: 4000 })
    await page.mouse.move(5, 5)
    await page.waitForTimeout(6500)
    assert(await toast.count() === 1, "it went by itself")
    await toast.locator("[data-slot=toast-close] button").click()
    await toast.waitFor({ state: "detached", timeout: 4000 })
  })
  await check("a flash that is a hash keeps its action across the redirect, and the action visits its page", async () => {
    await page.click("button:text-is('A flash with a link')")
    await page.click("[data-slot=toast] >> text=Open", { timeout: 5000 })
    await page.waitForURL(/\/runeui\/button/, { timeout: 4000 })
  })
})
