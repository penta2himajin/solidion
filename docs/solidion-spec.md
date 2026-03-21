# Solidion — 設計仕様書 v0.1

## 概要

SolidionはPhaser 3のSolidJSカスタムレンダラである。`solid-js/universal`のcreateRendererを用いて、PhaserのGameObjectツリーをJSXで宣言的に記述可能にする。

### 設計思想

- **認知コストの最小化** — Phaserのpreload/create/updateの分離、手続き的なオブジェクト管理、状態と描画の手動同期といった「インフラ記述」をゼロに近づける
- **段階的開示（Progressive Disclosure）** — シンプルに始めて、必要に応じてコンポーネント単位で制御レベルを引き上げられる
- **仮想ノードなし** — SolidJSの「仮想DOMを持たない」設計思想を継承し、PhaserのGameObjectを直接操作する
- **振る舞いの宣言的合成** — 存在だけでなく振る舞い（トゥイーン、状態遷移、連続更新）も宣言的に記述・合成できる

### 技術スタック

| レイヤー | 技術 | 役割 |
|---|---|---|
| アプリケーション | ユーザーコード (TSX) | ゲームロジック |
| Solidion | カスタムレンダラ + Hooks + 振る舞いプリミティブ | 宣言的API |
| SolidJS | リアクティビティ + コンパイラ | 状態管理・更新最適化 |
| Phaser 3 | 描画エンジン + 物理 + アセット管理 | ランタイム |

---

## 段階構造（Levels）

ゲームの複雑さに応じて、コンポーネント単位で必要なレベルだけを使用する。高度な実装を追加すると、その部分だけレベルが引き上がる。

| Level | 対象 | 使うもの |
|---|---|---|
| L0 | 存在の宣言 | JSX要素、propsバインディング |
| L1a | 離散的振る舞い | useTween, useStateMachine, useSequence |
| L1b | 連続的振る舞い | useSpring, useFollow, useOscillation, useVelocity |
| L1c | 振る舞いの合成 | `<Spring>`, `<Oscillate>` 等のJSX振る舞いコンポーネント |
| L2 | リソース管理 | Preload, Scene明示 |
| L3 | フレーム制御 | useFrame |
| L4 | Phaser直接操作 | useScene, ref, onMount内の命令コード |

### L3到達が必要なケース（例外的状況）

- N体相互作用（ボイド等）
- カスタム物理
- 大量オブジェクトのバルク更新
- Phaserプリミティブにない特殊描画処理

---

## レンダラコア

### 方式: 直接操作（仮想ノードなし）

SolidJSの同期的なトップダウン実行を利用し、`createElement`時点でScene参照が確定済みであることを保証する。PhaserのGameObjectを即座に生成し、中間表現を介さず直接操作する。

### Sceneスタック

モジュールレベルのScene参照をスタック管理し、コンポーネントの階層構造とSceneのスコープを対応させる。

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

### メタデータ

仮想ノードの代わりに、PhaserオブジェクトにSolidion管理用の最小メタデータを付与する。

```ts
interface SolidionMeta {
  children: Phaser.GameObjects.GameObject[]
  handlers: Map<string, Function>
}
```

### createRenderer メソッドマッピング

#### createElement(type: string)

タグ名からPhaserクラスを解決し、`_currentScene`を用いてGameObjectを即座に生成する。

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

初期段階では明示マッピング辞書方式。後から動的解決（タグ名→Phaserクラスの自動マッピング）に移行可能。

#### createTextNode(value: string)

軽量なオブジェクトとして保持。Phaser上に実体は生成しない。親がPhaser.GameObjects.Textの場合、親のsetText()に反映する。

#### setProperty(node, name, value)

Phaserオブジェクトのプロパティまたはイベントリスナーを直接設定する。プロパティ名は正規化する（Phaserの知識がなくても読める命名）。

