// A component's page in the gallery (/runeui/<name>), loaded light and dark: checks every ui-*
// element on it upgraded and nothing errored, saves screenshots, and hands the page to the
// test for its own checks.
//
//   import { component, assert } from "../component.mjs"
//   await component("select", async (page) => { … })
//
// SHOTS names a directory for the screenshots (else none are saved).
import { open, check, assert, done } from "./helpers.mjs"
export { assert, check }

export async function component(name, test) {
  console.log(name)
  for (const scheme of [ "light", "dark" ]) {
    const { browser, page, errors } = await open(`/runeui/${name}`, { colorScheme: scheme })
    await page.waitForTimeout(600)
    await check(`${scheme}: every ui-* element upgraded`, async () => {
      const pending = await page.evaluate(() => [ ...new Set([ ...document.querySelectorAll("main *") ].filter((e) => e.localName.startsWith("ui-") && !customElements.get(e.localName)).map((e) => e.localName)) ])
      assert(pending.length === 0, `not upgraded: ${pending.join(", ")}`)
    })
    if (scheme === "light" && test) await test(page)
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${scheme}.png`, fullPage: true })
    await check(`${scheme}: no errors`, async () => assert(errors.length === 0, errors.join(" | ")))
    await browser.close()
  }
  done()
}
