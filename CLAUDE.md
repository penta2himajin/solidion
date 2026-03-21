# solidion

SolidJS custom renderer for Phaser 3.

## コマンド実行

```bash
cd /c/Users/penta/claude/solidion

# テスト
mise exec -- npx vitest run          # 全テスト実行
mise exec -- npx vitest run <file>   # 単一ファイル
mise exec -- npx vitest --watch      # ウォッチモード

# 型チェック
mise exec -- npx tsc --noEmit
```

## 技術スタック

- SolidJS (solid-js/universal) + Phaser 3
- TypeScript + Vite + Vitest
- Node.js 22 (mise経由)

## プロジェクト構造

```
src/
  core/           # Renderer内部: meta, props, events, texture, scene-stack, frame, sync
  hooks/          # L1a/L1b hooks: useTween, useSpring, useStateMachine, etc.
  behaviors/      # L1c composition: SpringBehavior, OscillateBehavior, etc.
  components/     # Game, Scene, Preload, Overlay
  renderer.ts     # solid-js/universal createRenderer
  contexts.ts     # Solid contexts
  types.ts        # JSX IntrinsicElements
  index.ts        # Public API
tests/            # Unit (79) + Integration (13) + Component (9) = 101 tests
docs/             # Design specification
examples/         # Runnable demos (breakout)
```

## 設計原則

- **No virtual nodes**: SolidJSの哲学に従い、Phaser GameObjectを直接操作
- **Progressive disclosure**: L0(JSX)→L1(hooks/behaviors)→L2(resources)→L3(frame)→L4(raw Phaser)
- **Declarative behaviors**: Spring, Tween, StateMachine等もSignalまたはJSX childrenで宣言的に

## 開発ワークフロー

- コミットは各ステップの動作確認後に行う
- テストが全パスしていることを確認してからコミット
