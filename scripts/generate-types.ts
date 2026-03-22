/**
 * Generate JSX IntrinsicElements types from Phaser's type definitions.
 *
 * Usage: mise exec -- npx tsx scripts/generate-types.ts
 *
 * Reads node_modules/phaser/types/phaser.d.ts via the TypeScript compiler API,
 * finds all GameObjects that extend GameObject or Shape, extracts their
 * properties and setter methods, and writes src/types.generated.ts.
 */

import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PHASER_DTS = path.join(ROOT, "node_modules/phaser/types/phaser.d.ts");
const OUTPUT = path.join(ROOT, "src/types.generated.ts");

// ---------------------------------------------------------------------------
// Config: which classes to include and how to name them as JSX elements
// ---------------------------------------------------------------------------

/** Manual JSX element name overrides. Default: lowercase class name. */
const NAME_OVERRIDES: Record<string, string> = {
  BitmapText: "bitmapText",
  DynamicBitmapText: "dynamicBitmapText",
  NineSlice: "nineslice",
  TileSprite: "tileSprite",
  PointLight: "pointLight",
  IsoBox: "isoBox",
  IsoTriangle: "isoTriangle",
};

/** Classes to skip even if they extend GameObject */
const SKIP_CLASSES = new Set([
  "GameObject",
  "Shape",
  "Extern",
  "Layer",
  "Shader",
  "Rope",
  "Mesh",
  "Blitter",
  "DOMElement",
  "Video",
  "Light",
  "Particles",
  "Bob",
  "LightsPlugin",
  "EmitterColorOp",
  "GravityWell",
  "ParticleBounds",
  "ParticleEmitter",
  "PathFollower",
  "Plane",
  "RenderTexture",
]);

/** Properties that are common to all elements (via BaseProps) — skip per-element extraction */
const COMMON_PROPS = new Set([
  "x", "y", "angle", "rotation",
  "scale", "scaleX", "scaleY",
  "alpha", "visible", "tint",
  "blendMode", "depth",
  "origin", "originX", "originY",
  "width", "height", "displayWidth", "displayHeight",
  "scrollFactorX", "scrollFactorY",
  "flipX", "flipY",
]);

/** Properties to always skip — internal, read-only-ish, or handled specially */
const SKIP_PROPS = new Set([
  // Internal / lifecycle
  "scene", "type", "state", "name", "active", "tabIndex",
  "data", "body", "input", "parentContainer",
  "cameraFilter", "renderFlags",
  // Already handled by renderer / common props
  "ref", "children", "interactive",
  // Texture-related (handled by texture system; re-added manually per-class)
  "texture", "frame",
  // Pipeline internals — not useful as JSX props
  "defaultPipeline", "pipeline", "pipelineData",
  "hasPostPipeline", "postPipelines", "postPipelineData",
  "preFX", "postFX",
  // Mask internals
  "mask",
  // Internal transform/position
  "z", "w",
  // Display list ordering — not JSX props
  "above", "below",
  // Phaser internal rendering state
  "displayOriginX", "displayOriginY",
  "isCropped", "sizeToFrame",
  // Per-corner alpha (rarely used as JSX props, clutter)
  "alphaTopLeft", "alphaTopRight", "alphaBottomLeft", "alphaBottomRight",
  // Per-corner tint (rarely used)
  "tintTopLeft", "tintTopRight", "tintBottomLeft", "tintBottomRight", "tintFill",
  // Container internals
  "list", "exclusive", "maxSize", "position", "localTransform", "all",
  // Graphics internals
  "commandBuffer", "TargetCamera",
  // Text internals
  "renderer", "canvas", "context", "splitRegExp",
  // TileSprite internals
  "dirty", "potWidth", "potHeight", "fillCanvas", "fillContext", "fillPattern",
  // NineSlice internals
  "vertices", "is3Slice", "slices",
  // AnimationState (complex object, not a simple prop)
  "anims",
]);

/** Setter methods to skip */
const SKIP_SETTERS = new Set([
  "setActive", "setName", "setState", "setData", "setDataEnabled",
  "setInteractive", "removeInteractive", "disableInteractive",
  "setPosition", "setRandomPosition",
  "setDisplaySize", "setSize",
  "setOrigin", "setDisplayOrigin",
  "setScale",
  "setAlpha", "clearAlpha",
  "setAngle", "setRotation",
  "setVisible", "setDepth",
  "setBlendMode",
  "setScrollFactor",
  "setFlip", "setFlipX", "setFlipY", "resetFlip", "toggleFlipX", "toggleFlipY",
  "setTint", "setTintFill", "clearTint",
  "setX", "setY", "setZ", "setW",
  "setMask", "clearMask", "createBitmapMask", "createGeometryMask",
  "setPipeline", "setPostPipeline", "setPipelineData",
  "resetPipeline", "resetPostPipeline",
  "initPipeline", "removePostPipeline",
  "getBounds", "getCenter", "getTopLeft", "getTopCenter", "getTopRight",
  "getLeftCenter", "getRightCenter", "getBottomLeft", "getBottomCenter", "getBottomRight",
  "setCrop", "resetCropObject",
  "setTexture", "setFrame",
  "setFillStyle", "setStrokeStyle",
  "setClosePath",
  "setDisplayOrigin",
  // Align setters for BitmapText (not simple value setters)
  "setLeftAlign", "setCenterAlign", "setRightAlign",
  // setTo is typically a multi-arg reset, not a single-prop setter
  "setTo",
]);

