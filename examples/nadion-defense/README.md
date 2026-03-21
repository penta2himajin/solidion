# Solidion Example: Nadion Defense

A Space Invaders-style game set in the Star Trek universe. The player controls a phaser array, firing nadion particles at descending hostile formations. Built with Solidion (SolidJS + Phaser 3).

## Play

Pre-built version is in `dist/`. Serve it with any static file server:

```bash
npx serve dist
# → http://localhost:3000
```

## Controls

- **← → / A D** — move phaser array
- **Space / Click** — fire nadion particle

## How it works

All game state is managed through SolidJS Signals:

| State | Signal | Updates |
|---|---|---|
| Player position | `playerX` | Every frame via keyboard input |
| Enemy visibility | `enemies[i]` (40 individual signals) | On nadion hit |
| Score | `score` | On enemy destruction (10–50 pts by row) |
| Lives | `lives` | On player hit |
| Wave | `wave` | On clearing all enemies |
| Game phase | `phase` ("ready" / "play" / "win" / "dead") | On state transitions |

### Key patterns demonstrated

- **40 reactive enemies**: Each enemy has its own `createSignal(true)` controlling visibility, with LCARS-styled composite visuals (body + notches + accent)
- **Projectile pooling**: 24 bolts shared between player and enemies. Nadion bolts have a 2-layer glow effect (white core + semi-transparent orange glow)
- **Formation AI**: Enemies shift horizontally with direction reversal and step-down on wall hit. Speed increases as enemies are destroyed via `createMemo`
- **LCARS UI**: Star Trek-inspired frame built from rectangles, circles (pill shapes), and colored sidebar segments. Play area is bounded by sidebars
- **Destructible shields**: 4 deflector fields with HP, fading as they take damage

### Visual design

The UI is inspired by [LCARS](https://en.wikipedia.org/wiki/LCARS) (Library Computer Access/Retrieval System), the fictional computer interface from Star Trek. The frame uses pill-shaped bars (rectangle + circle on each end), colored sidebar segments, and the distinctive orange/lavender/purple palette.

## Build from source

```bash
npm install
npm run build
```

For development with hot reload:

```bash
npm run dev
```

## Source

See [src/main.ts](src/main.ts) — single file, ~800 lines.
