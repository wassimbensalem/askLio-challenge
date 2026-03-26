# tests/test_requests.py
VALID_REQUEST = {
    "requestor_name": "John Doe",
    "title": "Adobe Creative Cloud",
    "vendor_name": "Adobe Systems",
    "vat_id": "DE123456789",
    "department": "Marketing",
    "commodity_group_id": "031",
    "commodity_group_name": "Software",
    "total_cost": 1500.0,
    "order_lines": [
        {
            "description": "Adobe Photoshop License",
            "unit_price": 150.0,
            "quantity": 10,
            "unit": "licenses",
            "total_price": 1500.0,
        }
    ],
}


def test_create_request(client):
    response = client.post("/requests", json=VALID_REQUEST)
    assert response.status_code == 200
    data = response.json()
    assert data["requestor_name"] == "John Doe"
    assert data["status"] == "Open"
    assert len(data["order_lines"]) == 1
    assert data["order_lines"][0]["description"] == "Adobe Photoshop License"
    assert data["status_history"] == []


def test_create_request_invalid_vat(client):
    payload = {**VALID_REQUEST, "vat_id": "INVALID123"}
    response = client.post("/requests", json=payload)
    assert response.status_code == 422


def test_get_requests_empty(client):
    response = client.get("/requests")
    assert response.status_code == 200
    assert response.json() == []


def test_get_requests_returns_created(client):
    client.post("/requests", json=VALID_REQUEST)
    response = client.get("/requests")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["vendor_name"] == "Adobe Systems"


def test_update_status_creates_history(client):
    create_resp = client.post("/requests", json=VALID_REQUEST)
    request_id = create_resp.json()["id"]

    response = client.patch(
        f"/requests/{request_id}/status", json={"status": "In Progress"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "In Progress"
    assert len(data["status_history"]) == 1
    assert data["status_history"][0]["old_status"] == "Open"
    assert data["status_history"][0]["new_status"] == "In Progress"


def test_update_status_multiple_changes(client):
    create_resp = client.post("/requests", json=VALID_REQUEST)
    request_id = create_resp.json()["id"]

    client.patch(f"/requests/{request_id}/status", json={"status": "In Progress"})
    response = client.patch(f"/requests/{request_id}/status", json={"status": "Closed"})

    data = response.json()
    assert data["status"] == "Closed"
    assert len(data["status_history"]) == 2


def test_update_status_invalid(client):
    create_resp = client.post("/requests", json=VALID_REQUEST)
    request_id = create_resp.json()["id"]
    response = client.patch(f"/requests/{request_id}/status", json={"status": "INVALID"})
    assert response.status_code == 422


def test_update_status_not_found(client):
    response = client.patch("/requests/999/status", json={"status": "Closed"})
    assert response.status_code == 404
