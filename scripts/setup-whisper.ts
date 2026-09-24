import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../src/config";
import { runProcess } from "../src/infrastructure/process";
import { downloadModel } from "./download-model";

const whisperVersion = "v1.9.4";
const root = process.cwd();
const vendorDirectory = resolve(root, "vendor");
const whisperDirectory = resolve(vendorDirectory, "whisper.cpp");

for (const executable of ["git", "cmake", "ffmpeg", "ffprobe"]) {
  if (!Bun.which(executable)) {
    throw new Error(`Required executable not found: ${executable}`);
  }
}

await mkdir(vendorDirectory, { recursive: true });

if (!(await Bun.file(resolve(whisperDirectory, "CMakeLists.txt")).exists())) {
  console.log(`Installing whisper.cpp ${whisperVersion}...`);
  await runProcess(
    "git",
    [
      "clone",
      "--branch",
      whisperVersion,
      "--depth",
      "1",
      "https://github.com/ggml-org/whisper.cpp.git",
      whisperDirectory,
    ],
    { timeoutMs: 10 * 60 * 1000 },
  );
}

console.log("Building whisper.cpp...");
await runProcess(
  "cmake",
  ["-S", whisperDirectory, "-B", resolve(whisperDirectory, "build")],
  { timeoutMs: 10 * 60 * 1000 },
);
await runProcess(
  "cmake",
  [
    "--build",
    resolve(whisperDirectory, "build"),
    "--config",
    "Release",
    "--parallel",
  ],
  { timeoutMs: 30 * 60 * 1000 },
);

await downloadModel(loadConfig().whisper.model);

const samplesDirectory = resolve(root, "samples");
await mkdir(samplesDirectory, { recursive: true });
await copyFile(
  resolve(whisperDirectory, "samples/jfk.wav"),
  resolve(samplesDirectory, "jfk.wav"),
);
console.log("Setup complete.");
