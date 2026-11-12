import { Controller } from "@hotwired/stimulus"

// Picking a table's rows (ui :table, selectable: true with ui :select_cell and ui :bulk_bar).
// The header's checkbox picks every row and shows mixed while some are; shift-click picks the
// range from the last one clicked; picked rows get aria-selected; the bulk bar shows with the
// count. All from the checkboxes' own state, which Stimulus re-reads as rows come and go (a
// Turbo stream appending rows, a morph).
export default class extends Controller {
  static targets = [ "row", "all", "bar", "count" ]
  static values = { noun: { type: String, default: "row" } }

  connect() { this.refresh() }
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
