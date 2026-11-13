// The side panel on the dummy app's /panel: links open in it, the address remembers it, Back
// closes it without fetching the page, a full load draws it open, and a morph keeps it open.
import { open, check, assert, BASE } from "../helpers.mjs"
import { component } from "../component.mjs"

console.log("side_panel")
const { browser, page, errors } = await open("/?reset=1")
const pageLoads = []
page.on("request", (request) => { if (request.resourceType() === "document" || (request.url().endsWith("/panel") && request.method() === "GET")) pageLoads.push(request.url()) })
await page.goto(BASE + "/panel")
await page.waitForFunction(() => customElements.get("ui-drawer"))
const shown = () => page.locator("#runeui-side-panel [data-slot=drawer-content]").evaluate((el) => !el.hidden)
const param = () => page.evaluate(() => new URL(location.href).searchParams.get("panel"))

await check("it starts closed, the frame empty", async () => {
  assert(!(await shown()), "open on load")
  assert(await param() === null, "param on load")
})

await check("a link with data-turbo-frame opens it and loads there", async () => {
  await page.click("#open-one")
  await page.waitForSelector("#peek-title", { timeout: 3000 })
  assert(await shown(), "not shown")
  assert((await page.locator("#peek-title").innerText()) === "Record one", "wrong content")
})

await check("the address gains ?panel=<path>", async () => {
  await page.waitForFunction(() => new URL(location.href).searchParams.get("panel") === "/peek/one", null, { timeout: 2000 })
})

await check("the page behind stays usable", async () => {
  await page.click("#typing")
  await page.keyboard.type("hello")
  assert(await page.inputValue("#typing") === "hello", "couldn't type in the page")
  assert(await shown(), "typing in the page closed it")
})

await check("a link inside moves on in place, without another history entry", async () => {
  const before = await page.evaluate(() => history.length)
  await page.click("#peek-next")
  await page.waitForFunction(() => document.querySelector("#peek-title")?.textContent === "Record two", null, { timeout: 3000 })
  await page.waitForFunction(() => new URL(location.href).searchParams.get("panel") === "/peek/two", null, { timeout: 2000 })
  assert(await page.evaluate(() => history.length) === before, "history grew")
})

await check("a morph refresh of the page keeps it open and reloads the frame", async () => {
  await page.evaluate(async () => {
    const token = document.querySelector("meta[name=csrf-token]").content
    await fetch("/", { method: "PATCH", headers: { "X-CSRF-Token": token, "Content-Type": "application/x-www-form-urlencoded" }, body: "note=x", redirect: "manual" })
    // Wait for the refresh visit to finish: it writes the address itself as it completes.
    const finished = new Promise((resolve) => document.addEventListener("turbo:load", resolve, { once: true }))
    Turbo.session.refresh(location.href)
    await finished
  })
  await page.waitForFunction(() => document.querySelector("#saves").textContent === "1", null, { timeout: 3000 })
  await page.waitForFunction(() => document.querySelector("#peek-saves")?.textContent === "1", null, { timeout: 3000 })
  assert(await shown(), "the morph closed it")
  assert((await page.locator("#peek-title").innerText()) === "Record two", "lost its content")
})

await check("Back closes it without fetching the page", async () => {
  pageLoads.length = 0
  await page.goBack()
  await page.waitForFunction(() => document.querySelector("#runeui-side-panel [data-slot=drawer-content]").hidden, null, { timeout: 3000 })
  assert(await param() === null, "param still there")
  assert(await page.locator("#peek-title").count() === 0, "frame not emptied")
  await page.waitForTimeout(300)
  assert(pageLoads.length === 0, `fetched ${pageLoads.join(", ")}`)
})

await check("Forward opens it again", async () => {
  await page.goForward()
  await page.waitForSelector("#peek-title", { timeout: 3000 })
  assert(await shown(), "not shown")
})

await check("Escape closes it and takes the param off", async () => {
  await page.click("#peek-title")
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => document.querySelector("#runeui-side-panel [data-slot=drawer-content]").hidden, null, { timeout: 3000 })
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("panel"), null, { timeout: 2000 })
})

await check("a full load with the param draws it open", async () => {
  await page.goto(BASE + "/panel?panel=/peek/three")
  await page.waitForSelector("#peek-title", { timeout: 3000 })
  assert(await shown(), "not open")
  assert((await page.locator("#peek-title").innerText()) === "Record three", "wrong record")
})

await check("…and the ✕ closes it in place", async () => {
  await page.click("#runeui-side-panel [data-drawer-x]")
  await page.waitForFunction(() => !new URL(location.href).searchParams.has("panel"), null, { timeout: 3000 })
  assert(page.url().endsWith("/panel"), page.url())
})

await check("leaving with it open, Back restores the page with it open", async () => {
  await page.click("#open-one")
  await page.waitForSelector("#peek-title")
  await page.waitForFunction(() => new URL(location.href).searchParams.has("panel"))
  await page.click("#elsewhere")
  await page.waitForSelector("#settings", { timeout: 3000 })
  await page.goBack()
  await page.waitForSelector("#peek-title", { timeout: 3000 })
  assert(await shown(), "not open after Back")
  assert(await param() === "/peek/one", `param ${await param()}`)
})

await check("a src that isn't a path on this site is ignored", async () => {
  await page.goto(BASE + "/panel?panel=//evil.example/x")
  await page.waitForFunction(() => customElements.get("ui-drawer"))
  assert(!(await shown()), "opened")
  assert(await page.locator("turbo-frame#side_panel").getAttribute("src") === null, "src rendered")
})

await check("no errors", async () => assert(errors.length === 0, errors.join(" | ")))
await browser.close()

