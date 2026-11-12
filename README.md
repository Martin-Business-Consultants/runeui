# runeui

**shadcn/ui for Rails with no build step.** A complete set of polished, accessible components for
Rails apps on importmap, Propshaft and Hotwire: an ERB partial and a stylesheet each, yours to
change, on [UI SDK](https://ui-sdk.dev)'s behaviours, themed with shadcn's tokens, and built to
live with Turbo.

- **No build.** No Node, no Tailwind, no bundler in your app. UI SDK's web components are
  vendored as plain ES modules and served through importmap; a component's module loads the
  first time its tag is on the page.
- **Real behaviour.** Keyboard navigation, focus management, typeahead, ARIA, positioning, top-layer
  popups, swipeable sheets, form participation: UI SDK's tested behaviours, not hand-rolled
  Stimulus controllers.
- **You own it.** `bin/rails g runeui:add select` copies the partial and its CSS into your app;
  from then on yours is used. Change anything.
- **Any shadcn theme.** The colour tokens are shadcn's by name. Paste a theme from
  [tweakcn](https://tweakcn.com) or ui.shadcn.com/themes into your CSS and every component follows.
- **At home in Hotwire.** Turbo morphs keep each component's state and follow the server's
  changes; frames and streams upgrade what they bring; values submit with plain forms and fire
  `change`; `data-turbo-confirm` asks in an alert dialog; the flash and `turbo_stream.ui_toast`
  show toasts.
- **Herb and ReActionView clean.** Every partial has strict locals and lints clean.

## Install

```ruby
# Gemfile
gem "runeui", github: "Martin-Business-Consultants/runeui"
```

```sh
bundle install
bin/rails g runeui:install
```

The installer adds `import "runeui"` to `app/javascript/application.js` and, in your layout:

```erb
<head>
  …
  <%= runeui_tags %>                       <%# tokens, base, components' CSS, the theme script %>
  <%= stylesheet_link_tag :app %>
</head>
<body>
  <%= yield %>
  <%= ui :toaster %>                       <%# where toasts appear %>
  <%= ui :confirm %>                       <%# the dialog data-turbo-confirm asks in %>
  <%= ui_flash_toasts %>                   <%# the flash, as toasts %>
</body>
```

Open **/runeui** in development for the gallery: every component, live, with its ERB.

## Use

```erb
<%= ui :button, content: "Save", type: :submit %>
<%= ui :button, variant: :outline, icon: :plus do %>New project<% end %>

<%= form_with model: @project do |form| %>
  <%= form.ui :field, :name, label: "Name", description: "Shown on invoices" do %>
    <%= form.ui :input, :name %>
  <% end %>
  <%= form.ui :select, :status, options: Project::STATUSES %>
  <%= form.ui :switch, :public, label: "Anyone with the link can see it" %>
  <%= form.ui :date_picker, :due_on %>
  <%= ui :button, content: "Save", type: :submit %>
<% end %>

<%= ui :dialog, trigger: "Edit profile", title: "Edit profile" do %>
  <%= render "profiles/form" %>
<% end %>
```

`ui(name, **locals) { block }` renders `app/views/ui/_<name>.html.erb`, the block as its
`content`. Anything the partial doesn't name (class, id, data, aria…) lands on its root element,
merged: classes join, `data-action` and `data-controller` add to the component's own.

`form.ui :component, :attribute, …` fills in `name`, `id`, the value (or `checked`), and
`invalid`/`errors` from the record.

## With Turbo

| | |
| --- | --- |
| Morphs (`turbo_refreshes_with method: :morph`, `method: "morph"` streams) | A component's live state survives: an open popup, a value someone picked but hasn't saved. What the server changed (a new `default-value`) is followed. `data-morph="replace"` or `"keep"` overrides it for a subtree. |
| Frames and streams | Components in what they bring load and upgrade as they arrive. |
| Forms | Form controls are form-associated: they submit, reset and validate with the form, and fire `change` so `data-action="change->form#requestSubmit"` works. |
| `data-turbo-confirm` | Asks in `ui :confirm`. Add `data-turbo-confirm-description`, `-button`, `-cancel`, `-variant="destructive"`. |
| Toasts | The flash (`ui_flash_toasts`), `turbo_stream.ui_toast("Saved", type: :success, description: "…")`, or `toast()` from `import { toast } from "runeui"`. |
| Opening from elsewhere | `data-runeui-open="dialog-id"` on any button, `turbo_stream.ui_open(id)` / `ui_close(id)`, or `element.open = true`. |

## Theme

Paste a shadcn theme's `:root { … }` and `.dark { … }` into your own stylesheet: it's unlayered,
so it wins over runeui's defaults. `--radius` sets every corner. Dark mode is `.dark` on
`<html>`, set before the first paint from the person's choice or the system's; a button with
`data-runeui-theme="toggle"` (or `light`, `dark`, `system`) changes it.

All of runeui's CSS is in cascade layers (`ui-sdk`, `runeui.tokens`, `runeui.base`,
`runeui.components`), so your own CSS always wins without `!important` or specificity games.

## Own a component

```sh
bin/rails g runeui:add select dialog    # or: all (tokens and base too)
```

Copies `app/views/ui/_select.html.erb` and `app/assets/stylesheets/runeui/components/select.css`
into your app at the same paths, so yours are used. Delete them to go back to the gem's.

## Agents

Each component's markup names its parts (`data-slot`) and states (`data-open`, `data-checked`…),
so an agent reads a page as structure, not pixels. With `<meta name="runeui-agent" content="on">`
the page also offers UI SDK's agent bridge through WebMCP: a browser's agent can list the
components, read their values and use them (pressing buttons asks first).

## How it's built

[AGENTS.md](AGENTS.md) is the guide for contributors: the layout, how a component is written,
the rules the Hotwire layer keeps, and how UI SDK is re-vendored (`script/vendor-ui-sdk`).

## Licence

MIT. Includes UI SDK (Apache-2.0) and Lucide's icon shapes (ISC); see [NOTICE](NOTICE).