/**
 * Manual extra props per class. These are props that the extractor can't
 * derive or that need specific types different from what Phaser declares.
 */
const MANUAL_PROPS: Record<string, Array<{ name: string; type: string; required?: boolean }>> = {
  Sprite: [
    { name: "texture", type: "string", required: true },
    { name: "frame", type: "string | number" },
    { name: "animation", type: "string | Phaser.Types.Animations.PlayAnimationConfig" },
  ],
  Image: [
    { name: "texture", type: "string", required: true },
    { name: "frame", type: "string | number" },
  ],
  NineSlice: [
    { name: "texture", type: "string", required: true },
    { name: "frame", type: "string | number" },
    { name: "leftWidth", type: "number" },
    { name: "rightWidth", type: "number" },
    { name: "topHeight", type: "number" },
    { name: "bottomHeight", type: "number" },
  ],
  TileSprite: [
    { name: "texture", type: "string", required: true },
    { name: "frame", type: "string | number" },
  ],
  BitmapText: [
    { name: "font", type: "string", required: true },
  ],
  DynamicBitmapText: [
    { name: "font", type: "string", required: true },
  ],
  Text: [
    { name: "style", type: "Phaser.Types.GameObjects.Text.TextStyle" },
    { name: "wordWrap", type: "{ width: number; useAdvancedWrap?: boolean }" },
  ],
};

// ---------------------------------------------------------------------------
// TypeScript compiler setup
// ---------------------------------------------------------------------------

function createPhaserProgram(): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    noEmit: true,
  };
  return ts.createProgram([PHASER_DTS], options);
}

// ---------------------------------------------------------------------------
// AST walking helpers
// ---------------------------------------------------------------------------

interface PropInfo {
  name: string;
  type: string;
  optional: boolean;
  source: "property" | "setter" | "manual";
}

interface ClassInfo {
  className: string;
  jsxName: string;
  phaserFullName: string;
  props: PropInfo[];
  extendsShape: boolean;
}

/**
 * Check if a class extends GameObject (directly or indirectly).
 */
function extendsGameObject(_checker: ts.TypeChecker, classDecl: ts.ClassDeclaration): { extends: boolean; extendsShape: boolean } {
  const result = { extends: false, extendsShape: false };
  if (!classDecl.heritageClauses) return result;

  for (const clause of classDecl.heritageClauses) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const typeNode of clause.types) {
      const exprText = typeNode.expression.getText();
      if (exprText.includes("GameObject") || exprText.includes("Shape") || exprText.includes("BitmapText")) {
        result.extends = true;
        if (exprText.includes("Shape")) {
          result.extendsShape = true;
        }
        return result;
      }
    }
  }
  return result;
}

/**
 * Simplify a TypeScript type string for JSX props.
 */
function simplifyType(typeStr: string): string {
  if (typeStr.includes("Phaser.BlendModes")) return "number | string";
  if (/^(number|string|boolean|any|object)$/.test(typeStr)) return typeStr;
  if (/^(number|string|boolean)( \| (number|string|boolean))+$/.test(typeStr)) return typeStr;
  if (typeStr === "string | string[]") return typeStr;
  if (typeStr === "string | number") return typeStr;
  if (typeStr === "number | string") return typeStr;
  if (typeStr === "number | null") return "number | null";

  // Keep well-known Phaser types
  if (/^Phaser\.Types\./.test(typeStr)) return typeStr;
  if (/^Phaser\.Display\.Color$/.test(typeStr)) return typeStr;

  // Keep DOM types (CanvasGradient, CanvasPattern, etc.)
  if (/^(string|number|boolean)( \| (CanvasGradient|CanvasPattern))+$/.test(typeStr)) return typeStr;

  // TextStyleWordWrapCallback and similar non-imported types → any
  if (/^[A-Z]\w+$/.test(typeStr) && !typeStr.startsWith("Phaser.") && !typeStr.startsWith("HTML")) return "any";

  // Complex types → any
  if (typeStr.includes("=>") || typeStr.includes("<") || typeStr.length > 80) return "any";
  return typeStr;
}

/**
 * Convert setter name to prop name: setFontSize → fontSize
 */
