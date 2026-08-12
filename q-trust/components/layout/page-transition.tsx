"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [displayChildren, setDisplayChildren] = useState(children)
  const previousPathname = useRef(pathname)

  useEffect(() => {
    // Only animate if the pathname actually changed
    if (previousPathname.current !== pathname) {
      setIsTransitioning(true)
      
      // Short delay to allow exit animation
      const timeout = setTimeout(() => {
        setDisplayChildren(children)
        setIsTransitioning(false)
        previousPathname.current = pathname
      }, 150)

      return () => clearTimeout(timeout)
    } else {
      setDisplayChildren(children)
    }
  }, [pathname, children])

  return (
    <div
      className={cn(
        "page-transition",
        isTransitioning ? "page-exit" : "page-enter",
        className
      )}
    >
      {displayChildren}
    </div>
  )
}

// Simple fade transition for content sections
export function FadeIn({ 
  children, 
  className,
  delay = 0 
}: { 
  children: React.ReactNode
  className?: string
  delay?: number 
}) {
  return (
    <div 
      className={cn("animate-fade-in", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Slide up animation for cards and sections
export function SlideUp({ 
  children, 
  className,
  delay = 0 
}: { 
  children: React.ReactNode
  className?: string
  delay?: number 
}) {
  return (
    <div 
      className={cn("animate-slide-up", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Staggered children animation
export function StaggerChildren({ 
  children, 
  className,
  staggerDelay = 50 
}: { 
  children: React.ReactNode
  className?: string
  staggerDelay?: number 
}) {
  return (
    <div className={cn("stagger-children", className)}>
      {Array.isArray(children) 
        ? children.map((child, index) => (
            <div 
              key={index}
              className="animate-slide-up"
              style={{ animationDelay: `${index * staggerDelay}ms` }}
            >
              {child}
            </div>
          ))
        : children
      }
    </div>
  )
}
