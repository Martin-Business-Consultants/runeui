// ui :editor (Lexxy in runeui's skin). Needs the lexxy gem's assets, as the dummy app serves.
import { component, check, assert } from "../component.mjs"

await component("editor", async (page) => {
  await page.waitForFunction(() => customElements.get("lexxy-editor"), null, { timeout: 5000 })
  await page.waitForSelector("lexxy-editor .lexxy-editor__content", { timeout: 5000 })
  const style = (selector, property) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], property)

  await check("the editor takes runeui's tokens", async () => {
    const expected = await page.evaluate(() => { const probe = document.createElement("div"); probe.style.color = "var(--foreground)"; probe.style.borderColor = "var(--input)"; document.body.append(probe); const s = getComputedStyle(probe); const out = [ s.color, s.borderTopColor ]; probe.remove(); return out })
    assert(await style("#editor-body", "color") === expected[0], "text isn't --foreground")
    assert(await style("#editor-body", "borderTopColor") === expected[1], "border isn't --input")
  })
  await check("focus draws the ring", async () => {
    await page.click("#editor-body .lexxy-editor__content")
    assert((await style("#editor-body", "boxShadow")) !== "none", "no focus ring")
  })
  await check("what's typed submits as HTML", async () => {
    await page.keyboard.press("Control+End")
    await page.keyboard.type(" Typed.")
    await page.waitForTimeout(200)
    const data = await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector("form"))))
    assert(data.body.includes("Typed.") && data.body.includes("<strong>"), data.body)
  })
  await check("an invalid one is marked", async () => {
    const destructive = await page.evaluate(() => { const probe = document.createElement("div"); probe.style.color = "var(--destructive)"; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c })
    await page.click("h1")
    assert(await style("#editor-bad", "borderTopColor") === destructive, "invalid border isn't --destructive")
  })
})
