import { component, check, assert } from "../component.mjs"

await component("hover_card", async (page) => {
  await check("pausing on the link shows the card; leaving hides it", async () => {
    await page.hover("ui-hover-card-trigger a")
    await page.waitForSelector("[data-slot=hover-card-content][data-open]", { timeout: 3000 })
    assert((await page.innerText("[data-slot=hover-card-content]")).includes("The React Framework"), "content missing")
    await page.mouse.move(1000, 600)
    await page.waitForSelector("[data-slot=hover-card-content][hidden]", { state: "attached", timeout: 3000 })
  })
  await check("the trigger is still a link", async () => {
    assert(await page.getAttribute("ui-hover-card-trigger a", "href") === "https://github.com/vercel", "href lost")
  })
})
