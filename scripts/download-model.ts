import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, type modelNames, WhisperModelSchema } from "../src/config";
import { runProcess } from "../src/infrastructure/process";

type ModelName = (typeof modelNames)[number];

export async function downloadModel(model: ModelName): Promise<void> {
  const root = process.cwd();
  const modelDirectory = resolve(
    root,
    process.env.WHISPER_MODEL_DIR ?? "models",
  );
  const whisperDirectory = resolve(root, "vendor/whisper.cpp");
  const downloader = resolve(whisperDirectory, "models/download-ggml-model.sh");
  const destination = resolve(modelDirectory, `ggml-${model}.bin`);

  if (await Bun.file(destination).exists()) {
    console.log(`Model already installed: ${destination}`);
    return;
  }

  if (!(await Bun.file(downloader).exists())) {
    throw new Error('whisper.cpp is not installed. Run "bun run setup" first.');
  }

  await mkdir(modelDirectory, { recursive: true });
  console.log(`Downloading Whisper model "${model}"...`);
  await runProcess("bash", [downloader, model, modelDirectory], {
    timeoutMs: 60 * 60 * 1000,
  });
  console.log(`Model installed: ${destination}`);
}

if (import.meta.main) {
  const requested = process.argv[2] ?? loadConfig().whisper.model;
  const model = WhisperModelSchema.parse(requested);
  await downloadModel(model);
}
