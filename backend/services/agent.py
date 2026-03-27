# backend/services/agent.py
import json
import re
from datetime import datetime, timezone
from typing import AsyncGenerator

import httpx
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from backend.models import Request


def validate_request(request: Request) -> dict:
    issues = []
    if not re.match(r"^DE\d{9}$", request.vat_id or ""):
        issues.append(f"Invalid VAT ID format: {request.vat_id!r} (expected DE + 9 digits)")
    for field in ["requestor_name", "title", "vendor_name", "department"]:
        if not (getattr(request, field, None) or "").strip():
            issues.append(f"Missing required field: {field}")
    if not request.order_lines:
        issues.append("No order lines found")
    else:
        computed = round(sum(line.total_price for line in request.order_lines), 2)
        if abs(computed - round(request.total_cost, 2)) > 0.02:
            issues.append(
                f"Total cost mismatch: stated €{request.total_cost:.2f} vs computed €{computed:.2f}"
            )
    return {"valid": len(issues) == 0, "issues": issues}


def check_policy(request: Request, db: Session) -> dict:
    total = request.total_cost
    known = (
        db.query(Request)
        .filter(
            Request.vendor_name == request.vendor_name,
            Request.id != request.id,
            Request.status == "Closed",
        )
        .first()
        is not None
    )

    if total < 1000:
        tier = "auto_approve"
        tier_note = f"Total €{total:.2f} is under €1,000 — approvable without escalation."
    elif total <= 10000:
        tier = "review_required"
        tier_note = f"Total €{total:.2f} is between €1,000–€10,000 — procurement review required."
    else:
        tier = "escalation_required"
        tier_note = f"Total €{total:.2f} exceeds €10,000 — manager sign-off required."

    return {
        "tier": tier,
        "tier_note": tier_note,
        "vendor_known": known,
        "vendor_note": (
            "Vendor has prior approved requests on record."
            if known
            else "New vendor — no prior approved requests found."
        ),
    }


async def _extract_canonical_name(vendor_name: str) -> str:
    """Use GPT-4o to normalize a vendor name to its canonical company name for search."""
    try:
        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": (
                    f"You are helping identify a business vendor for a procurement system. "
                    f"Given this vendor name: '{vendor_name}', return the canonical company name "
                    "that would best identify it on Wikipedia or a business search. "
                    "Rules: keep or add a legal suffix (Inc, GmbH, AG, Corp, Ltd) if it removes ambiguity. "
                    "If the input is a well-known brand operating under a parent/full name, use that "
                    "(e.g. 'Saturn' the German electronics retailer → 'MediaMarktSaturn'). "
                    "Reply with ONLY the company name, nothing else. "
                    "Examples: 'Apple Business Team' → 'Apple Inc', "
                    "'Dell Technologies GmbH' → 'Dell Technologies', "
                    "'Saturn Electro' → 'MediaMarktSaturn', "
                    "'Random Unknown Co Ltd' → 'Random Unknown Co Ltd'."
                ),
            }],
            max_tokens=20,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return vendor_name


async def search_vendor(vendor_name: str) -> dict:
    # Step 1: normalize vendor name via GPT-4o
    canonical = await _extract_canonical_name(vendor_name)

    # Step 2: search DuckDuckGo with the canonical name
    try:
        async with httpx.AsyncClient(timeout=8.0) as http:
            resp = await http.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": canonical,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={"User-Agent": "procurement-agent/1.0"},
            )
            data = resp.json()
            abstract = data.get("AbstractText", "").strip()
            if abstract:
                # Ask GPT to verify the result is actually about a company
                client = AsyncOpenAI()
                check = await client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{
                        "role": "user",
                        "content": (
                            f"Does this text describe a company, business, or organisation? "
                            f"Reply with only YES or NO.\n\n{abstract[:300]}"
                        ),
                    }],
                    max_tokens=3,
                )
                is_company = check.choices[0].message.content.strip().upper().startswith("YES")
                if not is_company:
                    return {"found": False, "summary": f"No business information found for '{canonical}'."}
                return {"found": True, "summary": abstract[:500]}
            return {"found": False, "summary": f"No public information found for '{canonical}'."}
    except Exception as exc:
        return {"found": False, "summary": f"Vendor search unavailable: {exc}"}


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "validate_request",
            "description": "Validate VAT ID format, required fields presence, and order line arithmetic.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_policy",
            "description": "Check procurement policy thresholds and vendor approval history.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_vendor",
            "description": "Search for vendor information to verify legitimacy.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


