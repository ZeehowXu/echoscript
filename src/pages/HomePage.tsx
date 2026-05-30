import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { getLessons } from "../lib/storage";

export function HomePage() {
  const lessons = getLessons();

  return (
    <Layout title="精听听写">
      <section className="hero">
        <p className="hero-tagline">用你感兴趣的英文语料，做句子级精听训练</p>
        <div className="hero-actions">
          <Link to="/lessons/new" className="btn btn-primary">
            新建训练
          </Link>
          <Link to="/wrong-book" className="btn btn-secondary">
            错题本
          </Link>
          <Link to="/vocabulary" className="btn btn-secondary">
            Vocabulary
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">我的训练</h2>
        {lessons.length === 0 ? (
          <EmptyState
            title="还没有训练"
            description="粘贴一段英文文本，系统会自动切分成训练句子。"
            action={
              <Link to="/lessons/new" className="btn btn-primary">
                创建第一个训练
              </Link>
            }
          />
        ) : (
          <ul className="card-list">
            {lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link to={`/lessons/${lesson.id}`} className="card card-link">
                  <div className="card-row">
                    <h3 className="card-title">{lesson.title}</h3>
                    <span className="card-meta">{lesson.sentenceCount} 句</span>
                  </div>
                  <p className="card-sub">
                    {new Date(lesson.createdAt).toLocaleString("zh-CN")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