function setterToPropName(setterName: string): string {
  const withoutSet = setterName.slice(3);
  return withoutSet.charAt(0).toLowerCase() + withoutSet.slice(1);
}

/**
 * Extract props from a class declaration.
 */
function extractProps(checker: ts.TypeChecker, classDecl: ts.ClassDeclaration): PropInfo[] {
  const props: PropInfo[] = [];
  const seenNames = new Set<string>();

  // First, add manual props (they take priority)
  const className = classDecl.name?.text ?? "";

  // Check if this class extends Shape — if so, skip ShapeStyleProps members
  const isShape = classDecl.heritageClauses?.some(c =>
    c.types.some(t => t.expression.getText().includes("Shape"))
  ) ?? false;
  const shapeProps = new Set(["fillColor", "fillAlpha", "strokeColor", "strokeAlpha", "lineWidth"]);

  const manualProps = MANUAL_PROPS[className];
  if (manualProps) {
    for (const mp of manualProps) {
      seenNames.add(mp.name);
      props.push({
        name: mp.name,
        type: mp.type,
        optional: !mp.required,
        source: "manual",
      });
    }
  }

  for (const member of classDecl.members) {
    if (ts.isConstructorDeclaration(member)) continue;

    // Properties
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      const name = member.name?.getText();
      if (!name || SKIP_PROPS.has(name) || COMMON_PROPS.has(name) || seenNames.has(name)) continue;
      if (name.startsWith("_") || name.startsWith("$")) continue;
      // Skip UPPER_CASE constants
      if (/^[A-Z_]+$/.test(name)) continue;
      // Skip shape style props (already in ShapeStyleProps)
      if (isShape && shapeProps.has(name)) continue;

      const modifiers = ts.getModifiers(member);
      if (modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)) continue;
      if (modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;

      const type = member.type ? member.type.getText() : "any";
      const simplified = simplifyType(type);

      seenNames.add(name);
      props.push({ name, type: simplified, optional: true, source: "property" });
    }

    // Setter methods → infer prop
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const methodName = member.name?.getText();
      if (!methodName) continue;
      if (!methodName.startsWith("set") || methodName.length <= 3) continue;
      if (SKIP_SETTERS.has(methodName)) continue;

      const modifiers = ts.getModifiers(member);
      if (modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) continue;

      const propName = setterToPropName(methodName);
      if (SKIP_PROPS.has(propName) || COMMON_PROPS.has(propName) || seenNames.has(propName)) continue;
      if (isShape && shapeProps.has(propName)) continue;

      const params = member.parameters;
      if (!params || params.length === 0) continue;

      const firstParam = params[0];
      const paramType = firstParam.type ? firstParam.type.getText() : "any";
      const simplified = simplifyType(paramType);

      seenNames.add(propName);
      props.push({ name: propName, type: simplified, optional: true, source: "setter" });
    }
  }

  return props;
}

