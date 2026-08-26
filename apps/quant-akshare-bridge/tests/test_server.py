import json
import os
import threading
import unittest
from http.client import HTTPConnection
from unittest.mock import patch

from quant_akshare_bridge.contracts import BridgeRequest, BridgeResponse
from quant_akshare_bridge.server import BridgeHandler
from http.server import ThreadingHTTPServer


class ServerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_token = os.environ.get("QUANT_AKSHARE_BRIDGE_TOKEN")
        os.environ["QUANT_AKSHARE_BRIDGE_TOKEN"] = "bridge-test-token"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), BridgeHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        if self.previous_token is None:
            os.environ.pop("QUANT_AKSHARE_BRIDGE_TOKEN", None)
        else:
            os.environ["QUANT_AKSHARE_BRIDGE_TOKEN"] = self.previous_token

    def request(self, method: str, path: str, body: dict | None = None, token: str | None = "bridge-test-token"):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"
        connection.request(method, path, json.dumps(body).encode() if body is not None else None, headers)
        response = connection.getresponse()
        payload = json.loads(response.read())
        connection.close()
        return response.status, payload

    def test_health_does_not_require_or_expose_token(self) -> None:
        status, payload = self.request("GET", "/health", token=None)
        self.assertEqual(status, 200)
        self.assertEqual(payload["contract_version"], "quant-akshare-v1")
        self.assertNotIn("bridge-test-token", json.dumps(payload))

    def test_evidence_requires_token(self) -> None:
        status, payload = self.request("POST", "/v1/evidence", {"ts_code": "601899.SH"}, token=None)
        self.assertEqual(status, 401)
        self.assertEqual(payload["errors"][0]["code"], "BRIDGE_UNAUTHORIZED")

    def test_authenticated_evidence_returns_normalized_json(self) -> None:
        bridge_response = BridgeResponse(
            ts_code="601899.SH",
            status="partial",
            identity={"name": "紫金矿业"},
        )
        with patch("quant_akshare_bridge.server.collect_evidence", return_value=bridge_response) as collect:
            status, payload = self.request("POST", "/v1/evidence", {"ts_code": "601899.SH"})
        self.assertEqual(status, 200)
        self.assertEqual(payload["ts_code"], "601899.SH")
        self.assertEqual(payload["status"], "partial")
        self.assertEqual(payload["identity"], {"name": "紫金矿业"})
        collect.assert_called_once_with(BridgeRequest(ts_code="601899.SH", start_date=None, end_date=None, include_financials=True))

    def test_rejects_non_boolean_financial_switch(self) -> None:
        status, payload = self.request("POST", "/v1/evidence", {"ts_code": "601899.SH", "include_financials": "false"})
        self.assertEqual(status, 400)
        self.assertEqual(payload["errors"][0]["code"], "BRIDGE_INVALID_INPUT")

    def test_rejects_an_unbounded_date_range(self) -> None:
        status, payload = self.request("POST", "/v1/evidence", {
            "ts_code": "601899.SH",
            "start_date": "20150101",
            "end_date": "20260826",
        })
        self.assertEqual(status, 400)
        self.assertEqual(payload["errors"][0]["code"], "BRIDGE_INVALID_INPUT")


if __name__ == "__main__":
    unittest.main()
