import type { TargetPagesSurface, TargetProfile } from './target-profile.schema'
import {
  parseTargetProfile,

  targetPagesSurfaceValues,

} from './target-profile.schema'

export interface PagesRedirectTemplate {
  readonly surface: TargetPagesSurface
  readonly lines: readonly string[]
}

const allowedPlaceholderValues = new Set(['directOrigin', 'gatewayUrl'])
const placeholderPattern = /\{\{([^{}]+)\}\}/g
const unsafeLineBreak = /[\r\n]/

const pagesRedirectTemplates: Readonly<Record<TargetPagesSurface, PagesRedirectTemplate>> = {
  dashboard: {
    surface: 'dashboard',
    lines: [
      '{{directOrigin}}/* {{gatewayUrl}}/dashboard/:splat 301!',
      '/* /index.html 200',
    ],
  },
  quant: {
    surface: 'quant',
    lines: [
      '{{directOrigin}}/* {{gatewayUrl}}/quant/:splat 301!',
      '/* /index.html 200',
    ],
  },
  auth: {
    surface: 'auth',
    lines: [
      '{{directOrigin}}/ {{gatewayUrl}}/auth/login 301!',
      '{{directOrigin}}/* {{gatewayUrl}}/auth/:splat 301!',
      '/* /index.html 200',
    ],
  },
  blog: {
    surface: 'blog',
    lines: [
      '{{directOrigin}}/* {{gatewayUrl}}/blog/:splat 301!',
      '/blog/* /blog/index.html 200',
    ],
  },
  movie: {
    surface: 'movie',
    lines: [
      '{{directOrigin}}/* {{gatewayUrl}}/movie/:splat 301!',
      '/* /index.html 200',
    ],
  },
  comic: {
    surface: 'comic',
    lines: [
      '{{directOrigin}}/* {{gatewayUrl}}/comic/:splat 301!',
      '/* /index.html 200',
    ],
  },
}

function isTargetPagesSurface(value: unknown): value is TargetPagesSurface {
  return typeof value === 'string' && (targetPagesSurfaceValues as readonly string[]).includes(value)
}

function assertSurface(surface: TargetPagesSurface): void {
  if (!isTargetPagesSurface(surface)) {
    throw new Error('Unknown Pages surface.')
  }
}

function assertTemplateLine(line: string): void {
  if (!line || line.trim() !== line || unsafeLineBreak.test(line)) {
    throw new Error('Pages redirect template contains unsafe line content.')
  }

  for (const match of line.matchAll(placeholderPattern)) {
    const placeholder = match[1]
    if (!placeholder || !allowedPlaceholderValues.has(placeholder)) {
      throw new Error('Pages redirect template contains an unknown placeholder.')
    }
  }

  const remainingSyntax = line.replace(placeholderPattern, '')
  if (remainingSyntax.includes('{{') || remainingSyntax.includes('}}')) {
    throw new Error('Pages redirect template contains unresolved placeholder syntax.')
  }
}

function hasExpectedTemplateLines(
  template: PagesRedirectTemplate,
  expected: PagesRedirectTemplate,
): boolean {
  return template.lines.length === expected.lines.length
    && template.lines.every((line, index) => line === expected.lines[index])
}

function assertTemplate(
  surface: TargetPagesSurface,
  template: PagesRedirectTemplate,
): void {
  if (template.surface !== surface) {
    throw new Error('Pages redirect template surface does not match the selected Pages surface.')
  }

  for (const line of template.lines) {
    assertTemplateLine(line)
  }

  if (!hasExpectedTemplateLines(template, pagesRedirectTemplates[surface])) {
    throw new Error('Pages redirect template does not match the selected Pages surface contract.')
  }
}

function renderTemplateLine(line: string, profile: TargetProfile, surface: TargetPagesSurface): string {
  const values = {
    directOrigin: profile.pages[surface].directOrigin,
    gatewayUrl: profile.urls.gateway,
  }
  const rendered = line.replace(placeholderPattern, (_, placeholder: string) => values[placeholder as keyof typeof values])

  if (rendered.includes('{{') || rendered.includes('}}')) {
    throw new Error('Pages redirect template rendered unresolved placeholder syntax.')
  }

  return rendered
}

function assertProfileOwnedOrigins(
  lines: readonly string[],
  profile: TargetProfile,
  surface: TargetPagesSurface,
): void {
  for (const line of lines.filter(candidate => candidate.endsWith(' 301!'))) {
    const [source, destination, status, ...extra] = line.split(' ')
    if (!source || !destination || status !== '301!' || extra.length > 0) {
      throw new Error('Pages redirect template rendered an invalid redirect line.')
    }

    const sourceOrigin = new URL(source).origin
    const destinationOrigin = new URL(destination).origin
    if (sourceOrigin !== profile.pages[surface].directOrigin || destinationOrigin !== profile.urls.gateway) {
      throw new Error('Pages redirect template rendered a non-profile origin.')
    }
  }
}

export function renderPagesRedirectTemplate(
  profile: TargetProfile,
  surface: TargetPagesSurface,
  template: PagesRedirectTemplate,
): string {
  assertSurface(surface)
  const resolvedProfile = parseTargetProfile(profile)
  assertTemplate(surface, template)

  const lines = template.lines.map(line => renderTemplateLine(line, resolvedProfile, surface))
  assertProfileOwnedOrigins(lines, resolvedProfile, surface)
  return `${lines.join('\n')}\n`
}

export function renderPagesRedirects(
  profile: TargetProfile,
  surface: TargetPagesSurface,
): string {
  assertSurface(surface)
  return renderPagesRedirectTemplate(profile, surface, pagesRedirectTemplates[surface])
}

export function parsePagesRedirectInput(
  profile: TargetProfile,
  surface: TargetPagesSurface,
  raw: string,
): string {
  const expected = renderPagesRedirects(profile, surface)
  if (raw !== expected) {
    throw new Error('Pages redirect input does not match the selected target profile.')
  }
  return raw
}
