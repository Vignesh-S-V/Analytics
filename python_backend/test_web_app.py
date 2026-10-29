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

    def test_common_sales_questions_use_fast_local_classifier(self):
        from web_app import _classify_sales_question

        self.assertEqual(_classify_sales_question("Which country has the highest revenue?"), "country_revenue")
        self.assertEqual(_classify_sales_question("Which buyer gives the highest profit?"), "buyer_profit")
        self.assertEqual(_classify_sales_question("Show monthly sales growth"), "monthly_sales")
        self.assertEqual(_classify_sales_question("Compare 2024 vs 2023 revenue and profit"), "year_compare")
        self.assertIsNone(_classify_sales_question("Why did profit decrease and what caused it?"))

    def test_fast_sales_answer_runs_one_read_only_query_and_returns_table_metadata(self):
        from web_app import _fast_sales_result

        sample = [{"country": "USA", "revenue_inr": 1473000000, "profit_inr": 214000000, "order_count": 2047}]
        with patch("web_app._query", return_value=sample) as query:
            result = _fast_sales_result("approved-token", "Which country has the highest revenue?", "2024", "")

        self.assertEqual(query.call_count, 1)
        sql = query.call_args.args[1]
        self.assertIn("FROM fact_orders", sql)
        self.assertIn("EXTRACT(YEAR FROM order_date)::int = 2024", sql)
        self.assertEqual(result["title"], "Top countries by revenue")
        self.assertEqual(result["source"], "fact_orders")
        self.assertEqual(result["rows"][0]["country"], "USA")
        self.assertIn(("revenue_inr", "Revenue", "money"), result["columns"])

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
