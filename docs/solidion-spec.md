# Solidion — Design Specification v0.1

## Overview

Solidion is a SolidJS custom renderer for Phaser 3. It uses createRenderer from `solid-js/universal` to enable declarative JSX descriptions of Phaser's GameObject tree.

### Design Philosophy

- **Minimize cognitive cost** — Eliminate the "infrastructure code" such as Phaser's preload/create/update separation, procedural object management, and manual state-to-rendering synchronization
- **Progressive Disclosure** — Start simple, and escalate control granularity on a per-component basis as needed
- **No virtual nodes** — Inheriting SolidJS's "no virtual DOM" philosophy, directly manipulate Phaser GameObjects
- **Declarative composition of behaviors** — Declaratively describe and compose not just existence but also behaviors (tweens, state transitions, continuous updates)

### Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Application | User code (TSX) | Game logic |
| Solidion | Custom renderer + Hooks + Behavior primitives | Declarative API |
| SolidJS | Reactivity + Compiler | State management & update optimization |
| Phaser 3 | Rendering engine + Physics + Asset management | Runtime |

---

## Level Structure (Levels)

Depending on game complexity, use only the levels needed on a per-component basis. Adding advanced implementations only raises the level for that specific part.

| Level | Target | Tools Used |
|---|---|---|
| L0 | Declaring existence | JSX elements, props binding |
| L1a | Discrete behaviors | useTween, useStateMachine, useSequence |
| L1b | Continuous behaviors | useSpring, useFollow, useOscillation, useVelocity |
| L1c | Behavior composition | `<Spring>`, `<Oscillate>` and other JSX behavior components |
| L2 | Resource management | Preload, explicit Scene |
| L3 | Frame control | useFrame |
| L4 | Direct Phaser access | useScene, ref, imperative code inside onMount |

### Cases Requiring L3 (Exceptional Situations)

- N-body interactions (boids, etc.)
- Custom physics
- Bulk updates of large numbers of objects
- Special rendering not available in Phaser primitives

---

## Renderer Core

### Approach: Direct Manipulation (No Virtual Nodes)

Leveraging SolidJS's synchronous top-down execution, the Scene reference is guaranteed to be resolved at `createElement` time. Phaser GameObjects are created immediately and manipulated directly without any intermediate representation.

### Scene Stack

Scene references are managed as a module-level stack, mapping the component hierarchy to Scene scopes.

```
let _currentScene: Phaser.Scene | null = null
const sceneStack: Phaser.Scene[] = []

function pushScene(scene: Phaser.Scene) {
  sceneStack.push(scene)
  _currentScene = scene
}

function popScene() {
  sceneStack.pop()
  _currentScene = sceneStack[sceneStack.length - 1] ?? null
}
```

### Metadata

Instead of virtual nodes, minimal Solidion management metadata is attached to Phaser objects.

```ts
interface SolidionMeta {
  children: Phaser.GameObjects.GameObject[]
  handlers: Map<string, Function>
}
```

### createRenderer Method Mapping

#### createElement(type: string)

Resolves a tag name to a Phaser class and immediately creates a GameObject using `_currentScene`.

```ts
function createElement(type: string): Phaser.GameObjects.GameObject {
  const scene = _currentScene!
  switch (type) {
    case "sprite":    return new Phaser.GameObjects.Sprite(scene, 0, 0, "")
    case "container": return new Phaser.GameObjects.Container(scene, 0, 0)
    case "text":      return new Phaser.GameObjects.Text(scene, 0, 0, "", {})
    case "rectangle": return new Phaser.GameObjects.Rectangle(scene, 0, 0, 0, 0)
    case "image":     return new Phaser.GameObjects.Image(scene, 0, 0, "")
    case "nineslice": return new Phaser.GameObjects.NineSlice(scene, 0, 0, "", undefined, 0, 0, 0, 0)
    case "zone":      return new Phaser.GameObjects.Zone(scene, 0, 0, 0, 0)
    // ...
  }
}
```

