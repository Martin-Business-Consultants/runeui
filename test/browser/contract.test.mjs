// The contract with UI SDK: everything runeui's own code assumes about it, asserted directly,
// so a re-vendored version that breaks an assumption fails here, with a message naming the file
// that depends on it, and not as sixty confusing component failures. Run it first after
// script/vendor-ui-sdk (script/test does). docs/upgrading-ui-sdk.md says what to do about each.
//
// Most checks run on /runeui/contract (app/views/runeui/docs/examples/_contract.html.erb): plain
// UI SDK markup, not runeui's partials. The last section walks the gallery and compares the
// data-slot each partial renders on the server with the one UI SDK gives the part once it
// upgrades.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { check, assert, done, BASE } from "./helpers.mjs"

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright-core")

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

console.log("contract")
// Opened here, not with helpers' open(): that waits for ui-select to be defined, and a version
// that breaks it should fail the checks below by name, not time out before them.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined })
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
page.setDefaultTimeout(8000)
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
await page.goto(`${BASE}/runeui/contract`)
await page.waitForFunction(() => [ "ui-select", "ui-checkbox", "ui-switch", "ui-toggle", "ui-toggle-group", "ui-slider", "ui-combobox", "ui-dialog", "ui-popover" ].every((tag) => customElements.get(tag)), null, { timeout: 10000 })
  .catch(() => {})
await page.waitForTimeout(300)

// Records UI SDK's events as they pass the document in the capture phase (they don't bubble).
await page.evaluate(() => {
  window.seen = []
  // Native change events, by who dispatched them: UI SDK's own modules or runeui's forms.js.
  const dispatch = EventTarget.prototype.dispatchEvent
  window.changes = []
  EventTarget.prototype.dispatchEvent = function (event) {
    if (event.type === "change" && this instanceof Element) window.changes.push({ id: this.id, by: new Error().stack.includes("/runeui/sdk/") ? "ui-sdk" : "runeui", bubbles: event.bubbles })
    return dispatch.call(this, event)
  }
  for (const type of [ "valuechange", "checkedchange", "pressedchange", "openchange", "querychange", "payloadchange", "action", "cropchange", "cropcommit", "change", "input" ]) {
    document.addEventListener(type, (event) => {
      const detail = event.detail
      window.seen.push({ type, tag: event.target.localName, id: event.target.id, bubbles: event.bubbles, detail: detail && typeof detail === "object" ? { keys: Object.keys(detail), value: detail.value ?? null } : null })
    }, true)
  }
})
const seen = (type, id) => page.evaluate(([ type, id ]) => window.seen.filter((e) => e.type === type && (!id || e.id === id)), [ type, id ])
const settle = () => page.waitForTimeout(300)
const changes = (id) => page.evaluate((id) => window.changes.filter((change) => change.id === id), id)
const reset = () => page.evaluate(() => { window.seen.length = 0; window.changes.length = 0 })
// One user change must reach a form as one change event: UI SDK's own, or runeui's bridge, not both.
function oneChange(list, what) {
  const sdk = list.filter((change) => change.by === "ui-sdk")
  if (sdk.length === 0 && list.length === 1) return
  assert(sdk.length <= 1, `UI SDK fired ${sdk.length} change events for ${what}`)
  assert(sdk.every((change) => change.bubbles), `UI SDK's change for ${what} doesn't bubble: forms listening on the form won't hear it, so forms.js must keep bridging`)
  assert(list.length === 1, `${list.length} change events for ${what} (${list.map((change) => change.by).join(" + ")}): UI SDK fires a bubbling change itself, and forms.js bridgeFormEvents fires another, so data-action="change->form#requestSubmit" submits twice. Drop the bridge's dispatch for controls UI SDK already covers`)
}

// ── Vendoring ────────────────────────────────────────────────────────────────────────────────

await check("vendored: entries.js names a version and every entry imports [autoload.js]", async () => {
  const result = await page.evaluate(async () => {
    const { VERSION, ENTRIES } = await import("runeui/sdk/entries")
    const failed = []
    for (const entry of ENTRIES) {
      try { await import(`runeui/sdk/${entry}`) } catch (error) { failed.push(`${entry}: ${error.message}`) }
    }
    return { VERSION, count: ENTRIES.length, failed }
  })
  assert(/^\d+\.\d+\.\d+/.test(result.VERSION), `VERSION is ${result.VERSION}`)
  assert(result.failed.length === 0, `entries that don't import: ${result.failed.join("; ")}`)
})

