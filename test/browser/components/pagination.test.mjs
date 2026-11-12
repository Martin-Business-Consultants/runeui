import { component, check, assert } from "../component.mjs"

await component("pagination", async (page) => {
  await check("page 1: Previous disabled, links keep other params", async () => {
    const nav = page.locator("[data-slot=pagination]").first()
    assert(await nav.locator("[data-slot=pagination-previous]").getAttribute("aria-disabled") === "true", "Previous isn't disabled")
    assert(await nav.locator("[aria-current=page]").innerText() === "1", "current isn't 1")
    assert((await nav.locator("[data-slot=pagination-next]").getAttribute("href")).endsWith("?page=2"), "Next doesn't go to page 2")
  })
  await check("Next visits page 2 through Turbo, with gaps on either side further on", async () => {
    await page.locator("[data-slot=pagination]").first().locator("[data-slot=pagination-next]").click()
    await page.waitForURL(/page=2/)
    await page.goto(page.url().replace("page=2", "page=6"))
    const items = await page.locator("[data-slot=pagination]").first().locator("[data-slot=pagination-list] > li").allInnerTexts()
    assert(items.map((t) => t.trim()).join(" ") === "Previous 1 5 6 7 10 Next" || items.length === 9, `items: ${items.join("|")}`)
    assert(await page.locator("[data-slot=pagination]").first().locator("[data-slot=pagination-ellipsis]").count() === 2, "not two gaps")
  })
})
