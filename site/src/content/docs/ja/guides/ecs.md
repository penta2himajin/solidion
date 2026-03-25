---
title: ECS（Entity Component System）
description: 大量エンティティ処理のためのデータ駆動パターン
---

ECSパターン（`solidion/ecs`）は、同じ種類のエンティティが大量にあるゲーム向けです — 10匹以上の魚、30発以上の弾丸など。SolidJSの`createStore`と純粋なステップ関数、宣言的な`System`コンポーネントを組み合わせます。

```tsx
import { System, forActive, createSystemFactory } from "solidion/ecs";
import {
  springStep, velocityStep, followStep,
  oscillationStep, fsmStep, fsmSend,
  tweenStep, tweenLerp,
} from "solidion/ecs";
```

## ECS vs Hooksの使い分け

| パターン | 使用場面 |
|---------|---------|
| **Hooks**（`useSpring`、`useStateMachine`など） | 少数のエンティティ（1〜5）、エンティティごとに固有の複雑な動作 |
| **ECS**（`System` + ステップ関数） | 多数のエンティティ（10+）、共通の動作定義、単一ストア |

## 純粋ステップ関数

ステップ関数は`useSpring`や`useOscillation`などの内部で使われているアルゴリズムと同じものを、バルク処理用の純粋関数として抽出したものです。現在の状態 + 設定 + デルタ時間を受け取り、次の状態を返します。

```tsx
import { springStep, type SpringState, type SpringConfig } from "solidion/ecs";

// スプリングをdelta秒分進める
const next: SpringState = springStep(
  { x: 0, y: 0, vx: 0, vy: 0 },
  { targetX: 100, targetY: 200, stiffness: 120, damping: 14 },
  1 / 60,
);
```

利用可能なステップ関数：

| 関数 | 説明 |
|------|------|
| `springStep` | 減衰スプリングシミュレーション |
| `oscillationStep` | サイン波オシレーション |
| `velocityStep` | 速度 + 加速度 + 境界/バウンス |
| `followStep` | ターゲットへの指数関数的減衰 |
| `fsmStep` / `fsmSend` | 有限ステートマシン遷移 |
| `tweenStep` / `tweenLerp` | トゥイーン補間 |

## Systemコンポーネント

`System`はフレームごとのコールバックを登録します。`<Game>`または`<Scene>`内に配置してください — JSXの子要素の順序が実行順序を決定します。

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

ストア配列内のアクティブなエンティティのみを反復するヘルパー：

```tsx
forActive(store.entities, (entity, index) => {
  // entity.active !== false のエンティティのみ呼ばれる
  const next = velocityStep(entity, entity.config, delta / 1000);
  setStore("entities", index, next);
});
```

## 完全な例

[examples/aquarium/](https://github.com/penta2himajin/solidion/tree/main/examples/aquarium)でECS + hooksのハイブリッドデモ（魚、餌、泡など）の完全な例をご覧ください。
