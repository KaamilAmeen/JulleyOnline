"""Unit tests for the deterministic analyst and HTTP contract.

Run from ``ai-service``:  python -m pytest -q
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AI_SERVICE_TOKEN", "test-service-token")
os.environ.pop("LLM_API_KEY", None)

from app.llm import DEFAULT_GEMINI_MODEL, GEMINI_BASE_URL, ask_llm, llm_config  # noqa: E402
from app.main import app  # noqa: E402  (env must be set first)
from app.tools import build_answer, run_tools  # noqa: E402

SNAPSHOT = {
    "tenantName": "Hyderabad HQ",
    "now": "2026-03-10T09:00:00Z",
    "boards": [
        {
            "id": "b1",
            "name": "Platform Roadmap",
            "columns": [
                {"id": "c1", "name": "Backlog"},
                {"id": "c2", "name": "In Progress"},
                {"id": "c3", "name": "Done"},
            ],
            "tasks": [
                {
                    "id": "t1",
                    "title": "Ship audit log",
                    "priority": "URGENT",
                    "dueDate": "2026-03-01T00:00:00Z",
                    "columnId": "c2",
                    "columnName": "In Progress",
                    "assignee": "Rahul Sharma",
                },
                {
                    "id": "t2",
                    "title": "Write onboarding docs",
                    "priority": "LOW",
                    "dueDate": "2026-04-01T00:00:00Z",
                    "columnId": "c1",
                    "columnName": "Backlog",
                    "assignee": None,
                },
                {
                    "id": "t3",
                    "title": "Legacy cleanup",
                    "priority": "HIGH",
                    "dueDate": None,
                    "columnId": "c3",
                    "columnName": "Done",
                    "assignee": "Priya Nair",
                },
            ],
        }
    ],
    "activity": [
        {
            "userName": "Priya Nair",
            "action": "TASK_MOVED",
            "entityType": "TASK",
            "details": "Legacy cleanup",
            "createdAt": "2026-03-09T12:00:00Z",
        }
    ],
}


def test_overdue_routing_finds_only_open_late_tasks() -> None:
    results = run_tools("what is overdue?", SNAPSHOT)
    overdue = next(result for result in results if result["tool"] == "overdue_tasks")
    assert overdue["count"] == 1
    assert overdue["items"][0]["title"] == "Ship audit log"


def test_workload_ignores_done_column() -> None:
    results = run_tools("show workload by assignee", SNAPSHOT)
    workload = next(result for result in results if result["tool"] == "workload_by_assignee")
    names = [person["name"] for person in workload["people"]]
    assert names == ["Rahul Sharma", "Unassigned"]


def test_unassigned_and_priority_tools() -> None:
    results = run_tools("unassigned urgent priority", SNAPSHOT)
    tools = {result["tool"] for result in results}
    assert {"unassigned_tasks", "priority_breakdown"} <= tools


def test_summary_fallback_when_no_keywords_match() -> None:
    results = run_tools("how are we doing", SNAPSHOT)
    tools = [result["tool"] for result in results]
    assert tools[0] == "snapshot_summary"


def test_answer_mentions_tenant_and_overdue_task() -> None:
    results = run_tools("what is overdue?", SNAPSHOT)
    answer = build_answer("what is overdue?", SNAPSHOT, results)
    assert "Hyderabad HQ" in answer or "Overdue" in answer
    assert "Ship audit log" in answer


def test_search_tasks() -> None:
    results = run_tools("search audit", SNAPSHOT)
    search = next(result for result in results if result["tool"] == "search_tasks")
    assert search["count"] == 1


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_gemini_is_inferred_from_its_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("LLM_PROVIDER", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    config = llm_config()

    assert config is not None
    assert config["provider"] == "gemini"
    assert config["base_url"] == GEMINI_BASE_URL
    assert config["model"] == DEFAULT_GEMINI_MODEL


def test_ask_llm_posts_to_gemini_openai_compatibility_layer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in ("LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "model": "gemini-2.5-flash",
                "choices": [{"message": {"content": "Grounded answer"}}],
            }

    def fake_post(url: str, **kwargs: object) -> FakeResponse:
        captured["url"] = url
        captured["headers"] = kwargs.get("headers")
        captured["json"] = kwargs.get("json")
        return FakeResponse()

    monkeypatch.setattr("app.llm.httpx.post", fake_post)

    results = run_tools("what is overdue?", SNAPSHOT)
    answer = ask_llm("what is overdue?", SNAPSHOT, results)

    assert answer == ("Grounded answer", "gemini-2.5-flash", "gemini")
    assert captured["url"] == f"{GEMINI_BASE_URL}/chat/completions"
    headers = captured["headers"]
    assert isinstance(headers, dict)
    assert headers["authorization"] == "Bearer gemini-key"
    body = captured["json"]
    assert isinstance(body, dict)
    assert body["model"] == "gemini-2.5-flash"


def test_ask_llm_degrades_to_none_when_the_provider_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    def fake_post(*_args: object, **_kwargs: object) -> object:
        raise RuntimeError("provider down")

    monkeypatch.setattr("app.llm.httpx.post", fake_post)

    assert ask_llm("what is overdue?", SNAPSHOT, run_tools("what is overdue?", SNAPSHOT)) is None


def test_query_requires_service_token(client: TestClient) -> None:
    response = client.post("/assistant/query", json={"question": "status?", "context": SNAPSHOT})
    assert response.status_code == 401


def test_query_returns_deterministic_answer(client: TestClient) -> None:
    response = client.post(
        "/assistant/query",
        headers={"x-service-token": "test-service-token"},
        json={"question": "what is overdue?", "context": SNAPSHOT},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "deterministic"
    assert "overdue_tasks" in body["toolsUsed"]
    assert "Ship audit log" in body["answer"]
