"""WSGI entry point for PythonAnywhere or another WSGI host.

Configure FLASK_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY in the hosting provider's private
environment configuration before importing this module.
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from web_app import app as application
