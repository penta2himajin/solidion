# Solidion Example: Breakout

A block breaker game built with Solidion (SolidJS + Phaser 3).

## Play

Pre-built version is in `dist/`. Serve it with any static file server:

```bash
npx serve dist
# → http://localhost:3000
```

## Controls

- **Mouse** — move paddle
- **Click** — launch ball / continue after miss / restart after game over

## How it works

All game state is managed through SolidJS Signals:

| State | Signal | Updates |
|---|---|---|
| Ball position | `bx`, `by` | Every frame via physics callback |
| Paddle position | `padX` | On pointer move |
| Block visibility | `blocks[i]` (60 individual signals) | On collision |
| Score | `score` | On block destruction |
| Lives | `lives` | On ball loss |
| Game phase | `phase` ("ready" / "play" / "miss" / "win" / "over") | On state transitions |

Phaser GameObjects are created via Solidion's `createElement` and their properties are bound to Signals through `effect(() => setProp(...))`. When a Signal changes, Solid automatically re-runs the relevant effect, which updates the Phaser object.

### Frame synchronization

Physics runs inside a **frame callback** registered with Solidion's `FrameManager`. The `solidionFrameUpdate` function wraps all callbacks in Solid's `batch()`, ensuring that ball position (x + y), score, lives, and block state are updated atomically before Phaser renders the frame.

### Key patterns demonstrated

- **60 reactive blocks**: Each block has its own `createSignal(true)` controlling visibility
- **Derived state**: `alive()` is a `createMemo` counting visible blocks for win detection
- **Batch updates**: `batch(() => { setLives(nl); setPhase("miss"); park(); })` ensures consistent state transitions
- **Event handling**: `this.input.on("pointermove", ...)` drives a Signal; effects propagate to the paddle

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

See [src/main.ts](src/main.ts) — single file, ~250 lines.
