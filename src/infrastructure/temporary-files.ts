import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export async function createJobDirectory(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, "job-"));
}

export async function removeJobDirectory(
  root: string,
  directory: string,
): Promise<void> {
  const resolvedRoot = `${resolve(root)}${sep}`;
  const resolvedDirectory = resolve(directory);

  if (!resolvedDirectory.startsWith(resolvedRoot)) {
    throw new Error("Refusing to remove a directory outside the job root.");
  }

  await rm(resolvedDirectory, { recursive: true, force: true });
}
