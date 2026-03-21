import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";
import { useScene } from "../contexts";
import { useFrame } from "./useFrame";

export interface TweenConfig<T extends Record<string, number>> {
  from: T;
  to: Partial<T>;
  duration: number;
  ease?: string;
  yoyo?: boolean;
  repeat?: number;
  delay?: number;
  playing?: Accessor<boolean>;
  onComplete?: () => void;
}

/**
 * Declarative tween hook.
 * Uses Phaser's tween engine under the hood via a proxy object.
 * Returns a Signal containing the current interpolated values.
 */
export function useTween<T extends Record<string, number>>(
  config: TweenConfig<T>
): Accessor<T> {
  const scene = useScene();
  const [values, setValues] = createSignal<T>({ ...config.from });

  let tween: Phaser.Tweens.Tween | null = null;
  const proxy = { ...config.from };
  let pendingUpdate = false;

  const buildTween = () => {
    if (tween) {
      tween.remove();
      tween = null;
    }

    Object.assign(proxy, config.from);
    setValues({ ...config.from } as any);

    tween = scene.tweens.add({
      targets: proxy,
      ...config.to,
      duration: config.duration,
      ease: config.ease ?? "Linear",
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      delay: config.delay ?? 0,
      paused: true,
      onUpdate: () => {
        pendingUpdate = true;
      },
      onComplete: () => {
        config.onComplete?.();
      },
    });
  };

  buildTween();

  // Flush pending tween updates within the frame batch
  useFrame(() => {
    if (pendingUpdate) {
      setValues({ ...proxy } as any);
      pendingUpdate = false;
    }
  });

  // React to playing signal changes
  if (config.playing) {
    createEffect(() => {
      if (config.playing!()) {
        if (!tween || !tween.isPlaying()) {
          buildTween();
          tween!.play();
        }
      } else {
        tween?.pause();
      }
    });
  }

  onCleanup(() => {
    tween?.remove();
    tween = null;
  });

  return values;
}
