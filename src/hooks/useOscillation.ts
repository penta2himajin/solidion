import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";

export interface OscillationConfig {
  /** Amplitude per axis. e.g. { y: 10 } for vertical float. */
  amplitude: Partial<{ x: number; y: number }>;
  /** Frequency in Hz. Default 1. */
  frequency?: number;
  /** Phase offset in radians. Default 0. */
  phase?: number;
}

/**
 * Periodic oscillation hook.
 * Returns a Signal of delta values (not absolute positions).
 * Add these to base position for floating/breathing effects.
 */
export function useOscillation(config: OscillationConfig): Accessor<{ x: number; y: number }> {
  const freq = config.frequency ?? 1;
  const phase = config.phase ?? 0;
  const ampX = config.amplitude.x ?? 0;
  const ampY = config.amplitude.y ?? 0;

  const [val, setVal] = createSignal({ x: 0, y: 0 });

  useFrame((time) => {
    const t = time / 1000; // seconds
    const angle = t * freq * Math.PI * 2 + phase;
    setVal({
      x: Math.sin(angle) * ampX,
      y: Math.sin(angle) * ampY,
    });
  });

  return val;
}
