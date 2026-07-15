/// <reference types="node" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../../../..')

type WorkflowKind = 'worker' | 'pages' | 'prepared-entry' | 'rollback'

interface WorkflowFixture {
  readonly file: string
  readonly kind: WorkflowKind
  readonly surface?: 'dashboard' | 'auth' | 'blog' | 'movie' | 'comic'
  readonly workerConfig?: 'api_config_path' | 'gateway_config_path'
  readonly entry?: 'd1-migrate' | 'crawler-comic' | 'crawler-optimized' | 'crawler-actor' | 'crawler-publisher' | 'monthly-cleanup'
}

const workflows: readonly WorkflowFixture[] = [
  { file: 'deploy-api.yml', kind: 'worker', workerConfig: 'api_config_path' },
  { file: 'deploy-gateway.yml', kind: 'worker', workerConfig: 'gateway_config_path' },
  { file: 'deploy-api-after-pr.yml', kind: 'worker', workerConfig: 'api_config_path' },
  { file: 'deploy-dashboard.yml', kind: 'pages', surface: 'dashboard' },
  { file: 'deploy-auth.yml', kind: 'pages', surface: 'auth' },
  { file: 'deploy-blog.yml', kind: 'pages', surface: 'blog' },
  { file: 'deploy-movie.yml', kind: 'pages', surface: 'movie' },
  { file: 'deploy-comic.yml', kind: 'pages', surface: 'comic' },
  { file: 'deploy-migrations.yml', kind: 'prepared-entry', entry: 'd1-migrate' },
  { file: 'daily-manga-crawl.yml', kind: 'prepared-entry', entry: 'crawler-comic' },
  { file: 'daily-movie-crawl.yml', kind: 'prepared-entry', entry: 'crawler-optimized' },
  { file: 'daily-actor-crawl.yml', kind: 'prepared-entry', entry: 'crawler-actor' },
  { file: 'daily-publisher-crawl.yml', kind: 'prepared-entry', entry: 'crawler-publisher' },
  { file: 'rollback.yml', kind: 'rollback' },
  { file: 'monthly-cleanup.yml', kind: 'prepared-entry', entry: 'monthly-cleanup' },
]

async function workflowText(file: string): Promise<string> {
  return readFile(path.join(root, '.github', 'workflows', file), 'utf8')
}

function prepareCount(source: string): number {
  return (source.match(/^\s*- id: prepare$/gm) ?? []).length
}

function githubExpression(value: string): string {
  return '$' + `{{ ${value} }}`
}

