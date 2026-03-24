---
title: Hooks（フック）
description: アニメーション、ステートマシンなどのSolidion hooks
---

SolidionはPhaserの機能をSolidJSのリアクティビティと統合するhooks（L1aレイヤー）を提供します。

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

## useFrame

SolidJSのライフサイクルと統合されたフレームごとの更新ループ。

```tsx
useFrame((time, delta) => {
  setX((x) => x + speed * delta);
});
```
