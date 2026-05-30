import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import {
  estimateCardBlockCount,
  executeVocabularyImport,
  getImportButtonLabel,
  getImportSuccessMessage,
  isTxtFile,
  readTxtFileContent,
  validateVocabularyImport,
  type ParsedVocabularyCard,
  type VocabularyImportValidation,
} from "../lib/vocabulary/service";

const PLACEHOLDER = `reservation
/ˌrezəˈveɪʃən/
预订；预约
I'd like to make a reservation for tonight.
我想预订今晚的位置。
The reservation is under my name.
预订是用我的名字登记的。

complimentary shuttle
/ˌkɒmplɪˈmentəri ˈʃʌtl/
免费接驳班车
The hotel offers a complimentary shuttle.
酒店提供免费接驳班车。
Guests can use the complimentary shuttle to the airport.
客人可以乘坐免费班车前往机场。`;

const EMPTY_VALIDATION: VocabularyImportValidation = {
  totalCards: 0,
  newCards: [],
  existingCardsToUpdate: [],
  duplicateInFileErrors: [],
  invalidFormatErrors: [],
  canImport: false,
};

function previewSampleCards(validation: VocabularyImportValidation): ParsedVocabularyCard[] {
  return [...validation.newCards, ...validation.existingCardsToUpdate].slice(0, 5);
}

