export type {
  PlaybackUiState,
  PlaySentenceResult,
  SpeakResult,
  TTSProvider,
  TtsStatus,
} from "./types";
export { TtsError } from "./types";

export {
  consumeTtsPreplayedForItem,
  isMobileBrowser,
  markTtsPreplayedForItem,
  MOBILE_TTS_PLAY_HINT,
  prepareSpeechSynthesisForPlayback,
  primeSpeechSynthesisBeforeAutoPlay,
  shouldAutoPlayTts,
} from "./device";

export {
  BROWSER_SPEAK_TIMEOUT_MS,
  BROWSER_TTS_PITCH,
  BROWSER_TTS_RATE,
  BROWSER_TTS_VOLUME,
  cancelBrowserTts,
  getEnglishVoices,
  getSelectedVoiceName,
  initBrowserTts,
  isTtsSupported,
  pickBestEnglishVoice,
  setSelectedVoiceName,
  speakText,
  waitForEnglishVoices,
} from "./browserTts";

export { generateCloudTTS, isCloudTtsEnabled } from "./cloudTts";

export {
  getActiveProvider,
  playSentence,
  stopPlayback,
  type PlaySentenceOptions,
} from "./player";

/** @deprecated Use initBrowserTts */
export { initBrowserTts as initTtsVoices } from "./browserTts";
