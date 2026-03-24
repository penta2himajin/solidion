---
title: Behaviors
description: コンポジション用の宣言的Behaviorコンポーネント
---

Behaviors（L1cレイヤー）は一般的なゲームパターンのための宣言的なコンポジションを提供します。ゲームオブジェクトのJSX子要素として使用できます。

## SpringBehavior

ゲームオブジェクトのプロパティにスプリング物理を付与します。

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

振動（サイン波）アニメーションを作成します。

```tsx
<sprite texture="gem" x={400} y={300}>
  <OscillateBehavior
    property="y"
    amplitude={20}
    frequency={2}
  />
</sprite>
```

## Behaviorの合成

複数のBehaviorを1つのゲームオブジェクトに組み合わせることができます：

```tsx
<sprite texture="enemy" x={200} y={200}>
  <SpringBehavior property="x" target={() => playerX()} stiffness={60} damping={10} />
  <OscillateBehavior property="y" amplitude={10} frequency={3} />
</sprite>
```

この敵はスプリング物理でプレイヤーをX軸方向に追いかけながら、上下に揺れます。
