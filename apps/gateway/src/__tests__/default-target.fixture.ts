import { resolveTargetProfile } from '../../../../packages/config/src/deployment-target/target-resolver'

const defaultTargetResolution = resolveTargetProfile('starye-org')

export const defaultGatewayOrigin = defaultTargetResolution.profile.urls.gateway
export const defaultApiOrigin = defaultTargetResolution.profile.urls.api
export const defaultDashboardOrigin = defaultTargetResolution.profile.urls.dashboard
export const defaultMovieOrigin = defaultTargetResolution.profile.urls.movie

export function defaultGatewayUrl(path: string): string {
  return new URL(path, defaultGatewayOrigin).toString()
}

export function defaultGatewayRequest(path: string, init?: RequestInit): Request {
  return new Request(defaultGatewayUrl(path), init)
}
