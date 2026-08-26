from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

CONTRACT_VERSION = "quant-akshare-v1"
PROVIDER_NAME = "akshare"
BridgeStatus = Literal["ready", "partial", "unavailable", "invalid"]


def observed_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class BridgeError:
    code: str
    message: str
    source: str | None = None


@dataclass(frozen=True)
class BridgeSource:
    adapter: str
    endpoints: list[str]
    formula_version: str


@dataclass(frozen=True)
class BridgeEvidence:
    key: str
    dimension: str
    label: str
    status: Literal["pass", "caution", "fail", "missing"]
    value: float | None
    threshold: str
    source: str
    observed_at: str | None
    formula_version: str
    detail: str


@dataclass(frozen=True)
class BridgeRequest:
    ts_code: str
    start_date: str | None = None
    end_date: str | None = None
    include_financials: bool = True


@dataclass
class BridgeResponse:
    schema_version: str = CONTRACT_VERSION
    provider: str = PROVIDER_NAME
    request_id: str = field(default_factory=lambda: uuid4().hex)
    ts_code: str = ""
    observed_at: str = field(default_factory=observed_now)
    status: BridgeStatus = "unavailable"
    source: BridgeSource = field(default_factory=lambda: BridgeSource("akshare-adapter-v1", [], "akshare-adapter-v1"))
    identity: dict[str, Any] = field(default_factory=dict)
    daily_bars: list[dict[str, Any]] = field(default_factory=list)
    financials: list[dict[str, Any]] = field(default_factory=list)
    evidence: list[BridgeEvidence] = field(default_factory=list)
    errors: list[BridgeError] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["source"] = asdict(self.source)
        result["evidence"] = [asdict(item) for item in self.evidence]
        result["errors"] = [asdict(item) for item in self.errors]
        return result
