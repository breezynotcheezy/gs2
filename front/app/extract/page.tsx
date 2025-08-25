"use client"

import React, { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function ExtractPage() {
  const [file, setFile] = useState<File | null>(null)
  const [segMode, setSegMode] = useState<"hybrid" | "llm" | "det">("hybrid")
  const [model, setModel] = useState<string>("gpt-5-mini")
  const [timeoutMs, setTimeoutMs] = useState<number>(45000)
  const [verbose, setVerbose] = useState<boolean>(false)
  const [text, setText] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [running, setRunning] = useState<boolean>(false)
  const [output, setOutput] = useState<string>("(no output yet)")

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
    setFile(f)
  }, [])

  const readTextFromFile = useCallback(async (f: File): Promise<string> => {
    const buf = await f.arrayBuffer()
    const dec = new TextDecoder()
    return dec.decode(buf)
  }, [])

  const canRun = useMemo(() => {
    return running === false
  }, [running])

  const handleRun = useCallback(async () => {
    try {
      setStatus("Reading file/text...")
      setRunning(true)
      setOutput("(no output yet)")

      let finalText = text.trim()
      if (file) {
        finalText = await readTextFromFile(file)
      }
      if (!finalText) {
        alert("Please choose a file or paste text.")
        return
      }

      setStatus("Submitting to server...")
      const body = {
        text: finalText,
        segMode,
        model,
        timeoutMs: Number(timeoutMs || 45000),
        verbose,
      }

      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await resp.json().catch(() => ({}))
      if (!resp.ok || (data && data.ok === false)) {
        setStatus("Error")
        setOutput(JSON.stringify(data, null, 2))
        return
      }

      setStatus("Done")
      setOutput(JSON.stringify(data, null, 2))
    } catch (e: any) {
      setStatus("Error")
      setOutput(String(e?.message || e))
    } finally {
      setRunning(false)
    }
  }, [file, model, readTextFromFile, segMode, text, timeoutMs, verbose])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-amber-50">
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-mono font-bold">Green Seam: GameChanger Extractor</h1>
          <p className="text-sm text-gray-400 mt-1">Upload a text file with play-by-play. The server will use the OpenAI API to segment and canonicalize each plate appearance.</p>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-black/50 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="file">Play-by-play file (.txt)</Label>
                <Input id="file" type="file" accept=".txt,text/plain" onChange={onFileChange} />
              </div>

              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="segMode">Segmentation</Label>
                  <Select value={segMode} onValueChange={(v: "hybrid" | "llm" | "det") => setSegMode(v)}>
                    <SelectTrigger id="segMode" className="w-[220px]">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hybrid">hybrid (LLM preferred)</SelectItem>
                      <SelectItem value="llm">llm only</SelectItem>
                      <SelectItem value="det">det only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" type="text" value={model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)} className="w-[220px]" />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input id="timeout" type="number" min={5000} step={1000} value={timeoutMs} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeoutMs(Number(e.target.value))} className="w-[180px]" />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch id="verbose" checked={verbose} onCheckedChange={(v: boolean) => setVerbose(!!v)} />
                  <Label htmlFor="verbose">verbose</Label>
                </div>

                <div className="pt-5">
                  <Button onClick={handleRun} disabled={!canRun} className="min-w-28">
                    {running ? "Running..." : "Extract"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-400">Or paste raw text below (will be used if no file is selected):</p>
              <Textarea id="text" value={text} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} className="min-h-48" />
              <div className="text-xs font-mono text-amber-300">{status}</div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-mono font-semibold">Result</h3>
              <pre className="bg-black/70 text-amber-100 p-3 rounded border border-amber-500/20 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words">{output}</pre>
            </div>
          </div>
        </div>

        <div>
          <Button variant="outline" asChild>
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