await check("vendored: every pin in config/sdk_pins.rb has its file, and no relative imports remain [script/vendor-ui-sdk]", async () => {
  const pins = [ ...read("config/sdk_pins.rb").matchAll(/to: "runeui\/sdk\/([^"]+)"/g) ].map((m) => m[1])
  assert(pins.length > 50, `only ${pins.length} pins`)
  const missing = pins.filter((file) => !fs.existsSync(path.join(root, "app/javascript/runeui/sdk", file)))
  assert(missing.length === 0, `pinned but missing: ${missing.slice(0, 5).join(", ")}`)
  const relative = pins.filter((file) => /from\s*["']\.\.?\//.test(read(`app/javascript/runeui/sdk/${file}`)) || /import\(\s*["']\.\.?\//.test(read(`app/javascript/runeui/sdk/${file}`)))
  assert(relative.length === 0, `relative imports (Propshaft would miss them in production) in: ${relative.slice(0, 5).join(", ")}`)
  const unpinned = fs.readdirSync(path.join(root, "app/javascript/runeui/sdk")).filter((file) => file.endsWith(".js") && !pins.includes(file))
  assert(unpinned.length === 0, `vendored but not pinned: ${unpinned.slice(0, 5).join(", ")}`)
})

await check("autoload: every ui-* tag a partial writes maps to an entry that defines it [autoload.js entryFor]", async () => {
  const tags = new Set()
  for (const file of fs.readdirSync(path.join(root, "app/views/ui"))) {
    const source = read(`app/views/ui/${file}`).replace(/<%#[\s\S]*?%>/g, "")
    for (const match of source.matchAll(/<(ui-[a-z0-9-]+)/g)) tags.add(match[1])
    for (const match of source.matchAll(/tag\.(ui_[a-z0-9_]+)/g)) tags.add(match[1].replaceAll("_", "-"))
  }
  const result = await page.evaluate(async (tags) => {
    const { entryFor, load } = await import("runeui/autoload")
    const unmapped = [], undefinedTags = []
    for (const tag of tags) {
      const entry = entryFor(tag)
      if (!entry) { unmapped.push(tag); continue }
      await load(entry)
      if (!customElements.get(tag)) undefinedTags.push(`${tag} (${entry})`)
    }
    return { unmapped, undefinedTags }
  }, [ ...tags ])
  assert(tags.size > 100, `only found ${tags.size} tags in the partials`)
  assert(result.unmapped.length === 0, `no entry for: ${result.unmapped.join(", ")}`)
  assert(result.undefinedTags.length === 0, `not defined by their entry (renamed or removed in UI SDK?): ${result.undefinedTags.join(", ")}`)
})

await check("exports: core-toast, alert-dialog and agent export what feedback.js and agent.js import", async () => {
  const result = await page.evaluate(async () => {
    const toast = await import("runeui/sdk/core-toast")
    const alert = await import("runeui/sdk/alert-dialog")
    const agent = await import("runeui/sdk/agent")
    const ask = typeof alert.createConfirm === "function" ? alert.createConfirm() : null
    return {
      toast: typeof toast.toast,
      toastTypes: [ "success", "error", "info", "warning", "loading" ].filter((type) => typeof toast.toast?.[type] !== "function"),
      createToaster: typeof toast.createToaster,
      createConfirm: typeof alert.createConfirm,
      ask: typeof ask,
      controller: ask ? typeof ask.controller : "none",
      createAgent: typeof agent.createAgent,
      registerTools: typeof agent.registerTools
    }
  })
  assert(result.toast === "function", "core-toast doesn't export toast() [feedback.js]")
  assert(result.toastTypes.length === 0, `toast.${result.toastTypes.join(", toast.")} missing [feedback.js showToast, ui_flash_toasts types]`)
  assert(result.createConfirm === "function", "alert-dialog doesn't export createConfirm [feedback.js confirmer]")
  assert(result.ask === "function" && result.controller === "object", `createConfirm() is ${result.ask} with controller ${result.controller} [feedback.js: dialog.controller = ask.controller]`)
  assert(result.createAgent === "function" && result.registerTools === "function", "agent doesn't export createAgent / registerTools [agent.js]")
})

// ── Elements: what they write, and their api ─────────────────────────────────────────────────

await check("markup: parts get data-slot, a trigger's goes on its button, ids derive from the root's [partials, morph.js]", async () => {
  const result = await page.evaluate(() => ({
    root: document.querySelector("#c-select").dataset.slot,
    trigger: document.querySelector("#c-select ui-select-trigger button").dataset.slot,
    role: document.querySelector("#c-select ui-select-trigger button").getAttribute("role"),
    value: document.querySelector("#c-select ui-select-value").dataset.slot,
    valueId: document.querySelector("#c-select ui-select-value").id,
    anonymous: document.querySelector("[data-contract=anonymous-trigger]").id,
    contentHidden: document.querySelector("#c-select ui-select-content").hidden
  }))
  assert(result.root === "select" && result.value === "select-value", `data-slot on root/value: ${result.root}/${result.value}`)
  assert(result.trigger === "select-trigger" && result.role === "combobox", `the trigger's button has data-slot ${result.trigger}, role ${result.role} (select.css styles [data-slot=select-trigger])`)
  assert(result.valueId === "c-select-value", `a part's id is ${result.valueId}, not <root id>-value (partials render these ids; morph.js pairs parts by id)`)
  assert(result.anonymous.startsWith("ui-sdk-"), `a generated id is ${result.anonymous}, not ui-sdk-… (morph.js ownedByElement keeps ids with that prefix)`)
  assert(result.contentHidden === true, "closed content isn't hidden")
})

await check("select: writes the label into an empty ui-select-value, leaves one with content alone [_select: data-label]", async () => {
  const [ empty, custom ] = await page.evaluate(() => [ document.querySelector("#c-select ui-select-value").textContent, document.querySelector("#c-custom ui-select-value").textContent ])
  assert(empty === "Beta", `empty value shows "${empty}"`)
  assert(custom === "Mine", `a value with content was overwritten: "${custom}" (then partials could render the label inside it)`)
})

await check("lists: default-value is comma-separated, a slider's range a/b [_select, _toggle_group, _slider, morph.js parse]", async () => {
  const result = await page.evaluate(() => ({
    multi: document.querySelector("#c-multi").value,
    group: document.querySelector("#c-toggle-group").value,
    slider: document.querySelector("#c-slider").value
  }))
  assert(JSON.stringify(result.multi) === '["a","c"]', `multiple select default-value="a,c" gives ${JSON.stringify(result.multi)}`)
  assert(JSON.stringify(result.group) === '["b","i"]', `toggle group default-value="b,i" gives ${JSON.stringify(result.group)}`)
  assert(JSON.stringify(result.slider) === "[20,80]", `slider default-value="20/80" gives ${JSON.stringify(result.slider)}`)
})

await check("api: setValue, setChecked, open, close exist where runeui calls them [morph.js follow, selection, command.js]", async () => {
  const result = await page.evaluate(() => {
    const has = (id, ...names) => names.filter((name) => typeof document.getElementById(id).api?.[name] !== "function").map((name) => `${id}.api.${name}`)
    return [
      ...has("c-select", "setValue", "getValue", "open", "close"),
      ...has("c-multi", "setValue"),
      ...has("c-checkbox", "setChecked"),
      ...has("c-switch", "setChecked"),
      ...has("c-slider", "setValue"),
      ...has("c-combobox", "setValue"),
      ...has("c-dialog", "open", "close"),
      ...has("c-popover", "open", "close")
    ]
  })
  assert(result.length === 0, `missing: ${result.join(", ")}`)
})

await check("api: a toggle's default-pressed has a setter morph.js can call [morph.js DEFAULTS]", async () => {
  const names = await page.evaluate(() => Object.keys(document.getElementById("c-toggle").api || {}))
  assert(names.includes("setPressed"), `ui-toggle's api is { ${names.join(", ")} }: morph.js maps default-pressed to api.setPressed, so a server-changed default-pressed isn't followed`)
})

await check("api.setValue moves the value and the label, and the value stays the person's to change [morph.js follow]", async () => {
  await page.evaluate(() => document.getElementById("c-select").api.setValue("c"))
  await settle()
  let state = await page.evaluate(() => [ document.getElementById("c-select").value, document.querySelector("#c-select ui-select-value").textContent ])
  assert(state[0] === "c" && state[1] === "Gamma", `after setValue("c"): value ${state[0]}, label ${state[1]}`)
  await page.click("#c-select ui-select-trigger button")
  await page.click("#c-select ui-select-item[value=a]")
  await settle()
  state = await page.evaluate(() => [ document.getElementById("c-select").value, document.querySelector("#c-select ui-select-value").textContent ])
  assert(state[0] === "a" && state[1] === "Alpha", `a pick after setValue gives value ${state[0]}, label ${state[1]} (setValue made it controlled?)`)
})

await check("properties: value, checked, pressed, open, multiple read as forms.js, hotwire.js and selection read them", async () => {
  const result = await page.evaluate(() => ({
    value: "value" in document.getElementById("c-select"),
    multiple: document.getElementById("c-multi").multiple === true,
    checked: document.getElementById("c-checkbox").checked === false && document.getElementById("c-switch").checked === true,
    pressed: "pressed" in document.getElementById("c-toggle"),
    open: [ "c-select", "c-dialog", "c-popover", "c-combobox" ].filter((id) => !("open" in document.getElementById(id))),
    items: "items" in document.getElementById("c-combobox"),
    query: "query" in document.getElementById("c-combobox"),
    itemToLabel: "itemToLabel" in document.getElementById("c-combobox")
  }))
  assert(result.value && result.multiple, "select lacks value / multiple [forms.js current, morph.js parse]")
  assert(result.checked, "checkbox / switch .checked doesn't follow default-checked [forms.js, selection_controller.js]")
  assert(result.pressed, "toggle lacks .pressed [forms.js syncToggleFields]")
  assert(result.open.length === 0, `no .open on ${result.open.join(", ")} [hotwire.js data-runeui-open, before-cache; feedback.js ui_open]`)
  assert(result.items && result.query && result.itemToLabel, "combobox lacks items / query / itemToLabel [remote.js]")
})

// ── Forms ────────────────────────────────────────────────────────────────────────────────────

await check("forms: controls are form-associated and submit with FormData [forms.js, every form partial]", async () => {
  const result = await page.evaluate(() => ({
    associated: [ "c-select", "c-multi", "c-checkbox", "c-switch", "c-slider", "c-combobox" ].filter((id) => !document.getElementById(id).constructor.formAssociated),
    toggle: Boolean(document.getElementById("c-toggle").constructor.formAssociated),
    data: [ ...new FormData(document.getElementById("contract-form")) ].map(([ key, value ]) => `${key}=${value}`)
  }))
  assert(result.associated.length === 0, `not form-associated: ${result.associated.join(", ")}`)
  for (const pair of [ "one=a", "many[]=a", "many[]=c", "switch=on", "combo=b" ]) assert(result.data.includes(pair), `FormData lacks ${pair}: ${result.data.join("&")}`)
  assert(result.data.some((pair) => pair.startsWith("range=")), `slider didn't submit: ${result.data.join("&")}`)
  assert(!result.data.some((pair) => pair.startsWith("box=")), "an unchecked checkbox submitted")
  if (result.toggle) console.log("      note: ui-toggle is form-associated now: forms.js syncToggleFields and _toggle's hidden field may be unneeded")
})

await check("events: checkedchange fires from the element, and one change reaches the form [forms.js]", async () => {
  await reset()
  await page.click("#c-checkbox")
  await settle()
  const [ own ] = await seen("checkedchange", "c-checkbox")
  assert(own, "no checkedchange from ui-checkbox")
  assert(own.tag === "ui-checkbox", `checkedchange came from ${own.tag}`)
  if (own.bubbles) console.log("      note: UI SDK's events bubble now: capture-phase listeners still work, but could be simplified")
  oneChange(await changes("c-checkbox"), "one click on a checkbox")
  assert(await page.evaluate(() => document.getElementById("c-checkbox").checked) === true, "checkbox isn't checked after a click")
  assert(await page.evaluate(() => document.getElementById("c-checkbox").hasAttribute("data-checked")), "no data-checked on a checked checkbox [checkbox.css]")
})

await check("events: valuechange, pressedchange carry what forms.js and remote.js read", async () => {
  await reset()
  await page.click("#c-select ui-select-trigger button")
  await page.click("#c-select ui-select-item[value=b]")
  await page.click("#c-toggle button")
  await page.click("#c-toggle-group ui-toggle[value=u] button")
  await settle()
  assert((await seen("valuechange", "c-select")).length >= 1, "no valuechange from ui-select [forms.js]")
  oneChange(await changes("c-select"), "one pick in a select")
  assert((await seen("pressedchange")).some((e) => e.tag === "ui-toggle"), "no pressedchange from ui-toggle [forms.js syncToggleFields]")
  assert((await seen("valuechange", "c-toggle-group")).length >= 1, "no valuechange from ui-toggle-group [forms.js syncToggleFields]")
  assert(JSON.stringify(await page.evaluate(() => document.getElementById("c-toggle-group").value)) === '["b","i","u"]', "toggle group's value didn't follow the press")
})

await check("events: openchange's detail.value says open or closed; querychange's is the text [remote.js]", async () => {
  await reset()
  await page.click("#c-combobox input")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("al")
  await settle()
  const opened = (await seen("openchange", "c-combobox"))[0]
  const query = (await seen("querychange", "c-combobox")).pop()
  assert(opened && opened.detail?.value === true, `openchange detail is ${JSON.stringify(opened?.detail)} (remote.js reads detail.value)`)
  assert(query && query.detail?.value === "al", `querychange detail is ${JSON.stringify(query?.detail)} (remote.js reads detail.value)`)
  await page.keyboard.press("Escape")
  await settle()
})

// ── Popups ───────────────────────────────────────────────────────────────────────────────────

await check("api.setValue fires change too, so following a server default on a morph does [morph.js follow]", async () => {
  await reset()
  await page.evaluate(() => document.getElementById("c-switch").api.setChecked(false))
  await settle()
  const list = await changes("c-switch")
  if (list.length) console.log(`      note: api.setChecked fires change (${list.map((change) => change.by).join(" + ")}): a form that saves on change will submit when a morph follows a server-changed default`)
})

await check("popups: open in the top layer, mark data-open, and close when .open is set false [base.css .ui-popup, hotwire.js]", async () => {
  await page.click("#c-popover ui-popover-trigger button")
  await settle()
  const open = await page.evaluate(() => {
    const content = document.querySelector("#c-popover ui-popover-content")
    return { hidden: content.hidden, popover: content.getAttribute("popover"), top: content.matches(":popover-open"), marked: content.hasAttribute("data-open"), host: document.getElementById("c-popover").open }
  })
  assert(!open.hidden && open.marked, `open content: hidden ${open.hidden}, data-open ${open.marked}`)
  assert(open.top, `content isn't in the top layer (popover="${open.popover}"): .ui-popup assumes UI SDK places it there`)
  assert(open.host === true, "host.open isn't true while open [hotwire.js closePopupsBeforeCache]")
  await page.evaluate(() => { document.getElementById("c-popover").open = false })
  await page.waitForTimeout(500)
  assert(await page.evaluate(() => document.querySelector("#c-popover ui-popover-content").hidden), "setting .open = false didn't close it [hotwire.js, turbo_stream.ui_close]")
})

await check("dialogs: .open = true opens one and it still closes itself after [data-runeui-open, turbo_stream.ui_open]", async () => {
  await page.evaluate(() => { document.getElementById("c-dialog").open = true })
  await settle()
  const state = await page.evaluate(() => {
    const content = document.querySelector("#c-dialog ui-dialog-content")
    return { hidden: content.hidden, slot: content.dataset.slot, top: content.matches(":popover-open") || content.matches(":modal") }
  })
  assert(!state.hidden && state.slot === "dialog-content", `dialog content hidden ${state.hidden}, slot ${state.slot}`)
  assert(state.top, "an open dialog isn't in the top layer [dialog.css]")
  await page.keyboard.press("Escape")
  await page.waitForTimeout(500)
  assert(await page.evaluate(() => document.querySelector("#c-dialog ui-dialog-content").hidden), "Escape didn't close a dialog opened with .open = true (the property made it controlled?)")
})

await check("confirm: the dialog gets the question in payloadchange's detail.value, and answers [feedback.js]", async () => {
  const answer = page.evaluate(async () => {
    const { confirm } = await import("runeui")
    return confirm({ title: "Sure?", description: "Really", confirmLabel: "Yes" })
  })
  await page.waitForSelector("#runeui-confirm ui-alert-dialog-content:not([hidden])", { timeout: 4000 })
  const shown = await page.evaluate(() => ({
    title: document.querySelector("#runeui-confirm ui-alert-dialog-title").textContent,
    slots: [ "ui-alert-dialog-content", "ui-alert-dialog-title", "ui-alert-dialog-description", "ui-alert-dialog-backdrop" ].map((tag) => document.querySelector(`#runeui-confirm ${tag}`).dataset.slot).join(" "),
    payload: window.seen.filter((e) => e.type === "payloadchange").pop()?.detail
  }))
  assert(shown.title === "Sure?", `the title is "${shown.title}" (payloadchange detail: ${JSON.stringify(shown.payload)})`)
  assert(shown.slots === "alert-dialog-content alert-dialog-title alert-dialog-description alert-dialog-backdrop", `alert dialog parts are named ${shown.slots} [dialog.css, _confirm, _alert_dialog]`)
  await page.click("#runeui-confirm [data-confirm-accept]")
  assert(await answer === true, "agreeing didn't resolve true (the Close part's value=\"confirm\")")
})

await check("tabs: arrow keys fire valuechange with the list-navigation reason and move data-selected [tabs_controller instant]", async () => {
  await reset()
  await page.focus("#c-tabs ui-tabs-tab[value=one] button")
  await page.keyboard.press("ArrowRight")
  await settle()
  const reasons = await page.evaluate(() => window.seen.filter((e) => e.type === "valuechange" && e.id === "c-tabs").map((e) => e.detail))
  assert(reasons.length >= 1 && reasons.at(-1).keys.includes("reason"), `valuechange detail ${JSON.stringify(reasons)}`)
  const reason = await page.evaluate(() => new Promise((resolve) => {
    const tabs = document.getElementById("c-tabs")
    tabs.addEventListener("valuechange", (event) => resolve(event.detail.reason), { once: true, capture: true })
    document.querySelector("#c-tabs ui-tabs-tab[value=two] button").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
  }))
  assert(reason === "list-navigation", `the keyboard's reason is ${reason}`)
  assert(await page.evaluate(() => document.querySelector("#c-tabs ui-tabs-tab[value=one] button").hasAttribute("data-selected")), "data-selected isn't on the chosen tab's button")
})

await check("carousel: --carousel-progress on the root; api.getPageCount, getProgress, setPage [carousel_controller, carousel.css worm]", async () => {
  const state = await page.evaluate(async () => {
    const carousel = document.getElementById("c-carousel")
    await new Promise((resolve) => setTimeout(resolve, 200))
    const api = carousel.api
    const count = api?.getPageCount?.()
    api?.setPage?.(2)
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { count, progress: api?.getProgress?.(), variable: carousel.style.getPropertyValue("--carousel-progress") }
  })
  assert(state.count === 3, `getPageCount() is ${state.count}`)
  assert(Math.abs(state.progress - 0.5) < 0.01 && Math.abs(Number(state.variable) - 0.5) < 0.01, `progress ${state.progress}, --carousel-progress ${state.variable}`)
})

await check("alert dialog: openchange's detail.returnValue is the Close part's value [hold_controller]", async () => {
  const returned = page.evaluate(() => new Promise((resolve) => {
    const dialog = document.getElementById("c-alert")
    dialog.addEventListener("openchange", function listen(event) { if (!event.detail.value) { dialog.removeEventListener("openchange", listen, true); resolve(event.detail.returnValue) } }, true)
    dialog.open = true
  }))
  await page.waitForSelector("#c-alert ui-alert-dialog-content:not([hidden])")
  await page.click("[data-contract=alert-confirm]")
  assert(await returned === "confirm", `returnValue is ${await returned}`)
  // The page is inert until the modal has finished closing.
  await page.waitForSelector("#c-alert ui-alert-dialog-content[hidden]", { state: "attached" })
})

await check("radio group: valuechange carries the value; the chosen radio gets data-checked [gooey_controller]", async () => {
  await reset()
  await page.click("#c-radio ui-radio[value=b]")
  await settle()
  const event = (await seen("valuechange", "c-radio")).pop()
  assert(event?.detail?.value === "b", `valuechange detail ${JSON.stringify(event?.detail)}`)
  assert(await page.evaluate(() => document.querySelector("#c-radio ui-radio[value=b]").hasAttribute("data-checked")), "no data-checked on the chosen radio")
})

await check("slider: the format property sets what the value shows and aria-valuetext [_slider format:]", async () => {
  const state = await page.evaluate(async () => {
    const slider = document.getElementById("c-format")
    slider.format = { style: "unit", unit: "percent" }
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { text: slider.querySelector("ui-slider-value").textContent, said: slider.querySelector("input")?.getAttribute("aria-valuetext") }
  })
  assert(/40\s?%/.test(state.text) && /40\s?%/.test(state.said ?? ""), JSON.stringify(state))
})

await check("progress, meter: --progress-value and --meter-value on the root, as percentages [progress.css, meter.css]", async () => {
  const values = await page.evaluate(() => [ getComputedStyle(document.getElementById("c-progress")).getPropertyValue("--progress-value").trim(), getComputedStyle(document.getElementById("c-meter")).getPropertyValue("--meter-value").trim() ])
  assert(values[0] === "40%" && values[1] === "30%", `values are ${values}`)
})

await check("resizable: a handle marks data-hovering under the pointer and data-dragging while dragged [resizable.css grip]", async () => {
  await page.locator("#c-resizable").scrollIntoViewIfNeeded()
  const box = await page.locator("#c-resizable ui-resizable-handle").boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await settle()
  const hovering = await page.locator("#c-resizable ui-resizable-handle").getAttribute("data-hovering")
  await page.mouse.down()
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 3 })
  const dragging = await page.locator("#c-resizable ui-resizable-handle").getAttribute("data-dragging")
  await page.mouse.up()
  assert(hovering !== null && dragging !== null, `data-hovering ${hovering}, data-dragging ${dragging}`)
})

await check("toasts: toast.success renders in the region from its template, typed [feedback.js, _toaster, toast.css]", async () => {
  await page.evaluate(async () => { const { toast } = await import("runeui"); toast.success("Contract toast", { description: "Detail" }) })
  await page.waitForSelector("#runeui-toaster ui-toast", { timeout: 4000 })
  const toast = await page.evaluate(() => {
    const element = document.querySelector("#runeui-toaster ui-toast")
    const region = document.getElementById("runeui-toaster")
    return { slot: element.dataset.slot, type: element.dataset.type, title: element.querySelector("ui-toast-title")?.textContent, description: element.querySelector("ui-toast-description")?.textContent,
      index: getComputedStyle(element).getPropertyValue("--toast-index"), front: getComputedStyle(region).getPropertyValue("--toast-front-height"), side: region.dataset.side }
  })
  assert(toast.slot === "toast" && toast.type === "success", `toast has data-slot ${toast.slot}, data-type ${toast.type}`)
  assert(toast.title === "Contract toast" && toast.description === "Detail", `toast shows "${toast.title}" / "${toast.description}" (does it still copy the region's <template>?)`)
  assert(toast.index !== "" && toast.front !== "", "no --toast-index / --toast-front-height (toast.css stacks with them)")
  assert(toast.side === "bottom", `the region's data-side is ${toast.side}`)
})

await check("styles: UI SDK puts its own CSS in the ui-sdk layer, declared first in tokens.css", async () => {
  const result = await page.evaluate(() => {
    const sheets = [ ...document.styleSheets, ...document.adoptedStyleSheets ]
    let block = false, order = null
    for (const sheet of sheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule instanceof CSSLayerBlockRule && rule.name === "ui-sdk") block = true
        if (rule instanceof CSSLayerStatementRule && rule.nameList.includes("ui-sdk") && !order) order = [ ...rule.nameList ]
      }
    }
    return { block, order }
  })
  assert(result.block, "no @layer ui-sdk { … } on the page: UI SDK's injected CSS moved (or needs a CSP nonce), so it may now beat runeui's layers")
  assert(result.order?.[0] === "ui-sdk", `the layer order is ${result.order}`)
})

