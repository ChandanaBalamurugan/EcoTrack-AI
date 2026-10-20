import { AlertTriangle, Inbox } from "lucide-react";

export const Loading = ({ text = "Loading..." }) => (
  <div className="state" role="status">
    <div className="spinner" />
    <p>{text}</p>
  </div>
);

export const EmptyState = ({ title, text, children }) => (
  <div className="state">
    <Inbox size={36} />
    <h3>{title}</h3>
    <p>{text}</p>
    <div className="row center">{children}</div>
  </div>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div className="state error" role="alert">
    <AlertTriangle size={32} />
    <h3>Something went wrong</h3>
    <p>{message}</p>
    {onRetry && (
      <button className="btn" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);
