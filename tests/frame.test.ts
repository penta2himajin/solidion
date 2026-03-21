import { describe, it, expect, vi } from "vitest";
import { createFrameManager } from "../src/core/frame";

describe("FrameManager", () => {
  it("registers and calls callbacks on update", () => {
    const fm = createFrameManager();
    const cb = vi.fn();
    fm.register(cb);

    fm.update(1000, 16.667);
    expect(cb).toHaveBeenCalledWith(1000, 16.667);
  });

  it("calls multiple callbacks in registration order", () => {
    const fm = createFrameManager();
    const order: number[] = [];
    fm.register(() => order.push(1));
    fm.register(() => order.push(2));
    fm.register(() => order.push(3));

    fm.update(0, 16);
    expect(order).toEqual([1, 2, 3]);
  });

  it("unregisters callback via returned function", () => {
    const fm = createFrameManager();
    const cb = vi.fn();
    const unregister = fm.register(cb);

    fm.update(0, 16);
    expect(cb).toHaveBeenCalledOnce();

    unregister();
    fm.update(100, 16);
    expect(cb).toHaveBeenCalledOnce(); // Not called again
  });

  it("handles multiple register/unregister cycles", () => {
    const fm = createFrameManager();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const unsub1 = fm.register(cb1);
    fm.register(cb2);

    fm.update(0, 16);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();

    unsub1();

    fm.update(100, 16);
    expect(cb1).toHaveBeenCalledOnce(); // Still 1
    expect(cb2).toHaveBeenCalledTimes(2); // Now 2
  });

  it("survives callback removal during iteration", () => {
    const fm = createFrameManager();
    let unsub: () => void;
    const selfRemovingCb = vi.fn(() => {
      unsub();
    });
    unsub = fm.register(selfRemovingCb);
    const otherCb = vi.fn();
    fm.register(otherCb);

    // Should not throw
    fm.update(0, 16);
    expect(selfRemovingCb).toHaveBeenCalledOnce();
    expect(otherCb).toHaveBeenCalledOnce();

    // selfRemovingCb should be gone
    fm.update(100, 16);
    expect(selfRemovingCb).toHaveBeenCalledOnce();
    expect(otherCb).toHaveBeenCalledTimes(2);
  });
});
