import os
import unittest
from unittest.mock import patch

os.environ.setdefault("FLASK_SECRET_KEY", "unit-test-secret-not-for-production")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from web_app import app


class PythonWebAppTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_health_endpoint_does_not_disclose_configuration(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {
            "status": "ok",
            "service": "threadiq-python-web",
            "engine": "python",
        })
        self.assertNotIn(b"SUPABASE", response.data)

    def test_login_page_is_server_rendered_and_has_csrf_token(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Sign in to ThreadIQ", response.data)
        self.assertIn(b'name="csrf_token"', response.data)
        self.assertNotIn(b"<script", response.data.lower())

    def test_all_analytics_pages_are_server_rendered_without_javascript(self):
        user = {"token": "fake-user-token", "user_id": "user-123", "email": "approved@example.test"}
        with patch("web_app._current_user", return_value=user), patch("web_app._query", return_value=[]):
            paths = [
                "/", "/page/ask-ai", "/page/product-economics", "/page/sales-buyers",
                "/page/production", "/page/marketing-roi", "/page/procurement",
                "/page/investment-lab",
            ]
            for path in paths:
                with self.subTest(path=path):
                    response = self.client.get(path)
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn(b"<script", response.data.lower())
                    self.assertIn(b"ThreadIQ", response.data)

    def test_unknown_module_is_not_found(self):
        with patch("web_app._current_user", return_value={"token": "x", "user_id": "u"}):
            response = self.client.get("/page/not-a-real-page")
        self.assertEqual(response.status_code, 404)

    def test_cookie_never_serializes_supabase_access_token(self):
        with self.client.session_transaction() as browser_session:
            browser_session["sid"] = "opaque-session-id"
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        with self.client.session_transaction() as browser_session:
            self.assertNotIn("token", browser_session)
            self.assertNotIn("access_token", browser_session)

    def test_post_requires_csrf_token(self):
        response = self.client.post("/logout", data={})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
