"use client"

import Link from "next/link"
import { Zap } from "lucide-react"

type Props = {
  currentProfileName?: string
}

export default function HeaderBar({ currentProfileName }: Props) {
  return (
    <div className="w-full flex items-center justify-end mb-2">
      <div className="flex flex-wrap items-center gap-2">
        {currentProfileName ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
            <span className="text-[11px] font-mono text-gray-400">Profile</span>
            <span className="text-[11px] font-mono text-amber-200">{currentProfileName}</span>
          </div>
        ) : null}
        <Link
          href="/pro"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-300/20 px-3 py-1 text-[11px] font-mono text-amber-200 hover:bg-amber-300/30"
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          Upgrade to Pro
        </Link>
      </div>
    </div>
  )
}
