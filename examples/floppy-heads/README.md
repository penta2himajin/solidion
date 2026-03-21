# Solidion Example: Floppy Heads

A Flappy Bird-style game where a floppy disk navigates through gaps between drive read/write heads. Built with Solidion (SolidJS + Phaser 3).

## Play

Pre-built version is in `dist/`. Serve it with any static file server:

```bash
npx serve dist
# → http://localhost:3000
```

## Controls

- **Click / Space** — flap (fly upward)
- Avoid the drive heads and the ground

## How it works

All game state is managed through SolidJS Signals:

| State | Signal | Updates |
|---|---|---|
| Disk Y position | `diskY` | Every frame via gravity + velocity |
| Disk tilt | `diskAngle` | Lerped toward velocity-based target |
| Score | `score` | When passing a head pair |
| Best score | `best` | On death if score > best |
| Game phase | `phase` ("ready" / "play" / "dead") | On state transitions |

### Key patterns demonstrated

- **Gravity physics**: Velocity accumulates via `GRAVITY * dt`, capped at `MAX_VEL`
- **Object pooling**: 4 head pairs are recycled — deactivated when off-screen left, respawned on the right
- **Composite visuals**: The floppy disk is built from 4 rectangles (body, metal slider, label, hub window), all positioned relative to the disk center with rotation
- **Idle animation**: In "ready" phase, the disk bobs with `Math.sin(t * 2.5) * 8`

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

See [src/main.ts](src/main.ts) — single file, ~300 lines.
