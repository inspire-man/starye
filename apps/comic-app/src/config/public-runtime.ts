export interface ComicPublicRuntime {
  readonly targetId: string
  readonly gatewayBaseUrl: string
  readonly apiBaseUrl: string
  readonly appBasePath: string
  readonly sentryDsn?: string
  readonly sentryRelease?: string
  readonly buildMode: string
}

declare const __STARYE_COMIC_PUBLIC_RUNTIME__: ComicPublicRuntime

export const comicPublicRuntime = __STARYE_COMIC_PUBLIC_RUNTIME__
