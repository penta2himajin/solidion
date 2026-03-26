---
title: Hooks
description: Solidion hooks for animations, state machines, and more
---

Solidion provides hooks (L1a layer) that integrate Phaser features with SolidJS reactivity.

```tsx
import { useTween, useStateMachine, useSequence, useOverlap } from "solidion";  // L1a
import { useSpring, useFollow, useOscillation, useVelocity } from "solidion";  // L1b
```

## useTween

Animate properties with Phaser tweens, controlled reactively.

```tsx
const { value, play, stop } = useTween({
  from: 0,
  to: 100,
  duration: 1000,
  ease: "Sine.easeInOut",
});

<sprite x={value()} y={300} texture="ball" />;
```

## useSpring

Physics-based spring animations.

```tsx
const { value } = useSpring({
  target: () => targetX(),
  stiffness: 120,
  damping: 14,
});

<sprite x={value()} y={300} texture="player" />;
```

## useStateMachine

Declarative finite state machines for game logic.

```tsx
const { state, send } = useStateMachine({
  initial: "idle",
  states: {
    idle: { on: { JUMP: "jumping" } },
    jumping: { on: { LAND: "idle" } },
  },
});
```

## useFrame (solidion/core)

Per-frame update loop integrated with SolidJS lifecycle. Available from `solidion/core` since it requires frame-aware thinking.

```tsx
import { useFrame } from "solidion/core";

useFrame((time, delta) => {
  setX((x) => x + speed * delta);
});
```
