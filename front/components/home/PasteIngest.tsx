"use client"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Paperclip, X } from "lucide-react"

export type PasteChunk = { id: string; text: string; words: number; chars: number }

type Props = {
  pasteChunks: PasteChunk[]
  pasteDraft: string
  running: boolean
  onDraftChange: (val: string) => void
  onAddChunk: (txt: string) => void
  onRemoveChunk: (id: string) => void
  onClear: () => void
  onIngest: () => void
}

export default function PasteIngest({
  pasteChunks,
  pasteDraft,
  running,
  onDraftChange,
  onAddChunk,
  onRemoveChunk,
  onClear,
  onIngest,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl -mt-4 mb-6">
      <Label htmlFor="paste" className="text-xs font-mono text-gray-400 mb-1 inline-block">
        Paste Data
      </Label>
      <div className="relative">
        <Textarea
          id="paste"
          placeholder="Paste play-by-play text here..."
          className={`bg-black/50 border-amber-500/20 text-amber-100 placeholder:text-gray-500 ${
            pasteChunks.length === 0 ? "" : pasteChunks.length >= 3 ? "pt-14" : "pt-10"
          }`}
          rows={6}
          value={pasteDraft}
          onChange={(e) => onDraftChange((e.target as HTMLTextAreaElement).value)}
          onPaste={(e) => {
            try {
              const txt = e.clipboardData?.getData("text") || ""
              if (txt) {
                const words = txt.trim().split(/\s+/).filter(Boolean).length
                if (words > 15) {
                  e.preventDefault()
                  onAddChunk(txt)
                }
              }
            } catch {}
          }}
          onDrop={(e) => {
            try {
              const txt = e.dataTransfer?.getData("text") || ""
              if (txt) {
                const words = txt.trim().split(/\s+/).filter(Boolean).length
                if (words > 15) {
                  e.preventDefault()
                  onAddChunk(txt)
                }
              }
            } catch {}
          }}
        />
        {pasteChunks.length > 0 && (() => {
          const many = pasteChunks.length >= 3
          const total = pasteChunks.reduce((s, c) => s + c.words, 0)
          return (
            <div className="absolute top-1 left-1 right-1 flex flex-wrap justify-end gap-1 pointer-events-none">
              {many ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 shadow-sm pointer-events-auto">
                  <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[11px] font-mono text-amber-200">Multiple games pasted ({pasteChunks.length}) • {total} words</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onClear()} aria-label="Remove all pasted text" title="Remove all pasted text">
                    <X className="w-3 h-3 text-amber-200" />
                  </Button>
                </div>
              ) : (
                pasteChunks.map((c) => (
                  <div key={c.id} className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 shadow-sm pointer-events-auto">
                    <Paperclip className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-[11px] font-mono text-amber-200">pasted text • {c.words} words</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onRemoveChunk(c.id)} aria-label="Remove pasted text" title="Remove pasted text">
                      <X className="w-3 h-3 text-amber-200" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )
        })()}
      </div>

      <div className="mt-2 grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2">
        <Button
          onClick={onIngest}
          disabled={running}
          variant="default"
          size="lg"
          className="w-full sm:w-auto gap-3 font-mono transition-all duration-150 rounded-md
                     !bg-gradient-to-r !from-amber-300 !via-yellow-200 !to-amber-300
                     hover:!from-amber-200 hover:!via-yellow-100 hover:!to-amber-200 active:!from-amber-200 active:!to-amber-200
                     !text-black !font-semibold tracking-wide uppercase text-[12px] sm:text-[13px]
                     border border-amber-400/50
                     shadow-[0_0_0_1px_rgba(251,191,36,0.30),0_10px_25px_-5px_rgba(251,191,36,0.35)]
                     focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-black
                     disabled:opacity-60"
        >
          {running ? "Processing..." : "INGEST TEXT"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="col-span-2 sm:col-span-1 text-xs font-mono text-gray-400 w-full sm:w-auto"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
