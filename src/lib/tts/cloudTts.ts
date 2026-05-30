import { TtsError } from "./types";

/**
 * Reserved for OpenAI TTS / Azure Speech / Google Cloud TTS.
 * Returns a playable audio URL on success.
 */
export async function generateCloudTTS(
  _textEn: string,
  _voice?: string,
): Promise<string> {
  void _textEn;
  void _voice;
  throw new TtsError("CLOUD_FAILED", "Cloud TTS is not configured");
}

export function isCloudTtsEnabled(): boolean {
  return false;
}
