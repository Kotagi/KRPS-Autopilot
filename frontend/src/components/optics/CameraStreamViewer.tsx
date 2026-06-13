import { useEffect, useRef, useState } from "react";

const STREAM_SWITCH_DELAY_MS = 200;

export function CameraStreamViewer({
  cameraId,
  streamUrl,
  cameraName,
}: {
  cameraId: number;
  streamUrl: string;
  cameraName: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [streamError, setStreamError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStreamError(false);
    setFrameReady(false);
    setActiveSrc(null);

    const img = imgRef.current;
    if (img) {
      img.removeAttribute("src");
    }

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setActiveSrc(`${streamUrl}?v=${Date.now()}`);
    }, STREAM_SWITCH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const current = imgRef.current;
      if (current) {
        current.removeAttribute("src");
      }
      setActiveSrc(null);
    };
  }, [cameraId, streamUrl]);

  const showLoading = !streamError && (!activeSrc || !frameReady);

  return (
    <div className="optics-viewer-feed">
      {showLoading && (
        <div className="optics-viewer-loading">Acquiring signal…</div>
      )}
      {streamError && (
        <div className="optics-viewer-loading optics-viewer-loading--warn">
          Loss of signal — select the camera again or check JRTI in KSP.
        </div>
      )}
      {activeSrc && (
        <img
          ref={imgRef}
          className={frameReady ? "optics-viewer-feed-img--ready" : "optics-viewer-feed-img--pending"}
          src={activeSrc}
          alt={`${cameraName} live feed`}
          onError={() => {
            setFrameReady(false);
            setStreamError(true);
          }}
          onLoad={() => {
            setStreamError(false);
            setFrameReady(true);
          }}
        />
      )}
    </div>
  );
}
