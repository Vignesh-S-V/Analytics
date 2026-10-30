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


class ChartTests(unittest.TestCase):
    def test_svg_trend_is_server_rendered_and_escapes_labels(self):
        rows = [
            {"month": "2024-04-01", "revenue_inr": 1000},
            {"month": "2024-05-01", "revenue_inr": 1500},
            {"month": "2024-06-01", "revenue_inr": 1200},
        ]
        svg = web_app._svg_trend(rows, "revenue_inr", "Revenue <trend>")
        self.assertIn("<svg", svg)
        self.assertIn("Revenue &lt;trend&gt;", svg)
        self.assertIn("<polyline", svg)

    def test_financial_year_comparison_uses_matching_months(self):
        rows = [
            {"month": "2023-04-01", "revenue_inr": 100, "shipped_qty": 10},
            {"month": "2023-05-01", "revenue_inr": 200, "shipped_qty": 20},
            {"month": "2024-04-01", "revenue_inr": 150, "shipped_qty": 15},
            {"month": "2024-05-01", "revenue_inr": 300, "shipped_qty": 30},
        ]
        result = web_app._financial_year_comparison(rows)
        self.assertEqual(result["current_year"], 2024)
        self.assertEqual(result["previous_year"], 2023)
        self.assertEqual(len(result["months"]), 2)
        self.assertAlmostEqual(result["revenue_growth"], 50.0)
        self.assertAlmostEqual(result["qty_growth"], 50.0)

    def test_financial_year_comparison_requires_two_years(self):
        rows = [{"month": "2024-04-01", "revenue_inr": 10, "shipped_qty": 1}]
        self.assertIsNone(web_app._financial_year_comparison(rows))


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


    def test_authentication_is_read_from_http_only_cookie_not_process_memory(self):
        calls = []
        def fake_request(method, path, token, *, body=None, params=None):
            calls.append((method, path, token))
            if path == "/auth/v1/user":
                return 200, {"id": "user-123", "email": "person@example.com", "email_confirmed_at": "2026-01-01"}
            return 200, [{"is_active": True}]
        original = web_app._supabase_request
        web_app._supabase_request = fake_request
        try:
            with web_app.app.test_request_context(
                "/", base_url="https://localhost",
                headers={"Cookie": f"{web_app.AUTH_COOKIE_NAME}=signed-supabase-access-token"},
            ):
                user = web_app._current_user()
        finally:
            web_app._supabase_request = original
        self.assertEqual(user["user_id"], "user-123")
        self.assertEqual(user["token"], "signed-supabase-access-token")
        self.assertEqual([call[1] for call in calls], ["/auth/v1/user", "/rest/v1/threadiq_workspace_members"])

    def test_inactive_workspace_member_is_rejected(self):
        original = web_app._supabase_request
        def fake_request(method, path, token, *, body=None, params=None):
            if path == "/auth/v1/user":
                return 200, {"id": "user-123", "email_confirmed_at": "2026-01-01"}
            return 200, [{"is_active": False}]
        web_app._supabase_request = fake_request
        try:
            with web_app.app.test_request_context(
                "/", base_url="https://localhost",
                headers={"Cookie": f"{web_app.AUTH_COOKIE_NAME}=signed-supabase-access-token"},
            ):
                self.assertIsNone(web_app._current_user())
        finally:
            web_app._supabase_request = original

    def test_post_without_csrf_is_rejected(self):
        with self.client.session_transaction() as browser_session:
            browser_session["csrf_token"] = "expected-token"
        response = self.client.post("/logout", data={"csrf_token": "wrong-token"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
