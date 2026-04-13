---
name: starye-crawler-strategy
description: Scaffold and enforce Starye crawler architecture standards for a new data source strategy and parser.
metadata:
  author: AI
  version: "1.0"
---

# Starye Crawler Strategy Factory

When the user asks to implement a new crawler strategy or update an existing one for `packages/crawler`, follow this strict workflow.

## 1. Architectural Boundaries

- **Separation of Concerns**: A strategy MUST be divided into two pure layers:
  1. **Parsers (`src/crawlers/parsers/<name>-parser.ts`)**: Pure functions that take `Document` (using `happy-dom`) and return structured data. NO Puppeteer, NO network requests.
  2. **Strategy (`src/crawlers/<name>.strategy.ts`)**: Network fetching, pagination, rate-limiting, and dependency injection (like invoking `parser`).

## 2. Image Processing & Orama

- Extracted images MUST be piped through the `ImageProcessor` to construct thumbnail pipelines and upload to R2 before DB insertion.
- Any new searchable content returned by the crawler MUST ensure `Orama` indexing compatibility.

## 3. Mandatory Testing Pipeline

- NEVER write live network tests as your primary crawler test.
- MUST intercept network requests or download HTML samples into a local `fixtures` directory.
- Drive Vitest tests using raw HTML against the parser functions.
- Verify properties: Make sure dates are parsed, IDs match `schemas.ts` requirements, and relations are correctly formatted.
