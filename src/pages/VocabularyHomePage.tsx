import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { initializeBuiltInVocabularyIfNeeded } from "../lib/vocabulary/builtin";
import { VOCABULARY_CATEGORIES } from "../types/vocabulary";
import {
  getVocabularyMemoryStateMap,
  getVocabularyItems,
  getVocabularyStats,
  groupItemsByCategory,
} from "../lib/vocabularyStorage";

type ImportLocationState = {
  importSuccessMessage?: string;
};

type InitStatus = "loading" | "ready" | "failed";

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
  const memoryMap = getVocabularyMemoryStateMap();
  const stats = getVocabularyStats();
  const grouped = groupItemsByCategory(items);

  const categoriesWithItems = VOCABULARY_CATEGORIES.filter(
    (cat) => (grouped.get(cat)?.length ?? 0) > 0,
  );

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

  return (
    <Layout backTo="/" backLabel="首页" title="Vocabulary Review">
      <section className="vocab-hero">
        <p className="vocab-subtitle">
          Review unfamiliar words, phrases, and collocations.
        </p>
        <div className="hero-actions">
          <Link to="/vocabulary/new" className="btn btn-primary">
            Add Vocabulary
          </Link>
          {items.length > 0 ? (
            <Link to="/vocabulary/review" className="btn btn-secondary">
              Start Review
            </Link>
          ) : (
            <span className="btn btn-secondary btn-disabled">Start Review</span>
          )}
        </div>
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

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Items</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.newCount}</span>
          <span className="stat-label">New</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.learning}</span>
          <span className="stat-label">Learning</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.remembered}</span>
          <span className="stat-label">Remembered</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.dueNow}</span>
          <span className="stat-label">Due Now</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.categories}</span>
          <span className="stat-label">Categories</span>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Categories</h2>
        {items.length === 0 ? (
          <EmptyState
            title="还没有词汇"
            description="批量添加单词、词组或固定搭配，系统会自动分类。"
            action={
              <Link to="/vocabulary/new" className="btn btn-primary">
                Add Vocabulary
              </Link>
            }
          />
        ) : (
          <ul className="card-list">
            {categoriesWithItems.map((category) => {
              const categoryItems = grouped.get(category) ?? [];
              const weak = categoryItems.filter((i) => {
                const s = memoryMap.get(i.id);
                return (
                  !s ||
                  s.reviewCount === 0 ||
                  s.lastResult === "forgot" ||
                  s.lastResult === "fuzzy"
                );
              }).length;
              return (
                <li key={category}>
                  <div className="card">
                    <div className="card-row">
                      <h3 className="card-title">{category}</h3>
                      <span className="card-meta">{categoryItems.length} items</span>
                    </div>
                    <p className="card-sub">
                      {weak} weak · {categoryItems.length - weak} strengthening/stable
                    </p>
                    <ul className="vocab-preview-list">
                      {categoryItems.slice(0, 4).map((item) => (
                        <li key={item.id} className="vocab-preview-item">
                          <span>{item.text}</span>
                          <span
                            className={`badge ${
                              (memoryMap.get(item.id)?.lastResult ?? "new") === "remembered"
                                ? "badge-vocab-known"
                                : (memoryMap.get(item.id)?.lastResult ?? "new") === "fuzzy"
                                  ? "badge-vocab-learning"
                                  : "badge-vocab-new"
                            }`}
                          >
                            {memoryMap.get(item.id)?.lastResult ?? "new"}
                          </span>
                        </li>
                      ))}
                      {categoryItems.length > 4 && (
                        <li className="vocab-preview-more">
                          +{categoryItems.length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
}
