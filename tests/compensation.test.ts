import { describe, expect, it, vi } from "vitest";
import { runUndo } from "../src/utils/compensation";

describe("runUndo", () => {
  it("runs steps newest-first", async () => {
    const order: string[] = [];
    await runUndo([
      { label: "a", run: async () => void order.push("a") },
      { label: "b", run: async () => void order.push("b") },
    ]);
    expect(order).toEqual(["b", "a"]);
  });

  it("logs a failing step, keeps going and never throws", async () => {
    const log = vi.fn();
    const ran: string[] = [];
    const failed = await runUndo(
      [
        { label: "a", run: async () => void ran.push("a") },
        {
          label: "b",
          run: async () => {
            throw new Error("boom");
          },
        },
      ],
      log,
    );
    expect(failed).toEqual(["b"]);
    expect(ran).toEqual(["a"]);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