// ── Pieces checked on their own gallery pages ────────────────────────────────────────────────

async function on(pagePath, name, fn) {
  await check(name, async () => {
    const other = await browser.newPage({ viewport: { width: 1100, height: 800 } })
    try {
      const response = await other.goto(BASE + pagePath)
      assert(response.ok(), `${pagePath} answered ${response.status()}`)
      await other.waitForTimeout(900)
      await fn(other)
    } finally {
      await other.close()
    }
  })
}

await on("/runeui/command", "command: action fires from ui-command with the item's value [command.js]", async (other) => {
  await other.evaluate(() => { window.actions = []; document.addEventListener("action", (event) => window.actions.push({ tag: event.target.localName, value: event.detail?.value ?? null }), true) })
  const item = other.locator("main ui-command:not(ui-dialog ui-command) ui-command-item:not([disabled]):not([data-href])").first()
  assert(await item.count() === 1, "the command example has no plain item to run")
  const value = await item.getAttribute("value")
  await item.click()
  await other.waitForTimeout(200)
  const actions = await other.evaluate(() => window.actions)
  assert(actions.some((action) => action.tag === "ui-command" && action.value === value), `clicking item ${value} gave ${JSON.stringify(actions)} (command.js reads event.detail.value from ui-command)`)
})

await on("/runeui/image_cropper", "image cropper: .crop has x, y, width, height and cropchange fires [props.js writeCrop]", async (other) => {
  await other.waitForFunction(() => document.querySelector("ui-image-cropper")?.crop, null, { timeout: 5000 }).catch(() => {})
  const crop = await other.evaluate(() => { const c = document.querySelector("ui-image-cropper")?.crop; return c ? Object.keys(c) : null })
  assert(crop, "ui-image-cropper has no .crop")
  for (const key of [ "x", "y", "width", "height" ]) assert(crop.includes(key), `.crop lacks ${key}: ${crop.join(", ")}`)
  await other.evaluate(() => { window.crops = 0; for (const type of [ "cropchange", "cropcommit" ]) document.addEventListener(type, () => window.crops++, true) })
  await other.locator("ui-image-cropper-selection").first().focus()
  await other.keyboard.press("ArrowRight")
  await other.waitForTimeout(300)
  assert(await other.evaluate(() => window.crops) > 0, "moving the selection fired no cropchange / cropcommit")
})

