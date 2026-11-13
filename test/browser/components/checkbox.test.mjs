import { component, check, assert } from "../component.mjs"

await component("checkbox", async (page) => {
  const data = () => page.evaluate(() => [ ...new FormData(document.querySelector("form")) ].map((pair) => pair.join("=")).join("&"))
  await check("unchecked submits the hidden 0; the server's checked one submits 1", async () => {
    assert(await data() === "terms=0&news=1", await data())
  })
  await check("clicking the label checks it; Space unchecks it", async () => {
    await page.click("text=Accept terms and conditions")
    assert((await data()).includes("terms=0&terms=1"), await data())
    await page.locator("ui-checkbox[name=terms]").focus()
    await page.keyboard.press("Space")
    assert(await data() === "terms=0&news=1", await data())
  })
  await check("it has the checkbox role and a name", async () => {
    assert(await page.getByRole("checkbox", { name: "Send me news" }).count() === 1, "not named by its label")
  })
  await check("a disabled one doesn't change", async () => {
    await page.locator("ui-checkbox[name=off]").click({ force: true })
    assert(!(await data()).includes("off="), await data())
  })
})
