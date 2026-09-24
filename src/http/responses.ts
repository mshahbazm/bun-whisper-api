import { toPublicError } from "../errors";

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function errorResponse(error: unknown): Response {
  const publicError = toPublicError(error);
  return jsonResponse(
    {
      error: {
        code: publicError.code,
        message: publicError.message,
      },
    },
    publicError.statusCode,
  );
}
