import { component, check, assert } from "../component.mjs"
import { formData } from "./_form.mjs"

const file = (name, type = "text/plain") => ({ name, mimeType: type, buffer: Buffer.from("hello") })

await component("file_input", async (page) => {
  await check("the trigger opens the picker; chosen files are listed and submit", async () => {
    const [chooser] = await Promise.all([ page.waitForEvent("filechooser"), page.click("#attachments [data-slot=file-input-trigger]") ])
    await chooser.setFiles([ file("notes.txt"), file("plan.txt") ])
    await page.waitForSelector("#attachments [data-slot=file-input-item] >> nth=1")
    const names = await page.locator("#attachments [data-slot=file-input-name]").allInnerTexts()
    assert(names.join() === "notes.txt,plan.txt", `listed ${names}`)
    const data = await formData(page)
    assert(JSON.stringify(data["attachments[]"]) === '["notes.txt","plan.txt"]', JSON.stringify(data))
  })
  await check("remove takes a file out", async () => {
    await page.click("#attachments [data-slot=file-input-item-remove] >> nth=0")
    const data = await formData(page)
    assert(data["attachments[]"] === "plan.txt", JSON.stringify(data))
  })
  await check("a single input replaces its file", async () => {
    for (const name of [ "a.png", "b.png" ]) {
      const [chooser] = await Promise.all([ page.waitForEvent("filechooser"), page.click("#avatar [data-slot=file-input-trigger]") ])
      await chooser.setFiles([ file(name, "image/png") ])
    }
    assert((await formData(page)).avatar === "b.png", JSON.stringify(await formData(page)))
  })
})
