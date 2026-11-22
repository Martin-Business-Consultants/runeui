import { Controller } from "@hotwired/stimulus"

// A board of columns and cards (ui :board, :board_column, :board_card). A card is dragged
// between columns and up and down one, by mouse, pen or touch (press and hold on a touch
// screen, so the board still scrolls), with a line showing where it will land; from the
// keyboard, the arrows move between cards and Shift with an arrow moves the card you're on,
// each move read out. (UI SDK's own drag-and-drop behaviours aren't among its web components'
// exports, so this is pointer events; not the HTML5 drag API, which touch doesn't have.)
//
// A move shows at once and sends one request: PATCH (methodValue) to the card's data-url, else
// its column's, else the board's urlValue, with card, column and before (the id of the card it
// now sits before, blank at the end), asking for Turbo Streams, which are rendered when they
// come. If the request fails the card goes back and a toast says so. With no URL anywhere
// nothing is sent; listen for runeui--board:move (cancelable) and runeui--board:moved instead.
//
// Cards and columns are targets, so cards a stream adds or a morph brings are draggable and
// counted with nothing more to do.
//
// A url may hold __card__, which becomes the card's id. With Turbo on the page the request goes
// through Turbo's fetch (its X-Turbo-Request-Id), so the page skips a refresh it broadcasts back.
// A column with data-total holds only some of its cards: its count is that total, moved by one
// as cards leave and land. A list's data-slot="board-more" item (the next page) stays last.
// A column marked data-collapsible folds and opens from its title (toggle), kept per browser
// when the board has an id, and left alone by a morph (keep).
//
// The feel of a drag (after microinteractions.dev's drag reorder): the lifted card follows the
// pointer with no transition; its column closes up behind it; the line glides to each new place
// (150ms) and the cards beside it part a little, the nearest first and furthest least (8px ×
// 0.7ⁿ, a stagger falling off the same way, for cards at rest); dropped, the card glides into its
// slot (250ms on the ease-out) as everything settles together. Nothing overshoots. The keyboard
// moves at once, and reduced motion drops every glide.
const NUDGE = 8
const FALLOFF = 0.7
const STAGGER = 24
const SETTLE = 250

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

export default class extends Controller {
  static targets = [ "column", "card", "status" ]
  static values = {
    url: String,
    method: { type: String, default: "patch" },
    hold: { type: Number, default: 250 }
  }

  connect() {
    this.restoreFolds()
    this.onMove = this.pointerMove.bind(this)
    this.onUp = this.pointerUp.bind(this)
    this.onCancel = this.cancel.bind(this)
    this.onKey = (event) => { if (event.key === "Escape") this.cancel() }
    this.onTouchMove = (event) => { if (this.drag?.active) event.preventDefault() }
    this.count()
  }

  disconnect() { this.cancel() }

  columnTargetConnected(column) { this.restoreFolds(column) }
  cardTargetConnected() { this.queueCount() }
  cardTargetDisconnected() { this.queueCount() }

  // pointerdown->runeui--board#press on a card
  press(event) {
    if (event.button !== 0 || this.drag) return
    if (event.target.closest("button, input, select, textarea, [contenteditable], [data-board-no-drag]")) return
    const card = event.currentTarget
    const touch = event.pointerType === "touch"
    this.drag = { card, id: event.pointerId, x: event.clientX, y: event.clientY, touch, active: false }
    if (touch) this.drag.timer = setTimeout(() => this.start(), this.holdValue)
    document.addEventListener("pointermove", this.onMove)
    document.addEventListener("pointerup", this.onUp)
    document.addEventListener("pointercancel", this.onCancel)
    document.addEventListener("keydown", this.onKey)
    document.addEventListener("touchmove", this.onTouchMove, { passive: false })
  }