イベント処理の場合、メタデータのhandlersマップで前のハンドラを追跡し、差し替え時に古いリスナーを確実に解除する。

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
    // setInteractive自動管理
    if (meta.handlers.size === 0 && node.input) {
      node.removeInteractive()
    }
  } else {
    applyProp(node, name, value)
  }
}
```

#### insertNode(parent, node, anchor)

メタデータのchildrenリストに追加。parentがContainerならPhaser側の親子関係も設定。挿入順序はPhaserのdepth値で管理。

#### removeNode(parent, node)

全イベントリスナーの解除、子ノードの再帰的クリーンアップ、Phaser側の親子関係解除、GameObjectのdestroy、メタデータの解放を行う。

---

## Game / Scene 初期化フロー

GameとSceneはcreateRendererのノードではなく、通常のSolidコンポーネント + Context Providerとして実装する。GameObjectだけをcreateRendererの管理対象とする。

### 初期化シーケンス

```
Solid render()
  └→ <Game> コンポーネント
       └→ createResource: Phaser.Game boot
            └→ boot完了後:
                 └→ <GameContext.Provider>
                      └→ <DefaultScene>
                           └→ Phaser defaultScene create()
                                └→ pushScene(defaultScene)
                                └→ <SceneContext.Provider>
                                     └→ props.children のレンダリング開始
                                          └→ createElement が呼ばれる
                                               → _currentScene で即座に実体化
```

### Game コンポーネント

Phaser.Gameインスタンスの生成・管理を担当。boot完了をcreateResourceで待ち、Suspenseで子ツリーの構築をブロックする。

### Scene コンポーネント

Level 0ではGameが暗黙のデフォルトSceneを自動生成する。ユーザーは`<Scene>`を書く必要がない。Level 2で明示的にSceneを導入した場合、そのScene内のGameObjectはそのSceneに所属する。

デフォルトSceneと明示Sceneの共存はSceneスタックのpush/popで管理する。

---

## テクスチャ自動ロード

### Level 0: 暗黙のオンデマンドロード

`setProperty`でtextureが指定されたとき、Phaserのテクスチャキャッシュを確認し、未ロードであればその場でロードを開始する。

- キャッシュ済み → 同期パスで即座にsetTexture
- 未ロード → ロード中はvisible=false、ロード完了でvisible=true + setTexture
- 他コンポーネントが同じURLを要求済み → ロードPromiseに相乗り

テクスチャURLがリアクティブに変化した場合、メタデータに期待するtextureKeyを記録し、ロード完了時に現在の期待値と一致する場合のみ適用する（自然なキャンセル）。

### Level 2: 明示的Preload

`<Preload>`コンポーネントでアセットの事前読み込みを宣言する。Preloadスコープ内の子ツリーは全アセットのロード完了後にマウントされる。これにより子コンポーネント内のcreateElement時点では全テクスチャがキャッシュ済みとなり、同期パスで解決される。

```tsx
<Preload
  assets={["/assets/atlas.json", "/assets/bg.png"]}
  fallback={<text text="Loading..." x={400} y={300} />}
>
  <sprite texture="/assets/bg.png" />