export function AddVocabularyPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] =
    useState<VocabularyImportValidation>(EMPTY_VALIDATION);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasInput = rawInput.trim().length > 0;

  const estimatedCards = useMemo(
    () => estimateCardBlockCount(rawInput),
    [rawInput],
  );
  const charCount = rawInput.length;

  const blockingErrors = [
    ...validation.invalidFormatErrors,
    ...validation.duplicateInFileErrors,
  ];

  const runPreview = () => {
    if (!hasInput) {
      setError("Please upload a TXT file or paste vocabulary cards first.");
      setValidation(EMPTY_VALIDATION);
      setPreviewVisible(false);
      return;
    }

    setPreviewing(true);
    setError("");
    try {
      setValidation(validateVocabularyImport(rawInput));
      setPreviewVisible(true);
    } finally {
      setPreviewing(false);
    }
  };

  const applyFileContent = (content: string, fileName: string) => {
    setRawInput(content);
    setLoadedFileName(fileName);
    setValidation(EMPTY_VALIDATION);
    setPreviewVisible(false);
    setError("");
  };

  const processTxtFile = async (file: File) => {
    if (!isTxtFile(file)) {
      setError("Only .txt files are supported for now.");
      return;
    }

    let content: string;
    try {
      content = await readTxtFileContent(file);
    } catch {
      setError("Failed to read the file. Please try again.");
      return;
    }

    if (!content.trim()) {
      setError("The selected file is empty.");
      return;
    }

    if (rawInput.trim()) {
      const confirmed = window.confirm(
        "This will replace the current input. Continue?",
      );
      if (!confirmed) return;
    }

    applyFileContent(content, file.name);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processTxtFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processTxtFile(file);
  };

  const runImport = () => {
    if (!hasInput) {
      setError("Please upload a TXT file or paste vocabulary cards first.");
      return;
    }

    setImporting(true);
    setError("");
    try {
      const latest = validateVocabularyImport(rawInput);
      setValidation(latest);
      setPreviewVisible(true);

      if (
        latest.duplicateInFileErrors.length > 0 ||
        latest.invalidFormatErrors.length > 0
      ) {
        setError("Import failed. Please fix the invalid cards and try again.");
        return;
      }

      if (
        latest.newCards.length === 0 &&
        latest.existingCardsToUpdate.length === 0
      ) {
        setError("No vocabulary cards to import.");
        return;
      }

      const result = executeVocabularyImport(rawInput);
      navigate("/vocabulary", {
        state: {
          importSuccessMessage: getImportSuccessMessage(
            result.newCount,
            result.updatedCount,
          ),
        },
      });
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runImport();
  };

  const sampleCards = previewSampleCards(validation);
  const importButtonLabel =
    previewVisible && validation.canImport
      ? getImportButtonLabel(
          validation.newCards.length,
          validation.existingCardsToUpdate.length,
        )
      : "Import";

  return (
    <Layout backTo="/vocabulary" backLabel="词汇复习" title="Add Vocabulary">
      <form className="form" onSubmit={handleSubmit}>
        <p className="vocab-subtitle-light">
          Upload a structured TXT file or paste vocabulary cards manually.
          Existing words in your library will be updated with the new content.
          Preview is optional — you can import directly after uploading.
        </p>

        <section
          className={`vocab-upload-zone ${isDragOver ? "vocab-upload-zone-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="vocab-upload-title">Upload structured .txt file</p>
          <p className="vocab-upload-desc">
            Upload a structured vocabulary TXT file, or paste the content below.
            Each card uses 7 lines. Blank lines separate cards.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload .txt file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="vocab-file-input"
            onChange={handleFileInputChange}
          />
          {loadedFileName && (
            <div className="vocab-file-meta">
              <p>
                <strong>Loaded:</strong> {loadedFileName}
              </p>
              <p>Characters: {charCount.toLocaleString()}</p>
              <p>Estimated cards: {estimatedCards}</p>
            </div>
          )}
          {!loadedFileName && hasInput && (
            <p className="vocab-file-meta">
              Estimated cards: {estimatedCards} · Characters:{" "}
              {charCount.toLocaleString()}
            </p>
          )}
        </section>

        <label className="field">
          <span className="field-label">Structured card input</span>
          <textarea
            className="textarea"
            rows={18}
            placeholder={PLACEHOLDER}
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setLoadedFileName(null);
              setPreviewVisible(false);
              setValidation(EMPTY_VALIDATION);
              setError("");
            }}
          />
        </label>

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={runPreview}
          disabled={!hasInput || previewing}
        >
          {previewing ? "Previewing…" : "Preview Import (optional)"}
        </button>

        {previewVisible && (
          <div className="card vocab-preview-panel">
            <p className="vocab-help-title">Import Preview</p>
            <div className="vocab-preview-stats">
              <span>Total cards detected: {validation.totalCards}</span>
              <span>New cards: {validation.newCards.length}</span>
              <span>
                Existing cards to update: {validation.existingCardsToUpdate.length}
              </span>
              <span>
                Duplicate in file: {validation.duplicateInFileErrors.length}
              </span>
              <span>
                Invalid format cards: {validation.invalidFormatErrors.length}
              </span>
            </div>

            {validation.invalidFormatErrors.length > 0 && (
              <>
                <p className="form-error">Invalid format (must fix before import):</p>
                <ul className="vocab-errors-list">
                  {validation.invalidFormatErrors.map((err, idx) => (
                    <li
                      key={`format-${err.blockIndex}-${idx}`}
                      className="form-error"
                    >
                      {err.text ? `${err.message} (${err.text})` : err.message}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {validation.duplicateInFileErrors.length > 0 && (
              <>
                <p className="form-error">Duplicate in file (must fix before import):</p>
                <ul className="vocab-errors-list">
                  {validation.duplicateInFileErrors.map((err, idx) => (
                    <li
                      key={`dup-${err.blockIndex}-${idx}`}
                      className="form-error"
                    >
                      {err.text ? `${err.message} (${err.text})` : err.message}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {validation.existingCardsToUpdate.length > 0 &&
              blockingErrors.length === 0 && (
                <div className="vocab-update-info">
                  <p className="vocab-update-info-title">
                    Existing cards will be updated:
                  </p>
                  <ul className="vocab-update-info-list">
                    {validation.existingCardsToUpdate.slice(0, 15).map((card) => (
                      <li key={`update-${card.blockIndex}-${card.normalizedText}`}>
                        Block {card.blockIndex}: {card.text}
                      </li>
                    ))}
                    {validation.existingCardsToUpdate.length > 15 && (
                      <li>
                        …and {validation.existingCardsToUpdate.length - 15} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

            {sampleCards.length > 0 && blockingErrors.length === 0 && (
              <ul className="card-list">
                {sampleCards.map((card, idx) => (
                  <li key={`${card.normalizedText}-${idx}`} className="card">
                    <div className="card-row">
                      <strong>{card.text}</strong>
                      <span className="badge badge-type">{card.type}</span>
                      {card.existingItemId && (
                        <span className="badge badge-muted">update</span>
                      )}
                    </div>
                    <p className="card-sub">{card.phonetic}</p>
                    <p className="card-sub">{card.meaningZh}</p>
                    <p className="card-sub">
                      <strong>Example 1</strong>
                      <br />
                      {card.examples[0]?.en}
                      <br />
                      {card.examples[0]?.zh}
                    </p>
                    <p className="card-sub">
                      <strong>Example 2</strong>
                      <br />
                      {card.examples[1]?.en}
                      <br />
                      {card.examples[1]?.zh}
                    </p>
                    <p className="card-sub">Category: {card.category}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!hasInput || importing}
        >
          {importing ? "Importing…" : importButtonLabel}
        </button>
      </form>
    </Layout>
  );
}
