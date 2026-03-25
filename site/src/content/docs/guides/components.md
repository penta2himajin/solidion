---
title: Components
description: Built-in Solidion components
---

Solidion provides high-level components for managing Phaser's game lifecycle.

```tsx
import { Game, Scene, Preload, Overlay, GameLoop, Show, For, Index } from "solidion";
```

## Game

The root component that creates a Phaser game instance.

```tsx
<Game width={800} height={600} backgroundColor={0x000000}>
  {/* Scenes go here */}
</Game>
```

## Scene

Defines a Phaser scene. All game objects must be placed inside a Scene.

```tsx
<Scene name="main">
  <sprite texture="player" x={100} y={200} />
</Scene>
```

## Preload

Handle asset loading declaratively.

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

Layer scenes on top of each other for UI overlays, pause menus, etc.

```tsx
<Game>
  <Scene name="game">{/* Game content */}</Scene>
  <Overlay name="hud">{/* HUD overlay */}</Overlay>
</Game>
```

## Game Objects

All Phaser GameObjects are available as lowercase JSX elements:

| Element | Phaser Class |
|---------|-------------|
| `<sprite>` | `Phaser.GameObjects.Sprite` |
| `<image>` | `Phaser.GameObjects.Image` |
| `<text>` | `Phaser.GameObjects.Text` |
| `<rectangle>` | `Phaser.GameObjects.Rectangle` |
| `<circle>` | `Phaser.GameObjects.Circle` |
| `<container>` | `Phaser.GameObjects.Container` |
| `<tilemap>` | `Phaser.Tilemaps.Tilemap` |
| ... | and more |
