# runeui: guide for agents and contributors

runeui is a component library for Rails with no build step: each component is an ERB partial
(`app/views/ui/_<name>.html.erb`) and a stylesheet (`app/assets/stylesheets/runeui/components/<name>.css`)
that an app can copy and own (`bin/rails g runeui:add <name>`), on UI SDK's web components
(`@ui-sdk/web`, Apache-2.0), vendored as plain ES modules in `app/javascript/runeui/sdk` by
`script/vendor-ui-sdk` and served through importmap. A Hotwire layer (`app/javascript/runeui/*.js`)
makes them live with Turbo. README.md is the user's guide; this is how the kit is built.

## Layout

| Path | What |
| --- | --- |
| `lib/runeui/helper.rb` | `runeui_tags`, `ui(name, **locals) { content }`, `ui_attrs`, `ui_icon`, `ui_id`, `ui_options`, `ui_flash_toasts` |
| `lib/runeui/form_builder.rb` | `form.ui :select, :status, …`: name, id, value (or checked), invalid, errors from the record |
| `lib/runeui/turbo_stream_actions.rb` | `turbo_stream.ui_toast`, `ui_open`, `ui_close` |
| `lib/runeui/icons.rb` | Lucide shapes (ISC) for `ui_icon` |
| `app/javascript/runeui/index.js` | `import "runeui"`: starts `autoload` and `hotwire` |
| `autoload.js` | imports `runeui/sdk/<entry>` the first time a `ui-<entry>-*` tag appears (frames and streams too) |
| `morph.js` | the morph guard: the server owns configuration, the element owns state |
| `forms.js` | fires native `change`/`input` when a form-associated component's value moves |
| `feedback.js` | toasts (flash, `ui_toast`, `toast()`) and `data-turbo-confirm` through the alert dialog |
| `theme.js` | `.dark` on `<html>`, `data-runeui-theme` buttons |
| `controllers/*_controller.js` | Stimulus controllers, registered as `runeui--<name>` (`controllers/index.js`): sidebar, selection, columns, board, autosubmit, filter, side-panel |
| `props.js` | `data-props` JSON → element properties; an image cropper's crop → its hidden fields |
| `remote.js`, `command.js`, `triggers.js` | server search (`src:`), commands that visit (`href:`), a trigger menu's triggers from markup |
| `agent.js` | UI SDK's agent bridge over WebMCP, opt-in |
| `app/assets/stylesheets/runeui/tokens.css` | shadcn's colour tokens by name, plus `--ui-*` sizes; the layer order |
| `base.css` | page base, `.ui-popup` (every floating surface), `.ui-item` (every list/menu row), `[data-slot=choice]` |
| `app/views/runeui/docs/examples/_<name>.html.erb` | the gallery's examples, at `/runeui/<name>` |
| `script/test`, `script/check-ui-sdk` | the test runner (plain ERB, then ReActionView); the UI SDK version report, `--diff` and `--try` |
| `test/browser/contract.test.mjs` | what runeui's own code assumes about UI SDK, checked directly |
| `app/assets/stylesheets/runeui/lexxy.css`, `bridges/rune_ui.css` | optional: the Lexxy editor's skin; runeui's tokens from rune_ui's |
| `test/dummy` | a Rails app for trying it (`test/dummy/bin/restart [port]`) |
| `test/browser` | Playwright tests: `hotwire.test.mjs`, `components/<name>.test.mjs`, `reactionview.test.mjs` and `reactionview.parity.mjs` (the dummy app with `REACTIONVIEW=1`) |

## Writing a component

1. **Read UI SDK's page for it** (`docs/components/<name>.md` in `@ui-sdk/web`): its composition
   (which `ui-*` parts, which wrap a native element), its attributes and events, its data attributes.
