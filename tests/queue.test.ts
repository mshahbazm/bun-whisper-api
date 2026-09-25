import { describe, expect, test } from "bun:test";
import { JobQueue } from "../src/transcription/jobs";

describe("JobQueue", () => {
  test("does not exceed its concurrency", async () => {
    const queue = new JobQueue(2);
    let active = 0;
    let maximumActive = 0;
    let completed = 0;

    for (let index = 0; index < 5; index += 1) {
      queue.enqueue(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Bun.sleep(10);
        active -= 1;
        completed += 1;
      });
    }

    while (completed < 5) {
      await Bun.sleep(5);
    }

    expect(maximumActive).toBe(2);
    expect(queue.activeCount).toBe(0);
  });
});
