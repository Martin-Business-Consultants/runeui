import { open, check, assert, done } from "../helpers.mjs"

console.log("app_shell")
const { browser, page, errors } = await open("/runeui/app_shell?full=1")
await page.waitForTimeout(500)
const state = () => page.locator("[data-slot=app-shell]").getAttribute("data-sidebar")

await check("the toggle collapses the sidebar to icons and sets the cookie", async () => {
  assert(await state() === "expanded", `starts ${await state()}`)
  await page.click("[data-action='runeui--sidebar#toggle']")
  assert(await state() === "collapsed", "didn't collapse")
  assert((await page.evaluate(() => document.cookie)).includes("runeui_sidebar=collapsed"), "no cookie")
})
await check("the server draws it collapsed on the next page", async () => {
  await page.reload(); await page.waitForTimeout(300)
  assert(await state() === "collapsed", "server didn't read the cookie")
})
await check("[ toggles it from the keyboard", async () => {
  await page.keyboard.press("[")
  assert(await state() === "expanded", "[ didn't expand it")
})
await check("on a phone it slides in, and the scrim closes it", async () => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.click("[data-action='runeui--sidebar#toggle']")
  assert(await page.locator("[data-slot=app-shell]").getAttribute("data-mobile-open") !== null, "didn't open")
  await page.click("[data-slot=sidebar-scrim]", { position: { x: 380, y: 400 } })
  assert(await page.locator("[data-slot=app-shell]").getAttribute("data-mobile-open") === null, "scrim didn't close it")
})
await check("no errors", async () => assert(errors.length === 0, errors.join(" | ")))
await browser.close()
done()