2. **The partial.** First line: strict locals, every one defaulting to `nil`, ending in `**attrs`
   (and `content: nil` when it takes a block). Then a `<%# … %>` comment saying what it is, with
   examples as plain Ruby: never `%>` inside the comment, it ends it. Build every element that
   has a computed attribute with `ui_tag`: `<%= ui_tag "ui-select", { name: name, data: { slot:
   "select" } }, attrs do %> … <% end %>` (the base, the caller's attrs merged over it; `true`
   writes a bare attribute, `nil` and `false` leave it out). **Never `tag.*`, `content_tag`,
   `link_to` or `button_to` with anything computed**: Herb's engine (ReActionView) rewrites those
   calls into HTML when it compiles a template and drops or mangles what it can't read statically
   (a splatted hash vanishes, `nil` becomes `attr=""`, a merged `data:` hash becomes a string).
   Herb also refuses ERB output where an attribute goes, and a bare `<% raise … %>` (assign it:
   `<% _checked = problem && raise(…) %>`). Parts with only literal attributes are
   plain HTML. `test/browser/reactionview.parity.mjs` compares every gallery page under ERB and
   under ReActionView and fails on any difference.
3. **Render each part's `data-slot` on the server, with the value UI SDK will give it**, so the
   first paint is styled and nothing jumps when it upgrades. Check in a browser: UI SDK renames
   some (an alert dialog's parts become `alert-dialog-*`; a trigger's button becomes
   `<component>-trigger`, which is why the button look is a class, `ui-button`).
4. **A part whose text UI SDK writes stays empty** (`ui-select-value`): anything inside counts as
   custom content and stops it writing. Put the server's text in `data-label` and show it with
   `:not(:defined)::before { content: attr(data-label) }` until the element upgrades.
5. **Closed popups render `hidden`** (content, backdrop) so nothing flashes before upgrade. Every
   floating surface takes class `ui-popup`; every row in a list or menu `ui-item`.
6. **Form controls** take `name`, `value` (as `default-value`), `disabled`, `required`, `form`,
   `invalid` (as `aria-invalid`), `id` (from `ui_id(prefix, id, name: name)`, stable across renders
   so a morph keeps it). On/off ones take `checked` and `unchecked_value` (a hidden field, as Rails'
   `check_box`); add them to `FormBuilder::BOOLEAN`.
7. **The stylesheet**: everything in `@layer runeui.components { }`, selectors on `[data-slot=…]`
   and UI SDK's state attributes (`[data-open]`, `[data-checked]`, `[data-highlighted]`,
   `[data-starting-style]`/`[data-ending-style]` for transitions). Colours only from the tokens
   (`--primary`, `--muted-foreground`, `--border`, `--ring`…), sizes from `--ui-*`; it must look
   right light and dark, and match shadcn/ui's look for the same component. No hex colours.
   No `.dark` selectors: where light and dark differ
   beyond the colour tokens, read a `--ui-*` token defined with `light-dark()` in tokens.css.
   `data-size` and `data-variant` values are dasherized (`:icon_xs` → `icon-xs`).
   Tints are `color-mix(in oklab, …)`, never `in oklch`: the neutral tokens are `oklch(L 0 0)`,
   and mixing them in oklch drags a colour's hue to 0 (everything goes pink).
8. **The example**, `app/views/runeui/docs/examples/_<name>.html.erb` (`<%# locals: () %>`): the
   common cases, and a form posting to `runeui_echo_path("<name>")` with `data-turbo-stream` for a
   form control, which answers with a toast of what it received.
9. **Lists and data.** UI SDK takes lists in attributes comma-separated (`default-value="a,b"`; a
   range slider's `"20/80"`), not JSON. What it takes only as a property (items, spans,
   triggers) goes in `data-props='{"items": …}'`, which `props.js` applies and a morph updates.
