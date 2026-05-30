import { TtsError } from "./types";

export const BROWSER_TTS_RATE = 0.9;
export const BROWSER_TTS_PITCH = 1;
export const BROWSER_TTS_VOLUME = 1;

let selectedVoiceName: string | null = null;
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function synthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

export function isTtsSupported(): boolean {
  return synthesis() !== null;
}

export function setSelectedVoiceName(name: string | null): void {
  selectedVoiceName = name;
}

export function getSelectedVoiceName(): string | null {
  return selectedVoiceName;
}

function isEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith("en");
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  const syn = synthesis();
  if (!syn) return [];
  return syn.getVoices().filter(isEnglishVoice);
}

function localeTier(lang: string): number {
  const normalized = lang.toLowerCase();
  if (normalized === "en-us" || normalized.startsWith("en-us")) return 3;
  if (normalized === "en-gb" || normalized.startsWith("en-gb")) return 2;
  if (normalized.startsWith("en")) return 1;
  return 0;
}

function naturalnessScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/natural|premium|enhanced|neural|wavenet|online/i.test(name)) {
    score += 40;
  }
  if (/google|microsoft|samantha|daniel|karen|moira|alex/i.test(name)) {
    score += 20;
  }
  if (!voice.localService) {
    score += 8;
  }
  return score;
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const tier = localeTier(voice.lang);
  if (tier === 0) return -1;
  let score = tier * 100 + naturalnessScore(voice);
  if (selectedVoiceName && voice.name === selectedVoiceName) {
    score += 10_000;
  }
  return score;
}

export function pickBestEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const ranked = [...voices]
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.voice ?? null;
}

function resolveVoice(voiceName?: string | null): SpeechSynthesisVoice | null {
  const voices = getEnglishVoices();
  if (voices.length === 0) return null;

  const name = voiceName ?? selectedVoiceName;
  if (name) {
    const matched = voices.find((v) => v.name === name);
    if (matched) return matched;
  }

  return pickBestEnglishVoice(voices);
}

export function waitForEnglishVoices(
  timeoutMs = 3000,
): Promise<SpeechSynthesisVoice[]> {
  const existing = getEnglishVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }

  if (voicesReadyPromise) {
    return voicesReadyPromise;
  }

  voicesReadyPromise = new Promise((resolve, reject) => {
    const syn = synthesis();
    if (!syn) {
      voicesReadyPromise = null;
      reject(new TtsError("NOT_SUPPORTED"));
      return;
    }

    let settled = false;

    const tryFinish = (): boolean => {
      const voices = getEnglishVoices();
      if (voices.length > 0) {
        if (!settled) {
          settled = true;
          cleanup();
          voicesReadyPromise = null;
          resolve(voices);
        }
        return true;
      }
      return false;
    };

    const onVoicesChanged = () => {
      tryFinish();
    };

    const cleanup = () => {
      syn.removeEventListener("voiceschanged", onVoicesChanged);
      clearTimeout(timeoutId);
      clearInterval(pollId);
    };

    syn.addEventListener("voiceschanged", onVoicesChanged);
    syn.getVoices();

    const pollId = window.setInterval(() => {
      tryFinish();
    }, 120);

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      voicesReadyPromise = null;
      const voices = getEnglishVoices();
      if (voices.length > 0) {
        resolve(voices);
      } else {
        reject(new TtsError("NO_VOICE", "English voices not available"));
      }
    }, timeoutMs);

    tryFinish();
  });

  return voicesReadyPromise;
}

export function initBrowserTts(): void {
  if (!isTtsSupported()) return;
  const syn = synthesis()!;
  syn.getVoices();
  void waitForEnglishVoices()
    .then((voices) => {
      if (!selectedVoiceName) {
        const best = pickBestEnglishVoice(voices);
        if (best) {
          selectedVoiceName = best.name;
        }
      }
    })
    .catch(() => {
      /* may resolve on a later voiceschanged */
    });
}

export function cancelBrowserTts(): void {
  synthesis()?.cancel();
}

export interface BrowserSpeakOptions {
  voiceName?: string | null;
}

export function speakText(
  text: string,
  options: BrowserSpeakOptions = {},
): Promise<{ voiceName: string }> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const syn = synthesis();
      if (!syn) {
        reject(new TtsError("NOT_SUPPORTED"));
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        reject(new TtsError("PLAYBACK_FAILED", "Empty text"));
        return;
      }

      try {
        await waitForEnglishVoices();
      } catch (error) {
        reject(error);
        return;
      }

      syn.cancel();

      const voice = resolveVoice(options.voiceName);
      if (!voice) {
        reject(new TtsError("NO_VOICE"));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = BROWSER_TTS_RATE;
      utterance.pitch = BROWSER_TTS_PITCH;
      utterance.volume = BROWSER_TTS_VOLUME;

      let settled = false;

      const cleanup = () => {
        utterance.onend = null;
        utterance.onerror = null;
      };

      utterance.onend = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ voiceName: voice.name });
      };

      utterance.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new TtsError("PLAYBACK_FAILED"));
      };

      window.setTimeout(() => {
        syn.speak(utterance);
      }, 60);
    })();
  });
}
