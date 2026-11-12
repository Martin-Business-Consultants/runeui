// Token input: the server's text shows its tokens, @ suggests people and inserts a token,
// Backspace selects a token then removes it, and the text submits with tokens written as
// [@label](type:value). Loads runeui/triggers (served here until it's pinned).
import { readFileSync } from "node:fs"
import { component, check, assert } from "../component.mjs"

const value = (page) => page.evaluate(() => new FormData(document.querySelector("#note").closest("form")).get("note"))

await component("token_input", async (page) => {
  const pinned = await page.evaluate(() => JSON.parse(document.querySelector("script[type=importmap]").textContent).imports["runeui/triggers"])
  if (!pinned) {
    const body = readFileSync(new URL("../../../app/javascript/runeui/triggers.js", import.meta.url), "utf8")
    await page.route("**/__runeui-triggers.js", (route) => route.fulfill({ body, contentType: "text/javascript" }))
    await page.addScriptTag({ type: "module", url: "/__runeui-triggers.js" })
  }

  await check("the server's text shows its token", async () => {
    assert(await page.locator("#note [data-slot=token-input-host]").count() === 1, "no token")
    assert(await value(page) === "Ask [@Grace Hopper](user:3) about the release", await value(page))
  })

  await check("@ suggests people; Enter inserts the token", async () => {
    await page.click("#note ui-token-input-editor")
    await page.keyboard.press("ControlOrMeta+End")
    await page.keyboard.type(" and @ka")
    await page.waitForSelector("[data-slot=trigger-menu-item] >> text=Katherine Johnson")
    await page.keyboard.press("Enter")
    assert((await value(page)).includes("[@Katherine Johnson](user:4)"), await value(page))
  })

  await check("Backspace selects the token, then removes it", async () => {
    await page.keyboard.press("ControlOrMeta+End")
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace")
    assert(!(await value(page)).includes("Katherine"), await value(page))
  })

  await check("/ at the start suggests commands", async () => {
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.press("Backspace")
    await page.keyboard.type("/re")
    await page.waitForSelector("[data-slot=trigger-menu-item] >> text=remind")
  })
})
