// Every gallery page, morphed onto itself twice (a Turbo Stream replace with method="morph" of the
// example, from a fresh fetch of the same page): nothing should change. The same elements
// before and after (no part added twice, none dropped), no duplicate ids, every ui-* element
// still upgraded, no errors. ONLY=name,other limits it.
import { open, check, assert, done, BASE } from "../helpers.mjs"

console.log("morph_stability")
const { browser, page, errors } = await open("/runeui")
const names = process.env.ONLY ? process.env.ONLY.split(",") : await page.evaluate(() => [ ...document.querySelectorAll(".runeui-docs__nav a:not(.runeui-docs__brand)") ].map((a) => a.pathname.split("/").pop()))

const signature = () => page.evaluate(() => {
  const root = document.querySelector(".runeui-docs__example")
  const counts = {}
  for (const element of root.querySelectorAll("*")) {
    if (element.closest("svg") && element.localName !== "svg") continue
    counts[element.localName] = (counts[element.localName] || 0) + 1
  }
  const ids = [ ...document.querySelectorAll("[id]") ].map((e) => e.id)
  const duplicates = [ ...new Set(ids.filter((id, i) => ids.indexOf(id) !== i)) ]
  const pending = [ ...new Set([ ...root.querySelectorAll("*") ].filter((e) => e.localName.startsWith("ui-") && !customElements.get(e.localName)).map((e) => e.localName)) ]
  return { counts, duplicates, pending }
})

for (const name of names) {
  await check(name, async () => {
    errors.length = 0
    await page.goto(`${BASE}/runeui/${name}`)
    await page.waitForTimeout(700)
    const before = await signature()
    // Twice: a component without an id of its own pairs up the first time by luck of position and
    // could be duplicated the second (its parts then carry ids the server's copy lacks).
    for (let time = 0; time < 2; time++) {
      await page.evaluate(async () => {
        const html = await (await fetch(location.href, { headers: { Accept: "text/html" } })).text()
        const fresh = new DOMParser().parseFromString(html, "text/html").querySelector(".runeui-docs__example")
        const stream = `<turbo-stream action="replace" method="morph" targets=".runeui-docs__example"><template>${fresh.outerHTML}</template></turbo-stream>`
        Turbo.renderStreamMessage(stream)
      })
      await page.waitForTimeout(500)
    }
    const after = await signature()
    const changed = Object.keys({ ...before.counts, ...after.counts }).filter((tag) => before.counts[tag] !== after.counts[tag]).map((tag) => `${tag} ${before.counts[tag] ?? 0}→${after.counts[tag] ?? 0}`)
    assert(changed.length === 0, `elements changed: ${changed.join(", ")}`)
    assert(after.duplicates.length === 0, `duplicate ids: ${after.duplicates.join(", ")}`)
    assert(after.pending.length === 0, `not upgraded: ${after.pending.join(", ")}`)
    assert(errors.length === 0, errors.join(" | "))
  })
}
await browser.close()
done()
