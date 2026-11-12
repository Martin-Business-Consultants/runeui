// Tree: folders from paths (folders first), arrow keys open and close and move, a single
// selection, and links with the current page's folder opened.
import { component, check, assert } from "../component.mjs"

const visible = (page, id) => page.locator(`#${id} [data-tree-text]:visible`).allInnerTexts()

await component("tree", async (page) => {
  await check("paths make folders, folders first, the expanded ones open", async () => {
    const rows = await visible(page, "files")
    assert(rows.join() === "app,models,project.rb,user.rb,views,config,Gemfile,README.md", rows.join())
  })

  await check("Right opens a folder, Left closes it, Down moves", async () => {
    await page.click("#files-item-config [data-tree-text]")
    assert((await visible(page, "files")).includes("routes.rb"), "pressing config didn't open it")
    await page.keyboard.press("ArrowLeft")
    assert(!(await visible(page, "files")).includes("routes.rb"), "Left didn't close config")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowDown")
    const focused = await page.evaluate(() => document.activeElement.getAttribute("value"))
    assert(focused === "config/routes.rb", `focus on ${focused}`)
  })

  await check("a press selects (single mode)", async () => {
    await page.click("#files [value='app/models/user.rb'] [data-tree-text]")
    assert(await page.evaluate(() => document.querySelector("#files").value) === "app/models/user.rb", "not selected")
  })

  await check("current: is marked and its folder open; a link follows through Turbo", async () => {
    assert(await page.locator("#docs [value=select][aria-current=page]").count() === 1, "select isn't current")
    assert((await visible(page, "docs")).includes("Select"), "its folder isn't open")
    await page.click("#docs [value=dialog] [data-tree-text]")
    await page.waitForURL("**/runeui/dialog")
  })
})
