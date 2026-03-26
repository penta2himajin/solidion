# Solidion

SolidJS custom renderer for Phaser 3. Declarative 2D game development with progressive disclosure.

## What is Solidion?

Solidion bridges [SolidJS](https://www.solidjs.com/)'s fine-grained reactivity with [Phaser 3](https://phaser.io/)'s game engine. Write game objects declaratively in JSX, bind properties to Signals, and let the framework handle the rest.

```tsx
function Pet() {
  const [level, setLevel] = createSignal(1);
  const scale = () => 1 + level() * 0.2;

  return (
    <container x={400} y={300}>
      <sprite texture={`/assets/pet-${level()}.png`} scale={scale()} onClick={() => setLevel(l => l + 1)} />
      <text text={`Lv.${level()}`} y={50} fontSize={16} color="#ffffff" />
    </container>
  );
}
```

No `preload`. No `create`. No `update`. No `scene.add`. No `setInteractive`. No `destroy`.

## Design Principles

- **Zero cognitive overhead** — Phaser's preload/create/update lifecycle, manual object management, and state-to-display synchronization are handled automatically
- **Progressive disclosure** — Start simple (L0), add control only where needed. Each component independently chooses its abstraction level
- **No virtual nodes** — Follows SolidJS's philosophy. Phaser GameObjects are created and updated directly, with only lightweight metadata attached
- **Declarative behaviors** — Not just "what exists" but "how it moves" is declarative. Springs, tweens, state machines, oscillations — all as Signals or JSX children

## Levels

| Level | What | How |
|---|---|---|
| L0 | Existence | JSX elements, props binding |
| L1a | Discrete behavior | `useTween`, `useStateMachine`, `useSequence` |
| L1b | Continuous behavior | `useSpring`, `useFollow`, `useOscillation`, `useVelocity` |
| L1c | Behavior composition | `<SpringBehavior>`, `<OscillateBehavior>` as JSX children |
| L2 | Resource management | `<Preload>`, `<Scene>` |
| L3 | Frame control | `useFrame` |
| L4 | Raw Phaser access | `useScene`, `ref` |

Most games stay in L0–L1. `useFrame` (L3) is the escape hatch, not the default.

## Install

```bash
npm install solidion solid-js phaser
```

## Project Structure

```
solidion/
  src/
    core/           # Renderer internals: meta, props, events, texture, scene-stack, frame, sync
    hooks/          # L1a/L1b hooks: useTween, useSpring, useStateMachine, etc.
    behaviors/      # L1c composition components: SpringBehavior, OscillateBehavior, etc.
    components/     # Game, Scene, Preload, Overlay, GameLoop, Show, For
    ecs/            # Reactive ECS: pure step functions + phased Systems + reactive index
    debug/          # Dev-only utilities: inspectBindings, profiling, expose
    renderer.ts     # solid-js/universal createRenderer implementation
    contexts.ts     # Solid contexts (Game, Scene, FrameManager, ParentNode)
    types.ts        # JSX IntrinsicElements type definitions
    index.ts        # Public API (L0–L1c)
  tests/            # 443 tests across 15 suites
  docs/             # Design specification
  examples/         # Runnable demos (breakout, null-pow, floppy-heads, nadion-defense, aquarium)
```

## Testing

```bash
npm install
npm test
```

452 tests across 15 suites:

| Suite | Tests | Scope |
|---|---|---|
| renderer | 110 | Renderer logic (mock Phaser) |
| hooks | 107 | State machine, spring, tween, sequence, etc. |
| props | 48 | Property application & composition |
| ecs | 44 | Pure step functions, phased Systems & reactive index |
| texture | 29 | Texture auto-loading |
| components | 18 | Sync, reapplyProp, preload |
| visibility | 16 | Recursive visibility toggling |
| debug | 14 | Debug utilities & profiling |
| integration | 13 | Real Solid reactivity + renderer |
| contexts | 12 | Context providers & accessors |
| meta | 11 | Metadata & delta system |
| events | 9 | Event name resolution |
| store-compat | 8 | SolidJS store compatibility |
| scene-stack | 5 | Scene stack management |
| frame | 8 | Frame callback lifecycle & phase ordering |

## Entry Points

Solidion follows SolidJS's convention of splitting entry points by paradigm boundary.

```ts
// solidion — Daily API (L0–L1c). Most games only need this.
import { Game, Scene, Preload, Overlay, GameLoop } from "solidion";
import { Show, For, Index } from "solidion";
import { useGame, useScene, useParentNode } from "solidion";
import { useTween, useStateMachine, useSequence, useOverlap } from "solidion";
import { useSpring, useFollow, useOscillation, useVelocity } from "solidion";
import { SpringBehavior, OscillateBehavior, FollowBehavior, VelocityBehavior } from "solidion";

// solidion/ecs — Reactive ECS pattern (createStore + pure step functions + phased Systems + reactive index)
import { System, createSystemFactory, forActive, createIndex } from "solidion/ecs";
import { springStep, velocityStep, followStep, fsmStep, fsmSend, tweenStep, tweenLerp } from "solidion/ecs";

// solidion/core — Frame-aware escape hatch (L3–L4)
import { useFrame, useTime, render, effect, memo } from "solidion/core";
import { addDelta, removeDelta, getMeta, composeProp } from "solidion/core";
import { pushScene, popScene, getCurrentScene } from "solidion/core";

// solidion/debug — Dev-only utilities
import * as debug from "solidion/debug";
```

## Documentation

See [docs/solidion-spec.md](docs/solidion-spec.md) for the full design specification.

## Examples

See [examples/](examples/) for runnable demos.

- **[Breakout](examples/breakout/)** — Block breaker game demonstrating reactive signals, frame-loop physics, batch updates, and conditional state
- **[Null Pow!](examples/null-pow/)** — Pac-Man-style maze game with ghost AI, useOverlap collision, and useScene keyboard input
- **[Floppy Heads](examples/floppy-heads/)** — Flappy Bird-style game with procedural pipe generation and score tracking
- **[Nadion Defense](examples/nadion-defense/)** — Space Invaders-style tower defense with 40 reactive enemies and projectile pools
- **[Aquarium](examples/aquarium/)** — Hybrid ECS + hooks demo with fish, food, bubbles, jellyfish, and seaweed

## Why "Solidion"?

The name is a portmanteau of **Solid** (SolidJS) and **nadion** — a fictional subatomic particle from the Star Trek universe.

In Star Trek lore, a *phaser* fires nadion particles through a superconducting crystal to produce a directed energy beam. Solidion mirrors this metaphor: SolidJS's Signal system acts as the crystal, channeling fine-grained reactivity to drive Phaser GameObjects.

The `-ion` suffix also follows the naming convention of particles (*photon*, *electron*, *nadion*), giving the name a natural fit in Phaser's sci-fi lineage — which itself originated as a blend of "photon" and "maser" at [Photon Storm](https://photonstorm.com/), the studio behind the engine.

## Status

v0.1 — Architecture validated. Core renderer, hooks, behavior system, and frame synchronization are implemented and tested. Components (`<Game>`, `<Scene>`, `<Preload>`, `<Overlay>`) are implemented but require browser integration testing.

## License

MIT
