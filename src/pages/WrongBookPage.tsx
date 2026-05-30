import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Layout } from "../components/Layout";
import { WrongResultBadge } from "../components/StatusBadge";
import { getWrongSentences } from "../lib/storage";

export function WrongBookPage() {
  const items = getWrongSentences();

  return (
    <Layout backTo="/" backLabel="首页" title="错题本">
      {items.length === 0 ? (
        <EmptyState
          title="暂无错题"
          description="听写错误的句子会自动收录在这里，方便你反复复习。"
          action={
            <Link to="/" className="btn btn-secondary">
              返回首页
            </Link>
          }
        />
      ) : (
        <ul className="card-list">
          {items.map((item) => (
            <li key={item.id} className="card wrong-card">
              <div className="card-row">
                <span className="card-meta">{item.lessonTitle}</span>
                <WrongResultBadge result={item.lastResult} />
              </div>
              <p className="wrong-en">{item.textEn}</p>
              <p className="wrong-user">
                最近错误：{item.latestUserInput || "—"}
              </p>
              <div className="wrong-meta">
                <span>错误 {item.wrongCount} 次</span>
                <span>
                  {new Date(item.lastPracticedAt).toLocaleString("zh-CN")}
                </span>
              </div>
              <Link
                to={`/lessons/${item.lessonId}/sentences/${item.sentenceId}?review=1`}
                className="btn btn-primary btn-sm"
              >
                复习
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
