from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .adapter import akshare_available, collect_evidence
from .contracts import CONTRACT_VERSION, BridgeRequest
from .normalizer import normalize_date, normalize_ts_code


def _json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _error(code: str, message: str) -> dict[str, Any]:
    return {"schema_version": CONTRACT_VERSION, "provider": "akshare", "status": "invalid", "errors": [{"code": code, "message": message}]}


def _token_valid(handler: BaseHTTPRequestHandler) -> bool:
    expected = os.environ.get("QUANT_AKSHARE_BRIDGE_TOKEN", "").strip()
    supplied = handler.headers.get("Authorization", "")
    return bool(expected and supplied == f"Bearer {expected}")


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "StaryeQuantAkShareBridge/1"

    def log_message(self, _format: str, *_args: Any) -> None:
        return

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = _json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._send(HTTPStatus.NOT_FOUND, _error("NOT_FOUND", "route not found"))
            return
        self._send(HTTPStatus.OK, {
            "status": "ok",
            "contract_version": CONTRACT_VERSION,
            "akshare_available": akshare_available(),
        })

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/evidence":
            self._send(HTTPStatus.NOT_FOUND, _error("NOT_FOUND", "route not found"))
            return
        if not _token_valid(self):
            self._send(HTTPStatus.UNAUTHORIZED, _error("BRIDGE_UNAUTHORIZED", "bridge token is invalid"))
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384:
                raise ValueError("request body is too large")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("request body must be an object")
            ts_code = normalize_ts_code(str(body.get("ts_code", "")))
            start_date = normalize_date(body.get("start_date"), "start_date")
            end_date = normalize_date(body.get("end_date"), "end_date")
            if start_date and end_date and start_date > end_date:
                raise ValueError("start_date must not be after end_date")
            include_financials = body.get("include_financials", True)
            if not isinstance(include_financials, bool):
                raise ValueError("include_financials must be a boolean")
            request = BridgeRequest(
                ts_code=ts_code,
                start_date=start_date,
                end_date=end_date,
                include_financials=include_financials,
            )
            response = collect_evidence(request)
            self._send(HTTPStatus.OK, response.to_dict())
        except ValueError as error:
            self._send(HTTPStatus.BAD_REQUEST, _error("BRIDGE_INVALID_INPUT", str(error)))
        except RuntimeError:
            self._send(HTTPStatus.SERVICE_UNAVAILABLE, _error("AKSHARE_NOT_INSTALLED", "AkShare is not installed"))
        except Exception:
            self._send(HTTPStatus.BAD_GATEWAY, _error("AKSHARE_UPSTREAM_ERROR", "AkShare bridge upstream request failed"))


def serve(host: str | None = None, port: int | None = None) -> None:
    bind_host = host or os.environ.get("QUANT_AKSHARE_BRIDGE_HOST", "127.0.0.1")
    bind_port = port if port is not None else int(os.environ.get("QUANT_AKSHARE_BRIDGE_PORT", "8091"))
    server = ThreadingHTTPServer((bind_host, bind_port), BridgeHandler)
    print(f"Quant AkShare bridge listening on http://{bind_host}:{bind_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    serve()
