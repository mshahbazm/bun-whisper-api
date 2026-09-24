import { AppError } from "../errors";
import type { TranscriptionJobService } from "../jobs/service";
import { errorResponse, jsonResponse } from "./responses";
import { createTranscription, getTranscription } from "./transcriptions";

export function createRequestHandler(jobs: TranscriptionJobService) {
  return async function handleRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ status: "ok" });
      }

      if (request.method === "POST" && url.pathname === "/v1/transcriptions") {
        return await createTranscription(request, jobs);
      }

      const jobMatch = url.pathname.match(
        /^\/v1\/transcriptions\/(tr_[\w-]+)$/,
      );
      if (request.method === "GET" && jobMatch?.[1]) {
        return getTranscription(jobMatch[1], jobs);
      }

      return jsonResponse(
        {
          error: {
            code: "NOT_FOUND",
            message: "Route not found.",
          },
        },
        404,
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error(error);
      }
      return errorResponse(error);
    }
  };
}
