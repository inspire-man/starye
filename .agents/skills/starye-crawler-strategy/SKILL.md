---
name: starye-crawler-strategy
description: Design or update a Starye crawler source, parser, comic flow, or crawler task-runner adapter while preserving source, transport, content, and persistence boundaries.
metadata:
  author: AI
  version: "2.0"
---

# Starye Crawler Development

Use this skill for changes under packages/crawler that add or modify a source strategy, parser, comic crawl flow, crawler adapter, or source-availability probe.

## Choose the boundary first

- Metadata crawling lives in packages/crawler/src/strategies/, src/crawlers/, src/core/optimized-crawler.ts, and src/lib/. Existing sources are mixed: some parse with page.evaluate, while others extract HTML through pure helpers such as javdb-parser.ts, javhk-parser.ts, and site-92hm-parser.ts.
- Manga crawling implements CrawlStrategy from src/lib/strategy.ts. Site92Hm owns navigation and parser coordination; ComicCrawler owns list/detail/chapter orchestration and API sync.
- Task-runner work crosses src/task-runner/local-runner.ts, runner-client.ts, template-adapters.ts, manga-adapter.ts, and the operation-specific adapters. The runner is a lifecycle and signed-callback boundary, distinct from a source strategy.

## Source and persistence rules

1. Keep DOM parsing deterministic: input is a Document or HTML fixture and output is normalized domain data. Navigation, retries, challenge detection, pagination, throttling, and browser state belong in the strategy layer.
2. Persist through the existing crawler API client and sync routes. Keep database writes in apps/api repositories/services so task identity, auth, and projections remain server-owned.
3. Apply ImageProcessor only to an asset flow that explicitly requires transformed or R2-backed media. Comic body images default to source URLs. Apply Orama changes only when the crawler output participates in the search-index flow.
4. A task-runner candidate carries a binding across taskId, runId, attempt, provider, target, source revision, policy version, and expected projection version. Preserve that binding through poll, claim, heartbeat, terminal event, observation, receipt, and readback.
5. For chapter completeness, store and compare the source snapshot before sync mutation. Normalize chapter identity by slug and URL, retain duplicate source rows for findings, and distinguish source terminal state from crawler execution state.
6. For chapter page availability, use the bounded probe policy already in the API domain: HEAD first, Range GET fallback, content-type and body-prefix checks, challenge detection, capped samples/findings, redacted URL identity, revision-bound projection writes, and CAS/readback checks. HTTP status alone is one transport fact.

## Tests and evidence

- Parser coverage uses local HTML fixtures under src/strategies/__fixtures__, src/strategies/__tests__, or test/fixtures. Fixture tests carry the primary parser signal; live source checks are separate diagnostics.
- Strategy coverage injects or mocks browser/network boundaries and exercises pagination, relative URL normalization, empty/error pages, challenge pages, duplicate identities, and partial source results.
- Task-runner changes require focused tests under src/task-runner/__tests__. Shared snapshot or lifecycle changes retain movie and ordinary manga compatibility tests before the new comic operation is accepted.
- Run the narrow test first, then pnpm --filter @starye/crawler run type-check. For cross-layer work, add pnpm --filter api run type-check and the relevant API tests.
- Local user-visible acceptance uses the canonical Gateway http://localhost:8080/...; app ports are diagnostic. Crawler and persistence acceptance also needs D1 authoritative readback. Playback or reading claims need the actual browser/media or image-consumer signal.

## Useful commands

    pnpm --filter @starye/crawler exec vitest run src/strategies/__tests__/TARGET.test.ts
    pnpm --filter @starye/crawler exec vitest run src/task-runner/__tests__/TARGET.test.ts
    pnpm --filter @starye/crawler run type-check
    pnpm dev:clean

Before editing a shared symbol, use the repository GitNexus impact workflow. Before a commit, run gitnexus_detect_changes with an explicit staged file allowlist and review the affected flows.
