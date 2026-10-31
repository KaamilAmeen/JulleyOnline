"""FastAPI entry point for the JulleyOnline read-only assistant.

The Node API authenticates the end user, builds a tenant-scoped snapshot and
forwards it here with a shared service token. This process has no database
credentials and no write endpoints, so a bug here cannot leak or mutate data.
"""

from __future__ import annotations

import os
import secrets
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import __version__
from .llm import ask_llm, llm_config
from .tools import build_answer, run_tools

load_dotenv()

SERVICE_TOKEN = (os.getenv("AI_SERVICE_TOKEN") or "").strip()


class AssistantContext(BaseModel):
    tenantId: str | None = None
    tenantName: str | None = None
    userId: str | None = None
    userName: str | None = None
    role: str | None = None
    now: str | None = None
    boards: list[dict[str, Any]] = Field(default_factory=list)
    activity: list[dict[str, Any]] = Field(default_factory=list)


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    context: AssistantContext = Field(default_factory=AssistantContext)


class QueryResponse(BaseModel):
    answer: str
    toolsUsed: list[str]
    provider: str
    model: str | None = None


app = FastAPI(
    title="JulleyOnline Assistant",
    version=__version__,
    description="Read-only analyst over a tenant snapshot supplied by the Node API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type", "x-service-token"],
)


def require_token(x_service_token: str | None) -> None:
    """Constant-time comparison so the shared token cannot be probed."""
    if not SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_SERVICE_TOKEN is not configured on the AI service.",
        )
    if not x_service_token or not secrets.compare_digest(x_service_token, SERVICE_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token.",
        )


@app.get("/health")
def health() -> dict[str, Any]:
    config = llm_config()
    return {
        "status": "ok",
        "version": __version__,
        "authConfigured": bool(SERVICE_TOKEN),
        "provider": "llm" if config else "deterministic",
        "model": config["model"] if config else None,
    }


@app.post("/assistant/query", response_model=QueryResponse)
def query(
    request: QueryRequest,
    x_service_token: str | None = Header(default=None),
) -> QueryResponse:
    require_token(x_service_token)

    question = request.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question cannot be blank.",
        )

    context = request.context.model_dump()
    results = run_tools(question, context)
    tools_used = [result["tool"] for result in results]

    llm_answer = ask_llm(question, context, results)
    if llm_answer is not None:
        answer, model = llm_answer
        return QueryResponse(
            answer=answer,
            toolsUsed=tools_used,
            provider="llm",
            model=model,
        )

    return QueryResponse(
        answer=build_answer(question, context, results),
        toolsUsed=tools_used,
        provider="deterministic",
    )


if __name__ == "__main__":  # pragma: no cover - convenience for `python -m app.main`
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
