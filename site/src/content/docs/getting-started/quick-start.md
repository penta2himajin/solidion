---
title: Quick Start
description: Build your first Solidion game
---

Let's build a simple interactive scene with Solidion.

## 1. Create a Game Component

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

## 2. Mount

```tsx
import { createRoot } from "solid-js";

createRoot(() => {
  const el = App();
  document.getElementById("game")?.appendChild(el);
});
```

That's it! The `<Game>` component boots Phaser internally and returns an HTMLElement. The score updates reactively when you click the star — no re-rendering of the entire scene.

## Next Steps

- [Components](/guides/components/) — Learn about available components
- [Hooks](/guides/hooks/) — Add animations and state machines
- [Examples](/examples/breakout/) — See full game examples
