"""Unit tests for the deterministic analyst and HTTP contract.

Run from ``ai-service``:  python -m pytest -q
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("AI_SERVICE_TOKEN", "test-service-token")
os.environ.pop("LLM_API_KEY", None)

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
