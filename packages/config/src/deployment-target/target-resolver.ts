import type { TargetProfile, TargetProfileId } from './target-profile.schema'
import {
  parseTargetProfile,

} from './target-profile.schema'
import { trackedTargetProfileMap } from './target-profiles'

export type TargetResolutionErrorCode
  = | 'missing-selected-target'
    | 'unknown-target'
    | 'invalid-target-profile'

export class TargetResolutionError extends Error {
  constructor(
    readonly code: TargetResolutionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TargetResolutionError'
  }
}

export interface TargetResolution {
  id: TargetProfileId
  profile: TargetProfile
}

export function isTargetProfileId(
  targetId: string,
  profiles: ReadonlyMap<TargetProfileId, TargetProfile> = trackedTargetProfileMap,
): targetId is TargetProfileId {
  return profiles.has(targetId)
}

export function listTargetProfiles(
  profiles: ReadonlyMap<TargetProfileId, TargetProfile> = trackedTargetProfileMap,
): TargetProfileId[] {
  return [...profiles.keys()].sort()
}

export function resolveTargetProfile(
  targetId: string | undefined,
  profiles: ReadonlyMap<TargetProfileId, TargetProfile> = trackedTargetProfileMap,
): TargetResolution {
  const selectedTargetId = targetId?.trim()

  if (!selectedTargetId) {
    throw new TargetResolutionError(
      'missing-selected-target',
      'Missing selected target. Pass --target <id>.',
    )
  }

  const profile = profiles.get(selectedTargetId)

  if (!profile) {
    throw new TargetResolutionError(
      'unknown-target',
      `Unknown target profile: ${selectedTargetId}`,
    )
  }

  let parsedProfile: TargetProfile

  try {
    parsedProfile = parseTargetProfile(profile)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new TargetResolutionError(
      'invalid-target-profile',
      `Target profile ${selectedTargetId} is invalid: ${message}`,
    )
  }

  if (parsedProfile.id !== selectedTargetId) {
    throw new TargetResolutionError(
      'invalid-target-profile',
      `Target profile key does not match its explicit id: ${selectedTargetId}`,
    )
  }

  return {
    id: parsedProfile.id,
    profile: parsedProfile,
  }
}
