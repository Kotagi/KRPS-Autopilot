"""Proxy KspWebMap telemetry and body textures into the Autopilot API."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse

from backend.config import KSP_WEB_MAP_URL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/map", tags=["map"])

_TEXTURE_PREFIX = "/assets/bodies/"
_PROXY_TEXTURE_PREFIX = "/api/map/bodies/"


def _rewrite_texture_urls(payload: dict[str, Any]) -> dict[str, Any]:
    bodies = payload.get("bodies")
    if not isinstance(bodies, list):
        return payload

    for body in bodies:
        if not isinstance(body, dict):
            continue
        url = body.get("bodyTextureUrl")
        if isinstance(url, str) and url.startswith(_TEXTURE_PREFIX):
            body["bodyTextureUrl"] = _PROXY_TEXTURE_PREFIX + url[len(_TEXTURE_PREFIX) :]
    return payload


async def _fetch_ksp_web_map(path: str) -> httpx.Response:
    url = f"{KSP_WEB_MAP_URL.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            return await client.get(url)
    except httpx.RequestError as exc:
        logger.warning("KspWebMap unreachable at %s: %s", url, exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "KspWebMap mod is not reachable. Install KspWebMap from MyMods and "
                "ensure KSP is in flight with the mod active on port 8750."
            ),
        ) from exc


@router.get("/health")
async def map_health() -> dict[str, Any]:
    response = await _fetch_ksp_web_map("/api/health")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@router.get("/telemetry")
async def map_telemetry() -> JSONResponse:
    response = await _fetch_ksp_web_map("/api/telemetry")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    payload = response.json()
    if isinstance(payload, dict):
        payload = _rewrite_texture_urls(payload)
    return JSONResponse(content=payload)


@router.get("/bodies/{filename}")
async def map_body_texture(filename: str) -> Response:
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid body texture filename")

    response = await _fetch_ksp_web_map(f"/assets/bodies/{filename}")
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    content_type = response.headers.get("content-type", "image/jpeg")
    return Response(content=response.content, media_type=content_type)
