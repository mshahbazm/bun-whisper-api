import { describe, expect, test } from "bun:test";
import { AppError } from "../src/errors";
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

  test("rejects non-multipart requests", async () => {
    const app = createApp(async () => transcript);
    const response = await app.request("http://localhost/v1/transcriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_CONTENT_TYPE",
        message: 'Use multipart/form-data with an "audio" file field.',
      },
    });
  });

  test("maps application errors to HTTP responses", async () => {
    const app = createApp(async () => {
      throw new AppError("UPLOAD_TOO_LARGE", "File is too large.", 413);
    });
    const body = new FormData();
    body.set("audio", createSilentWav());

    const response = await app.request(
      new Request("http://localhost/v1/transcriptions", {
        method: "POST",
        body,
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: { code: "UPLOAD_TOO_LARGE", message: "File is too large." },
    });
  });
});