</Preload>
```

---

## イベントシステム

### 命名規則: エイリアス付きマッピング

Level 0ではWeb開発者に馴染みのある名前（onClick等）、Level 1ではPhaserの正確なイベント名を使用できる。両方サポート。

| エイリアス | Phaserイベント | Level |
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

### setInteractive自動管理

on* propsが一つでもあれば自動的にsetInteractive()、全て外れたらremoveInteractive()。ユーザーはsetInteractiveの存在を意識しない。

Level 2以降ではinteractive propでヒットエリアのカスタマイズやドラッグ有効化が可能。

### バブリング

なし。Phaserに準ずる。ゲームUIでバブリングが必要な場面は稀であり、必要な場合は親コンポーネントでハンドラを渡すパターンで対応。

---

## 振る舞いプリミティブ

### 共通原則

- 値の出力は全てSolidのSignal（Accessor）
- GameObjectへの反映は既存のリアクティブパス（setProperty）を通る
- PhaserのシステムはSignalに値を供給するソースとして使用。GameObjectを直接操作しない
- コンポーネントにスコープされ、onCleanupで自動クリーンアップ

### L1a: 離散的振る舞い

#### useTween

Phaserのtweenエンジンをプロキシオブジェクト経由で使用。tween対象はGameObjectではなくプロキシ。毎フレームのonUpdateでプロキシの値をSignalにコピーする。

Phaserのtween機能（イージング30種以上、pause/resume/seek/restart、yoyo/repeat/chain）をフル活用しつつ、Solidのリアクティブパスとの不整合を回避する。

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

ロジック部分はSolid側で純粋に実装（Phaserに状態マシンの仕組みはない）。タイマーにはPhaserのscene.time.delayedCallを使用（SceneのPause/Resume、timeScaleと連動）。

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

useTweenとuseStateMachineの組み合わせで時系列制御を実現。内部タイマーにはPhaserのscene.time.delayedCallを使用。

```tsx
const seq = useSequence([
  { action: "shake", duration: 300, onStart: () => playSound("shake") },
  { delay: 100 },
  { action: "pop", duration: 400 },
  { action: "collect", duration: 600 },
])
```

### L1b: 連続的振る舞い

再帰的状態依存（state(t) = f(state(t-1), dt)）を宣言的にカプセル化する。ユーザーはパラメータを宣言するだけで、フレーム単位の再帰計算を意識しない。

| プリミティブ | 数学的構造 | ユースケース |
|---|---|---|
| useSpring | 減衰振動 | ジュース感、揺れ、バウンス |
| useFollow | 指数減衰 | カメラ追従、スムーズ移動 |
| useOscillation | 三角関数 | 浮遊、呼吸アニメ |
| useVelocity | 積分(位置,速度,加速度) | 投射物、重力落下 |
| useTime | 時間参照 | 時間の純粋関数による導出 |

```tsx
const pos = useSpring({
  target: () => targetPos(),
  stiffness: 200,
  damping: 20,
  mass: 1,
})

<sprite x={pos().x} y={pos().y} />
```

内部実装はuseFrameでフレーム毎に微分方程式を解くが、出力はSignalとして表面化する。

### L1c: 振る舞いの宣言的合成

振る舞いをJSXの子要素として宣言し、GameObjectにアタッチする。

```tsx
<sprite texture="/assets/character.png" x={200} y={300}>
  <Spring target={() => targetPos()} stiffness={200} damping={20} />
  <Show when={excited()}>
    <Oscillate amplitude={{ y: 10 }} frequency={5} />
  </Show>
