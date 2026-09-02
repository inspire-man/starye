---
name: starye-crawler-strategy
description: Design or update a Starye crawler source, parser, comic flow, source-availability probe, or crawler task-runner adapter while preserving source, transport, content, and persistence boundaries.
metadata:
  author: AI
  version: "2.1"
---

# Starye Crawler Development

Use this skill for changes under packages/crawler that add or modify a source strategy, parser, comic crawl flow, availability probe, search index flow, or crawler task-runner adapter.

## Choose the boundary first

- Metadata crawling lives in packages/crawler/src/strategies/, src/crawlers/, src/core/optimized-crawler.ts, and src/lib/.
- Manga crawling implements CrawlStrategy from src/lib/strategy.ts. Site92Hm owns navigation and parser coordination; ComicCrawler owns list/detail/chapter orchestration and API sync.
- Task-runner work crosses src/task-runner/local-runner.ts, runner-client.ts, template-adapters.ts, manga-adapter.ts, and operation-specific adapters. The runner is a lifecycle and signed-callback boundary, separate from a source strategy.
- Target selection, preflight, remote entry, and production mutation belong to starye-target-operations. Keep crawler logic focused on the operation it executes.

## Source and persistence invariants

1. Keep DOM parsing deterministic: a Document or HTML fixture enters a pure normalizer; navigation, retries, challenge detection, pagination, throttling, and browser state stay in the strategy layer.
2. Persist through the existing crawler API client and sync routes. Database writes remain in apps/api repositories/services so task identity, auth, and projections stay server-owned.
3. Apply ImageProcessor only to flows that explicitly require transformed or R2-backed media. Comic body images default to source URLs. Apply Orama changes only when the output participates in the search-index flow.
4. Carry taskId, runId, attempt, provider, target, source revision, policy version, and expected projection version through poll, claim, heartbeat, terminal event, observation, receipt, and readback.
5. For chapter completeness, capture the source snapshot before sync mutation. Normalize identity by slug and URL, retain duplicate source rows for findings, and separate source terminal state from crawler execution state.
6. For page availability, use the bounded API probe policy: HEAD, Range GET fallback, content-type/body-prefix checks, challenge detection, capped findings, redacted URL identity, revision-bound projection writes, and CAS/readback checks. HTTP status is one transport fact.

## Tests and evidence

- Parser coverage uses local HTML fixtures under src/strategies/__fixtures__, src/strategies/__tests__, or test/fixtures. Live source checks remain separate diagnostics.
- Strategy coverage injects browser/network boundaries and exercises pagination, relative URL normalization, empty/error pages, challenge pages, duplicate identities, and partial source results.
- Task-runner changes require focused tests under src/task-runner/__tests__. Shared snapshot or lifecycle changes retain movie and ordinary manga compatibility tests.
- Run the narrow test first, then pnpm --filter @starye/crawler run type-check. Cross-layer work adds API tests and pnpm --filter api run type-check.
- Local user-visible acceptance uses http://localhost:8080/...; app ports are diagnostic. Crawler and persistence acceptance also needs D1 authoritative readback. Playback or reading claims need the actual browser/media/image-consumer signal.

## Useful commands

    pnpm --filter @starye/crawler exec vitest run src/strategies/__tests__/TARGET.test.ts
    pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/TARGET.test.ts
    pnpm --filter @starye/crawler run type-check
    pnpm dev:clean

Before editing a shared code symbol, use GitNexus upstream impact analysis. Before committing, run GitNexus detect_changes with an explicit staged file allowlist and review affected flows.
