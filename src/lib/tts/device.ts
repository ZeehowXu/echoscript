/** True on phones/tablets where speechSynthesis may need extra resume/priming. */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  ) {
    return true;
  }

  if (
    navigator.maxTouchPoints > 1 &&
    /MacIntel|Macintosh/i.test(navigator.platform)
  ) {
    return true;
  }

  return false;
}

/** Cards should auto-play once when shown (desktop and mobile). */
export function shouldAutoPlayTts(): boolean {
  return true;
}

export const MOBILE_TTS_PLAY_HINT = "Tap Replay to play audio.";
const PREPLAYED_ITEM_KEY = "echoscript_tts_preplayed_item_id";

/**
 * Lightweight wake-up before each card's first auto-play.
 * Call once per new question right before speakText / playSentence.
 */
export function primeSpeechSynthesisBeforeAutoPlay(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const syn = window.speechSynthesis;
  syn.getVoices();
  if (syn.paused) {
    syn.resume();
  }

  // iOS Safari often stays paused until resume runs again on the next frame.
  if (isMobileBrowser()) {
    window.requestAnimationFrame(() => {
      syn.getVoices();
      if (syn.paused) {
        syn.resume();
      }
    });
  }
}

/** Call on a user gesture (e.g. Start Review) to unblock iOS speechSynthesis. */
export function prepareSpeechSynthesisForPlayback(): void {
  primeSpeechSynthesisBeforeAutoPlay();
}

export function markTtsPreplayedForItem(itemId: string): void {
  try {
    sessionStorage.setItem(PREPLAYED_ITEM_KEY, itemId);
  } catch {
    /* sessionStorage can be unavailable in private browsing */
  }
}

export function consumeTtsPreplayedForItem(itemId: string): boolean {
  try {
    if (sessionStorage.getItem(PREPLAYED_ITEM_KEY) !== itemId) {
      return false;
    }
    sessionStorage.removeItem(PREPLAYED_ITEM_KEY);
    return true;
  } catch {
    return false;
  }
}
