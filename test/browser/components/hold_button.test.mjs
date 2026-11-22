import { component, check, assert } from "../component.mjs"

await component("hold_button", async (page) => {
  const button = page.locator("#hold-delete [data-slot=hold-button]")
  const reset = page.locator("#hold-reset [data-slot=hold-button]")
  await page.evaluate(() => {
    window.confirmed = []
    document.addEventListener("holdconfirm", (event) => window.confirmed.push(event.target.closest("[data-slot=hold]").id))
  })
  const confirmed = () => page.evaluate(() => window.confirmed.slice())

  await check("its name stays put and says how to use it", async () => {
    assert(await page.getByRole("button", { name: "Delete project" }).count() === 1, "not named Delete project")
    const description = await button.evaluate((element) => document.getElementById(element.getAttribute("aria-describedby"))?.textContent)
    assert(/hold for 1\.2 seconds/i.test(description ?? ""), `description is ${description}`)
  })

  await check("a short press cancels: nothing confirms, the fill retracts", async () => {
    const box = await reset.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(150)
    assert(await reset.getAttribute("data-state") === "holding", "not holding while pressed")
    await page.mouse.up()
    await page.waitForTimeout(100)
    assert(await reset.getAttribute("data-state") === "idle" && (await confirmed()).length === 0, "a short press confirmed")
  })

  await check("the fill is linear over the duration, under reduced motion too", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const box = await reset.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(50)
    const transition = await reset.locator("[data-slot=hold-fill]").evaluate((element) => { const s = getComputedStyle(element); return `${s.transitionDuration} ${s.transitionTimingFunction}` })
    await page.mouse.up()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    assert(transition === "1.5s linear", `fill transition is ${transition}`)
  })

  await check("holding to the end confirms once, and submits its form through Turbo", async () => {
    await page.waitForTimeout(300)
    const box = await button.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1350)
    await page.mouse.up()
    assert(await button.getAttribute("data-state") === "confirmed", "not confirmed")
    assert((await confirmed()).join() === "hold-delete", `holdconfirm: ${await confirmed()}`)
    assert(await page.locator("#hold-delete [role=status]").innerText() === "Confirmed", "not announced")
    await page.waitForSelector("[data-slot=toast] >> text=Received", { timeout: 4000 })
    assert((await page.locator("[data-slot=toast]").last().innerText()).includes("project"), "the params didn't go")
  })

  await check("Space holds as a press does; Escape cancels it", async () => {
    await page.waitForTimeout(1500)
    await page.evaluate(() => { window.confirmed.length = 0 })
    await page.keyboard.press("Shift")
    await reset.focus()
    await page.keyboard.down(" ")
    await page.waitForTimeout(300)
    await page.keyboard.press("Escape")
    await page.keyboard.up(" ")
    assert(await reset.getAttribute("data-state") === "idle" && (await confirmed()).length === 0, "Escape didn't cancel")
    assert(await page.locator("#hold-reset-confirm [data-slot=alert-dialog-content]:not([hidden])").count() === 0, "Space opened the dialog")
    await page.keyboard.down(" ")
    await page.waitForTimeout(1650)
    await page.keyboard.up(" ")
    assert((await confirmed()).join() === "hold-reset", `holdconfirm: ${await confirmed()}`)
  })

  await check("a click with no press behind it asks in the alert dialog instead", async () => {
    await page.waitForTimeout(1500)
    await page.evaluate(() => { window.confirmed.length = 0 })
    await reset.evaluate((element) => element.click())
    await page.waitForSelector("#hold-reset-confirm [data-slot=alert-dialog-content]:not([hidden])")
    assert((await confirmed()).length === 0, "the click confirmed by itself")
    await page.locator("#hold-reset-confirm ui-alert-dialog-close[value=confirm] button").click()
    await page.waitForTimeout(300)
    assert((await confirmed()).join() === "hold-reset" && await reset.getAttribute("data-state") === "confirmed", "accepting didn't confirm")
  })
})
