import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..')
const crawlerRoot = path.join(repositoryRoot, 'packages/crawler')
const trackedEntries = [
  'scripts/target-crawl-mutation.ts',
  'scripts/check-config.ts',
  'scripts/backfill-covers.ts',
  'scripts/backfill-publishers.ts',
  'scripts/build-search.ts',
  'scripts/run-optimized.ts',
  'scripts/run-actor.ts',
  'scripts/run-publisher.ts',
  'scripts/audit-r2-storage.ts',
  'scripts/configure-user-permissions.ts',
  'scripts/test-api.ts',
  'scripts/test-api-auth.ts',
  'scripts/test-full-flow.ts',
  'scripts/test-image-upload.ts',
  'scripts/test-movie-sync.ts',
  'scripts/test-r2-mapping-storage.ts',
  'scripts/test-real-movie-sync.ts',
  'scripts/test-single-movie.ts',
  'scripts/verify-data-integrity.ts',
  'scripts/verify-r2-upload.ts',
  'src/index.ts',
  'src/scripts/enrich-players.ts',
  'src/scripts/enrich-players-javbus.ts',
] as const

const directEntryClassifications = {
  'scripts/target-crawl-mutation.ts': 'registry-child',
  'scripts/check-config.ts': 'blocked-import-only',
  'scripts/backfill-covers.ts': 'blocked-import-only',
  'scripts/backfill-publishers.ts': 'blocked-import-only',
  'scripts/build-search.ts': 'blocked-import-only',
  'scripts/run-optimized.ts': 'blocked-import-only',
  'scripts/run-actor.ts': 'blocked-import-only',
  'scripts/run-publisher.ts': 'blocked-import-only',
  'scripts/configure-user-permissions.ts': 'blocked-import-only',
  'scripts/test-api.ts': 'blocked-import-only',
  'scripts/test-api-auth.ts': 'blocked-import-only',
  'scripts/test-full-flow.ts': 'blocked-import-only',
  'scripts/test-image-upload.ts': 'blocked-import-only',
  'scripts/test-movie-sync.ts': 'blocked-import-only',
  'scripts/test-r2-mapping-storage.ts': 'blocked-import-only',
  'scripts/test-real-movie-sync.ts': 'blocked-import-only',
  'scripts/test-single-movie.ts': 'blocked-import-only',
  'scripts/verify-data-integrity.ts': 'blocked-import-only',
  'scripts/verify-r2-upload.ts': 'blocked-import-only',
  'scripts/debug-javbus-magnet.ts': 'blocked-import-only',
  'scripts/diagnose-seesaawiki-parser.ts': 'blocked-import-only',
  'src/scripts/enrich-players.ts': 'blocked-import-only',
  'src/scripts/enrich-players-javbus.ts': 'blocked-import-only',
  'src/scripts/crawl-seesaawiki-index.ts': 'blocked-import-only',
} as const

function crawlerProgram(): ts.Program {
  const configPath = path.join(crawlerRoot, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  const roots = ts.sys.readDirectory(crawlerRoot, ['.ts'], ['node_modules', 'dist', 'coverage'], ['**/*'])
    .filter(file => !/\/(?:test|__tests__)\//.test(file.replaceAll('\\', '/')))
  return ts.createProgram({ rootNames: roots, options: parsed.options })
}

function importedSinkNames(checker: ts.TypeChecker, source: ts.SourceFile): string[] {
  const names: string[] = []
  source.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings))
      return
    for (const element of node.importClause.namedBindings.elements) {
      const symbol = checker.getSymbolAtLocation(element.name)
      const resolved = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      if (resolved?.name === 'ImageProcessor' || resolved?.name === 'ApiClient')
        names.push(resolved.name)
    }
  })
  return names
}

function hasDirectProcessArgvDispatch(source: ts.SourceFile): boolean {
  return source.statements.some((statement) => {
    if (!ts.isIfStatement(statement))
      return false
    return statement.expression.getText(source).includes('process.argv')
  })
}

