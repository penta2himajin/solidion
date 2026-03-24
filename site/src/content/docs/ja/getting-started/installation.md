---
title: インストール
description: Solidionのインストール方法
---

## 前提条件

- Node.js 18+
- パッケージマネージャー（npm、pnpm、またはyarn）

## インストール

```bash
npm install solidion solid-js phaser
```

## Vite設定

Solidionはユニバーサルレンダリング用に設定されたSolidJS Viteプラグインが必要です：

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    solidPlugin({
      solid: {
        generate: "universal",
        moduleName: "solidion/renderer",
      },
    }),
  ],
});
```

## TypeScript

`tsconfig.json`にSolidionのJSX型を追加します：

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

## 次のステップ

- [クイックスタート](/ja/getting-started/quick-start/) — 最初のゲームを作ってみる
