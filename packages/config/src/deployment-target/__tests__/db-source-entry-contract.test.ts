import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const repositoryRoot = path.resolve(import.meta.dirname, '../../../../..')
const dbScriptsDirectory = path.join(repositoryRoot, 'packages/db/scripts')
const expectedScripts = [
  'apply-index-migration.ts',
  'clean-data.ts',
  'cleanup-backup-fields.ts',
  'cleanup-invalid-covers.ts',
  'migrate-actors-publishers.ts',
  'migrate-movies-metadata.ts',
  'migrate-relations.ts',
  'rollback-migration.ts',
  'sync-actors-publishers.ts',
  'target-d1-mutation.ts',
] as const

function createDbProgram(files: readonly string[]): ts.Program {
  const configPath = path.join(repositoryRoot, 'packages/db/tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  return ts.createProgram({ rootNames: [...files], options: parsed.options })
}

function resolvesAliasedImport(checker: ts.TypeChecker, source: ts.SourceFile): boolean {
  let resolved = false
  source.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings))
      return
    for (const element of node.importClause.namedBindings.elements) {
      const symbol = checker.getSymbolAtLocation(element.name)
      if (symbol && symbol.flags & ts.SymbolFlags.Alias && checker.getAliasedSymbol(symbol).name === 'createClient')
        resolved = true
    }
  })
  return resolved
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

describe('dB source entry contract', () => {
  it('builds a TypeChecker-backed exhaustive table with no ambient remote DB entry', async () => {
    const discovered = (await readdir(dbScriptsDirectory)).filter(name => name.endsWith('.ts')).sort()
    expect(discovered.filter(name => name !== 'local-sqlite-guard.ts')).toEqual([...expectedScripts].sort())

    const paths = expectedScripts.map(name => path.join(dbScriptsDirectory, name))
    const program = createDbProgram(paths)
    const checker = program.getTypeChecker()

    for (const filePath of paths) {
      const source = program.getSourceFile(filePath)
      expect(source, filePath).toBeDefined()
      const text = await readFile(filePath, 'utf8')
      expect(text, filePath).not.toMatch(/dotenv|DATABASE_URL|DATABASE_AUTH_TOKEN|createClient\s*\(/)
      expect(resolvesAliasedImport(checker, source!)).toBe(false)
    }
  })

  it('resolves an aliased createClient import through the TypeChecker', () => {
    const fixtureDirectory = path.join(repositoryRoot, '.target-runs', 'db-source-fixture')
    const clientPath = path.join(fixtureDirectory, 'client.ts')
    const entryPath = path.join(fixtureDirectory, 'entry.ts')
    const host = ts.createCompilerHost({ module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler })
    const files = new Map<string, string>([
      [clientPath, 'export function createClient(): void {}'],
      [entryPath, 'import { createClient as open } from \'./client\'; open()'],
    ])
    const normalizedFiles = new Map([...files].map(([fileName, text]) => [normalizeFixturePath(fileName), text]))
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
    const program = ts.createProgram({ rootNames: [clientPath, entryPath], options: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }, host })
    expect(resolvesAliasedImport(program.getTypeChecker(), findSourceFile(program, entryPath))).toBe(true)
  })
})
