"""Optional LLM answer layer (Gemini or any OpenAI-compatible endpoint).

The service is useful without any network access: :mod:`app.tools` produces a
deterministic, grounded answer. When an API key is configured we ask a chat
completions endpoint to rephrase those same tool results, so the model can only
talk about data the Node API already scoped to the caller's tenant.

Gemini is supported natively through its OpenAI-compatible endpoint, so the
same code path works for both providers:

    LLM_PROVIDER=gemini
    GEMINI_API_KEY=...
    LLM_MODEL=gemini-2.5-flash
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """You are the JulleyOnline Kanban analyst.
Answer using ONLY the tenant snapshot and tool results in the user message.
Never invent tasks, people, dates or counts. If the data does not answer the
question, say so and suggest what the user can ask instead.
Be concise: short paragraphs or bullets, no markdown tables, no headings
larger than a bold label. Never reveal tenant ids, user ids or raw JSON.
"""


def _read(name: str) -> str:
    return (os.getenv(name) or "").strip()


def llm_config() -> dict[str, str] | None:
    """Return the configured endpoint, or ``None`` when the LLM is disabled.

    Provider resolution:
      * ``LLM_PROVIDER`` wins when set (``gemini`` or ``openai``);
      * otherwise a bare ``GEMINI_API_KEY`` implies Gemini;
      * otherwise an ``LLM_API_KEY`` implies OpenAI.
    """
    api_key = _read("LLM_API_KEY") or _read("GEMINI_API_KEY")
    if not api_key:
        return None

    provider = _read("LLM_PROVIDER").lower()
    if not provider:
        provider = "gemini" if _read("GEMINI_API_KEY") and not _read("LLM_BASE_URL") else "openai"

    if provider == "gemini":
        base_url = _read("LLM_BASE_URL") or GEMINI_BASE_URL
        model = _read("LLM_MODEL") or DEFAULT_GEMINI_MODEL
    else:
        base_url = _read("LLM_BASE_URL") or OPENAI_BASE_URL
        model = _read("LLM_MODEL") or DEFAULT_OPENAI_MODEL

    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url.rstrip("/"),
        "model": model,
        "timeout": _read("LLM_TIMEOUT_SECONDS") or "25",
    }


def _payload(question: str, context: dict[str, Any], results: list[dict[str, Any]]) -> str:
    """Trim the snapshot so a large tenant cannot blow up the prompt budget."""
    boards = []
    for board in context.get("boards") or []:
        boards.append(
            {
                "name": board.get("name"),
                "columns": [column.get("name") for column in board.get("columns") or []],
                "tasks": [
                    {
                        "title": task.get("title"),
                        "column": task.get("columnName"),
                        "priority": task.get("priority"),
                        "assignee": task.get("assignee"),
                        "dueDate": task.get("dueDate"),
                    }
                    for task in (board.get("tasks") or [])[:120]
                ],
            }
        )

    return json.dumps(
        {
            "question": question,
            "tenant": context.get("tenantName"),
            "viewer": {"name": context.get("userName"), "role": context.get("role")},
            "now": context.get("now"),
            "boards": boards,
            "activity": (context.get("activity") or [])[:10],
            "toolResults": results,
        },
        default=str,
        ensure_ascii=False,
    )


def ask_llm(
    question: str,
    context: dict[str, Any],
    results: list[dict[str, Any]],
) -> tuple[str, str, str] | None:
    """Return ``(answer, model, provider)`` or ``None`` when disabled/unreachable.

    Any failure degrades gracefully to the deterministic answer; the assistant
    must keep working when the upstream provider is down or misconfigured.
    """
    config = llm_config()
    if config is None:
        return None

    body = {
        "model": config["model"],
        "temperature": 0.2,
        "max_tokens": 700,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _payload(question, context, results)},
        ],
    }

    try:
        response = httpx.post(
            f"{config['base_url']}/chat/completions",
            headers={
                "authorization": f"Bearer {config['api_key']}",
                "content-type": "application/json",
            },
            json=body,
            timeout=float(config["timeout"]),
        )
        response.raise_for_status()
        data = response.json()
        answer = (data["choices"][0]["message"]["content"] or "").strip()
        if not answer:
            return None
        return answer, str(data.get("model") or config["model"]), config["provider"]
    except Exception:
        return None
