# tests/test_extract.py
from unittest.mock import AsyncMock, patch

MOCK_EXTRACTION = {
    "vendor_name": "Global Tech Solutions",
    "vat_id": "DE987654321",
    "department": "Creative Marketing Department",
    "order_lines": [
        {
            "description": "Adobe Photoshop License",
            "unit_price": 150.0,
            "quantity": 10,
            "unit": "licenses",
            "total_price": 1500.0,
        }
    ],
    "total_cost": 2100.0,
    "commodity_group_id": "031",
    "commodity_group_name": "Software",
}


def test_extract_returns_fields(client):
    with patch(
        "backend.routes.extract.extract_from_document", new_callable=AsyncMock
    ) as mock_extract:
        mock_extract.return_value = MOCK_EXTRACTION
        response = client.post(
            "/extract",
            files={"file": ("offer.pdf", b"%PDF-1.4 fake content", "application/pdf")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["vendor_name"] == "Global Tech Solutions"
    assert data["vat_id"] == "DE987654321"
    assert len(data["order_lines"]) == 1
    assert data["order_lines"][0]["description"] == "Adobe Photoshop License"


def test_extract_rejects_non_pdf(client):
    response = client.post(
        "/extract",
        files={"file": ("offer.txt", b"some text content", "text/plain")},
    )
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]
