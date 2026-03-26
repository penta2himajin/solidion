---
title: Hooks（フック）
description: アニメーション、ステートマシンなどのSolidion hooks
---

SolidionはPhaserの機能をSolidJSのリアクティビティと統合するhooks（L1aレイヤー）を提供します。

```tsx
import { useTween, useStateMachine, useSequence, useOverlap } from "solidion";  // L1a
import { useSpring, useFollow, useOscillation, useVelocity } from "solidion";  // L1b
```

## useTween

Phaserトゥイーンでプロパティをアニメーション、リアクティブに制御します。

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

物理ベースのスプリングアニメーション。

```tsx
const { value } = useSpring({
  target: () => targetX(),
  stiffness: 120,
  damping: 14,
});

<sprite x={value()} y={300} texture="player" />;
```

## useStateMachine

ゲームロジックのための宣言的な有限ステートマシン。

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

SolidJSのライフサイクルと統合されたフレームごとの更新ループ。フレーム単位の思考が必要なため、`solidion/core`からインポートします。

```tsx
import { useFrame } from "solidion/core";

useFrame((time, delta) => {
  setX((x) => x + speed * delta);
});
```
