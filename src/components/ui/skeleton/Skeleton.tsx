/**
 * Skeleton loading primitives
 *
 * Three reusable components for building loading states:
 * - SkeletonBox: Rectangular placeholders with configurable dimensions
 * - SkeletonCircle: Circular placeholders for avatars
 * - SkeletonText: Inline text placeholders that match text height
 */

import './Skeleton.css'

interface SkeletonBoxProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export function SkeletonBox({
  width,
  height,
  className = '',
  style = {},
}: SkeletonBoxProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    />
  )
}

interface SkeletonCircleProps {
  size?: number
  className?: string
}

export function SkeletonCircle({ size = 24, className = '' }: SkeletonCircleProps) {
  return (
    <div
      className={`skeleton skeleton--circle ${className}`}
      style={{ width: size, height: size, minWidth: size }}
    />
  )
}

interface SkeletonTextProps {
  width?: string | number
  className?: string
}

export function SkeletonText({ width = '100%', className = '' }: SkeletonTextProps) {
  return (
    <span
      className={`skeleton skeleton--text ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        display: 'inline-block',
      }}
    />
  )
}
