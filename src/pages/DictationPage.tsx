import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { compareAnswer } from "../lib/compare";
import { generateWordHint, getWordCount } from "../lib/hints";
import { generateId } from "../lib/ids";
import {
  getLessonById,
  getSentenceById,
  getSentencesByLessonId,
  getWrongSentenceBySentenceId,
  saveAttempt,
  saveLesson,
  updateSentence,
  upsertWrongSentence,
} from "../lib/storage";
import {
  isCloudTtsEnabled,
  isTtsSupported,
  playSentence,
  stopPlayback,
  TtsError,
  type PlaybackUiState,
} from "../lib/tts";
import type { Attempt, CompareResult, Sentence, WrongSentence } from "../types";

export function DictationPage() {
  const { lessonId, sentenceId } = useParams<{
    lessonId: string;
    sentenceId: string;
  }>();
  const [searchParams] = useSearchParams();
  const reviewMode = searchParams.get("review") === "1";
  const navigate = useNavigate();

  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const sentence = sentenceId ? getSentenceById(sentenceId) : undefined;
  const allSentences = useMemo(
    () => (lessonId ? getSentencesByLessonId(lessonId) : []),
    [lessonId],
  );

  const [userInput, setUserInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [playState, setPlayState] = useState<PlaybackUiState>("idle");
  const [playNotice, setPlayNotice] = useState<string | null>(null);
  const [ttsUnsupported, setTtsUnsupported] = useState(!isTtsSupported());

  const playGenerationRef = useRef(0);
  const autoPlayed = useRef(false);

  const currentIndex = useMemo(
    () => allSentences.findIndex((s) => s.id === sentenceId),
    [allSentences, sentenceId],
  );

  const previousSentence = useMemo(() => {
    if (currentIndex <= 0) return null;
    return allSentences[currentIndex - 1] ?? null;
  }, [allSentences, currentIndex]);

  const nextSentence = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= allSentences.length - 1) {
      return null;
    }
    return allSentences[currentIndex + 1] ?? null;
  }, [allSentences, currentIndex]);

  const reviewQuery = reviewMode ? "?review=1" : "";

  const goToSentence = useCallback(
    (target: Sentence | null) => {
      if (!target || !lessonId) return;
      stopPlayback();
      playGenerationRef.current += 1;
      navigate(
        `/lessons/${lessonId}/sentences/${target.id}${reviewQuery}`,
      );
    },
    [lessonId, navigate, reviewQuery],
  );

  const goToPreviousSentence = () => goToSentence(previousSentence);
  const goToNextSentence = () => goToSentence(nextSentence);

  const runPlayback = useCallback(
    async (isReplay: boolean) => {
      if (!sentence) return;

      if (!isTtsSupported() && !sentence.audioUrl) {
        setTtsUnsupported(true);
        setPlayState("failed");
        setPlayNotice("Audio unavailable. Please try again.");
        return;
      }

      const generation = ++playGenerationRef.current;

      if (isReplay) {
        setReplayCount((c) => c + 1);
      }

      const willTryCloud =
        isCloudTtsEnabled() &&
        !sentence.audioUrl &&
        sentence.ttsStatus !== "ready";

      setPlayNotice(null);
      setPlayState(willTryCloud ? "generating" : "playing");
      setTtsUnsupported(false);

      try {
        const result = await playSentence(sentence, {
          primeBeforeSpeak: !isReplay,
        });

        if (generation !== playGenerationRef.current) return;

        if (result.usedBrowserFallback) {
          setPlayNotice("Using browser voice.");
        } else {
          setPlayNotice(null);
        }
        setPlayState("idle");
      } catch (error) {
        if (generation !== playGenerationRef.current) return;

        if (error instanceof TtsError && error.code === "NOT_SUPPORTED") {
          setTtsUnsupported(true);
        }

        const message =
          error instanceof TtsError && error.message
            ? error.message
            : "Audio unavailable. Please try again.";
        setPlayState("failed");
        setPlayNotice(message);
      }
    },
    [sentence],
  );

  useEffect(() => {
    return () => {
      playGenerationRef.current += 1;
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    if (!sentence || autoPlayed.current) return;
    autoPlayed.current = true;

    const timer = window.setTimeout(() => {
      void runPlayback(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [sentence, runPlayback]);

  const handleReplay = () => {
    if (playState === "playing" || playState === "generating") {
      stopPlayback();
      playGenerationRef.current += 1;
      setPlayState("idle");
      return;
    }
    void runPlayback(true);
  };

  const handleHint = () => {
    if (!sentence || submitted) return;
    const max = getWordCount(sentence.textEn);
    setHintCount((c) => Math.min(c + 1, max));
  };

  const handleSubmit = () => {
    if (!sentence || !lesson || submitted || !userInput.trim()) return;

    const result = compareAnswer(userInput, sentence.textEn);
    setCompareResult(result);
    setSubmitted(true);
    stopPlayback();
    setPlayState("idle");

    const now = new Date().toISOString();
    const attempt: Attempt = {
      id: generateId(),
      sentenceId: sentence.id,
      lessonId: lesson.id,
      userInput,
      isCorrect: result.isCorrect,
      wrongParts: result.wrongParts,
      hintUsedCount: hintCount,
      replayCount,
      createdAt: now,
    };
    saveAttempt(attempt);

    const updatedSentence: Sentence = {
      ...sentence,
      status: result.isCorrect ? "completed" : "wrong",
    };
    updateSentence(updatedSentence);

    saveLesson({
      ...lesson,
      updatedAt: now,
    });

    if (!result.isCorrect) {
      const existing = getWrongSentenceBySentenceId(sentence.id);
      const wrongEntry: WrongSentence = {
        id: existing?.id ?? generateId(),
        sentenceId: sentence.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        textEn: sentence.textEn,
        textZh: sentence.textZh,
        grammarExplanation: sentence.grammarExplanation,
        latestUserInput: userInput,
        wrongCount: (existing?.wrongCount ?? 0) + 1,
        lastPracticedAt: now,
        lastResult: "wrong",
      };
      upsertWrongSentence(wrongEntry);
    } else if (reviewMode) {
      const existing = getWrongSentenceBySentenceId(sentence.id);
      if (existing) {
        upsertWrongSentence({
          ...existing,
          latestUserInput: userInput,
          lastPracticedAt: now,
          lastResult: "correct_after_review",
        });
      }
    }
  };

  if (!lesson || !sentence) {
    return (
      <Layout backTo="/" title="句子不存在">
        <p className="form-error">找不到该训练句。</p>
        <Link to="/" className="btn btn-secondary">
          返回首页
        </Link>
      </Layout>
    );
  }

  const hintText = generateWordHint(sentence.textEn, hintCount);
  const total = allSentences.length;
  const isPlaying = playState === "playing" || playState === "generating";
  const isFirstSentence = currentIndex <= 0;
  const isLastSentence =
    currentIndex < 0 || currentIndex >= allSentences.length - 1;
  const playLabel =
    playState === "generating"
      ? "Generating audio..."
      : playState === "playing"
        ? "Stop"
        : playState === "failed"
          ? "Retry"
          : "Replay";

  const storageStatus = sentence.status;

  return (
    <Layout
      backTo={reviewMode ? "/wrong-book" : `/lessons/${lesson.id}`}
      backLabel={reviewMode ? "错题本" : "句子列表"}
    >
      <div className="dictation-header">
        <span className="dictation-progress">
          第 {sentence.order} / {total} 句
        </span>
        <StatusBadge status={storageStatus} />
        {reviewMode && <span className="badge badge-review">复习模式</span>}
      </div>

      <section className="dictation-main">
        <button
          type="button"
          className={`play-btn ${isPlaying ? "play-btn-active" : ""} ${playState === "failed" ? "play-btn-failed" : ""}`}
          onClick={handleReplay}
          aria-label={playLabel}
        >
          {playState === "playing"
            ? "■"
            : playState === "generating"
              ? "…"
              : playState === "failed"
                ? "↻"
                : "▶"}
        </button>

        <p className="dictation-play-status" aria-live="polite">
          {playState === "generating" && "Generating audio..."}
          {playState === "playing" && "Playing..."}
          {playState === "failed" &&
            (playNotice ?? "Audio unavailable. Please try again.")}
          {playState === "idle" && playNotice}
        </p>

        <p className="dictation-hint-text">
          Listen carefully and type the full sentence.
        </p>

        {ttsUnsupported && (
          <p className="form-error">
            当前浏览器不支持语音播放，请使用 Chrome / Safari 等现代浏览器。
          </p>
        )}

        {!submitted ? (
          <>
            <textarea
              className="dictation-input"
              rows={4}
              placeholder="在此输入你听到的完整句子…"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              autoFocus
            />

            <div className="hint-box">
              <p className="hint-label">逐词提示</p>
              <p className="hint-content">{hintText || "_"}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleHint}
                disabled={hintCount >= getWordCount(sentence.textEn)}
              >
                显示下一个词
              </button>
            </div>
          </>
        ) : (
          <div className="result-panel">
            <div
              className={`result-banner ${compareResult?.isCorrect ? "result-ok" : "result-fail"}`}
            >
              {compareResult?.isCorrect ? "完全正确！" : "有错误，请对照学习"}
            </div>

            <div className="result-block">
              <h3 className="result-label">你的答案</h3>
              <p className="result-answer">
                {compareResult?.userTokens.map((token, i) => {
                  if (token.status === "missing") {
                    return (
                      <span key={i} className="token-missing">
                        [{token.text}]
                      </span>
                    );
                  }
                  if (token.status === "wrong" || token.status === "extra") {
                    return (
                      <span key={i}>
                        <span className="token-wrong">{token.text}</span>{" "}
                      </span>
                    );
                  }
                  return <span key={i}>{token.text} </span>;
                })}
              </p>
            </div>

            <div className="result-block">
              <h3 className="result-label">正确答案</h3>
              <p className="result-correct">{sentence.textEn}</p>
            </div>

            <div className="result-block">
              <h3 className="result-label">中文翻译</h3>
              <p className="result-muted">{sentence.textZh}</p>
            </div>

            <div className="result-block">
              <h3 className="result-label">语法解释</h3>
              <ul className="grammar-list">
                {sentence.grammarExplanation.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <p className="practice-hint">
              可继续听写其他句子，或再次练习本句（切换后返回会重置练习状态）
            </p>
          </div>
        )}

        <div className="dictation-nav">
          <button
            type="button"
            className="btn btn-secondary dictation-nav-btn"
            onClick={goToPreviousSentence}
            disabled={isFirstSentence}
          >
            上一句
          </button>
          <button
            type="button"
            className="btn btn-primary dictation-nav-btn dictation-nav-submit"
            onClick={handleSubmit}
            disabled={submitted || !userInput.trim()}
          >
            提交答案
          </button>
          <button
            type="button"
            className="btn btn-secondary dictation-nav-btn"
            onClick={goToNextSentence}
            disabled={isLastSentence}
          >
            下一句
          </button>
        </div>
      </section>
    </Layout>
  );
}
