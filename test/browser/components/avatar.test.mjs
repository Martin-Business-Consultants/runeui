import { component, check, assert } from "../component.mjs"

await component("avatar", async (page) => {
  await check("an image that loads hides the initials", async () => {
    const first = page.locator("ui-avatar").first()
    const status = await first.getAttribute("data-loading-status")
    if (status === "loaded") assert(!(await first.locator("ui-avatar-fallback").isVisible()), "initials show over a loaded image")
  })
  await check("a broken image falls back to initials", async () => {
    const broken = page.locator("ui-avatar[title='Grace Hopper']").first()
    assert(await broken.getAttribute("data-loading-status") === "error", "not in error")
    assert((await broken.locator("ui-avatar-fallback").innerText()) === "GH", "no GH")
    assert(await broken.locator("ui-avatar-fallback").isVisible(), "initials hidden")
  })
  await check("the group counts the rest", async () => {
    assert((await page.locator("[data-slot=avatar-group-count]").innerText()) === "+2", "count isn't +2")
    assert(await page.locator("[data-slot=avatar-group] ui-avatar").count() === 3, "doesn't show 3")
  })
})
