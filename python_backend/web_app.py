"""Python-only server-rendered ThreadIQ web application (WSGI entry point).

No React, TypeScript, browser JavaScript, or client-side secrets. User access
tokens stay in a short-lived server-side cache; only an opaque random session
identifier is stored in the signed browser cookie.
"""
from __future__ import annotations

import asyncio
import os
import secrets
import time
from typing import Any

import httpx
import requests
from flask import Flask, redirect, render_template_string, request, session, url_for
from cachetools import TTLCache

from main import (
    ALLOWED_RELATIONS,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    UPSTREAM_TIMEOUT_SECONDS,
    _execute_sql,
    _run_gemini,
)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SECURE=True, SESSION_COOKIE_SAMESITE="Lax")
if not app.secret_key:
    # Fail closed in production rather than using a predictable cookie key.
    raise RuntimeError("FLASK_SECRET_KEY must be set in the hosting environment.")

SESSION_TTL_SECONDS = int(os.environ.get("WEB_SESSION_TTL_SECONDS", "3600"))
SESSIONS: TTLCache[str, dict[str, Any]] = TTLCache(maxsize=500, ttl=SESSION_TTL_SECONDS)
HTTP_TIMEOUT = min(max(UPSTREAM_TIMEOUT_SECONDS, 5), 45)

BASE_STYLE = """
:root{color-scheme:light;--ink:#142033;--muted:#66758a;--line:#e5eaf1;--accent:#176b57;--bg:#f5f7fa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{background:#fff;border-bottom:1px solid var(--line);padding:18px max(20px,calc((100vw - 1120px)/2));display:flex;justify-content:space-between;align-items:center;gap:18px}
main{max-width:1120px;margin:28px auto;padding:0 18px}.muted{color:var(--muted)}.brand{font-weight:800;letter-spacing:-.03em;font-size:20px}
.panel,.kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 4px 18px #13223808}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:18px 0}.kpi span{display:block;color:var(--muted);font-size:13px}.kpi strong{display:block;font-size:25px;margin-top:8px;overflow-wrap:anywhere}
label{display:block;font-size:13px;font-weight:650;margin:10px 0 6px}input,select,textarea{width:100%;padding:11px 12px;border:1px solid #ccd5e1;border-radius:9px;background:#fff;color:var(--ink);font:inherit}
button,.button{border:0;border-radius:9px;background:var(--accent);color:white;font-weight:700;padding:11px 16px;cursor:pointer;text-decoration:none;display:inline-block}
.secondary{background:#eaf2ef;color:#174f43}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.row>div{flex:1;min-width:170px}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 8px;font-size:14px}th{color:var(--muted);font-weight:650}
.answer{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:16px}
.error{color:#a12626;background:#fff0f0;border:1px solid #ffd2d2;padding:12px;border-radius:9px;margin:12px 0}
@media(max-width:600px){header{padding:14px 16px}main{margin-top:18px}.kpi strong{font-size:21px}}
"""
LAYOUT = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ title }} · ThreadIQ</title><style>{{ css }}</style></head><body><header><div><div class="brand">ThreadIQ Analytics</div><div class="muted">Garment business intelligence · Python edition</div></div>{% if signed_in %}<form method="post" action="{{ url_for('logout') }}"><button class="secondary" type="submit">Sign out</button></form>{% endif %}</header><main>{{ body|safe }}</main></body></html>"""
LOGIN = """<section class="panel" style="max-width:460px;margin:6vh auto"><h1>Sign in to your workspace</h1><p class="muted">Use your approved ThreadIQ account. Credentials are sent directly to Supabase Auth over HTTPS.</p>{% if error %}<div class="error">{{ error }}</div>{% endif %}<form method="post"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required maxlength="254"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024"><p style="margin-top:18px"><button type="submit">Sign in securely</button></p></form><p class="muted">Email confirmation and active workspace membership are required.</p></section>"""
DASHBOARD = """<h1>Sales intelligence</h1><p class="muted">Your data is queried from approved Supabase views. Ask AI answers are grounded in read-only SQL results.</p>
{% if error %}<div class="error">{{ error }}</div>{% endif %}
<form class="panel" method="get"><div class="row"><div><label for="year">Financial/calendar year</label><select id="year" name="year"><option value="">All available years</option>{% for y in years %}<option value="{{ y }}" {% if y==year %}selected{% endif %}>{{ y }}</option>{% endfor %}</select></div><div><label for="country">Country</label><select id="country" name="country"><option value="">All countries</option>{% for c in countries %}<option value="{{ c }}" {% if c==country %}selected{% endif %}>{{ c }}</option>{% endfor %}</select></div><div><button type="submit">Apply filters</button></div></div></form>
<div class="grid">{% for k in kpis %}<div class="kpi"><span>{{ k.label }}</span><strong>{{ k.value }}</strong></div>{% endfor %}</div>
<section class="panel"><h2>Monthly sales summary</h2>{{ monthly_table|safe }}</section>
<section class="panel" style="margin-top:18px"><h2>Ask AI</h2><p class="muted">Ask about country revenue, buyer profit, monthly growth, production, marketing, suppliers, or management performance.</p><form method="post" action="{{ url_for('ask') }}"><input type="hidden" name="year" value="{{ year }}"><input type="hidden" name="country" value="{{ country }}"><label for="question">Your question</label><textarea id="question" name="question" rows="3" maxlength="12000" required placeholder="Which country has the highest revenue?"></textarea><p><button type="submit">Analyze with AI</button></p></form>{% if answer %}<div class="answer">{{ answer }}</div>{% endif %}</section>"""


