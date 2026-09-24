import { DependencyError } from "../errors";

export interface ProcessResult {
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessOptions {
  readonly timeoutMs: number;
}

export async function runProcess(
  executable: string,
  args: readonly string[],
  options: ProcessOptions,
): Promise<ProcessResult> {
  const process = Bun.spawn([executable, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    timeout: options.timeoutMs,
    killSignal: "SIGTERM",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim().slice(-2_000);
    throw new DependencyError(
      `${executable} exited with code ${exitCode}${detail ? `: ${detail}` : "."}`,
    );
  }

  return { stdout, stderr };
}
