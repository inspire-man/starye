# Design: Historical AI Candidate Navigation

## Component Contract

`QuantAiCandidateBriefing` receives an optional `currentCandidateCodes: string[]` prop. The component derives a `Set` for constant-time membership checks. An omitted or empty set means every historical code remains read-only.

The parent passes the codes from the current candidate snapshot. The existing `focusCandidate(tsCode)` emit remains the only navigation event, so the parent continues to own selection, data loading, and the detail drawer.

## Rendering Rules

For every historical candidate code:

1. If the code is in `currentCandidateCodes`, render a keyboard-accessible button and emit `focusCandidate` on activation.
2. Otherwise render a non-interactive code element with a stale/read-only state.

The rules apply consistently to:

- the historical session candidate-code list;
- historical briefing focus items;
- historical briefing cited candidate codes;
- historical question cited candidate codes.

Historical content stays separate from the current briefing and question result. Navigation only opens the current candidate detail; it does not mutate historical content or deterministic candidate state.

## Responsive And Accessibility

- Buttons use native `type="button"`, accessible labels, visible focus styles, and existing icon conventions.
- Code labels use `overflow-wrap: anywhere` and the historical citation list wraps at narrow widths.
- Stale codes remain readable and are not rendered as disabled buttons, so the distinction between actionable and unavailable historical references is clear.

## Verification

- Component tests cover current-code navigation and stale-code read-only rendering for all four historical reference surfaces.
- Run Quant focused tests, type-check, lint, build, and `git diff --check`.
- Validate the `/quant/#candidates` route through Gateway at desktop and 390px widths, including browser console errors and horizontal overflow.
