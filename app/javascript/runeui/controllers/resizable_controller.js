import { Controller } from "@hotwired/stimulus"

// The grip on a resizable group's handles (ui :resizable; after microinteractions.dev's resize
// handle). A divider is long and the pointer meets it anywhere, so the grip appears where it does:
// placed at the pointer before it fades in, then kept there, unsmoothed, as the pointer moves
// along the handle and while it drags. Rounded to device pixels. A touch has no hover: its grip
// stays in the middle (CSS), as does the keyboard's. UI SDK does the resizing and the keys.
export default class extends Controller {
  connect() {
    this.abort = new AbortController()
    const { signal } = this.abort
    const track = (event) => {
      const handle = event.target.closest?.("[data-slot=resizable-handle]")
      if (!handle || event.pointerType === "touch" || !this.element.contains(handle)) return
      if (handle.closest("[data-slot=resizable]") !== this.element) return
      // While dragging the grip stays with the pointer even past the handle's ends.
      if (event.type === "pointermove" && !handle.matches(":hover, [data-dragging]")) return
      this.place(handle, event)
    }
    this.element.addEventListener("pointerover", track, { signal })
    this.element.addEventListener("pointermove", track, { signal })
  }

  disconnect() { this.abort?.abort() }

  place(handle, event) {
    const box = handle.getBoundingClientRect()
    const vertical = handle.dataset.orientation === "vertical"
    const length = vertical ? box.width : box.height
    const along = vertical ? event.clientX - box.left : event.clientY - box.top
    // Kept 8px plus half the grip inside the handle's ends.
    const half = 16
    const clamped = Math.min(Math.max(along, half + 8), Math.max(length - half - 8, half + 8))
    const ratio = window.devicePixelRatio || 1
    handle.style.setProperty("--ui-grip-at", `${Math.round(clamped * ratio) / ratio}px`)
  }
}
