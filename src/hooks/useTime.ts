import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";

/**
 * Exposes the current scene time as a reactive Signal.
 * Useful for pure-function derivations: `const x = () => Math.sin(time() * 0.001) * 50`
 */
export function useTime(): Accessor<number> {
  const [time, setTime] = createSignal(0);
  useFrame((t) => setTime(t));
  return time;
}
