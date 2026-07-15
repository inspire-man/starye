import path from 'node:path'

export function assertRepositoryLocalSqlitePath(candidate: string, repositoryRoot: string): string {
  const root = path.resolve(repositoryRoot)
  const resolved = path.resolve(candidate)
  if (!resolved.startsWith(`${root}${path.sep}`) || !resolved.endsWith('.sqlite')) {
    throw new Error('Only a repository-local SQLite database path is allowed.')
  }
  return resolved
}
