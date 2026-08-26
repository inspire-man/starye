## 1. Specification and component behavior

- [x] 1.1 Add deterministic status/action/score strip to the AI summary panel and verify it remains present for empty, error and successful summary states.
- [x] 1.2 Replace label-only citation chips with report-backed citation rows and an explicit unknown-key state; verify values and provenance are read from report evidence.

## 2. Responsive presentation and tests

- [x] 2.1 Add citation formatting and narrow-width styles without changing the API contract; verify type-check, build and mobile layout.
- [x] 2.2 Add focused component or client tests for formatted values, missing citations and deterministic conclusion rendering.

## 3. Verification and delivery

- [x] 3.1 Run Quant tests, type-check, lint, build and OpenSpec strict validation.
- [x] 3.2 Run GitNexus detect_changes, Gateway/browser regression and inspect the final citation surface.
- [ ] 3.3 Commit, push, review PR Actions, merge after checks pass and verify post-merge deployment Actions.
