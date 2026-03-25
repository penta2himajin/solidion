---
title: ECS (Entity Component System)
description: Data-driven pattern for bulk entity processing
---

The ECS pattern (`solidion/ecs`) is for games with many entities of the same type — 10+ fish, 30+ bullets, etc. It combines SolidJS `createStore` with pure step functions and declarative `System` components.

```tsx
import { System, forActive, createSystemFactory } from "solidion/ecs";
import {
  springStep, velocityStep, followStep,
  oscillationStep, fsmStep, fsmSend,
  tweenStep, tweenLerp,
} from "solidion/ecs";
```

## When to use ECS vs Hooks

| Pattern | When |
|---------|------|
| **Hooks** (`useSpring`, `useStateMachine`, ...) | Few entities (1–5), unique complex behavior per entity |
| **ECS** (`System` + step functions) | Many entities (10+), shared behavior definitions, single store |

## Pure Step Functions

Step functions are the same algorithms used inside `useSpring`, `useOscillation`, etc., extracted as pure functions for bulk processing. They take current state + config + delta time, and return the next state.

```tsx
import { springStep, type SpringState, type SpringConfig } from "solidion/ecs";

// Advance a spring by delta seconds
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

## System Component

`System` registers a per-frame callback. Place it inside `<Game>` or `<Scene>` — JSX child order determines execution order.

```tsx
const [store, setStore] = createStore({ fish: [...] });

<Game>
  <System
    when={() => phase() === "play"}
    update={(time, delta) => {
      forActive(store.fish, (f, i) => {
        const next = springStep(f, f.config, delta / 1000);
        setStore("fish", i, next);
      });
    }}
  />
</Game>
```

## forActive

Helper to iterate only active entities in a store array:

```tsx
forActive(store.entities, (entity, index) => {
  // Only called for entities where entity.active !== false
  const next = velocityStep(entity, entity.config, delta / 1000);
  setStore("entities", index, next);
});
```

## Full Example

See [examples/aquarium/](https://github.com/penta2himajin/solidion/tree/main/examples/aquarium) for a complete hybrid ECS + hooks demo with fish, food, bubbles, and more.
