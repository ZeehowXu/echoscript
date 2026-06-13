import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { syncBuiltInVocabularyFromSource } from "../lib/vocabulary/builtin";
import {
  formatDictationPercent,
  getDictationPracticeQueue,
  getDictationStatusStats,
  syncDictationProgressFromCloud,
} from "../lib/vocabulary/dictationStorage";
import {
  markTtsPreplayedForItem,
  prepareSpeechSynthesisForPlayback,
  speakText,
} from "../lib/tts";
import { getVocabularyItems } from "../lib/vocabularyStorage";

type InitStatus = "loading" | "ready" | "failed";

const STATUS_SEGMENTS = [
  {
    key: "pending" as const,
    label: "Pending Dictation",
    className: "dictation-seg-pending",
  },
  { key: "correct" as const, label: "Correct", className: "dictation-seg-correct" },
  {
    key: "incorrect" as const,
    label: "Incorrect",
    className: "dictation-seg-incorrect",
  },
];

export function VocabularyDictationHomePage() {
  const { user } = useAuth();
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [dataVersion, setDataVersion] = useState(0);
  const [cloudSyncError, setCloudSyncError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void syncBuiltInVocabularyFromSource().then((result) => {
      if (cancelled) return;
      if (result.status === "success") {
        setInitStatus("ready");
        setDataVersion((v) => v + 1);
        return;
      }
      setInitStatus(getVocabularyItems().length > 0 ? "ready" : "failed");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || initStatus !== "ready") return;
    if (getVocabularyItems().length === 0) return;

    let cancelled = false;

    void syncDictationProgressFromCloud(user.id)
      .then(() => {
        if (!cancelled) {
          setCloudSyncError("");
          setDataVersion((v) => v + 1);
        }
      })
      .catch((error) => {
        console.error("Failed to sync dictation progress from cloud:", error);
        if (!cancelled) {
          setCloudSyncError(
            "Could not load cloud progress. Showing local data only.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, initStatus]);

  void dataVersion;
  const items = getVocabularyItems();
  const stats = getDictationStatusStats(items);

  const handleStartDictation = () => {
    prepareSpeechSynthesisForPlayback();
    const firstItem = getDictationPracticeQueue(items)[0];
    if (!firstItem) return;
    void speakText(firstItem.text)
      .then(() => markTtsPreplayedForItem(firstItem.id))
      .catch(() => {
        /* practice page will auto-play if preplay failed */
      });
  };

  if (initStatus === "loading") {
    return (
      <Layout backTo="/" backLabel="首页" title="Vocabulary Dictation">
        <p className="practice-hint vocab-init-status">
          Loading vocabulary…
        </p>
      </Layout>
    );
  }

  if (initStatus === "failed" || items.length === 0) {
    return (
      <Layout backTo="/" backLabel="首页" title="Vocabulary Dictation">
        <section className="vocab-hero">
          <p className="vocab-subtitle">
            Listen to each word and type the correct spelling.
          </p>
        </section>
        <EmptyState
          title="No vocabulary available"
          description="Please add vocabulary first."
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
    <Layout backTo="/" backLabel="首页" title="Vocabulary Dictation">
      <section className="vocab-hero">
        <p className="vocab-subtitle">
          Listen to each word and type the correct spelling.
        </p>
        <div className="hero-actions">
          <Link
            to="/vocabulary/dictation/practice"
            className="btn btn-primary"
            onClick={handleStartDictation}
          >
            Start Dictation
          </Link>
        </div>
        <p className="practice-hint vocab-sync-hint">
          {user
            ? "Dictation progress synced to your account."
            : "Dictation progress is saved on this browser only. Sign in to sync across devices."}
        </p>
        {cloudSyncError && (
          <p className="form-error vocab-sync-error">{cloudSyncError}</p>
        )}
      </section>

      <section className="vocab-status-overview">
        <h2 className="section-title">Dictation Progress</h2>
        <p className="vocab-total-line">
          Total Vocabulary: <strong>{stats.total}</strong>
        </p>

        <div
          className="vocab-status-bar"
          role="img"
          aria-label="Dictation status distribution"
        >
          {STATUS_SEGMENTS.map(({ key, className }) => {
            const count = stats[key];
            if (count === 0 || stats.total === 0) return null;
            const width = (count / stats.total) * 100;
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
              <span className={`vocab-status-dot dictation-seg-${key}`} />
              {label} {stats[key]}
            </li>
          ))}
        </ul>
      </section>

      <section className="vocab-status-cards dictation-status-cards">
        {STATUS_SEGMENTS.map(({ key, label }) => (
          <div key={key} className={`stat-card dictation-card-${key}`}>
            <span className="stat-label">{label}</span>
            <span className="stat-value">{stats[key]}</span>
            <span className="stat-sublabel">
              {stats[key] === 1 ? "word" : "words"}
            </span>
            <span className="stat-percent">
              {formatDictationPercent(stats[key], stats.total)}
            </span>
          </div>
        ))}
      </section>
    </Layout>
  );
}
