import { createSignal, onCleanup, type Accessor } from "solid-js";
import { useScene } from "../contexts";

export interface SequenceStep {
  action?: string;
  duration?: number;
  delay?: number;
  onStart?: () => void;
}

export interface SequenceReturn {
  current: Accessor<string | null>;
  progress: Accessor<number>;
  playing: Accessor<boolean>;
  play: () => void;
  reset: () => void;
}

/**
 * Declarative sequence/timeline hook.
 * Steps are executed in order with Phaser timers for proper game time integration.
 */
export function useSequence(steps: SequenceStep[]): SequenceReturn {
  const scene = useScene();
  const [currentIndex, setCurrentIndex] = createSignal(-1);
  const [playing, setPlaying] = createSignal(false);
  const timers: Phaser.Time.TimerEvent[] = [];

  const current = (): string | null => {
    const idx = currentIndex();
    if (idx < 0 || idx >= steps.length) return null;
    return steps[idx].action ?? null;
  };

  const progress = (): number => {
    const idx = currentIndex();
    if (idx < 0) return 0;
    return (idx + 1) / steps.length;
  };

  const clearTimers = () => {
    for (const t of timers) {
      t.remove();
    }
    timers.length = 0;
  };

  const advance = (idx: number): void => {
    if (idx >= steps.length) {
      setPlaying(false);
      setCurrentIndex(-1);
      return;
    }

    setCurrentIndex(idx);
    const step = steps[idx];
    step.onStart?.();

    const totalDuration = (step.delay ?? 0) + (step.duration ?? 0);

    if (totalDuration > 0) {
      const timer = scene.time.delayedCall(totalDuration, () => {
        advance(idx + 1);
      });
      timers.push(timer);
    } else {
      // Zero-duration step: advance immediately
      advance(idx + 1);
    }
  };

  const play = (): void => {
    clearTimers();
    setPlaying(true);
    advance(0);
  };

  const reset = (): void => {
    clearTimers();
    setPlaying(false);
    setCurrentIndex(-1);
  };

  onCleanup(() => {
    clearTimers();
  });

  return { current, progress, playing, play, reset };
}
