# backend/services/ai.py
import io
import json
import os

import openai
import pdfplumber
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

COMMODITY_GROUPS = [
    ("001", "Accommodation Rentals", "General Services"),
    ("002", "Membership Fees", "General Services"),
    ("003", "Workplace Safety", "General Services"),
    ("004", "Consulting", "General Services"),
    ("005", "Financial Services", "General Services"),
    ("006", "Fleet Management", "General Services"),
    ("007", "Recruitment Services", "General Services"),
    ("008", "Professional Development", "General Services"),
    ("009", "Miscellaneous Services", "General Services"),
    ("010", "Insurance", "General Services"),
    ("011", "Electrical Engineering", "Facility Management"),
    ("012", "Facility Management Services", "Facility Management"),
    ("013", "Security", "Facility Management"),
    ("014", "Renovations", "Facility Management"),
    ("015", "Office Equipment", "Facility Management"),
    ("016", "Energy Management", "Facility Management"),
    ("017", "Maintenance", "Facility Management"),
    ("018", "Cafeteria and Kitchenettes", "Facility Management"),
    ("019", "Cleaning", "Facility Management"),
    ("020", "Audio and Visual Production", "Publishing Production"),
    ("021", "Books/Videos/CDs", "Publishing Production"),
    ("022", "Printing Costs", "Publishing Production"),
    ("023", "Software Development for Publishing", "Publishing Production"),
    ("024", "Material Costs", "Publishing Production"),
    ("025", "Shipping for Production", "Publishing Production"),
    ("026", "Digital Product Development", "Publishing Production"),
    ("027", "Pre-production", "Publishing Production"),
    ("028", "Post-production Costs", "Publishing Production"),
    ("029", "Hardware", "Information Technology"),
    ("030", "IT Services", "Information Technology"),
    ("031", "Software", "Information Technology"),
    ("032", "Courier, Express, and Postal Services", "Logistics"),
    ("033", "Warehousing and Material Handling", "Logistics"),
    ("034", "Transportation Logistics", "Logistics"),
    ("035", "Delivery Services", "Logistics"),
    ("036", "Advertising", "Marketing & Advertising"),
    ("037", "Outdoor Advertising", "Marketing & Advertising"),
    ("038", "Marketing Agencies", "Marketing & Advertising"),
    ("039", "Direct Mail", "Marketing & Advertising"),
    ("040", "Customer Communication", "Marketing & Advertising"),
    ("041", "Online Marketing", "Marketing & Advertising"),
    ("042", "Events", "Marketing & Advertising"),
    ("043", "Promotional Materials", "Marketing & Advertising"),
    ("044", "Warehouse and Operational Equipment", "Production"),
    ("045", "Production Machinery", "Production"),
    ("046", "Spare Parts", "Production"),
    ("047", "Internal Transportation", "Production"),
    ("048", "Production Materials", "Production"),
    ("049", "Consumables", "Production"),
    ("050", "Maintenance and Repairs", "Production"),
]

COMMODITY_GROUPS_TEXT = "\n".join(
    f"{cg[0]} - {cg[1]} ({cg[2]})" for cg in COMMODITY_GROUPS
)

EXTRACTION_PROMPT = """Extract all procurement information from the vendor document below.

Return a JSON object with EXACTLY this structure (use null for fields you cannot find):
{{
  "title": "string — a concise 3-8 word description of what is being purchased (e.g. 'Adobe Creative Cloud Annual License', 'Office Furniture Q1 2024'). Focus on the product/service, not the vendor name.",
  "vendor_name": "string or null",
  "vat_id": "string or null",
  "department": "string or null",
  "order_lines": [
    {{
      "description": "string",
      "unit_price": number,
      "quantity": number,
      "unit": "string (e.g. 'licenses', 'units', 'pieces')",
      "total_price": number
    }}
  ],
  "total_cost": number or null,
  "commodity_group_id": "string",
  "commodity_group_name": "string"
}}

Select the most appropriate commodity group from this list:
{commodity_groups}

Vendor document:
---
{document}
---"""


NL_EXTRACTION_PROMPT = """You are a procurement intake assistant. An employee has described a purchase request in plain language. Parse it into structured procurement data.

Return a JSON object with EXACTLY this structure (use null for fields you cannot determine):
{{
  "title": "concise 3-8 word title describing what is being purchased (e.g. 'MacBook Pro for Engineering Team')",
  "vendor_name": null,
  "vat_id": null,
  "department": "infer from context if mentioned (e.g. 'engineering', 'marketing') or null",
  "order_lines": [
    {{
      "description": "what is being purchased",
      "unit_price": estimated unit price as a number (use the budget to estimate; 0 if truly unknown),
      "quantity": number,
      "unit": "units or licenses or pieces etc",
      "total_price": unit_price * quantity
    }}
  ],
  "total_cost": sum of all order line total_prices,
  "commodity_group_id": "string",
  "commodity_group_name": "string"
}}

Rules:
- If a total budget is mentioned, use it to estimate unit prices. If only a total is given with no unit count, make one order line with that total.
- department: capitalise properly (e.g. "Engineering", "Marketing", "HR").
- Select the most appropriate commodity group from this list:
{commodity_groups}

Employee request:
---
{request_text}
---"""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


async def extract_from_document(file_bytes: bytes) -> dict:
    text = extract_text_from_pdf(file_bytes)
    if not text.strip():
        raise ValueError("PDF contains no extractable text. It may be a scanned image — please fill the form manually.")

    client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "You are a procurement data extraction assistant. Extract structured data from vendor documents and return valid JSON only.",
            },
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(
                    commodity_groups=COMMODITY_GROUPS_TEXT,
                    document=text,
                ),
            },
        ],
    )

    return json.loads(response.choices[0].message.content)


async def extract_from_text(request_text: str) -> dict:
    client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "You are a procurement intake assistant. Parse natural language purchase requests into structured JSON data.",
            },
            {
                "role": "user",
                "content": NL_EXTRACTION_PROMPT.format(
                    commodity_groups=COMMODITY_GROUPS_TEXT,
                    request_text=request_text,
                ),
            },
        ],
    )
    return json.loads(response.choices[0].message.content)
