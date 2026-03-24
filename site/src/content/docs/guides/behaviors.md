---
title: Behaviors
description: Declarative behavior components for composition
---

Behaviors (L1c layer) provide declarative composition for common game patterns. They can be used as JSX children of game objects.

## SpringBehavior

Attach spring physics to a game object property.

```tsx
<sprite texture="player" x={100} y={300}>
  <SpringBehavior
    property="x"
    target={() => targetX()}
    stiffness={120}
    damping={14}
  />
</sprite>
```

## OscillateBehavior

Create oscillating (sine wave) animations.

```tsx
<sprite texture="gem" x={400} y={300}>
  <OscillateBehavior
    property="y"
    amplitude={20}
    frequency={2}
  />
</sprite>
```

## Composing Behaviors

Multiple behaviors can be combined on a single game object:

```tsx
<sprite texture="enemy" x={200} y={200}>
  <SpringBehavior property="x" target={() => playerX()} stiffness={60} damping={10} />
  <OscillateBehavior property="y" amplitude={10} frequency={3} />
</sprite>
```

This enemy would chase the player on the X axis with spring physics while bobbing up and down.
