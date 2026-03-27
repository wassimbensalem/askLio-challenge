# tests/test_agent.py
import pytest
from tests.conftest import TestingSessionLocal
from backend import models
from backend.services.agent import validate_request
from backend.models import Request, OrderLine


def test_request_has_agent_fields(setup_db):
    from datetime import datetime, timezone
    db = TestingSessionLocal()
    req = models.Request(
        requestor_name="Test User",
        title="Test",
        vendor_name="Acme GmbH",
        vat_id="DE123456789",
        department="IT",
        commodity_group_id="031",
        commodity_group_name="Software",
        total_cost=500.0,
        status="Open",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    # defaults are None
    assert req.agent_recommendation is None
    assert req.agent_note is None
    assert req.agent_ran_at is None

    # write and read back
    now = datetime.now(timezone.utc).replace(microsecond=0)
    req.agent_recommendation = "approve"
    req.agent_note = "All checks passed."
    req.agent_ran_at = now
    db.commit()
    db.refresh(req)
    assert req.agent_recommendation == "approve"
    assert req.agent_note == "All checks passed."
    assert req.agent_ran_at is not None
    db.close()


def _make_request(db, **overrides):
    defaults = dict(
        requestor_name="Anna Schmidt",
        title="MacBook Pro x5",
        vendor_name="Apple GmbH",
        vat_id="DE123456789",
        department="IT",
        commodity_group_id="031",
        commodity_group_name="Software",
        total_cost=10000.0,
        status="Open",
    )
    defaults.update(overrides)
    req = Request(**defaults)
    db.add(req)
    db.flush()
    db.add(OrderLine(
        request_id=req.id,
        description="MacBook Pro 14",
        unit_price=2000.0,
        quantity=5,
        unit="units",
        total_price=10000.0,
    ))
    db.commit()
    db.refresh(req)
    return req


def test_validate_request_valid(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db)
    result = validate_request(req)
    assert result["valid"] is True
    assert result["issues"] == []
    db.close()


def test_validate_request_bad_vat(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db, vat_id="INVALID")
    result = validate_request(req)
    assert result["valid"] is False
    assert any("VAT" in i for i in result["issues"])
    db.close()


def test_validate_request_total_mismatch(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db, total_cost=9999.0)  # lines sum to 10000
    result = validate_request(req)
    assert result["valid"] is False
    assert any("mismatch" in i for i in result["issues"])
    db.close()


from backend.services.agent import check_policy


def test_policy_under_1000(setup_db):
    db = TestingSessionLocal()
    # check_policy only reads request.total_cost, not order lines
    req = _make_request(db, total_cost=500.0, vendor_name="NewVendor GmbH")
    result = check_policy(req, db)
    assert result["tier"] == "auto_approve"
    assert result["vendor_known"] is False
    db.close()


def test_policy_between_1000_and_10000(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db, total_cost=5000.0)
    result = check_policy(req, db)
    assert result["tier"] == "review_required"
    db.close()


def test_policy_over_10000(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db, total_cost=15000.0)
    result = check_policy(req, db)
    assert result["tier"] == "escalation_required"
    db.close()


def test_policy_known_vendor(setup_db):
    db = TestingSessionLocal()
    # create a prior closed request from same vendor
    prior = _make_request(db, vendor_name="KnownCorp GmbH")
    prior.status = "Closed"
    db.commit()
    req = _make_request(db, vendor_name="KnownCorp GmbH")
    result = check_policy(req, db)
    assert result["vendor_known"] is True
    db.close()


import json
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.agent import search_vendor


def _mock_openai_name(canonical: str):
    """Helper: mock AsyncOpenAI to return a canonical name from _extract_canonical_name."""
    mock_choice = MagicMock()
    mock_choice.message.content = canonical
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]
    return mock_completion


@pytest.mark.asyncio
async def test_search_vendor_found():
    # GPT-4o normalizes name, DuckDuckGo finds the company, GPT confirms it's a company
    mock_ddg = AsyncMock()
    mock_ddg.json = lambda: {
        "AbstractText": "Apple Inc. is an American multinational technology company.",
    }
    with patch("backend.services.agent.AsyncOpenAI") as MockOpenAI, \
         patch("httpx.AsyncClient") as MockClient:
        # First call: name normalization → "Apple Inc"
        # Second call: company validation → "YES"
        MockOpenAI.return_value.chat.completions.create = AsyncMock(
            side_effect=[_mock_openai_name("Apple Inc"), _mock_openai_name("YES")]
        )
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_ddg)
        result = await search_vendor("Apple Business Team")
    assert result["found"] is True
    assert "Apple" in result["summary"]


