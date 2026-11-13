// Every gallery page rendered by plain ERB and by ReActionView (Herb's engine) must come out the
// same, element for element and attribute for attribute. Herb rewrites tag helpers when it
// compiles a template and drops attributes it can't see (a splatted or computed hash), so this
// is what catches a partial that would lose them in a ReActionView app.
//
//   BASE_URL=http://localhost:3311 RV_URL=http://localhost:3316 node reactionview.parity.mjs [name…]
// with the dummy app running twice: test/dummy/bin/restart 3311, REACTIONVIEW=1 test/dummy/bin/restart 3316.

const PLAIN = process.env.BASE_URL || "http://localhost:3311"
const RV = process.env.RV_URL || "http://localhost:3316"

function elements(html) {
  const start = html.indexOf('<section class="runeui-docs__example"')
  const end = html.indexOf("</section>", start)
  const body = (start >= 0 ? html.slice(start, end) : html.slice(html.indexOf("<body"), html.indexOf("</body>")))
    .replace(/<!--\/?herb[^>]*-->/g, "")
  const out = []
  for (const match of body.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*\/?>/g)) {
    const attrs = {}
    for (const a of match[2].matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) {
      if (a[1].startsWith("data-herb")) continue
      let value = a[2] ?? a[3] ?? a[4] ?? ""
      if (a[1] === "value" && attrs.name === "authenticity_token") value = "token"
      if (a[1] === "nonce") value = "nonce"
      attrs[a[1]] = value.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    }
    if (attrs.name === "authenticity_token") attrs.value = "token"
    out.push([ match[1].toLowerCase(), attrs ])
  }
  return out
}

function describe([ tag, attrs ]) {
  return `<${tag}${attrs.id ? `#${attrs.id}` : ""}${attrs["data-slot"] ? ` slot=${attrs["data-slot"]}` : ""}${attrs.class ? ` .${attrs.class}` : ""}>`
}

const index = await (await fetch(`${PLAIN}/runeui`)).text()
let names = [ ...new Set([ ...index.matchAll(/href="\/runeui\/([a-z_]+)"/g) ].map((m) => m[1])) ]
if (process.argv.length > 2) names = names.filter((name) => process.argv.slice(2).includes(name))

let failures = 0
for (const name of names) {
  const [ plain, rv ] = await Promise.all([ PLAIN, RV ].map(async (base) => {
    const response = await fetch(`${base}/runeui/${name}`)
    return { status: response.status, html: await response.text() }
  }))
  if (plain.status !== 200 || rv.status !== 200) { failures++; console.log(`  ✗ ${name}: plain ${plain.status}, reactionview ${rv.status}`); continue }
  const a = elements(plain.html)
  const b = elements(rv.html)
  const problems = []
  if (a.length !== b.length) problems.push(`${a.length} elements in ERB, ${b.length} in ReActionView`)
  for (let i = 0; i < Math.min(a.length, b.length) && problems.length < 4; i++) {
    if (a[i][0] !== b[i][0]) { problems.push(`element ${i}: ${describe(a[i])} became ${describe(b[i])}`); break }
    for (const key of new Set([ ...Object.keys(a[i][1]), ...Object.keys(b[i][1]) ])) {
      if (a[i][1][key] !== b[i][1][key]) problems.push(`${describe(a[i])} ${key}: ${JSON.stringify(a[i][1][key])} → ${JSON.stringify(b[i][1][key])}`)
    }
  }
  if (problems.length) { failures++; console.log(`  ✗ ${name}\n      ${problems.slice(0, 4).join("\n      ")}`) }
  else console.log(`  ✓ ${name}`)
}
console.log(failures ? `${failures} of ${names.length} differ` : `all ${names.length} the same`)
process.exitCode = failures ? 1 : 0
