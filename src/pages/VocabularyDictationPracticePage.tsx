import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { dictationAnswersMatch } from "../lib/vocabulary/dictationAnswer";
import { upsertDictationProgressToCloud } from "../lib/vocabulary/dictationCloudSync";
import { buildLetterHintDisplay } from "../lib/vocabulary/dictationHints";
import {
  getDictationPracticeQueue,
  recordDictationAttempt,
} from "../lib/vocabulary/dictationStorage";
import { normalizeVocabularyKey } from "../lib/vocabulary/normalize";
import { getDisplayMeaningZh } from "../lib/vocabulary/assist";
import { getVocabularyItems } from "../lib/vocabularyStorage";
import {
  consumeTtsPreplayedForItem,
  isTtsSupported,
  MOBILE_TTS_PLAY_HINT,
  speakText,
  stopPlayback,
  TtsError,
  type PlaybackUiState,
} from "../lib/tts";

type Feedback = "idle" | "correct" | "incorrect" | "answer_shown";

export function VocabularyDictationPracticePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const items = getVocabularyItems();
  const [queue] = useState(() => getDictationPracticeQueue(items));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [playState, setPlayState] = useState<PlaybackUiState>("idle");
  const [playNotice, setPlayNotice] = useState<string | null>(null);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<string | null>(null);
  const [ttsUnsupported, setTtsUnsupported] = useState(!isTtsSupported());
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [completed, setCompleted] = useState(false);

  const playGenerationRef = useRef(0);
  const autoPlayedItemIdRef = useRef<string | null>(null);
  const item = queue[index];

  const runPlayback = useCallback(async (isManualReplay = false) => {
    if (!item) return;

    if (!isTtsSupported()) {
      setTtsUnsupported(true);
      setPlayState("idle");
      setPlayNotice("Tap Replay to play audio.");
      return;
    }

    const generation = ++playGenerationRef.current;
    setPlayNotice(null);
    setPlayState("playing");
    setTtsUnsupported(false);

    try {
      await speakText(item.text, { primeBeforeSpeak: !isManualReplay });
      if (generation !== playGenerationRef.current) return;
      setPlayState("idle");
    } catch (error) {
      if (generation !== playGenerationRef.current) return;
      if (error instanceof TtsError && error.code === "NOT_SUPPORTED") {
        setTtsUnsupported(true);
      }
      const message =
        error instanceof TtsError && error.message
          ? error.message
          : MOBILE_TTS_PLAY_HINT;
      setPlayState("idle");
      setPlayNotice(message);
    }
  }, [item]);

  const handleReplayPress = () => {
    if (playState === "playing") {
      stopPlayback();
      playGenerationRef.current += 1;
      setPlayState("idle");
      return;
    }
    void runPlayback(true);
  };

  useEffect(() => {
    return () => {
      playGenerationRef.current += 1;
      stopPlayback();
    };
  }, []);

  const resetCard = () => {
    setInput("");
    setFeedback("idle");
    setWrongAttempts(0);
    setPlayState("idle");
    setPlayNotice(null);
    setCloudSyncNotice(null);
  };

  const syncDictationToCloud = (
    progress: ReturnType<typeof recordDictationAttempt>,
    itemText: string,
  ) => {
    if (!user) return;

    void upsertDictationProgressToCloud({
      userId: user.id,
      vocabulary_key: normalizeVocabularyKey(itemText),
      status: progress.status,
      attempts: progress.attempts,
      correct_count: progress.correctCount,
      incorrect_count: progress.incorrectCount,
      last_attempt_at: progress.lastAttemptAt ?? new Date().toISOString(),
    }).catch((error) => {
      console.error("Failed to upsert dictation progress to cloud:", error);
      setCloudSyncNotice(
        "Dictation progress saved locally. Cloud sync failed.",
      );
    });
  };

  const goNext = (endedCorrect: boolean) => {
    if (endedCorrect) {
      setSessionCorrect((c) => c + 1);
    } else {
      setSessionIncorrect((c) => c + 1);
    }

    stopPlayback();
    playGenerationRef.current += 1;
    resetCard();

    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleCheckSpelling = () => {
    if (!item || feedback === "correct" || feedback === "answer_shown") return;
    const trimmed = input.trim();
    if (!trimmed) return;

    if (dictationAnswersMatch(trimmed, item.text)) {
      const progress = recordDictationAttempt(item.id, true);
      syncDictationToCloud(progress, item.text);
      setFeedback("correct");
      return;
    }

    const progress = recordDictationAttempt(item.id, false);
    syncDictationToCloud(progress, item.text);
    setWrongAttempts((n) => n + 1);
    setFeedback("incorrect");
    setInput("");
  };

  const handleShowAnswer = () => {
    if (!item) return;
    setFeedback("answer_shown");
  };

  useEffect(() => {
    if (!item || completed) return;
    if (autoPlayedItemIdRef.current === item.id) return;

    autoPlayedItemIdRef.current = item.id;

    if (consumeTtsPreplayedForItem(item.id)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void runPlayback(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [item, completed, runPlayback]);

  if (items.length === 0) {
    return (
      <Layout backTo="/vocabulary/dictation" title="Dictation">
        <p className="form-error">No vocabulary available.</p>
        <Link to="/vocabulary/new" className="btn btn-primary">
          Add Vocabulary
        </Link>
      </Layout>
    );
  }

  if (completed) {
    return (
      <Layout backTo="/vocabulary/dictation" title="Dictation Complete">
        <div className="dictation-complete card">
          <h2 className="section-title">Dictation Complete</h2>
          <ul className="dictation-complete-stats">
            <li>Correct this session: {sessionCorrect}</li>
            <li>Incorrect this session: {sessionIncorrect}</li>
            <li>Total attempted: {sessionCorrect + sessionIncorrect}</li>
          </ul>
          <div className="hero-actions">
            <Link to="/vocabulary/dictation" className="btn btn-primary">
              Back to Dictation Home
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(0)}
            >
              Practice Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout backTo="/vocabulary/dictation" title="Dictation">
        <p className="practice-hint">No words in queue.</p>
        <Link to="/vocabulary/dictation" className="btn btn-primary">
          Back to Dictation Home
        </Link>
      </Layout>
    );
  }

  const isPlaying = playState === "playing";
  const letterHint = buildLetterHintDisplay(item.text);
  const displayMeaning = getDisplayMeaningZh(item.meaningZh);
  const canShowAnswer = wrongAttempts >= 2 && feedback === "incorrect";
  const showNext =
    feedback === "correct" || feedback === "answer_shown";

  return (
    <Layout backTo="/vocabulary/dictation" backLabel="Dictation" title="Practice">
      <p className="vocab-review-progress">
        第 {index + 1} / {queue.length} 个
      </p>

      {cloudSyncNotice && (
        <p className="practice-hint vocab-sync-notice" aria-live="polite">
          {cloudSyncNotice}
        </p>
      )}

      <article className="vocab-review-card dictation-practice-card">
        {item.phonetic && <p className="vocab-phonetic">{item.phonetic}</p>}
        <p className="vocab-meaning-zh dictation-meaning">
          {displayMeaning || "—"}
        </p>

        <p className="dictation-letter-hint" aria-hidden="true">
          {letterHint}
        </p>

        <div className="vocab-review-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReplayPress}
          >
            {isPlaying ? "Stop" : "🔊 Replay"}
          </button>
        </div>

        {playNotice && (
          <p className="dictation-play-status" aria-live="polite">
            {playNotice}
          </p>
        )}

        {ttsUnsupported && (
          <p className="form-error">
            当前浏览器不支持语音播放，请使用 Chrome / Safari。
          </p>
        )}

        {!showNext && (
          <>
            <label className="field dictation-input-field">
              <span className="field-label">Your spelling</span>
              <input
                type="text"
                className="input dictation-input"
                placeholder="Type what you heard..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheckSpelling();
                }}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </label>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleCheckSpelling}
              disabled={!input.trim()}
            >
              Check Spelling
            </button>

            {canShowAnswer && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={handleShowAnswer}
              >
                Show Answer
              </button>
            )}
          </>
        )}

        {feedback === "correct" && (
          <div className="dictation-feedback dictation-feedback-correct">
            <p className="dictation-feedback-title">Correct</p>
            <p className="dictation-feedback-spelling">{item.text}</p>
          </div>
        )}

        {feedback === "incorrect" && (
          <div className="dictation-feedback dictation-feedback-incorrect">
            <p className="dictation-feedback-title">Incorrect</p>
            <p className="dictation-feedback-hint">Try again.</p>
          </div>
        )}

        {feedback === "answer_shown" && (
          <div className="dictation-feedback dictation-feedback-incorrect">
            <p className="dictation-feedback-title">Answer</p>
            <p className="dictation-feedback-spelling">{item.text}</p>
          </div>
        )}

        {showNext && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() =>
              goNext(feedback === "correct")
            }
          >
            Next
          </button>
        )}
      </article>
    </Layout>
  );
}
