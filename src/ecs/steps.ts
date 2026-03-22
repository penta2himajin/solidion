/**
 * Pure step functions for Reactive ECS pattern.
 *
 * Each function takes the current state + config + delta time,
 * and returns the next state. No Signals, no effects, no side effects.
 * Designed to be called in a batch() loop over a createStore array.
 *
 * These are the same algorithms used inside useSpring, useOscillation, etc.,
 * extracted as pure functions for bulk processing.
 */

// ── Spring ──

export interface SpringState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SpringConfig {
  targetX: number;
  targetY: number;
  stiffness: number;
  damping: number;
  mass?: number;
}

/**
 * Advance a spring simulation by dt seconds.
 * Uses semi-implicit Euler integration (same as useSpring).
 */
export function springStep(
  state: SpringState,
  config: SpringConfig,
  dt: number
): SpringState {
  const mass = config.mass ?? 1;
  const dx = config.targetX - state.x;
  const dy = config.targetY - state.y;
  const ax = (dx * config.stiffness - state.vx * config.damping) / mass;
  const ay = (dy * config.stiffness - state.vy * config.damping) / mass;
  const nvx = state.vx + ax * dt;
  const nvy = state.vy + ay * dt;
  return {
    x: state.x + nvx * dt,
    y: state.y + nvy * dt,
    vx: nvx,
    vy: nvy,
  };
}

// ── Oscillation ──

export interface OscillationConfig {
  amplitudeX?: number;
  amplitudeY?: number;
  frequency: number;
  phase?: number;
}

/**
 * Compute oscillation offset at a given time (seconds).
 * Pure function of time — no internal state needed.
 */
export function oscillationStep(
  time: number,
  config: OscillationConfig
): { x: number; y: number } {
  const t = time * config.frequency * Math.PI * 2 + (config.phase ?? 0);
  return {
    x: (config.amplitudeX ?? 0) * Math.sin(t),
    y: (config.amplitudeY ?? 0) * Math.sin(t),
  };
}

// ── Velocity ──

export interface VelocityState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface VelocityConfig {
  ax?: number;
  ay?: number;
  drag?: number;
  boundsX?: [number, number];
  boundsY?: [number, number];
}

/**
 * Advance position by velocity, apply acceleration and optional drag.
 * Returns new state. Clamps to bounds if specified.
 */
export function velocityStep(
  state: VelocityState,
  config: VelocityConfig,
  dt: number
): VelocityState {
  let vx = state.vx + (config.ax ?? 0) * dt;
  let vy = state.vy + (config.ay ?? 0) * dt;
  if (config.drag) {
    const d = 1 - config.drag * dt;
    vx *= d;
    vy *= d;
  }
  let x = state.x + vx * dt;
  let y = state.y + vy * dt;
  if (config.boundsX) {
    x = Math.max(config.boundsX[0], Math.min(config.boundsX[1], x));
  }
  if (config.boundsY) {
    y = Math.max(config.boundsY[0], Math.min(config.boundsY[1], y));
  }
  return { x, y, vx, vy };
}

// ── Follow (exponential decay) ──

export interface FollowConfig {
  targetX: number;
  targetY: number;
  speed: number;
}

/**
 * Move toward target with exponential decay.
 */
export function followStep(
  x: number,
  y: number,
  config: FollowConfig,
  dt: number
): { x: number; y: number } {
  const factor = 1 - Math.exp(-config.speed * dt * 60);
  return {
    x: x + (config.targetX - x) * factor,
    y: y + (config.targetY - y) * factor,
  };
}

// ── Finite State Machine ──

export interface FSMTransitions {
  [event: string]: string;
}

export interface FSMStateConfig {
  duration?: number;
  onComplete?: string;
  on?: FSMTransitions;
}

export interface FSMState {
  current: string;
  timer: number;
}

export interface FSMStepResult {
  state: string;
  timer: number;
  transitioned: boolean;
  previous: string;
}

/**
 * Advance a finite state machine by delta milliseconds.
 * Returns the new state and whether a transition occurred.
 */
export function fsmStep(
  state: FSMState,
  states: Record<string, FSMStateConfig>,
  delta: number
): FSMStepResult {
  const config = states[state.current];
  if (!config) {
    return { state: state.current, timer: state.timer, transitioned: false, previous: state.current };
  }

  const newTimer = state.timer + delta;

  if (config.duration && config.onComplete && newTimer >= config.duration) {
    return {
      state: config.onComplete,
      timer: 0,
      transitioned: true,
      previous: state.current,
    };
  }

  return {
    state: state.current,
    timer: newTimer,
    transitioned: false,
    previous: state.current,
  };
}

/**
 * Send an event to a state machine, returning the new state if a transition matches.
 */
export function fsmSend(
  current: string,
  states: Record<string, FSMStateConfig>,
  event: string
): { state: string; transitioned: boolean } {
  const config = states[current];
  if (!config?.on) return { state: current, transitioned: false };
  const target = config.on[event];
  if (!target) return { state: current, transitioned: false };
  return { state: target, transitioned: true };
}

// ── Tween (linear interpolation) ──

export interface TweenState {
  progress: number;
  active: boolean;
  direction: 1 | -1;
}

export interface TweenConfig {
  duration: number;
  yoyo?: boolean;
}

export interface TweenStepResult {
  progress: number;
  active: boolean;
  direction: 1 | -1;
  completed: boolean;
}

/**
 * Advance a tween by delta milliseconds.
 * Progress is 0..1. If yoyo, reverses at 1 and completes at 0.
 */
export function tweenStep(
  state: TweenState,
  config: TweenConfig,
  delta: number
): TweenStepResult {
  if (!state.active) {
    return { ...state, completed: false };
  }

  const dp = (delta / config.duration) * state.direction;
  let progress = state.progress + dp;
  let direction = state.direction;
  let completed = false;

  if (progress >= 1) {
    if (config.yoyo) {
      progress = 1 - (progress - 1);
      direction = -1;
    } else {
      progress = 1;
      completed = true;
    }
  } else if (progress <= 0 && state.direction === -1) {
    progress = 0;
    completed = true;
    direction = 1;
  }

  return {
    progress,
    active: !completed,
    direction,
    completed,
  };
}

/**
 * Interpolate between two values using tween progress.
 */
export function tweenLerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