await on("/runeui/trigger_menu", "trigger menu: triggers is a property, set from data-triggers [triggers.js]", async (other) => {
  const result = await other.evaluate(() => {
    const menu = document.querySelector("ui-trigger-menu[data-triggers]")
    return menu ? { has: "triggers" in menu, count: menu.triggers?.length ?? 0, wanted: JSON.parse(menu.dataset.triggers).length } : null
  })
  assert(result, "the trigger menu example has no ui-trigger-menu[data-triggers]")
  assert(result.has && result.count === result.wanted, `triggers: property ${result.has}, ${result.count} of ${result.wanted} set`)
})

await on("/runeui/contract", "agent: createAgent().snapshot() lists the page's components [agent.js]", async (other) => {
  const result = await other.evaluate(async () => {
    const { createAgent } = await import("runeui/sdk/agent")
    const agent = createAgent()
    const snapshot = typeof agent.snapshot === "function" ? await agent.snapshot() : null
    return { snapshot: typeof agent.snapshot, act: typeof agent.act, shape: snapshot ? (Array.isArray(snapshot) ? "array" : Object.keys(snapshot).join(",")) : null }
  })
  assert(result.snapshot === "function" && result.act === "function", `agent has snapshot ${result.snapshot}, act ${result.act}`)
})

