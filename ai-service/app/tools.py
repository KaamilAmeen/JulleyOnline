"""Read-only tools over the tenant snapshot supplied by the Node API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

Context = dict[str, Any]
ToolResult = dict[str, Any]

DONE_COLUMN_HINTS = ("done", "complete", "completed", "closed", "shipped")


def boards(ctx: Context) -> list[dict[str, Any]]:
    value = ctx.get("boards")
    return value if isinstance(value, list) else []


def all_tasks(ctx: Context) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    for board in boards(ctx):
        for task in board.get("tasks") or []:
            tasks.append({**task, "_board": board.get("name", "Board")})
    return tasks


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def now(ctx: Context) -> datetime:
    parsed = parse_dt(ctx.get("now"))
    return parsed or datetime.now(timezone.utc)


def is_done(task: dict[str, Any]) -> bool:
    column = str(task.get("columnName") or "").strip().lower()
    return any(hint in column for hint in DONE_COLUMN_HINTS)


def task_row(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": task.get("title"),
        "board": task.get("_board"),
        "column": task.get("columnName"),
        "priority": task.get("priority"),
        "assignee": task.get("assignee") or "Unassigned",
        "dueDate": task.get("dueDate"),
    }


def snapshot_summary(ctx: Context) -> ToolResult:
    tasks = all_tasks(ctx)
    open_tasks = [task for task in tasks if not is_done(task)]
    return {
        "tool": "snapshot_summary",
        "tenant": ctx.get("tenantName", "this branch"),
        "boardCount": len(boards(ctx)),
        "taskCount": len(tasks),
        "openCount": len(open_tasks),
        "doneCount": len(tasks) - len(open_tasks),
        "boards": [
            {
                "name": board.get("name"),
                "columns": [column.get("name") for column in board.get("columns") or []],
                "tasks": len(board.get("tasks") or []),
            }
            for board in boards(ctx)
        ],
    }


def overdue_tasks(ctx: Context) -> ToolResult:
    reference = now(ctx)
    items = [
        task_row(task)
        for task in all_tasks(ctx)
        if not is_done(task)
        and (due := parse_dt(task.get("dueDate"))) is not None
        and due < reference
    ]
    items.sort(key=lambda row: str(row.get("dueDate")))
    return {"tool": "overdue_tasks", "count": len(items), "items": items[:12]}


def workload_by_assignee(ctx: Context) -> ToolResult:
    people: dict[str, dict[str, int]] = {}
    for task in all_tasks(ctx):
        if is_done(task):
            continue
        name = task.get("assignee") or "Unassigned"
        entry = people.setdefault(name, {"open": 0, "urgent": 0, "high": 0})
        entry["open"] += 1
        priority = str(task.get("priority") or "").upper()
        if priority == "URGENT":
            entry["urgent"] += 1
        elif priority == "HIGH":
            entry["high"] += 1
    ordered = sorted(people.items(), key=lambda item: item[1]["open"], reverse=True)
    return {
        "tool": "workload_by_assignee",
        "people": [{"name": name, **counts} for name, counts in ordered[:15]],
    }


def column_distribution(ctx: Context) -> ToolResult:
    rows: list[dict[str, Any]] = []
    for board in boards(ctx):
        columns = {column.get("id"): column.get("name") for column in board.get("columns") or []}
        counts: dict[str, int] = {name: 0 for name in columns.values()}
        for task in board.get("tasks") or []:
            name = columns.get(task.get("columnId")) or task.get("columnName") or "Unknown"
            counts[name] = counts.get(name, 0) + 1
        rows.append(
            {
                "board": board.get("name"),
                "columns": [{"name": name, "tasks": count} for name, count in counts.items()],
            }
        )
    return {"tool": "column_distribution", "boards": rows}


def priority_breakdown(ctx: Context) -> ToolResult:
    counts: dict[str, int] = {"URGENT": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for task in all_tasks(ctx):
        if is_done(task):
            continue
        priority = str(task.get("priority") or "MEDIUM").upper()
        counts[priority] = counts.get(priority, 0) + 1
    return {"tool": "priority_breakdown", "counts": counts}


def unassigned_tasks(ctx: Context) -> ToolResult:
    items = [task_row(task) for task in all_tasks(ctx) if not is_done(task) and not task.get("assignee")]
    return {"tool": "unassigned_tasks", "count": len(items), "items": items[:12]}


def recent_activity(ctx: Context) -> ToolResult:
    activity = ctx.get("activity") or []
    return {
        "tool": "recent_activity",
        "items": [
            {
                "user": entry.get("userName"),
                "action": entry.get("action"),
                "entityType": entry.get("entityType"),
                "details": entry.get("details"),
                "at": entry.get("createdAt"),
            }
            for entry in activity[:10]
        ],
    }


def search_tasks(ctx: Context, query: str) -> ToolResult:
    needle = query.strip().lower()
    items = [
        task_row(task)
        for task in all_tasks(ctx)
        if needle and needle in str(task.get("title", "")).lower()
    ]
    return {"tool": "search_tasks", "query": query, "count": len(items), "items": items[:12]}


def run_tools(question: str, ctx: Context) -> list[ToolResult]:
    """Keyword routing keeps the local fallback deterministic and explainable."""
    q = question.lower()
    results: list[ToolResult] = []

    def add(result: ToolResult) -> None:
        if all(existing["tool"] != result["tool"] for existing in results):
            results.append(result)

    if any(word in q for word in ("overdue", "late", "behind", "due")):
        add(overdue_tasks(ctx))
    if any(word in q for word in ("workload", "assignee", "assigned", "who", "owner", "capacity")):
        add(workload_by_assignee(ctx))
    if any(word in q for word in ("column", "wip", "progress", "stage", "board")):
        add(column_distribution(ctx))
    if any(word in q for word in ("priority", "urgent", "high priority")):
        add(priority_breakdown(ctx))
    if "unassigned" in q:
        add(unassigned_tasks(ctx))
    if any(word in q for word in ("activity", "recent", "happened", "history")):
        add(recent_activity(ctx))
    if any(word in q for word in ("search", "find", "look for")):
        marker = next((word for word in ("search", "find", "look for") if word in q), "search")
        add(search_tasks(ctx, question.split(marker, 1)[-1].strip(" :")))

    if not results or any(word in q for word in ("summary", "summarize", "stand-up", "standup", "status", "overview")):
        add(snapshot_summary(ctx))
        add(overdue_tasks(ctx))
        add(workload_by_assignee(ctx))
        add(column_distribution(ctx))

    return results


def build_answer(question: str, ctx: Context, results: list[ToolResult]) -> str:
    tenant = ctx.get("tenantName") or "this branch"
    sections: list[str] = []

    for result in results:
        tool = result["tool"]

        if tool == "snapshot_summary":
            sections.append(
                f"{tenant}: {result['boardCount']} board(s), {result['taskCount']} task(s) "
                f"({result['openCount']} open, {result['doneCount']} done)."
            )
        elif tool == "overdue_tasks":
            if result["count"] == 0:
                sections.append("Overdue: none. Everything is inside its due date.")
            else:
                lines = [
                    f"• {row['title']} — {row['assignee']}, due {str(row['dueDate'])[:10]} ({row['column']})"
                    for row in result["items"]
                ]
                sections.append(f"Overdue tasks ({result['count']}):\n" + "\n".join(lines))
        elif tool == "workload_by_assignee":
            if not result["people"]:
                sections.append("Workload: no open tasks are assigned yet.")
            else:
                lines = [
                    f"• {person['name']}: {person['open']} open"
                    + (f", {person['urgent']} urgent" if person["urgent"] else "")
                    + (f", {person['high']} high" if person["high"] else "")
                    for person in result["people"]
                ]
                sections.append("Open workload:\n" + "\n".join(lines))
        elif tool == "column_distribution":
            lines = []
            for board in result["boards"]:
                columns = ", ".join(f"{column['name']} {column['tasks']}" for column in board["columns"])
                lines.append(f"• {board['board']}: {columns}")
            sections.append("Column distribution:\n" + "\n".join(lines) if lines else "No boards yet.")
        elif tool == "priority_breakdown":
            counts = result["counts"]
            sections.append(
                f"Open priority mix: {counts.get('URGENT', 0)} urgent, {counts.get('HIGH', 0)} high, "
                f"{counts.get('MEDIUM', 0)} medium, {counts.get('LOW', 0)} low."
            )
        elif tool == "unassigned_tasks":
            if result["count"] == 0:
                sections.append("Unassigned: none — every open task has an owner.")
            else:
                lines = [f"• {row['title']} ({row['board']} / {row['column']})" for row in result["items"]]
                sections.append(f"Unassigned tasks ({result['count']}):\n" + "\n".join(lines))
        elif tool == "recent_activity":
            lines = [
                f"• {item['user']} {str(item['action']).lower()} {item['entityType']}"
                for item in result["items"]
            ]
            sections.append("Recent activity:\n" + "\n".join(lines) if lines else "No activity recorded yet.")
        elif tool == "search_tasks":
            if result["count"] == 0:
                sections.append(f"No tasks match “{result['query']}”.")
            else:
                lines = [
                    f"• {row['title']} — {row['assignee']} ({row['board']} / {row['column']})"
                    for row in result["items"]
                ]
                sections.append(f"Matches for “{result['query']}” ({result['count']}):\n" + "\n".join(lines))

    if not sections:
        return (
            f"I could not find anything relevant in {tenant} for that question. Try asking about "
            "overdue work, workload, columns, priorities or recent activity."
        )

    return "\n\n".join(sections)
