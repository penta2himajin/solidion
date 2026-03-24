---
title: コンポーネント
description: Solidionの組み込みコンポーネント
---

SolidionはPhaserのゲームライフサイクルを管理するための高レベルコンポーネントを提供します。

## Game

Phaserゲームインスタンスを作成するルートコンポーネントです。

```tsx
<Game width={800} height={600} backgroundColor={0x000000}>
  {/* シーンをここに配置 */}
</Game>
```

## Scene

Phaserシーンを定義します。すべてのゲームオブジェクトはScene内に配置する必要があります。

```tsx
<Scene name="main">
  <sprite texture="player" x={100} y={200} />
</Scene>
```

## Preload

アセットの読み込みを宣言的に処理します。

```tsx
<Scene name="main">
  <Preload
    assets={[
      { type: "image", key: "player", url: "/assets/player.png" },
      { type: "spritesheet", key: "coins", url: "/assets/coins.png", frameConfig: { frameWidth: 32, frameHeight: 32 } },
    ]}
  />
  <sprite texture="player" x={100} y={200} />
</Scene>
```

## Overlay

UIオーバーレイやポーズメニューなど、シーンを重ねて表示します。

```tsx
<Game>
  <Scene name="game">{/* ゲームコンテンツ */}</Scene>
  <Overlay name="hud">{/* HUDオーバーレイ */}</Overlay>
</Game>
```

## ゲームオブジェクト

すべてのPhaser GameObjectsは小文字のJSX要素として利用できます：

| 要素 | Phaserクラス |
|------|-------------|
| `<sprite>` | `Phaser.GameObjects.Sprite` |
| `<image>` | `Phaser.GameObjects.Image` |
| `<text>` | `Phaser.GameObjects.Text` |
| `<rectangle>` | `Phaser.GameObjects.Rectangle` |
| `<circle>` | `Phaser.GameObjects.Circle` |
| `<container>` | `Phaser.GameObjects.Container` |
| `<tilemap>` | `Phaser.Tilemaps.Tilemap` |
| ... | その他多数 |
