"""Cloudflare Workers entrypoint for the server-rendered Flask app.

Secrets are read from Worker bindings before importing app modules, because
the existing Flask/FastAPI modules read configuration from os.environ at import.
"""
from __future__ import annotations

import importlib
import os

from workers import wsgi


_SECRET_NAMES = (
    "FLASK_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "UPSTREAM_TIMEOUT_SECONDS",
    "ALLOWED_ORIGINS",
)


class Default:
    async def fetch(self, request, env):
        for name in _SECRET_NAMES:
            value = getattr(env, name, None)
            if value is not None and str(value):
                os.environ[name] = str(value)

        # Import only after Worker bindings have been copied into the app's
        # expected environment variables.
        module = importlib.import_module("web_app")
        return await wsgi.fetch(module.app, request, env)
