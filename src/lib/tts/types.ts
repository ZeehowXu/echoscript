export type TTSProvider = "browser" | "cloud";

export type TtsStatus = "idle" | "generating" | "ready" | "failed";

export type PlaybackUiState = "idle" | "playing" | "generating" | "failed";

export interface SpeakResult {
  provider: TTSProvider;
  voiceName?: string;
  usedBrowserFallback?: boolean;
}

export interface PlaySentenceResult extends SpeakResult {
  /** True when playback used pre-generated audioUrl */
  usedCachedAudio?: boolean;
}

export type TtsErrorCode =
  | "NOT_SUPPORTED"
  | "NO_VOICE"
  | "PLAYBACK_FAILED"
  | "CLOUD_FAILED"
  | "AUDIO_URL_FAILED";

export class TtsError extends Error {
  code: TtsErrorCode;

  constructor(code: TtsErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TtsError";
    this.code = code;
  }
}
