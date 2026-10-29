import os
import unittest

os.environ.setdefault("FLASK_SECRET_KEY", "unit-test-secret-not-for-production")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from web_app import app, SESSIONS


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

    def test_login_page_is_server_rendered(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Sign in to your workspace", response.data)
        self.assertIn(b"Confirm your account email", response.data)
        self.assertNotIn(b"<script", response.data.lower())

    def test_signed_cookie_contains_only_opaque_session_identifier(self):
        with self.client.session_transaction() as browser_session:
            browser_session["sid"] = "random-opaque-id"
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        # Auth tokens are held in the server-side cache, never serialized to the cookie.
        with self.client.session_transaction() as browser_session:
            self.assertEqual(set(browser_session.keys()), {"sid"})
            self.assertNotIn("token", browser_session)


if __name__ == "__main__":
    unittest.main()
