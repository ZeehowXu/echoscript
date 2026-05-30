import type { SentenceStatus, WrongResult } from "../types";

const STATUS_LABELS: Record<SentenceStatus, string> = {
  not_started: "未开始",
  completed: "已完成",
  wrong: "有错误",
};

const WRONG_RESULT_LABELS: Record<WrongResult, string> = {
  wrong: "待复习",
  correct_after_review: "最近答对",
};

interface StatusBadgeProps {
  status: SentenceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
  );
}

export function WrongResultBadge({ result }: { result: WrongResult }) {
  return (
    <span className={`badge badge-${result}`}>
      {WRONG_RESULT_LABELS[result]}
    </span>
  );
}