async def run_agent(request_id: int, db: Session) -> AsyncGenerator[str, None]:
    request = db.query(Request).filter(Request.id == request_id).first()
    if not request:
        yield f"data: {json.dumps({'type': 'error', 'text': 'Request not found'})}\n\n"
        return

    lines_text = "\n".join(
        f"  - {l.description}: {l.quantity} x €{l.unit_price:.2f} = €{l.total_price:.2f}"
        for l in request.order_lines
    )

    system_prompt = f"""You are a procurement compliance agent. Review the following procurement request.

REQUEST:
- Requestor: {request.requestor_name}
- Title: {request.title}
- Vendor: {request.vendor_name}
- VAT ID: {request.vat_id}
- Department: {request.department}
- Commodity Group: {request.commodity_group_name} ({request.commodity_group_id})
- Total Cost: €{request.total_cost:.2f}
- Order Lines:
{lines_text}

INSTRUCTIONS:
1. Call validate_request to check field validity.
2. Call check_policy to apply procurement thresholds.
3. Call search_vendor to verify vendor legitimacy — SKIP this step if check_policy returned vendor_known=true, since the vendor is already verified from a prior approved request.
4. After all tool calls, produce your final recommendation.

Your final message MUST end with this JSON block (no other JSON in the message):
```json
{{"recommendation": "approve", "note": "Your 2-3 sentence justification."}}
```
Valid recommendation values: "approve", "review", "reject".
"""

    messages = [{"role": "system", "content": system_prompt}]
    client = AsyncOpenAI()

    for _ in range(8):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        msg = response.choices[0].message
        messages.append(msg)

        if not msg.tool_calls:
            content = msg.content or ""
            recommendation = "review"
            note = content[:500]
            json_match = re.search(r"```json\s*(\{.*?\})\s*```", content, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(1))
                    recommendation = parsed.get("recommendation", "review")
                    note = parsed.get("note", content[:300])
                except json.JSONDecodeError:
                    pass

            request.agent_recommendation = recommendation
            request.agent_note = note
            request.agent_ran_at = datetime.now(timezone.utc)
            db.commit()

            yield f"data: {json.dumps({'type': 'done', 'recommendation': recommendation, 'note': note})}\n\n"
            return

        tool_results = []
        for tool_call in msg.tool_calls:
            name = tool_call.function.name

            if name == "validate_request":
                result = validate_request(request)
                step = (
                    "✓ Fields validated — no issues found"
                    if result["valid"]
                    else f"⚠ Validation issues: {', '.join(result['issues'])}"
                )
            elif name == "check_policy":
                result = check_policy(request, db)
                step = f"✓ Policy: {result['tier_note']} {result['vendor_note']}"
            elif name == "search_vendor":
                result = await search_vendor(request.vendor_name)
                summary = result["summary"][:120]
                step = f"✓ Vendor: {summary}" if result["found"] else f"⚠ Vendor: {summary}"
            else:
                result = {"error": f"Unknown tool: {name}"}
                step = f"⚠ Unknown tool: {name}"

            yield f"data: {json.dumps({'type': 'step', 'text': step})}\n\n"
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

        messages.extend(tool_results)

    yield f"data: {json.dumps({'type': 'error', 'text': 'Agent did not complete — try again.'})}\n\n"