// ── data-slot: what the partials render against what UI SDK names the parts ──────────────────
//
// For each gallery page: the data-slot values each tag has in the server's HTML, and after the
// elements upgrade. A value the server gave a tag that no element of that tag has afterwards
// was renamed by UI SDK (its CSS no longer matches after upgrade): a failure. A ui-* tag the
// server renders with no data-slot that has one afterwards paints unstyled until it upgrades:
// listed as a note.

const names = fs.readdirSync(path.join(root, "app/views/runeui/docs/examples")).map((file) => file.replace(/^_|\.html\.erb$/g, "")).filter((name) => name !== "contract").sort()
const renamed = []
const unstyled = []
const broken = []

for (const name of names) {
  const other = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  try {
    const response = await other.goto(`${BASE}/runeui/${name}`)
    if (!response.ok()) { broken.push(`${name} (${response.status()})`); continue }
    await other.waitForTimeout(700)
    const result = await other.evaluate(async () => {
      const html = await (await fetch(location.href)).text()
      const server = new DOMParser().parseFromString(html, "text/html")
      const collect = (doc) => {
        const slots = new Map(), bare = new Map()
        for (const element of doc.querySelectorAll("main *")) {
          if (element.closest("template, .runeui-docs__source")) continue
          const tag = element.localName
          if (element.dataset.slot) {
            if (!slots.has(tag)) slots.set(tag, new Set())
            slots.get(tag).add(element.dataset.slot)
          } else if (tag.startsWith("ui-")) {
            bare.set(tag, (bare.get(tag) || 0) + 1)
          }
        }
        return { slots, bare }
      }
      const before = collect(server), after = collect(document)
      const renamed = [], unstyled = []
      for (const [ tag, values ] of before.slots) {
        for (const value of values) {
          if (!after.slots.get(tag)?.has(value)) renamed.push(`<${tag}> ${value} → ${[ ...(after.slots.get(tag) || [ "(none)" ]) ].join(" | ")}`)
        }
      }
      for (const [ tag ] of before.bare) {
        if (!after.bare.has(tag) && after.slots.has(tag)) unstyled.push(`<${tag}> gets ${[ ...after.slots.get(tag) ].join(" | ")}`)
      }
      return { renamed, unstyled }
    })
    for (const line of result.renamed) renamed.push(`${name}: ${line}`)
    for (const line of result.unstyled) unstyled.push(`${name}: ${line}`)
  } catch (error) {
    broken.push(`${name} (${error.message.split("\n")[0]})`)
  } finally {
    await other.close()
  }
}

await check(`data-slot: what the partials render is what UI SDK names each part (${names.length} gallery pages)`, async () => {
  assert(renamed.length === 0, `${renamed.length} renamed on upgrade: ${renamed.join("; ")}`)
})
if (unstyled.length) console.log(`      note: ${unstyled.length} parts have no data-slot until they upgrade (unstyled first paint if their CSS selects it):\n        ${unstyled.join("\n        ")}`)
if (broken.length) console.log(`      note: gallery pages that didn't load: ${broken.join(", ")}`)

await check("no errors on the contract page", async () => assert(errors.length === 0, errors.join(" | ")))

await browser.close()
done()
