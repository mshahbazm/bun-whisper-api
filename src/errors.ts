export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(code, message, 422, options);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class DependencyError extends AppError {
  public constructor(message: string, options?: ErrorOptions) {
    super("DEPENDENCY_ERROR", message, 500, options);
  }
}

export function toPublicError(error: unknown): {
  code: string;
  message: string;
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    statusCode: 500,
  };
}
