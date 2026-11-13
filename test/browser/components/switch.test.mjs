import { component, check, assert } from "../component.mjs"

await component("switch", async (page) => {
  const data = () => page.evaluate(() => [ ...new FormData(document.querySelector("form")) ].map((pair) => pair.join("=")).join("&"))
  await check("off submits the hidden 0; on submits 1", async () => {
    assert(await data() === "airplane=0&wifi=1", await data())
  })
  await check("clicking turns it on and fires change", async () => {
    await page.evaluate(() => { window.changes = 0; document.addEventListener("change", () => window.changes++) })
    await page.click("ui-switch[name=airplane]")
    await page.waitForFunction(() => window.changes > 0)
    assert((await data()).includes("airplane=0&airplane=1"), await data())
  })
  await check("it has the switch role and a name", async () => {
    assert(await page.getByRole("switch", { name: "Airplane mode" }).count() === 1, "not named by its label")
  })
  await check("form: joins a form it sits outside of, its off value too", async () => {
    const data = await page.evaluate(() => new URLSearchParams(new FormData(document.getElementById("elsewhere"))).toString())
    assert(data === "notify=0", data)
    await page.click("ui-switch[name=notify]")
    await page.waitForFunction(() => new URLSearchParams(new FormData(document.getElementById("elsewhere"))).toString() === "notify=0&notify=1")
  })
})
