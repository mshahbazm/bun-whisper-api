import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, WhisperModelSchema } from "../src/config";
import { runProcess } from "../src/process";

const whisperVersion = "v1.9.4";
const root = process.cwd();
const whisperDirectory = resolve(root, "vendor/whisper.cpp");
const modelDirectory = resolve(root, process.env.WHISPER_MODEL_DIR ?? "models");
const model = WhisperModelSchema.parse(
  process.argv[2] ?? loadConfig().whisper.model,
);

for (const executable of ["git", "cmake", "ffmpeg", "ffprobe"]) {
  if (!Bun.which(executable)) {
    throw new Error(`Required executable not found: ${executable}`);
  }
}

await mkdir(resolve(root, "vendor"), { recursive: true });

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

const modelPath = resolve(modelDirectory, `ggml-${model}.bin`);
if (!(await Bun.file(modelPath).exists())) {
  await mkdir(modelDirectory, { recursive: true });
  console.log(`Downloading Whisper model "${model}"...`);
  await runProcess(
    "bash",
    [
      resolve(whisperDirectory, "models/download-ggml-model.sh"),
      model,
      modelDirectory,
    ],
    { timeoutMs: 60 * 60 * 1000 },
  );
}

console.log(`Setup complete. Model: ${modelPath}`);
