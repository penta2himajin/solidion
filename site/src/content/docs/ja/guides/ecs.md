---
title: ECS（Entity Component System）
description: 大量エンティティ処理のためのデータ駆動パターン
---

ECSパターン（`solidion/ecs`）は、同じ種類のエンティティが大量にあるゲーム向けです — 10匹以上の魚、30発以上の弾丸など。SolidJSの`createStore`と純粋なステップ関数、フェーズ付き`System`コンポーネント、リアクティブインデックスセットを組み合わせます。

```tsx
import {
  System, forActive, createIndex, createSystemFactory,
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

## Systemフェーズ

Systemは1フレーム内で3つの実行フェーズをサポートします。離散的なロジック（状態変化への反応、衝突判定）と連続的な物理を分離できます。

| フェーズ | 実行タイミング | 用途 |
|---------|-------------|------|
| `"pre"` | 物理の前 | 前フレームのstore変更への反応 |
| `"main"` | デフォルト | 物理、タイマー、dt積分 |
| `"post"` | 物理の後 | 今フレームの物理結果への反応 |

```tsx
<Game>
  <System phase="pre" update={() => {
    // 前フレームでFSM状態が変化 → 新しいターゲットを設定
  }} />
  <System update={(time, delta) => {
    // ターゲットに向かうスプリング物理（デフォルトの"main"フェーズ）
    forActive(store.fish, (f, i) => {
      const next = springStep(f, f.config, delta / 1000);
      setStore("fish", i, next);
    });
  }} />
  <System phase="post" update={() => {
    // 魚が食べ物に到達した？ → 食事状態に遷移
  }} />
</Game>
```

`phase`を指定しない場合、Systemは`"main"`で実行されます。各フェーズ内ではJSXの順序が実行順序になります。

## createIndex

O(1)のエンティティ追跡のためのリアクティブインデックスセット。毎フレームN個のエンティティを全走査する代わりに、条件に一致するインデックスを追跡し、それだけを反復処理します。

```tsx
const hungrySet = createIndex(
  () => store.fish.length,
  (i) => store.fish[i].active && store.fish[i].fsmState === "hungry",
);

// fish[3].fsmStateが"hungry"に変化 → hungrySetに3を追加 (O(1))
// fish[3].fsmStateが"idle"に変化 → hungrySetから3を削除 (O(1))

<System phase="pre" update={() => {
  for (const i of hungrySet) {
    // hungryな魚だけ — O(hungrySet.size), O(N)ではない
  }
}} />
```

`createIndex`はSolidJSの細粒度リアクティビティを内部的に使用します。エンティティごとに1つの`createEffect`がpredicateを追跡するため、プロパティが変更されたエンティティだけが再評価されます。

## forActive

ストア配列内のアクティブなエンティティのみを反復するヘルパー：

```tsx
forActive(store.entities, (entity, index) => {
  const next = velocityStep(entity, entity.config, delta / 1000);
  setStore("entities", index, next);
});
```

## 完全な例

[examples/aquarium/](https://github.com/penta2himajin/solidion/tree/main/examples/aquarium)でECS + hooksのハイブリッドデモ（魚、餌、泡など）の完全な例をご覧ください。
