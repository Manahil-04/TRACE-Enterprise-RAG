import { useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

export type NoticeType = "error" | "warning" | "success" | "info" | "loading";

interface NoticeProps {
  type: NoticeType;
  title: string;
  message?: string;
  details?: string;
  onDismiss?: () => void;
  children?: ReactNode;
}

function NoticeIcon({ type }: { type: NoticeType }) {
  if (type === "success") return <CheckIcon width={15} height={15} />;
  if (type === "error" || type === "warning") return <AlertIcon width={15} height={15} />;
  if (type === "info") return <InfoIcon width={15} height={15} />;
  return <span className="spinner" />;
}

export function Notice({ type, title, message, details, onDismiss, children }: NoticeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`notice notice-${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="notice-icon">
        <NoticeIcon type={type} />
      </span>
      <div className="notice-body">
        <div className="notice-title">{title}</div>
        {message && <p className="notice-message">{message}</p>}
        {children && <div className="notice-extra">{children}</div>}
        {details && (
          <button type="button" className="notice-details-toggle" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? "Hide details" : "View details"}
          </button>
        )}
        {showDetails && details && <pre className="notice-details">{details}</pre>}
      </div>
      {onDismiss && (
        <button type="button" className="icon-button notice-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <CloseIcon width={13} height={13} />
        </button>
      )}
    </div>
  );
}
