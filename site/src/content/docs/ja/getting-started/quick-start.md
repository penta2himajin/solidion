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

## 2. マウント

```tsx
import { createRoot } from "solid-js";

createRoot(() => {
  const el = App();
  document.getElementById("game")?.appendChild(el);
});
```

これだけです！`<Game>`コンポーネントがPhaserを内部で起動し、HTMLElementを返します。星をクリックするとスコアがリアクティブに更新されます — シーン全体の再レンダリングはありません。

## 次のステップ

- [コンポーネント](/ja/guides/components/) — 使えるコンポーネント一覧
- [Hooks](/ja/guides/hooks/) — アニメーションやステートマシンの追加
- [サンプル](/ja/examples/breakout/) — 完成したゲームの実例を見る
