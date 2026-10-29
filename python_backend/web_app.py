"""Python-only server-rendered ThreadIQ web application.

All browser pages are HTML/CSS rendered by Flask. No React, JSX, TypeScript or
browser JavaScript is required. Authenticated access tokens are kept server-side.
"""
from __future__ import annotations

import asyncio
import html
import os
import re
import secrets
from typing import Any

import httpx
import requests
from cachetools import TTLCache
from flask import Flask, abort, redirect, render_template_string, request, session, url_for

from main import (
    GEMINI_API_KEY,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    UPSTREAM_TIMEOUT_SECONDS,
    _execute_sql,
    _run_gemini,
)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=32 * 1024,
    PERMANENT_SESSION_LIFETIME=3600,
)
if not app.secret_key:
    raise RuntimeError("FLASK_SECRET_KEY must be configured as a server-side secret.")

HTTP_TIMEOUT = min(max(UPSTREAM_TIMEOUT_SECONDS, 5), 45)
SESSIONS: TTLCache[str, dict[str, Any]] = TTLCache(maxsize=500, ttl=3600)

STYLE = """
:root{color-scheme:light;--ink:#152238;--muted:#63728a;--line:#e2e8f0;--accent:#176b57;--bg:#f4f7fa;--soft:#edf5f2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}.shell{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:100vh}
aside{background:#fff;border-right:1px solid var(--line);padding:22px 14px;display:flex;flex-direction:column;gap:8px}.brand{font-size:20px;font-weight:850;letter-spacing:-.6px;padding:4px 10px 18px}.brand small{display:block;font-size:10px;letter-spacing:1.5px;color:var(--muted);font-weight:700}
.nav-label{font-size:10px;color:var(--muted);letter-spacing:1.5px;font-weight:800;padding:12px 10px 4px}.nav a{display:block;padding:10px 12px;border-radius:9px;color:#35435a;font-weight:650}.nav a.active{background:var(--soft);color:#135541}.side-note{margin-top:auto;background:#f5f8fb;border:1px solid var(--line);border-radius:12px;padding:12px;color:var(--muted);font-size:12px}
main{min-width:0}.topbar{height:66px;background:#fff;border-bottom:1px solid var(--line);padding:0 26px;display:flex;justify-content:space-between;align-items:center;gap:12px}.crumb{color:var(--muted)}.topbar form{margin:0}
.content{max-width:1400px;margin:auto;padding:25px 26px 42px}.heading{display:flex;justify-content:space-between;align-items:end;gap:18px;flex-wrap:wrap}.eyebrow{font-size:10px;letter-spacing:1.6px;font-weight:800;color:var(--accent)}h1{font-size:28px;line-height:1.2;margin:7px 0}h2{font-size:17px;margin:0 0 7px}h3{font-size:14px;margin:0 0 6px}.muted{color:var(--muted)}.small{font-size:12px}
.panel,.kpi{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:0 3px 14px #13223805}.panel{margin-top:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:13px;margin-top:17px}.kpi span{display:block;color:var(--muted);font-size:12px}.kpi strong{display:block;font-size:24px;letter-spacing:-.5px;margin-top:7px;overflow-wrap:anywhere}.kpi small{display:block;color:var(--muted);margin-top:5px}
.filters{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.filters>div{min-width:145px;flex:1}label{display:block;font-size:12px;font-weight:700;margin:8px 0 5px}input,select,textarea{width:100%;padding:10px 11px;border:1px solid #ccd6e2;border-radius:8px;background:white;color:var(--ink);font:inherit}textarea{resize:vertical}
button,.button{border:0;border-radius:8px;background:var(--accent);color:white;font-weight:750;padding:10px 14px;cursor:pointer;display:inline-block;font:inherit;text-decoration:none}.secondary{background:#eaf2ef;color:#174f43}.plain{background:#edf1f6;color:#27364d}
table{border-collapse:collapse;width:100%;margin-top:9px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 9px;font-size:12px;vertical-align:top}th{color:var(--muted);background:#f8fafc;font-weight:750;white-space:nowrap}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.table-wrap{overflow-x:auto}.bar-row{display:grid;grid-template-columns:minmax(100px,180px) minmax(50px,1fr) 100px;gap:10px;align-items:center;margin:10px 0}.bar-track{height:9px;background:#e9eef3;border-radius:8px;overflow:hidden}.bar-fill{height:100%;background:#2e8b70;border-radius:8px}
.notice{padding:12px 14px;background:#eef6f3;border:1px solid #d5e9e1;border-radius:9px;margin-top:14px}.error{padding:12px 14px;background:#fff1f1;border:1px solid #ffd7d7;color:#9e2525;border-radius:9px;margin-top:12px}.answer{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:16px;margin-top:12px}.login{max-width:460px;margin:7vh auto}
@media(max-width:820px){.shell{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line);padding:12px}.brand{padding-bottom:6px}.nav{display:flex;overflow:auto;gap:5px}.nav a{white-space:nowrap}.nav-label,.side-note{display:none}.content{padding:18px 14px}.topbar{padding:0 14px;height:55px}.kpi strong{font-size:21px}}
"""

