import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { CameraListResponse, CameraSummary } from "../api/types";

const POLL_INTERVAL_MS = 4000;

export const EMPTY_CAMERA_LIST: CameraListResponse = {
  available: false,
  source: "jrti",
  cameras: [],
  error: null,
};

export function useCameraList() {
  const [cameraList, setCameraList] = useState<CameraListResponse>(EMPTY_CAMERA_LIST);
  const [loading, setLoading] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await api.cameras();
        if (!cancelled) {
          setCameraList(response);
          setSelectedCameraId((current) => {
            if (current === null) {
              return current;
            }
            const stillPresent = response.cameras.some((camera) => camera.id === current);
            return stillPresent ? current : null;
          });
        }
      } catch {
        if (!cancelled) {
          setCameraList({
            ...EMPTY_CAMERA_LIST,
            error: "Failed to load cameras from mission control.",
          });
          setSelectedCameraId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectedCamera = useMemo(
    () => cameraList.cameras.find((camera) => camera.id === selectedCameraId) ?? null,
    [cameraList.cameras, selectedCameraId]
  );

  const selectCamera = (camera: CameraSummary) => {
    setSelectedCameraId(camera.id);
  };

  const clearSelection = () => {
    setSelectedCameraId(null);
  };

  return {
    cameraList,
    loading,
    selectedCameraId,
    selectedCamera,
    selectCamera,
    clearSelection,
    setSelectedCameraId,
  };
}
