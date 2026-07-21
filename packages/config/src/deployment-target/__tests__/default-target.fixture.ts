import { resolveTargetProfile } from '../target-resolver'

export const defaultTargetResolution = resolveTargetProfile('starye-org')
export const defaultTargetProfile = defaultTargetResolution.profile
export const defaultTargetUrls = defaultTargetProfile.urls
