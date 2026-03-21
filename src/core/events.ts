/**
 * Event name resolution: maps JSX on* prop names to Phaser event strings.
 */

const EVENT_MAP: Record<string, string> = {
  // L0 aliases
  onClick: "pointerdown",

  // L1 precise event names
  onPointerDown: "pointerdown",
  onPointerUp: "pointerup",
  onPointerOver: "pointerover",
  onPointerOut: "pointerout",
  onPointerMove: "pointermove",

  // Drag
  onDragStart: "dragstart",
  onDrag: "drag",
  onDragEnd: "dragend",

  // Phaser-specific
  onAnimationComplete: "animationcomplete",
  onDestroy: "destroy",
};

/**
 * Returns true if the prop name is an event handler (starts with "on").
 */
export function isEventProp(name: string): boolean {
  return name.startsWith("on") && name.length > 2 && name[2] === name[2].toUpperCase();
}

/**
 * Resolve a JSX event prop name to a Phaser event string.
 * Returns undefined if not a known event.
 */
export function resolveEventName(propName: string): string | undefined {
  return EVENT_MAP[propName];
}

/**
 * Get all known event prop names.
 */
export function getKnownEventProps(): string[] {
  return Object.keys(EVENT_MAP);
}
