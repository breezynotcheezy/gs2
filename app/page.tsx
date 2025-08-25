import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Brain, BarChart3, Zap, Activity, Upload, Target, TrendingUp, AlertTriangle } from "lucide-react"

export default function GreenSeamDashboard() {
  const batters = [
    {
      id: 1,
      name: "E M",
      totals: {
        pas: 1,
        pitchesSeen: 1,
        contactRate: 1,
        strikeoutRate: 0,
        walkRate: 0,
        hbpRate: 0,
      },
      breakdown: {
        results: { double: 1 },
        battedBall: { gb: 0, fb: 0, ld: 0 },
        power: { double: 1, triple: 0, hr: 0 },
        pitchMix: { in_play: 1 },
      },
      sampleNotes: ["double on a fly ball to center fielder T B"],
      recommendations: [
        "Work on driving fly balls with consistent bat paths to turn hard contact into extra-base hits.",
        "Practice timing against fastballs to capitalize on pitches in the zone.",
        "Focus on finishing through the ball to maintain loft and carry to center field.",
      ],
      recommendations_confidence: 0.58,
      exploit_recommendations: [
        "Pitch away or off-speed away from center to induce weaker contact.",
        "Do not challenge up-middle; instead locate low-and-away.",
        "Defend with deeper center field positioning to prevent doubles.",
      ],
      exploit_recommendations_confidence: 0.58,
      recentForm: [1, 0, 1, 1, 0, 1, 1],
    },
    {
      id: 2,
      name: "Alex Rodriguez",
      totals: {
        pas: 45,
        pitchesSeen: 178,
        contactRate: 0.82,
        strikeoutRate: 0.18,
        walkRate: 0.15,
        hbpRate: 0.02,
      },
      breakdown: {
        results: { single: 12, double: 8, triple: 1, hr: 5 },
        battedBall: { gb: 15, fb: 8, ld: 3 },
        power: { double: 8, triple: 1, hr: 5 },
        pitchMix: { fastball: 28, breaking: 12, offspeed: 5 },
      },
      sampleNotes: ["home run to left field on 2-1 fastball", "double down the line on changeup"],
      recommendations: [
        "Continue aggressive approach on first-pitch fastballs in the zone.",
        "Work on recognizing breaking balls earlier in the count.",
        "Maintain current swing path for consistent power production.",
      ],
      recommendations_confidence: 0.84,
      exploit_recommendations: [
        "Attack with breaking balls in 2-strike counts.",
        "Avoid first-pitch fastballs in the strike zone.",
        "Use off-speed pitches to disrupt timing on power swings.",
      ],
      exploit_recommendations_confidence: 0.79,
      recentForm: [1, 0, 1, 1, 0, 1, 1],
    },
    {
      id: 3,
      name: "Maria Santos",
      totals: {
        pas: 38,
        pitchesSeen: 142,
        contactRate: 0.75,
        strikeoutRate: 0.25,
        walkRate: 0.12,
        hbpRate: 0.01,
      },
      breakdown: {
        results: { single: 18, double: 4, triple: 2, hr: 2 },
        battedBall: { gb: 12, fb: 10, ld: 4 },
        power: { double: 4, triple: 2, hr: 2 },
        pitchMix: { fastball: 22, breaking: 14, offspeed: 6 },
      },
      sampleNotes: ["triple to right-center gap", "stolen base on 1-1 count"],
      recommendations: [
        "Focus on gap-to-gap approach for consistent contact.",
        "Work on plate discipline to draw more walks.",
        "Utilize speed more aggressively on base paths.",
      ],
      recommendations_confidence: 0.71,
      exploit_recommendations: [
        "Challenge with fastballs up in the zone.",
        "Use breaking balls to induce weak contact.",
        "Hold runners close to prevent stolen bases.",
      ],
      exploit_recommendations_confidence: 0.68,
      recentForm: [0, 1, 0, 0, 1, 0, 1],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-mono font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent mb-2 drop-shadow-2xl">
              GREENSEAM.AI
            </h1>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="gap-3 bg-black/50 border-amber-500/30 text-amber-100 hover:bg-amber-500/10 hover:border-amber-400/50 font-mono px-6 py-3 transition-all duration-300 shadow-xl hover:shadow-amber-500/25"
          >
            <Upload className="w-4 h-4" />
            UPLOAD DATA
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-10">
          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-mono mb-1">ACTIVE BATTERS</p>
                  <p className="text-2xl font-mono font-bold text-amber-100">3</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Activity className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-mono mb-1">PREDICTION ACCURACY</p>
                  <p className="text-2xl font-mono font-bold text-amber-100">84%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-900/90 to-black/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Brain className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-mono mb-1">AI INSIGHTS</p>
                  <p className="text-2xl font-mono font-bold text-amber-100">156</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-black/90 to-gray-900/90 border-amber-500/20 backdrop-blur-xl hover:border-amber-400/40 transition-all duration-300 shadow-2xl hover:shadow-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-mono mb-1">PREDICTIONS</p>
                  <p className="text-2xl font-mono font-bold text-amber-100">8</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {batters.map((batter) => (
            <Card
              key={batter.id}
              className="relative overflow-hidden bg-gradient-to-br from-gray-900/95 via-black/90 to-gray-900/95 backdrop-blur-xl border border-amber-500/20 hover:border-amber-400/40 transition-all duration-500 shadow-2xl hover:shadow-amber-500/25 hover:scale-[1.02] transform"
            >
              <CardHeader className="pb-4 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 rounded-t-lg"></div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl text-amber-100 font-mono font-bold mb-1 drop-shadow-lg">
                      {batter.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                      <span>{batter.totals.pas} PA</span>
                      <span>•</span>
                      <span>{batter.totals.pitchesSeen} Pitches</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-mono mb-1">CONTACT RATE</div>
                    <div className="text-lg font-mono font-bold text-amber-300">
                      {(batter.totals.contactRate * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 relative">
                {/* Key Rates */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                    <p className="text-lg font-mono font-bold text-amber-100">
                      {(batter.totals.strikeoutRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400 font-mono">K RATE</p>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                    <p className="text-lg font-mono font-bold text-amber-100">
                      {(batter.totals.walkRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-400 font-mono">BB RATE</p>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded hover:border-amber-500/30 transition-all duration-300">
                    <p className="text-lg font-mono font-bold text-amber-100">
                      {batter.breakdown.power.hr + batter.breakdown.power.double + batter.breakdown.power.triple}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">XBH</p>
                  </div>
                </div>

                {/* Results Breakdown */}
                <div className="space-y-2">
                  <p className="text-xs font-mono text-gray-400">RESULTS BREAKDOWN</p>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {Object.entries(batter.breakdown.results).map(([type, count]) => (
                      <div key={type} className="text-center p-2 bg-gray-800/30 border border-gray-700/30 rounded">
                        <div className="font-mono font-bold text-amber-100">{count}</div>
                        <div className="text-gray-400 font-mono uppercase">{type}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Form */}
                <div>
                  <p className="text-xs font-mono mb-2 text-gray-400">RECENT FORM</p>
                  <div className="flex gap-1">
                    {batter.recentForm.map((result, index) => (
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

                {/* Sample Notes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-mono text-gray-400">RECENT PERFORMANCE</p>
                  </div>
                  <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300">
                    {batter.sampleNotes[0]}
                  </div>
                </div>

                {/* AI Recommendations */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-mono text-gray-400">IMPROVEMENT INSIGHTS</p>
                    <span className="text-xs font-mono text-amber-300 bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                      {(batter.recommendations_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {batter.recommendations.slice(0, 2).map((rec, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-800/30 border border-gray-700/30 rounded text-xs font-mono text-gray-300 leading-relaxed"
                      >
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exploit Recommendations */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-xs font-mono text-gray-400">OPPONENT STRATEGY</p>
                    <span className="text-xs font-mono text-red-300 bg-red-500/20 px-2 py-1 rounded border border-red-500/30">
                      {(batter.exploit_recommendations_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {batter.exploit_recommendations.slice(0, 2).map((rec, index) => (
                      <div
                        key={index}
                        className="p-3 bg-red-900/10 border border-red-500/20 rounded text-xs font-mono text-red-200 leading-relaxed"
                      >
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 bg-amber-500/10 border-amber-500/30 text-amber-100 hover:bg-amber-500/20 hover:border-amber-400/50 font-mono text-xs transition-all duration-300 shadow-lg hover:shadow-amber-500/25"
                  >
                    <TrendingUp className="w-3 h-3" />
                    FULL ANALYSIS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500/50 font-mono text-xs transition-all duration-300"
                  >
                    <BarChart3 className="w-3 h-3" />
                    DETAILED STATS
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