10. **Ids.** A morph pairs elements by id, and UI SDK derives part ids from the root's. Give a
   root an id (`ui_id(prefix, id, name: name)`, the same on every render) wherever UI SDK would
   otherwise number its parts from a counter, and render those part ids yourself
   (`<root-id>-heading`, a radio's label): the counters collide across components (`ui-label`
   and a radio's label both make `ui-sdk-label-1`). Render any wrapper UI SDK adds "when the
   markup has none" (`ui-drawer-viewport`), or a morph duplicates what's inside it.
   `test/browser/morph_stability.test.mjs` morphs every gallery page onto itself and must pass.
11. **Verify**: `bundle exec herb lint app/views` clean; the component's page with no console
   errors in light and dark; `test/browser/components/<name>.test.mjs` (with `component()` from
   `test/browser/component.mjs`) opening it, using it with the keyboard and pointer, and for a form
   control checking the value it submits. Look at the screenshots. `component()` fails on any
   console error, so a test that causes a failed request on purpose uses `helpers.mjs` directly. Hover cards and tooltips open
   after a delay (wait about 900 ms after hovering); a tooltip opens on keyboard focus (Tab), not
   on `element.focus()`. UI SDK's events don't bubble: listen in the capture phase.

## Where JavaScript goes

- **UI SDK's elements** do a component's own behaviour (keys, focus, ARIA, popups). Never
  re-implement one.
- **Stimulus controllers** (`runeui--<name>`) are for stateful pieces runeui adds itself: the
  sidebar, row selection, a table's hidden columns, the board, the side panel, a form that
  submits as it changes, a filter's searched list. The
  partial that owns the root wires `data-controller`, targets and actions; apps extend them the
  usual way. They register on the app's Stimulus application (`window.Stimulus`) or one runeui
  starts.
- **Plain modules** are for page-wide plumbing only: autoloading, the morph guard, the forms
  bridge, toasts and confirm, and the `data-runeui-*` attributes (`data-runeui-open`,
  `data-runeui-theme`, `data-runeui-toast`), which are to runeui what `data-turbo-*` is to Turbo.
- Never inline: no `onclick=`, no `<script>` in a partial, no `style=`. (The one inline script is
  the theme's, in `runeui_tags`, nonce'd, because it must run before the first paint.)

## Rules the Hotwire layer keeps

- Inside any `ui-*` element, a Turbo morph changes only what the server owns: configuration
  attributes, classes, `data-controller`/`-action`/`-*-target`/`-*-value`, `data-variant`,
  `data-size`. ARIA, `role`, `tabindex`, `hidden`, `style`, generated ids and other `data-*` are
  the element's. A changed `default-value`/`default-checked`/`default-pressed` becomes the value
  (the server changed it); an unchanged one leaves the person's choice. `data-morph="replace"`
  opts a subtree out; `data-morph="keep"` freezes one.
- Component values never wait on the server: they live in the element and submit with the form.
- `data-turbo-confirm` asks through `#runeui-confirm`; toasts go to `#runeui-toaster`. Both are
  `data-turbo-permanent`.
- No inline styles, no build step, nothing from npm at runtime: the vendored modules are the only
  third-party JavaScript.

## Beside another kit

runeui must be able to sit in an app that has its own styles without changing a pixel of them
(tried in Runwell, beside rune_ui: every existing page identical before and after). So:

- `base.css` and every component sheet select only runeui's own parts: something with a
  `data-slot` or a `ui-` class, and what's inside it. Nothing bare (`*`, `body`, `button`,
  `[hidden]`, `:focus-visible`). The page reset and body are `page.css`, which
  `runeui_tags(page: false)` leaves out.
- Tokens on `:root` are `tokens.css` only, which `runeui_tags(tokens: false)` leaves out for a
  bridge. shadcn's names collide with other vocabularies (`--accent`, `--ring`, `--border`,
  `--muted`), so a bridge defines every token on runeui's parts, never on the root
  (`bridges/rune_ui.css`).
- Options come from `runeui_tags` (a `<meta name="runeui">`), not from JavaScript beside the
  import: `confirm: false`, `toasts: false` keep the app's own.

## ReActionView

runeui is written to work in an app that compiles its templates with ReActionView (Herb's
engine, `herb:state`): partials have strict locals, keyed loops and valid markup, and build
elements with `ui_tag` (above). Components hold their own state, so the pattern ReActionView apps
use for an in-place form (always rendered, hidden by state: `hidden="<%= !open %>"`) leaves them
untouched as state changes, and `form.ui` partials render inside `form_with`. Don't put
`herb:state` in a runeui partial: a component's open or chosen state is UI SDK's, and a second
owner would fight it. Check with `REACTIONVIEW=1 test/dummy/bin/restart 3316`, then
`reactionview.parity.mjs` and `reactionview.test.mjs`.

## Updating UI SDK

`script/check-ui-sdk --try <version>` re-vendors and runs every test, restoring the old files if
something that passed now fails (docs/upgrading-ui-sdk.md). When runeui's JavaScript starts
relying on something new in UI SDK (an `api` method, an event, an attribute format), add a check
for it to `test/browser/contract.test.mjs` in the same commit, naming the file that depends on it.
UI SDK's form controls fire native `change` and `input` themselves: never dispatch them again.
