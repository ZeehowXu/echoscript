import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthStatus } from "./AuthStatus";

interface LayoutProps {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
  title?: string;
  showAuthStatus?: boolean;
}

export function Layout({
  children,
  backTo,
  backLabel = "返回",
  title,
  showAuthStatus = true,
}: LayoutProps) {
  return (
    <div className="layout">
      {showAuthStatus && <AuthStatus />}
      <header className="layout-header">
        {backTo ? (
          <Link to={backTo} className="back-link">
            ← {backLabel}
          </Link>
        ) : (
          <span />
        )}
        {title && <h1 className="layout-title">{title}</h1>}
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
