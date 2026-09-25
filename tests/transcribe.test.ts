import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribeAudio } from "../src/transcription/transcribe";
import type { Transcriber } from "../src/transcription/whisper";
import { createSilentWav } from "./helpers";

describe("transcribeAudio", () => {
  test("normalizes MP3, transcribes it, and removes temporary files", async () => {
    const workDirectory = await mkdtemp(join(tmpdir(), "stt-test-"));
    const sample = new File(
      [Bun.file(join(import.meta.dir, "../samples/interview-sample.mp3"))],
      "interview-sample.mp3",
      { type: "audio/mpeg" },
    );
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
      const result = await transcribeAudio(sample, "auto", {
        transcriber,
        workDirectory,
        maxUploadBytes: 2 * 1024 * 1024,
        maxAudioDurationSeconds: 240,
        mediaTimeoutMs: 10_000,
        defaultLanguage: "auto",
      });

      expect(result.text).toBe("Test transcript.");
      expect(result.durationSeconds).toBeCloseTo(180.164, 2);
      expect(await readdir(workDirectory)).toEqual([]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  test("removes temporary files when transcription fails", async () => {
    const workDirectory = await mkdtemp(join(tmpdir(), "stt-test-"));

    try {
      await expect(
        transcribeAudio(createSilentWav(), "auto", {
          workDirectory,
          maxUploadBytes: 1024 * 1024,
          maxAudioDurationSeconds: 60,
          mediaTimeoutMs: 10_000,
          defaultLanguage: "auto",
          async transcriber() {
            throw new Error("Transcription failed");
          },
        }),
      ).rejects.toThrow("Transcription failed");
      expect(await readdir(workDirectory)).toEqual([]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  test("rejects invalid upload options before processing", async () => {
    const workDirectory = await mkdtemp(join(tmpdir(), "stt-test-"));
    const transcriber: Transcriber = async () => {
      throw new Error("unreachable");
    };

    try {
      await expect(
        transcribeAudio(new File([], "empty.wav"), "auto", {
          transcriber,
          workDirectory,
          maxUploadBytes: 1024,
          maxAudioDurationSeconds: 60,
          mediaTimeoutMs: 10_000,
          defaultLanguage: "auto",
        }),
      ).rejects.toMatchObject({ code: "EMPTY_FILE" });

      await expect(
        transcribeAudio(createSilentWav(), "ENGLISH", {
          transcriber,
          workDirectory,
          maxUploadBytes: 1024 * 1024,
          maxAudioDurationSeconds: 60,
          mediaTimeoutMs: 10_000,
          defaultLanguage: "auto",
        }),
      ).rejects.toMatchObject({ code: "INVALID_LANGUAGE" });

      await expect(
        transcribeAudio(createSilentWav(), "auto", {
          transcriber,
          workDirectory,
          maxUploadBytes: 1,
          maxAudioDurationSeconds: 60,
          mediaTimeoutMs: 10_000,
          defaultLanguage: "auto",
        }),
      ).rejects.toMatchObject({ code: "UPLOAD_TOO_LARGE" });
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  test("rejects audio above the duration limit and cleans up", async () => {
    const workDirectory = await mkdtemp(join(tmpdir(), "stt-test-"));

    try {
      await expect(
        transcribeAudio(createSilentWav(), "auto", {
          workDirectory,
          maxUploadBytes: 1024 * 1024,
          maxAudioDurationSeconds: 0.5,
          mediaTimeoutMs: 10_000,
          defaultLanguage: "auto",
          async transcriber() {
            throw new Error("unreachable");
          },
        }),
      ).rejects.toMatchObject({ code: "AUDIO_TOO_LONG" });
      expect(await readdir(workDirectory)).toEqual([]);
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  });
});
