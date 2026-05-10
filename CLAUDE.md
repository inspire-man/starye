# CLAUDE.md

This file provides guidance for Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Starye is a personal full-stack monorepo built on Cloudflare Workers + D1 + Nuxt 3 + Vue 3 technology stack. It's a comprehensive content management and streaming platform focusing on adult comics/manga and movies, with authentication, admin dashboard, and search capabilities.

## Quick Start

### Essential Development Commands

```bash
# Install dependencies
pnpm install

# Development (recommended - cleans ports and starts all services)
pnpm dev:clean

# Manual development
pnpm dev                    # Start all services
pnpm dev --filter [app]     # Start specific app (e.g., dashboard, movie-app)

# Build and check
pnpm build                  # Build all applications
pnpm type-check             # Type checking across packages
pnpm lint                   # Code linting
pnpm test                   # Run tests
pnpm test:e2e               # Run E2E tests

# Utility scripts
pnpm clean:ports            # Clean occupied ports (3000, 3001, 3002, 3003, 5173, 8080, 8787)
pnpm check:services        # Check service status and port usage
```

### Local Development Setup

1. **Environment Configuration**
   ```bash
   cp .env.example .env.local
   ```
   Configure `VITE_API_URL=http://localhost:8080` and `NUXT_PUBLIC_API_URL=http://localhost:8080`

2. **Access URLs** (Must go through Gateway)
   - Dashboard: http://localhost:8080/dashboard/
   - Blog: http://localhost:8080/blog/
   - Movie App: http://localhost:8080/movie/
   - Comic App: http://localhost:8080/comic/
   - Auth: http://localhost:8080/auth/

   ❌ Incorrect: http://localhost:3000/comic/ (Cookie sharing issues)
   ✅ Correct: http://localhost:8080/comic/

## Project Structure

### Applications (apps/)

