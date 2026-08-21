import { describe, expect, it } from 'vitest'
import { mergeMoviePreviewImages } from '../javbus'

describe('javbus movie preview media', () => {
  it('keeps the source gallery before adding the JAV.hk fallback', () => {
    expect(mergeMoviePreviewImages([
      'https://pics.example/preview-1.jpg',
      'https://pics.example/preview-2.jpg',
      'https://pics.example/preview-1.jpg',
    ], 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg')).toEqual([
      'https://pics.example/preview-1.jpg',
      'https://pics.example/preview-2.jpg',
      'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    ])
  })

  it('reserves the final slot so the fallback survives the twelve-image limit', () => {
    const sourceImages = Array.from({ length: 12 }, (_, index) => `https://pics.example/preview-${index + 1}.jpg`)

    expect(mergeMoviePreviewImages(sourceImages, 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg')).toEqual([
      ...sourceImages.slice(0, 11),
      'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    ])
  })

  it('filters empty source URLs while keeping a usable fallback', () => {
    expect(mergeMoviePreviewImages(['', 'https://pics.example/preview-1.jpg'], 'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg')).toEqual([
      'https://pics.example/preview-1.jpg',
      'https://i.jav.hk/movie/mudr392/small/mudr392ps.jpg',
    ])
  })
})
