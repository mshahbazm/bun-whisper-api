import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("converts human-readable units to internal units", () => {
    const config = loadConfig(
      {
        MAX_UPLOAD_MB: "12.5",
        MAX_AUDIO_DURATION_MINUTES: "30",
        JOB_TIMEOUT_MINUTES: "15",
        JOB_TTL_MINUTES: "5",
      },
      "/tmp/stt",
    );

    expect(config.maxUploadBytes).toBe(12.5 * 1024 * 1024);
    expect(config.maxAudioDurationSeconds).toBe(1_800);
    expect(config.jobTimeoutMs).toBe(900_000);
    expect(config.jobTtlMs).toBe(300_000);
    expect(config.whisper.model).toBe("base");
  });

  test("rejects invalid concurrency", () => {
    expect(() => loadConfig({ TRANSCRIPTION_CONCURRENCY: "0" })).toThrow();
  });
});
