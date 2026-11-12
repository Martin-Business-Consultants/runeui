// What the gallery's first form would submit right now, as { name: value or [values] }.
export async function formData(page, selector = "[data-example] form") {
  return page.evaluate((selector) => {
    const result = {}
    for (const [key, value] of new FormData(document.querySelector(selector))) {
      const v = value instanceof File ? value.name : value
      result[key] = key in result ? [].concat(result[key], v) : v
    }
    return result
  }, selector)
}
