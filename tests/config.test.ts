import { describe, expect, test } from "bun:test";
import { ZodError } from "zod";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("converts human-readable units to internal units", () => {
    const config = loadConfig(
      {
        MAX_UPLOAD_MB: "12.5",
        MAX_AUDIO_DURATION_MINUTES: "30",
        PROCESS_TIMEOUT_MINUTES: "15",
        WHISPER_LANGUAGE: "ur",
      },
      "/tmp/stt",
    );

    expect(config.maxUploadBytes).toBe(12.5 * 1024 * 1024);
    expect(config.maxAudioDurationSeconds).toBe(1_800);
    expect(config.processTimeoutMs).toBe(900_000);
    expect(config.whisper.model).toBe("base");
    expect(config.whisper.language).toBe("ur");
  });

  test("rejects languages that whisper.cpp does not support", () => {
    expect(() => loadConfig({ WHISPER_LANGUAGE: "zz" }, "/tmp/stt")).toThrow(
      ZodError,
    );
  });
});