In the initial phase, an explicit mapping dictionary approach is used. This can later be migrated to dynamic resolution (automatic tag name to Phaser class mapping).

#### createTextNode(value: string)

Held as a lightweight object. No actual entity is created on the Phaser side. When the parent is a Phaser.GameObjects.Text, it is reflected via the parent's setText().

#### setProperty(node, name, value)

Directly sets properties or event listeners on Phaser objects. Property names are normalized (readable naming that doesn't require Phaser knowledge).

For event handling, the previous handler is tracked via the metadata handlers map, ensuring old listeners are properly removed when replaced.

```ts
function setProperty(
  node: Phaser.GameObjects.GameObject,
  name: string,
  value: any
) {
  if (name.startsWith("on")) {
    const event = resolveEventName(name)
    const meta = getMeta(node)
    const prev = meta.handlers.get(name)
    if (prev) node.off(event, prev)
    if (value) {
      if (!node.input) node.setInteractive()
      node.on(event, value)
      meta.handlers.set(name, value)
    } else {
      meta.handlers.delete(name)
    }
    // Automatic setInteractive management
    if (meta.handlers.size === 0 && node.input) {
      node.removeInteractive()
    }
  } else {
    applyProp(node, name, value)
  }
}
```

#### insertNode(parent, node, anchor)

Adds to the metadata children list. If the parent is a Container, the Phaser-side parent-child relationship is also established. Insertion order is managed via Phaser's depth value.

#### removeNode(parent, node)

Removes all event listeners, recursively cleans up child nodes, removes the Phaser-side parent-child relationship, destroys the GameObject, and releases metadata.

---

## Game / Scene Initialization Flow

Game and Scene are implemented as regular Solid components + Context Providers, not as createRenderer nodes. Only GameObjects are managed by createRenderer.

### Initialization Sequence

```
Solid render()
  └→ <Game> component
       └→ createResource: Phaser.Game boot
            └→ After boot completes:
                 └→ <GameContext.Provider>
                      └→ <DefaultScene>
                           └→ Phaser defaultScene create()
                                └→ pushScene(defaultScene)
                                └→ <SceneContext.Provider>
                                     └→ Rendering of props.children begins
                                          └→ createElement is called
                                               → Immediately instantiated via _currentScene
```

### Game Component

Responsible for creating and managing the Phaser.Game instance. Waits for boot completion using createResource, and blocks child tree construction with Suspense.

### Scene Component

At Level 0, Game automatically creates an implicit default Scene. Users don't need to write `<Scene>`. When a Scene is explicitly introduced at Level 2, GameObjects within that Scene belong to it.

Coexistence of the default Scene and explicit Scenes is managed via Scene stack push/pop.

---

## Automatic Texture Loading

### Level 0: Implicit On-Demand Loading

When a texture is specified via `setProperty`, the Phaser texture cache is checked. If not yet loaded, loading begins on the spot.

- Cached → Synchronous path, immediate setTexture
- Not loaded → visible=false during loading, visible=true + setTexture on load complete
- Another component already requested the same URL → Piggyback on the existing load Promise

When the texture URL changes reactively, the expected textureKey is recorded in metadata. On load completion, the texture is applied only if it matches the current expected value (natural cancellation).

### Level 2: Explicit Preload

The `<Preload>` component declares asset preloading. The child tree within the Preload scope is mounted only after all assets finish loading. This ensures all textures are cached at createElement time within child components, resolving via the synchronous path.

```tsx
<Preload
  assets={["/assets/atlas.json", "/assets/bg.png"]}
  fallback={<text text="Loading..." x={400} y={300} />}
>
  <sprite texture="/assets/bg.png" />
</Preload>
```

---

## Event System

### Naming Convention: Aliased Mapping

At Level 0, familiar names for web developers (onClick, etc.) are used. At Level 1, Phaser's exact event names can be used. Both are supported.

| Alias | Phaser Event | Level |
|---|---|---|
| onClick | pointerdown | L0 |
| onPointerDown | pointerdown | L1 |
| onPointerUp | pointerup | L1 |
| onPointerOver | pointerover | L1 |
| onPointerOut | pointerout | L1 |
| onPointerMove | pointermove | L1 |
| onDragStart | dragstart | L1 |
| onDrag | drag | L1 |
| onDragEnd | dragend | L1 |
| onAnimationComplete | animationcomplete | L1 |
| onDestroy | destroy | L1 |

### Automatic setInteractive Management

If any on* props are present, setInteractive() is called automatically. When all are removed, removeInteractive() is called. Users never need to be aware of setInteractive.

From Level 2 onward, the interactive prop enables hit area customization and drag activation.

### Bubbling

None. Follows Phaser's behavior. Bubbling is rarely needed in game UI; when necessary, the pattern of passing handlers from the parent component is used.

---

## Behavior Primitives

### Common Principles

- All value outputs are Solid Signals (Accessors)
- Reflection to GameObjects goes through the existing reactive path (setProperty)
- Phaser systems are used as sources that supply values to Signals. They do not directly manipulate GameObjects
- Scoped to components, with automatic cleanup via onCleanup

### L1a: Discrete Behaviors

#### useTween

Uses Phaser's tween engine via a proxy object. The tween target is the proxy, not the GameObject. On each frame's onUpdate, proxy values are copied to Signals.

Fully leverages Phaser's tween capabilities (30+ easings, pause/resume/seek/restart, yoyo/repeat/chain) while avoiding inconsistencies with Solid's reactive path.

```tsx
const bounce = useTween({
  from: { y: 300, scale: 1 },
  to: { y: 280, scale: 1.2 },
  duration: 200,
  yoyo: true,
  ease: "Bounce.easeOut",
  playing: () => fed(),
})

<sprite y={bounce().y} scale={bounce().scale} />
```

#### useStateMachine

The logic portion is implemented purely on the Solid side (Phaser has no state machine mechanism). Timers use Phaser's scene.time.delayedCall (synced with Scene Pause/Resume and timeScale).

```tsx
const machine = useStateMachine({
  initial: "idle",
  states: {
    idle: {
      animation: () => `character-${form()}-idle`,
      on: { INTERACT: "acting", CLICK: "reacting" }
    },
    acting: {
      animation: () => `character-${form()}-act`,
      duration: 800,
      onComplete: "idle",
      onEnter: () => playSound("action"),
    },
    reacting: {
      animation: () => `character-${form()}-react`,
      duration: 1500,
      onComplete: "idle",
    }
  }
})

<sprite texture={`/assets/${machine.animation()}`} onClick={() => machine.send("CLICK")} />
```

#### useSequence

Achieves timeline control through a combination of useTween and useStateMachine. Internal timers use Phaser's scene.time.delayedCall.

```tsx
const seq = useSequence([
  { action: "shake", duration: 300, onStart: () => playSound("shake") },
  { delay: 100 },
  { action: "pop", duration: 400 },
  { action: "collect", duration: 600 },
])
```

### L1b: Continuous Behaviors

Declaratively encapsulates recursive state dependencies (state(t) = f(state(t-1), dt)). Users only declare parameters and don't need to think about per-frame recursive calculations.

| Primitive | Mathematical Structure | Use Case |
|---|---|---|
| useSpring | Damped oscillation | Juice feel, wobble, bounce |
| useFollow | Exponential decay | Camera follow, smooth movement |
| useOscillation | Trigonometric functions | Floating, breathing animation |
| useVelocity | Integration (position, velocity, acceleration) | Projectiles, gravity fall |
| useTime | Time reference | Derivation via pure functions of time |

```tsx
const pos = useSpring({
  target: () => targetPos(),
  stiffness: 200,
  damping: 20,
  mass: 1,
})

<sprite x={pos().x} y={pos().y} />
```

The internal implementation solves differential equations each frame via useFrame, but the output surfaces as Signals.

### L1c: Declarative Behavior Composition

Behaviors are declared as JSX children and attached to GameObjects.

```tsx
<sprite texture="/assets/character.png" x={200} y={300}>
  <Spring target={() => targetPos()} stiffness={200} damping={20} />
  <Show when={excited()}>
    <Oscillate amplitude={{ y: 10 }} frequency={5} />
  </Show>
</sprite>
```

#### Composition Semantics

Behavior components output deltas (differences) relative to the parent GameObject's properties. The base value is the value specified in JSX props. Deltas from multiple behaviors are aggregated.

Composition rules vary depending on the property type:

| Property Type | Composition Method | Targets |
|---|---|---|
| Position | Addition | x, y, angle, rotation |
| Scale | Multiplication | scale, scaleX, scaleY |
| Opacity | Multiplication | alpha |
| Color | Override (last delta wins) | tint |
| Discrete values | Override | visible, texture |

```
Final x     = props x     + Spring's δx + Oscillate's δx         (addition)
Final scale = props scale * (1 + δscale_A) * (1 + δscale_B)      (multiplication)
```

#### Internal Implementation: Delta Composition Mechanism

Behavior components are outside the scope of createRenderer and are implemented as regular Solid components. Access to the parent GameObject is provided via ParentNodeContext.

Metadata extension:

```ts
interface SolidionMeta {
  children: Phaser.GameObjects.GameObject[]
  handlers: Map<string, Function>
  baseValues: Map<string, any>                          // Base values set via setProperty
  behaviorDeltas: Map<string, Record<string, number>>   // behaviorId → {prop: delta}
  totalDelta: Record<string, number>                     // Aggregated delta cache
}
```

Base values are recorded within setProperty, and the actual application to GameObjects uses the composed value of base + delta:

```ts
function applyProp(node, name, value) {
  const meta = getMeta(node)
  meta.baseValues.set(name, value)
  const delta = meta.totalDelta[name] ?? 0
  const finalValue = composeProp(name, value, delta)
  setPhaserProp(node, name, finalValue)
}
```

Behavior components calculate deltas each frame and update the parent node's metadata via the addDelta function. When deltas are updated, recomposition with base values occurs and is reflected on the GameObject.

This ensures that setProperty (reactive path) and delta composition are processed within the same applyProp, preventing conflicts between the two pathways.

---

## Type Definitions

### Strategy: Hybrid

Core properties (common to all GameObjects) are precisely defined by hand. GameObject-specific properties reference Phaser's types. Event callback parameters directly use Phaser's types, guaranteeing type completion within handlers.

### Common Property Types

```ts
interface TransformProps {
  x?: number
  y?: number
  angle?: number
  rotation?: number
  scale?: number
  scaleX?: number
  scaleY?: number
}

interface DisplayProps {
  alpha?: number
  visible?: boolean
  tint?: number
  blendMode?: number | string
  depth?: number
}

interface OriginProps {
  origin?: number
  originX?: number
  originY?: number
}

interface SizeProps {
  width?: number
  height?: number
  displayWidth?: number
  displayHeight?: number
}

interface EventProps {
  onClick?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void
  onPointerDown?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void
  onPointerUp?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void
  onPointerOver?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void
  onPointerOut?: (pointer: Phaser.Input.Pointer) => void
  onPointerMove?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void
  onDragStart?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void
  onDrag?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void
  onDragEnd?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void
  onDestroy?: () => void
}

interface InteractiveProps {
  interactive?: boolean | Phaser.Types.Input.InputConfiguration
}

interface RefProps<T> {
  ref?: (el: T) => void
}

type BaseProps = TransformProps & DisplayProps & OriginProps & SizeProps & EventProps & InteractiveProps
```

### GameObject-Specific Property Types

```ts
interface SpriteProps extends BaseProps, RefProps<Phaser.GameObjects.Sprite> {
  texture: string
  frame?: string | number
  animation?: string | Phaser.Types.Animations.PlayAnimationConfig
}

interface ImageProps extends BaseProps, RefProps<Phaser.GameObjects.Image> {
  texture: string
  frame?: string | number
}

interface TextProps extends BaseProps, RefProps<Phaser.GameObjects.Text> {
  text?: string
  style?: Phaser.Types.GameObjects.Text.TextStyle
  fontSize?: number | string
  fontFamily?: string
  color?: string
  align?: string
  wordWrap?: { width: number; useAdvancedWrap?: boolean }
}

interface RectangleProps extends BaseProps, RefProps<Phaser.GameObjects.Rectangle> {
  fillColor?: number
  fillAlpha?: number
  strokeColor?: number
  strokeAlpha?: number
  lineWidth?: number
}

interface ContainerProps extends TransformProps & DisplayProps & EventProps & InteractiveProps & RefProps<Phaser.GameObjects.Container> {
  children?: JSX.Element
}

interface NineSliceProps extends BaseProps, RefProps<Phaser.GameObjects.NineSlice> {
  texture: string
  frame?: string | number
  leftWidth?: number
  rightWidth?: number
  topHeight?: number
  bottomHeight?: number
}

interface ZoneProps extends TransformProps & SizeProps & EventProps & InteractiveProps & RefProps<Phaser.GameObjects.Zone> {}
```

### JSX Intrinsic Elements

```ts
declare module "solidion" {
  namespace JSX {
    interface IntrinsicElements {
      sprite: SpriteProps
      image: ImageProps
      text: TextProps
      rectangle: RectangleProps
      container: ContainerProps
      nineslice: NineSliceProps
      zone: ZoneProps
    }
  }
}
```

### Component Types

```ts
interface GameProps {
  width?: number
  height?: number
  backgroundColor?: number | string
  physics?: Phaser.Types.Core.PhysicsConfig
  scale?: Phaser.Types.Core.ScaleConfig
  config?: Partial<Phaser.Types.Core.GameConfig>  // L4 full configuration
  fallback?: JSX.Element
  children: JSX.Element
}

interface SceneProps {
  name?: string
  active?: boolean
  physics?: Phaser.Types.Core.PhysicsConfig
  children: JSX.Element
}

interface PreloadProps {
  assets: string[]
  fallback?: JSX.Element
  children: JSX.Element
}
```

### Hook Types

```ts
declare function useGame(): Phaser.Game
declare function useScene(): Phaser.Scene
declare function useFrame(callback: (time: number, delta: number) => void): void
declare function useLoader(): {
  load: (type: string, key: string, url: string) => Promise<void>
  progress: () => number
}
```

---

## Frame Synchronization Mechanism

### Problem

Solid's reactive updates and Phaser's update loop run at independent timings. If a Signal change occurs between Phaser's render and update, GameObjects may be rendered in an intermediate state.

### Solution: Batch Flush Within Scene.update

Using Solid's `batch` function, all Signal updates within a single frame are flushed together inside Phaser's Scene.update.

Processing order within a frame:

```
Phaser frame begins
  → TweenManager.update()    ← Accumulate tween values in buffer (don't directly modify Signals)
  → Physics.update()
  → Scene.update()
      → solidionFrameUpdate()
          → batch(() => {
              tween buffer → Signal updates
              useFrame callback execution → Signal updates
              behavior delta calculation → addDelta
            })
          → batch ends: Solid flushes all changes
          → setProperty calls execute in bulk
          → GameObjects reach latest state
  → Renderer.render()         ← Rendering with consistent state
```

### useTween Buffer Approach

Phaser's TweenManager.update executes before Scene.update. In useTween's onUpdate, Signals are not updated directly; only a pending flag is set. Within the batch inside solidionFrameUpdate, values are reflected from the buffer to Signals.

```ts
// Inside useTween
const proxy = { ...config.from }
let pendingUpdate = false

const tween = scene.tweens.add({
  targets: proxy,
  ...config.to,
  onUpdate: () => { pendingUpdate = true },  // Flag only
})

registerFrameCallback(() => {
  if (pendingUpdate) {
    setValues({ ...proxy })  // Signal update within batch
    pendingUpdate = false
  }
})
```

### Frame Callback Registration

SceneContext includes a frame callback registration/deregistration mechanism. useFrame registers through this mechanism and automatically deregisters via onCleanup.

---

## Coexistence with the DOM Layer

### Architecture: Dual Renderer

The `<Game>` component itself runs on Solid's standard DOM renderer. `<Game>` internally creates Phaser's Canvas, and only the GameObjects within the Canvas are processed by the universal renderer. DOM elements placed outside Game and GameObjects inside Game belong to the same Solid reactive graph, allowing natural Signal sharing.

```tsx
render(() => <App />, document.getElementById("root"))

function App() {
  const [words, setWords] = createSignal([])
  return (
    <div style={{ position: "relative" }}>
      <Game width={800} height={600}>
        <sprite texture="/assets/character.png" x={300} y={400} />
      </Game>
      {/* DOM element outside Game. Can reference the same Signals */}
      <input onKeyDown={e => setWords(prev => [...prev, e.target.value])} />
    </div>
  )
}
```

### Overlay Component

A component that declares a DOM layer overlaying the Canvas within Game. On the universal renderer side it returns null, and uses Solid's standard DOM renderer to insert DOM elements into the same parent div as Phaser's canvas.

```tsx
<Game width={800} height={600}>
  <image texture="/assets/bg.png" x={400} y={300} />
  <sprite texture="/assets/character.png" x={300} y={400} />

  <Overlay>
    <div style={{ position: "absolute", bottom: "20px", "pointer-events": "auto" }}>
      <input type="text" />
    </div>
  </Overlay>
</Game>
```

The overlay's root div defaults to `pointer-events: none`, with only internal interactive elements set to `pointer-events: auto`. This allows clicks to pass through to the Phaser Canvas even when DOM elements are overlaid.

### WorldOverlay Component (L2)

DOM elements that follow game world coordinates. Each frame, the DOM element's position is updated considering Phaser's camera transformation. useFrame performs world-to-screen coordinate conversion.

| Level | Component | Use Case |
|---|---|---|
| L0 | Place DOM outside Game | Simplest approach |
| L1 | `<Overlay>` | DOM layer on Canvas |
| L2 | `<WorldOverlay>` | DOM following game world coordinates |

---

## Texture Atlas

### Notation

```tsx
// Single image — path only (Level 0 auto-load compatible)
<sprite texture="/assets/bg.png" />

// Texture atlas — "atlasKey:frameName" notation (Preload required)
<sprite texture="characters:idle-0" />

// Spritesheet — specify frame number via frame prop
<sprite texture="/assets/sheet.png" frame={3} />
```

When the texture value contains a colon (`:`), it is interpreted as an atlas reference. Atlas references require preloading via Preload (Level 2).

### Preload Asset Specification

```ts
type AssetSpec =
  | string                                              // Single image URL (Level 0 compatible)
  | { type: "atlas"; key: string; image: string; json: string }
  | { type: "spritesheet"; key: string; url: string; frameWidth: number; frameHeight: number }

interface PreloadProps {
  assets: AssetSpec[]
  fallback?: JSX.Element
  children: JSX.Element
}
```

At Level 0, only auto-loading of single images is available. Atlases and spritesheets require explicit loading via Level 2 Preload.

---

## Lifecycle Control

### useTween

| Event | Behavior |
|---|---|
| Component mount | Create tween according to playing signal. Wait in paused state |
| playing: false→true | Create new tween and play |
| playing: true→false | tween.pause() |
| Config change (duration, etc.) | Recreate tween (remove old tween) |
| Component unmount | tween.remove(), release via onCleanup |

### useStateMachine

| Event | Behavior |
|---|---|
| Component mount | Call initial state's onEnter. Set timer if duration is specified |
| send(event) | Consult transition table. Change state if a valid transition exists |
| State change | Previous state's onExit → Clear timer → New state's onEnter → Set new timer |
| Component unmount | Clear timer, release via onCleanup |
| Scene Pause/Resume | scene.time.delayedCall automatically pauses/resumes on the Phaser side |

### useSequence

| Event | Behavior |
|---|---|
| play() call | Begin step execution from index=0 |
| Step complete | Advance to next step. playing=false when final step completes |
| reset() call | Clear all timers, index=-1, playing=false |
| Component unmount | Clear all timers, release via onCleanup |

---

## Design Constraints and Known Risks

### Behavior Composition Performance

Individual behavior primitives each have independent frame callbacks. When many behaviors are attached to large numbers of objects, overhead arises compared to bulk processing (updating all at once in a single useFrame). This is not an issue for medium-scale games, but performance-critical scenarios require downgrading to L3.

### Async Components and Scene Stack

When async boundaries are introduced via Solid's lazy() or Suspense, the _currentScene module variable may become invalid. This is addressed by supplementing with Solid's Context.

### Dual Renderer Constraints

DOM elements within Overlay/WorldOverlay are outside Phaser's rendering pipeline, so Phaser's camera effects and shaders are not applied to DOM elements. Inconsistencies between the DOM layer and Phaser may occur during effects like full-screen fades.

---

## Usage Example: Simple Pet-Raising Game

The following is an example of a simple game featuring character state management, animation, and effects. Without using useFrame, everything is expressed within L0-L1b.

```tsx
import { createSignal, Show } from "solid-js"
import { Game, useStateMachine, useTween, useOscillation } from "solidion"

function App() {
  return (
    <Game width={800} height={600} backgroundColor={0x87CEEB}>
      <image texture="/assets/bg.png" x={400} y={300} />
      <Pet />
    </Game>
  )
}

function Pet() {
  const [level, setLevel] = createSignal(1)
  const form = () => (level() >= 3 ? "evolved" : "base")

  const machine = useStateMachine({
    initial: "idle",
    states: {
      idle: {
        animation: () => `pet-${form()}-idle`,
        on: { FEED: "eating", CLICK: "reacting" }
      },
      eating: {
        animation: () => `pet-${form()}-eat`,
        duration: 800,
        onComplete: "idle",
        onEnter: () => {
          setLevel(l => l + 1)
          playSound("munch")
        },
      },
      reacting: {
        animation: () => `pet-${form()}-react`,
        duration: 1000,
        onComplete: "idle",
      }
    }
  })

  const jiggle = useTween({
    from: { scale: 1 },
    to: { scale: 1.15 },
    duration: 150,
    yoyo: true,
    ease: "Back.easeOut",
    playing: () => machine.state() === "eating",
  })

  const float = useOscillation({
    amplitude: { y: 5 },
    frequency: 1.5,
  })

  return (
    <container x={400} y={350 + float().y}>
      <sprite
        texture={`/assets/${machine.animation()}`}
        scale={jiggle().scale}
        onClick={() => machine.send("CLICK")}
      />
      <Show when={machine.is("reacting")}>
        <text text="!" y={-60} fontSize={24} color="#ffffff" />
      </Show>
      <text
        text={`Lv.${level()}`}
        y={50}
        fontSize={16}
        color="#333333"
      />
    </container>
  )
}
```

No preload, no explicit Scene, no update loop. State management, animation switching, tween effects, and oscillation are all expressed declaratively.
