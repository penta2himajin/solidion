---
title: クイックスタート
description: 最初のSolidionゲームを作る
---

Solidionでシンプルなインタラクティブシーンを作りましょう。

## 1. Gameコンポーネントを作成

```tsx
import { Game, Scene } from "solidion";
import { createSignal } from "solid-js";

function App() {
  const [score, setScore] = createSignal(0);

  return (
    <Game width={800} height={600} backgroundColor={0x1a1a2e}>
      <Scene name="main">
        <text
          x={400}
          y={50}
          text={`Score: ${score()}`}
          origin={0.5}
          style={{ fontSize: "32px", color: "#ffffff" }}
        />
        <sprite
          x={400}
          y={300}
          texture="star"
          interactive
          onPointerdown={() => setScore((s) => s + 1)}
        />
      </Scene>
    </Game>
  );
}
```

## 2. レンダリング

```tsx
import { render } from "solidion";

render(() => <App />, document.getElementById("game")!);
```

これだけです！星をクリックするとスコアがリアクティブに更新されます — シーン全体の再レンダリングはありません。

## 次のステップ

- [コンポーネント](/ja/guides/components/) — 利用可能なコンポーネントについて学ぶ
- [Hooks](/ja/guides/hooks/) — アニメーションやステートマシンを追加
- [サンプル](/ja/examples/breakout/) — 完全なゲームのサンプルを見る
