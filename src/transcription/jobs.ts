import fastq from "fastq";
import { NotFoundError } from "../errors";
import type {
  CompletedJob,
  FailedJob,
  ProcessingJob,
  QueuedJob,
  Transcript,
  TranscriptionJob,
} from "./types";

type QueueTask = () => Promise<void>;

export interface JobQueue {
  push(task: QueueTask): Promise<void>;
  drained(): Promise<void>;
  running(): number;
}

export function createJobQueue(concurrency: number): JobQueue {
  return fastq.promise((task: QueueTask) => task(), concurrency);
}

export interface JobStore {
  create(id?: string): QueuedJob;
  get(id: string): TranscriptionJob;
  markProcessing(id: string): ProcessingJob;
  markCompleted(id: string, result: Transcript): CompletedJob;
  markFailed(
    id: string,
    error: { readonly code: string; readonly message: string },
  ): FailedJob;
}

export function createJobStore(ttlMs: number): JobStore {
  const jobs = new Map<string, TranscriptionJob>();

  function removeExpired(): void {
    const cutoff = Date.now() - ttlMs;
    for (const [id, job] of jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        Date.parse(job.updatedAt) < cutoff
      ) {
        jobs.delete(id);
      }
    }
  }

  function get(id: string): TranscriptionJob {
    removeExpired();
    const job = jobs.get(id);
    if (!job) {
      throw new NotFoundError(`Transcription job "${id}" was not found.`);
    }
    return job;
  }

  return {
    create(id = `tr_${crypto.randomUUID()}`) {
      removeExpired();
      const now = new Date().toISOString();
      const job: QueuedJob = {
        id,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };
      jobs.set(id, job);
      return job;
    },
    get,
    markProcessing(id) {
      const current = get(id);
      const job: ProcessingJob = {
        id: current.id,
        status: "processing",
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      jobs.set(id, job);
      return job;
    },
    markCompleted(id, result) {
      const current = get(id);
      const job: CompletedJob = {
        id: current.id,
        status: "completed",
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        result,
      };
      jobs.set(id, job);
      return job;
    },
    markFailed(id, error) {
      const current = get(id);
      const job: FailedJob = {
        id: current.id,
        status: "failed",
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        error,
      };
      jobs.set(id, job);
      return job;
    },
  };
}