// The panel as the page's own state (params:): /here?sort=name&item=one, the frame loading the
// page's own address.
{
  console.log("side_panel (params:)")
  const { browser, page, errors } = await open("/?reset=1")
  const frameLoads = []
  page.on("request", (request) => { if (request.headers()["turbo-frame"] === "side_panel") frameLoads.push(request.url()) })
  await page.goto(BASE + "/here?sort=name")
  await page.waitForFunction(() => customElements.get("ui-drawer"))
  const shown = () => page.locator("#runeui-side-panel [data-slot=drawer-content]").evaluate((el) => !el.hidden)
  const address = () => page.evaluate(() => location.pathname + location.search)

  await check("it starts closed, with no ✕ of its own (closable: false)", async () => {
    assert(!(await shown()), "open on load")
    assert(await page.locator("#runeui-side-panel [data-drawer-x]").count() === 0, "✕ rendered")
  })

  await check("a link to the page with the param opens it, and that is the address", async () => {
    const before = await page.evaluate(() => history.length)
    await page.click("#item-one")
    await page.waitForSelector("#item-title", { timeout: 3000 })
    assert(await shown(), "not shown")
    await page.waitForFunction(() => new URLSearchParams(location.search).get("item") === "one" && new URLSearchParams(location.search).get("sort") === "name", null, { timeout: 2000 })
    assert(await page.evaluate(() => history.length) === before + 1, "no entry pushed")
  })

  await check("initial_focus: \"none\" leaves focus on the page", async () => {
    assert(await page.evaluate(() => !document.activeElement?.closest("#runeui-side-panel")), "focus moved into the panel")
  })

  await check("moving on inside replaces the address", async () => {
    const before = await page.evaluate(() => history.length)
    await page.click("#item-next")
    await page.waitForFunction(() => document.querySelector("#item-title")?.textContent === "Item two", null, { timeout: 3000 })
    await page.waitForFunction(() => new URLSearchParams(location.search).get("item") === "two", null, { timeout: 2000 })
    assert(await page.evaluate(() => history.length) === before, "history grew")
  })

  await check("a morph refresh reloads it, what shows staying on screen meanwhile", async () => {
    await page.evaluate(() => {
      window.hiddenWhileReloading = false
      const frame = document.querySelector("#side_panel")
      new MutationObserver(() => { if (frame.hasAttribute("busy") && frame.checkVisibility && !frame.checkVisibility()) window.hiddenWhileReloading = true }).observe(frame, { attributes: true })
    })
    await page.evaluate(async () => {
      const token = document.querySelector("meta[name=csrf-token]").content
      await fetch("/", { method: "PATCH", headers: { "X-CSRF-Token": token, "Content-Type": "application/x-www-form-urlencoded" }, body: "note=y", redirect: "manual" })
      const finished = new Promise((resolve) => document.addEventListener("turbo:load", resolve, { once: true }))
      Turbo.session.refresh(location.href)
      await finished
    })
    await page.waitForFunction(() => document.querySelector("#item-saves")?.textContent === document.querySelector("#saves").textContent, null, { timeout: 3000 })
    assert(await shown(), "the morph closed it")
    assert(!(await page.evaluate(() => window.hiddenWhileReloading)), "hidden while it reloaded")
  })

  await check("a close button inside closes it, Back to the page as it was", async () => {
    await page.click("#item-close")
    await page.waitForFunction(() => document.querySelector("#runeui-side-panel [data-slot=drawer-content]").hidden, null, { timeout: 3000 })
    await page.waitForFunction(() => location.search === "?sort=name", null, { timeout: 2000 })
    assert(await page.locator("#item-title").count() === 0, "frame not emptied")
  })

  await check("a full load with the param draws it open without fetching the frame", async () => {
    frameLoads.length = 0
    await page.goto(BASE + "/here?item=three")
    await page.waitForFunction(() => customElements.get("ui-drawer"))
    assert(await shown(), "not open")
    assert((await page.locator("#item-title").innerText()) === "Item three", "wrong item")
    await page.waitForTimeout(300)
    assert(frameLoads.length === 0, `fetched ${frameLoads.join(", ")}`)
  })

  await check("…which a morph refresh updates in place, still open", async () => {
    await page.evaluate(async () => {
      const token = document.querySelector("meta[name=csrf-token]").content
      await fetch("/", { method: "PATCH", headers: { "X-CSRF-Token": token, "Content-Type": "application/x-www-form-urlencoded" }, body: "note=z", redirect: "manual" })
      const finished = new Promise((resolve) => document.addEventListener("turbo:load", resolve, { once: true }))
      Turbo.session.refresh(location.href)
      await finished
    })
    await page.waitForFunction(() => document.querySelector("#item-saves")?.textContent === document.querySelector("#saves").textContent, null, { timeout: 3000 })
    assert(await shown(), "the morph closed it")
  })

  await check("Escape closes it in place, the param off and the rest kept", async () => {
    await page.click("#item-title")
    await page.keyboard.press("Escape")
    await page.waitForFunction(() => !new URL(location.href).searchParams.has("item"), null, { timeout: 3000 })
    assert(await address() === "/here", await address())
  })

  await check("no errors", async () => assert(errors.length === 0, errors.join(" | ")))
  await browser.close()
}

// The gallery's example, light and dark.
await component("side_panel", async (page) => {
  await check("the gallery's example opens a person beside the page", async () => {
    await page.click("a[data-turbo-frame=side_panel] >> nth=1")
    await page.waitForSelector("#side_panel [data-slot=page-title]", { timeout: 3000 })
    assert((await page.locator("#side_panel [data-slot=page-title]").innerText()) === "Grace Hopper", "wrong person")
    await page.waitForFunction(() => new URL(location.href).searchParams.get("panel")?.includes("peek=grace"), null, { timeout: 2000 })
  })
})
