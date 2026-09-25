import { describe, expect, test } from "bun:test";
import { createJobQueue } from "../src/transcription/jobs";

describe("fastq integration", () => {
  test("does not exceed its concurrency", async () => {
    const queue = createJobQueue(2);
    let active = 0;
    let maximumActive = 0;

    for (let index = 0; index < 5; index += 1) {
      void queue.push(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Bun.sleep(10);
        active -= 1;
      });
    }

    await queue.drained();

    expect(maximumActive).toBe(2);
    expect(queue.running()).toBe(0);
  });
});
