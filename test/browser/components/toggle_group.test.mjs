import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("toggle_group", async (page) => {
  await check("the server's values start pressed", async () => {
    assert(await page.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed") === "true", "Bold not pressed")
    const days = await page.locator("#days .ui-toggle[aria-pressed=true]").allInnerTexts()
    assert(days.join() === "Mon,Wed", `days pressed: ${days}`)
  })
  await check("single: pressing one unpresses the other; arrows move", async () => {
    await page.click("#align >> text=Right")
    const pressed = await page.locator("#align .ui-toggle[aria-pressed=true]").allInnerTexts()
    assert(pressed.join() === "Right", `pressed: ${pressed}`)
    await page.keyboard.press("ArrowLeft")
    assert(await page.evaluate(() => document.activeElement.textContent) === "Center", "ArrowLeft didn't move focus")
  })
  await check("as links: the current view is marked, the other is a link to it", async () => {
    assert(await page.locator("#views a[aria-current=page]").getAttribute("aria-label") === "Table", "Table isn't current")
    assert(await page.locator("#views a[data-keys=v]").count() === 1, "data: didn't reach the link")
    await page.click("#views a[aria-label=Board]")
    await page.waitForFunction(() => document.querySelector("#view-shown")?.textContent === "Showing the board")
    assert(await page.locator("#views a[aria-current=page]").getAttribute("aria-label") === "Board", "Board isn't current")
    await page.goBack()
    await page.waitForFunction(() => document.querySelector("#view-shown")?.textContent === "Showing the table")
  })
  await check("hidden fields submit the pressed values (needs the forms.js toggle sync)", async () => {
    await page.click("#days >> text=Fri")
    await page.waitForTimeout(100)
    const data = await formData(page)
    assert(JSON.stringify(data["days[]"]) === '["Mon","Wed","Fri"]', `days[] is ${JSON.stringify(data["days[]"])}`)
    assert(data.align === "right", `align is ${data.align}`)
  })
})
