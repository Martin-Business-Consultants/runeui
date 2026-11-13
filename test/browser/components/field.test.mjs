import { component, check, assert } from "../component.mjs"

await component("field", async (page) => {
  await check("control: the label and description stack on the left, the control at the row's end", async () => {
    const box = await page.evaluate(() => {
      const field = document.querySelector(".ui-field-demo-setting")
      const rect = (el) => el.getBoundingClientRect()
      const [content, control] = [ field.querySelector("[data-slot=field-content]"), field.querySelector("ui-switch") ]
      return { contentLeft: rect(content).left - rect(field).left, controlRight: rect(field).right - rect(control).right, controlLeft: rect(control).left, contentRight: rect(content).right,
        label: content.querySelector("[data-slot=field-label]")?.innerText, description: content.querySelector("[data-slot=field-description]")?.innerText }
    })
    assert(box.contentLeft < 1 && box.controlRight < 1 && box.controlLeft >= box.contentRight, JSON.stringify(box))
    assert(box.label === "Marketing emails" && box.description.startsWith("Receive"), JSON.stringify(box))
  })
  await check("control: the label names the control", async () => {
    await page.waitForFunction(() => document.querySelector(".ui-field-demo-setting ui-switch")?.hasAttribute("aria-labelledby"), null, { timeout: 10000 }).catch(() => {})
    assert(await page.getByRole("switch", { name: "Marketing emails" }).count() === 1, "the switch isn't named by the field's label")
  })
})
