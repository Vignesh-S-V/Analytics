"""Python port of the former Ask AI analytics intent utilities.

Kept independent from Flask/FastAPI so intent parsing and deterministic
aggregations can be regression-tested without network credentials.
"""
from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

ENGLISH_RANKING_WORDS = re.compile(
    r"\b(rank|ranking|ranked|top|highest|lowest|sort|list|most profitable|generated|generates|makes)\b"
)
PRODUCT_WORDS = re.compile(
    r"\b(product|products|product group|product groups|style|styles|fabric|category|categories)\b"
)


def normalize_query(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9\u0B80-\u0BFF ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def finite_number(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return 0.0
    return number if math.isfinite(number) else 0.0


def split_questions(value: Any) -> list[str]:
    source = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not source:
        return []
    parts = re.split(
        r"\n+|\?+\s*|(?<=[.!])\s+(?=(?:[A-Z]|Which\b|What\b|Why\b|How\b|Show\b|Compare\b|Calculate\b|Rank\b|Identify\b|Explain\b|தமிழில்\b))",
        source,
    )
    output = []
    for part in parts:
        part = re.sub(r"^\s*(?:\d+[.)]|[-*])\s*", "", part).strip()
        if len(part) > 5:
            output.append(re.sub(r"[.!?]+$", "", part).strip() + "?")
    return output


def is_multi_question_prompt(value: Any) -> bool:
    source = str(value or "").strip()
    if not source:
        return False
    return (
        source.count("?") > 1
        or sum(bool(part.strip()) and len(part.strip()) > 5 for part in re.split(r"[\n\r]+", source)) > 1
        or len(split_questions(source)) > 2
    )


def detect_product_ranking_intent(value: Any) -> dict[str, Any] | None:
    query = normalize_query(value)
    if not PRODUCT_WORDS.search(query) or not ENGLISH_RANKING_WORDS.search(query):
        return None
    if not re.search(r"\b(profit|revenue|sales|margin)\b", query):
        return None

    profit_pattern = re.compile(
        r"\b(?:by\s+(?:total\s+)?(?:recorded\s+)?(?:profit|net profit|np)|most profitable|highest (?:recorded )?profit|maximum profit|top profit|profit highest|generated the highest recorded profit|generated highest profit)\b"
    )
    revenue_pattern = re.compile(
        r"\b(?:by\s+(?:total\s+)?(?:revenue|sales)|highest (?:total )?(?:revenue|sales)|top (?:revenue|sales))\b"
    )
    profit_match = profit_pattern.search(query)
    revenue_match = revenue_pattern.search(query)
    rank_by_profit = bool(profit_match) and (
        not revenue_match or profit_match.start() <= revenue_match.start()
    )
    asks_group_total = bool(
        re.search(
            r"\b(product group|product groups|by group|group level|across (?:all )?styles|category|categories)\b",
            query,
        )
        or re.search(r"\bwhich product group\b", query)
    )
    return {"metric": "profit_inr" if rank_by_profit else "revenue_inr", "asks_group_total": asks_group_total}


def aggregate_product_groups(rows: Any, metric: str) -> list[dict[str, Any]]:
    if metric not in {"profit_inr", "revenue_inr"}:
        raise TypeError("metric must be profit_inr or revenue_inr")
    groups: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        category = str(row.get("product_category") or "").strip() or "Unknown"
        group = groups.setdefault(
            category,
            {"product_category": category, "revenue_inr": 0.0, "profit_inr": 0.0, "styles": set()},
        )
        group["revenue_inr"] += finite_number(row.get("revenue_inr"))
        group["profit_inr"] += finite_number(row.get("profit_inr"))
        style = str(row.get("style_id") or "").strip()
        if style and style != "Unknown":
            group["styles"].add(style)
    result = []
    for group in groups.values():
        revenue = group["revenue_inr"]
        result.append({
            "product_category": group["product_category"],
            "revenue_inr": revenue,
            "profit_inr": group["profit_inr"],
            "profit_margin_pct": group["profit_inr"] / revenue * 100 if revenue else 0,
            "style_count": len(group["styles"]),
        })
    return sorted(result, key=lambda row: row[metric], reverse=True)


def is_country_comparison_question(value: Any, requested_country_count: int) -> bool:
    query = normalize_query(value)
    comparison = bool(
        re.search(r"\b(compare|comparison|versus|vs|difference|between|and)\b", query)
        or re.search(r"ஒப்பிட|ஒப்பீடு|வித்தியாசம்|மற்றும்", query)
    )
    metric = bool(
        re.search(r"\b(revenue|sales|profit|margin|orders)\b", query)
        or re.search(r"வருவாய்|விற்பனை|லாபம்|ஆர்டர்|ஆர்டர்கள்|மார்ஜின்", query)
    )
    return requested_country_count >= 2 and comparison and metric


def rank_buyer_rows(rows: Any, metric: str = "revenue_inr", limit: float = math.inf) -> list[dict[str, Any]]:
    if metric not in {"revenue_inr", "profit_inr"}:
        raise TypeError("metric must be revenue_inr or profit_inr")
    normalized = []
    for row in rows if isinstance(rows, list) else []:
        revenue, profit = finite_number(row.get("revenue_inr")), finite_number(row.get("profit_inr"))
        normalized.append({
            "buyer_id": str(row.get("buyer_id") or ""),
            "buyer_name": str(row.get("buyer_name") or "Unknown").strip() or "Unknown",
            "country": str(row.get("country") or "Unknown").strip() or "Unknown",
            "revenue_inr": revenue,
            "profit_inr": profit,
            "order_count": finite_number(row.get("order_count", row.get("orders"))),
            "profit_margin_pct": profit / revenue * 100 if revenue else 0,
        })
    normalized.sort(key=lambda row: (-row[metric], row["buyer_name"]))
    safe_limit = max(0, int(limit)) if math.isfinite(limit) else len(normalized)
    return [{"rank": index + 1, **row} for index, row in enumerate(normalized[:safe_limit])]
