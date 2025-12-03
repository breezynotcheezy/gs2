"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, Activity, Brain, Zap } from "lucide-react"

type Props = {
  result: any
  filteredBatters: Array<any>
}

export default function SummaryCards({ result, filteredBatters }: Props) {
  if (!(result?.ok && filteredBatters.length > 0)) return null
  const totalPas = Array.isArray(result?.data) ? result.data.length : 0
  const avgConf = (() => {
    const arr = Array.isArray(result?.data) ? result.data : []
    const avg = arr.reduce((s: number, p: any) => s + (p?.confidence || 0), 0) / Math.max(1, arr.length)
    return `${Math.round(avg * 100)}%`
  })()
  const aiInsightCount = filteredBatters.reduce(
    (s, b) => s + (b.swing_mechanic ? 1 : 0) + (b.positional ? 1 : 0) + (b.opponent_pattern ? 1 : 0),
    0,
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-10 px-2 sm:px-0">
      <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
        <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
          <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </div>
          <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">ACTIVE BATTERS</p>
          <p className="text-xl sm:text-3xl font-mono font-bold text-amber-200 leading-none mt-1">{filteredBatters.length}</p>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
        <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
          <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </div>
          <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">AVG CONFIDENCE</p>
          <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{avgConf}</p>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
        <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
          <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </div>
          <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">AI INSIGHTS</p>
          <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{aiInsightCount}</p>
        </CardContent>
      </Card>

      <Card className="mx-auto w-full max-w-[180px] sm:max-w-none bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 shadow-2xl hover:shadow-amber-500/20 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5">
        <CardContent className="p-3 sm:p-5 min-h-[96px] sm:min-h-[140px] flex flex-col items-center justify-center">
          <div className="mx-auto mb-2 sm:mb-3 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </div>
          <p className="text-[11px] sm:text-sm text-gray-400 font-mono tracking-wide text-center w-full">TOTAL PAs</p>
          <p className="text-xl sm:text-3xl font-mono font-bold text-amber-100 leading-none mt-1">{totalPas}</p>
        </CardContent>
      </Card>
    </div>
  )
}
