// Two things UI SDK's elements take as JavaScript, made markup:
//   - data-props='{"spans": …}' on a ui-* element sets those properties once it's defined, and
//     again whenever the server changes data-props (a morph, a stream). Partials write it from
//     Ruby data (the waterfall's spans).
//   - An image cropper's crop goes into its hidden fields (input[data-crop-field]) so it submits.

function applyProps(element) {
  if (!element.dataset?.props) return
  customElements.whenDefined(element.localName).then(() => {
    try { Object.assign(element, JSON.parse(element.dataset.props)) } catch (error) { console.error("runeui: bad data-props", element, error) }
  })
}

function writeCrop(event) {
  const cropper = event.target
  if (cropper.localName !== "ui-image-cropper" || !cropper.crop) return
  const c = cropper.crop
  const values = { x: c.x, y: c.y, width: c.width, height: c.height, rotation: c.rotation ?? 0, flip_x: c.flipX ? 1 : 0, flip_y: c.flipY ? 1 : 0 }
  for (const input of cropper.querySelectorAll("input[data-crop-field]")) {
    const value = values[input.dataset.cropField]
    input.value = value == null ? "" : String(Math.round(value * 100) / 100)
  }
}

export function wireProps() {
  for (const element of document.querySelectorAll("[data-props]")) applyProps(element)
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") applyProps(record.target)
      else for (const node of record.addedNodes) if (node instanceof Element) [ node, ...node.querySelectorAll("[data-props]") ].forEach(applyProps)
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [ "data-props" ] })
  // UI SDK's events don't bubble: listen in the capture phase.
  document.addEventListener("cropchange", (event) => requestAnimationFrame(() => writeCrop(event)), true)
  document.addEventListener("cropcommit", writeCrop, true)
}
