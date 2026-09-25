import { describe, expect, test } from "bun:test";
import { createApp } from "../src/transcription/routes";
import type { Transcript } from "../src/transcription/types";
import { createSilentWav } from "./helpers";

const transcript: Transcript = {
  text: "Hello.",
  language: "en",
  durationSeconds: 1,
  segments: [{ id: 0, startSeconds: 0, endSeconds: 1, text: "Hello." }],
};

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
    const app = createApp(async () => transcript);
    const body = new FormData();
    body.set("audio", createSilentWav());

    const response = await app.request(
      new Request("http://localhost/v1/transcriptions", {
        method: "POST",
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(transcript);
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
