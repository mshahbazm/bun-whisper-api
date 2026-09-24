import { ValidationError } from "../errors";
import type { TranscriptionJobService } from "../jobs/service";
import { jsonResponse } from "./responses";

export async function createTranscription(
  request: Request,
  jobs: TranscriptionJobService,
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

  const job = await jobs.submit(audio, language ?? undefined);
  return jsonResponse(job, 202);
}

export function getTranscription(
  id: string,
  jobs: TranscriptionJobService,
): Response {
  return jsonResponse(jobs.get(id));
}
