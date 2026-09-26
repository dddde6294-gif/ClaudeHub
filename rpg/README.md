# Emberfall: Legends of the Shattered Crown

A 2D action RPG that runs as a desktop app (Electron) or in the browser. Every sprite, tile, sound and song is generated in code, so there are no asset files.

**Play in the browser:** <https://dddde6294-gif.github.io/ClaudeHub/rpg/>

## Run the desktop app

You need Node.js 18 or newer.

```sh
cd rpg
npm install
npm start
```

Build an installer for your platform with `npm run dist` (or `dist:win`, `dist:mac`, `dist:linux`). Installers are written to `rpg/dist/`.

To play without Electron, open `rpg/web/index.html` in a browser.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD or arrow keys | Left stick |
| Aim | Mouse | Right stick |
| Attack (hold for combos) | Left click or J | RT |
| Heavy attack (costs stamina) | Right click or U | LT |
| Dodge roll (costs stamina) | Space | A |
| Sprint (drains stamina) | Hold Shift | R3 |
| Skills | 1–4 | LB, RB, B, L3 |
| Health / mana potion | Q / R | D-pad |
| Talk, open, travel | E or F | Y |
| Inventory | I or Tab | View |
| Skills / quests / map | K / L / M | |
| Pause, save, settings | Esc | Menu |

F11 toggles fullscreen in the desktop app.

## How it's built

Plain JavaScript with no build step. `web/index.html` loads the scripts in order and everything hangs off one global, `RPG`.

| Folder | What's in it |
|---|---|
| `web/src/core` | Utilities, input, synthesized audio |
| `web/src/gfx` | Pixel-art renderer: characters, weapons, monsters, tiles and props, icons, particles and effects |
| `web/src/data` | Items, classes and skills, enemies and bosses, NPCs, quests, maps, story |
| `web/src/game` | Combat, entities, enemy AI, world and collision, quest engine, saves |
| `web/src/ui` | HUD and menus (DOM layer over the canvas) |
| `main.js`, `preload.js` | Electron shell |

`DESIGN.md` has the content plan: zones, enemies, bosses and gear rules. Saves are kept in the browser's (or app's) local storage: three slots plus an autosave.
