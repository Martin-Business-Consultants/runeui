// Picking a table's rows (ui :select_cell, ui :bulk_bar): the header's checkbox picks every row
// and shows mixed while some are; shift-click picks the range from the last one clicked; picked
// rows get aria-selected; the bulk bar in the same form shows with the count. All of it from the
// checkboxes' own state, so a Turbo morph or a stream that adds rows needs nothing more.

let last = null

// The rows and bar that belong together: the form around them, else the table.
function scope(element) { return element.closest("form") || element.closest("[data-slot=table-container]") || document }
function boxes(root) { return [ ...root.querySelectorAll("ui-checkbox[data-runeui-select]") ] }

function setChecked(box, value) {
  if (box.api?.setChecked) box.api.setChecked(value)
  else box.checked = value
}

function refresh(root) {
  const all = boxes(root)
  const picked = all.filter((box) => box.checked)
  for (const box of all) box.closest("tr")?.setAttribute("aria-selected", String(box.checked))
  for (const header of root.querySelectorAll("ui-checkbox[data-runeui-select-all]")) {
    const every = all.length > 0 && picked.length === all.length
    setChecked(header, every)
    // UI SDK's checkbox has no settable mixed state outside a group: data-mixed draws it.
    header.toggleAttribute("data-mixed", picked.length > 0 && !every)
  }
  for (const bar of root.querySelectorAll("[data-slot=bulk-bar]")) {
    bar.hidden = picked.length === 0
    const noun = bar.dataset.noun || "row"
    const count = bar.querySelector("[data-slot=bulk-count]")
    if (count) count.textContent = `${picked.length} ${picked.length === 1 ? noun : `${noun}s`} selected`
  }
}

export function wireSelection() {
  document.addEventListener("click", (event) => {
    const header = event.target.closest?.("ui-checkbox[data-runeui-select-all]")
    if (header) {
      const root = scope(header)
      // The header's own toggle lands after this click: pick all unless all are picked.
      const all = boxes(root)
      const pickAll = !all.every((box) => box.checked)
      requestAnimationFrame(() => { for (const box of all) setChecked(box, pickAll); refresh(root) })
      return
    }
    const clear = event.target.closest?.("[data-runeui-select-clear]")
    if (clear) {
      const root = scope(clear)
      for (const box of boxes(root)) setChecked(box, false)
      refresh(root)
      return
    }
    const box = event.target.closest?.("ui-checkbox[data-runeui-select]")
    if (!box) return
    const root = scope(box)
    if (event.shiftKey && last && last !== box && scope(last) === root) {
      const all = boxes(root)
      const [ from, to ] = [ all.indexOf(last), all.indexOf(box) ].sort((a, b) => a - b)
      requestAnimationFrame(() => {
        const value = box.checked
        for (const other of all.slice(from, to + 1)) setChecked(other, value)
        refresh(root)
      })
    }
    last = box
    requestAnimationFrame(() => refresh(root))
  })

  // Keys (Space on a focused checkbox) and anything else that changes one.
  document.addEventListener("change", (event) => {
    if (event.target.matches?.("ui-checkbox[data-runeui-select]")) refresh(scope(event.target))
  })
  document.addEventListener("turbo:load", () => {
    for (const root of new Set(boxes(document).map(scope))) refresh(root)
  })
}
