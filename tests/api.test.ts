import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/transcription/routes";
import { transcribeAudio } from "../src/transcription/transcribe";
import type { Transcript } from "../src/transcription/types";
import { createSilentWav } from "./helpers";

describe("transcription API", () => {
  test("exposes health and not-found responses", async () => {
    const app = createApp(async () => {
      throw new Error("unreachable");
    });

    const health = await app.request("http://localhost/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const missing = await app.request("http://localhost/unknown");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found." },
    });
  });

  test("accepts an audio file and returns the transcript", async () => {
    const root = await mkdtemp(join(tmpdir(), "stt-api-test-"));
    const app = createApp((file, language) =>
      transcribeAudio(file, language, {
        workDirectory: root,
        maxUploadBytes: 1024 * 1024,
        defaultLanguage: "auto",
        async pipeline() {
          return {
            text: "Hello.",
            language: "en",
            durationSeconds: 1,
            segments: [
              { id: 0, startSeconds: 0, endSeconds: 1, text: "Hello." },
            ],
          };
        },
      }),
    );
    const body = new FormData();
    body.set("audio", createSilentWav());

    try {
      const createResponse = await app.request(
        new Request("http://localhost/v1/transcriptions", {
          method: "POST",
          body,
        }),
      );
      expect(createResponse.status).toBe(200);
      const transcript = (await createResponse.json()) as Transcript;
      expect(transcript.text).toBe("Hello.");
      expect(transcript.segments).toEqual([
        { id: 0, startSeconds: 0, endSeconds: 1, text: "Hello." },
      ]);
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects requests without an audio file", async () => {
    const app = createApp(async () => {
      throw new Error("unreachable");
    });
    const form = new FormData();
    form.set("language", "en");
    const response = await app.request(
      new Request("http://localhost/v1/transcriptions", {
        method: "POST",
        body: form,
      }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "AUDIO_REQUIRED",
        message: 'A file is required in the "audio" field.',
      },
    });
  });
});