function toJsxName(className: string): string {
  if (NAME_OVERRIDES[className]) return NAME_OVERRIDES[className];
  return className.toLowerCase();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("Parsing Phaser type definitions...");
  const program = createPhaserProgram();
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(PHASER_DTS);

  if (!sourceFile) {
    console.error("Could not load phaser.d.ts");
    process.exit(1);
  }

  const classes: ClassInfo[] = [];

  function visit(node: ts.Node, inGameObjects: boolean) {
    if (ts.isModuleDeclaration(node)) {
      const name = node.name.text;
      if (name === "GameObjects" || (inGameObjects && node.body)) {
        if (node.body) {
          ts.forEachChild(node.body, child => visit(child, true));
        }
        return;
      }
      if (name === "Phaser" && node.body) {
        ts.forEachChild(node.body, child => visit(child, false));
        return;
      }
    }

    if (inGameObjects && ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      if (SKIP_CLASSES.has(className)) return;

      const inheritance = extendsGameObject(checker, node);
      if (!inheritance.extends) return;

      const props = extractProps(checker, node);
      const jsxName = toJsxName(className);

      classes.push({
        className,
        jsxName,
        phaserFullName: `Phaser.GameObjects.${className}`,
        props,
        extendsShape: inheritance.extendsShape,
      });

      console.log(`  Found: ${className} → <${jsxName}> (${props.length} props)`);
    }
  }

  ts.forEachChild(sourceFile, node => visit(node, false));
  console.log(`\nFound ${classes.length} JSX-able GameObjects.`);

  const output = generateOutput(classes);
  fs.writeFileSync(OUTPUT, output, "utf-8");
  console.log(`Written to ${OUTPUT} (${output.split("\n").length} lines)`);
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateOutput(classes: ClassInfo[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * AUTO-GENERATED — Do not edit manually.`);
  lines.push(` * Generated by: scripts/generate-types.ts`);
  lines.push(` * Source: node_modules/phaser/types/phaser.d.ts`);
  lines.push(` * Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import type Phaser from "phaser";`);
  lines.push(`import type { JSX as SolidJSX } from "solid-js";`);
  lines.push(``);
  lines.push(`// ---- Common property groups ----`);
  lines.push(``);
  lines.push(`export interface TransformProps {`);
  lines.push(`  x?: number;`);
  lines.push(`  y?: number;`);
  lines.push(`  angle?: number;`);
  lines.push(`  rotation?: number;`);
  lines.push(`  scale?: number;`);
  lines.push(`  scaleX?: number;`);
  lines.push(`  scaleY?: number;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface DisplayProps {`);
  lines.push(`  alpha?: number;`);
  lines.push(`  visible?: boolean;`);
  lines.push(`  tint?: number;`);
  lines.push(`  blendMode?: number | string;`);
  lines.push(`  depth?: number;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface OriginProps {`);
  lines.push(`  origin?: number;`);
  lines.push(`  originX?: number;`);
  lines.push(`  originY?: number;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface SizeProps {`);
  lines.push(`  width?: number;`);
  lines.push(`  height?: number;`);
  lines.push(`  displayWidth?: number;`);
  lines.push(`  displayHeight?: number;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface EventProps {`);
  lines.push(`  // L0 aliases`);
  lines.push(`  onClick?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;`);
  lines.push(`  // L1 precise events`);
  lines.push(`  onPointerDown?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;`);
  lines.push(`  onPointerUp?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;`);
  lines.push(`  onPointerOver?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;`);
  lines.push(`  onPointerOut?: (pointer: Phaser.Input.Pointer) => void;`);
  lines.push(`  onPointerMove?: (pointer: Phaser.Input.Pointer, localX: number, localY: number, event: Phaser.Types.Input.EventData) => void;`);
  lines.push(`  // Drag`);
  lines.push(`  onDragStart?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;`);
  lines.push(`  onDrag?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;`);
  lines.push(`  onDragEnd?: (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => void;`);
  lines.push(`  // Lifecycle`);
  lines.push(`  onAnimationComplete?: (animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => void;`);
  lines.push(`  onDestroy?: () => void;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface InteractiveProps {`);
  lines.push(`  interactive?: boolean | Phaser.Types.Input.InputConfiguration;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export interface RefProps<T> {`);
  lines.push(`  ref?: ((el: T) => void) | { current: T | null };`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`/** Shape-common fill/stroke props, shared by all Shape subclasses. */`);
  lines.push(`export interface ShapeStyleProps {`);
  lines.push(`  fillColor?: number;`);
  lines.push(`  fillAlpha?: number;`);
  lines.push(`  strokeColor?: number;`);
  lines.push(`  strokeAlpha?: number;`);
  lines.push(`  lineWidth?: number;`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export type BaseProps = TransformProps & DisplayProps & OriginProps & SizeProps & EventProps & InteractiveProps;`);
  lines.push(``);

  // Per-element interfaces
  lines.push(`// ---- Per-GameObject props (auto-generated from Phaser types) ----`);
  lines.push(``);

  for (const cls of classes) {
    const baseType = getBaseType(cls);
    const refType = `RefProps<${cls.phaserFullName}>`;
    // Use intersection type correctly
    lines.push(`export interface ${cls.className}Props extends ${baseType} {`);

    for (const prop of cls.props) {
      const opt = prop.optional ? "?" : "";
      lines.push(`  ${prop.name}${opt}: ${prop.type};`);
    }

    // Add ref and children
    lines.push(`  ref?: ((el: ${cls.phaserFullName}) => void) | { current: ${cls.phaserFullName} | null };`);
    lines.push(`  children?: SolidJSX.Element;`);
    lines.push(`}`);
    lines.push(``);
  }

  // IntrinsicElements
  lines.push(`// ---- JSX namespace declaration ----`);
  lines.push(``);
  lines.push(`declare module "solid-js" {`);
  lines.push(`  namespace JSX {`);
  lines.push(`    interface IntrinsicElements {`);

  for (const cls of classes) {
    lines.push(`      ${cls.jsxName}: ${cls.className}Props;`);
  }

  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

/**
 * Determine the base type (extends clause) for each class's props interface.
 */
function getBaseType(cls: ClassInfo): string {
  switch (cls.className) {
    case "Container":
      return "TransformProps, DisplayProps, EventProps, InteractiveProps";
    case "Zone":
      return "TransformProps, SizeProps, EventProps, InteractiveProps";
    case "Graphics":
      return "TransformProps, DisplayProps, EventProps, InteractiveProps";
    default:
      if (cls.extendsShape) {
        return "BaseProps, ShapeStyleProps";
      }
      return "BaseProps";
  }
}

main();
