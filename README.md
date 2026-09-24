# Speech-to-text API

An asynchronous transcription API built with Bun, TypeScript, FFmpeg, and `whisper.cpp`.

The API accepts an audio file, processes it in the background, and returns the transcription with timestamps for each segment.

## Requirements

- Bun 1.3+
- FFmpeg and FFprobe
- CMake and Git (used during setup)
- A 64-bit CPU; a dedicated GPU is optional

The default multilingual `base` model downloads about 142 MiB and uses roughly 388 MB of memory. At least 1 GB of available RAM is required; 2 GB is recommended.

## Run locally

```bash
cp .env.example .env
bun install
bun run setup
bun run start
```

The setup command builds `whisper.cpp`, downloads the configured model, and adds a sample audio file.

Upload an audio file:

```bash
curl -X POST http://127.0.0.1:3000/v1/transcriptions \
  -F "audio=@./samples/jfk.wav" \
  -F "language=auto"
```

The API returns `202 Accepted` with a job ID:

```json
{
  "id": "tr_...",
  "status": "queued",
  "createdAt": "2026-09-24T09:50:02.798Z",
  "updatedAt": "2026-09-24T09:50:02.798Z"
}
```

Use the ID to retrieve the job:

```bash
curl http://127.0.0.1:3000/v1/transcriptions/tr_YOUR_JOB_ID
```

A completed job contains the full text and segment timestamps in seconds:

```json
{
  "id": "tr_...",
  "status": "completed",
  "result": {
    "text": "And so my fellow Americans...",
    "language": "en",
    "durationSeconds": 11,
    "segments": [
      {
        "id": 0,
        "startSeconds": 0,
        "endSeconds": 10.5,
        "text": "And so my fellow Americans..."
      }
    ]
  }
}
```

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check that the service is running |
| `POST` | `/v1/transcriptions` | Upload audio and create a transcription job |
| `GET` | `/v1/transcriptions/:id` | Get the job status or completed transcript |

`POST /v1/transcriptions` expects `multipart/form-data` with an `audio` file and an optional `language` field.

## How it works

```text
Audio upload
    ↓
Temporary job directory
    ↓
FFprobe validation
    ↓
FFmpeg normalization
    ↓
Bounded worker queue
    ↓
whisper.cpp transcription
    ↓
Validated timestamped JSON
    ↓
Temporary files removed
```

## Design decisions

### Bun and TypeScript

I used Bun and strict TypeScript for the API and job-processing code. The service only needs three routes, so it uses Bun's native HTTP server instead of adding a web framework. Runtime schemas validate environment variables and output received from external processes, since TypeScript alone cannot validate data at runtime.

### whisper.cpp

I chose `whisper.cpp` because it is open source, runs locally, supports multiple hardware platforms, and can return segment timestamps. The multilingual `base` model is the default because it provides a reasonable balance between download size, memory use, speed, and accuracy.

The model is configurable through the environment. Models ending in `.en` are English-only, while models without that suffix are multilingual.

### Different audio formats

FFprobe first checks that the uploaded file contains valid audio and reads its duration and stream metadata. FFmpeg then converts the input into mono, 16 kHz, signed 16-bit PCM WAV before transcription. This gives Whisper consistent input whether the original file is WAV, MP3, M4A, FLAC, OGG, or another format supported by the installed FFmpeg build.

### Asynchronous processing

Transcription time depends on the recording length, model, and available hardware. The upload endpoint therefore creates a background job and returns immediately instead of keeping the HTTP request open. Clients poll the job endpoint for the result.

A signed webhook callback would be a useful production extension, but it would also need retry handling, request signing, duplicate-delivery protection, and SSRF protection.

### Long audio

`whisper.cpp` already supports long-form audio by processing it through smaller internal windows while preserving segment timestamps. I rely on that implementation instead of adding another chunking layer.

If the selected engine did not support long audio, I would first split recordings around detected pauses so words are not cut in the middle. When no safe pause exists, I would use a small overlap between chunks and remove duplicated text while combining the results.

### Concurrent uploads

Each upload gets an isolated temporary directory, so concurrent jobs cannot overwrite each other's files. A bounded queue controls how many transcriptions run at once. This provides backpressure and prevents several model processes from exhausting the machine's memory or compute resources.

For a production deployment, clients would upload large files directly to object storage using signed URLs. The API would then enqueue a job containing the object key, and durable workers would consume jobs according to the available CPU or GPU capacity.

### Storage and cleanup

For this exercise, uploaded and normalized audio is stored temporarily on the service filesystem. The complete job directory is removed after transcription succeeds or fails. Job state and completed transcripts are held in memory and expire after a configurable period.

In production, I would keep audio and transcript JSON in object storage using an account-scoped key structure:

```text
accounts/{accountId}/transcriptions/{jobId}/source.mp3
accounts/{accountId}/transcriptions/{jobId}/transcript.json
```

The database would only store job status, account ID, storage keys, and other small metadata. A separate search index would only be needed if the product later required searches across many transcripts.

## Configuration

Common options in `.env`:

```dotenv
HOST=127.0.0.1
PORT=3000
MAX_UPLOAD_MB=500
MAX_AUDIO_DURATION_MINUTES=240
TRANSCRIPTION_CONCURRENCY=1
JOB_TIMEOUT_MINUTES=240
JOB_TTL_MINUTES=60
WHISPER_MODEL=base
WHISPER_LANGUAGE=auto
WHISPER_THREADS=4
```

Download another model before selecting it:

```bash
bun run model:download small
```

## Current limitations

- Job state is in memory and does not survive a process restart.
- Files are stored on the local filesystem rather than durable object storage.
- The worker queue runs in the API process rather than as a separate service.
- Authentication, account isolation, rate limiting, and webhooks are outside this exercise's scope.

## Tests

```bash
bun run check
```

The command runs strict TypeScript checks, Biome, and the test suite. Tests cover the API, configuration, queue concurrency, audio pipeline, and Whisper output parsing. Tests use a fake transcription engine and do not download a model.
