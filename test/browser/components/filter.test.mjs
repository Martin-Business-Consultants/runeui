import { component, check, assert } from "../component.mjs"

await component("filter", async (page) => {
  const query = () => new URL(page.url()).searchParams
  const rows = () => page.locator("#filtered tr").count()
  const pick = async (id, value) => {
    await page.click(`#${id} [data-slot=select-trigger]`)
    await page.click(`#${id} ui-select-item[value="${value}"]`)
  }
  const settled = (test) => page.waitForFunction(test, null, { timeout: 3000 })

  await check("a pill shows its label and the choice that clears it", async () => {
    assert((await page.locator("#filter-status [data-slot=select-trigger]").innerText()).replace(/\s+/g, " ").trim() === "Status Any", await page.locator("#filter-status [data-slot=select-trigger]").innerText())
    assert((await page.locator("#filter-owner [data-slot=select-trigger]").innerText()).includes("Anyone"), "owner doesn't say Anyone")
    assert(await page.locator("[data-slot=filter-clear]").count() === 0, "Clear shows with nothing set")
    assert(await rows() === 5, `${await rows()} rows`)
  })

  await check("picking submits at once: the address has the param and the list narrows", async () => {
    await pick("filter-status", "planned")
    await settled(() => location.search === "?status=planned")
    await settled(() => customElements.get("ui-select") && document.querySelector("#filter-status [data-slot=select-value]").textContent === "Planned")
    assert(await rows() === 2, `${await rows()} rows`)
    assert(await page.locator("form[data-slot=filter][data-active]").count() === 1, "the pill isn't marked active")
  })

  await check("a second filter keeps the first", async () => {
    await pick("filter-owner", "Sarah")
    await settled(() => new URLSearchParams(location.search).get("owner") === "Sarah")
    assert(query().get("status") === "planned", page.url())
    assert(await rows() === 1, `${await rows()} rows`)
  })

  await check("Back undoes the last filter", async () => {
    await page.goBack()
    await settled(() => location.search === "?status=planned")
    await settled(() => document.querySelectorAll("#filtered tr").length === 2)
  })

  await check("the clearing choice drops the param", async () => {
    await pick("filter-status", "")
    await settled(() => location.search === "")
    assert(await rows() === 5, `${await rows()} rows`)
  })

  await check("other params are kept, page is not", async () => {
    await page.goto(page.url().split("?")[0] + "?view=board&page=3&status=doing")
    await page.waitForFunction(() => customElements.get("ui-select"))
    await pick("filter-owner", "Priya")
    await settled(() => new URLSearchParams(location.search).get("owner") === "Priya")
    assert(query().get("view") === "board" && query().get("status") === "doing" && !query().has("page"), page.url())
  })

  await check("Clear drops every filter and keeps the rest", async () => {
    await page.click("[data-slot=filter-clear]")
    await settled(() => location.search === "?view=board")
    assert(await page.locator("[data-slot=filter-clear]").count() === 0, "Clear still shows")
  })

  await check("it works from the keyboard", async () => {
    await page.waitForFunction(() => customElements.get("ui-select"))
    await page.focus("#filter-status [data-slot=select-trigger]")
    await page.keyboard.press("Enter")
    await page.waitForSelector("#filter-status [data-slot=select-content]:not([hidden])")
    await page.keyboard.type("in r")
    await page.keyboard.press("Enter")
    await settled(() => new URLSearchParams(location.search).get("status") === "review")
  })

  await check("in a Turbo Frame only the frame loads, and the address still follows", async () => {
    await page.waitForFunction(() => customElements.get("ui-select"))
    await page.evaluate(() => { window.stayed = true })
    await pick("filter-stage", "Won")
    await settled(() => document.querySelector("#framed-result").textContent === "Showing Won")
    assert(await page.evaluate(() => window.stayed === true), "the whole page loaded")
    assert(query().get("stage") === "Won", page.url())
    assert(await page.locator("#framed-list [data-slot=filter-clear]").count() === 1, "no Clear in the frame")
  })

  await check("a field with a debounce submits as you type, once", async () => {
    let requests = 0
    page.on("request", (request) => { if (request.isNavigationRequest() || request.url().includes("q=")) requests++ })
    await page.click("#search-as-you-type input")
    await page.keyboard.type("launch", { delay: 40 })
    await settled(() => new URLSearchParams(location.search).get("q") === "launch")
    assert(requests === 1, `${requests} requests`)
  })

  await check("a GET form leaves blank fields out of the address", async () => {
    await page.waitForSelector("#search-as-you-type input")
    await page.fill("#search-as-you-type input", "")
    await settled(() => !new URLSearchParams(location.search).has("q"))
  })
})