NAV = [
    ("Overview", "/"),
    ("Ask AI", "/page/ask-ai"),
    ("Product Economics", "/page/product-economics"),
    ("Sales & Buyers", "/page/sales-buyers"),
    ("Production", "/page/production"),
    ("Marketing ROI", "/page/marketing-roi"),
    ("Procurement", "/page/procurement"),
    ("Investment Lab", "/page/investment-lab"),
]
PAGE_INFO = {
    "product-economics": ("Product Economics", "PRODUCT-LEVEL UNIT ECONOMICS", "Compare recorded revenue, cost, profit and margin by product category, fabric and style."),
    "sales-buyers": ("Sales & Buyers", "BUYER & ORDER PROFITABILITY", "Rank buyer relationships by revenue and profit; compare order fill rate, margin and late penalties."),
    "production": ("Production", "FACTORY PERFORMANCE & QUALITY", "Compare line efficiency, rejection, overtime, rework cost and delivery-related risk where recorded."),
    "marketing-roi": ("Marketing ROI", "INQUIRY-TO-ORDER FUNNEL", "Compare channel spend, inquiries, samples, won orders, attributed value and ROAS."),
    "procurement": ("Procurement", "SUPPLIER & MATERIAL RISK", "Review supplier reliability, linked-order outcomes and recorded market indicators."),
    "investment-lab": ("Investment Lab", "HISTORICAL RETURNS & WHAT-IF", "Historical operating results are sourced from the workspace. Scenario outputs are assumptions, not forecasts."),
    "ask-ai": ("Ask AI", "ASK YOUR BUSINESS DATA", "Ask a natural-language question. The AI must query approved read-only workspace data."),
}
LOGIN_HTML = """<section class="panel login"><div class="eyebrow">PRIVATE BUSINESS WORKSPACE</div><h1>Sign in to ThreadIQ</h1><p class="muted">Only email-confirmed accounts approved by the workspace owner can view business information. Registration is disabled.</p>{% if error %}<div class="error">{{ error }}</div>{% endif %}<form method="post"><input type="hidden" name="csrf_token" value="{{ csrf_token }}"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128"><p><button type="submit">Sign in securely</button></p></form><p class="muted small">Need access? Contact the workspace owner to have your account manually approved.</p></section>"""
LAYOUT = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>{{ title }} · ThreadIQ</title><style>{{ css }}</style></head><body>{% if signed_in %}<div class="shell"><aside><div class="brand">ThreadIQ<small>GARMENT INTELLIGENCE</small></div><div class="nav-label">ANALYTICS WORKSPACE</div><nav class="nav">{% for label,href in nav %}<a href="{{ href }}" class="{% if href==active_href %}active{% endif %}">{{ label }}</a>{% endfor %}</nav><div class="side-note"><b>Data integrity first</b><br>Use recorded metrics as evidence. Do not infer missing fields or unsupported causes.</div></aside><main><header class="topbar"><div class="crumb">Workspace / <b>{{ title }}</b></div><form method="post" action="{{ url_for('logout') }}"><input type="hidden" name="csrf_token" value="{{ csrf_token }}"><button class="secondary" type="submit">Sign out</button></form></header><div class="content">{{ body|safe }}</div></main></div>{% else %}<main class="content">{{ body|safe }}</main>{% endif %}</body></html>"""


def _csrf_token() -> str:
    token = session.get("csrf_token")
    if not isinstance(token, str):
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return token


def _check_csrf() -> None:
    supplied = request.form.get("csrf_token", "")
    expected = session.get("csrf_token", "")
    if not supplied or not expected or not secrets.compare_digest(supplied, expected):
        abort(400, description="The form expired or could not be verified. Reload and retry.")


def _supabase_request(method: str, path: str, token: str, *, body=None, params=None):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("Supabase is not configured.")
    response = requests.request(
        method, f"{SUPABASE_URL}{path}", timeout=HTTP_TIMEOUT,
        headers={"apikey": SUPABASE_ANON_KEY, "authorization": f"Bearer {token}", "content-type": "application/json"},
        json=body, params=params,
    )
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    return response.status_code, payload


def _current_user():
    sid = session.get("sid")
    if not isinstance(sid, str):
        return None
    user = SESSIONS.get(sid)
    if not user:
        session.clear()
        return None
    try:
        status, profile = _supabase_request("GET", "/auth/v1/user", user["token"])
        if status >= 400 or not isinstance(profile, dict) or profile.get("id") != user["user_id"] or not profile.get("email_confirmed_at"):
            SESSIONS.pop(sid, None)
            session.clear()
            return None
        status, membership = _supabase_request(
            "GET", "/rest/v1/threadiq_workspace_members", user["token"],
            params={"select": "is_active", "user_id": f"eq.{user['user_id']}", "limit": "1"},
        )
        if status >= 400 or not isinstance(membership, list) or not membership or membership[0].get("is_active") is not True:
            SESSIONS.pop(sid, None)
            session.clear()
            return None
    except (requests.RequestException, RuntimeError, ValueError):
        return None
    return user


def _render(title: str, body: str, *, signed_in=False, active_href="/", **context):
    context.setdefault("csrf_token", _csrf_token())
    inner = render_template_string(body, **context)
    return render_template_string(
        LAYOUT, title=title, body=inner, css=STYLE, signed_in=signed_in,
        nav=NAV, active_href=active_href,
    )


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _money(value: Any) -> str:
    n = _num(value)
    if abs(n) >= 10_000_000:
        return f"₹{n / 10_000_000:,.2f} Cr"
    if abs(n) >= 100_000:
        return f"₹{n / 100_000:,.2f} Lakh"
    if abs(n) >= 1_000:
        return f"₹{n:,.0f}"
    return f"₹{n:,.2f}" if n % 1 else f"₹{n:,.0f}"


def _integer(value: Any) -> str:
    return f"{int(_num(value)):,}"


def _pct(numerator: Any, denominator: Any) -> str:
    d = _num(denominator)
    return f"{_num(numerator) / d * 100:.2f}%" if d else "N/A"


def _filters_sql(year: str, country: str, *, has_month=True, has_country=True) -> str:
    clause = ""
    if year and year.isdigit() and len(year) == 4 and year.startswith("20"):
        clause += f" AND EXTRACT(YEAR FROM {('month' if has_month else 'order_date')})::int = {int(year)}"
    if country and has_country:
        clause += " AND country = '" + country.replace("'", "''") + "'"
    return clause


def _query(token: str, sql: str) -> list[dict[str, Any]]:
    status, payload = _supabase_request("POST", "/rest/v1/rpc/threadiq_run_readonly_query", token, body={"p_sql": sql})
    if status >= 400 or not isinstance(payload, list):
        raise RuntimeError("Workspace query failed. Verify the approved read-only SQL RPC and view permissions.")
    return payload


def _table(rows: list[dict[str, Any]], columns: list[tuple[str, str, str | None]], empty="No records match these filters.") -> str:
    if not rows:
        return '<p class="muted">' + html.escape(empty) + '</p>'
    head = "".join("<th>" + html.escape(label) + "</th>" for _, label, _ in columns)
    body = []
    for row in rows:
        cells = []
        for key, _, kind in columns:
            value = row.get(key)
            if kind == "money":
                shown = _money(value)
            elif kind == "int":
                shown = _integer(value)
            elif kind == "pct":
                shown = f"{_num(value):.2f}%" if value is not None else "N/A"
            elif kind == "ratio":
                shown = f"{_num(value):.2f}x" if value is not None else "N/A"
            elif kind == "float":
                shown = f"{_num(value):.2f}" if value is not None else "N/A"
            else:
                shown = str(value if value is not None else "—")
            cells.append('<td class="' + ("num" if kind in {"money", "int", "pct"} else "") + '">' + html.escape(shown) + "</td>")
        body.append("<tr>" + "".join(cells) + "</tr>")
    return '<div class="table-wrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + "".join(body) + "</tbody></table></div>"


def _kpis(items: list[tuple[str, str, str]]) -> str:
    return '<div class="grid">' + "".join(
        '<div class="kpi"><span>' + html.escape(label) + '</span><strong>' + html.escape(value) + '</strong><small>' + html.escape(note) + '</small></div>'
        for label, value, note in items
    ) + "</div>"


def _bar_list(rows: list[dict[str, Any]], label_key: str, value_key: str, *, money=False) -> str:
    if not rows:
        return '<p class="muted">No chart data available for this selection.</p>'
    max_value = max(abs(_num(r.get(value_key))) for r in rows) or 1
    chunks = []
    for row in rows:
        label = html.escape(str(row.get(label_key) or "Unclassified"))
        val = _num(row.get(value_key))
        width = max(0, min(100, abs(val) / max_value * 100))
        value = _money(val) if money else _integer(val)
        chunks.append(f'<div class="bar-row"><span>{label}</span><div class="bar-track"><div class="bar-fill" style="width:{width:.2f}%"></div></div><b>{html.escape(value)}</b></div>')
    return "".join(chunks)


def _filter_context(token: str, year: str, country: str):
    years_rows = _query(token, "SELECT DISTINCT EXTRACT(YEAR FROM month)::int AS year FROM vw_sales_monthly_by_country WHERE month IS NOT NULL ORDER BY year DESC LIMIT 20")
    country_rows = _query(token, "SELECT DISTINCT country FROM vw_sales_by_country WHERE country IS NOT NULL ORDER BY country LIMIT 200")
    years = [str(r["year"]) for r in years_rows if r.get("year") is not None]
    countries = [str(r["country"]) for r in country_rows if r.get("country")]
    year = year if year in years else ""
    country = country if country in countries else ""
    return years, countries, year, country


def _page_heading(title: str, kicker: str, description: str, year: str, country: str) -> str:
    years, countries = [], []
    # Filter options are injected by the page route to avoid a second query here.
    return (
        '<div class="heading"><div><div class="eyebrow">' + html.escape(kicker) + '</div><h1>' + html.escape(title) +
        '</h1><p class="muted">' + html.escape(description) + '</p></div></div>'
    )


def _filters_form(year: str, country: str, years: list[str], countries: list[str], *, include_country=True) -> str:
    ys = '<option value="">All available periods</option>' + "".join(
        '<option value="' + html.escape(y) + '"' + (" selected" if y == year else "") + '>Year ' + html.escape(y) + "</option>" for y in years
    )
    cs = '<option value="">All countries</option>' + "".join(
        '<option value="' + html.escape(c, quote=True) + '"' + (" selected" if c == country else "") + '>' + html.escape(c) + "</option>" for c in countries
    )
    country_control = '<div><label for="country">Country</label><select id="country" name="country">' + cs + "</select></div>" if include_country else ""
    return (
        '<form class="panel filters" method="get"><div><label for="year">Year</label><select id="year" name="year">' + ys +
        "</select></div>" + country_control + '<div><button type="submit">Apply filters</button></div></form>'
    )


def _ask_form(year: str, country: str, question: str = "") -> str:
    return (
        '<section class="panel"><h2>Ask AI</h2><p class="muted">Examples: Which country has the highest revenue? Which buyer gives the highest profit? Show monthly growth. Why did profit decrease?</p>'
        '<form method="post" action="' + url_for("ask") + '"><input type="hidden" name="csrf_token" value="' + html.escape(_csrf_token(), quote=True) +
        '"><input type="hidden" name="year" value="' + html.escape(year, quote=True) + '"><input type="hidden" name="country" value="' + html.escape(country, quote=True) +
        '"><label for="question">Your question</label><textarea id="question" name="question" rows="3" maxlength="12000" required>' + html.escape(question) +
        '</textarea><p><button type="submit">Analyze with AI</button></p></form></section>'
    )


def _login(token: str, error: str | None = None):
    return _render("Sign in", LOGIN_HTML, error=error, signed_in=False)


def _dashboard(token: str, year: str, country: str, page_key: str, answer: str | None = None, error: str | None = None):
    years, countries, year, country = _filter_context(token, year, country)
    filter_form = _filters_form(year, country, years, countries)
    month_where = " WHERE month IS NOT NULL" + _filters_sql(year, country)
    totals_rows = _query(token, "SELECT SUM(revenue_inr) AS revenue_inr, SUM(total_cost_inr) AS total_cost_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count, SUM(delayed_order_count) AS delayed_order_count FROM vw_sales_monthly_by_country" + month_where)
    totals = totals_rows[0] if totals_rows else {}
    monthly = _query(token, "SELECT month, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count FROM vw_sales_monthly_by_country" + month_where + " GROUP BY month ORDER BY month DESC LIMIT 24")
    country_rows = _query(token, "SELECT country, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr FROM vw_sales_monthly_by_country WHERE month IS NOT NULL" + _filters_sql(year, country) + " AND country IS NOT NULL GROUP BY country ORDER BY revenue_inr DESC LIMIT 10")
    kpis = _kpis([
        ("Total revenue", _money(totals.get("revenue_inr")), "SUM(revenue_inr)"),
        ("Recorded profit", _money(totals.get("profit_inr")), "SUM(profit_inr)"),
        ("Weighted profit margin", _pct(totals.get("profit_inr"), totals.get("revenue_inr")), "Profit ÷ revenue"),
        ("Distinct order count", _integer(totals.get("order_count")), "Source monthly-country summary"),
        ("Delayed orders", _integer(totals.get("delayed_order_count")), "Recorded delayed-order count"),
    ])
    month_table = _table(monthly, [("month", "Month", None), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("order_count", "Orders", "int")])
    country_chart = _bar_list(country_rows, "country", "revenue_inr", money=True)
    content = _page_heading("Business overview", "GARMENT BUSINESS INTELLIGENCE", "Understand profitability, delivery risk and actions across the export business.", year, country)
    content += filter_form + (('<div class="error">' + html.escape(error) + "</div>") if error else "") + kpis
    content += '<section class="panel"><h2>Monthly revenue and profit</h2><p class="muted">Latest 24 recorded months; values are aggregated from approved workspace views.</p>' + month_table + '</section>'
    content += '<section class="panel"><h2>Revenue by country</h2>' + country_chart + '</section>'
    content += _ask_form(year, country)
    if answer:
        content += '<section class="panel"><h2>AI answer</h2><div class="answer">' + html.escape(answer) + '</div></section>'
    return _render("Overview", content, signed_in=True, active_href="/")


@app.get("/health")
def health():
    return {"status": "ok", "service": "threadiq-python-web", "engine": "python"}


@app.route("/", methods=["GET", "POST"])
def index():
    user = _current_user()
    if not user:
        if request.method == "POST":
            _check_csrf()
            email = request.form.get("email", "").strip()[:254]
            password = request.form.get("password", "")
            if not email or not password or len(password) < 8 or len(password) > 128:
                return _login("", "Enter a valid email and password.")
            if not SUPABASE_URL or not SUPABASE_ANON_KEY:
                return _login("", "Authentication is not configured on the server.")
            try:
                response = requests.post(
                    f"{SUPABASE_URL}/auth/v1/token", params={"grant_type": "password"},
                    headers={"apikey": SUPABASE_ANON_KEY, "content-type": "application/json"},
                    json={"email": email, "password": password}, timeout=HTTP_TIMEOUT,
                )
                auth = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                profile = auth.get("user") or {}
                token = auth.get("access_token")
                if response.status_code >= 400 or not token or not profile.get("id"):
                    return _login("", "Sign-in failed. Check your credentials and email confirmation.")
                if not profile.get("email_confirmed_at"):
                    return _login("", "Confirm your email before signing in.")
                status, membership = _supabase_request(
                    "GET", "/rest/v1/threadiq_workspace_members", token,
                    params={"select": "is_active", "user_id": f"eq.{profile['id']}", "limit": "1"},
                )
                if status >= 400 or not isinstance(membership, list) or not membership or membership[0].get("is_active") is not True:
                    return _login("", "This account is not approved for the workspace.")
                sid = secrets.token_urlsafe(32)
                SESSIONS[sid] = {"token": token, "user_id": profile["id"], "email": profile.get("email", "")}
                session.clear()
                session["sid"] = sid
                session["csrf_token"] = secrets.token_urlsafe(32)
                session.permanent = True
                return redirect(url_for("index"))
            except (requests.RequestException, ValueError):
                return _login("", "Authentication service is temporarily unavailable.")
        return _login("")
    try:
        return _dashboard(user["token"], request.args.get("year", "").strip(), request.args.get("country", "").strip()[:100], "overview")
    except (requests.RequestException, RuntimeError, ValueError):
        return _render("Overview", '<h1>Business overview</h1><div class="error">Workspace analytics could not be loaded. Verify the approved SQL RPC, schema and network connection.</div>', signed_in=True, active_href="/")


@app.get("/page/<page_key>")
def module_page(page_key: str):
    user = _current_user()
    if not user:
        return redirect(url_for("index"))
    if page_key not in PAGE_INFO:
        abort(404)
    title, kicker, description = PAGE_INFO[page_key]
    token = user["token"]
    year, country = request.args.get("year", "").strip(), request.args.get("country", "").strip()[:100]
    try:
        years, countries, year, country = _filter_context(token, year, country)
        content = _page_heading(title, kicker, description, year, country)
        include_country = page_key not in {"procurement"}
        content += (_filters_form(year, country, years, countries, include_country=include_country) if page_key != "production" else '<div class="notice">Production line summary is aggregated without month/country columns; selected date and country filters cannot be applied to this source view.</div>')
        if page_key == "ask-ai":
            content += _ask_form(year, country)
            content += '<section class="panel"><h2>Ask AI workflow</h2><p>Answers use read-only queries against the approved workspace views. The assistant must state missing data rather than inventing it.</p><ul><li>Revenue and profit rankings</li><li>Monthly and year-over-year comparisons</li><li>Buyer, product, supplier, production and marketing performance</li><li>Evidence-based analysis of changes and limitations</li></ul></section>'
        elif page_key == "product-economics":
            rows = _query(token, "SELECT product_category, fabric, style_id, COUNT(DISTINCT order_id) AS order_count, SUM(order_qty) AS order_qty, SUM(shipped_qty) AS shipped_qty, SUM(revenue_inr) AS revenue_inr, SUM(total_cost_inr) AS total_cost_inr, SUM(profit_inr) AS profit_inr, SUM((COALESCE(fabric_cost_per_pc_inr,0)+COALESCE(trims_cost_per_pc_inr,0)+COALESCE(cmt_cost_per_pc_inr,0))*COALESCE(NULLIF(shipped_qty,0),order_qty,0)) AS direct_cost_inr, CASE WHEN SUM(revenue_inr)=0 THEN NULL ELSE SUM(profit_inr)/SUM(revenue_inr)*100 END AS profit_margin_pct FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(year, country, has_month=False, has_country=True) + " GROUP BY product_category, fabric, style_id ORDER BY revenue_inr DESC LIMIT 250")
            total_rev = sum(_num(r.get("revenue_inr")) for r in rows)
            total_profit = sum(_num(r.get("profit_inr")) for r in rows)
            content += _kpis([("Product revenue", _money(total_rev), "Displayed product groups"), ("Recorded profit", _money(total_profit), "Displayed product groups"), ("Weighted margin", _pct(total_profit, total_rev), "Profit ÷ revenue"), ("Product combinations", _integer(len(rows)), "Category / fabric / style")])
            content += '<section class="panel"><h2>Product cost, price and return analysis</h2><p class="muted">Direct cost uses recorded per-piece fabric + trims + CMT cost multiplied by shipped quantity (or order quantity when shipped quantity is zero). Recorded profit is shown separately.</p>' + _table(rows, [("product_category","Product category",None),("fabric","Fabric",None),("style_id","Style",None),("order_count","Orders","int"),("order_qty","Order qty","int"),("shipped_qty","Shipped qty","int"),("revenue_inr","Revenue","money"),("total_cost_inr","Recorded cost","money"),("direct_cost_inr","Direct cost","money"),("profit_inr","Recorded profit","money"),("profit_margin_pct","Margin","pct")]) + '</section>'
        elif page_key == "sales-buyers":
            rows = _query(token, "SELECT buyer_name, country, buyer_tier, COUNT(DISTINCT order_id) AS order_count, SUM(order_qty) AS order_qty, SUM(shipped_qty) AS shipped_qty, SUM(revenue_inr) AS revenue_inr, SUM(total_cost_inr) AS total_cost_inr, SUM(profit_inr) AS profit_inr, CASE WHEN SUM(revenue_inr)=0 THEN NULL ELSE SUM(profit_inr)/SUM(revenue_inr)*100 END AS profit_margin_pct, SUM(late_penalty_inr) AS late_penalty_inr FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(year, country, has_month=False, has_country=True) + " GROUP BY buyer_name, country, buyer_tier ORDER BY revenue_inr DESC LIMIT 250")
            total_rev = sum(_num(r.get("revenue_inr")) for r in rows)
            total_profit = sum(_num(r.get("profit_inr")) for r in rows)
            content += _kpis([("Buyer revenue", _money(total_rev), "Displayed buyers"), ("Buyer profit", _money(total_profit), "Recorded profit"), ("Weighted margin", _pct(total_profit, total_rev), "Profit ÷ revenue"), ("Buyer records", _integer(len(rows)), "Current filters")])
            content += '<section class="panel"><h2>Sales and buyer profitability</h2>' + _table(rows, [("buyer_name","Buyer",None),("country","Country",None),("buyer_tier","Tier",None),("order_count","Orders","int"),("order_qty","Order qty","int"),("shipped_qty","Shipped qty","int"),("revenue_inr","Revenue","money"),("profit_inr","Profit","money"),("profit_margin_pct","Margin","pct"),("late_penalty_inr","Late penalty","money")]) + '</section>'
        elif page_key == "production":
            rows = _query(token, "SELECT line_id, unit, specialisation, SUM(order_count) AS order_count, SUM(order_qty) AS order_qty, SUM(shipped_qty) AS shipped_qty, SUM(rejection_qty) AS rejection_qty, AVG(rejection_rate_pct) AS rejection_rate_pct, AVG(avg_actual_efficiency_pct) AS avg_actual_efficiency_pct, AVG(avg_target_efficiency_pct) AS avg_target_efficiency_pct, AVG(avg_efficiency_gap_pp) AS avg_efficiency_gap_pp, SUM(overtime_hours) AS overtime_hours, SUM(rework_cost_inr) AS rework_cost_inr, SUM(late_penalty_inr) AS late_penalty_inr, SUM(linked_order_profit_inr) AS linked_order_profit_inr FROM vw_production_by_line WHERE 1=1" + _filters_sql(year, country, has_month=False, has_country=False) + " GROUP BY line_id, unit, specialisation ORDER BY order_qty DESC LIMIT 200")
            total_qty = sum(_num(r.get("order_qty")) for r in rows)
            total_rejected = sum(_num(r.get("rejection_qty")) for r in rows)
            total_rework = sum(_num(r.get("rework_cost_inr")) for r in rows)
            content += _kpis([("Order quantity", _integer(total_qty), "Line aggregate"), ("Rejected quantity", _integer(total_rejected), "Recorded rejects"), ("Rejection rate", _pct(total_rejected, total_qty), "Reject qty ÷ order qty proxy"), ("Rework cost", _money(total_rework), "Recorded rework cost")])
            content += '<section class="panel"><h2>Production line performance</h2><p class="muted">Rejection rate uses order quantity as a denominator proxy where produced quantity is not available.</p>' + _table(rows, [("line_id","Line",None),("unit","Unit",None),("specialisation","Specialisation",None),("order_count","Orders","int"),("order_qty","Order qty","int"),("shipped_qty","Shipped qty","int"),("rejection_qty","Rejected qty","int"),("rejection_rate_pct","Reject %","pct"),("avg_actual_efficiency_pct","Actual efficiency","pct"),("avg_target_efficiency_pct","Target efficiency","pct"),("avg_efficiency_gap_pp","Efficiency gap (pp)","float"),("overtime_hours","Overtime hours","int"),("rework_cost_inr","Rework cost","money"),("late_penalty_inr","Late penalty","money")]) + '</section>'
        elif page_key == "marketing-roi":
            rows = _query(token, "SELECT month, country, channel, SUM(marketing_spend_inr) AS marketing_spend_inr, SUM(inquiries) AS inquiries, SUM(samples_sent) AS samples_sent, SUM(orders_won) AS orders_won, SUM(attributed_order_value_inr) AS attributed_order_value_inr, CASE WHEN SUM(marketing_spend_inr)=0 THEN NULL ELSE SUM(attributed_order_value_inr)/SUM(marketing_spend_inr) END AS roas_ratio FROM vw_marketing_channel_performance WHERE month IS NOT NULL" + _filters_sql(year, country) + " GROUP BY month, country, channel ORDER BY month DESC, marketing_spend_inr DESC LIMIT 250")
            spend = sum(_num(r.get("marketing_spend_inr")) for r in rows)
            value = sum(_num(r.get("attributed_order_value_inr")) for r in rows)
            inquiries = sum(_num(r.get("inquiries")) for r in rows)
            samples = sum(_num(r.get("samples_sent")) for r in rows)
            won = sum(_num(r.get("orders_won")) for r in rows)
            content += _kpis([("Marketing spend", _money(spend), "Recorded channel spend"), ("Attributed order value", _money(value), "Not the same as profit"), ("Inquiry → sample", _pct(samples, inquiries), "Samples ÷ inquiries"), ("Sample → won order", _pct(won, samples), "Won orders ÷ samples"), ("ROAS", f"{value/spend:.2f}x" if spend else "N/A", "Attributed value ÷ spend")])
            content += '<section class="panel"><h2>Channel and monthly funnel</h2><p class="muted">ROAS is attributed revenue per spend unit, not profit ROI. Aggregated funnel stages may not be same-cohort conversions.</p>' + _table(rows, [("month","Month",None),("country","Country",None),("channel","Channel",None),("marketing_spend_inr","Spend","money"),("inquiries","Inquiries","int"),("samples_sent","Samples","int"),("orders_won","Orders won","int"),("attributed_order_value_inr","Attributed value","money"),("roas_ratio","ROAS","ratio")]) + '</section>'
        elif page_key == "procurement":
            suppliers = _query(token, "SELECT supplier_id, supplier_name, supply_type, AVG(avg_delay_days) AS avg_delay_days, AVG(quality_rating) AS quality_rating, AVG(credit_days) AS credit_days, SUM(linked_order_count) AS linked_order_count, SUM(linked_order_revenue_inr) AS linked_order_revenue_inr, SUM(linked_order_profit_inr) AS linked_order_profit_inr, SUM(linked_order_late_penalty_inr) AS linked_order_late_penalty_inr FROM vw_supplier_scorecard GROUP BY supplier_id, supplier_name, supply_type ORDER BY linked_order_revenue_inr DESC LIMIT 200")
            market = _query(token, "SELECT month, cotton_yarn_30s_inr_per_kg, usd_inr, prior_month_yarn_price, yarn_price_mom_pct, prior_month_usd_inr FROM vw_market_monthly WHERE month IS NOT NULL" + _filters_sql(year, "", has_country=False) + " ORDER BY month DESC LIMIT 120")
            linked_rev = sum(_num(r.get("linked_order_revenue_inr")) for r in suppliers)
            linked_profit = sum(_num(r.get("linked_order_profit_inr")) for r in suppliers)
            content += _kpis([("Linked-order revenue", _money(linked_rev), "Supplier-linked orders"), ("Linked-order profit", _money(linked_profit), "Association is not causation"), ("Suppliers", _integer(len(suppliers)), "Scorecard records")])
            content += '<section class="panel"><h2>Supplier scorecard</h2>' + _table(suppliers, [("supplier_id","Supplier ID",None),("supplier_name","Supplier",None),("supply_type","Type",None),("avg_delay_days","Avg delay days","int"),("quality_rating","Quality rating",None),("credit_days","Credit days","int"),("linked_order_count","Linked orders","int"),("linked_order_revenue_inr","Linked revenue","money"),("linked_order_profit_inr","Linked profit","money"),("linked_order_late_penalty_inr","Linked late penalty","money")]) + '</section>'
            content += '<section class="panel"><h2>Market indicators</h2><p class="muted">Market index values are not the same as actual purchased material costs.</p>' + _table(market, [("month","Month",None),("cotton_yarn_30s_inr_per_kg","Cotton yarn ₹/kg","money"),("usd_inr","USD/INR",None),("prior_month_yarn_price","Prior yarn ₹/kg","money"),("yarn_price_mom_pct","Yarn price MoM","pct"),("prior_month_usd_inr","Prior USD/INR",None)]) + '</section>'
        elif page_key == "investment-lab":
            totals = _query(token, "SELECT SUM(revenue_inr) AS revenue_inr, SUM(total_cost_inr) AS total_cost_inr, SUM(profit_inr) AS profit_inr, COUNT(DISTINCT date_trunc('month', order_date)) AS covered_months FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(year, country, has_month=False, has_country=True))
            t = totals[0] if totals else {}
            rev, cost, profit = _num(t.get("revenue_inr")), _num(t.get("total_cost_inr")), _num(t.get("profit_inr"))
            content += _kpis([("Recorded operating cost", _money(cost), "SUM(total_cost_inr)"), ("Revenue generated", _money(rev), "SUM(revenue_inr)"), ("Recorded net profit", _money(profit), "SUM(profit_inr)"), ("Profit / operating cost", _pct(profit, cost), "Historical indicator, not investment ROI")])
            content += '<section class="panel"><h2>Custom what-if scenario</h2><p class="muted">Enter assumptions below. Scenario figures are not source data, investment advice or a forecast.</p><form method="get" class="filters"><input type="hidden" name="year" value="' + html.escape(year, quote=True) + '"><input type="hidden" name="country" value="' + html.escape(country, quote=True) + '"><div><label for="capex">Planned capex (₹)</label><input id="capex" name="capex" type="number" min="0" value="' + html.escape(request.args.get("capex",""), quote=True) + '"></div><div><label for="saving">Expected monthly savings (₹)</label><input id="saving" name="saving" type="number" min="0" value="' + html.escape(request.args.get("saving",""), quote=True) + '"></div><div><label for="months">Horizon (months)</label><input id="months" name="months" type="number" min="1" max="120" value="' + html.escape(request.args.get("months",""), quote=True) + '"></div><div><button type="submit">Calculate scenario</button></div></form>'
            try:
                capex = max(0.0, float(request.args.get("capex","")))
                saving = max(0.0, float(request.args.get("saving","")))
                months = min(120, max(1, int(request.args.get("months",""))))
                roi = ((saving * months - capex) / capex * 100) if capex else None
                payback = capex / saving if saving else None
                content += _kpis([("Estimated payback", f"{payback:.1f} months" if payback is not None else "N/A", "Capex ÷ monthly savings"), ("Horizon ROI", f"{roi:.1f}%" if roi is not None else "N/A", "(Savings − capex) ÷ capex"), ("Estimated net savings", _money(saving * months - capex), "Before tax, maintenance and financing")])
            except (TypeError, ValueError):
                content += '<p class="muted">Fill all three scenario inputs to calculate payback, horizon ROI and net savings.</p>'
            content += '</section><section class="panel"><h2>Finance limitations</h2><p>The recorded cost measure is not necessarily capital expenditure. This dataset does not establish dated cash flows, financing charges, taxes, maintenance or ramp-up. These fields cannot be inferred as facts.</p></section>'
        return _render(title, content, signed_in=True, active_href="/page/" + page_key)
    except (requests.RequestException, RuntimeError, ValueError):
        content = _page_heading(title, kicker, description, year, country) + '<div class="error">Could not load this module from the approved workspace views. Check view permissions and the read-only SQL RPC.</div>'
        return _render(title, content, signed_in=True, active_href="/page/" + page_key)




# Fast path: common sales questions are classified locally and answered with one
# fixed, read-only SQL query. No generative model call is made for these intents.
def _classify_sales_question(question: str) -> str | None:
    q = question.casefold()
    has = lambda *terms: any(term in q for term in terms)
    if has("highest profit country", "country highest profit", "country-wise profit", "country wise profit", "top country profit"):
        return "country_profit"
    if has("highest revenue", "top revenue country", "country highest sales", "which country", "country wise revenue", "country-wise revenue", "highest sales country", "highest revenue country"):
        return "country_revenue"
    if has("highest profit buyer", "buyer highest profit", "which buyer", "top buyer profit", "buyer-wise profit", "buyer wise profit", "highest profit customer", "buyer gives the highest profit"):
        return "buyer_profit"
    if has("top buyer", "buyer ranking", "buyer wise sales", "buyer-wise sales", "buyer revenue", "sales by buyer"):
        return "buyer_revenue"
    if has("top product", "product ranking", "product wise sales", "product-wise sales", "sales by product", "highest selling product", "best selling product"):
        return "product_revenue"
    if has("monthly growth", "month on month", "month-over-month", "mom growth", "sales growth", "monthly sales", "month wise sales", "month-wise sales", "monthly trend", "month by month"):
        return "monthly_sales"
    if has("compare", "year over year", "year-on-year", "yoy", "vs") and re.search(r"\b20\d{2}\b", q):
        return "year_compare"
    if has("country wise", "country-wise", "sales by country", "revenue by country", "country ranking", "all countries"):
        return "country_revenue"
    if has("total revenue", "overall revenue", "total sales", "overall sales", "sales amount", "total profit", "overall profit", "total orders", "overall summary", "sales summary", "kpi"):
        return "summary"
    return None


def _fast_sales_result(token: str, question: str, year: str, country: str):
    intent = _classify_sales_question(question)
    if not intent:
        return None
    safe_year = year if re.fullmatch(r"20\d{2}", year or "") else ""
    where = " WHERE 1=1" + _filters_sql(safe_year, country)
    if intent in {"country_revenue", "country_profit"}:
        sort_col = "profit_inr" if intent == "country_profit" else "revenue_inr"
        sql = "SELECT country, COUNT(DISTINCT order_id) AS order_count, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(safe_year, country, has_month=False) + " AND country IS NOT NULL GROUP BY country ORDER BY " + sort_col + " DESC LIMIT 10"
        rows = _query(token, sql)
        columns = [("country", "Country", None), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("order_count", "Orders", "int")]
        title = "Top countries by " + ("profit" if intent == "country_profit" else "revenue")
        source = "fact_orders"
    elif intent in {"buyer_profit", "buyer_revenue"}:
        sort_col = "profit_inr" if intent == "buyer_profit" else "revenue_inr"
        sql = "SELECT buyer_name, country, COUNT(DISTINCT order_id) AS order_count, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, CASE WHEN SUM(revenue_inr)=0 THEN NULL ELSE SUM(profit_inr)/SUM(revenue_inr)*100 END AS profit_margin_pct FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(safe_year, country, has_month=False) + " GROUP BY buyer_name, country ORDER BY " + sort_col + " DESC LIMIT 10"
        rows = _query(token, sql)
        columns = [("buyer_name", "Buyer", None), ("country", "Country", None), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("profit_margin_pct", "Margin", "pct"), ("order_count", "Orders", "int")]
        title = "Top buyers by " + ("profit" if intent == "buyer_profit" else "revenue")
        source = "fact_orders"
    elif intent == "product_revenue":
        sql = "SELECT product_category, fabric, style_id, COUNT(DISTINCT order_id) AS order_count, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr FROM fact_orders WHERE order_date IS NOT NULL" + _filters_sql(safe_year, country, has_month=False) + " GROUP BY product_category, fabric, style_id ORDER BY revenue_inr DESC LIMIT 10"
        rows = _query(token, sql)
        columns = [("product_category", "Product", None), ("fabric", "Fabric", None), ("style_id", "Style", None), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("order_count", "Orders", "int")]
        title = "Top products by revenue"
        source = "fact_orders"
    elif intent == "monthly_sales":
        sql = "SELECT month, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count FROM vw_sales_monthly_by_country WHERE month IS NOT NULL" + _filters_sql(safe_year, country) + " GROUP BY month ORDER BY month ASC LIMIT 120"
        rows = _query(token, sql)
        previous = None
        for row in rows:
            current = _num(row.get("revenue_inr"))
            row["growth_pct"] = ((current - previous) / abs(previous) * 100) if previous not in (None, 0) else None
            previous = current
        columns = [("month", "Month", None), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("growth_pct", "Revenue growth", "pct"), ("order_count", "Orders", "int")]
        title = "Monthly sales and growth"
        source = "vw_sales_monthly_by_country"
    elif intent == "year_compare":
        years_found = list(dict.fromkeys(re.findall(r"\b20\d{2}\b", question)))
        if len(years_found) < 2:
            intent = "summary"
        else:
            first, second = int(years_found[0]), int(years_found[1])
            sql = "SELECT EXTRACT(YEAR FROM month)::int AS sales_year, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count FROM vw_sales_monthly_by_country WHERE month IS NOT NULL AND EXTRACT(YEAR FROM month)::int IN (" + str(first) + "," + str(second) + ")"
            if country:
                sql += " AND country = '" + country.replace("'", "''") + "'"
            sql += " GROUP BY EXTRACT(YEAR FROM month)::int ORDER BY sales_year"
            rows = _query(token, sql)
            by_year = {int(_num(r.get("sales_year"))): r for r in rows}
            for y in (first, second):
                by_year.setdefault(y, {"sales_year": y, "revenue_inr": 0, "profit_inr": 0, "order_count": 0})
            rows = [by_year[y] for y in (first, second)]
            columns = [("sales_year", "Year", "int"), ("revenue_inr", "Revenue", "money"), ("profit_inr", "Profit", "money"), ("order_count", "Orders", "int")]
            title = f"Year comparison: {first} vs {second}"
            source = "vw_sales_monthly_by_country"
            return {"title": title, "rows": rows, "columns": columns, "source": source}
    if intent == "summary":
        sql = "SELECT SUM(revenue_inr) AS revenue_inr, SUM(total_cost_inr) AS total_cost_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count, SUM(delayed_order_count) AS delayed_order_count FROM vw_sales_monthly_by_country WHERE month IS NOT NULL" + _filters_sql(safe_year, country)
        rows = _query(token, sql)
        columns = [("revenue_inr", "Revenue", "money"), ("total_cost_inr", "Recorded cost", "money"), ("profit_inr", "Profit", "money"), ("order_count", "Orders", "int"), ("delayed_order_count", "Delayed orders", "int")]
        title = "Sales KPI summary"
        source = "vw_sales_monthly_by_country"
    return {"title": title, "rows": rows, "columns": columns, "source": source}


def _fast_answer_html(result: dict[str, Any]) -> str:
    rows = result["rows"]
    table = _table(rows, result["columns"], empty="No records were returned for this question and filter selection.")
    return (
        '<section class="panel"><h2>' + html.escape(result["title"]) + '</h2>'
        '<p class="muted">Fast path: local intent classification + one read-only SQL query; no generative-model reasoning.</p>'
        + table + '<p class="small muted">Source: ' + html.escape(result["source"]) + '</p></section>'
    )


@app.post("/ask")
def ask():
    user = _current_user()
    if not user:
        return redirect(url_for("index"))
    _check_csrf()
    question = request.form.get("question", "").strip()
    if not question or len(question) > 12000:
        return redirect(url_for("module_page", page_key="ask-ai"))
    year = request.form.get("year", "").strip()
    country = request.form.get("country", "").strip()[:100]
    try:
        fast_result = _fast_sales_result(user["token"], question, year, country)
        if fast_result is not None:
            content = _page_heading("Ask AI", "FAST SALES ANALYTICS", "Common sales questions are classified locally and returned as a table.", year, country)
            content += _ask_form(year, country, question) + _fast_answer_html(fast_result)
            return _render("Ask AI", content, signed_in=True, active_href="/page/ask-ai")
    except (requests.RequestException, RuntimeError, ValueError):
        content = _page_heading("Ask AI", "FAST SALES ANALYTICS", "A quick sales query could not be completed.", year, country)
        content += '<div class="error">The sales query could not be loaded from the approved workspace view. Please retry.</div>' + _ask_form(year, country, question)
        return _render("Ask AI", content, signed_in=True, active_href="/page/ask-ai")
    if not GEMINI_API_KEY or not SUPABASE_SERVICE_ROLE_KEY:
        return _render("Ask AI", '<h1>Ask AI</h1><div class="error">The server-side AI/quota configuration is incomplete.</div>' + _ask_form(year, country, question), signed_in=True, active_href="/page/ask-ai")
    try:
        status, quota = _supabase_request(
            "POST", "/rest/v1/rpc/threadiq_consume_ai_quota", SUPABASE_SERVICE_ROLE_KEY,
            body={"p_user_id": user["user_id"]},
        )
        if status >= 400 or quota is not True:
            return _render("Ask AI", '<h1>Ask AI</h1><div class="error">AI request quota is exhausted or could not be verified. Please retry shortly.</div>' + _ask_form(year, country, question), signed_in=True, active_href="/page/ask-ai")
        async def run():
            async with httpx.AsyncClient(timeout=httpx.Timeout(HTTP_TIMEOUT, connect=8), follow_redirects=False) as client:
                async def sql_runner(sql):
                    return await _execute_sql(client, SUPABASE_URL, SUPABASE_ANON_KEY, user["token"], sql)
                return await _run_gemini(client, GEMINI_API_KEY, question, [], year, country, sql_runner)
        answer, sources = asyncio.run(run())
        answer = str(answer)[:16000]
        source_rows = [{"name": str(row.get("name","")), "records": str(row.get("records",""))} for row in sources[:10]]
        source_html = _table(source_rows, [("name","Source view",None),("records","Rows returned",None)], empty="No source metadata returned.")
        content = _page_heading("Ask AI", "WORKSPACE DATA ASSISTANT", "Answers are based on read-only SQL queries against approved business views.", year, country)
        content += _ask_form(year, country)
        content += '<section class="panel"><h2>Answer</h2><p class="muted">Question: ' + html.escape(question) + '</p><div class="answer">' + html.escape(answer) + '</div><h3 style="margin-top:16px">Data sources</h3>' + source_html + '</section>'
        return _render("Ask AI", content, signed_in=True, active_href="/page/ask-ai")
    except (requests.RequestException, httpx.HTTPError, RuntimeError, ValueError):
        content = _page_heading("Ask AI", "WORKSPACE DATA ASSISTANT", "Answers are based on read-only SQL queries against approved business views.", year, country)
        content += '<div class="error">AI analysis could not complete. Check server configuration and retry; raw provider or database details are not exposed.</div>' + _ask_form(year, country, question)
        return _render("Ask AI", content, signed_in=True, active_href="/page/ask-ai")


@app.post("/logout")
def logout():
    _check_csrf()
    sid = session.pop("sid", None)
    if sid:
        SESSIONS.pop(sid, None)
    session.clear()
    return redirect(url_for("index"))


@app.errorhandler(400)
def bad_request(error):
    return _render("Request rejected", '<h1>Request rejected</h1><div class="error">' + html.escape(getattr(error, "description", "Invalid request")) + '</div><p><a class="button" href="/">Return to dashboard</a></p>', signed_in=bool(_current_user())) , 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=False)
