import type { Sentence } from "../../types";
import {
  cancelBrowserTts,
  speakText,
} from "./browserTts";
import { generateCloudTTS, isCloudTtsEnabled } from "./cloudTts";
import type { PlaySentenceResult, TTSProvider } from "./types";
import { TtsError } from "./types";

let activeAudio: HTMLAudioElement | null = null;

export function stopPlayback(): void {
  cancelBrowserTts();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }
}

function playAudioUrl(url: string): Promise<void> {
  stopPlayback();

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    activeAudio = audio;

    const cleanup = () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
      audio.onended = null;
      audio.onerror = null;
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();
      reject(new TtsError("AUDIO_URL_FAILED"));
    };

    audio.play().catch(() => {
      cleanup();
      reject(new TtsError("AUDIO_URL_FAILED"));
    });
  });
}

export interface PlaySentenceOptions {
  /** When true, attempts cloud generation if enabled and no cached audio */
  preferCloud?: boolean;
  /** Override sentence.voice for browser TTS */
  voiceName?: string;
}

type SentenceAudioFields = Pick<
  Sentence,
  "textEn" | "audioUrl" | "ttsStatus" | "voice"
>;

/**
 * Unified playback: cached audio → cloud (future) → browser TTS fallback.
 */
export async function playSentence(
  sentence: SentenceAudioFields,
  options: PlaySentenceOptions = {},
): Promise<PlaySentenceResult> {
  stopPlayback();

  if (sentence.audioUrl) {
    await playAudioUrl(sentence.audioUrl);
    return {
      provider: "cloud",
      usedCachedAudio: true,
      voiceName: sentence.voice,
    };
  }

  let triedCloud = false;

  if (options.preferCloud || isCloudTtsEnabled()) {
    triedCloud = true;
    try {
      const generatedUrl = await generateCloudTTS(
        sentence.textEn,
        options.voiceName ?? sentence.voice,
      );
      await playAudioUrl(generatedUrl);
      return {
        provider: "cloud",
        voiceName: sentence.voice,
      };
    } catch {
      /* fallback to browser below */
    }
  }

  try {
    const { voiceName } = await speakText(sentence.textEn, {
      voiceName: options.voiceName ?? sentence.voice ?? null,
    });
    return {
      provider: "browser",
      voiceName,
      usedBrowserFallback: triedCloud,
    };
  } catch (error) {
    if (error instanceof TtsError) {
      throw error;
    }
    throw new TtsError("PLAYBACK_FAILED");
  }
}

export function getActiveProvider(): TTSProvider | null {
  if (activeAudio) return "cloud";
  if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
    return "browser";
  }
  return null;
}
