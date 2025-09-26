"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    setContainer(el)
    setMounted(true)
    return () => {
      document.body.removeChild(el)
    }
  }, [])

  if (!mounted || !container) return null
  return createPortal(children, container)
}
