// Date input: segments, typing and stepping, the submitted value, a morph.
import { component, check, assert } from "../component.mjs"
import { morph, formData } from "./_dates.mjs"

const segment = (page, id, type) => page.locator(`#${id} input[data-type=${type}]`)

await component("date_input", async (page) => {
  await check("submits ISO dates and a date-time with granularity", async () => {
    const data = await formData(page, "#born-on")
    assert(data.born_on === "1990-04-12", `born_on ${data.born_on}`)
    assert(data.starts_at === "2026-11-02T14:30", `starts_at ${data.starts_at}`)
  })

  await check("the arrow keys step a segment", async () => {
    await segment(page, "born-on", "day").focus()
    await page.keyboard.press("ArrowUp")
    assert((await formData(page, "#born-on")).born_on === "1990-04-13", "day didn't step")
  })

  await check("typing fills the segments and moves on", async () => {
    await segment(page, "empty-on", "month").focus()
    await page.keyboard.type("03152027")
    assert((await formData(page, "#empty-on")).empty_on === "2027-03-15", JSON.stringify(await formData(page, "#empty-on")))
  })

  await check("a morph keeps the segments and the value", async () => {
    await morph(page, "born-on")
    assert(await page.locator("#born-on input[data-slot=date-input-segment]").count() === 3, "segments stripped")
    assert((await formData(page, "#born-on")).born_on === "1990-04-13", "value lost")
  })
})