def _supabase_request(method: str, path: str, token: str, *, body=None, params=None):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("Supabase is not configured.")
    response = requests.request(
        method, f"{SUPABASE_URL}{path}", timeout=HTTP_TIMEOUT,
        headers={"apikey": SUPABASE_ANON_KEY, "authorization": f"Bearer {token}",
                 "content-type": "application/json"},
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
        return None
    # Re-check Supabase session and workspace approval on every request.
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


def _render(title: str, body: str, *, signed_in=False, **context):
    inner = render_template_string(body, **context)
    return render_template_string(LAYOUT, title=title, body=inner, css=BASE_STYLE, signed_in=signed_in)


def _format_inr(value: Any) -> str:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return "₹0"
    a = abs(n)
    if a >= 10_000_000:
        return f"₹{n / 10_000_000:,.2f} Cr"
    if a >= 100_000:
        return f"₹{n / 100_000:,.2f} Lakh"
    return "₹" + format(n, ",.0f")


def _run_readonly_sql(token: str, sql: str) -> list[dict[str, Any]]:
    status, payload = _supabase_request(
        "POST", "/rest/v1/rpc/threadiq_run_readonly_query", token,
        body={"p_sql": sql},
    )
    if status >= 400 or not isinstance(payload, list):
        raise RuntimeError("Could not read workspace analytics. Verify the approved read-only SQL RPC.")
    return payload


@app.get("/health")
def health():
    return {"status": "ok", "service": "threadiq-python-web", "engine": "python"}


@app.route("/", methods=["GET", "POST"])
def index():
    user = _current_user()
    if not user:
        if request.method == "POST":
            email = request.form.get("email", "").strip()[:254]
            password = request.form.get("password", "")
            if not email or not password or len(password) > 1024:
                return _render("Sign in", LOGIN, error="Enter a valid email and password.")
            try:
                response = requests.post(
                    f"{SUPABASE_URL}/auth/v1/token",
                    params={"grant_type": "password"},
                    headers={"apikey": SUPABASE_ANON_KEY, "content-type": "application/json"},
                    json={"email": email, "password": password}, timeout=HTTP_TIMEOUT,
                )
                auth = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                token = auth.get("access_token")
                if response.status_code >= 400 or not token or not auth.get("user", {}).get("id"):
                    return _render("Sign in", LOGIN, error="Sign-in failed. Check your credentials and email confirmation.")
                if not auth["user"].get("email_confirmed_at"):
                    return _render("Sign in", LOGIN, error="Confirm your email before signing in.")
                status, membership = _supabase_request(
                    "GET", "/rest/v1/threadiq_workspace_members", token,
                    params={"select": "is_active", "user_id": f"eq.{auth['user']['id']}", "limit": "1"},
                )
                if status >= 400 or not isinstance(membership, list) or not membership or membership[0].get("is_active") is not True:
                    return _render("Sign in", LOGIN, error="This account is not approved for the workspace.")
                sid = secrets.token_urlsafe(32)
                SESSIONS[sid] = {"token": token, "user_id": auth["user"]["id"], "email": auth["user"].get("email", "")}
                session.clear()
                session["sid"] = sid
                session.permanent = True
                return redirect(url_for("index"))
            except (requests.RequestException, ValueError, RuntimeError):
                return _render("Sign in", LOGIN, error="Authentication service unavailable. Please retry.")
        return _render("Sign in", LOGIN, error=None)

    token = user["token"]
    year = request.args.get("year", "").strip()
    if year and not (len(year) == 4 and year.isdigit() and year.startswith("20")):
        year = ""
    country = request.args.get("country", "").strip()[:100]
    try:
        year_filter = f" AND EXTRACT(YEAR FROM month)::int = {int(year)}" if year else ""
        country_filter = " AND country = '" + country.replace("'", "''") + "'" if country else ""
        monthly = _run_readonly_sql(token, "SELECT month, SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count FROM vw_sales_monthly_by_country WHERE month IS NOT NULL" + year_filter + country_filter + " GROUP BY month ORDER BY month DESC LIMIT 18")
        totals = _run_readonly_sql(token, "SELECT SUM(revenue_inr) AS revenue_inr, SUM(profit_inr) AS profit_inr, SUM(order_count) AS order_count FROM vw_sales_monthly_by_country WHERE month IS NOT NULL" + year_filter + country_filter)
        countries_rows = _run_readonly_sql(token, "SELECT DISTINCT country FROM vw_sales_by_country WHERE country IS NOT NULL ORDER BY country LIMIT 200")
        years_rows = _run_readonly_sql(token, "SELECT DISTINCT EXTRACT(YEAR FROM month)::int AS year FROM vw_sales_monthly_by_country WHERE month IS NOT NULL ORDER BY year DESC LIMIT 15")
        total = totals[0] if totals else {}
        kpis = [
            {"label": "Revenue", "value": _format_inr(total.get("revenue_inr"))},
            {"label": "Recorded profit", "value": _format_inr(total.get("profit_inr"))},
            {"label": "Weighted profit margin", "value": (f"{float(total.get('profit_inr') or 0) / float(total.get('revenue_inr') or 1) * 100:.2f}%" if float(total.get("revenue_inr") or 0) else "N/A")},
            {"label": "Order count", "value": f"{int(total.get('order_count') or 0):,}"},
        ]
        countries = [str(row["country"]) for row in countries_rows if row.get("country")]
        years = [str(row["year"]) for row in years_rows if row.get("year")]
        monthly_table = "<table><thead><tr><th>Month</th><th>Revenue</th><th>Profit</th><th>Orders</th></tr></thead><tbody>" + "".join(
            "<tr><td>" + str(row.get("month", ""))[:10] + "</td><td>" + _format_inr(row.get("revenue_inr")) + "</td><td>" + _format_inr(row.get("profit_inr")) + "</td><td>" + f"{int(row.get('order_count') or 0):,}" + "</td></tr>" for row in monthly
        ) + "</tbody></table>"
        return _render("Dashboard", DASHBOARD, signed_in=True, kpis=kpis, monthly_table=monthly_table, years=years, countries=countries, year=year, country=country, answer=None, error=None)
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        return _render("Dashboard", DASHBOARD, signed_in=True, kpis=[], monthly_table="<p>Analytics could not be loaded.</p>", years=[], countries=[], year=year, country=country, answer=None, error=str(exc))


@app.post("/ask")
def ask():
    user = _current_user()
    if not user:
        return redirect(url_for("index"))
    question = request.form.get("question", "").strip()
    if not question or len(question) > 12000:
        return redirect(url_for("index"))
    if not GEMINI_API_KEY or not SUPABASE_SERVICE_ROLE_KEY:
        return _render("Dashboard", "<section class='panel'><h1>AI not configured</h1><p>Set the server-side AI and quota secrets before using Ask AI.</p><a class='button' href='/'>Back to dashboard</a></section>", signed_in=True)
    token = user["token"]
    year = request.form.get("year", "").strip()
    if not (len(year) == 4 and year.isdigit() and year.startswith("20")):
        year = ""
    country = request.form.get("country", "").strip()[:100]
    try:
        status, quota = _supabase_request(
            "POST", "/rest/v1/rpc/threadiq_consume_ai_quota", SUPABASE_SERVICE_ROLE_KEY,
            body={"p_user_id": user["user_id"]},
        )
        if status >= 400 or quota is not True:
            return _render("Dashboard", "<section class='panel'><h1>AI request unavailable</h1><p>Quota is exhausted or could not be verified. Retry shortly.</p><a class='button' href='/'>Back to dashboard</a></section>", signed_in=True)
        async def run():
            async with httpx.AsyncClient(timeout=httpx.Timeout(HTTP_TIMEOUT, connect=8), follow_redirects=False) as client:
                async def sql_runner(sql):
                    return await _execute_sql(client, SUPABASE_URL, SUPABASE_ANON_KEY, token, sql)
                return await _run_gemini(client, GEMINI_API_KEY, question, [], year, country, sql_runner)
        answer, sources = asyncio.run(run())
        # Avoid reflecting any raw SQL errors or credentials in the page.
        answer = str(answer)[:16000]
        return _render("AI answer", "<section class='panel'><h1>Ask AI</h1><p class='muted'>Question: {{ question }}</p><div class='answer'>{{ answer }}</div><p><a class='button' href='/'>Back to dashboard</a></p></section>", signed_in=True, question=question, answer=answer)
    except Exception:
        return _render("AI answer", "<section class='panel'><h1>AI temporarily unavailable</h1><p>Could not complete the analysis. Check server logs and retry.</p><a class='button' href='/'>Back to dashboard</a></section>", signed_in=True)


@app.post("/logout")
def logout():
    sid = session.pop("sid", None)
    if sid:
        SESSIONS.pop(sid, None)
    session.clear()
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), debug=False)
