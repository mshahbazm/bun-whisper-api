import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError, toPublicError, ValidationError } from "../errors";
import type { Transcript } from "./types";

type TranscribeAudio = (file: File, language?: string) => Promise<Transcript>;

export function createApp(transcribeAudio: TranscribeAudio) {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.post("/v1/transcriptions", async (context) => {
    const contentType = context.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new ValidationError(
        "INVALID_CONTENT_TYPE",
        'Use multipart/form-data with an "audio" file field.',
      );
    }

    const body = await context.req.parseBody().catch((error) => {
      throw new ValidationError(
        "INVALID_MULTIPART_BODY",
        "The multipart request body could not be read.",
        { cause: error },
      );
    });

    const audio = body.audio;
    if (!(audio instanceof File)) {
      throw new ValidationError(
        "AUDIO_REQUIRED",
        'A file is required in the "audio" field.',
      );
    }

    const language = body.language;
    if (language !== undefined && typeof language !== "string") {
      throw new ValidationError(
        "INVALID_LANGUAGE",
        'The "language" field must be text.',
      );
    }

    return context.json(await transcribeAudio(audio, language));
  });

  app.notFound((context) =>
    context.json(
      { error: { code: "NOT_FOUND", message: "Route not found." } },
      404,
    ),
  );

  app.onError((error, context) => {
    if (!(error instanceof AppError)) console.error(error);
    const publicError = toPublicError(error);
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
