"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Brain, AlertTriangle, TrendingUp, X } from "lucide-react"

export type Batter = any

type Props = {
  batter: Batter
  overlayAnim: "enter" | "exit" | null
  onClose: () => void
  aiForKey?: { swing_mechanic?: string; positional?: string; opponent_pattern?: string; confidence: number }
  onFullAnalysis: () => void
}

export default function MobileDetailOverlay({ batter, overlayAnim, onClose, aiForKey, onFullAnalysis }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
          overlayAnim === "enter" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-sm" />
      </div>
      <div
        className={`fixed inset-x-0 bottom-0 top-16 sm:top-20 z-50 transition-transform duration-300 ease-out ${
          overlayAnim === "enter" ? "translate-y-0" : "translate-y-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto h-full max-w-screen-sm sm:max-w-screen-md px-3 sm:px-4">
          <div className="h-full overflow-y-auto rounded-t-2xl border border-amber-500/20 bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-4 py-3 backdrop-blur-md bg-black/40 border-b border-amber-500/20">
              <div className="text-base sm:text-lg font-mono font-bold text-amber-100">{batter.name}</div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-200" onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="Close">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                  <span className="block text-[10px] tracking-wide text-gray-400">PA</span>
                  <span className="block text-sm font-mono font-bold text-amber-100">{batter.totals.pas}</span>
                </div>
                <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                  <span className="block text-[10px] tracking-wide text-gray-400">Contact</span>
                  <span className="block text-sm font-mono font-bold text-amber-100">{(batter.totals.contactRate * 100).toFixed(0)}%</span>
                </div>
                <div className="text-center p-2 bg-gray-800/40 border border-gray-700/50 rounded">
                  <span className="block text-[10px] tracking-wide text-gray-400">K</span>
                  <span className="block text-sm font-mono font-bold text-amber-100">{(batter.totals.strikeoutRate * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                  <p className="text-lg font-mono font-bold text-amber-100">{(batter.totals.strikeoutRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-400 font-mono">K RATE</p>
                </div>
                <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
                  <p className="text-lg font-mono font-bold text-amber-100">{(batter.totals.walkRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-400 font-mono">BB RATE</p>
                </div>
                <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded">
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
                        result === 1 ? "bg-amber-500/20 text-amber-300 border border-amber-400/40" : "bg-red-900/30 text-red-400 border border-red-500/40"
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
                    <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400 italic">Generating insights...</div>
                  ) : (
                    <>
                      {!batter.swing_mechanic && !batter.positional ? (
                        <div className="p-3 bg-gray-800/20 border border-gray-700/30 rounded text-xs font-mono text-gray-400">No clear, data-backed coaching insight.</div>
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
                    <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/70 italic">Analyzing for opponent exploitable trends...</div>
                  ) : (
                    <>
                      {!batter.opponent_pattern ? (
                        <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200/80">No clear, data-backed opponent pattern.</div>
                      ) : (
                        <div className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed">{batter.opponent_pattern}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 w-full gap-3 bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 font-mono text-sm px-4 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/30 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
                  onClick={onFullAnalysis}
                >
                  <TrendingUp className="w-5 h-5" />
                  FULL ANALYSIS
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
