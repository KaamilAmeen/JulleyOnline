# JulleyOnline Assistant (Python)

A small, **read-only** FastAPI service that answers natural-language questions
about a tenant's boards. It is deliberately dumb about identity and storage:

- The Node API authenticates the user and enforces tenant membership.
- The Node API builds a tenant-scoped snapshot (boards, columns, tasks, recent
  activity) and POSTs it here with a shared `x-service-token`.
- This service never sees `DATABASE_URL`, never writes anything, and has no
  endpoint that can mutate data.

That design means a bug or prompt injection here cannot cross tenant
boundaries — the worst case is a bad answer about data the caller already has.

## Run

```powershell
cd ai-service
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env      # then set AI_SERVICE_TOKEN
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 --reload
```

`AI_SERVICE_TOKEN` must match `AI_SERVICE_TOKEN` in `backend/.env`.

## Endpoints

| Method | Path               | Auth             | Description                              |
| ------ | ------------------ | ---------------- | ---------------------------------------- |
| GET    | `/health`          | none             | Liveness + active provider/model         |
| POST   | `/assistant/query` | `x-service-token`| `{ question, context }` → `{ answer, … }` |

`POST /assistant/query` body:

```json
{
  "question": "What is overdue in Hyderabad?",
  "context": {
    "tenantName": "Hyderabad HQ",
    "now": "2026-03-10T09:00:00Z",
    "boards": [
      {
        "name": "Platform Roadmap",
        "columns": [{ "id": "c1", "name": "In Progress" }],
        "tasks": [
          {
            "title": "Ship audit log",
            "columnId": "c1",
            "columnName": "In Progress",
            "priority": "URGENT",
            "dueDate": "2026-03-01T00:00:00Z",
            "assignee": "Rahul Sharma"
          }
        ]
      }
    ],
    "activity": []
  }
}
```

Response:

```json
{
  "answer": "Overdue tasks (1):\n• Ship audit log — Rahul Sharma, due 2026-03-01 (In Progress)",
  "toolsUsed": ["overdue_tasks"],
  "provider": "deterministic",
  "model": null
}
```

## Two answer modes

1. **Deterministic (default, no network).** `app/tools.py` routes the question
   by keyword to read-only functions (`overdue_tasks`, `workload_by_assignee`,
   `column_distribution`, `priority_breakdown`, `unassigned_tasks`,
   `recent_activity`, `search_tasks`, `snapshot_summary`) and formats the
   results into Markdown. Every number comes straight from the snapshot, so the
   answer is auditable and reproducible. Unknown questions fall back to a
   summary.
2. **Optional LLM (Gemini by default).** Gemini's OpenAI-compatible endpoint is
   built in:

   ```dotenv
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=your-key-from-aistudio.google.com/apikey
   LLM_MODEL=gemini-2.5-flash
   ```

   You can also point the service at any other OpenAI-compatible endpoint:

   ```dotenv
   LLM_PROVIDER=openai
   LLM_API_KEY=sk-...
   LLM_BASE_URL=https://api.openai.com/v1
   LLM_MODEL=gpt-4o-mini
   ```

   The model receives **only** the same snapshot and tool results, with a system
   prompt that forbids inventing data. Any provider error silently falls back to
   mode 1, so the assistant keeps working offline or when the key is wrong.
   `/health` reports the active `provider` (`gemini`, `openai` or
   `deterministic`) and `model`.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Twelve tests cover routing, done-column detection, workload aggregation, search,
the HTTP contract, service-token enforcement, the deterministic answer text and
Gemini provider resolution (including the OpenAI-compatibility URL and graceful
fallback).
