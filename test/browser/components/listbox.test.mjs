// Listbox: arrow keys choose (automatic activation), a click chooses, several with ⌘/Ctrl, and
// the values submit.
import { component, check, assert } from "../component.mjs"

const formData = (page) => page.evaluate(() => [ ...new FormData(document.querySelector("#plan").closest("form")) ].map((p) => p.join("=")).join("&"))

await component("listbox", async (page) => {
  await check("the server's values submit", async () => {
    assert(await formData(page) === "plan=pro&produce[]=apple&produce[]=carrot", await formData(page))
  })

  await check("arrow keys choose; a disabled option is skipped", async () => {
    await page.click("#plan ui-listbox-item[value=team]")
    await page.keyboard.press("ArrowDown")
    assert((await formData(page)).startsWith("plan=free"), `past the disabled one, round to the top: ${await formData(page)}`)
    await page.keyboard.press("ArrowDown")
    assert((await formData(page)).startsWith("plan=pro"), await formData(page))
  })

  await check("⌘/Ctrl adds to a multiple list", async () => {
    await page.click("#produce ui-listbox-item[value=spinach]", { modifiers: [ "ControlOrMeta" ] })
    assert((await formData(page)).endsWith("produce[]=apple&produce[]=carrot&produce[]=spinach"), await formData(page))
  })
})
