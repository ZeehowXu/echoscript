import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { initializeBuiltInVocabularyIfNeeded } from "../lib/vocabulary/builtin";
import {
  formatStatusPercent,
  getVocabularyStatusStats,
} from "../lib/vocabulary/status";
import {
  markTtsPreplayedForItem,
  prepareSpeechSynthesisForPlayback,
  speakText,
} from "../lib/tts";
import { getReviewQueue, getVocabularyItems } from "../lib/vocabularyStorage";

type ImportLocationState = {
  importSuccessMessage?: string;
};

type InitStatus = "loading" | "ready" | "failed";

const STATUS_SEGMENTS = [
  { key: "new" as const, label: "New", className: "status-seg-new" },
  { key: "fuzzy" as const, label: "Fuzzy", className: "status-seg-fuzzy" },
  {
    key: "remembered" as const,
    label: "Remembered",
    className: "status-seg-remembered",
  },
  { key: "forgot" as const, label: "Forgot", className: "status-seg-forgot" },
];

function getReviewHint(stats: ReturnType<typeof getVocabularyStatusStats>): string {
  const strengthen = stats.forgot + stats.fuzzy;
  if (strengthen > 0) {
    return `You have ${strengthen} words to strengthen.`;
  }
  if (stats.total > 0 && stats.new === stats.total) {
    return "No reviewed words yet. Start with new vocabulary.";
  }
  if (stats.total > 0 && stats.remembered === stats.total) {
    return "All words remembered. Practice again if you want.";
  }
  return "";
}

export function VocabularyHomePage() {
  const location = useLocation();
  const locationState = location.state as ImportLocationState | null;
  const importSuccessFromNav = locationState?.importSuccessMessage ?? null;
  const [importBannerDismissed, setImportBannerDismissed] = useState(false);
  const [initStatus, setInitStatus] = useState<InitStatus>(() =>
    getVocabularyItems().length > 0 ? "ready" : "loading",
  );

  useEffect(() => {
    if (importSuccessFromNav) {
      window.history.replaceState({}, document.title);
    }
  }, [importSuccessFromNav]);

  useEffect(() => {
    if (getVocabularyItems().length > 0) {
      return;
    }

    let cancelled = false;

    void initializeBuiltInVocabularyIfNeeded().then((result) => {
      if (cancelled) return;
      if (
        result.status === "fetch_failed" ||
        result.status === "validation_failed"
      ) {
        setInitStatus("failed");
        return;
      }
      setInitStatus("ready");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const importSuccessMessage =
    importSuccessFromNav && !importBannerDismissed ? importSuccessFromNav : null;

  const items = getVocabularyItems();
  const statusStats = getVocabularyStatusStats(items);
  const reviewHint = getReviewHint(statusStats);

  const handleStartReview = () => {
    prepareSpeechSynthesisForPlayback();
    const firstItem = getReviewQueue()[0];
    if (!firstItem) return;
    void speakText(firstItem.text)
      .then(() => markTtsPreplayedForItem(firstItem.id))
      .catch(() => {
        /* review page will auto-play if preplay failed */
      });
  };

  if (initStatus === "loading") {
    return (
      <Layout backTo="/" backLabel="首页" title="Vocabulary Review">
        <p className="practice-hint vocab-init-status">
          Initializing built-in vocabulary…
        </p>
      </Layout>
    );
  }

  if (initStatus === "failed") {
    return (
      <Layout backTo="/" backLabel="首页" title="Vocabulary Review">
        <p className="form-error">
          Failed to load built-in vocabulary. You can still import a TXT file
          manually.
        </p>
        <Link to="/vocabulary/new" className="btn btn-primary">
          Import TXT File
        </Link>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout backTo="/" backLabel="首页" title="Vocabulary Review">
        <section className="vocab-hero">
          <p className="vocab-subtitle">
            Review IELTS listening words, phrases, and collocations.
          </p>
        </section>
        <EmptyState
          title="还没有词汇"
          description="导入 TXT 或等待内置词库加载完成后开始复习。"
          action={
            <Link to="/vocabulary/new" className="btn btn-primary">
              Add Vocabulary
            </Link>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout backTo="/" backLabel="首页" title="Vocabulary Review">
      <section className="vocab-hero">
        <p className="vocab-subtitle">
          Review IELTS listening words, phrases, and collocations.
        </p>
        <div className="hero-actions">
          <Link
            to="/vocabulary/review"
            className="btn btn-primary"
            onClick={handleStartReview}
          >
            Start Review
          </Link>
          <Link to="/vocabulary/new" className="btn btn-secondary">
            Add Vocabulary
          </Link>
        </div>
        {reviewHint && <p className="practice-hint vocab-review-hint">{reviewHint}</p>}
      </section>

      {importSuccessMessage && (
        <div className="vocab-import-success" role="status">
          {importSuccessMessage.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button
            type="button"
            className="vocab-import-success-dismiss"
            onClick={() => setImportBannerDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <section className="vocab-status-overview">
        <h2 className="section-title">Status Overview</h2>
        <p className="vocab-total-line">
          Total Vocabulary: <strong>{statusStats.total}</strong>
        </p>

        <div
          className="vocab-status-bar"
          role="img"
          aria-label="Vocabulary status distribution"
        >
          {STATUS_SEGMENTS.map(({ key, className }) => {
            const count = statusStats[key];
            if (count === 0 || statusStats.total === 0) return null;
            const width = (count / statusStats.total) * 100;
            return (
              <div
                key={key}
                className={`vocab-status-bar-segment ${className}`}
                style={{ width: `${width}%` }}
                title={`${key}: ${count}`}
              />
            );
          })}
        </div>

        <ul className="vocab-status-legend">
          {STATUS_SEGMENTS.map(({ key, label }) => (
            <li key={key}>
              <span className={`vocab-status-dot status-seg-${key}`} />
              {label} {statusStats[key]}
            </li>
          ))}
        </ul>
      </section>

      <section className="vocab-status-cards">
        {STATUS_SEGMENTS.map(({ key, label }) => (
          <div key={key} className={`stat-card stat-card-${key}`}>
            <span className="stat-label">{label}</span>
            <span className="stat-value">{statusStats[key]}</span>
            <span className="stat-sublabel">
              {statusStats[key] === 1 ? "word" : "words"}
            </span>
            <span className="stat-percent">
              {formatStatusPercent(statusStats[key], statusStats.total)}
            </span>
          </div>
        ))}
      </section>
    </Layout>
  );
}
