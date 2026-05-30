import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import {
  getLessonById,
  getSentencesByLessonId,
} from "../lib/storage";

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const sentences = useMemo(
    () => (lessonId ? getSentencesByLessonId(lessonId) : []),
    [lessonId],
  );

  const stats = useMemo(() => {
    const completed = sentences.filter((s) => s.status === "completed").length;
    const wrong = sentences.filter((s) => s.status === "wrong").length;
    return { completed, wrong, total: sentences.length };
  }, [sentences]);

  if (!lesson) {
    return (
      <Layout backTo="/" title="训练不存在">
        <p className="form-error">找不到该训练，可能已被删除。</p>
        <Link to="/" className="btn btn-secondary">
          返回首页
        </Link>
      </Layout>
    );
  }

  return (
    <Layout backTo="/" backLabel="首页" title={lesson.title}>
      <div className="stats-bar">
        <span>共 {stats.total} 句</span>
        <span className="stat-ok">已完成 {stats.completed}</span>
        <span className="stat-warn">有错误 {stats.wrong}</span>
      </div>

      <ul className="card-list sentence-list">
        {sentences.map((sentence) => (
          <li key={sentence.id}>
            <Link
              to={`/lessons/${lesson.id}/sentences/${sentence.id}`}
              className="card card-link"
            >
              <div className="card-row">
                <span className="sentence-num">第 {sentence.order} 句</span>
                <StatusBadge status={sentence.status} />
              </div>
              <p className="sentence-preview">{sentence.textEn}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
