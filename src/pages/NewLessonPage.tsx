import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { createLessonFromText } from "../lib/lessonService";

export function NewLessonPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!rawText.trim()) {
      setError("请输入英文文本");
      return;
    }

    setLoading(true);
    try {
      const { lesson } = createLessonFromText(rawText, title);
      navigate(`/lessons/${lesson.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "NO_UNITS") {
        setError("未能切分出有效训练句，请检查文本内容");
      } else {
        setError("创建失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout backTo="/" backLabel="首页" title="新建训练">
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">训练标题（选填）</span>
          <input
            type="text"
            className="input"
            placeholder="例如：TED 摘录"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">英文文本（必填）</span>
          <textarea
            className="textarea"
            rows={12}
            placeholder="粘贴你想练习的英文内容…"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading ? "生成中…" : "生成训练"}
        </button>
      </form>
    </Layout>
  );
}
