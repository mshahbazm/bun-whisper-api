import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJobQueue, createJobStore } from "../src/transcription/jobs";
import { createApp } from "../src/transcription/routes";
import { createTranscriptionService } from "../src/transcription/service";
import { createSilentWav } from "./helpers";

describe("transcription API", () => {
  test("accepts an audio file and exposes the completed job", async () => {
    const root = await mkdtemp(join(tmpdir(), "stt-api-test-"));
    const queue = createJobQueue(1);
    const jobs = createTranscriptionService({
      store: createJobStore(60_000),
      queue,
      workDirectory: root,
      maxUploadBytes: 1024 * 1024,
      defaultLanguage: "auto",
      async pipeline() {
        return {
          text: "Hello.",
          language: "en",
          durationSeconds: 1,
          segments: [{ id: 0, startSeconds: 0, endSeconds: 1, text: "Hello." }],
        };
      },
    });
    const app = createApp(jobs);
    const body = new FormData();
    body.set("audio", createSilentWav());

    try {
      const createResponse = await app.request(
        new Request("http://localhost/v1/transcriptions", {
          method: "POST",
          body,
        }),
      );
      expect(createResponse.status).toBe(202);
      const created = (await createResponse.json()) as {
        id: string;
        status: string;
      };
      expect(created.status).toBe("queued");

      await queue.drained();
      const response = await app.request(
        new Request(`http://localhost/v1/transcriptions/${created.id}`),
      );
      const completed = (await response.json()) as {
        status: string;
        result?: { text: string };
      };

      expect(completed?.status).toBe("completed");
      expect(completed?.result?.text).toBe("Hello.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rejects requests without an audio file", async () => {
    const root = await mkdtemp(join(tmpdir(), "stt-api-test-"));
    const jobs = createTranscriptionService({
      store: createJobStore(60_000),
      queue: createJobQueue(1),
      workDirectory: root,
      maxUploadBytes: 1024,
      defaultLanguage: "auto",
      async pipeline() {
        throw new Error("unreachable");
      },
    });
    const form = new FormData();
    form.set("language", "en");
    try {
      const response = await createApp(jobs).request(
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
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
