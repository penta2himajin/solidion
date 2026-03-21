/**
 * Solidion JSX type definitions.
 *
 * Provides TypeScript autocompletion and type checking for
 * Solidion's JSX intrinsic elements (<sprite>, <text>, etc).
 */

import type Phaser from "phaser";
import type { JSX as SolidJSX } from "solid-js";

// ---- Common property groups ----

export interface TransformProps {
  x?: number;
  y?: number;
  angle?: number;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface DisplayProps {
  alpha?: number;
  visible?: boolean;
  tint?: number;
  blendMode?: number | string;
  depth?: number;
}

export interface OriginProps {
  origin?: number;
  originX?: number;
  originY?: number;
}

export interface SizeProps {
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
}

export interface EventProps {
  // L0 aliases
  onClick?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;
  // L1 precise events
  onPointerDown?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;
  onPointerUp?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;
  onPointerOver?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;
  onPointerOut?: (pointer: Phaser.Input.Pointer) => void;
  onPointerMove?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;
  // Drag
  onDragStart?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
  onDrag?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
  onDragEnd?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;
  // Lifecycle
  onAnimationComplete?: (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void;
  onDestroy?: () => void;
}

export interface InteractiveProps {
  interactive?: boolean | Phaser.Types.Input.InputConfiguration;
}

export interface RefProps<T> {
  ref?: ((el: T) => void) | { current: T | null };
}

export type BaseProps = TransformProps & DisplayProps & OriginProps & SizeProps & EventProps & InteractiveProps;

// ---- Per-GameObject props ----

export interface SpriteProps extends BaseProps, RefProps<Phaser.GameObjects.Sprite> {
  texture: string;
  frame?: string | number;
  animation?: string | Phaser.Types.Animations.PlayAnimationConfig;
  children?: SolidJSX.Element;
}

export interface ImageProps extends BaseProps, RefProps<Phaser.GameObjects.Image> {
  texture: string;
  frame?: string | number;
  children?: SolidJSX.Element;
}

export interface TextProps extends BaseProps, RefProps<Phaser.GameObjects.Text> {
  text?: string;
  style?: Phaser.Types.GameObjects.Text.TextStyle;
  fontSize?: number | string;
  fontFamily?: string;
  color?: string;
  align?: string;
  wordWrap?: { width: number; useAdvancedWrap?: boolean };
  children?: SolidJSX.Element;
}

export interface RectangleProps extends BaseProps, RefProps<Phaser.GameObjects.Rectangle> {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  children?: SolidJSX.Element;
}

export interface ContainerProps extends TransformProps & DisplayProps & EventProps & InteractiveProps & RefProps<Phaser.GameObjects.Container> {
  children?: SolidJSX.Element;
}

export interface NineSliceProps extends BaseProps, RefProps<Phaser.GameObjects.NineSlice> {
  texture: string;
  frame?: string | number;
  leftWidth?: number;
  rightWidth?: number;
  topHeight?: number;
  bottomHeight?: number;
  children?: SolidJSX.Element;
}

export interface ZoneProps extends TransformProps & SizeProps & EventProps & InteractiveProps & RefProps<Phaser.GameObjects.Zone> {
  children?: SolidJSX.Element;
}

export interface EllipseProps extends BaseProps, RefProps<Phaser.GameObjects.Ellipse> {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  children?: SolidJSX.Element;
}

export interface ArcProps extends BaseProps, RefProps<Phaser.GameObjects.Arc> {
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  anticlockwise?: boolean;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  children?: SolidJSX.Element;
}

export interface StarProps extends BaseProps, RefProps<Phaser.GameObjects.Star> {
  points?: number;
  innerRadius?: number;
  outerRadius?: number;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  children?: SolidJSX.Element;
}

export interface GraphicsProps extends TransformProps & DisplayProps & EventProps & InteractiveProps & RefProps<Phaser.GameObjects.Graphics> {
  children?: SolidJSX.Element;
}

// ---- JSX namespace declaration ----

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      sprite: SpriteProps;
      image: ImageProps;
      text: TextProps;
      rectangle: RectangleProps;
      ellipse: EllipseProps;
      arc: ArcProps;
      star: StarProps;
      graphics: GraphicsProps;
      container: ContainerProps;
      nineslice: NineSliceProps;
      zone: ZoneProps;
    }
  }
}
