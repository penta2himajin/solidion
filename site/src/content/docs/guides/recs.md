---
title: RECS (Reactive ECS)
description: Reactive Entity Component System for bulk entity processing
---

RECS (`solidion/recs`) is Solidion's Reactive Entity Component System — for games with many entities of the same type (10+ fish, 30+ bullets, etc.).

Unlike traditional ECS where every system imperatively scans all entities every frame, RECS leverages SolidJS's fine-grained reactivity so that store changes propagate automatically to rendering, `createIndex` tracks entity state at O(1) per change, and phased Systems separate discrete reactions from continuous physics.

```tsx
import {
  System, forActive, createIndex, createSystemFactory,
  springStep, velocityStep, followStep,
  oscillationStep, fsmStep, fsmSend,
  tweenStep, tweenLerp,
} from "solidion/recs";
```

## When to use RECS vs Hooks

| Pattern | When |
|---------|------|
| **Hooks** (`useSpring`, `useStateMachine`, ...) | Few entities (1–5), unique complex behavior per entity |
| **RECS** (`System` + step functions) | Many entities (10+), shared behavior definitions, single store |

## Pure Step Functions

Step functions are the same algorithms used inside `useSpring`, `useOscillation`, etc., extracted as pure functions for bulk processing. They take current state + config + delta time, and return the next state.

```tsx
import { springStep, type SpringState, type SpringConfig } from "solidion/recs";

const next: SpringState = springStep(
  { x: 0, y: 0, vx: 0, vy: 0 },
  { targetX: 100, targetY: 200, stiffness: 120, damping: 14 },
  1 / 60,
);
```

Available step functions:

| Function | Description |
|----------|-------------|
| `springStep` | Damped spring simulation |
| `oscillationStep` | Sine-wave oscillation |
| `velocityStep` | Velocity + acceleration + bounds/bounce |
| `followStep` | Exponential decay toward a target |
| `fsmStep` / `fsmSend` | Finite state machine transitions |
| `tweenStep` / `tweenLerp` | Tween interpolation |

## System Phases

Systems support three execution phases per frame. This allows discrete logic (state reactions, collision detection) to run separately from continuous physics.

| Phase | When it runs | Use for |
|-------|-------------|---------|
| `"pre"` | Before physics | Reacting to store changes from the previous frame |
| `"main"` | Default | Physics, timers, dt integration |
| `"post"` | After physics | Reacting to current frame's physics results |

```tsx
<Game>
  <System phase="pre" update={() => {
    // FSM state changed last frame → set new targets
  }} />
  <System update={(time, delta) => {
    // Spring physics toward targets (default "main" phase)
    forActive(store.fish, (f, i) => {
      const next = springStep(f, f.config, delta / 1000);
      setStore("fish", i, next);
    });
  }} />
  <System phase="post" update={() => {
    // Fish reached food? → trigger eating state
  }} />
</Game>
```

Without `phase`, Systems run in `"main"`. Within each phase, execution follows JSX order.

## createIndex

Reactive index set for O(1) entity tracking. Instead of scanning all N entities every frame, track which indices match a condition and iterate only those.

```tsx
const hungrySet = createIndex(
  () => store.fish.length,
  (i) => store.fish[i].active && store.fish[i].fsmState === "hungry",
);

// When fish[3].fsmState changes to "hungry", hungrySet adds 3 (O(1))
// When fish[3].fsmState changes to "idle", hungrySet removes 3 (O(1))

<System phase="pre" update={() => {
  for (const i of hungrySet) {
    // Only hungry fish — O(hungrySet.size), not O(N)
  }
}} />
```

`createIndex` uses SolidJS's fine-grained reactivity internally: one `createEffect` per entity tracks its predicate, so only the entity whose property changed is re-evaluated.

## forActive

Helper to iterate only active entities in a store array:

```tsx
forActive(store.entities, (entity, index) => {
  const next = velocityStep(entity, entity.config, delta / 1000);
  setStore("entities", index, next);
});
```

## Full Example

See [examples/aquarium/](https://github.com/penta2himajin/solidion/tree/main/examples/aquarium) for a complete hybrid RECS + hooks demo with fish, food, bubbles, and more.
