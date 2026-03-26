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
tests/            # 443 tests across 15 suites
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

## ゲームロジックのバグ検証手法

exampleのゲームロジック（特に状態マシン＋物理移動の組み合わせ）のバグ調査には**直交表（モード × 処理ポイント）**による網羅検証が有効。

### 手順

1. **状態（モード）を列挙**: ゲーム内エンティティが取りうる全状態を洗い出す
2. **処理ポイントを列挙**: 1フレーム内でエンティティが通過する全処理を分解する（速度選択、移動前バリデーション、方向選択、方向選択後バリデーション、モード遷移、lerp補間 等）
3. **直交表を作成**: モード × 処理ポイントの全セルについて、実装が正しいか検証する
4. **フォールバック経路に注意**: 「全選択肢が除外された場合」のデフォルト値が安全か確認する（例: bestDir初期値が未検証の方向だと壁すり抜けの原因になる）
5. **状態遷移の境界**: あるモードから別のモードに切り替わった直後、前モードの値（target, dir, progress）が新モードと整合するか確認する

### null-powで発見されたパターン

- **方向反転後の壁チェック漏れ**: scatter↔chase切替やfrightened突入で方向を反転する際、反転先が壁かチェックしていなかった → `reverseGhostDir`ヘルパーで反転+即時バリデーション
- **chooseDir のフォールバック値**: `bestDir = gs.dir`（現在方向）をデフォルトにしていたため、全方向が除外されると壁方向を返していた → `bestDir = -1` + reverseフォールバック
- **frightenedのデッドエンド**: 反転禁止フィルタにより唯一の脱出路（反転）が除外されスタック → reverseをlast resortとして許可
- **lerp補間の視覚的すり抜け**: 実際の移動はブロックされていても、`lerpC = col + DX[dir] * progress` で壁方向に補間される → 反転直後に方向を検証し壁ならprogress=0+有効方向に即切替
