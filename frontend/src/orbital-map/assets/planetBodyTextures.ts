import * as THREE from "three";

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

/**
 * Longitude flip-X is applied at DLL export (`BodyTextureExportLayout` v2+).
 * Web U-mirror was only paired with the old inverted attitude basis; keep off.
 */
export function resolveBodyTextureMirrorU(_bodyName: string | undefined): boolean {
  return false;
}

/** @deprecated Use {@link resolveBodyTextureMirrorU} per body. */
export const BODY_TEXTURE_MIRROR_U = false;

export function resolveBodyTextureUrl(urlPath: string): string {
  if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
    return urlPath;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const path = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
    return new URL(path, `${window.location.origin}/`).href;
  }

  return urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
}

export function buildBodyTextureCacheKey(
  url: string,
  revision?: string,
  mirrorU?: boolean,
): string {
  return `${url}::${revision ?? ""}::mu${mirrorU ? 1 : 0}`;
}

/** KSP ScaledSpace JPEG → Three.js `SphereGeometry` UV layout. */
export function applyBodyTextureDisplaySettings(
  texture: THREE.Texture,
  mirrorU: boolean,
): void {
  texture.flipY = true;
  if (mirrorU) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.offset.x = 1;
  } else {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.repeat.x = 1;
    texture.offset.x = 0;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

export function isBodyTextureReady(texture: THREE.Texture | null | undefined): boolean {
  const image = texture?.image as { width?: number; height?: number } | undefined;
  return !!image && (image.width ?? 0) > 0 && (image.height ?? 0) > 0;
}

export function loadBodyTexture(
  urlPath: string | undefined,
  revision: string | undefined,
  bodyName: string | undefined,
  onLoad: (texture: THREE.Texture) => void,
  onError?: (resolvedUrl: string) => void,
): void {
  if (!urlPath) {
    return;
  }

  const mirrorU = resolveBodyTextureMirrorU(bodyName);
  const resolvedUrl = resolveBodyTextureUrl(urlPath);
  const cacheKey = buildBodyTextureCacheKey(resolvedUrl, revision, mirrorU);
  const cached = textureCache.get(cacheKey);

  if (cached && isBodyTextureReady(cached)) {
    onLoad(cached);
    return;
  }

  loader.load(
    resolvedUrl,
    (texture) => {
      if (!isBodyTextureReady(texture)) {
        console.warn("[KspWebMap] Body texture has no image data:", resolvedUrl);
        onError?.(resolvedUrl);
        return;
      }
      applyBodyTextureDisplaySettings(texture, mirrorU);
      textureCache.set(cacheKey, texture);
      onLoad(texture);
    },
    undefined,
    () => {
      console.warn("[KspWebMap] Body texture failed to load:", resolvedUrl);
      onError?.(resolvedUrl);
    },
  );
}

/** Test helper — clears module cache between Vitest cases. */
export function clearBodyTextureCacheForTests(): void {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
}
