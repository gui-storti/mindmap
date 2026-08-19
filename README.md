# Mindmap

A fast, beautiful mind-mapping app for **Windows, Linux and Android**. Built with a
custom Canvas 2D engine (no DOM per node) so it stays smooth on very large maps,
with a dark "creative studio" UI, spring animations, per-node images and
annotations, and native `.mind` import/export.

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite 7
- **Rendering:** custom Canvas 2D engine (`src/core/engine/Engine.ts`)
- **State:** Zustand (op-based undo/redo that stays cheap on large maps)
- **Desktop/mobile shell:** Tauri v2 (Rust)
- **Files:** `.mind` = a ZIP containing `mindmap.json` + `images/` (plain JSON also accepted)

## Project layout

```
src/
  core/
    engine/Engine.ts   # Canvas renderer, camera, hit-testing, layout animation
    store.ts           # Zustand store: nodes, selection, undo/redo, layout
    layout.ts          # Tree / radial / force layouts
    mindFile.ts        # .mind (ZIP) + JSON import/export
    bridge.ts          # Tauri <-> web bridge for native file dialogs
    sample.ts          # Demo map
  components/          # Toolbar, Inspector, ContextMenu, Minimap, NodeEditor, ...
  App.tsx              # Engine wiring + global keyboard shortcuts
src-tauri/             # Tauri v2 shell (Rust)
  src/lib.rs           # open_mind_file / save_mind_file commands
  tauri.conf.json
  capabilities/
scripts/gen-icons.mjs  # Generates src-tauri/icons (no native deps)
```

## Prerequisites

- **Node.js** 20+ and npm
- For the desktop/mobile shell: **Rust** (stable) + `cargo`
  - Linux: `libwebkit2gtk-4.1`, `libgtk-3`, `libayatana-appindicator` (see
    <https://tauri.app/start/prerequisites/>)
  - Android: Android SDK + JDK 17 (see <https://tauri.app/start/prerequisites/>)

## Web app (no Rust required)

```bash
npm install
npm run dev        # dev server on http://localhost:1420
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

The web build is fully self-contained and works in any modern browser (including
mobile). File open/save fall back to the browser's native file picker / download.

## Desktop app (Tauri)

```bash
npm run icons      # (re)generate src-tauri/icons — already committed
npm run tauri dev  # run the desktop app with hot reload
npm run tauri build # produce installers in src-tauri/target/release/bundle/
```

The Rust shell registers two commands used by `src/core/bridge.ts`:

| Command         | Args                              | Returns            |
| --------------- | --------------------------------- | ------------------ |
| `open_mind_file`| —                                 | `number[] \| null` |
| `save_mind_file`| `data: number[]`, `suggestedName` | `void`             |

Both use the native OS file dialog (via `tauri-plugin-dialog`).

## Android

```bash
npm run tauri android init   # generate the Android project (one time)
npm run tauri android dev    # run on a connected device/emulator
npm run tauri android build  # build an .apk / .aab
```

> **Note on Android file I/O:** on Android the system dialog returns a
> `content://` URI, which cannot be read with `std::fs`. The current Rust
> commands use `std::fs` and therefore work on **Windows and Linux**. To enable
> open/save on Android, add the `tauri-plugin-fs` plugin and read/write through
> `app.fs().read_file(path)` / `app.fs().write_file(path, bytes)` (the dialog
> plugin already depends on it). The frontend contract in `bridge.ts` stays the
> same.

## Keyboard shortcuts

| Key                     | Action                          |
| ----------------------- | ------------------------------- |
| `Tab`                   | Add child to selected node      |
| `Enter`                 | Add sibling                     |
| `Delete` / `Backspace`  | Delete selected node            |
| `F2`                    | Rename selected node            |
| Arrow keys              | Move selection through the map  |
| `Ctrl/Cmd + Z`          | Undo                            |
| `Ctrl/Cmd + Shift + Z`  | Redo                            |
| `Ctrl/Cmd + S`          | Export `.mind`                  |

## The `.mind` format

A `.mind` file is a ZIP archive:

```
mindmap.json          # { version, nodes, edges, meta }
images/<nodeId>.<ext> # optional per-node images
```

Import also accepts a plain `mindmap.json`.
