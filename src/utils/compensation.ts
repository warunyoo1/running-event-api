/** A cleanup step that reverts one earlier write. */
export type Undo = { label: string; run: () => Promise<unknown> };

/**
 * Runs the undo steps newest-first. A failing step is logged and does not stop the remaining
 * steps, and this function never throws, so a failed cleanup cannot mask the original error.
 * Returns the labels of the steps that failed.
 */
export async function runUndo(
  steps: readonly Undo[],
  log: (msg: string, err: unknown) => void = console.error,
): Promise<string[]> {
  const failed: string[] = [];
  for (const step of [...steps].reverse()) {
    try {
      await step.run();
    } catch (err) {
      failed.push(step.label);
      try {
        log(`compensation step failed: ${step.label}`, err);
      } catch {
        /* logging must never throw */
      }
    }
  }
  return failed;
}
