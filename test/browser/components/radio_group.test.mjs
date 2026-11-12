import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

await component("radio_group", async (page) => {
  await check("submits the server's value", async () => {
    const data = await formData(page)
    assert(data.density === "comfortable" && data.plan === "Monthly", JSON.stringify(data))
  })
  await check("a click and the arrow keys choose; disabled is skipped", async () => {
    await page.click("text=Compact")
    assert((await formData(page)).density === "compact", "click didn't choose")
    await page.keyboard.press("ArrowDown")
    const after = (await formData(page)).density
    assert(after === "default", `ArrowDown chose ${after} (Spacious is disabled, so it wraps to Default)`)
  })
  await check("fires change for Rails", async () => {
    await page.evaluate(() => { window.changed = 0; document.getElementById("density").addEventListener("change", () => window.changed++) })
    await page.click("text=Comfortable")
    await page.waitForFunction(() => window.changed > 0, null, { timeout: 2000 })
  })
})
