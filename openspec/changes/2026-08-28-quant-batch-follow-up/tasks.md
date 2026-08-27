## 1. Batch follow-up behavior

- [x] 1.1 Add isolated single-candidate retry state transition and preserve successful/other candidate states; completion: retry pending/running/success/error behavior is deterministic and covered by focused tests.
- [x] 1.2 Add successful-result navigation through the existing detail loader; completion: comparison closes, selected stock changes, and authoritative research history loading is triggered.

## 2. Quant surface

- [x] 2.1 Render state-aware row actions with accessible labels and stable layout; completion: success shows view detail, failure shows retry, active states avoid duplicate actions, and long errors wrap.
- [x] 2.2 Add responsive/focus styles for the batch row action area; completion: desktop and 390px layouts have no horizontal overflow and controls remain keyboard reachable.

## 3. Verification

- [x] 3.1 Run focused Quant tests, type-check and build; completion: all affected checks pass.
- [x] 3.2 Run OpenSpec strict validation and GitNexus detect_changes; completion: change validates and only expected Quant symbols/flows are reported.
- [ ] 3.3 Verify the flow through `http://localhost:8080/quant/` at desktop and narrow viewport; completion: successful navigation and failed-item retry states are observable without console errors.
