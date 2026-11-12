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
| `agent.js` | UI SDK's agent bridge over WebMCP, opt-in |
| `app/assets/stylesheets/runeui/tokens.css` | shadcn's colour tokens by name, plus `--ui-*` sizes; the layer order |
| `base.css` | page base, `.ui-popup` (every floating surface), `.ui-item` (every list/menu row), `[data-slot=choice]` |
| `app/views/runeui/docs/examples/_<name>.html.erb` | the gallery's examples, at `/runeui/<name>` |
| `test/dummy` | a Rails app for trying it (`test/dummy/bin/restart [port]`) |
| `test/browser` | Playwright tests: `hotwire.test.mjs`, `components/<name>.test.mjs` |

## Writing a component

1. **Read UI SDK's page for it** (`docs/components/<name>.md` in `@ui-sdk/web`): its composition
   (which `ui-*` parts, which wrap a native element), its attributes and events, its data attributes.
2. **The partial.** First line: strict locals, every one defaulting to `nil`, ending in `**attrs`
   (and `content: nil` when it takes a block). Then a `<%# … %>` comment saying what it is, with
   examples as plain Ruby: never `%>` inside the comment, it ends it. Build the root with a tag
   helper, `tag.ui_select(**ui_attrs(base, attrs)) do … end` (`tag.ui_x` writes `<ui-x>`): Herb
   refuses ERB output where an attribute goes. Inner parts can be plain HTML.
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
8. **The example**, `app/views/runeui/docs/examples/_<name>.html.erb` (`<%# locals: () %>`): the
   common cases, and a form posting to `runeui_echo_path("<name>")` with `data-turbo-stream` for a
   form control, which answers with a toast of what it received.
9. **Verify**: `bundle exec herb lint app/views` clean; the component's page with no console
   errors in light and dark; `test/browser/components/<name>.test.mjs` (with `component()` from
   `test/browser/component.mjs`) opening it, using it with the keyboard and pointer, and for a form
   control checking the value it submits. Look at the screenshots.

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

## Updating UI SDK

`script/vendor-ui-sdk <version>` re-vendors, rewrites imports to bare specifiers and regenerates
`config/sdk_pins.rb` and `sdk/entries.js`. Then run every browser test.