- **api/**: Core API Worker (Hono + Better Auth + D1)
  - REST API with OpenAPI 3.0 docs
  - Authentication middleware
  - Database integration
  - Port: 8787 (accessed via 8080)

- **auth/**: Authentication application (Nuxt 4)
  - GitHub login
  - Session management
  - Port: 3003

- **blog/**: Personal blog (Nuxt 4 + Markdown)
  - Article management
  - Shiki syntax highlighting
  - Port: 3002

- **comic-app/**: Comic/manga reader (Vue 3 + Vite)
  - Comic browsing
  - Reading progress tracking
  - Port: 3000

- **dashboard/**: Admin management (Vue 3 + Vite)
  - User management, R18 whitelist
  - Content CRUD operations
  - Actor/publisher management
  - Audit logging
  - Testing: Playwright E2E
  - Port: 5173

- **gateway/**: Reverse proxy worker
  - Traffic routing
  - Load balancing
  - Port: 8080

- **movie-app/**: Movie streaming (Vue 3 + Vite)
  - Movie browsing, playback sources
  - Favorites, search, recommendations
  - Testing: Comprehensive test suite
  - Port: 3001

### Packages (packages/)

- **api-types/**: Shared TypeScript types for API contracts
- **config/**: Shared ESLint, TS, Vitest configurations
- **crawler/**: Web scraping service
  - Node.js + Puppeteer + Cheerio + Sharp
  - JAV content crawling
  - Runs on GitHub Actions (UTC: 16:00 movie, 00:00 actor, 08:00 publisher)
- **db/**: Database schema and Drizzle ORM
- **locales/**: Internationalization resources
- **ui/**: Shared UI component library
  - Vue 3 + Tailwind CSS v4 + Radix Vue
  - Design system and animations

## Technology Stack

### Backend
- TypeScript (ESNext target)
- Cloudflare Workers (serverless)
- D1 Database (SQLite)
- Drizzle ORM
- Hono framework
- Better Auth (GitHub OAuth)
- AWS SDK for R2 storage

### Frontend
- Vue 3 (Composition API)
- Nuxt 4 (full-stack)
- Vite (build tool)
- TypeScript
- Tailwind CSS v4
- Pinia (state management)
- Vue Router
- Vue I18n

### Development Tools
- Turbo (build orchestration)
- ESLint + Husky
- Commitlint
- Vitest + Playwright
- Wrangler CLI

## Development Workflow

### 1. Normal Development
```bash
pnpm dev:clean  # Recommended - cleans ports and starts all
```

### 2. Debugging Issues

#### Port Conflicts
```bash
pnpm clean:ports      # Clean occupied ports
pnpm check:services   # Check status
```

#### Authentication Issues
- Ensure API and Gateway are running
- Access through Gateway only (`localhost:8080`)
- Check auth-client.ts apiUrl configuration

### 3. Component Development

#### Using Shared UI Components
```vue
<template>
  <Button variant="primary">Click me</Button>
</template>

<script setup lang="ts">
import { Button } from '@starye/ui'
</script>
```

#### API Integration
```ts
// In any app
const api = useApi()
const movies = await api.movies.list()
```

## Data Models

### Key Entities and Relationships

- **Actors**: Actor information with CRUD operations
- **Publishers**: Publisher information with CRUD operations  
- **Movies**: Movie data with many-to-many relationships to actors/publishers
- **Users**: User management with R18 whitelist control

### API Patterns
- RESTful endpoints with OpenAPI documentation
- Type-safe with Valibot validation
- Admin endpoints prefixed with `/admin/`
- Frontend endpoints at `/api/`

### Database Schema
- Drizzle ORM with TypeScript
- Migration management
- Relation tables for many-to-many relationships

## OpenSpec Integration

The project uses an OpenSpec workflow system in the `openspec/` directory:
- `specs/`: Active specifications
- `changes/`: Change proposals and implementations
- Archive of completed changes

## Deployment

- **Platform**: Cloudflare Workers + Pages
- **Database**: D1 (SQLite)
- **Storage**: R2 Object Storage
- **CDN**: Cloudflare Global Network

## Best Practices

### Code Style
- Use Composition API with `<script setup>`
- TypeScript for type safety
- ESLint + Prettier formatting
- Conventional commits (enforced by Husky)

### Performance
- Lazy load routes in Nuxt apps
- Use proper caching strategies
- Optimize image sizes with Sharp
- Implement proper error boundaries

### Security
- All auth goes through API Gateway
- Input validation with Valibot
- CORS policies properly configured
- R18 content access control

## Testing

### Unit Tests
- Vitest for all packages
- Use Vue Test Utils for components
- Mock external dependencies

### E2E Tests
- Playwright for dashboard and movie-app
- Test authentication flows
- Test CRUD operations
- Test responsive design

### Test Commands
```bash
pnpm test              # Run all tests
pnpm test:e2e          # Run E2E tests
pnpm test:unit         # Run unit tests only
```

## Common Issues and Solutions

### 1. Port Conflicts
Use `pnpm clean:ports` to clear occupied ports before starting.

### 2. Authentication Issues
- Always access through Gateway (`localhost:8080`)
- Check that API is running on port 8787
- Verify environment variables are set

### 3. Build Errors
- Run `pnpm build` to check all applications
- Check TypeScript errors with `pnpm type-check`
- Run `pnpm lint` for code issues

### 4. Database Issues
- Use scripts in `packages/db/scripts/`
- Check migrations are applied
- Verify D1 connection in Wrangler

## Crawler Development

### Running Crawlers
```bash
# Movie crawler
cd packages/crawler
node scripts/run-optimized.ts

# Actor crawler
node scripts/run-actor.ts

# Publisher crawler  
node scripts/run-publisher.ts
```

### Schedule
- Movie: UTC 16:00 (Beijing 00:00)
- Actor: UTC 00:00 (Beijing 08:00)
- Publisher: UTC 08:00 (Beijing 16:00)

### Debugging Crawlers
- Use `check-avatar-status.ts` to verify actor avatars
- Test with `test-single-movie.ts` for individual movies
- Monitor logs for anti-blocking issues

## Git Workflow

### Commit Conventions
```
feat: Add new feature
fix: Fix bug
docs: Documentation
style: Formatting
refactor: Code refactoring
perf: Performance optimization
test: Testing
build: Build system/dependencies
ci: CI/CD
chore: Other changes
```

### Branches
- `main`: Production branch
- Feature branches for new development
- Ensure all changes go through proper review process

## Environment Variables

Required in `.env.local`:
```env
VITE_API_URL=http://localhost:8080
NUXT_PUBLIC_API_URL=http://localhost:8080
```

Optional for production:
- Cloudflare environment variables
- Database credentials
- Storage credentials

## Contributing

1. Follow the established patterns
2. Write tests for new features
3. Update documentation as needed
4. Follow conventional commits
5. Run linting before committing

## Additional Resources

- [OpenAPI Documentation](http://localhost:8787/api/docs) (Scalar UI)
- [Playwright Test Results](test/e2e/)
- [Crawler Logs](packages/crawler/logs/)
- [Database Schema](packages/db/src/)