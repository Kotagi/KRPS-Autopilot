import { useAppStore } from "../../store/appStore";

export function ErrorBanner() {
  const lastError = useAppStore((s) => s.lastError);
  const setLastError = useAppStore((s) => s.setLastError);

  if (!lastError) return null;

  return (
    <div className="error-banner">
      {lastError}
      <button
        className="secondary"
        style={{ marginLeft: "1rem" }}
        onClick={() => setLastError(null)}
      >
        Dismiss
      </button>
    </div>
  );
}
