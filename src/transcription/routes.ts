import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { AppError, toPublicError, ValidationError } from "../errors";
import {
  type Transcript,
  type WhisperLanguage,
  WhisperLanguageSchema,
} from "./types";

type TranscribeAudio = (
  file: File,
  language?: WhisperLanguage,
) => Promise<Transcript>;

const TranscriptionRequestSchema = z.object({
  audio: z.instanceof(File),
  language: WhisperLanguageSchema.optional(),
});

const validateTranscriptionRequest = zValidator(
  "form",
  TranscriptionRequestSchema,
  (result) => {
    if (result.success) return;
    throw new ValidationError(
      "INVALID_TRANSCRIPTION_REQUEST",
      "Provide an audio file and, optionally, a supported language code.",
      { cause: result.error },
    );
  },
);

export function createApp(transcribeAudio: TranscribeAudio) {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.post(
    "/v1/transcriptions",
    validateTranscriptionRequest,
    async (context) => {
      const { audio, language } = context.req.valid("form");
      return context.json(await transcribeAudio(audio, language));
    },
  );

  app.notFound((context) =>
    context.json(
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    ),
  );

  app.onError((error, context) => {
    const publicError = toPublicError(error);
    if (!(error instanceof AppError) || publicError.statusCode >= 500) {
      console.error(error);
    }
    return context.json(
      {
        error: {
          code: publicError.code,
          message: publicError.message,
        },
      },
      publicError.statusCode as ContentfulStatusCode,
    );
  });

  return app;
}
