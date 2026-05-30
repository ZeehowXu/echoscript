import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-desc">{description}</p>
      {action}
    </div>
  );
}
