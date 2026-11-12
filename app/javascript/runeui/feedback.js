// Toasts and confirmations, from the components, wired to Rails and Turbo:
//   - the flash: ui_flash_toasts in the layout renders <template data-runeui-toasts>; each
//     message becomes a toast as the page or a Turbo visit arrives
//   - turbo_stream.ui_toast("Saved", type: :success) from a controller
//   - data-turbo-confirm asks with an alert dialog, not the browser's confirm(): the message is
//     its title; data-turbo-confirm-description, data-turbo-confirm-button and
//     data-turbo-confirm-cancel (on the form or the button) fill in the rest
//   - toast(…) and confirm(…) from your own JavaScript
//
// The toast region and the confirm dialog are the app's to style and own: render
// ui :toaster and ui :confirm in the layout. Without them, plain ones are made here.

import { toast } from "runeui/sdk/core-toast"
import { load } from "runeui/autoload"

export { toast }

const TOASTER = `
<ui-toast-region id="runeui-toaster" data-slot="toast-region" data-turbo-permanent>
  <template>
    <ui-toast data-slot="toast">
      <div data-slot="toast-body"><ui-toast-title data-slot="toast-title"></ui-toast-title><ui-toast-description data-slot="toast-description"></ui-toast-description></div>
      <ui-toast-action data-slot="toast-action"></ui-toast-action>
      <ui-toast-close data-slot="toast-close"><button type="button" class="ui-button" data-variant="ghost" data-size="icon-xs" aria-label="Close">×</button></ui-toast-close>
    </ui-toast>
  </template>
</ui-toast-region>`

const CONFIRM = `
<ui-alert-dialog id="runeui-confirm" data-turbo-permanent>
  <ui-alert-dialog-backdrop data-slot="alert-dialog-backdrop" hidden></ui-alert-dialog-backdrop>
  <ui-alert-dialog-content data-slot="alert-dialog-content" data-size="sm" hidden>
    <div data-slot="dialog-header">
      <ui-alert-dialog-title data-slot="alert-dialog-title"></ui-alert-dialog-title>
      <ui-alert-dialog-description data-slot="alert-dialog-description"></ui-alert-dialog-description>
    </div>
    <div data-slot="dialog-footer">
      <ui-alert-dialog-close><button type="button" class="ui-button" data-variant="outline" data-size="default" data-confirm-cancel></button></ui-alert-dialog-close>
      <ui-alert-dialog-close value="confirm"><button type="button" class="ui-button" data-variant="default" data-size="default" data-confirm-accept></button></ui-alert-dialog-close>
    </div>
  </ui-alert-dialog-content>
</ui-alert-dialog>`

function ensure(id, html) {
  let element = document.getElementById(id)
  if (!element) {
    document.body.insertAdjacentHTML("beforeend", html.trim())
    element = document.getElementById(id)
  }
  return element
}

// Shows a toast: toast("Saved"), toast("Couldn't save", { type: "error", description: "…" }).
export async function showToast(title, options = {}) {
  await load("toast")
  ensure("runeui-toaster", TOASTER)
  const { type, ...rest } = options
  return type && typeof toast[type] === "function" ? toast[type](title, rest) : toast(title, rest)
}

let asker = null

async function confirmer() {
  if (asker) return asker
  const [ { createConfirm } ] = await Promise.all([ load("alert-dialog") ])
  const dialog = ensure("runeui-confirm", CONFIRM)
  await customElements.whenDefined("ui-alert-dialog")
  const ask = createConfirm()
  dialog.controller = ask.controller
  dialog.addEventListener("payloadchange", (event) => {
    const question = event.detail.value
    if (!question) return
    dialog.querySelector("ui-alert-dialog-title").textContent = question.title ?? ""
    const description = dialog.querySelector("ui-alert-dialog-description")
    description.textContent = question.description ?? ""
    description.hidden = !question.description
    dialog.querySelector("[data-confirm-cancel]").textContent = question.cancelLabel ?? "Cancel"
    const accept = dialog.querySelector("[data-confirm-accept]")
    accept.textContent = question.confirmLabel ?? "Continue"
    accept.dataset.variant = question.destructive ? "destructive" : "default"
  })
  asker = ask
  return asker
}

// Asks a question in an alert dialog; resolves true when they agree.
//   await confirm({ title: "Delete this project?", description: "…", confirmLabel: "Delete", destructive: true })
export async function confirm(question) {
  const ask = await confirmer()
  return ask(typeof question === "string" ? { title: question } : question)
}

function read(element, submitter, name) {
  return submitter?.getAttribute(`data-turbo-confirm-${name}`) ?? element?.getAttribute?.(`data-turbo-confirm-${name}`) ?? undefined
}

function turboConfirm(message, element, submitter) {
  const button = read(element, submitter, "button")
  return confirm({
    title: message,
    description: read(element, submitter, "description"),
    confirmLabel: button,
    cancelLabel: read(element, submitter, "cancel"),
    destructive: (read(element, submitter, "variant") ?? (submitter?.dataset.variant || element?.dataset?.variant)) === "destructive"
  })
}

function flashToasts(root = document) {
  for (const template of root.querySelectorAll("template[data-runeui-toasts]")) {
    const messages = JSON.parse(template.dataset.runeuiToasts || "[]")
    template.remove()
    for (const { title, ...options } of messages) showToast(title, options)
  }
}

// <turbo-stream action="ui_toast" title="Saved" type="success"> and friends.
const STREAM_ACTIONS = {
  ui_toast(stream) {
    const options = JSON.parse(stream.getAttribute("options") || "{}")
    showToast(stream.getAttribute("title"), options)
  },
  ui_open(stream) { for (const element of stream.targetElements) element.open = true },
  ui_close(stream) { for (const element of stream.targetElements) element.open = false }
}

export function wireFeedback({ confirm: replaceConfirm = true, toasts = true } = {}) {
  if (replaceConfirm) {
    const install = () => {
      const Turbo = window.Turbo
      if (!Turbo) return false
      if (Turbo.config?.forms) Turbo.config.forms.confirm = turboConfirm
      else Turbo.setConfirmMethod?.(turboConfirm)
      return true
    }
    if (!install()) document.addEventListener("turbo:load", install, { once: true })
  }

  if (toasts) {
    flashToasts()
    document.addEventListener("turbo:load", () => flashToasts())
    document.addEventListener("turbo:frame-load", (event) => flashToasts(event.target))
    document.addEventListener("turbo:before-stream-render", (event) => {
      const stream = event.detail.newStream ?? event.target
      const action = STREAM_ACTIONS[stream.getAttribute("action")]
      if (action) event.detail.render = action
    })
    // A stream that renders a flash template into the page shows it too.
    new MutationObserver(() => {
      if (document.querySelector("template[data-runeui-toasts]")) flashToasts()
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
}
