"""ThreadIQ Python API gateway.

This first migration stage moves the public Ask AI API boundary to FastAPI while
forwarding requests to the existing authenticated Supabase Edge Function.
The Edge Function remains the source of truth for membership, quota enforcement,
read-only SQL validation and current deterministic answers until those routes
are ported and regression-tested in Python.
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()
UPSTREAM_TIMEOUT_SECONDS = float(os.environ.get("UPSTREAM_TIMEOUT_SECONDS", "90"))
MAX_BODY_BYTES = 16 * 1024
ALLOWED_ORIGINS = [
    "https://vignesh-s-v.github.io",
    "https://analytics.vigneshw-5416.workers.dev",
    "https://analytics-threadiq.onrender.com",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=httpx.Timeout(UPSTREAM_TIMEOUT_SECONDS, connect=10))
    yield
    await app.state.http.aclose()


app = FastAPI(
    title="ThreadIQ Analytics API",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["authorization", "apikey", "content-type", "accept"],
    expose_headers=["content-type", "cache-control"],
    max_age=600,
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Non-sensitive liveness endpoint; does not disclose configuration."""
    return {"status": "ok", "service": "threadiq-python-api"}


@app.post("/ask")
async def ask(request: Request):
    """Validate the API boundary and preserve the current secure AI behaviour."""
    origin = request.headers.get("origin")
    if not origin or origin not in ALLOWED_ORIGINS:
        return JSONResponse({"error": "This origin is not allowed."}, status_code=403)

    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer ") or len(authorization) < 20:
        return JSONResponse({"error": "A signed-in workspace session is required."}, status_code=401)

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return JSONResponse({"error": "Python API configuration is incomplete."}, status_code=503)

    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json":
        return JSONResponse({"error": "Content-Type must be application/json."}, status_code=415)

    declared_size = request.headers.get("content-length")
    if declared_size:
        try:
            if int(declared_size) > MAX_BODY_BYTES:
                return JSONResponse({"error": "Request body exceeds the 16 KB limit."}, status_code=413)
        except ValueError:
            return JSONResponse({"error": "Invalid Content-Length header."}, status_code=400)

    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        return JSONResponse({"error": "Request body exceeds the 16 KB limit."}, status_code=413)

    try:
        body: Any = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse({"error": "Please send a valid JSON question."}, status_code=400)

    if not isinstance(body, dict) or not isinstance(body.get("question"), str) or not body["question"].strip():
        return JSONResponse({"error": "Question must be non-empty text."}, status_code=400)

    # Keep the current Edge Function's authentication, workspace allowlist,
    # quota, SQL guardrails, deterministic KPI routes and answer format intact.
    upstream_url = f"{SUPABASE_URL}/functions/v1/ask-garment-data"
    headers = {
        "authorization": authorization,
        "apikey": SUPABASE_ANON_KEY,
        "content-type": "application/json",
        "accept": request.headers.get("accept", "application/x-ndjson, application/json"),
        "origin": origin,
    }

    try:
        upstream_request = app.state.http.build_request(
            "POST", upstream_url, headers=headers, content=raw
        )
        upstream = await app.state.http.send(upstream_request, stream=True)
    except httpx.TimeoutException:
        return JSONResponse({"error": "AI request timed out. Please retry."}, status_code=504)
    except httpx.HTTPError:
        return JSONResponse({"error": "AI service is temporarily unavailable."}, status_code=502)

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() in {"content-type", "cache-control", "retry-after"}
    }

    async def relay():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        relay(),
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=None,
    )
