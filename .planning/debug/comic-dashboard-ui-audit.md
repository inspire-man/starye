---
status: investigating
trigger: Browser acceptance found Comic SFW visibility, responsive Dashboard UI, settings defaults, mapping report state, navigation, player error handling, and router warnings issues.
created: 2026-08-16
updated: 2026-08-16
---

# Debug: Comic Dashboard UI Audit

## Symptoms

- Comic accounts marked SFW still receive R18 comics from the public list.
- Dashboard crawler table rows become excessively tall on mobile.
- Audit log detail drawer overflows horizontally on mobile.
- TorrServer has no persisted default address and only shows placeholder text.
- Mapping quality report shows `40 / D` when there is no mapping data.
- Mapping-related pages are not reachable from the sidebar.
- Movie player exposes a raw English 404 error.
- Movie, Comic, and Dashboard emit Vue Router `next()` deprecation warnings.
- Crawler monitor briefly renders an empty state while data is loading.

## Hypotheses

- Public adult filtering allows admin roles to bypass `isR18Verified`, while Comic detail and chapter routes use the account verification flag.
- Shared table and drawer responsive rules do not constrain intrinsic content widths at narrow viewports.
- Settings, report, navigation, player, and router issues are local page contracts rather than a database migration concern.

## Next actions

- Run GitNexus upstream impact for every edited runtime symbol.
- Repair the API visibility contract and add regression coverage.
- Repair shared responsive primitives before page-specific overrides.
- Add explicit loading, empty, error, and navigation states.
- Verify through the Gateway at `http://localhost:8080` on desktop and mobile viewports.
