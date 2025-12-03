"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Trash } from "lucide-react"

type Props = {
  resultOk: boolean
  hasBatters: boolean
  running: boolean
  resultFilter: "all" | "so" | "bb" | "hr"
  onResultFilterChange: (v: "all" | "so" | "bb" | "hr") => void
  minPA: number
  onMinPAChange: (n: number) => void
  onDeleteAll: () => void
}

export default function FiltersBar({
  resultOk,
  hasBatters,
  running,
  resultFilter,
  onResultFilterChange,
  minPA,
  onMinPAChange,
  onDeleteAll,
}: Props) {
  if (!(resultOk && hasBatters)) return null
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-2 sm:px-0">
        <div className="w-full max-w-[280px] sm:w-48 mx-auto text-center sm:text-left">
          <Label className="text-xs font-mono text-gray-400 mb-1 block">Result Filter</Label>
          <div className="flex justify-center sm:block">
            <Select value={resultFilter} onValueChange={(v) => onResultFilterChange(v as any)}>
              <SelectTrigger className="bg-black/50 border-amber-500/20 text-amber-100 w-full h-9">
                <SelectValue placeholder="All Results" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-amber-500/20 text-amber-100">
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="so">Strikeouts (SO)</SelectItem>
                <SelectItem value="bb">Walks (BB)</SelectItem>
                <SelectItem value="hr">Home Runs (HR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full max-w:[280px] sm:w-32 mx-auto text-center sm:text-left">
          <Label className="text-xs font-mono text-gray-400 mb-1 block">Min PA</Label>
          <div className="flex justify-center sm:block">
            <Input
              type="number"
              min={0}
              step={1}
              value={minPA}
              onChange={(e) => onMinPAChange(Number(e.target.value))}
              className="bg-gray-800/50 border-gray-700/50 text-amber-100 w-full h-9"
            />
          </div>
        </div>

        <div className="w-full flex justify-center sm:justify-start sm:w-auto">
          <Button
            onClick={onDeleteAll}
            disabled={running || !hasBatters}
            variant="outline"
            className="gap-2 w-full sm:w-auto h-11 sm:h-9 max-w-[220px] sm:max-w-none rounded-md
                       bg-gradient-to-r from-red-900 via-red-800 to-red-900 text-rose-50
                       border border-red-700/40
                       shadow-[0_0_0_1px_rgba(127,29,29,0.35),0_4px_14px_-6px_rgba(127,29,29,0.35)]
                       hover:from-red-800 hover:via-red-700 hover:to-red-800
                       active:from-red-950 active:via-red-900 active:to-red-950
                       focus-visible:ring-2 focus-visible:ring-red-700/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Delete all player cards"
            title="Delete all player cards"
          >
            <Trash className="w-4 h-4" />
            Delete All
          </Button>
        </div>
        <div className="w-full flex justify-center sm:justify-start sm:w-auto">
          <Button
            asChild
            variant="outline"
            className="h-9 w-full max-w-[200px] sm:max-w-none rounded-md backdrop-blur-md
                       bg-black/40 hover:bg-amber-500/10
                       border border-amber-500/30 hover:border-amber-400/50
                       text-amber-100
                       shadow-[0_0_0_1px_rgba(251,191,36,0.20),0_6px_16px_-4px_rgba(251,191,36,0.20)]"
          >
            <Link href="/privacy">Privacy Policy</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
