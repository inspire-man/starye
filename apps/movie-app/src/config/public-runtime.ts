export interface MoviePublicRuntime {
  readonly targetId: string
  readonly gatewayBaseUrl: string
  readonly apiBaseUrl: string
  readonly appBasePath: string
  readonly sentryDsn?: string
  readonly sentryRelease?: string
  readonly buildMode: string
  readonly monitoringEnabled: boolean
  readonly aria2Enabled: boolean
  readonly aria2WebsocketEnabled: boolean
  readonly ratingEnabled: boolean
  readonly autoScoreEnabled: boolean
  readonly performanceMonitoringEnabled: boolean
}

declare const __STARYE_MOVIE_PUBLIC_RUNTIME__: MoviePublicRuntime

export const moviePublicRuntime = __STARYE_MOVIE_PUBLIC_RUNTIME__
