"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Trash, Share2, Brain, AlertTriangle, TrendingUp } from "lucide-react"

export type Batter = any

type Props = {
  batter: Batter
  expanded: boolean
  onToggleExpanded: () => void
  aiForKey?: { swing_mechanic?: string; positional?: string; opponent_pattern?: string; confidence: number }
  onRequestDelete: () => void
  onShare: () => void
  onOpenDetails: () => void
  onFullAnalysis: () => void
}

export default function BatterCard({
  batter,
  expanded,
  onToggleExpanded,
  aiForKey,
  onRequestDelete,
  onShare,
  onOpenDetails,
  onFullAnalysis,
}: Props) {
  const hasInsights = !!(
    (aiForKey && ((aiForKey.swing_mechanic || "").trim() || (aiForKey.positional || "").trim() || (aiForKey.opponent_pattern || "").trim())) ||
    ((batter?.swing_mechanic || "").trim() || (batter?.positional || "").trim() || (batter?.opponent_pattern || "").trim())
  )

  return (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 backdrop-blur-xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 shadow-xl hover:shadow-amber-500/20 hover:scale-[1.01] transform">
      <CardHeader className="p-2 pb-1 sm:p-5 sm:pb-4 relative">
        <div
          className="relative flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 sm:cursor-default cursor-pointer w-full"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <div className="w-full text-center sm:text-left">
            <CardTitle className="text-base sm:text-xl text-amber-100 font-mono font-bold mb-1 drop-shadow-lg">
              {batter.name}
            </CardTitle>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-gray-400 font-mono">
              <span>{batter.totals.pas} PA</span>
              <span>•</span>
              <span>{batter.totals.pitchesSeen} Pitches</span>
            </div>
          </div>
          <div className="w-full text-center sm:w-auto sm:text-right">
            <div className="flex items-center justify-center sm:justify-end gap-2 mb-1">
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7 sm:h-8 sm:w-8"
                aria-label={`Delete ${batter.name}`}
                title={`Delete ${batter.name}`}
                onClick={onRequestDelete}
              >
                <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 sm:h-8 sm:w-8"
                aria-label={`Share ${batter.name}`}
                title={`Share ${batter.name}`}
                onClick={onShare}
              >
                <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
            <div className="text-[10px] text-gray-400 font-mono text-center sm:text-right">CONTACT RATE</div>
            <div className="text-base sm:text-lg font-mono font-bold text-amber-300 text-center sm:text-right">
              {(batter.totals.contactRate * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 space-y-2 sm:p-5 sm:space-y-4 relative">
        <div className="sm:hidden space-y-2">
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
              <span className="block text-[9px] tracking-wide text-gray-400">PA</span>
              <span className="block text-xs font-mono font-bold text-amber-100">{batter.totals.pas}</span>
            </div>
            <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
              <span className="block text-[9px] tracking-wide text-gray-400">Contact</span>
              <span className="block text-xs font-mono font-bold text-amber-100">{(batter.totals.contactRate * 100).toFixed(0)}%</span>
            </div>
            <div className="text-center p-1 bg-gray-800/40 border border-gray-700/50 rounded">
              <span className="block text-[9px] tracking-wide text-gray-400">K</span>
              <span className="block text-xs font-mono font-bold text-amber-100">{(batter.totals.strikeoutRate * 100).toFixed(0)}%</span>
            </div>
          </div>
          <Button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenDetails() }}
            className="w-full h-8 text-[11px] font-mono rounded-md
                       !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                       hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200
                       active:!from-amber-200 active:!to-amber-200
                       !text-black !font-semibold tracking-wide uppercase
                       border border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_6px_16px_-4px_rgba(251,191,36,0.35)]"
          >
            View details
          </Button>
        </div>

        <div
          className={`block overflow-hidden motion-safe:transition-all motion-safe:duration-300 ${
            expanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
          } sm:max-h-none sm:opacity-100`}
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
              <p className="text-lg font-mono font-bold text-amber-100">{(batter.totals.strikeoutRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400 font-mono">K RATE</p>
            </div>
            <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
              <p className="text-lg font-mono font-bold text-amber-100">{(batter.totals.walkRate * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-400 font-mono">BB RATE</p>
            </div>
            <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
              <p className="text-lg font-mono font-bold text-amber-100">{batter.breakdown.power.hr + batter.breakdown.power.double + batter.breakdown.power.triple}</p>
              <p className="text-xs text-gray-400 font-mono">XBH</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-mono text-gray-400">RESULTS BREAKDOWN</p>
            <div className="grid grid-cols-4 gap-1 text-xs">
              {Object.entries(batter.breakdown.results).map(([type, count]) => (
                <div key={type} className="text-center p-2 bg-gray-800/30 border border-gray-700/30 rounded">
                  <div className="font-mono font-bold text-amber-100">{count as any}</div>
                  <div className="text-gray-400 font-mono uppercase">{type}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-mono mb-2 text-gray-400">RECENT FORM</p>
            <div className="flex gap-1">
              {batter.recentForm.map((result: number, index: number) => (
                <div
                  key={index}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold transition-all duration-200 shadow-md ${
                    result === 1
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                      : "bg-red-900/30 text-red-400 border border-red-500/40"
                  }`}
                >
                  {result === 1 ? "H" : "O"}
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-mono text-gray-400">COACHING INSIGHTS</p>
              <span className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                {(batter.recommendations_confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-2">
              {!aiForKey ? (
                <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400 italic">
                  Generating insights...
                </div>
              ) : (
                <>
                  {(!batter.swing_mechanic && !batter.positional) ? (
                    <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400">
                      No clear, data-backed coaching insight.
                    </div>
                  ) : (
                    <>
                      {batter.swing_mechanic && (
                        <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                          <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Swing Mechanics</span>
                          {batter.swing_mechanic}
                        </div>
                      )}
                      {batter.positional && (
                        <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed">
                          <span className="text-[10px] uppercase tracking-wide text-amber-300/80 mr-2">Positional</span>
                          {batter.positional}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-xs font-mono text-gray-400">OPPONENT PATTERN</p>
              <span className="text-xs font-mono text-red-300 bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                {(batter.recommendations_confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-2">
              {!aiForKey ? (
                <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/70 italic">
                  Analyzing for opponent exploitable trends...
                </div>
              ) : (
                <>
                  {!batter.opponent_pattern ? (
                    <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/80">
                      No clear, data-backed opponent pattern.
                    </div>
                  ) : (
                    <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed">
                      {batter.opponent_pattern}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              variant="outline"
              size="lg"
              aria-label={`View full analysis for ${batter.name}`}
              title={hasInsights ? "View Full Analysis" : "Full Analysis enabled when AI insights exist"}
              disabled={!hasInsights}
              className={`flex-1 w-full gap-3 bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 font-mono text-sm px-4 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg ${
                !hasInsights ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={onFullAnalysis}
            >
              <TrendingUp className="w-5 h-5" />
              FULL ANALYSIS
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
