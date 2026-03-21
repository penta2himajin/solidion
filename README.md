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
    components/     # Game, Scene, Preload, Overlay
    renderer.ts     # solid-js/universal createRenderer implementation
    contexts.ts     # Solid contexts (Game, Scene, FrameManager, ParentNode)
    types.ts        # JSX IntrinsicElements type definitions
    index.ts        # Public API
  tests/            # Unit tests (79) + integration tests (13) + component tests (9)
  docs/             # Design specification
  examples/         # Runnable demos
```

## Testing

```bash
npm install
npm test
```

101 tests across 10 suites:

| Suite | Tests | Scope |
|---|---|---|
| meta | 11 | Metadata & delta system |
| events | 9 | Event name resolution |
| props | 14 | Property application & composition |
| texture | 9 | Texture auto-loading |
| scene-stack | 5 | Scene stack management |
| frame | 5 | Frame callback lifecycle |
| renderer | 12 | Renderer logic (mock Phaser) |
| hooks | 14 | State machine & sequence logic |
| components | 9 | Sync, reapplyProp, preload |
| **integration** | **13** | **Real Solid reactivity + renderer** |

## Exports

```ts
// Components
import { Game, Scene, Preload, Overlay } from "solidion";

// Hooks
import { useFrame, useTime, useTween, useStateMachine, useSequence } from "solidion";
import { useSpring, useFollow, useOscillation, useVelocity } from "solidion";

// Behavior components (L1c)
import { SpringBehavior, OscillateBehavior, FollowBehavior, VelocityBehavior } from "solidion";

// Contexts
import { useGame, useScene, useParentNode } from "solidion";

// L4 utilities
import { getCurrentScene, pushScene, popScene, addDelta, removeDelta } from "solidion";
```

## Documentation

See [docs/solidion-spec.md](docs/solidion-spec.md) for the full design specification.

## Examples

See [examples/](examples/) for runnable demos.

- **[Breakout](examples/breakout/)** — Block breaker game demonstrating reactive signals, frame-loop physics, batch updates, and conditional state

## Why "Solidion"?

The name is a portmanteau of **Solid** (SolidJS) and **nadion** — a fictional subatomic particle from the Star Trek universe.

In Star Trek lore, a *phaser* fires nadion particles through a superconducting crystal to produce a directed energy beam. Solidion mirrors this metaphor: SolidJS's Signal system acts as the crystal, channeling fine-grained reactivity to drive Phaser GameObjects.

The `-ion` suffix also follows the naming convention of particles (*photon*, *electron*, *nadion*), giving the name a natural fit in Phaser's sci-fi lineage — which itself originated as a blend of "photon" and "maser" at [Photon Storm](https://photonstorm.com/), the studio behind the engine.

## Status

v0.1 — Architecture validated. Core renderer, hooks, behavior system, and frame synchronization are implemented and tested. Components (`<Game>`, `<Scene>`, `<Preload>`, `<Overlay>`) are implemented but require browser integration testing.

## License

MIT
