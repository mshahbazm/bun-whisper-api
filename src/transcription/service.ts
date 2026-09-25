import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { AppError, toPublicError, ValidationError } from "../errors";
import type { JobQueue, JobStore } from "./jobs";
import type { TranscriptionPipeline } from "./pipeline";
import type { TranscriptionJob } from "./types";
import { TranscriptionOptionsSchema } from "./types";

interface ServiceOptions {
  readonly store: JobStore;
  readonly queue: JobQueue;
  readonly pipeline: TranscriptionPipeline;
  readonly workDirectory: string;
  readonly maxUploadBytes: number;
  readonly defaultLanguage: string;
}

export interface TranscriptionService {
  submit(file: File, language?: string): Promise<TranscriptionJob>;
  get(id: string): TranscriptionJob;
}

export function createTranscriptionService(
  options: ServiceOptions,
): TranscriptionService {
  async function submit(
    file: File,
    language?: string,
  ): Promise<TranscriptionJob> {
    validateFile(file, options.maxUploadBytes);

    const transcriptionOptions = TranscriptionOptionsSchema.safeParse({
      language: language ?? options.defaultLanguage,
    });
    if (!transcriptionOptions.success) {
      throw new ValidationError(
        "INVALID_LANGUAGE",
        'Language must be "auto" or a supported language code.',
        { cause: transcriptionOptions.error },
      );
    }

    const workspace = await createWorkspace(options.workDirectory);
    const inputPath = join(workspace, "input");

    try {
      await Bun.write(inputPath, file);
    } catch (error) {
      await removeWorkspace(options.workDirectory, workspace);
      throw new AppError(
        "UPLOAD_WRITE_FAILED",
        "The provided audio file could not be stored temporarily.",
        500,
        { cause: error },
      );
    }

    const job = options.store.create();
    void options.queue
      .push(async () => {
        options.store.markProcessing(job.id);
        try {
          const result = await options.pipeline(
            inputPath,
            workspace,
            transcriptionOptions.data,
          );
          options.store.markCompleted(job.id, result);
        } catch (error) {
          const publicError = toPublicError(error);
          options.store.markFailed(job.id, {
            code: publicError.code,
            message: publicError.message,
          });
        } finally {
          await removeWorkspace(options.workDirectory, workspace).catch(
            (error) => {
              console.error(
                "Failed to clean up transcription workspace",
                error,
              );
            },
          );
        }
      })
      .catch((error) => console.error("Queued transcription failed", error));

    return job;
  }

  return {
    submit,
    get: options.store.get,
  };
}

function validateFile(file: File, maxUploadBytes: number): void {
  if (file.size === 0) {
    throw new ValidationError(
      "EMPTY_FILE",
      "The provided audio file is empty.",
    );
  }

  if (file.size > maxUploadBytes) {
    throw new AppError(
      "UPLOAD_TOO_LARGE",
      "The provided audio file exceeds the configured size limit.",
      413,
    );
  }
}

async function createWorkspace(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, "job-"));
}

async function removeWorkspace(root: string, directory: string): Promise<void> {
  const resolvedRoot = `${resolve(root)}${sep}`;
  const resolvedDirectory = resolve(directory);

  if (!resolvedDirectory.startsWith(resolvedRoot)) {
    throw new Error("Refusing to remove a directory outside the job root.");
  }

  await rm(resolvedDirectory, { recursive: true, force: true });
}
