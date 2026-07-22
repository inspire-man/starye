# API Coverage - Phase 13 Full-Chain Data Smoke

> Full coverage by default. This matrix records the Phase 13 selected-target
> data-chain smoke surface and its explicit, reasoned opt-outs. It contains no
> credential values or environment-file contents.

| capability | decision | reason |
|---|---|---|
| selected target identity and live preflight | INTEGRATE | Validate the explicit starye-org target identity and required read-only live resource checks before a remote smoke handoff. |
| one-item crawler smoke fixture | INTEGRATE | Run only the deterministic non-R18 fixture through the repository-owned handoff path. |
| D1 smoke snapshot | INTEGRATE | Correlate the one fixture to exactly one D1 row and its mode-owned item identifier. |
| canonical API correlation | INTEGRATE | Verify the selected canonical API returns the same code and identifier recorded by the D1 smoke snapshot. |
| local Dashboard and movie viewer evidence | INTEGRATE | Observe the local Dashboard then movie viewer in the ordered single-item data chain. |
| selected-production Dashboard and movie viewer evidence | INTEGRATE | Observe the production Dashboard then movie viewer only after the remote pending pair authorizes that final proof. |
| Worker deployment | OPT-OUT | Phase 13 is a smoke proof and explicitly forbids deploy commands. |
| Pages deployment | OPT-OUT | Phase 13 does not publish or alter Pages surfaces. |
| DNS changes | OPT-OUT | Domain and route changes are outside the immutable selected-target smoke contract. |
| D1 schema migration | OPT-OUT | The smoke verifies an existing row and never changes schema or migrations. |
| arbitrary D1 SQL repair | OPT-OUT | The fixed handoff owns the bounded snapshot; ad hoc database mutation is prohibited. |
| target rollback | OPT-OUT | No deployment occurs in Phase 13, so rollback is not part of this proof. |
| R2 cleanup | OPT-OUT | The phase does not upload or delete R2 objects. |
| bulk crawler ingestion | OPT-OUT | The contract permits one deterministic fixture only, not a batch or catalog crawl. |
| non-smoke crawler operations | OPT-OUT | Discovery, recrawls, and unrelated provider operations are outside the single-run evidence boundary. |
