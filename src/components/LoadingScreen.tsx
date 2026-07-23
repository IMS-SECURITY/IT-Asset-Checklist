import { TvseBrandMark } from "@/components/TvseBrandMark";

interface LoadingScreenProps {
  /** Small caption shown beneath the animated dots. */
  label?: string;
  /** Render inline (fills parent) instead of a fixed full-viewport overlay. */
  fullScreen?: boolean;
}

/**
 * Branded loading screen — matches the TVSE Attendance Portal animation:
 * pale blue canvas, italic TVSE wordmark, three pulsing dots.
 */
export function LoadingScreen({ label, fullScreen = true }: LoadingScreenProps) {
  return (
    <div
      className={
        fullScreen
          ? "loading-screen fixed inset-0 z-50 flex items-center justify-center"
          : "loading-screen flex min-h-[60vh] w-full items-center justify-center"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <div className="loading-screen-content flex flex-col items-center gap-5 px-6 text-center">
        <TvseBrandMark />
        <div className="loading-dots-row flex items-center gap-2.5" aria-hidden="true">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
        {label && <p className="loading-caption">{label}</p>}
      </div>
    </div>
  );
}
