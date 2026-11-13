# Upgrading UI SDK

runeui's behaviour is [UI SDK](https://ui-sdk.dev)'s web components (`@ui-sdk/web` and
`@ui-sdk/core`), vendored into `app/javascript/runeui/sdk` as plain ES modules. UI SDK is a beta:
its elements, attributes and events will move between versions. This is how runeui keeps up
without finding out in production.

## The short version

```sh
script/check-ui-sdk                 # is there a newer version?
script/check-ui-sdk --diff 0.2.0    # what it changes in the elements runeui uses, and its changelog
script/check-ui-sdk --try 0.2.0     # vendor it, run every test; put the old files back if it breaks
```

`--try` runs the tests on the version you have first, so only what the new version breaks counts
against it. If nothing new fails, the new files stay in `app/javascript/runeui/sdk` and
`config/sdk_pins.rb` for you to look over and commit. If something does, both are restored from
git and it prints the checks that failed.

Then, before committing a version that passes:

1. Read `script/check-ui-sdk --diff`'s output for new attributes and parts worth using.
2. Open the gallery (`test/dummy/bin/restart`, http://localhost:3311/runeui) and look: the tests
   check behaviour, not every pixel. `script/test --shots tmp/shots` saves every component light
   and dark.
3. Commit the two paths as one commit, "UI SDK 0.2.0".

The weekly workflow (`.github/workflows/ui-sdk.yml`) does the first three commands by itself: a
version that passes arrives as a pull request, one that doesn't as an issue saying what broke.

## What the tools are

| | |
| --- | --- |
| `script/vendor-ui-sdk [version]` | Installs that version in a temp directory, bundles one module per component (esbuild, pinned, code-split, minified), rewrites relative imports to bare `runeui/sdk/…` specifiers and writes `config/sdk_pins.rb` and `sdk/entries.js`. Builds beside the real directory and swaps at the end, and stops before touching anything if an entry runeui imports by name is gone. The same version always gives the same files. |
| `script/test [names] [--shots DIR]` | Herb lint, then every browser test against the dummy app, which it boots and stops. One line per file. `script/test contract` runs one. |
| `test/browser/contract.test.mjs` | The contract: what runeui's own code assumes about UI SDK, checked directly (below). |
| `script/check-ui-sdk` | The report, `--diff` and `--try` above. |

The tests need Node, `playwright-core` and a Chromium (apps that use runeui need none of them):

```sh
npm install --prefix test/browser
npx --prefix test/browser playwright-core install chromium
```

or set `PLAYWRIGHT` to a playwright-core directory and `CHROMIUM` to a browser binary.

## The contract

Sixty component tests failing at once says little. `contract.test.mjs` says which assumption
broke: each check names the file in runeui that depends on it. When it fails after a re-vendor,
fix these first; most component failures follow from one of them.

| Check | What runeui assumes | Where it's used | If it fails |
| --- | --- | --- | --- |
| vendored: every entry imports; every pin has its file; no relative imports | `script/vendor-ui-sdk`'s output is whole | `autoload.js`, `config/sdk_pins.rb` | Re-run the vendor script; if UI SDK's package layout changed (its `exports`), fix the script's entry discovery. |
| autoload: every `ui-*` tag a partial writes maps to an entry that defines it | Tags are named `ui-<entry>…` and exist | `autoload.js` `entryFor`, every partial | An element was renamed or removed: `--diff` lists it. Rename it in the partials and CSS, or adjust `entryFor` if only the entry's name moved. |
| exports | `core-toast` exports `toast` (with `.success`, `.error`, `.info`, `.warning`, `.loading`); `alert-dialog` exports `createConfirm`, whose result has `.controller`; `agent` exports `createAgent`, `registerTools` | `feedback.js`, `agent.js`, `REQUIRED` in `script/vendor-ui-sdk` | Follow the rename in those two modules. |
| markup | Parts get `data-slot`; a trigger's goes on its button; a part's id is `<root id>-<part>`; generated ids start `ui-sdk-`; closed content is `hidden` | every stylesheet; `morph.js` (`ownedByElement`, `alignIds`); partials that render part ids | Stylesheets select the new names; `morph.js` keeps the new id prefix. |
| select: an empty `ui-select-value` is written, one with content is left | Parts UI SDK writes must be rendered empty | `_select` and others (`data-label`), `morph.js` (keeps what an element made) | If UI SDK now overwrites content, partials can render the label inside the part and drop `data-label`. |
| lists | `default-value="a,b"`; a slider's range `"20/80"` | `_select`, `_toggle_group`, `_slider`, `_combobox`…; `morph.js` `parse` | Change what the partials write and `parse` together. |
| api | `element.api` has `setValue` / `getValue` / `setChecked` / `setPressed` / `open` / `close`; `setValue` doesn't lock the value | `morph.js` `follow` (`DEFAULTS`), `selection_controller.js`, `command.js` | Point `DEFAULTS` and the callers at the new setters. |
| properties | `.value`, `.checked`, `.pressed`, `.open`, `.multiple`; a combobox's `.items`, `.query`, `.itemToLabel` | `forms.js`, `hotwire.js`, `feedback.js` (`ui_open`/`ui_close`), `remote.js` | Follow the rename in those modules. |
| forms | Controls are form-associated and submit through `FormData`; one user change reaches the form as exactly one `change` | every form partial, `forms.js` | If UI SDK stops firing `change`, `forms.js` must bridge again; if it starts for a control `forms.js` bridges, drop that bridge (two `change`s submit a form twice). |
| events | `checkedchange`, `valuechange`, `pressedchange` come from the element; `openchange` and `querychange` carry `detail.value`; `payloadchange` carries the question; `action` carries a command's value; `cropchange` fires | `forms.js`, `remote.js`, `feedback.js`, `command.js`, `props.js` | Rename the listeners; they listen in the capture phase because the events don't bubble. |
| popups, dialogs | Open content is in the top layer and marked `data-open`; setting `.open` opens and closes without locking it | `base.css` `.ui-popup`, `dialog.css`, `hotwire.js`, `data-runeui-open` | If popups leave the top layer, `.ui-popup` needs positioning and z-index of its own. |
| confirm, toasts | An alert dialog's parts are named `alert-dialog-*`; a toast copies the region's `<template>` and carries `data-type`, `--toast-index`, `--toast-front-height` | `feedback.js`, `_confirm`, `_toaster`, `toast.css`, `dialog.css` | Rename in the partial and the stylesheet together. |
| styles | UI SDK's own CSS is in the `ui-sdk` cascade layer | `tokens.css` (the layer order) | If the layer is renamed, rename it in `tokens.css`'s `@layer` line, or UI SDK's CSS will beat runeui's. |
| command, image cropper, trigger menu, agent | `action` on `ui-command`; `.crop` with `x`, `y`, `width`, `height`; `.triggers` is a property; `createAgent()` has `snapshot` and `act` | `command.js`, `props.js`, `triggers.js`, `agent.js` | Follow the rename in that module. |
| data-slot, across the gallery | The `data-slot` each partial renders on the server is the one UI SDK gives the part once it upgrades | every partial and stylesheet | The message lists each `page: <tag> old → new`. Render the new name in the partial and select it in the CSS. (Notes list parts that have no `data-slot` until they upgrade: add one if their CSS selects it.) |

A check that prints `note:` passed, and is telling you something changed that's worth a look
(UI SDK's events started bubbling, a toggle became form-associated), usually a chance to delete
code.

## When a new version adds something

- **A new element** shows under "Elements added" in `--diff`. To offer it: a partial, a stylesheet,
  a gallery example and a test (AGENTS.md, "Writing a component"). `sdk/entries.js` picks up its
  entry by itself.
- **A new assumption** in runeui's JavaScript (a new `api` call, a new event listened for) gets a
  line in `contract.test.mjs` in the same commit.

## When a version can't be adopted yet

Leave the vendored files as they are (a failed `--try` already has) and keep the issue the
workflow opened. runeui's version and UI SDK's are independent: the gem ships whichever UI SDK is
vendored at its tag, named in `sdk/entries.js` (`VERSION`) and the first line of
`config/sdk_pins.rb`.
