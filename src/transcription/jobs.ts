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

export class JobQueue {
  private readonly pending: QueueTask[] = [];
  private active = 0;

  public constructor(private readonly concurrency: number) {}

  public enqueue(task: QueueTask): void {
    this.pending.push(task);
    this.drain();
  }

  public get activeCount(): number {
    return this.active;
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const task = this.pending.shift();
      if (!task) return;

      this.active += 1;
      void task().finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}

export class JobStore {
  private readonly jobs = new Map<string, TranscriptionJob>();

  public constructor(private readonly ttlMs: number) {}

  public create(id = `tr_${crypto.randomUUID()}`): QueuedJob {
    this.removeExpired();
    const now = new Date().toISOString();
    const job: QueuedJob = {
      id,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    return job;
  }

  public get(id: string): TranscriptionJob {
    this.removeExpired();
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundError(`Transcription job "${id}" was not found.`);
    }
    return job;
  }

  public markProcessing(id: string): ProcessingJob {
    const current = this.get(id);
    const job: ProcessingJob = {
      id: current.id,
      status: "processing",
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    return job;
  }

  public markCompleted(id: string, result: Transcript): CompletedJob {
    const current = this.get(id);
    const job: CompletedJob = {
      id: current.id,
      status: "completed",
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      result,
    };
    this.jobs.set(id, job);
    return job;
  }

  public markFailed(
    id: string,
    error: { readonly code: string; readonly message: string },
  ): FailedJob {
    const current = this.get(id);
    const job: FailedJob = {
      id: current.id,
      status: "failed",
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      error,
    };
    this.jobs.set(id, job);
    return job;
  }

  private removeExpired(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, job] of this.jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        Date.parse(job.updatedAt) < cutoff
      ) {
        this.jobs.delete(id);
      }
    }
  }
}
