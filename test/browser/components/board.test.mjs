// The board: drags (mouse and touch), keys, the request a move sends, a refused move, cards a
// stream adds and a morph. Uses the helpers directly, not component(): the refused move's 422
// is a console error this test means to cause.
import { open, check, assert, done } from "../helpers.mjs"

// The fields of a multipart body, as an object.
function fields(body) {
  return Object.fromEntries([ ...body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g) ].map((match) => [ match[1], match[2] ]))
}

console.log("board")
for (const scheme of [ "light", "dark" ]) {
  const { browser, page, errors } = await open("/runeui/board", { colorScheme: scheme })
  await page.waitForTimeout(600)
  if (scheme === "light") await behaviour(page)
  else if (process.env.SHOTS) {
    // Mid-drag, for the look of the ghost and the line.
    const from = await page.locator("#board-card-4").boundingBox()
    const to = await page.locator("#board-card-2").boundingBox()
    await page.mouse.move(from.x + 40, from.y + 20)
    await page.mouse.down()
    await page.mouse.move(from.x + 50, from.y + 30, { steps: 2 })
    await page.mouse.move(to.x + 60, to.y + 6, { steps: 5 })
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/board-${scheme}.png`, fullPage: true })
  await check(`${scheme}: no errors`, async () => {
    const real = errors.filter((error) => !error.includes("422"))
    assert(real.length === 0, real.join(" | "))
  })
  await browser.close()
}
done()

async function behaviour(page) {
  const sent = []
  let fail = false
  await page.route("**/runeui/board/echo", async (route) => {
    const request = route.request()
    sent.push({ method: request.method(), accept: request.headers()["accept"], csrf: request.headers()["x-csrf-token"], ...fields(request.postData() || "") })
    if (fail) return route.fulfill({ status: 422, body: "no" })
    return route.continue()
  })
  const order = (column) => page.evaluate((column) => [ ...document.querySelectorAll(`#board-list-${column} [data-slot=board-card]`) ].map((card) => card.dataset.card).join(","), column)
  const count = (column) => page.locator(`#board-column-${column} [data-slot=board-column-count]`).innerText()
  const centre = async (selector) => { const box = await page.locator(selector).boundingBox(); return { x: box.x + box.width / 2, y: box.y + box.height / 2, box } }
  const drag = async (from, x, y) => {
    const start = await centre(from)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 8, start.y + 8, { steps: 2 })
    await page.mouse.move(x, y, { steps: 6 })
  }

  await check("columns count their cards", async () => {
    assert(await count("planned") === "3" && await count("doing") === "2" && await count("done") === "0", "counts are off")
    assert(await page.locator("#board-column-done [data-slot=board-empty]").isVisible(), "the empty column doesn't say so")
  })

  await check("dragging shows a copy and a line where it will land", async () => {
    const target = await centre("#board-card-2")
    await drag("#board-card-4", target.x, target.box.y + 4)
    assert(await page.locator("[data-slot=board-ghost]").count() === 1, "no ghost")
    assert(await page.evaluate(() => document.querySelector("[data-slot=board-drop]")?.nextElementSibling?.id) === "board-card-2", "the line isn't before card 2")
    assert(await page.locator("#board-column-planned").getAttribute("data-drop") !== null, "the column isn't marked")
  })

  await check("dropping moves the card and sends card, column and before", async () => {
    await page.mouse.up()
    await page.waitForTimeout(300)
    assert(await order("planned") === "1,4,2,3", `planned is ${await order("planned")}`)
    assert(await order("doing") === "5", `doing is ${await order("doing")}`)
    assert(await count("planned") === "4" && await count("doing") === "1", "counts didn't follow")
    assert(await page.locator("[data-slot=board-ghost], [data-slot=board-drop]").count() === 0, "the ghost or line was left behind")
    const request = sent.at(-1)
    assert(sent.length === 1, `${sent.length} requests`)
    assert(request.card === "4" && request.column === "planned" && request.before === "2", JSON.stringify(request))
    assert(request.method === "POST" && request.accept.includes("text/vnd.turbo-stream.html") && request.csrf, JSON.stringify(request))
  })

  await check("the server's Turbo Streams are rendered, and a drag isn't a click", async () => {
    await page.waitForSelector("[data-slot=toast] >> text=Received", { timeout: 3000 })
    assert(!page.url().includes("#task-4"), "the drag followed the card's link")
    // …even when the pointer comes up over the card's own link.
    const title = await centre("#board-card-5 a")
    await page.mouse.move(title.x, title.y)
    await page.mouse.down()
    await page.mouse.move(title.x + 10, title.y + 2, { steps: 3 })
    await page.mouse.move(title.x, title.y, { steps: 3 })
    await page.mouse.up()
    await page.waitForTimeout(100)
    assert(!page.url().includes("#task-5"), "a drag that ended on the link followed it")
  })

  await check("a card drops into an empty column", async () => {
    const target = await centre("#board-list-done")
    await drag("#board-card-6", target.x, target.y)
    await page.mouse.up()
    await page.waitForTimeout(200)
    assert(await order("done") === "6" && await count("done") === "1", `done is ${await order("done")}`)
    assert(sent.at(-1).column === "done" && sent.at(-1).before === "", JSON.stringify(sent.at(-1)))
    assert(await page.locator("#board-column-done [data-slot=board-empty]").isHidden(), "still says it's empty")
  })

  await check("Escape cancels a drag", async () => {
    const before = sent.length
    const target = await centre("#board-list-review")
    await drag("#board-card-1", target.x, target.y)
    await page.keyboard.press("Escape")
    await page.mouse.up()
    assert(await order("planned") === "1,4,2,3" && sent.length === before, "it moved anyway")
  })

  await check("arrows go from card to card; Shift with an arrow moves the card and says so", async () => {
    await page.focus("#board-card-1")
    await page.keyboard.press("ArrowDown")
    assert(await page.evaluate(() => document.activeElement.id) === "board-card-4", "ArrowDown didn't move focus")
    await page.keyboard.press("Shift+ArrowDown")
    await page.waitForTimeout(150)
    assert(await order("planned") === "1,2,4,3", `planned is ${await order("planned")}`)
    assert(sent.at(-1).card === "4" && sent.at(-1).before === "3", JSON.stringify(sent.at(-1)))
    await page.keyboard.press("Shift+ArrowRight")
    await page.waitForTimeout(150)
    assert((await order("doing")).split(",").includes("4"), `doing is ${await order("doing")}`)
    assert(await page.evaluate(() => document.activeElement.id) === "board-card-4", "focus left the card")
    const said = await page.locator("[data-runeui--board-target=status]").innerText()
    assert(/moved to In progress, \d of \d/.test(said), said)
  })

  await check("Enter opens the card, as a click does", async () => {
    // Recorded, not followed: a visit would draw the board again from the server.
    await page.evaluate(() => {
      window.followed = []
      document.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-slot=board-card-title]")
        if (link) { window.followed.push(link.getAttribute("href")); event.preventDefault() }
      })
    })
    await page.focus("#board-card-5")
    await page.keyboard.press("Enter")
    await page.click("#board-card-2 a")
    assert((await page.evaluate(() => window.followed.join(","))) === "#task-5,#task-2", await page.evaluate(() => window.followed.join(",")))
  })

  await check("a refused move puts the card back and says so", async () => {
    fail = true
    const was = await order("planned")
    await page.focus("#board-card-1")
    await page.keyboard.press("Shift+ArrowDown")
    await page.waitForSelector("[data-slot=toast] >> text=Couldn't move", { timeout: 3000 })
    assert(await order("planned") === was, `planned is ${await order("planned")}`)
    fail = false
  })

  await check("a finger picks a card up by pressing and holding", async () => {
    const before = sent.length
    await page.evaluate(async () => {
      const card = document.querySelector("#board-card-3")
      const from = card.getBoundingClientRect()
      const to = document.querySelector("#board-list-review").getBoundingClientRect()
      const fire = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", button: 0, isPrimary: true, clientX: x, clientY: y }))
      fire(card, "pointerdown", from.left + 20, from.top + 10)
      await new Promise((resolve) => setTimeout(resolve, 320))
      fire(document, "pointermove", to.left + 30, to.top + 4)
      fire(document, "pointerup", to.left + 30, to.top + 4)
    })
    await page.waitForTimeout(200)
    assert((await order("review")).split(",")[0] === "3", `review is ${await order("review")}`)
    assert(sent.length === before + 1 && sent.at(-1).card === "3" && sent.at(-1).column === "review", JSON.stringify(sent.at(-1)))
  })

  await check("a finger that moves straight away scrolls instead", async () => {
    const before = sent.length
    await page.evaluate(() => {
      const card = document.querySelector("#board-card-2")
      const from = card.getBoundingClientRect()
      const fire = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 8, pointerType: "touch", button: 0, isPrimary: true, clientX: x, clientY: y }))
      fire(card, "pointerdown", from.left + 20, from.top + 10)
      fire(document, "pointermove", from.left + 20, from.top + 60)
      fire(document, "pointerup", from.left + 20, from.top + 60)
    })
    assert(sent.length === before && await page.locator("[data-slot=board-ghost]").count() === 0, "it dragged")
  })

  await check("a card a stream adds is counted and movable", async () => {
    await page.evaluate(() => Turbo.renderStreamMessage(`<turbo-stream action="append" target="board-list-done"><template><li id="board-card-9" tabindex="0" data-slot="board-card" data-card="9" data-title="Send the invoice" data-runeui--board-target="card" data-action="pointerdown->runeui--board#press keydown->runeui--board#key"><div data-slot="board-card-title">Send the invoice</div></li></template></turbo-stream>`))
    await page.waitForSelector("#board-card-9")
    await page.waitForTimeout(100)
    assert(await count("done") === String((await order("done")).split(",").length), "count didn't follow the stream")
    await page.focus("#board-card-9")
    await page.keyboard.press("Shift+ArrowUp")
    await page.waitForTimeout(150)
    assert((await order("done")) === "9,6" && sent.at(-1).card === "9" && sent.at(-1).before === "6", `done is ${await order("done")}, sent ${JSON.stringify(sent.at(-1))}`)
  })

  await check("a morph keeps the board working", async () => {
    await page.evaluate(() => Turbo.session.refresh(document.baseURI))
    await page.waitForTimeout(800)
    // The server's board again: every card back where the server has it, counted, and movable.
    assert(await order("planned") === "1,2,3" && await count("planned") === "3", `planned is ${await order("planned")}, ${await count("planned")}`)
    assert(await order("doing") === "4,5" && await order("review") === "6" && await count("done") === "0", `doing ${await order("doing")}, review ${await order("review")}, done ${await count("done")}`)
    await page.focus("#board-card-1")
    await page.keyboard.press("Shift+ArrowDown")
    await page.waitForTimeout(150)
    assert(await order("planned") === "2,1,3", `planned is ${await order("planned")}`)
  })
}
