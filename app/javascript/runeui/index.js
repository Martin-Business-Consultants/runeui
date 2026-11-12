// runeui: import "runeui" once, from app/javascript/application.js. It starts the autoloader (a
// component's module loads the first time its tag is on the page, Turbo frames and streams
// included) and the Hotwire layer (morphs keep component state, form values fire change,
// data-turbo-confirm asks with an alert dialog, the flash and ui_* stream actions show toasts).
//
// Options, set before the import as window.runeui = { … } or with start():
//   confirm: false    keep the browser's confirm() for data-turbo-confirm
//   toasts: false     leave the flash and ui_toast alone
//   agent: true       let a browser's agent read and use the components (WebMCP)
import { autoload } from "runeui/autoload"
import { hotwire } from "runeui/hotwire"

let started = false

export function start(options = {}) {
  if (started) return
  started = true
  autoload(options)
  hotwire(options)
  if (options.agent || document.querySelector('meta[name="runeui-agent"][content="on"]')) {
    import("runeui/agent").then(({ connect }) => connect(options.agent === true ? {} : options.agent || {}))
  }
}

start(window.runeui || {})

export { load, defined } from "runeui/autoload"
export { toast, confirm } from "runeui/feedback"
export { setTheme } from "runeui/theme"
