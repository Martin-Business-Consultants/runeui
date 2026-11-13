// runeui under rune_ui's tokens (app/assets/stylesheets/runeui/bridges/rune_ui.css), on the
// dummy app's /bridge. Needs the dummy app started with RUNE_UI=<a rune_ui checkout>; skips
// when it wasn't.
import { open, check, assert, done } from "./helpers.mjs"

console.log("bridge")
const css = (page, selector, property) => page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], property)
// A token's value as a colour, read where it's declared (the root).
const token = (page, name) => page.evaluate((n) => { const probe = document.createElement("div"); probe.style.color = `var(${n})`; document.documentElement.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c }, name)

for (const theme of [ "light", "dark" ]) {
  // The system's scheme stands in for the app's data-theme (runeui's theme module follows it).
  const { browser, page, errors } = await open("/bridge", { colorScheme: theme })
  if (!(await page.locator("link[href*='rune_ui/tokens']").count())) {
    console.log("  - skipped: start the dummy app with RUNE_UI=<a rune_ui checkout>")
    await browser.close()
    break
  }
  await page.waitForTimeout(500)

  await check(`${theme}: runeui's primary is rune_ui's accent, its surfaces rune_ui's panel`, async () => {
    assert(await css(page, "#ui-default", "backgroundColor") === await token(page, "--accent"), "primary isn't --accent")
    assert(await css(page, "#ui-card", "backgroundColor") === await token(page, "--panel"), "card isn't --panel")
    assert(await css(page, "#ui-card", "color") === await token(page, "--text"), "text isn't --text")
    assert(await css(page, "body", "backgroundColor") === await token(page, "--page"), "the page isn't --page")
  })

  await check(`${theme}: inside runeui, --accent is the quiet hover fill, not the brand`, async () => {
    await page.hover("#ui-ghost")
    await page.waitForTimeout(250)
    const hover = await css(page, "#ui-ghost", "backgroundColor")
    assert(hover !== await token(page, "--accent"), "a ghost button hovers in the brand colour")
    assert(hover !== "rgba(0, 0, 0, 0)", "a ghost button has no hover fill")
  })

  await check(`${theme}: rune_ui's own components keep their accent and ring, inside runeui too`, async () => {
    const accent = await token(page, "--accent")
    assert(await css(page, "#rune-accent", "backgroundColor") === accent, "a rune button lost its accent")
    assert(await css(page, "#rune-inside", "backgroundColor") === accent, "a rune button inside a runeui card lost its accent")
    await page.focus("#rune-input")
    assert((await css(page, "#rune-input", "boxShadow")) !== "none", "a rune input lost its focus ring")
  })

  await check(`${theme}: a runeui field focuses with rune_ui's ring, in the accent`, async () => {
    await page.focus("#ui-input")
    await page.waitForTimeout(250)
    assert(await css(page, "#ui-input", "borderTopColor") === await token(page, "--accent"), "focus border isn't the accent")
    assert((await css(page, "#ui-input", "boxShadow")) !== "none", "no focus ring")
  })

  await check(`${theme}: sizes are rune_ui's`, async () => {
    assert(await css(page, "#ui-default", "height") === await css(page, "#rune-accent", "height"), "buttons differ in height")
    assert(await css(page, "#ui-default", "fontSize") === await css(page, "#rune-accent", "fontSize"), "buttons differ in type size")
    assert(await css(page, "#ui-default", "fontFamily") === await css(page, "#rune-accent", "fontFamily"), "buttons differ in font")
  })

  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/bridge-${theme}.png`, fullPage: true })
  await check(`${theme}: no errors`, async () => assert(errors.length === 0, errors.join(" | ")))
  await browser.close()
}

{
  const { browser, page } = await open("/bridge?scale=0.25&accent=green")
  if (await page.locator("link[href*='rune_ui/tokens']").count()) {
    await check("the app's corners, accent and font reach runeui (Appearance → rune_ui → runeui)", async () => {
      assert(await css(page, "#ui-default", "borderTopLeftRadius") === await css(page, "#rune-accent", "borderTopLeftRadius"), "controls differ in radius")
      assert(await css(page, "#ui-default", "backgroundColor") === await token(page, "--accent"), "the new accent didn't reach runeui")
      assert((await css(page, "#ui-default", "fontFamily")).startsWith("Georgia"), "the font didn't reach runeui")
      const sharp = parseFloat(await css(page, "#ui-card", "borderTopLeftRadius"))
      assert(sharp > 0 && sharp < 6, `card radius ${sharp}px at scale 0.25`)
    })
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/bridge-sharp-green.png`, fullPage: true })
  }
  await browser.close()
}
done()
