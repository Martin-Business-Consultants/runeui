// Lets an agent in the browser read and use the page's components (UI SDK's agent bridge,
// published through WebMCP where the browser supports it): snapshot lists every component with
// its label, value and actions; act sets a select, presses a button, fills a field.
//
// Off unless asked for: <meta name="runeui-agent" content="on"> in the layout, or
// window.runeui = { agent: true }. Pressing buttons asks the person first, unless allow says so.
import { createAgent, registerTools } from "runeui/sdk/agent"

export function connect({ allow } = {}) {
  const agent = createAgent()
  const unregister = registerTools(agent, {
    allow: allow ?? ((step) => step.action !== "press" || window.confirm(`Let the agent press ${step.args?.[0] ?? "this"}?`))
  })
  window.runeuiAgent = agent
  return { agent, unregister }
}