</sprite>
```

#### 合成セマンティクス

振る舞いコンポーネントは親GameObjectのプロパティに対するデルタ（差分）を出力する。基準値はJSXのpropsで指定した値。複数の振る舞いのデルタは加算される。

合成ルールはプロパティの性質に応じて異なる:

| プロパティ種別 | 合成方法 | 対象 |
|---|---|---|
| 位置系 | 加算 | x, y, angle, rotation |
| スケール系 | 乗算 | scale, scaleX, scaleY |
| 透明度 | 乗算 | alpha |
| 色系 | 上書き（最後のデルタが勝つ） | tint |
| 離散値 | 上書き | visible, texture |

```
最終的なx     = propsのx     + Springのδx + Oscillateのδx     （加算）
最終的なscale = propsのscale * (1 + δscale_A) * (1 + δscale_B)  （乗算）
```

#### 内部実装: デルタ合成メカニズム

振る舞いコンポーネントはcreateRendererの管轄外であり、通常のSolidコンポーネントとして実装される。親GameObjectへのアクセスはParentNodeContextで提供する。

メタデータの拡張:

```ts
interface SolidionMeta {
  children: Phaser.GameObjects.GameObject[]
  handlers: Map<string, Function>
  baseValues: Map<string, any>                          // setPropertyで設定されたベース値
  behaviorDeltas: Map<string, Record<string, number>>   // behaviorId → {prop: delta}
  totalDelta: Record<string, number>                     // 集計済みデルタキャッシュ
}
```

setProperty内でベース値を記録し、実際のGameObjectへの適用はベース値+デルタの合成値にする:

```ts
function applyProp(node, name, value) {
  const meta = getMeta(node)
  meta.baseValues.set(name, value)
  const delta = meta.totalDelta[name] ?? 0
  const finalValue = composeProp(name, value, delta)
  setPhaserProp(node, name, finalValue)
}
```

振る舞いコンポーネントはフレーム毎にデルタを計算し、addDelta関数で親ノードのメタデータを更新する。デルタ更新時にベース値との再合成が行われ、GameObjectに反映される。

これによりsetProperty（リアクティブパス）とデルタ合成が同じapplyProp内で処理され、2つの経路の競合が発生しない。

---

## 型定義

### 戦略: ハイブリッド

コアプロパティ（全GameObject共通）は手書きで正確に定義。GameObject固有のプロパティはPhaserの型を参照。イベントのコールバックパラメータにはPhaserの型を直接使用し、ハンドラ内での型補完を保証する。

### 共通プロパティ型

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

### GameObject固有プロパティ型

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

### コンポーネント型

```ts
interface GameProps {
  width?: number
  height?: number
  backgroundColor?: number | string
  physics?: Phaser.Types.Core.PhysicsConfig
  scale?: Phaser.Types.Core.ScaleConfig
  config?: Partial<Phaser.Types.Core.GameConfig>  // L4フル設定
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

### Hooks型

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

## フレーム同期メカニズム

### 課題

Solidのリアクティブ更新とPhaserのupdateループは独立したタイミングで動く。Signal変更がPhaserのrenderとupdateの間に起きると、GameObjectが中間状態で描画される可能性がある。

### 解決: Scene.update内でのbatchフラッシュ

Solidの`batch`関数を使い、1フレーム内の全Signal更新をPhaserのScene.update内でまとめてフラッシュする。

フレーム内の処理順序:

```
Phaserフレーム開始
  → TweenManager.update()    ← tween値をバッファに蓄積（Signalは直接変更しない）
  → Physics.update()
  → Scene.update()
      → solidionFrameUpdate()
          → batch(() => {
              tweenバッファ → Signal更新
              useFrameコールバック実行 → Signal更新
              振る舞いデルタ計算 → addDelta
            })
          → batch終了: Solidが全変更をフラッシュ
          → setProperty群が一括実行
          → GameObjectが最新状態に
  → Renderer.render()         ← 一貫した状態で描画
```

### useTweenのバッファ方式

PhaserのTweenManager.updateはScene.updateより先に実行される。useTweenのonUpdateではSignalを直接更新せず、pendingフラグだけ立てる。solidionFrameUpdate内のbatch内でバッファからSignalに反映する。

```ts
// useTween内部
const proxy = { ...config.from }
let pendingUpdate = false

const tween = scene.tweens.add({
  targets: proxy,
  ...config.to,
  onUpdate: () => { pendingUpdate = true },  // フラグだけ
})

registerFrameCallback(() => {
  if (pendingUpdate) {
    setValues({ ...proxy })  // batch内でSignal更新
    pendingUpdate = false
  }
})
```

### フレームコールバックの登録

SceneContextにフレームコールバックの登録/解除機構を含める。useFrameはこれを経由して登録し、onCleanupで自動解除する。

---

## DOM層との共存

### アーキテクチャ: Dual Renderer

`<Game>`コンポーネント自体はSolid標準のDOMレンダラで動く。`<Game>`内部でPhaserのCanvasを生成し、Canvas内のGameObjectだけをuniversalレンダラで処理する。Gameの外に配置したDOM要素とGameの中のGameObjectは同じSolidリアクティブグラフに属するため、Signalを自然に共有できる。

```tsx
render(() => <App />, document.getElementById("root"))

function App() {
  const [words, setWords] = createSignal([])
  return (
    <div style={{ position: "relative" }}>
      <Game width={800} height={600}>
        <sprite texture="/assets/character.png" x={300} y={400} />
      </Game>
      {/* Gameの外のDOM要素。同じSignalを参照可能 */}
      <input onKeyDown={e => setWords(prev => [...prev, e.target.value])} />
    </div>
  )
}
```

### Overlayコンポーネント

Game内でCanvas上に重なるDOMレイヤーを宣言するコンポーネント。universalレンダラ側ではnullを返し、Solid標準のDOMレンダラを使ってPhaserのcanvasと同じ親divにDOM要素を挿入する。

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

overlayのルートdivは`pointer-events: none`をデフォルトとし、内部のインタラクティブ要素だけ`pointer-events: auto`にする。これによりDOMが被っていてもPhaserのCanvas側のクリックが透過する。

### WorldOverlayコンポーネント（L2）

ゲーム世界座標に追従するDOM要素。Phaserのカメラ変換を考慮して毎フレームDOM要素のpositionを更新する。useFrameでワールド座標→スクリーン座標の変換を行う。

| Level | コンポーネント | 用途 |
|---|---|---|
| L0 | Gameの外にDOMを配置 | 最もシンプル |
| L1 | `<Overlay>` | Canvas上のDOMレイヤー |
| L2 | `<WorldOverlay>` | ゲーム世界座標に追従するDOM |

---

## テクスチャアトラス

### 記法

```tsx
// 単体画像 — パスのみ（Level 0自動ロード対応）
<sprite texture="/assets/bg.png" />

// テクスチャアトラス — "atlasKey:frameName" 記法（Preload必須）
<sprite texture="characters:idle-0" />

// スプライトシート — frame propsで番号指定
<sprite texture="/assets/sheet.png" frame={3} />
```

texture値にコロン(`:`)が含まれる場合、アトラス参照として解釈する。アトラス参照はPreloadでの事前読み込みが必須（Level 2）。

### PreloadのAsset指定

```ts
type AssetSpec =
  | string                                              // 単体画像URL（Level 0互換）
  | { type: "atlas"; key: string; image: string; json: string }
  | { type: "spritesheet"; key: string; url: string; frameWidth: number; frameHeight: number }

interface PreloadProps {
  assets: AssetSpec[]
  fallback?: JSX.Element
  children: JSX.Element
}
```

Level 0では単体画像の自動ロードのみ。アトラスやスプライトシートはLevel 2のPreloadで明示ロード。

---

## ライフサイクル制御

### useTween

| イベント | 挙動 |
|---|---|
| コンポーネントマウント | playing信号に応じてtween生成。paused状態で待機 |
| playing: false→true | tweenを新規生成してplay |
| playing: true→false | tween.pause() |
| config変更（duration等） | tween再生成（古いtweenをremove） |
| コンポーネントアンマウント | tween.remove()、onCleanupで解放 |

### useStateMachine

| イベント | 挙動 |
|---|---|
| コンポーネントマウント | 初期状態のonEnterを呼ぶ。durationがあればタイマー設定 |
| send(event) | 遷移テーブル参照。有効な遷移があれば状態変更 |
| 状態変更 | 前状態のonExit → タイマークリア → 新状態のonEnter → 新タイマー設定 |
| コンポーネントアンマウント | タイマークリア、onCleanupで解放 |
| SceneのPause/Resume | scene.time.delayedCallがPhaser側で自動pause/resume |

### useSequence

| イベント | 挙動 |
|---|---|
| play()呼び出し | index=0からステップ実行開始 |
| ステップ完了 | 次ステップへadvance。最終ステップ完了でplaying=false |
| reset()呼び出し | 全タイマークリア、index=-1、playing=false |
| コンポーネントアンマウント | 全タイマークリア、onCleanupで解放 |

---

## 設計上の制約と既知のリスク

### 振る舞い合成のパフォーマンス

個別の振る舞いプリミティブはそれぞれ独立したフレームコールバックを持つ。大量のオブジェクトに個別の振る舞いをアタッチした場合、バルク処理（単一のuseFrameで一括更新）と比較してオーバーヘッドが生じる。中規模ゲームまでは問題にならないが、パフォーマンスクリティカルな場面ではL3への降格が必要。

### 非同期コンポーネントとSceneスタック

Solidのlazy()やSuspenseで非同期境界が入ると、_currentSceneのモジュール変数が不正になる可能性がある。対策としてSolidのContextによる補完を行う。

### Dual Rendererの制約

Overlay/WorldOverlay内のDOM要素はPhaserの描画パイプラインの外にあるため、PhaserのカメラエフェクトやシェーダーはDOM要素に適用されない。画面全体にフェードをかける等の演出時にDOMレイヤーとの不整合が生じる可能性がある。

---

## 使用例: シンプルなキャラクター育成ゲーム

以下は、キャラクターの状態管理・アニメーション・演出を含むシンプルなゲームの例。useFrameを使わず、L0〜L1bで全てが完結している。

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

preloadなし、Scene明示なし、updateループ記述なし。状態管理・アニメーション切り替え・トゥイーン演出・周期運動が全て宣言的に表現されている。
