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
export default class extends Controller {
  static targets = [ "column", "card", "status" ]
  static values = {
    url: String,
    method: { type: String, default: "patch" },
    hold: { type: Number, default: 250 }
  }

  connect() {
    this.onMove = this.pointerMove.bind(this)
    this.onUp = this.pointerUp.bind(this)
    this.onCancel = this.cancel.bind(this)
    this.onKey = (event) => { if (event.key === "Escape") this.cancel() }
    this.onTouchMove = (event) => { if (this.drag?.active) event.preventDefault() }
    this.count()
  }

  disconnect() { this.cancel() }

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

    card.setAttribute("data-dragging", "")
    this.element.setAttribute("data-dragging", "")
    getSelection()?.removeAllRanges()
  }

  // Puts the line where the card would land for a pointer at x, y.
  place(x, y) {
    const drag = this.drag
    const column = this.columnTargets.find((element) => {
      const box = element.getBoundingClientRect()
      return x >= box.left && x <= box.right
    })
    if (!column) return
    const list = this.listOf(column)
    const cards = this.cardsIn(column).filter((card) => card !== drag.card)
    const before = cards.find((card) => {
      const box = card.getBoundingClientRect()
      return y < box.top + box.height / 2
    })
    if (before) before.before(drag.line)
    else list.append(drag.line)
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
    const list = drag.line.parentElement
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
    const { card, line, home } = drag
    line.replaceWith(card)
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
    this.release()
  }

  release() {
    const drag = this.drag
    if (!drag) return
    clearTimeout(drag.timer)
    cancelAnimationFrame(this.scrolling)
    drag.ghost?.remove()
    drag.line?.remove()
    drag.card.removeAttribute("data-dragging")
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
      if (event.key === "Enter" && event.target === card) card.querySelector("a[href]")?.click()
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
        ;(others[Math.min(index, others.length - 1)] || this.nextWithCards(neighbour, step))?.focus()
      }
      return
    }

    const home = { parent: card.parentElement, next: card.nextElementSibling }
    if (direction === "up") { if (index === 0) return; cards[index - 1].before(card) }
    else if (direction === "down") { if (index === cards.length - 1) return; cards[index + 1].after(card) }
    else {
      if (!neighbour) return
      const others = this.cardsIn(neighbour)
      if (others[index]) others[index].before(card)
      else this.listOf(neighbour).append(card)
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
    this.count()
    this.announce(card, column)

    const url = card.dataset.url || column.dataset.url || (this.hasUrlValue ? this.urlValue : "")
    if (!url) return this.dispatch("moved", { detail })

    const body = new FormData()
    body.set("card", detail.card)
    body.set("column", detail.column)
    body.set("before", detail.before)
    card.setAttribute("aria-busy", "true")
    try {
      const response = await fetch(url, {
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
    if (home.next?.parentElement === home.parent) home.next.before(card)
    else home.parent.append(card)
    this.count()
  }

  announce(card, column) {
    const cards = this.cardsIn(column)
    this.say(`${this.titleOf(card)} moved to ${column.dataset.title || column.dataset.column}, ${cards.indexOf(card) + 1} of ${cards.length}.`)
  }

  say(message) {
    if (this.hasStatusTarget) this.statusTarget.textContent = message
  }

  // Each column's count, from the cards in it.
  count() {
    for (const column of this.columnTargets) {
      const total = this.cardsIn(column).length
      for (const count of column.querySelectorAll("[data-slot=board-column-count]")) count.textContent = total
      column.toggleAttribute("data-empty", total === 0)
    }
  }

  queueCount() {
    cancelAnimationFrame(this.counting)
    this.counting = requestAnimationFrame(() => this.count())
  }

  columnOf(card) { return this.columnTargets.find((column) => column.contains(card)) }
  listOf(column) { return column.querySelector("[data-slot=board-list]") }
  cardsIn(column) { return this.cardTargets.filter((card) => column.contains(card)) }
  titleOf(card) { return card.dataset.title || card.querySelector("[data-slot=board-card-title]")?.textContent.trim() || "The card" }

  nextCard(card) {
    for (let node = card.nextElementSibling; node; node = node.nextElementSibling) {
      if (this.cardTargets.includes(node)) return node
    }
    return null
  }

  nextWithCards(column, step) {
    for (let index = this.columnTargets.indexOf(column) + step; this.columnTargets[index]; index += step) {
      const cards = this.cardsIn(this.columnTargets[index])
      if (cards.length) return cards[0]
    }
    return null
  }
}
