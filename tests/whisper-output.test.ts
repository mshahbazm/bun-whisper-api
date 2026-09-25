import { describe, expect, test } from "bun:test";
import { parseWhisperOutput } from "../src/transcription/whisper";

describe("parseWhisperOutput", () => {
  test("normalizes whisper.cpp timestamps and text", () => {
    const result = parseWhisperOutput({
      result: { language: "en" },
      transcription: [
        {
          offsets: { from: 250, to: 1_500 },
          text: " Hello world. ",
        },
        {
          offsets: { from: 1_500, to: 2_250 },
          text: " Next segment.",
        },
      ],
    });

    expect(result.language).toBe("en");
    expect(result.text).toBe("Hello world. Next segment.");
    expect(result.segments[0]).toEqual({
      id: 0,
      startSeconds: 0.25,
      endSeconds: 1.5,
      text: "Hello world.",
    });
  });

  test("rejects malformed engine output", () => {
    expect(() => parseWhisperOutput({ transcription: [{}] })).toThrow();
  });
});
