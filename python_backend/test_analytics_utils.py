import unittest

from analytics_utils import (
    aggregate_product_groups,
    detect_product_ranking_intent,
    is_country_comparison_question,
    is_multi_question_prompt,
    normalize_query,
    rank_buyer_rows,
    split_questions,
)


class QueryNormalizationTests(unittest.TestCase):
    def test_normalizes_english_and_tamil(self):
        self.assertEqual(normalize_query("  SALES Growth!  "), "sales growth")
        self.assertIn("வருவாய்", normalize_query("வருவாய் வளர்ச்சி"))

    def test_splits_multi_question_prompt(self):
        questions = split_questions("Which country has highest revenue? Show monthly growth?")
        self.assertEqual(len(questions), 2)
        self.assertTrue(is_multi_question_prompt("Which country has highest revenue? Show monthly growth?"))

    def test_does_not_split_a_single_question(self):
        self.assertFalse(is_multi_question_prompt("Which country has highest revenue?"))


class RankingIntentTests(unittest.TestCase):
    def test_profit_metric_wins_when_explicitly_asked_first(self):
        result = detect_product_ranking_intent("Rank products by profit and show revenue too")
        self.assertEqual(result["metric"], "profit_inr")

    def test_revenue_metric_is_detected(self):
        result = detect_product_ranking_intent("Top product groups by revenue")
        self.assertEqual(result, {"metric": "revenue_inr", "asks_group_total": True})

    def test_unsupported_prompt_falls_through(self):
        self.assertIsNone(detect_product_ranking_intent("Explain the production process"))

    def test_country_comparison_needs_two_countries_and_metric(self):
        self.assertTrue(is_country_comparison_question("Compare revenue and profit", 2))
        self.assertFalse(is_country_comparison_question("Compare revenue", 1))


class DeterministicAggregationTests(unittest.TestCase):
    def test_product_group_aggregation_and_weighted_margin(self):
        rows = [
            {"product_category": "Shirt", "style_id": "S1", "revenue_inr": 100, "profit_inr": 10},
            {"product_category": "Shirt", "style_id": "S2", "revenue_inr": 300, "profit_inr": 60},
            {"product_category": "Dhoti", "style_id": "D1", "revenue_inr": 200, "profit_inr": 20},
        ]
        result = aggregate_product_groups(rows, "profit_inr")
        self.assertEqual(result[0]["product_category"], "Shirt")
        self.assertEqual(result[0]["style_count"], 2)
        self.assertAlmostEqual(result[0]["profit_margin_pct"], 17.5)

    def test_buyer_ranking_uses_requested_metric_not_revenue(self):
        rows = [
            {"buyer_name": "A", "revenue_inr": 1000, "profit_inr": 20},
            {"buyer_name": "B", "revenue_inr": 500, "profit_inr": 100},
        ]
        ranked = rank_buyer_rows(rows, "profit_inr", 1)
        self.assertEqual(ranked[0]["buyer_name"], "B")
        self.assertEqual(ranked[0]["rank"], 1)

    def test_invalid_product_metric_is_rejected(self):
        with self.assertRaises(TypeError):
            aggregate_product_groups([], "order_count")


if __name__ == "__main__":
    unittest.main()
