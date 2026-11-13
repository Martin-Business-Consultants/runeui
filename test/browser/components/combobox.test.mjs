// Combobox: filters as you type, picks with Enter, submits the value (not the text), chips for
// several, and server search through runeui/remote (stubbed here).
import { readFileSync } from "node:fs"
import { component, check, assert } from "../component.mjs"
import { morph } from "./_dates.mjs"

await component("combobox", async (page) => {
  await check("typing filters, Enter picks, the value submits", async () => {
    await page.fill("#framework input", "sv")
    await page.waitForSelector("#framework [data-slot=combobox-content]:not([hidden])")
    const shown = await page.locator("#framework ui-combobox-item:visible").count()
    assert(shown === 1, `${shown} items shown for "sv"`)
    await page.keyboard.press("Enter")
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("#framework").closest("form")) ].map((p) => p.join("=")))
    assert(data.includes("framework=sveltekit"), data.join("&"))
    assert(await page.inputValue("#framework input") === "SvelteKit", "the input doesn't show the label")
  })

  await check("nothing matching shows the empty line", async () => {
    await page.fill("#framework input", "zzz")
    await page.waitForSelector("#framework [data-slot=combobox-empty][data-empty]")
    assert((await page.locator("#framework [data-slot=combobox-empty]").innerText()).includes("No results"), "no empty text")
    await page.keyboard.press("Escape")
  })

  await check("the server's value shows its label", async () => {
    assert(await page.inputValue("#timezone input") === "Central", "timezone doesn't show Central")
  })

  await check("several: chips from the server values, a pick adds one, Backspace removes the last", async () => {
    const chips = () => page.locator("#frameworks ui-combobox-chip").allInnerTexts()
    assert((await chips()).join() === "Next.js,Astro", `chips: ${await chips()}`)
    await page.fill("#frameworks input", "nu")
    await page.keyboard.press("Enter")
    assert((await chips()).length === 3, `chips after pick: ${await chips()}`)
    await page.fill("#frameworks input", "")
    await page.keyboard.press("Backspace")
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("#frameworks").closest("form")) ].map((p) => p.join("=")))
    assert(data.join("&") === "frameworks[]=next&frameworks[]=astro", data.join("&"))
    await page.keyboard.press("Escape")
  })

  await check("creatable: what's typed becomes a tag", async () => {
    await page.fill("#tags input", "billing")
    await page.keyboard.press("Enter")
    await page.keyboard.press("Escape")
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("#tags").closest("form")) ].map((p) => p.join("=")).join("&"))
    assert(data === "tags[]=urgent&tags[]=billing", data)
    assert((await page.locator("#tags ui-combobox-chip").allInnerTexts()).join() === "urgent,billing", "chips")
  })

  await check("src: searches the server as you type", async () => {
    const queries = []
    await page.route("**/people.json?*", (route) => {
      const q = new URL(route.request().url()).searchParams.get("q")
      queries.push(q)
      const people = [ "Ada Lovelace", "Alan Turing", "Grace Hopper" ].map((n, i) => ({ value: String(i + 1), label: n }))
      route.fulfill({ json: people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())) })
    })
    // Through the importmap once runeui/remote is pinned; until then, its digested file.
    const pinned = await page.evaluate(() => JSON.parse(document.querySelector("script[type=importmap]").textContent).imports["runeui/remote"])
    if (pinned) await page.evaluate((url) => import(url), pinned)
    else {
      const body = readFileSync(new URL("../../../app/javascript/runeui/remote.js", import.meta.url), "utf8")
      await page.route("**/__runeui-remote.js", (route) => route.fulfill({ body, contentType: "text/javascript" }))
      await page.addScriptTag({ type: "module", url: "/__runeui-remote.js" })
    }
    await page.click("#person input")
    await page.fill("#person input", "gra")
    await page.waitForSelector("#person ui-combobox-item >> text=Grace Hopper", { timeout: 3000 })
    await page.click("#person ui-combobox-item >> text=Grace Hopper")
    const picked = await page.evaluate(() => [ JSON.stringify(document.querySelector("#person").value), document.querySelector("#person input").value ])
    assert(picked[0] === '"3"' && picked[1] === "Grace Hopper", `picked ${picked}`)
    assert(queries.includes("gra"), `queries: ${queries}`)
  })

  await check("src: behind a button opens on the empty search, not the choice's words, and doesn't search as it closes", async () => {
    const queries = []
    page.on("request", (request) => { if (request.url().includes("/people.json?picker=1")) queries.push(new URL(request.url()).searchParams.get("q")) })
    await page.click("#person-picker-trigger")
    await page.waitForSelector("#person-picker ui-combobox-item >> text=Grace Hopper", { timeout: 3000 })
    assert(queries[0] === "", `first query: ${JSON.stringify(queries)}`)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(500)
    assert(queries.length === 1, `searched as it closed: ${JSON.stringify(queries)}`)
  })

  await check("behind a button: the button says the choice, the box in the popup filters, the value submits", async () => {
    const button = () => page.locator("#owner-trigger").innerText()
    assert((await button()).trim() === "Unassigned", await button())
    await page.click("#owner-trigger")
    await page.waitForSelector("#owner [data-slot=combobox-content][data-open]", { timeout: 3000 })
    await page.waitForFunction(() => document.activeElement === document.querySelector("#owner [data-slot=combobox-search] input"))
    await page.keyboard.type("gra")
    assert(await page.locator("#owner ui-combobox-item:visible").count() === 1, "didn't filter")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.querySelector("#owner-trigger").innerText.trim() === "Grace Hopper")
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("#owner").closest("form")) ].map((p) => p.join("=")))
    assert(data.includes("owner=grace"), data.join("&"))
    await page.waitForFunction(() => document.activeElement === document.querySelector("#owner-trigger"))
  })

  await check("behind a button, several: the popup stays open and the button lists them", async () => {
    await page.click("#reviewers-trigger")
    await page.waitForSelector("#reviewers [data-slot=combobox-content][data-open]", { timeout: 3000 })
    await page.click("#reviewers ui-combobox-item[value=ada]")
    assert(await page.$("#reviewers [data-slot=combobox-content][data-open]"), "closed after a pick")
    await page.waitForFunction(() => document.querySelector("#reviewers-trigger").innerText.trim() === "Grace Hopper, Ada Lovelace")
    const data = await page.evaluate(() => [ ...new FormData(document.querySelector("#reviewers").closest("form")) ].map((p) => p.join("=")))
    assert(data.filter((d) => d.startsWith("reviewers")).join("&") === "reviewers[]=grace&reviewers[]=ada", data.join("&"))
    await page.keyboard.press("Escape")
  })

  await check("no trigger: a button elsewhere opens it beside itself and gets focus back", async () => {
    await page.click("#assign-b")
    await page.waitForSelector("#assignees [data-slot=combobox-content][data-open]", { timeout: 3000 })
    await page.waitForFunction(() => { const b = document.getElementById("assign-b").getBoundingClientRect(), m = document.querySelector("#assignees [data-slot=combobox-content]").getBoundingClientRect(); return Math.abs(m.left - b.left) < 40 && (Math.abs(m.top - b.bottom) < 20 || Math.abs(b.top - m.bottom) < 20) }, null, { timeout: 3000 })
    await page.click("#assignees ui-combobox-item[value=katherine]")
    assert(await page.evaluate(() => JSON.stringify(document.getElementById("assignees").value)) === '["katherine"]', "value")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => document.activeElement === document.getElementById("assign-b"), null, { timeout: 3000 })
  })

  await check("behind a button: a morph keeps an unsaved pick and the button's words", async () => {
    await page.click("#owner-trigger")
    await page.waitForSelector("#owner [data-slot=combobox-content][data-open]", { timeout: 3000 })
    await page.click("#owner ui-combobox-item[value=katherine]")
    await page.waitForFunction(() => document.querySelector("#owner-trigger").innerText.trim() === "Katherine Johnson")
    await morph(page, "owner")
    assert(await page.evaluate(() => document.getElementById("owner").value) === "katherine", "value lost")
    const shown = await page.evaluate(() => document.querySelector("#owner-trigger").innerText.trim())
    assert(shown === "Katherine Johnson", `the button says ${shown}`)
  })
})
