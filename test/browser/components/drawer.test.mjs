import { component, check, assert } from "../component.mjs"

await component("drawer", async (page) => {
  await check("a sheet slides in from the right and Escape closes it", async () => {
    await page.click("#edit-sheet ui-drawer-trigger button")
    await page.waitForSelector("#edit-sheet [data-slot=drawer-content][data-open]")
    await page.waitForTimeout(500)
    const box = await page.locator("#edit-sheet [data-slot=drawer-content]").boundingBox()
    assert(Math.round(box.x + box.width) === 1100, `right edge at ${box.x + box.width}`)
    await page.keyboard.press("Escape")
    await page.waitForSelector("#edit-sheet [data-slot=drawer-content][hidden]", { state: "attached", timeout: 3000 })
  })
  await check("its form submits from the footer", async () => {
    await page.click("#edit-sheet ui-drawer-trigger button")
    await page.waitForSelector("#edit-sheet [data-slot=drawer-content][data-open]")
    await page.click("#edit-sheet [data-slot=drawer-footer] button")
    await page.waitForSelector("[data-slot=toast] >> text=Pedro", { timeout: 4000 })
    await page.keyboard.press("Escape")
    await page.waitForSelector("#edit-sheet [data-slot=drawer-content][hidden]", { state: "attached", timeout: 3000 })
  })
  await check("a bottom drawer has a handle and closes from a button elsewhere in it", async () => {
    await page.click("#goal-drawer ui-drawer-trigger button")
    await page.waitForSelector("#goal-drawer [data-slot=drawer-content][data-open]")
    assert(await page.$("#goal-drawer [data-slot=drawer-handle]"), "no handle")
    await page.waitForTimeout(500)
    await page.click("#goal-drawer [data-slot=drawer-footer] button")
    await page.waitForSelector("#goal-drawer [data-slot=drawer-content][hidden]", { state: "attached", timeout: 3000 })
  })
})
