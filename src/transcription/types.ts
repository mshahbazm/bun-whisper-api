import { z } from "zod";

export const whisperLanguageCodes = [
  "auto",
  "en",
  "zh",
  "de",
  "es",
  "ru",
  "ko",
  "fr",
  "ja",
  "pt",
  "tr",
  "pl",
  "ca",
  "nl",
  "ar",
  "sv",
  "it",
  "id",
  "hi",
  "fi",
  "vi",
  "he",
  "uk",
  "el",
  "ms",
  "cs",
  "ro",
  "da",
  "hu",
  "ta",
  "no",
  "th",
  "ur",
  "hr",
  "bg",
  "lt",
  "la",
  "mi",
  "ml",
  "cy",
  "sk",
  "te",
  "fa",
  "lv",
  "bn",
  "sr",
  "az",
  "sl",
  "kn",
  "et",
  "mk",
  "br",
  "eu",
  "is",
  "hy",
  "ne",
  "mn",
  "bs",
  "kk",
  "sq",
  "sw",
  "gl",
  "mr",
  "pa",
  "si",
  "km",
  "sn",
  "yo",
  "so",
  "af",
  "oc",
  "ka",
  "be",
  "tg",
  "sd",
  "gu",
  "am",
  "yi",
  "lo",
  "uz",
  "fo",
  "ht",
  "ps",
  "tk",
  "nn",
  "mt",
  "sa",
  "lb",
  "my",
  "bo",
  "tl",
  "mg",
  "as",
  "tt",
  "haw",
  "ln",
  "ha",
  "ba",
  "jw",
  "su",
  "yue",
] as const;

export const WhisperLanguageSchema = z.enum(whisperLanguageCodes);
export type WhisperLanguage = z.infer<typeof WhisperLanguageSchema>;

export interface Segment {
  readonly id: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
}

export interface Transcript {
  readonly text: string;
  readonly language: string | null;
  readonly durationSeconds: number;
  readonly segments: readonly Segment[];
}

export interface TranscriptionOptions {
  readonly language: WhisperLanguage;
}
