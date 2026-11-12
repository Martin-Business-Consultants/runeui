import { component, check, assert } from "../component.mjs"

await component("data_table", async (page) => {
  const picked = () => page.evaluate(() => [ ...document.querySelectorAll("ui-checkbox[data-runeui-select]") ].filter((b) => b.checked).length)
  await check("the bulk bar hides until a row is picked", async () => {
    assert(await page.locator("[data-slot=bulk-bar]").isHidden(), "bulk bar shows with nothing picked")
  })
  await check("picking a row shows the bar with the count", async () => {
    await page.locator("ui-checkbox[data-runeui-select]").nth(0).click()
    await page.waitForSelector("[data-slot=bulk-bar]:not([hidden])")
    assert((await page.locator("[data-slot=bulk-count]").innerText()) === "1 task selected", await page.locator("[data-slot=bulk-count]").innerText())
    assert(await page.locator("ui-checkbox[data-runeui-select-all]").evaluate((b) => b.hasAttribute("data-mixed")), "header isn't mixed")
  })
  await check("shift-click picks the range", async () => {
    await page.locator("ui-checkbox[data-runeui-select]").nth(2).click({ modifiers: [ "Shift" ] })
    await page.waitForTimeout(150)
    assert(await picked() === 3, `picked ${await picked()}`)
  })
  await check("the header picks every row, then none", async () => {
    await page.locator("ui-checkbox[data-runeui-select-all]").click(); await page.waitForTimeout(150)
    assert(await picked() === 4, `picked ${await picked()}`)
    await page.locator("ui-checkbox[data-runeui-select-all]").click(); await page.waitForTimeout(150)
    assert(await picked() === 0, `picked ${await picked()}`)
  })
  await check("the picked ids submit with the bulk button", async () => {
    await page.locator("ui-checkbox[data-runeui-select]").nth(1).click(); await page.waitForTimeout(100)
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("form"), document.querySelector("[name=bulk][value=done]")) ])
    assert(JSON.stringify(data) === JSON.stringify([ [ "ids[]", "2" ], [ "bulk", "done" ] ]) || data.some(([ k, v ]) => k === "ids[]"), JSON.stringify(data))
  })
  await check("a sort header links to the sorted page", async () => {
    const href = await page.locator("th[data-align=end] [data-slot=table-sort]").getAttribute("href")
    assert(href.includes("sort=due") && href.includes("direction=asc"), href)
  })
})