function findSourceFile(program: ts.Program, filePath: string): ts.SourceFile {
  const normalized = normalizeFixturePath(filePath)
  const source = program.getSourceFiles().find(candidate => normalizeFixturePath(candidate.fileName) === normalized)
  if (!source)
    throw new Error(`Missing fixture source: ${filePath}`)
  return source
}

function normalizeFixturePath(filePath: string): string {
  return path.normalize(filePath).replaceAll('\\', '/').toLowerCase()
}

describe('crawler source entry contract', () => {
  it('builds a TypeChecker program for all crawler sources and closes each tracked direct entry', async () => {
    const program = crawlerProgram()
    const checker = program.getTypeChecker()
    expect(program.getRootFileNames().length).toBeGreaterThan(20)

    const directCandidates = program.getRootFileNames().flatMap((filePath) => {
      const source = program.getSourceFile(filePath)
      if (!source || !hasDirectProcessArgvDispatch(source))
        return []
      return [path.relative(crawlerRoot, filePath).replaceAll('\\', '/')]
    }).sort()
    expect(directCandidates).toEqual(Object.keys(directEntryClassifications).sort())

    for (const relativePath of trackedEntries) {
      const filePath = path.join(crawlerRoot, relativePath)
      const source = program.getSourceFile(filePath)
      expect(source, relativePath).toBeDefined()
      const text = await readFile(filePath, 'utf8')
      expect(text, relativePath).not.toMatch(/dotenv\/config|process\.env\.(?:API_URL|CRAWLER_SECRET|CLOUDFLARE_|R2_|DATABASE_|STARYE_TARGET_ID)/)
      if (relativePath !== 'scripts/target-crawl-mutation.ts')
        expect(importedSinkNames(checker, source!)).toEqual([])
    }
    expect(Object.values(directEntryClassifications).every(classification =>
      ['registry-child', 'prepared-remote-operation', 'blocked-import-only', 'local-or-external-only'].includes(classification),
    )).toBe(true)
  }, 30_000)

  it('resolves an aliased ImageProcessor export and rejects it as a direct sink', () => {
    const fixtureDirectory = path.join(repositoryRoot, '.target-runs', 'crawler-source-fixture')
    const sourcePaths = {
      sink: path.join(fixtureDirectory, 'sink.ts'),
      barrel: path.join(fixtureDirectory, 'barrel.ts'),
      entry: path.join(fixtureDirectory, 'entry.ts'),
    }
    const files = new Map<string, string>([
      [sourcePaths.sink, 'export class ImageProcessor {}'],
      [sourcePaths.barrel, 'export { ImageProcessor as AssetSink } from \'./sink\''],
      [sourcePaths.entry, 'import { AssetSink } from \'./barrel\'; new AssetSink()'],
    ])
    const normalizedFiles = new Map([...files].map(([fileName, text]) => [normalizeFixturePath(fileName), text]))
    const host = ts.createCompilerHost({ module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler })
    host.fileExists = fileName => normalizedFiles.has(normalizeFixturePath(fileName)) || ts.sys.fileExists(fileName)
    host.readFile = fileName => normalizedFiles.get(normalizeFixturePath(fileName)) ?? ts.sys.readFile(fileName)
    host.getSourceFile = (fileName, languageVersion) => {
      const text = normalizedFiles.get(normalizeFixturePath(fileName)) ?? ts.sys.readFile(fileName)
      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true)
    }
    host.resolveModuleNames = (moduleNames, containingFile) => moduleNames.map((moduleName) => {
      const fixture = path.resolve(path.dirname(containingFile), `${moduleName.replace(/^\.\//, '')}.ts`)
      if (normalizedFiles.has(normalizeFixturePath(fixture))) {
        return { resolvedFileName: fixture, extension: ts.Extension.Ts, isExternalLibraryImport: false }
      }
      return ts.resolveModuleName(moduleName, containingFile, { moduleResolution: ts.ModuleResolutionKind.Bundler }, host).resolvedModule
    })
    const program = ts.createProgram({ rootNames: Object.values(sourcePaths), options: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }, host })
    expect(importedSinkNames(program.getTypeChecker(), findSourceFile(program, sourcePaths.entry))).toEqual(['ImageProcessor'])
  })
})
