// Command: fuzzy filtering, keywords, the action event, shortcuts, and the ⌘K palette whose
// href commands visit through Turbo (runeui/command, served here until it's pinned).
import { readFileSync } from "node:fs"
import { component, check, assert } from "../component.mjs"

await component("command", async (page) => {
  const pinned = await page.evaluate(() => JSON.parse(document.querySelector("script[type=importmap]").textContent).imports["runeui/command"])
  if (!pinned) {
    const body = readFileSync(new URL("../../../app/javascript/runeui/command.js", import.meta.url), "utf8")
    await page.route("**/__runeui-command.js", (route) => route.fulfill({ body, contentType: "text/javascript" }))
    await page.addScriptTag({ type: "module", url: "/__runeui-command.js" })
  }
  await page.evaluate(() => {
    window.ran = []
    document.addEventListener("action", (e) => window.ran.push(e.detail.value), true)
  })

  await check("typing filters, keywords match, groups with nothing left hide", async () => {
    await page.fill("#inline-command input", "math")
    const shown = await page.locator("#inline-command ui-command-item:visible").allInnerTexts()
    assert(shown.length === 1 && shown[0].includes("Calculator"), `shown: ${shown}`)
    assert(!(await page.locator("#inline-command ui-command-group-label >> text=Settings").isVisible()), "the Settings group still shows")
  })

  await check("Enter runs the highlighted command", async () => {
    await page.fill("#inline-command input", "bill")
    await page.keyboard.press("Enter")
    assert((await page.evaluate(() => window.ran)).includes("billing"), `ran ${await page.evaluate(() => window.ran)}`)
  })

  await check("nothing matching shows the empty line", async () => {
    await page.fill("#inline-command input", "qqqq")
    assert(await page.locator("#inline-command [data-slot=command-empty]").isVisible(), "no empty line")
    await page.fill("#inline-command input", "")
  })

  await check("a command's shortcut runs it", async () => {
    await page.click("#inline-command input")
    await page.keyboard.press("ControlOrMeta+p")
    assert((await page.evaluate(() => window.ran)).includes("profile"), `ran ${await page.evaluate(() => window.ran)}`)
  })

  await check("src: shows the prompt, then asks the server from min: characters and lists its answer", async () => {
    const queries = []
    page.on("request", (request) => { if (request.url().includes("/command/search")) queries.push([ new URL(request.url()).searchParams.get("q"), request.headers()["runeui-command"] ]) })
    const remote = "#remote-command"
    const empty = () => page.locator(`${remote} [data-slot=command-empty]`).innerText()
    assert((await empty()).includes("Projects and people"), `prompt: ${await empty()}`)
    await page.click(`${remote} input`)
    await page.keyboard.type("a")
    await page.waitForTimeout(450)
    assert(queries.length === 0, `asked with one letter: ${JSON.stringify(queries)}`)
    await page.keyboard.type("d")
    await page.waitForSelector(`${remote} [role=option] >> text=Ada Lovelace`, { timeout: 3000 })
    assert(JSON.stringify(queries) === '[["ad","remote-command"]]', JSON.stringify(queries))
    const first = await page.locator(`${remote} [role=option]`).first().getAttribute("data-highlighted")
    assert(first !== null, "the first answer isn't highlighted")
    await page.fill(`${remote} input`, "qqq")
    await page.waitForFunction((r) => document.querySelector(`${r} [data-slot=command-empty]`).innerText.includes("Nothing by that name"), remote, { timeout: 3000 })
    await page.fill(`${remote} input`, "")
    await page.waitForTimeout(100)
    assert((await empty()).includes("Projects and people"), `prompt again: ${await empty()}`)
  })

  await check("src: a link command's link is followed with Enter", async () => {
    await page.fill("#remote-command input", "web")
    await page.waitForSelector("#remote-command a[role=option] >> text=Website rebuild", { timeout: 3000 })
    await page.keyboard.press("Enter")
    await page.waitForURL("**/runeui/command#website-rebuild", { timeout: 3000 })
  })

  await check("⌘K opens the palette; an href command visits its page", async () => {
    await page.click("h1")
    await page.keyboard.press("ControlOrMeta+k")
    await page.waitForSelector("#palette [data-slot=dialog-content]:not([hidden])", { timeout: 2000 })
    await page.keyboard.type("selec")
    await page.keyboard.press("Enter")
    await page.waitForURL("**/runeui/select", { timeout: 3000 })
  })
})
