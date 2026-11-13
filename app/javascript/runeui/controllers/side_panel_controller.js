import { Controller } from "@hotwired/stimulus"

// The side panel (ui :side_panel): a drawer holding <turbo-frame id="side_panel">. A link with
// data-turbo-frame="side_panel" makes the frame fetch, which opens the panel; once it has
// loaded, the page's address gains ?panel=<path> so refresh, Back and a shared link return to
// it (the layout passes the param back as src:). Closing empties the frame and takes the param
// off again.
//
// History, with Turbo Drive in mind. Opening pushes an entry Turbo knows (so coming Back to it
// from another page restores it from the server, panel open) and marks the entry under it as
// not Turbo's, which makes Back from the panel a plain popstate: Turbo adopts the entry without
// visiting, and sync() closes the panel. No page is fetched to close a panel.
//
// Events, on the panel: runeui--side-panel:open (detail.src) each time something loads,
// runeui--side-panel:close when it has closed.
export default class extends Controller {
  static targets = [ "frame" ]
  static values = { param: { type: String, default: "panel" } }

  connect() {
    this.pushed = false
    this.expecting = false
    // A page Turbo restored from its cache comes back with the panel closed (popups close
    // before a snapshot): if the address says one was open, open it again.
    if (this.current && !this.shown) this.sync()
  }

  get current() {
    return this.safe(new URL(location.href).searchParams.get(this.paramValue))
  }

  get shown() {
    return this.element.api ? this.element.api.isOpen() : this.element.hasAttribute("default-open")
  }

  // turbo:before-fetch-request, from the frame: something is on its way, so show the panel.
  loading(event) {
    if (event.target !== this.frameTarget) return
    this.expecting = true
    this.closing = false
    this.leaving = false
    this.open()
  }

  // openchange, from the drawer: on its way closed, so whatever is still loading isn't wanted.
  changing(event) {
    if (event.detail?.value !== false) return
    this.expecting = false
    this.closing = true
  }

  // turbo:frame-load: remember what's showing in the address.
  loaded(event) {
    if (event.target !== this.frameTarget) return
    // Something that was still on its way when the panel closed: not wanted any more.
    if (this.closing || (!this.expecting && !this.shown)) return this.empty()
    const src = this.pathOf(this.frameTarget.src)
    if (!src) return
    this.open()
    this.remember(src)
    this.dispatch("open", { detail: { src } })
  }

  // openchangecomplete, from the drawer: closed by Esc, the ✕, an outside press or close().
  settled(event) {
    if (event.detail?.value !== false) return
    this.closing = false
    // Closed for Turbo's snapshot as the page is left, not by the person: the address stands.
    if (this.leaving) return
    this.empty()
    this.forget()
    this.dispatch("close")
  }

  // popstate: Back or Forward moved between an address with the panel and one without.
  sync(event) {
    this.adopt(event)
    this.leaving = false
    const src = this.current
    if (src) {
      if (this.pathOf(this.frameTarget.src) !== src) this.frameTarget.src = src
      this.expecting = true
      this.open()
    } else {
      // Whatever was open or on its way isn't wanted. (Turbo may already have closed the panel
      // for its snapshot of the page.)
      this.pushed = false
      this.expecting = false
      if (this.shown) this.close()
      else this.empty()
    }
  }

  // Turbo takes an entry that isn't its own as a step forward. The one under the panel is a
  // step back from the panel's (two behind what Turbo now counts), so put its count right.
  adopt(event) {
    const turboHistory = window.Turbo?.navigator?.history
    if (!event?.state?.runeuiSidePanelBase || !turboHistory) return
    turboHistory.currentIndex -= 2
    turboHistory.replace(new URL(location.href), turboHistory.restorationIdentifier)
  }

  // turbo:before-cache: the snapshot Turbo keeps should come back as the panel is now.
  snapshot() {
    this.leaving = true
    this.element.toggleAttribute("default-open", this.shown && Boolean(this.frameTarget.getAttribute("src")))
  }

  open() {
    customElements.whenDefined(this.element.localName).then(() => {
      if (!this.element.api.isOpen()) this.element.api.open()
    })
  }

  close() {
    this.expecting = false
    this.closing = true
    this.element.api?.close()
  }

  empty() {
    this.frameTarget.removeAttribute("src")
    this.frameTarget.removeAttribute("complete")
    this.frameTarget.replaceChildren()
  }

  // Puts ?panel=src in the address: a new entry the first time on this page, the same entry
  // after that (moving from one record to the next doesn't pile up history).
  remember(src) {
    const url = new URL(location.href)
    const had = url.searchParams.has(this.paramValue)
    if (url.searchParams.get(this.paramValue) === src) return
    url.searchParams.set(this.paramValue, src)
    if (had || this.pushed) return this.write("replace", url)
    // The entry under the panel's stops being Turbo's, so Back to it is a popstate, not a visit.
    history.replaceState({ runeuiSidePanelBase: true }, "", location.href)
    this.write("push", url)
    this.pushed = true
  }

  // Takes the param off: Back when this page pushed it, else in place.
  forget() {
    const url = new URL(location.href)
    if (!url.searchParams.has(this.paramValue)) return
    if (this.pushed) {
      this.pushed = false
      history.back()
      return
    }
    url.searchParams.delete(this.paramValue)
    this.write("replace", url)
  }

  // Through Turbo's history when it's there, so its restoration data and location stay right.
  write(method, url) {
    const turbo = window.Turbo
    if (turbo?.navigator?.history) {
      turbo.navigator.history[method](url)
      if (turbo.session?.view) turbo.session.view.lastRenderedLocation = url
    } else {
      history[`${method}State`]({}, "", url.href)
    }
  }

  pathOf(src) {
    if (!src) return null
    const url = new URL(src, location.href)
    return url.origin === location.origin ? this.safe(url.pathname + url.search) : null
  }

  // A path on this site, as the partial checks src: on the server.
  safe(path) {
    return typeof path === "string" && /^\/(?![/\\])[^\s\\]*$/.test(path) ? path : null
  }
}
