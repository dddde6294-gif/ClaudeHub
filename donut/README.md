# Donut HUD

A Minecraft-style HUD for [DonutSMP](https://donutsmp.net) that shows:

- **Diamond Pickaxe:** the cheapest one on `/ah` right now, its price history (24h / 7d / 30d / all time), the all-time low, and recent sales.
- **Diamond:** the best price per diamond in `/orders`. DonutSMP's API has no orders data, so you type this in yourself (check `/orders diamond` in game). It's saved in your browser only.

Page: <https://dddde6294-gif.github.io/ClaudeHub/donut/>

**Pop out HUD** opens a small window that stays on top of Minecraft (Chrome and Edge; play in windowed mode). For OBS, add a Browser Source with the page URL plus `?mini&transparent`.

## Setup (one time)

1. In DonutSMP, type `/api` and copy your key.
2. On GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Name `DONUTSMP_API_KEY`, value: your key.
3. Merge this into `main`. The Pages workflow checks prices about every 5 minutes (GitHub sometimes runs late) and keeps the history on the published site.

GitHub pauses scheduled workflows after 60 days without commits; re-enable it in the Actions tab if the page stops updating.

## Live mode (every 15 seconds)

Prices can move 10% in 10 minutes, so the GitHub copy can lag. For tight prices while you play, run this on your computer (Node.js 18+):

```sh
node donut/hub.js --key <your key>   # the key is saved to ~/.donuthud/key after the first run
```

Then open <http://localhost:4318/>.

## Files

- `index.html`: the page (the same file for GitHub Pages and live mode)
- `core.js`: money formatting and parsing, shared with Node
- `api.js`: DonutSMP API client (the auction search sends a JSON body on GET)
- `tracker.js`: finds the cheapest pickaxes, reads new sales, keeps and thins the history
- `build.js`: builds the Pages copy; `hub.js`: live mode
