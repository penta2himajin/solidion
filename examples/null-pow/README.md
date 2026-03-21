# Solidion Example: Null Pow!

A Pac-Man-style maze game where a pointer (`*ptr`) collects data values while avoiding four null references. Built with Solidion (SolidJS + Phaser 3).

The name is a nod to the Japanese internet meme "ぬるぽ" (NullPointerException) → "ｶﾞｯ!" (whack!).

## Play

Pre-built version is in `dist/`. Serve it with any static file server:

```bash
npx serve dist
# → http://localhost:3000
```

## Controls

- **Arrow keys** — move pointer
- **Space** — start / restart

## Characters

Each character has a distinct composite visual built from rectangles and circles:

| Character | Language | Design | Behavior |
|---|---|---|---|
| `*ptr` (player) | — | Cyan arrow cursor with bright tip, rotates with movement | Collects data, eats nulls with try-catch |
| `NULL` | C | Large red block, square eyes, angry brow | Direct chase — targets player's current tile |
| `nil` | Ruby | Small pink circle, round eyes, blush cheek | Ambush ahead — targets 4 tiles ahead of player |
| `None` | Python | Blue elongated body, trailing segment, slit pupils | Pincer — targets mirror of NULL's position |
| `undefined` | JS | Yellow asymmetric body, glitching offset shards | Erratic — random when far, direct chase when close |

## How it works

All game state is managed through SolidJS Signals:

| State | Signal | Updates |
|---|---|---|
| Dot presence | `dotSignals[r][c]` (individual per tile) | On collection |
| Score | `score` | On dot/ghost eat (10/50/200 pts) |
| Lives | `lives` | On null collision |
| Game phase | `phase` ("ready" / "play" / "win" / "dead") | On state transitions |
| Remaining dots | `totalDots` (createMemo) | Derived from all dot signals |

### Key patterns demonstrated

- **State machine (useStateMachine pattern)**: Each ghost cycles through chase → scatter → frightened → eaten modes. Mode transitions are timer-driven with a global sequence, and frightened mode overrides on power-up collection
- **Tile-based movement**: Grid-snapped movement with `pProgress` (0..1) interpolation between tiles. Direction queuing allows input buffering — press a direction and it takes effect at the next valid intersection
- **4 distinct AI personalities**: Each ghost uses a different targeting strategy in chase mode (direct, ambush-ahead, pincer, erratic), matching classic Pac-Man ghost behaviors
- **Reactive dot grid**: Each of the ~170 dots has its own `createSignal`, with a `createMemo` counting remaining dots for win detection
- **Composite character visuals**: Characters are built from multiple primitives — `undefined`'s glitch shards animate via `Math.sin(performance.now())`, `None`'s tail trails behind based on movement direction

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

See [src/main.ts](src/main.ts) — single file, ~850 lines.
