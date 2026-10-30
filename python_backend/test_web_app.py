"""Regression tests for the Python-only ThreadIQ web application.

These tests avoid live Supabase/Gemini credentials and cover rendering helpers,
authentication boundaries, CSRF enforcement and SQL filters.
"""
import os
import unittest

os.environ.setdefault("FLASK_SECRET_KEY", "test-only-secret-key-not-for-production")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")

import web_app


class FormattingTests(unittest.TestCase):
    def test_indian_currency_units(self):
        self.assertEqual(web_app._money(12_500_000), "₹1.25 Cr")
        self.assertEqual(web_app._money(250_000), "₹2.50 Lakh")
        self.assertEqual(web_app._money(1_500), "₹1,500")
        self.assertEqual(web_app._money(125), "₹125")

    def test_zero_denominator_is_not_infinite(self):
        self.assertEqual(web_app._pct(10, 0), "N/A")

    def test_table_escapes_untrusted_cell_values(self):
        rendered = web_app._table(
            [{"name": "<script>alert(1)</script>"}],
            [("name", "Name", None)],
        )
        self.assertNotIn("<script>", rendered)
        self.assertIn("&lt;script&gt;", rendered)


class FilterTests(unittest.TestCase):
    def test_year_and_country_filters_are_constrained_and_escaped(self):
        clause = web_app._filters_sql("2024", "US'A")
        self.assertIn("EXTRACT(YEAR FROM month)::int = 2024", clause)
        self.assertIn("country = 'US''A'", clause)

    def test_invalid_year_is_ignored(self):
        self.assertEqual(web_app._filters_sql("2024 OR 1=1", ""), "")

    def test_disabled_country_filter_is_not_added(self):
        self.assertEqual(
            web_app._filters_sql("2024", "USA", has_country=False),
            " AND EXTRACT(YEAR FROM month)::int = 2024",
        )


class IntentTests(unittest.TestCase):
    def test_common_sales_intents(self):
        cases = {
            "Which country has the highest revenue?": "country_revenue",
            "Which buyer gives the highest profit?": "buyer_profit",
            "Show monthly sales growth": "monthly_sales",
            "Compare 2024 vs 2023 revenue": "year_compare",
        }
        for question, expected in cases.items():
            with self.subTest(question=question):
                self.assertEqual(web_app._classify_sales_question(question), expected)

    def test_unrecognized_question_uses_ai_fallback(self):
        self.assertIsNone(web_app._classify_sales_question("Explain the reasons for margin decline"))


class RequestBoundaryTests(unittest.TestCase):
    def setUp(self):
        web_app.app.config.update(TESTING=True)
        web_app.SESSIONS.clear()
        self.client = web_app.app.test_client()

    def test_health_is_public_and_non_sensitive(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["engine"], "python")

    def test_dashboard_requires_authentication(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Sign in to ThreadIQ", response.data)

    def test_unknown_module_redirects_anonymous_user(self):
        response = self.client.get("/page/not-a-module")
        self.assertEqual(response.status_code, 302)

    def test_post_without_csrf_is_rejected(self):
        with self.client.session_transaction() as browser_session:
            browser_session["csrf_token"] = "expected-token"
        response = self.client.post("/logout", data={"csrf_token": "wrong-token"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
