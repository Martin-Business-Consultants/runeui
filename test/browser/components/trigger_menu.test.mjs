import { component, check, assert } from "../component.mjs"

await component("trigger_menu", async (page) => {
  await check("@ suggests people and narrows as you type", async () => {
    await page.click("#comment")
    await page.keyboard.type("Thanks @ko")
    await page.waitForSelector("[data-slot=trigger-menu-content][data-open]")
    const items = await page.$$eval("[data-slot=trigger-menu-item]", (els) => els.map((e) => e.textContent.trim()))
    assert(items.length === 1 && items[0] === "Kofi Mensah", `items: ${items}`)
  })
  await check("Enter inserts the choice", async () => {
    await page.keyboard.press("Enter")
    assert(await page.inputValue("#comment") === "Thanks @Kofi Mensah ", `value: ${await page.inputValue("#comment")}`)
  })
  await check("/ works only at the start", async () => {
    await page.keyboard.type("/as")
    await page.waitForTimeout(300)
    assert(!(await page.$("[data-slot=trigger-menu-content][data-open]")), "opened mid-text")
  })
  await check("nothing matching says so", async () => {
    await page.keyboard.type(" #zzz")
    await page.waitForSelector("[data-slot=trigger-menu-empty] >> text=No matches", { timeout: 2000 })
    await page.keyboard.press("Escape")
  })
  await check("the text submits with its form", async () => {
    await page.click("text=Send")
    await page.waitForSelector("[data-slot=toast] >> text=Kofi Mensah", { timeout: 4000 })
  })
})