@pytest.mark.asyncio
async def test_search_vendor_not_found():
    # GPT-4o normalizes name, DuckDuckGo finds nothing → genuinely unknown
    mock_ddg = AsyncMock()
    mock_ddg.json = lambda: {"AbstractText": ""}
    with patch("backend.services.agent.AsyncOpenAI") as MockOpenAI, \
         patch("httpx.AsyncClient") as MockClient:
        MockOpenAI.return_value.chat.completions.create = AsyncMock(
            return_value=_mock_openai_name("XYZ Unknown Co")
        )
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_ddg)
        result = await search_vendor("XYZ Unknown Co Ltd")
    assert result["found"] is False


@pytest.mark.asyncio
async def test_search_vendor_network_error():
    # DuckDuckGo network failure → found=False, unavailable message
    with patch("backend.services.agent.AsyncOpenAI") as MockOpenAI, \
         patch("httpx.AsyncClient") as MockClient:
        MockOpenAI.return_value.chat.completions.create = AsyncMock(
            return_value=_mock_openai_name("SomeVendor")
        )
        MockClient.return_value.__aenter__.return_value.get = AsyncMock(
            side_effect=httpx.ConnectError("timeout")
        )
        result = await search_vendor("SomeVendor GmbH")
    assert result["found"] is False
    assert "unavailable" in result["summary"]


from backend.services.agent import run_agent


@pytest.mark.asyncio
async def test_run_agent_streams_done_event(setup_db):
    db = TestingSessionLocal()
    req = _make_request(db)

    mock_choice = MagicMock()
    mock_choice.message.tool_calls = None
    mock_choice.message.content = (
        'Review complete.\n```json\n{"recommendation": "approve", "note": "All checks passed."}\n```'
    )
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]

    with patch("backend.services.agent.AsyncOpenAI") as MockOpenAI:
        MockOpenAI.return_value.chat.completions.create = AsyncMock(return_value=mock_completion)
        events = []
        async for chunk in run_agent(req.id, db):
            events.append(json.loads(chunk.removeprefix("data: ").strip()))

    done_events = [e for e in events if e["type"] == "done"]
    assert len(done_events) == 1
    assert done_events[0]["recommendation"] == "approve"
    db.refresh(req)
    assert req.agent_recommendation == "approve"
    assert req.agent_note == "All checks passed."
    db.close()


@pytest.mark.asyncio
async def test_run_agent_404(setup_db):
    db = TestingSessionLocal()
    events = []
    async for chunk in run_agent(99999, db):
        events.append(json.loads(chunk.removeprefix("data: ").strip()))
    assert events[0]["type"] == "error"
    db.close()


async def _mock_run_agent(request_id, db):
    yield f"data: {json.dumps({'type': 'step', 'text': '✓ Fields validated'})}\n\n"
    yield f"data: {json.dumps({'type': 'done', 'recommendation': 'approve', 'note': 'All good.'})}\n\n"


def test_agent_route_streams(client, setup_db):
    payload = {
        "requestor_name": "Anna",
        "title": "Laptops",
        "vendor_name": "Dell GmbH",
        "vat_id": "DE123456789",
        "department": "IT",
        "commodity_group_id": "031",
        "commodity_group_name": "Software",
        "total_cost": 500.0,
        "order_lines": [{"description": "Laptop", "unit_price": 500.0, "quantity": 1, "unit": "units", "total_price": 500.0}],
    }
    created = client.post("/requests", json=payload).json()
    request_id = created["id"]

    with patch("backend.routes.agent.run_agent", side_effect=_mock_run_agent):
        response = client.post(f"/requests/{request_id}/agent")

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = [l for l in response.text.split("\n") if l.startswith("data: ")]
    assert len(lines) == 2
    done = json.loads(lines[1].removeprefix("data: "))
    assert done["recommendation"] == "approve"


def test_agent_route_404(client, setup_db):
    with patch("backend.routes.agent.run_agent", side_effect=_mock_run_agent):
        response = client.post("/requests/99999/agent")
    assert response.status_code == 404
