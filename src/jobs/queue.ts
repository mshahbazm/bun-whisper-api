export type QueueTask = () => Promise<void>;

export class JobQueue {
  private readonly pending: QueueTask[] = [];
  private active = 0;

  public constructor(private readonly concurrency: number) {}

  public enqueue(task: QueueTask): void {
    this.pending.push(task);
    this.drain();
  }

  public get size(): number {
    return this.pending.length;
  }

  public get activeCount(): number {
    return this.active;
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const task = this.pending.shift();
      if (!task) {
        return;
      }

      this.active += 1;
      void task().finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}
