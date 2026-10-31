import asyncio
import json
import unittest

from main import ALLOWED_RELATIONS, _agent_prompt, _apply_ranking_limit, _prepare_question, app, validate_sql


def call_asgi(path="/", method="GET", headers=None, body=b""):
    messages = []
    sent_request = False
    request_headers = [
        (key.lower().encode("latin-1"), value.encode("latin-1"))
        for key, value in (headers or {}).items()
    ]

    async def receive():
        nonlocal sent_request
        if sent_request:
            return {"type": "http.disconnect"}
        sent_request = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "https",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": b"",
        "headers": request_headers,
        "server": ("analytics.example.workers.dev", 443),
        "client": ("127.0.0.1", 12345),
    }
    asyncio.run(app(scope, receive, send))
    start = next(item for item in messages if item["type"] == "http.response.start")
    response_body = b"".join(
        item.get("body", b"")
        for item in messages
        if item["type"] == "http.response.body"
    )
    response_headers = {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in start.get("headers", [])
    }
    return start["status"], response_headers, response_body


class ASGIRouteTests(unittest.TestCase):
    def test_health_route_is_served(self):
        status, headers, body = call_asgi("/health")
        self.assertEqual(status, 200)
        self.assertEqual(headers["content-type"], "application/json")
        self.assertEqual(
            json.loads(body),
            {"status": "ok", "service": "threadiq-python-api", "engine": "python"},
        )

    def test_ask_route_rejects_non_post_method(self):
        status, headers, body = call_asgi("/ask", method="GET")
        self.assertEqual(status, 405)
        self.assertEqual(headers["allow"], "POST")
        self.assertIn(b"Method not allowed", body)

    def test_ask_requires_a_signed_in_session(self):
        status, _, body = call_asgi(
            "/ask",
            method="POST",
            headers={
                "origin": "https://analytics.example.workers.dev",
                "host": "analytics.example.workers.dev",
                "apikey": "test-key",
                "content-type": "application/json",
            },
            body=b'{"question":"Which country has highest revenue?"}',
        )
        self.assertEqual(status, 401)
        self.assertIn(b"signed-in workspace session", body)

    def test_health_route_includes_exact_same_origin_cors(self):
        status, headers, _ = call_asgi(
            "/health",
            headers={
                "origin": "https://analytics.example.workers.dev",
                "host": "analytics.example.workers.dev",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            headers["access-control-allow-origin"],
            "https://analytics.example.workers.dev",
        )


class QuestionPreparationTests(unittest.TestCase):
    def test_multi_question_prompt_keeps_each_question(self):
        prepared = _prepare_question("Which country has highest revenue? Show monthly growth?")
        self.assertIn("Address every distinct sub-question separately", prepared)
        self.assertIn("1. Which country has highest revenue?", prepared)
        self.assertIn("2. Show monthly growth?", prepared)

    def test_product_ranking_metric_is_explicit(self):
        prepared = _prepare_question("Rank product groups by profit and show revenue")
        self.assertIn("profit_inr", prepared)
        self.assertIn("aggregate all styles into product groups", prepared)

    def test_country_leader_prompt_requires_exactly_one(self):
        prepared = _prepare_question("Which country has the highest revenue?")
        self.assertIn("exactly one winning country", prepared)
        self.assertIn("LIMIT 1", prepared)

    def test_top_five_buyer_prompt_requires_five(self):
        prepared = _prepare_question("Top 5 buyers by profit")
        self.assertIn("exactly 5 buyer rows", prepared)
        self.assertIn("LIMIT 5", prepared)

    def test_multi_question_prompt_is_not_globally_capped(self):
        prepared = _prepare_question("Which country has highest revenue? Show monthly growth?")
        self.assertNotIn("STRICT RANKING OUTPUT", prepared)

    def test_sql_limit_is_enforced_and_existing_limit_replaced(self):
        sql = "SELECT country, SUM(revenue_inr) AS revenue FROM vw_sales_by_country GROUP BY country ORDER BY revenue DESC LIMIT 12"
        self.assertTrue(_apply_ranking_limit(sql, 1).endswith("LIMIT 1"))
        self.assertEqual(_apply_ranking_limit("SELECT * FROM vw_sales_by_buyer ORDER BY profit_inr DESC", 5),
                         "SELECT * FROM vw_sales_by_buyer ORDER BY profit_inr DESC LIMIT 5")


class SqlGuardTests(unittest.TestCase):
    def test_allows_read_only_select_from_approved_view(self):
        valid, refs, reason = validate_sql(
            "SELECT country, SUM(revenue_inr) AS revenue FROM vw_sales_by_country GROUP BY country ORDER BY revenue DESC"
        )
        self.assertTrue(valid, reason)
        self.assertEqual(refs, ["vw_sales_by_country"])

    def test_allows_cte_with_approved_relations(self):
        valid, refs, reason = validate_sql(
            "WITH totals AS (SELECT country, SUM(revenue_inr) AS revenue FROM vw_sales_by_country GROUP BY country) SELECT * FROM totals ORDER BY revenue DESC"
        )
        self.assertTrue(valid, reason)
        self.assertIn("vw_sales_by_country", refs)

    def test_rejects_insert_and_multiple_statements(self):
        for sql in (
            "INSERT INTO fact_orders VALUES (1)",
            "SELECT * FROM vw_sales_by_country; DROP TABLE fact_orders",
            "SELECT * FROM vw_sales_by_country -- comment",
        ):
            with self.subTest(sql=sql):
                valid, _, _ = validate_sql(sql)
                self.assertFalse(valid)

    def test_rejects_unapproved_relation(self):
        valid, _, reason = validate_sql("SELECT * FROM vw_private_users")
        self.assertFalse(valid)
        self.assertIn("approved", reason)

    def test_rejects_query_without_business_relation(self):
        valid, _, _ = validate_sql("SELECT 1 AS answer")
        self.assertFalse(valid)

    def test_relation_allowlist_is_explicit(self):
        self.assertEqual(len(ALLOWED_RELATIONS), 10)


class PromptTests(unittest.TestCase):
    def test_prompt_includes_filters_and_weighted_margin_rule(self):
        prompt = _agent_prompt("2024", "USA")
        self.assertIn("year=2024", prompt)
        self.assertIn("country=USA", prompt)
        self.assertIn("Weighted profit margin is SUM(profit_inr)", prompt)

    def test_prompt_defaults_to_all_periods_and_countries(self):
        prompt = _agent_prompt("", "")
        self.assertIn("year=all available periods", prompt)
        self.assertIn("country=all countries", prompt)


if __name__ == "__main__":
    unittest.main()
