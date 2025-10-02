/**
 * Image Optimization Utilities
 *
 * Provides modern image loading with WebP/AVIF support, lazy loading,
 * responsive images, and blur-up placeholders for optimal mobile performance.
 *
 * @module image-optimization
 */

import React, { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'

export interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  /** Base image source (will generate WebP/AVIF variants) */
  src: string
  /** Alt text for accessibility (required) */
  alt: string
  /** Image width (required for preventing CLS) */
  width?: number
  /** Image height (required for preventing CLS) */
  height?: number
  /** Aspect ratio (alternative to width/height) */
  aspectRatio?: string
  /** Enable lazy loading (default: true) */
  lazy?: boolean
  /** Generate responsive srcSet (1x, 2x, 3x) */
  responsive?: boolean
  /** Base64 blur placeholder */
  placeholder?: string
  /** Callback when image loads */
  onLoad?: () => void
  /** Callback when image fails to load */
  onError?: () => void
  /** Priority loading (preload, disable lazy) */
  priority?: boolean
  /** CSS class name */
  className?: string
  /** Sizes attribute for responsive images */
  sizes?: string
}

/**
 * Generate srcSet for responsive images
 */
function generateSrcSet(src: string, formats: string[] = ['webp', 'avif']): string {
  const densities = [1, 2, 3] // 1x, 2x, 3x for different screen densities
  const basePath = src.replace(/\.[^/.]+$/, '') // Remove extension

  const sources: string[] = []

  formats.forEach((format) => {
    densities.forEach((density) => {
      sources.push(`${basePath}@${density}x.${format} ${density}x`)
    })
  })

  return sources.join(', ')
}

/**
 * Generate source elements for modern image formats
 */
function generateSources(src: string, sizes?: string): JSX.Element[] {
  const basePath = src.replace(/\.[^/.]+$/, '')

  return [
    // AVIF (best compression, ~50% smaller than WebP)
    <source key="avif" type="image/avif" srcSet={generateSrcSet(basePath, ['avif'])} sizes={sizes} />,
    // WebP (good compression, better browser support)
    <source key="webp" type="image/webp" srcSet={generateSrcSet(basePath, ['webp'])} sizes={sizes} />,
  ]
}

/**
 * Optimized Image Component
 *
 * Features:
 * - Modern format support (WebP/AVIF with fallback)
 * - Lazy loading with Intersection Observer
 * - Responsive srcSet for different screen densities
 * - Blur-up placeholder effect
 * - Prevents Cumulative Layout Shift (CLS)
 *
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/images/logo.png"
 *   alt="Company Logo"
 *   width={200}
 *   height={100}
 *   placeholder="data:image/jpeg;base64,..."
 *   priority // Preload critical images
 * />
 * ```
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  aspectRatio,
  lazy = true,
  responsive = true,
  placeholder,
  onLoad,
  onError,
  priority = false,
  className = '',
  sizes,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority) // Priority images are always "in view"
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [lazy, priority])

  // Preload priority images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [priority, src])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  // Calculate aspect ratio styles
  const aspectRatioStyle: React.CSSProperties = {}
  if (aspectRatio) {
    aspectRatioStyle.aspectRatio = aspectRatio
  } else if (width && height) {
    aspectRatioStyle.aspectRatio = `${width} / ${height}`
  }

  // Container styles to prevent CLS
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0', // Light gray background while loading
    ...aspectRatioStyle,
  }

  // Image styles
  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
  }

  // Placeholder styles (blur-up effect)
  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    filter: 'blur(10px)',
    transform: 'scale(1.1)', // Slightly larger to hide blur edges
    opacity: isLoaded ? 0 : 1,
    transition: 'opacity 0.3s ease-in-out',
  }

  // Error fallback
  if (hasError) {
    return (
      <div style={containerStyle} className={className}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: '#999',
          }}
        >
          Failed to load image
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle} className={className}>
      {/* Blur placeholder */}
      {placeholder && <img src={placeholder} alt="" style={placeholderStyle} aria-hidden="true" />}

      {/* Main image (only render when in view for lazy loading) */}
      {isInView && (
        <>
          {responsive ? (
            <picture>
              {generateSources(src, sizes)}
              <img
                ref={imgRef}
                src={src}
                alt={alt}
                width={width}
                height={height}
                loading={lazy && !priority ? 'lazy' : 'eager'}
                decoding="async"
                onLoad={handleLoad}
                onError={handleError}
                style={imageStyle}
                {...props}
              />
            </picture>
          ) : (
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              width={width}
              height={height}
              loading={lazy && !priority ? 'lazy' : 'eager'}
              decoding="async"
              onLoad={handleLoad}
              onError={handleError}
              style={imageStyle}
              {...props}
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Generate a base64 blur placeholder from an image URL
 * This should be done at build time or on the server
 *
 * @param imageUrl - URL of the image
 * @param width - Thumbnail width (default: 20px)
 * @param height - Thumbnail height (default: 20px)
 * @returns Promise with base64 data URL
 */
export async function generateBlurPlaceholder(
  imageUrl: string,
  width: number = 20,
  height: number = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.crossOrigin = 'Anonymous'
    canvas.width = width
    canvas.height = height

    img.onload = () => {
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.1) // Low quality for small size
      resolve(dataUrl)
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageUrl
  })
}

/**
 * Lazy load images hook
 *
 * @param threshold - Intersection threshold (0-1)
 * @param rootMargin - Margin around viewport to trigger loading
 * @returns Ref to attach to image element and loading state
 */
export function useLazyLoad(threshold: number = 0.01, rootMargin: string = '50px') {
  const [isInView, setIsInView] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      { threshold, rootMargin }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin])

  return { ref: elementRef, isInView }
}

/**
 * Preload critical images
 *
 * @param imageUrls - Array of image URLs to preload
 * @param formats - Image formats to preload (default: ['webp', 'avif'])
 */
export function preloadImages(imageUrls: string[], formats: string[] = ['webp', 'avif']): void {
  imageUrls.forEach((url) => {
    const basePath = url.replace(/\.[^/.]+$/, '')

    formats.forEach((format) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = `${basePath}.${format}`
      link.type = `image/${format}`
      document.head.appendChild(link)
    })

    // Also preload original format as fallback
    const fallbackLink = document.createElement('link')
    fallbackLink.rel = 'preload'
    fallbackLink.as = 'image'
    fallbackLink.href = url
    document.head.appendChild(fallbackLink)
  })
}

/**
 * Get responsive sizes attribute based on breakpoints
 *
 * @param breakpoints - Object mapping viewport widths to image widths
 * @returns Sizes attribute string
 *
 * @example
 * ```ts
 * const sizes = getResponsiveSizes({
 *   '(max-width: 640px)': '100vw',
 *   '(max-width: 1024px)': '50vw',
 *   'default': '33vw'
 * })
 * // Returns: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
 * ```
 */
export function getResponsiveSizes(breakpoints: Record<string, string>): string {
  const entries = Object.entries(breakpoints)
  const defaultSize = breakpoints.default || '100vw'

  const mediaQueries = entries
    .filter(([key]) => key !== 'default')
    .map(([media, size]) => `${media} ${size}`)
    .join(', ')

  return mediaQueries ? `${mediaQueries}, ${defaultSize}` : defaultSize
}