describe('phase 12 workflow target contract', () => {
  it('keeps the full remote-mutation inventory explicit and resolver-gated', async () => {
    expect(workflows).toHaveLength(15)

    for (const workflow of workflows) {
      const source = await workflowText(workflow.file)

      expect(source, workflow.file).toMatch(/resolve-target:/)
      expect(source, workflow.file).toMatch(/STARYE_TARGET_ID: starye-org/)
      expect(source, workflow.file).toMatch(/target:\n\s+description:/)
      expect(source, workflow.file).toMatch(/required: true/)
      expect(source, workflow.file).toContain('pnpm target-profile validate --target "$target"')
      expect(source, workflow.file).toContain('github_environment=')
      expect(source, workflow.file).toContain('needs.resolve-target.outputs.github_environment')
      expect(source, workflow.file).toContain(`environment: ${githubExpression('needs.resolve-target.outputs.github_environment')}`)
      expect(source, workflow.file).toContain(`CLOUDFLARE_API_TOKEN: ${githubExpression('secrets.CLOUDFLARE_API_TOKEN')}`)
      expect(source, workflow.file).toContain(`CLOUDFLARE_ACCOUNT_ID: ${githubExpression('secrets.CLOUDFLARE_ACCOUNT_ID')}`)
      expect(prepareCount(source), workflow.file).toBe(workflow.kind === 'rollback' ? 2 : 1)
      expect(source, workflow.file).toContain('pnpm target-profile prepare-mutation --scope ci')
      expect(source, workflow.file).toContain(`--target "${githubExpression('needs.resolve-target.outputs.target')}"`)
      expect(source, workflow.file).toContain(`--ci-environment "${githubExpression('needs.resolve-target.outputs.github_environment')}"`)
      expect(source, workflow.file).toContain('if: always()')

      for (const forbidden of ['target-deploy', 'project-local', '--env-root', '--wrangler-profile', 'secrets[', '.dev.vars', 'source .env', 'wrangler pages project create', '|| true']) {
        expect(source, `${workflow.file}: ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('uses exact prepared outputs for worker deploys and closes Pages builds', async () => {
    for (const workflow of workflows.filter(item => item.kind === 'worker')) {
      const source = await workflowText(workflow.file)
      const config = workflow.workerConfig!
      expect(source, workflow.file).toContain(`--config "${githubExpression(`steps.prepare.outputs.${config}`)}"`)
      expect(source, workflow.file).not.toContain('run deploy')
    }

    for (const workflow of workflows.filter(item => item.kind === 'pages')) {
      const source = await workflowText(workflow.file)
      const surface = workflow.surface!
      expect(source, workflow.file).toContain(`--command pages-deploy --surface ${surface}`)
      expect(source, workflow.file).toContain(`pnpm target-profile run-pages-build --surface ${surface} --pages-build-env-path "${githubExpression('steps.prepare.outputs.pages_build_env_path')}"`)
      expect(source, workflow.file).toContain(`--project-name "${githubExpression('steps.prepare.outputs.pages_project')}"`)
      expect(source, workflow.file).not.toContain('--config')
      expect(source, workflow.file).not.toMatch(/\bVITE_|\bNUXT_PUBLIC_/)
      expect(source, workflow.file).not.toContain(githubExpression('secrets.STARYE_PUBLIC_'))
      expect(source, workflow.file).not.toMatch(/\b(?:cat|printenv)\b|run:\s*env\b/)

      const prepareStart = source.indexOf('- id: prepare')
      const prepareEnd = source.indexOf('- name: Build', prepareStart)
      const prepare = source.slice(prepareStart, prepareEnd)
      const outsidePrepare = `${source.slice(0, prepareStart)}${source.slice(prepareEnd)}`
      expect(prepare, workflow.file).toContain(`STARYE_PUBLIC_BUILD_MODE: ${githubExpression('vars.STARYE_PUBLIC_BUILD_MODE')}`)
      expect(prepare, workflow.file).toContain(`STARYE_PUBLIC_SENTRY_DSN: ${githubExpression('vars.STARYE_PUBLIC_SENTRY_DSN')}`)
      expect(prepare, workflow.file).toContain(`STARYE_PUBLIC_SENTRY_RELEASE: ${githubExpression('vars.STARYE_PUBLIC_SENTRY_RELEASE')}`)
      expect(outsidePrepare, workflow.file).not.toContain('STARYE_PUBLIC_')
      if (surface === 'movie') {
        expect(prepare).toContain(`STARYE_PUBLIC_FEATURE_ARIA2: ${githubExpression('vars.STARYE_PUBLIC_FEATURE_ARIA2')}`)
      }
      else {
        expect(prepare).not.toContain('STARYE_PUBLIC_FEATURE_')
      }
    }

    const blog = await workflowText('deploy-blog.yml')
    expect(blog).not.toContain('blog-pages')
    expect(blog).not.toContain('starye-blog')
  })

  it('routes every D1, crawler, and cleanup mutation through its fixed prepared entry', async () => {
    for (const workflow of workflows.filter(item => item.kind === 'prepared-entry')) {
      const source = await workflowText(workflow.file)
      expect(source, workflow.file).toContain(`pnpm target-profile run-prepared-entry --entry ${workflow.entry} --prepared-context "${githubExpression('steps.prepare.outputs.prepared_context_path')}"`)
      expect(source, workflow.file).not.toMatch(/wrangler\s+(?:d1|r2)\b/)
      expect(source, workflow.file).not.toMatch(/\brun\s+crawl:/)
      expect(source, workflow.file).not.toMatch(/\bAPI_URL:|\bR2_BUCKET_NAME:|\bD1_DB_NAME:/)
    }
  })

  it('keeps worker rollback prepared and Pages rollback fail-closed with a typed surface', async () => {
    const rollback = await workflowText('rollback.yml')

    expect(rollback).toContain('pages_surface:')
    expect(rollback).toContain(`--command pages-rollback --surface "${githubExpression('inputs.pages_surface')}"`)
    expect(rollback).toContain(`--config "${githubExpression('steps.prepare.outputs.api_config_path')}"`)
    expect(rollback).toContain(`--config "${githubExpression('steps.prepare.outputs.gateway_config_path')}"`)
    expect(rollback).toContain('steps.prepare.outputs.pages_project')
    expect(rollback).toContain('exit 1')
    expect(rollback).not.toMatch(/--name\s+starye-/)
    expect(rollback).not.toContain('RUNBOOK.md manual rollback')
  })

  it('keeps local API and gateway deploy wrappers target-forwarding rather than bare Wrangler deploys', async () => {
    for (const app of ['api', 'gateway']) {
      const packageJson = await readFile(path.join(root, 'apps', app, 'package.json'), 'utf8')
      const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> }
      const deploy = parsed.scripts?.deploy ?? ''

      expect(deploy).toContain('target-deploy')
      expect(deploy).toContain(`--app ${app}`)
      expect(deploy).not.toContain('wrangler deploy')
    }
  })
})
