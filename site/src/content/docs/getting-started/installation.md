---
title: Installation
description: How to install Solidion
---

## Prerequisites

- Node.js 18+
- A package manager (npm, pnpm, or yarn)

## Install

```bash
npm install solidion solid-js phaser
```

## Vite Configuration

Solidion requires the SolidJS Vite plugin configured for universal rendering:

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

Add the Solidion JSX types to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

## Next Steps

- [Quick Start](/getting-started/quick-start/) — Build your first game
