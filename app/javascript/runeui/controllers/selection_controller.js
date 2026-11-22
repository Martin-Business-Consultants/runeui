import { Controller } from "@hotwired/stimulus"

// Picking a table's rows (ui :table, selectable: true with ui :select_cell and ui :bulk_bar).
// The header's checkbox picks every row and shows mixed while some are; shift-click picks the
// range from the last one clicked; picked rows get aria-selected; the bulk bar shows with the
// count. All from the checkboxes' own state, which Stimulus re-reads as rows come and go (a
// Turbo stream appending rows, a morph).
//
// Pressing a row's checkbox cell and dragging down the column picks a range (after
// microinteractions.dev's drag select): the first row sets the direction (unpicked: the drag
// picks; picked: it clears), every row between it and the pointer takes that state and every
// other goes back to how it was, so a fast pointer can't skip a row and backing off undoes one.
// A band over the column shows the range; the page scrolls near its edges. Releasing keeps it;
// Escape, a cancelled pointer or the window losing focus puts every row back.
const EDGE = 48

export default class extends Controller {
  static targets = [ "row", "all", "bar", "count", "band" ]
  static values = { noun: { type: String, default: "row" } }

  connect() {
    this.abort = new AbortController()
    const { signal } = this.abort
    this.element.addEventListener("pointerdown", (event) => this.press(event), { signal })
    this.element.addEventListener("pointermove", (event) => this.drag && this.track(event), { signal })
    this.element.addEventListener("pointerup", (event) => this.finish(event, true), { signal })
    this.element.addEventListener("pointercancel", (event) => this.finish(event, false), { signal })
    this.element.addEventListener("lostpointercapture", (event) => this.finish(event, false), { signal })
    // The click that follows a handled press would toggle the box again. Keyboard and assistive
    // clicks (detail 0) still go through.
    this.element.addEventListener("click", (event) => {
      if (!this.swallow || event.detail === 0) return
      this.swallow = false
      event.preventDefault()
      event.stopPropagation()
    }, { capture: true, signal })
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && this.drag) { event.preventDefault(); this.finish(null, false) } }, { signal })
    window.addEventListener("blur", () => this.drag && this.finish(null, false), { signal })
    window.addEventListener("scroll", () => this.drag && this.extend(), { signal, passive: true })
    this.refresh()
  }

  disconnect() {
    if (this.drag) this.finish(null, false)
    this.abort?.abort()
  }

  // pointerdown in a row's checkbox cell: that row is the anchor, flipped at once.
  press(event) {
    const cell = event.target.closest?.("td[data-slot=table-select]")
    if (!cell || this.drag || event.button !== 0 || !event.isPrimary || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    const rows = this.rowTargets
    const box = rows.find((row) => cell.contains(row))
    if (!box || box.hasAttribute("disabled") || box.hasAttribute("data-disabled")) return
    event.preventDefault()
    const anchor = rows.indexOf(box)
    const state = !box.checked
    this.drag = { id: event.pointerId, anchor, state, reach: anchor, y: event.clientY, snapshot: rows.map((row) => Boolean(row.checked)), rows }
    this.set(box, state)
    this.last = box
    box.focus({ preventScroll: true })
    this.element.setPointerCapture(event.pointerId)
    this.element.setAttribute("data-selecting", "")
    this.refresh()
  }

  track(event) {
    if (event.pointerId !== this.drag.id) return
    this.drag.y = event.clientY
    this.extend()
    this.autoscroll()
  }

  // Every row from the anchor to the row under the pointer takes the drag's state; the others
  // go back to their snapshot.
  extend() {
    const drag = this.drag
    const rows = drag.rows
    const boxes = rows.map((row) => row.closest("tr").getBoundingClientRect())
    let reach = boxes.findIndex((box) => drag.y < box.bottom)
    if (reach < 0) reach = rows.length - 1
    if (drag.y < boxes[0].top) reach = 0
    drag.reach = reach
    const [ from, to ] = [ drag.anchor, reach ].sort((a, b) => a - b)
    rows.forEach((row, index) => {
      const want = index >= from && index <= to ? drag.state : drag.snapshot[index]
      if (Boolean(row.checked) !== want) this.set(row, want)
    })
    this.band(from, to)
    this.queueRefresh()
  }

  // The page scrolls while the pointer is within 48px of the viewport's edge, faster nearer it.
  autoscroll() {
    cancelAnimationFrame(this.scrolling)
    const drag = this.drag
    if (!drag) return
    const height = window.innerHeight
    const depth = drag.y < EDGE ? -(EDGE - drag.y) / EDGE : drag.y > height - EDGE ? (drag.y - (height - EDGE)) / EDGE : 0
    if (!depth) return
    const step = (now) => {
      if (!this.drag) return
      const elapsed = Math.min(now - (drag.time ?? now - 16), 64)
      drag.time = now
      window.scrollBy(0, Math.sign(depth) * Math.max(depth * depth * 14 * (elapsed / 16.7), 1))
      this.scrolling = requestAnimationFrame(step)
    }
    this.scrolling = requestAnimationFrame(step)
  }

  finish(event, committed) {
    const drag = this.drag
    if (!drag || (event && event.pointerId !== drag.id)) return
    this.drag = null
    cancelAnimationFrame(this.scrolling)
    this.element.removeAttribute("data-selecting")
    if (this.element.hasPointerCapture?.(drag.id)) this.element.releasePointerCapture(drag.id)
    if (!committed) drag.rows.forEach((row, index) => { if (Boolean(row.checked) !== drag.snapshot[index]) this.set(row, drag.snapshot[index]) })
    else if (event) {
      this.swallow = true
      setTimeout(() => { this.swallow = false }, 0)
    }
    if (this.hasBandTarget) this.bandTarget.removeAttribute("data-open")
    this.refresh()
  }

  // The band: two caps that move with translateY and a 1px body that stretches with scaleY, 6px
  // inside the first and last rows of the range, centred on the checkbox column.
  band(from, to) {
    if (!this.hasBandTarget) return
    const band = this.bandTarget
    if (from === to) { band.removeAttribute("data-open"); return }
    const scroller = band.offsetParent ?? this.element
    const origin = scroller.getBoundingClientRect()
    const rows = this.drag.rows
    const first = rows[from].closest("tr").getBoundingClientRect()
    const last = rows[to].closest("tr").getBoundingClientRect()
    const cell = rows[from].closest("td").getBoundingClientRect()
    const top = first.top - origin.top + scroller.scrollTop + 6
    const bottom = last.bottom - origin.top + scroller.scrollTop - 6
    const left = cell.left - origin.left + scroller.scrollLeft + cell.width / 2 - 14
    const [ head, body, foot ] = band.children
    const opening = !band.hasAttribute("data-open")
    const parts = [ band, ...band.children ]
    if (opening) for (const part of parts) part.style.transition = "none"
    band.style.transform = `translateX(${left}px)`
    head.style.transform = `translateY(${top}px)`
    body.style.transform = `translateY(${top + 14}px) scaleY(${Math.max(bottom - top - 28, 0)})`
    foot.style.transform = `translateY(${bottom - 14}px)`
    band.dataset.picking = String(this.drag.state)
    if (opening) {
      void band.offsetWidth
      for (const part of parts) part.style.transition = ""
      band.setAttribute("data-open", "")
    }
  }
  rowTargetConnected() { this.queueRefresh() }
  rowTargetDisconnected() { this.queueRefresh() }

  // click->runeui--selection#pick on a row's checkbox
  pick(event) {
    const box = event.currentTarget
    if (event.shiftKey && this.last && this.last !== box && this.rowTargets.includes(this.last)) {
      const rows = this.rowTargets
      const [ from, to ] = [ rows.indexOf(this.last), rows.indexOf(box) ].sort((a, b) => a - b)
      // After the checkbox's own toggle has landed.
      requestAnimationFrame(() => {
        for (const other of rows.slice(from, to + 1)) this.set(other, box.checked)
        this.refresh()
      })
    }
    this.last = box
    this.queueRefresh()
  }

  // click->runeui--selection#toggleAll on the header's checkbox
  toggleAll() {
    const pickAll = !this.rowTargets.every((box) => box.checked)
    requestAnimationFrame(() => {
      for (const box of this.rowTargets) this.set(box, pickAll)
      this.refresh()
    })
  }

  clear() {
    for (const box of this.rowTargets) this.set(box, false)
    this.refresh()
  }

  refresh() {
    const rows = this.rowTargets
    const picked = rows.filter((box) => box.checked)
    for (const box of rows) box.closest("tr")?.setAttribute("aria-selected", String(Boolean(box.checked)))
    for (const header of this.allTargets) {
      const every = rows.length > 0 && picked.length === rows.length
      this.set(header, every)
      // UI SDK's checkbox has no settable mixed state outside a group: data-mixed draws it.
      header.toggleAttribute("data-mixed", picked.length > 0 && !every)
    }
    for (const bar of this.barTargets) bar.hidden = picked.length === 0
    for (const count of this.countTargets) {
      const noun = this.nounValue
      count.textContent = `${picked.length} ${picked.length === 1 ? noun : `${noun}s`} selected`
    }
    this.dispatch("change", { detail: { count: picked.length, values: picked.map((box) => box.getAttribute("value")) } })
  }

  queueRefresh() {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(() => this.refresh())
  }

  set(box, value) {
    if (box.api?.setChecked) box.api.setChecked(value)
    else box.checked = value
  }
}
