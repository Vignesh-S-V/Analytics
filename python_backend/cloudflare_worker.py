"""Cloudflare Workers entrypoint for the server-rendered Flask app.

Worker secrets are copied into os.environ before importing the existing app,
because its configuration is read when the modules are imported.
"""
from __future__ import annotations

import importlib
import os

from workers import WorkerEntrypoint, wsgi


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


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        for name in _SECRET_NAMES:
            value = getattr(self.env, name, None)
            if value is not None and str(value):
                os.environ[name] = str(value)

        # Import after secrets are available: Flask validates FLASK_SECRET_KEY
        # at module initialization and main.py reads Supabase/Gemini settings.
        module = importlib.import_module("web_app")
        return await wsgi.fetch(module.app, request, self.env)