  pointerMove(event) {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.id) return
    const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
    if (!drag.active) {
      // A finger that moves before the hold is scrolling; a mouse that moves is dragging.
      if (drag.touch) { if (moved > 8) this.cancel() }
      else if (moved > 4) this.start()
      if (!drag.active) return
    }
    event.preventDefault()
    drag.px = event.clientX
    drag.py = event.clientY
    drag.ghost.style.translate = `${event.clientX - drag.offsetX}px ${event.clientY - drag.offsetY}px`
    this.place(event.clientX, event.clientY)
    this.autoScroll()
  }

  start() {
    const drag = this.drag
    if (!drag || drag.active) return
    const card = drag.card
    const box = card.getBoundingClientRect()
    drag.active = true
    drag.offsetX = drag.x - box.left
    drag.offsetY = drag.y - box.top
    drag.home = { parent: card.parentElement, next: card.nextElementSibling }

    const ghost = card.cloneNode(true)
    ghost.removeAttribute("id")
    ghost.removeAttribute("data-runeui--board-target")
    ghost.setAttribute("data-slot", "board-ghost")
    ghost.setAttribute("aria-hidden", "true")
    // Set from script (CSSOM), not a style attribute, so a strict style-src leaves it alone.
    ghost.style.width = `${box.width}px`
    ghost.style.translate = `${box.left}px ${box.top}px`
    document.body.append(ghost)
    drag.ghost = ghost

    const line = document.createElement("li")
    line.setAttribute("data-slot", "board-drop")
    line.setAttribute("aria-hidden", "true")
    drag.line = line
    card.before(line)

    // The card leaves its column, which closes up behind it.
    this.flip(this.cardsIn(this.columnOf(card)).filter((other) => other !== card), () => card.setAttribute("data-dragging", ""))
    this.element.setAttribute("data-dragging", "")
    getSelection()?.removeAllRanges()
  }

  // Moves elements (mutate) and glides them from where they were to where they land, by translate.
  flip(elements, mutate) {
    const before = elements.map((element) => element.getBoundingClientRect().top)
    mutate()
    if (reduced()) return
    elements.forEach((element, index) => {
      const delta = before[index] - element.getBoundingClientRect().top
      if (Math.abs(delta) < 0.5) return
      element.animate([ { translate: `0 ${delta}px` }, { translate: "0 0" } ], { duration: SETTLE, easing: "cubic-bezier(0.23, 1, 0.32, 1)" })
    })
  }

  // The line glides to its new place in its column (150ms), or fades in where it first appears.
  moveLine(insert) {
    const drag = this.drag
    const line = drag.line
    const list = line.parentElement
    const from = line.getBoundingClientRect().top
    insert()
    if (!reduced()) {
      if (line.parentElement !== list || !drag.lineShown) {
        line.animate([ { opacity: 0 }, { opacity: 1 } ], { duration: 150, easing: "ease-out" })
      } else {
        const delta = from - line.getBoundingClientRect().top
        if (Math.abs(delta) >= 0.5) line.animate([ { translate: `0 ${delta}px` }, { translate: "0 0" } ], { duration: 150, easing: "ease-out" })
      }
    }
    drag.lineShown = true
    this.nudge()
  }

  // The cards each side of the line part: 8px for the nearest, 0.7 of that for each further out,
  // the nearest moving first (a stagger only for cards at rest; a moving one retargets at once).
  nudge() {
    const drag = this.drag
    const list = drag.line.parentElement
    for (const card of this.cardTargets) {
      if (card === drag.card) continue
      if (!list.contains(card)) { this.unnudge(card); continue }
      const siblings = this.cardsIn(this.columnOf(card)).filter((other) => other !== drag.card)
      let gap = siblings.findIndex((other) => drag.line.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING)
      if (gap < 0) gap = siblings.length
      const index = siblings.indexOf(card)
      const after = index >= gap
      const steps = after ? index - gap : gap - 1 - index
      const offset = (after ? 1 : -1) * NUDGE * FALLOFF ** steps
      const moving = card.getAnimations().some((animation) => animation.transitionProperty === "transform")
      card.style.transitionDelay = moving || reduced() ? "0ms" : `${Math.round(STAGGER * (1 - FALLOFF ** steps) / (1 - FALLOFF))}ms`
      card.style.transform = `translateY(${offset.toFixed(2)}px)`
    }
  }

  unnudge(card) {
    card.style.transitionDelay = ""
    card.style.transform = ""
  }

  // Puts the line where the card would land for a pointer at x, y.
  place(x, y) {
    const drag = this.drag
    const column = this.columnTargets.find((element) => {
      const box = element.getBoundingClientRect()
      return x >= box.left && x <= box.right
    })
    if (!column) return
    this.openWhileHovered(column)
    const list = this.listOf(column)
    const cards = this.cardsIn(column).filter((card) => card !== drag.card)
    const before = this.isFolded(column) ? null : cards.find((card) => {
      const box = card.getBoundingClientRect()
      return y < box.top + box.height / 2
    })
    const already = before ? drag.line.nextElementSibling === before : drag.line.parentElement === list && !this.nextCardAfter(drag.line)
    if (!already || !drag.lineShown) this.moveLine(() => { if (before) before.before(drag.line); else this.appendTo(list, drag.line) })
    for (const other of this.columnTargets) other.toggleAttribute("data-drop", other === column)
  }

  // Scrolls a column's list, or the board sideways, while the pointer is near its edge.
  autoScroll() {
    cancelAnimationFrame(this.scrolling)
    const drag = this.drag
    if (!drag?.active) return
    const edge = 40
    const step = 12
    let scrolled = false
    const list = drag.line.closest("[data-slot=board-list]") || drag.line.parentElement
    const box = list.getBoundingClientRect()
    if (drag.py < box.top + edge && list.scrollTop > 0) { list.scrollTop -= step; scrolled = true }
    else if (drag.py > box.bottom - edge && list.scrollTop < list.scrollHeight - list.clientHeight) { list.scrollTop += step; scrolled = true }
    const board = this.element.getBoundingClientRect()
    if (drag.px < board.left + edge && this.element.scrollLeft > 0) { this.element.scrollLeft -= step; scrolled = true }
    else if (drag.px > board.right - edge && this.element.scrollLeft < this.element.scrollWidth - this.element.clientWidth) { this.element.scrollLeft += step; scrolled = true }
    if (scrolled) {
      this.scrolling = requestAnimationFrame(() => {
        if (!this.drag?.active) return
        this.place(drag.px, drag.py)
        this.autoScroll()
      })
    }
  }

  pointerUp(event) {
    const drag = this.drag
    if (!drag || event.pointerId !== drag.id) return
    if (!drag.active) return this.release()
    const { card, line, home, ghost } = drag
    line.replaceWith(card)
    this.settle(card, ghost)
    this.release()
    // The click that follows a drag isn't a click on the card's link.
    const swallow = (click) => { click.preventDefault(); click.stopPropagation() }
    card.addEventListener("click", swallow, { capture: true, once: true })
    setTimeout(() => card.removeEventListener("click", swallow, { capture: true }), 0)
    if (card.parentElement !== home.parent || card.nextElementSibling !== home.next) this.commit(card, home)
  }

  cancel() {
    const drag = this.drag
    if (!drag) return
    drag.line?.remove()
    if (drag.active) this.settle(drag.card, drag.ghost)
    this.release()
  }

  // The dropped card glides into its slot: its copy flies from the pointer to where the card now
  // sits, which shows once it lands. Everything else settles at the same time, without delays.
  settle(card, ghost) {
    for (const other of this.cardTargets) this.unnudge(other)
    card.removeAttribute("data-dragging")
    if (!ghost || reduced()) return
    const to = card.getBoundingClientRect()
    const flying = ghost.cloneNode(true)
    flying.setAttribute("data-slot", "board-flight")
    document.body.append(flying)
    card.setAttribute("data-landing", "")
    const flight = flying.animate(
      [ { translate: ghost.style.translate, rotate: "2deg" }, { translate: `${to.left}px ${to.top}px`, rotate: "0deg", boxShadow: "var(--ui-shadow-xs)" } ],
      { duration: SETTLE, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" }
    )
    const land = () => { flying.remove(); card.removeAttribute("data-landing") }
    flight.addEventListener("finish", land)
    flight.addEventListener("cancel", land)
  }

  release() {
    const drag = this.drag
    if (!drag) return
    clearTimeout(drag.timer)
    clearTimeout(drag.opening?.timer)
    cancelAnimationFrame(this.scrolling)
    drag.ghost?.remove()
    drag.line?.remove()
    drag.card.removeAttribute("data-dragging")
    for (const card of this.cardTargets) this.unnudge(card)
    this.element.removeAttribute("data-dragging")
    for (const column of this.columnTargets) column.removeAttribute("data-drop")
    document.removeEventListener("pointermove", this.onMove)
    document.removeEventListener("pointerup", this.onUp)
    document.removeEventListener("pointercancel", this.onCancel)
    document.removeEventListener("keydown", this.onKey)
    document.removeEventListener("touchmove", this.onTouchMove)
    this.drag = null
  }

  // keydown->runeui--board#key on a card: arrows move between cards, Shift with an arrow moves
  // the card, Enter opens it.
  key(event) {
    const card = event.currentTarget
    if (event.target !== card && !event.shiftKey) return
    const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key]
    if (!direction) {
      // Handled here, so a page-wide key handler doesn't open it a second time.
      if (event.key === "Enter" && event.target === card) {
        const link = card.querySelector("a[href]")
        if (link) { event.preventDefault(); link.click() }
      }
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    const column = this.columnOf(card)
    const cards = this.cardsIn(column)
    const index = cards.indexOf(card)
    const rtl = getComputedStyle(this.element).direction === "rtl"
    const sideways = direction === "left" || direction === "right"
    const step = (direction === "right") !== rtl ? 1 : -1
    const neighbour = sideways ? this.columnTargets[this.columnTargets.indexOf(column) + step] : null

    if (!event.shiftKey) {
      if (direction === "up") cards[index - 1]?.focus()
      else if (direction === "down") cards[index + 1]?.focus()
      else if (neighbour) {
        const others = this.cardsIn(neighbour)
        const next = others[Math.min(index, others.length - 1)] || this.nextWithCards(neighbour, step)
        if (next) {
          this.unfold(this.columnOf(next))
          next.focus()
        }
      }
      return
    }

    const home = { parent: card.parentElement, next: card.nextElementSibling }
    if (direction === "up") { if (index === 0) return; cards[index - 1].before(card) }
    else if (direction === "down") { if (index === cards.length - 1) return; cards[index + 1].after(card) }
    else {
      if (!neighbour) return
      this.unfold(neighbour)
      const others = this.cardsIn(neighbour)
      if (others[index]) others[index].before(card)
      else this.appendTo(this.listOf(neighbour), card)
    }
    card.focus()
    this.commit(card, home)
  }

  // Sends the move, having already made it; puts the card back if it's refused.
  async commit(card, home) {
    const column = this.columnOf(card)
    const before = this.nextCard(card)
    const detail = {
      card: card.dataset.card, column: column.dataset.column, before: before?.dataset.card ?? "",
      from: home.parent.closest("[data-runeui--board-target~=column]")?.dataset.column, element: card
    }
    const event = this.dispatch("move", { detail, cancelable: true })
    if (event.defaultPrevented) return this.restore(card, home)
    home.column = this.columnOf(home.parent)
    this.shiftTotal(home.column, column)
    this.count()
    this.announce(card, column)

    const url = (card.dataset.url || column.dataset.url || (this.hasUrlValue ? this.urlValue : "")).replaceAll("__card__", encodeURIComponent(detail.card))
    if (!url) return this.dispatch("moved", { detail })

    const body = new FormData()
    body.set("card", detail.card)
    body.set("column", detail.column)
    body.set("before", detail.before)
    card.setAttribute("aria-busy", "true")
    try {
      const send = window.Turbo?.fetch ?? window.fetch.bind(window)
      const response = await send(url, {
        method: this.methodValue.toUpperCase(),
        body,
        credentials: "same-origin",
        headers: {
          Accept: "text/vnd.turbo-stream.html, text/html, application/xhtml+xml",
          "X-CSRF-Token": document.querySelector("meta[name=csrf-token]")?.content ?? "",
          "X-Requested-With": "XMLHttpRequest"
        }
      })
      if (!response.ok) throw new Error(`${response.status}`)
      if (response.headers.get("Content-Type")?.includes("turbo-stream")) window.Turbo?.renderStreamMessage(await response.text())
      this.dispatch("moved", { detail })
    } catch (error) {
      this.restore(card, home)
      this.say(`Couldn't move ${this.titleOf(card)}. It's back where it was.`)
      this.dispatch("failed", { detail: { ...detail, error } })
      import("runeui/feedback").then(({ showToast }) => showToast(`Couldn't move ${this.titleOf(card)}`, { type: "error" })).catch(() => {})
    } finally {
      card.removeAttribute("aria-busy")
    }
  }

  restore(card, home) {
    if (!home.parent.isConnected) return
    if (home.column) this.shiftTotal(this.columnOf(card), home.column)
    if (home.next?.parentElement === home.parent) home.next.before(card)
    else this.appendTo(home.parent, card)
    this.count()
  }

  announce(card, column) {
    const cards = this.cardsIn(column)
    this.say(`${this.titleOf(card)} moved to ${column.dataset.title || column.dataset.column}, ${cards.indexOf(card) + 1} of ${cards.length}.`)
  }

  say(message) {
    if (this.hasStatusTarget) this.statusTarget.textContent = message
  }

  // Each column's count: its total where it holds only some of its cards, else the cards in it.
  count() {
    for (const column of this.columnTargets) {
      const cards = this.cardsIn(column).length
      const shown = column.dataset.total ?? cards
      for (const count of column.querySelectorAll("[data-slot=board-column-count]")) count.textContent = shown
      column.toggleAttribute("data-empty", cards === 0)
    }
  }

  // A card went from one column to another: one fewer in the first's total, one more in the second's.
  shiftTotal(from, to) {
    if (!from || !to || from === to) return
    if (from.dataset.total) from.dataset.total = Math.max(0, Number(from.dataset.total) - 1)
    if (to.dataset.total) to.dataset.total = Number(to.dataset.total) + 1
  }

  // Into a list, at its end but before its next-page item.
  appendTo(list, node) {
    const more = list.querySelector("[data-slot=board-more]")
    if (more) more.before(node)
    else list.append(node)
  }

  // click->runeui--board#toggle on a collapsible column's title: folds it or opens it.
  toggle(event) {
    const column = this.columnTargets.find((element) => element.contains(event.currentTarget))
    if (column) this.fold(column, !this.isFolded(column))
  }

  isFolded(column) { return column.hasAttribute("data-collapsed") }

  unfold(column) { if (column && this.isFolded(column)) this.fold(column, false) }

  fold(column, folded, { remember = true } = {}) {
    if (!column.hasAttribute("data-collapsible")) return
    column.toggleAttribute("data-collapsed", folded)
    column.querySelector("[data-slot=board-column-toggle]")?.setAttribute("aria-expanded", String(!folded))
    if (remember && this.element.id) {
      try { localStorage.setItem(this.foldKey(column), folded ? "folded" : "open") } catch {}
    }
  }

  // Each collapsible column as this browser last left it (the server's choice where it never has).
  restoreFolds(only) {
    if (!this.element.id) return
    for (const column of only ? [ only ] : this.columnTargets) {
      if (!column.hasAttribute("data-collapsible")) continue
      let stored = null
      try { stored = localStorage.getItem(this.foldKey(column)) } catch {}
      if (stored) this.fold(column, stored === "folded", { remember: false })
    }
  }

  foldKey(column) { return `runeui-board:${this.element.id}:${column.dataset.column}` }

  // A card held over a folded column for a moment opens it.
  openWhileHovered(column) {
    const drag = this.drag
    if (drag.opening?.column === column) return
    clearTimeout(drag.opening?.timer)
    drag.opening = null
    if (!this.isFolded(column)) return
    drag.opening = { column, timer: setTimeout(() => {
      if (this.drag !== drag) return
      this.unfold(column)
      this.place(drag.px ?? drag.x, drag.py ?? drag.y)
    }, 600) }
  }

  // turbo:before-morph-attribute->runeui--board#keep: a column's fold is this browser's, not the
  // server's, so a morph leaves it (and its title's aria-expanded) alone.
  keep(event) {
    const { attributeName } = event.detail
    const target = event.target
    if (attributeName === "data-collapsed" && this.columnTargets.includes(target)) event.preventDefault()
    else if (attributeName === "aria-expanded" && target.dataset.slot === "board-column-toggle") event.preventDefault()
  }

  queueCount() {
    cancelAnimationFrame(this.counting)
    this.counting = requestAnimationFrame(() => this.count())
  }

  columnOf(card) { return this.columnTargets.find((column) => column.contains(card)) }
  listOf(column) { return column.querySelector("[data-slot=board-list]") }
  cardsIn(column) { return this.cardTargets.filter((card) => column.contains(card)) }
  titleOf(card) { return card.dataset.title || card.querySelector("[data-slot=board-card-title]")?.textContent.trim() || "The card" }

  // The card after this one in its column, in document order: an app may wrap cards in elements
  // of its own (ReActionView's debug spans, a frame), so not just the next sibling.
  nextCardAfter(node) {
    return this.cardTargets.find((card) => card !== this.drag?.card && node.parentElement?.contains(card) && (node.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING)) || null
  }

  nextCard(card) {
    const cards = this.cardsIn(this.columnOf(card))
    return cards[cards.indexOf(card) + 1] || null
  }

  nextWithCards(column, step) {
    // The cards of a folded column count: moving into it opens it.
    for (let index = this.columnTargets.indexOf(column) + step; this.columnTargets[index]; index += step) {
      const cards = this.cardsIn(this.columnTargets[index])
      if (cards.length) return cards[0]
    }
    return null
  }
}
