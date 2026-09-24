import { join } from "node:path";
import type { Transcript, TranscriptionOptions } from "../domain";
import { type TranscriptionJob, TranscriptionOptionsSchema } from "../domain";
import { AppError, toPublicError, ValidationError } from "../errors";
import {
  createJobDirectory,
  removeJobDirectory,
} from "../infrastructure/temporary-files";
import type { JobQueue } from "./queue";
import type { JobStore } from "./store";

interface JobServiceOptions {
  readonly store: JobStore;
  readonly queue: JobQueue;
  readonly pipeline: {
    run(
      inputPath: string,
      workspace: string,
      options: TranscriptionOptions,
    ): Promise<Transcript>;
  };
  readonly workDirectory: string;
  readonly maxUploadBytes: number;
  readonly defaultLanguage: string;
}

export class TranscriptionJobService {
  public constructor(private readonly options: JobServiceOptions) {}

  public async submit(
    file: File,
    language?: string,
  ): Promise<TranscriptionJob> {
    if (file.size === 0) {
      throw new ValidationError(
        "EMPTY_FILE",
        "The provided audio file is empty.",
      );
    }

    if (file.size > this.options.maxUploadBytes) {
      throw new AppError(
        "UPLOAD_TOO_LARGE",
        "The provided audio file exceeds the configured size limit.",
        413,
      );
    }

    const parsedOptions = TranscriptionOptionsSchema.safeParse({
      language: language ?? this.options.defaultLanguage,
    });
    if (!parsedOptions.success) {
      throw new ValidationError(
        "INVALID_LANGUAGE",
        'Language must be "auto" or a supported language code.',
        { cause: parsedOptions.error },
      );
    }

    const workspace = await createJobDirectory(this.options.workDirectory);
    const inputPath = join(workspace, "input");

    try {
      await Bun.write(inputPath, file);
    } catch (error) {
      await removeJobDirectory(this.options.workDirectory, workspace);
      throw new AppError(
        "UPLOAD_WRITE_FAILED",
        "The provided audio file could not be stored temporarily.",
        500,
        { cause: error },
      );
    }

    const job = this.options.store.create();
    this.options.queue.enqueue(async () => {
      this.options.store.markProcessing(job.id);
      try {
        const result = await this.options.pipeline.run(
          inputPath,
          workspace,
          parsedOptions.data,
        );
        this.options.store.markCompleted(job.id, result);
      } catch (error) {
        const publicError = toPublicError(error);
        this.options.store.markFailed(job.id, {
          code: publicError.code,
          message: publicError.message,
        });
      } finally {
        try {
          await removeJobDirectory(this.options.workDirectory, workspace);
        } catch (error) {
          console.error("Failed to clean up transcription workspace", error);
        }
      }
    });

    return job;
  }

  public get(id: string): TranscriptionJob {
    return this.options.store.get(id);
  }
}
