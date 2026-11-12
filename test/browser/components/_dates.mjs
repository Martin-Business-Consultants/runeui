// Shared by the date and time component tests.

// Morphs one element against the server's own HTML for it, as a Turbo refresh would: fetches
// the page again and renders a replace stream with method="morph".
export async function morph(page, id) {
  await page.evaluate(async (id) => {
    const html = await (await fetch(location.href)).text()
    const fresh = new DOMParser().parseFromString(html, "text/html").getElementById(id).outerHTML
    Turbo.renderStreamMessage(`<turbo-stream action="replace" method="morph" target="${id}"><template>${fresh}</template></turbo-stream>`)
  }, id)
  await page.waitForTimeout(400)
}

export const formData = (page, selector) => page.evaluate((s) => Object.fromEntries(new FormData(document.querySelector(s).closest("form"))), selector)
