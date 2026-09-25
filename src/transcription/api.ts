import { AppError, toPublicError, ValidationError } from "../errors";
import type { TranscriptionService } from "./service";

export function createRequestHandler(transcriptions: TranscriptionService) {
  return async function handleRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ status: "ok" });
      }

      if (request.method === "POST" && url.pathname === "/v1/transcriptions") {
        return await createTranscription(request, transcriptions);
      }

      const match = url.pathname.match(/^\/v1\/transcriptions\/(tr_[\w-]+)$/);
      if (request.method === "GET" && match?.[1]) {
        return json(transcriptions.get(match[1]));
      }

      return json(
        { error: { code: "NOT_FOUND", message: "Route not found." } },
        404,
      );
    } catch (error) {
      if (!(error instanceof AppError)) console.error(error);
      const publicError = toPublicError(error);
      return json(
        {
          error: {
            code: publicError.code,
            message: publicError.message,
          },
        },
        publicError.statusCode,
      );
    }
  };
}

async function createTranscription(
  request: Request,
  transcriptions: TranscriptionService,
): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ValidationError(
      "INVALID_CONTENT_TYPE",
      'Use multipart/form-data with an "audio" file field.',
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    throw new ValidationError(
      "INVALID_MULTIPART_BODY",
      "The multipart request body could not be read.",
      { cause: error },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    throw new ValidationError(
      "AUDIO_REQUIRED",
      'A file is required in the "audio" field.',
    );
  }

  const language = form.get("language");
  if (language !== null && typeof language !== "string") {
    throw new ValidationError(
      "INVALID_LANGUAGE",
      'The "language" field must be text.',
    );
  }

  return json(await transcriptions.submit(audio, language ?? undefined), 202);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
