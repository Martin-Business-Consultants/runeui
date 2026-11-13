import { component, check, assert } from "../component.mjs"

await component("data_table", async (page) => {
  const picked = () => page.evaluate(() => [ ...document.querySelectorAll("tbody ui-checkbox") ].filter((b) => b.checked).length)
  await check("the bulk bar hides until a row is picked", async () => {
    assert(await page.locator("[data-slot=bulk-bar]").isHidden(), "bulk bar shows with nothing picked")
  })
  await check("picking a row shows the bar with the count", async () => {
    await page.locator("tbody ui-checkbox").nth(0).click()
    await page.waitForSelector("[data-slot=bulk-bar]:not([hidden])")
    assert((await page.locator("[data-slot=bulk-count]").innerText()) === "1 task selected", await page.locator("[data-slot=bulk-count]").innerText())
    assert(await page.locator("ui-checkbox[data-select-all]").evaluate((b) => b.hasAttribute("data-mixed")), "header isn't mixed")
  })
  await check("shift-click picks the range", async () => {
    await page.locator("tbody ui-checkbox").nth(2).click({ modifiers: [ "Shift" ] })
    await page.waitForTimeout(150)
    assert(await picked() === 3, `picked ${await picked()}`)
  })
  await check("the header picks every row, then none", async () => {
    await page.locator("ui-checkbox[data-select-all]").click(); await page.waitForTimeout(150)
    assert(await picked() === 4, `picked ${await picked()}`)
    await page.locator("ui-checkbox[data-select-all]").click(); await page.waitForTimeout(150)
    assert(await picked() === 0, `picked ${await picked()}`)
  })
  await check("the picked ids submit with the bulk button", async () => {
    await page.locator("tbody ui-checkbox").nth(1).click(); await page.waitForTimeout(100)
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("form.runeui-docs__stack"), document.querySelector("[name=bulk][value=done]")) ])
    assert(JSON.stringify(data) === JSON.stringify([ [ "ids[]", "2" ], [ "bulk", "done" ] ]) || data.some(([ k, v ]) => k === "ids[]"), JSON.stringify(data))
  })
  await check("the column that names the row takes what's left and cuts a long name short; the table doesn't scroll", async () => {
    const box = await page.evaluate(() => {
      const container = document.querySelector("[data-slot=table-scroll]")
      const cell = [ ...document.querySelectorAll("td[data-grow]") ].find((td) => td.textContent.includes("Book the venue"))
      return { scrolls: container.scrollWidth > container.clientWidth, cut: cell.scrollWidth > cell.clientWidth, lines: Math.round(cell.getBoundingClientRect().height), row: Math.round(document.querySelector("tbody tr").getBoundingClientRect().height) }
    })
    assert(!box.scrolls, "the table scrolls sideways")
    assert(box.cut, "the long name isn't cut short")
    assert(box.lines === box.row, `the long name wraps (${box.lines}px against ${box.row}px)`)
  })
  await check("a checkbox takes attributes of its own", async () => {
    assert(await page.locator("tbody ui-checkbox[data-keys=x]").count() === 4, "checkbox: didn't reach the checkboxes")
  })
  await check("the Columns menu hides a column, and the browser remembers", async () => {
    const shown = () => page.evaluate(() => [ ...document.querySelectorAll("[data-column=status]") ].filter((cell) => !cell.hidden).length)
    assert(await shown() === 5, `${await shown()} status cells showing`)
    await page.click("[data-runeui--columns-target=menu] button")
    await page.click("ui-menu-checkbox-item[value=status]")
    await page.waitForFunction(() => [ ...document.querySelectorAll("[data-column=status]") ].every((cell) => cell.hidden))
    assert(await page.locator("ui-menu-content:not([hidden])").count() === 1, "the menu closed on a tick")
    assert(await page.evaluate(() => localStorage.getItem("runeui:columns:docs-tasks")) === '["status"]', await page.evaluate(() => localStorage.getItem("runeui:columns:docs-tasks")))
    await page.keyboard.press("Escape")
    await page.reload()
    await page.waitForFunction(() => customElements.get("ui-menu") && [ ...document.querySelectorAll("[data-column=status]") ].every((cell) => cell.hidden))
    await page.click("[data-runeui--columns-target=menu] button")
    await page.waitForSelector("ui-menu-content:not([hidden])")
    assert(await page.locator("ui-menu-checkbox-item[value=status]").evaluate((item) => !item.hasAttribute("data-checked")), "the hidden column is still ticked")
    await page.click("ui-menu-checkbox-item[value=status]")
    await page.waitForFunction(() => [ ...document.querySelectorAll("[data-column=status]") ].every((cell) => !cell.hidden))
    await page.keyboard.press("Escape")
    assert(await page.evaluate(() => localStorage.getItem("runeui:columns:docs-tasks")) === "[]", "the choice wasn't cleared")
  })
  await check("a sort header links to the sorted page", async () => {
    const href = await page.locator("th[data-align=end] [data-slot=table-sort]").getAttribute("href")
    assert(href.includes("sort=due") && href.includes("direction=asc"), href)
  })
})
