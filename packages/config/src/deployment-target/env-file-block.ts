import type {
  LocalEnvTargetFile,
  TargetManagedEnvEntries,
  TargetManagedEnvKey,
} from './projection-plan'
import {
  targetManagedEnvKeysByFile,
  userManagedSecretKeysByFile,
} from './projection-plan'

export const targetManagedBlockStart = '# >>> STARYE TARGET-MANAGED BLOCK >>>'
export const targetManagedBlockEnd = '# <<< STARYE TARGET-MANAGED BLOCK <<<'

export interface EnvFileBlockUpdate {
  content: string
  changed: boolean
  hadManagedBlock: boolean
  removedStaleKeys: readonly TargetManagedEnvKey[]
}

interface TargetManagedBlockBounds {
  start: number
  end: number
}

function readAssignmentKey(line: string): string | undefined {
  const separatorIndex = line.indexOf('=')

  if (separatorIndex < 0) {
    return undefined
  }

  const key = line.slice(0, separatorIndex).trim()
  return /^[A-Z_]\w*$/i.test(key) ? key : undefined
}

function lineEndingFor(content: string): '\n' | '\r\n' {
  return content.includes('\r\n') ? '\r\n' : '\n'
}

function findTargetManagedBlockBounds(
  file: LocalEnvTargetFile,
  content: string,
): TargetManagedBlockBounds | undefined {
  const starts: number[] = []
  const ends: number[] = []
  let offset = 0

  while (offset < content.length) {
    const nextNewline = content.indexOf('\n', offset)
    const lineEnd = nextNewline < 0 ? content.length : nextNewline
    const line = content.slice(offset, lineEnd).replace(/\r$/, '')

    if (line === targetManagedBlockStart) {
      starts.push(offset)
    }
    else if (line === targetManagedBlockEnd) {
      ends.push(offset)
    }

    if (nextNewline < 0) {
      break
    }

    offset = nextNewline + 1
  }

  if (starts.length === 0 && ends.length === 0) {
    return undefined
  }

  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new Error(`Malformed target-managed env block in ${file}.`)
  }

  const endLineBreak = content.indexOf('\n', ends[0])
  const end = endLineBreak < 0 ? content.length : endLineBreak

  return { start: starts[0], end }
}

function createUpdate(
  original: string,
  content: string,
  hadManagedBlock: boolean,
  removedStaleKeys: readonly TargetManagedEnvKey[],
): EnvFileBlockUpdate {
  return {
    content,
    changed: content !== original,
    hadManagedBlock,
    removedStaleKeys,
  }
}

export function serializeTargetManagedEntries(
  entries: TargetManagedEnvEntries,
  lineEnding = '\n',
): string {
  return Object.entries(entries)
    .map(([key, value]) => {
      if (value.includes('\n') || value.includes('\r')) {
        throw new Error(`Target-managed env value for ${key} must be single-line.`)
      }

      return `${key}=${value}`
    })
    .join(lineEnding)
}

function serializeTargetManagedBlock(entries: TargetManagedEnvEntries, lineEnding: string): string {
  const serializedEntries = serializeTargetManagedEntries(entries, lineEnding)

  return serializedEntries
    ? [targetManagedBlockStart, serializedEntries, targetManagedBlockEnd].join(lineEnding)
    : [targetManagedBlockStart, targetManagedBlockEnd].join(lineEnding)
}

export function removeStaleTargetManagedKeys(
  file: LocalEnvTargetFile,
  content: string,
): EnvFileBlockUpdate {
  const targetManagedKeys = new Set<string>(targetManagedEnvKeysByFile[file])
  const userManagedSecretKeys = new Set<string>(userManagedSecretKeysByFile[file])
  const removedStaleKeys: TargetManagedEnvKey[] = []
  let rewritten = ''
  let offset = 0

  while (offset < content.length) {
    const nextNewline = content.indexOf('\n', offset)
    const lineEnd = nextNewline < 0 ? content.length : nextNewline + 1
    const line = content.slice(offset, lineEnd)
    const key = readAssignmentKey(line)

    if (key && targetManagedKeys.has(key) && !userManagedSecretKeys.has(key)) {
      removedStaleKeys.push(key as TargetManagedEnvKey)
    }
    else {
      rewritten += line
    }

    offset = lineEnd
  }

  return createUpdate(content, rewritten, false, removedStaleKeys)
}

export function applyTargetManagedEnvBlock(
  file: LocalEnvTargetFile,
  content: string,
  entries: TargetManagedEnvEntries,
): EnvFileBlockUpdate {
  const managedBlockBounds = findTargetManagedBlockBounds(file, content)

  const block = serializeTargetManagedBlock(entries, lineEndingFor(content))

  if (!managedBlockBounds) {
    const staleKeyRemoval = removeStaleTargetManagedKeys(file, content)
    const separator = staleKeyRemoval.content.length === 0 || staleKeyRemoval.content.endsWith('\n')
      ? ''
      : lineEndingFor(staleKeyRemoval.content)
    const updatedContent = `${staleKeyRemoval.content}${separator}${block}`

    return createUpdate(content, updatedContent, false, staleKeyRemoval.removedStaleKeys)
  }

  const beforeBlock = content.slice(0, managedBlockBounds.start)
  const afterBlock = content.slice(managedBlockBounds.end)
  const beforeCleanup = removeStaleTargetManagedKeys(file, beforeBlock)
  const afterCleanup = removeStaleTargetManagedKeys(file, afterBlock)
  const updatedContent = `${beforeCleanup.content}${block}${afterCleanup.content}`

  return createUpdate(
    content,
    updatedContent,
    true,
    [...beforeCleanup.removedStaleKeys, ...afterCleanup.removedStaleKeys],
  )
}
