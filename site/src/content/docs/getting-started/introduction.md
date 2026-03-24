---
title: Introduction
description: What is Solidion and why use it
---

Solidion is a custom renderer for [Phaser 3](https://phaser.io/) built on [SolidJS](https://www.solidjs.com/)'s universal renderer. It lets you build Phaser games using declarative JSX with fine-grained reactivity.

## Why Solidion?

- **No Virtual DOM** — SolidJS directly manipulates Phaser GameObjects, just like it does with DOM elements
- **Fine-Grained Reactivity** — Only the properties that change get updated, no diffing overhead
- **Familiar DX** — If you know SolidJS and Phaser, you already know Solidion
- **Progressive Disclosure** — Start with simple JSX, go deeper when you need to

## Architecture

Solidion follows a layered architecture:

| Layer | What | Example |
|-------|------|---------|
| **L0** | JSX primitives | `<sprite>`, `<text>`, `<rectangle>` |
| **L1** | Hooks & Behaviors | `useTween()`, `useSpring()`, `<SpringBehavior>` |
| **L2** | Resources | Scene-aware async loading |
| **L3** | Frame | Per-frame update loop |
| **L4** | Raw Phaser | Direct Phaser API access |

## Next Steps

- [Installation](/getting-started/installation/) — Add Solidion to your project
- [Quick Start](/getting-started/quick-start/) — Build your first game
