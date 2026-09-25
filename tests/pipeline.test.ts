import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TranscriptionPipeline } from "../src/transcription/pipeline";
import type { Transcriber } from "../src/transcription/whisper";
import { createSilentWav } from "./helpers";

describe("TranscriptionPipeline", () => {
  test("normalizes audio and returns the stable transcript contract", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "stt-pipeline-test-"));
    const inputPath = join(workspace, "input.wav");
    await Bun.write(inputPath, createSilentWav());

    const transcriber: Transcriber = {
      async transcribe(audioPath) {
        expect(await Bun.file(audioPath).exists()).toBe(true);
        return {
          text: "Test transcript.",
          language: "en",
          segments: [
            {
              id: 0,
              startSeconds: 0,
              endSeconds: 1,
              text: "Test transcript.",
            },
          ],
        };
      },
    };

    try {
      const pipeline = new TranscriptionPipeline({
        transcriber,
        maxAudioDurationSeconds: 60,
        mediaTimeoutMs: 10_000,
      });
      const result = await pipeline.run(inputPath, workspace, {
        language: "auto",
      });

      expect(result.text).toBe("Test transcript.");
      expect(result.durationSeconds).toBeCloseTo(1, 2);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
