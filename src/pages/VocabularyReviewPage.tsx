import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import {
  getReviewQueue,
  recordVocabularyReview,
} from "../lib/vocabularyStorage";
import {
  isTtsSupported,
  speakText,
  stopPlayback,
  TtsError,
  type PlaybackUiState,
} from "../lib/tts";
import { getDisplayMeaningZh } from "../lib/vocabulary/assist";
import type { VocabularyReviewResult } from "../types/vocabulary";

export function VocabularyReviewPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [queue] = useState(() => getReviewQueue());
  const [showAnswer, setShowAnswer] = useState(false);
  const [playState, setPlayState] = useState<PlaybackUiState>("idle");
  const [playNotice, setPlayNotice] = useState<string | null>(null);
  const [ttsUnsupported, setTtsUnsupported] = useState(!isTtsSupported());
  const [replayCount, setReplayCount] = useState(0);

  const playGenerationRef = useRef(0);
  const autoPlayedItemIdRef = useRef<string | null>(null);
  const item = queue[index];

  const runPlayback = useCallback(async (isReplay = false) => {
    if (!item) return;

    if (!isTtsSupported()) {
      setTtsUnsupported(true);
      if (isReplay) {
        setPlayState("failed");
        setPlayNotice("Audio unavailable. Please try again.");
      } else {
        setPlayState("idle");
        setPlayNotice("Tap Replay to play audio.");
      }
      return;
    }

    const generation = ++playGenerationRef.current;
    if (isReplay) setReplayCount((c) => c + 1);
    setPlayNotice(null);
    setPlayState("playing");
    setTtsUnsupported(false);

    try {
      await speakText(item.text);

      if (generation !== playGenerationRef.current) return;
      setPlayState("idle");
    } catch (error) {
      if (generation !== playGenerationRef.current) return;
      if (error instanceof TtsError && error.code === "NOT_SUPPORTED") {
        setTtsUnsupported(true);
      }
      if (isReplay) {
        setPlayState("failed");
        setPlayNotice("Audio unavailable. Please try again.");
      } else {
        setPlayState("idle");
        setPlayNotice("Tap Replay to play audio.");
      }
    }
  }, [item]);

  useEffect(() => {
    return () => {
      playGenerationRef.current += 1;
      stopPlayback();
    };
  }, []);

  const resetCardUi = () => {
    setShowAnswer(false);
    setPlayState("idle");
    setPlayNotice(null);
    setReplayCount(0);
  };

  const goNext = () => {
    stopPlayback();
    playGenerationRef.current += 1;
    resetCardUi();
    if (index < queue.length - 1) {
      setIndex((i) => i + 1);
    } else {
      navigate("/vocabulary");
    }
  };

  const handleMemoryResult = (result: VocabularyReviewResult) => {
    if (!item || !showAnswer) return;
    recordVocabularyReview(item.id, result, replayCount);
    window.setTimeout(() => {
      goNext();
    }, 160);
  };

  useEffect(() => {
    if (!item) return;
    if (autoPlayedItemIdRef.current === item.id) return;

    autoPlayedItemIdRef.current = item.id;
    const timer = window.setTimeout(() => {
      void runPlayback(false);
    }, 120);
    return () => clearTimeout(timer);
  }, [item, runPlayback]);

  if (queue.length === 0) {
    return (
      <Layout backTo="/vocabulary" title="Review">
        <p className="form-error">还没有词汇可复习。</p>
        <Link to="/vocabulary/new" className="btn btn-primary">
          Add Vocabulary
        </Link>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout backTo="/vocabulary" title="Review">
        <p className="practice-hint">本轮复习已完成。</p>
        <Link to="/vocabulary" className="btn btn-primary">
          返回词汇首页
        </Link>
      </Layout>
    );
  }

  const isPlaying = playState === "playing";
  const typeLabel =
    item.type === "word" ? "Word" : item.type === "phrase" ? "Phrase" : "Collocation";
  const displayMeaning = getDisplayMeaningZh(item.meaningZh);
  const noMeaningAvailable =
    !displayMeaning || displayMeaning === "中文释义待生成";

  return (
    <Layout backTo="/vocabulary" backLabel="词汇复习" title="Review">
      <p className="vocab-review-progress">
        {index + 1} / {queue.length}
      </p>

      <article className="vocab-review-card">
        <div className="vocab-review-badges">
          <span className="badge badge-category">{item.category}</span>
          <span className="badge badge-type">{typeLabel}</span>
        </div>

        <p className="vocab-review-text">{item.text}</p>
        {item.phonetic && <p className="vocab-phonetic">{item.phonetic}</p>}

        <div className="vocab-review-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void runPlayback(true)}
            disabled={isPlaying}
          >
            {isPlaying ? "Playing..." : "🔊 Replay"}
          </button>
          {!showAnswer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAnswer(true)}
            >
              Check Answer
            </button>
          )}
        </div>

        {(playNotice || playState === "failed") && (
          <p className="dictation-play-status" aria-live="polite">
            {playState === "failed"
              ? (playNotice ?? "Audio unavailable. Please try again.")
              : playNotice}
          </p>
        )}

        {ttsUnsupported && (
          <p className="form-error">
            当前浏览器不支持语音播放，请使用 Chrome / Safari。
          </p>
        )}

        {showAnswer && (
          <div className="vocab-meaning-panel">
            <h3 className="result-label">中文释义</h3>
            <p className="vocab-meaning-zh">
              {noMeaningAvailable
                ? "No meaning available. Please edit this card."
                : displayMeaning}
            </p>
            {item.meaningEn && (
              <>
                <h3 className="result-label">English</h3>
                <p className="result-muted">{item.meaningEn}</p>
              </>
            )}
            {item.examples && item.examples.length > 0 && (
              <>
                <h3 className="result-label">Example 1</h3>
                <p className="result-muted">{item.examples[0]?.en}</p>
                <p className="result-muted">{item.examples[0]?.zh}</p>
                {item.examples.length > 1 && (
                  <>
                    <h3 className="result-label">Example 2</h3>
                    <p className="result-muted">{item.examples[1]?.en}</p>
                    <p className="result-muted">{item.examples[1]?.zh}</p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </article>

      {showAnswer && (
        <div className="vocab-review-footer">
          <button
            type="button"
            className="btn btn-secondary vocab-footer-btn"
            onClick={() => handleMemoryResult("fuzzy")}
          >
            🤔 Fuzzy
          </button>
          <button
            type="button"
            className="btn btn-primary vocab-footer-btn"
            onClick={() => handleMemoryResult("remembered")}
          >
            ✅ Remembered
          </button>
          <button
            type="button"
            className="btn btn-secondary vocab-footer-btn"
            onClick={() => handleMemoryResult("forgot")}
          >
            ❌ Forgot
          </button>
        </div>
      )}
    </Layout>
  );
}
