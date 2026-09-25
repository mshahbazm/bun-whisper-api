import { DependencyError } from "./errors";

export async function runCommand(
  executable: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const process = Bun.spawn([executable, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    timeout: timeoutMs,
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
