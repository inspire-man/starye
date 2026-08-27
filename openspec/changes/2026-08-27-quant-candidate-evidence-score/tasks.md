## 1. Evidence model

- [x] 1.1 Add a pure candidate evidence-readiness module with five fixed dimensions, finite raw metric coverage, bounded score, explicit unavailable/missing states and gap details.
- [x] 1.2 Add focused tests for complete, partial, missing, unloaded, pending-sync and non-finite metric inputs.

## 2. Candidate research surface

- [x] 2.1 Add evidence-readiness sorting to the existing candidate query without changing other sort semantics.
- [x] 2.2 Connect the loaded value-quality map and render the evidence-readiness column plus summary counts.
- [x] 2.3 Add clear tooltips, labels and responsive styles that keep evidence readiness separate from quality and trading decisions.

## 3. Verification and delivery

- [x] 3.1 Run Quant tests, type-check, lint and build; run OpenSpec strict validation.
- [x] 3.2 Run GitNexus detect_changes and Gateway/browser regression for loaded and responsive states; unloaded/error semantics are covered by focused unit tests.
- [ ] 3.3 Commit, push, review PR Actions, merge after checks pass and verify post-merge workflow results.
