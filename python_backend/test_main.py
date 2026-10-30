import unittest

from main import ALLOWED_RELATIONS, _agent_prompt, _prepare_question, validate_sql


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
