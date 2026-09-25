import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribeAudio } from "../src/transcription/transcribe";
import type { Transcriber } from "../src/transcription/whisper";
import { createSilentWav } from "./helpers";

describe("transcribeAudio", () => {
  test("normalizes audio, transcribes it, and removes temporary files", async () => {
    const workDirectory = await mkdtemp(join(tmpdir(), "stt-test-"));
    const transcriber: Transcriber = async (audioPath) => {
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
    };

    try {
      const result = await transcribeAudio(createSilentWav(), "auto", {
        transcriber,
        workDirectory,
        maxUploadBytes: 1024 * 1024,
        maxAudioDurationSeconds: 60,
        mediaTimeoutMs: 10_000,
        defaultLanguage: "auto",
      });

      expect(result.text).toBe("Test transcript.");
      expect(result.durationSeconds).toBeCloseTo(1, 2);
      expect(await readdir(workDirectory)).toEqual([]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });
});
