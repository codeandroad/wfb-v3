"use client"

import { findByFingerprint, useLogs, type LogRecord } from "@/lib/import/log-store"
import { ParseFailure, parseFile, parseWorkbookBuffer, type ParsedFile } from "@/lib/import/parse"
import { sampleById } from "@/lib/import/samples"
import type { SheetCode } from "@/lib/import/schema"
import { buildPlan, defaultSheetState, overrideKey, type SheetState } from "@/lib/import/validate"
import { buildWorkbookBytes } from "@/lib/import/workbook-out"
import { useImperativeHandle, useMemo, useState, type Ref } from "react"
import { IssueDrawer } from "./issue-drawer"
import { StepBar } from "./shared"
import { StepConfirm, type ResultKind } from "./step-confirm"
import { StepContent } from "./step-content"
import { StepFile } from "./step-file"
import { StepPreview } from "./step-preview"
import { StepResult } from "./step-result"

export interface FlowHandle {
  loadSample: (id: string) => Promise<void>
  reset: (focus?: SheetCode[], hint?: string) => void
}

export type FlowStep = "file" | "content" | "preview" | "confirm" | "result"
const STEP_INDEX: Record<FlowStep, number> = { file: 0, content: 1, preview: 1, confirm: 2, result: 3 }

const sampleBytes = new Map<string, ArrayBuffer>()
export function sampleBuffer(id: string) {
  const s = sampleById(id)!
  let b = sampleBytes.get(id)
  if (!b) {
    b = buildWorkbookBytes(s.data, `合成示例：${s.label}`, { 快照时点: "2026-09-20 18:00", ...s.info })
    sampleBytes.set(id, b)
  }
  return b
}

export function WorkbookFlow({ ref, onHome, onOpenLog }: { ref?: Ref<FlowHandle>; onHome: () => void; onOpenLog: (id: string) => void }) {
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [failure, setFailure] = useState<{ name: string; kind: ParseFailure["kind"]; message: string } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [step, setStep] = useState<FlowStep>("file")
  const [focus, setFocus] = useState<SheetCode[] | undefined>()
  const [hint, setHint] = useState<string | undefined>()
  const [sheetState, setSheetState] = useState<Partial<Record<SheetCode, SheetState>>>({})
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  const [drawerRow, setDrawerRow] = useState<string | null>(null)
  const [activeSheet, setActiveSheet] = useState<SheetCode | null>(null)
  const [result, setResult] = useState<{ kind: ResultKind; batchId: string; planKey: string } | null>(null)
  useLogs()

  const plan = useMemo(() => (file ? buildPlan({ file, sheetState, overrides, excluded }) : null), [file, sheetState, overrides, excluded])
  const completed: LogRecord | undefined = file ? findByFingerprint(file.fingerprint) : undefined

  const accept = (parsed: ParsedFile, f?: SheetCode[]) => {
    setFile(parsed)
    setFailure(null)
    setSheetState(defaultSheetState(parsed, f))
    setOverrides({})
    setExcluded([])
    setDrawerRow(null)
    setActiveSheet(null)
    setResult(null)
    setStep("file")
  }

  const clearFile = () => {
    setFile(null)
    setFailure(null)
    setResult(null)
    setStep("file")
  }

  const pickFile = async (f: File) => {
    setLoading(f.name)
    clearFile()
    try {
      accept(await parseFile(f), focus)
    } catch (e) {
      const pf = e instanceof ParseFailure ? e : new ParseFailure("corrupt", e instanceof Error ? e.message : String(e))
      setFailure({ name: f.name, kind: pf.kind, message: pf.message })
    } finally {
      setLoading(null)
    }
  }

  const loadSample = async (id: string) => {
    const s = sampleById(id)
    if (!s) return
    setLoading(s.fileName)
    clearFile()
    try {
      accept(await parseWorkbookBuffer(sampleBuffer(id), s.fileName, "sample", id), focus)
    } finally {
      setLoading(null)
    }
  }

  useImperativeHandle(ref, () => ({
    loadSample: async (id) => {
      setFocus(undefined)
      setHint(undefined)
      const s = sampleById(id)
      if (!s) return
      setLoading(s.fileName)
      clearFile()
      try {
        accept(await parseWorkbookBuffer(sampleBuffer(id), s.fileName, "sample", id))
      } finally {
        setLoading(null)
      }
    },
    reset: (f, h) => {
      clearFile()
      setFocus(f)
      setHint(h)
    },
  }))

  const setValue = (rowKey: string, field: string, value: string | undefined) =>
    setOverrides((o) => {
      const k = overrideKey(rowKey, field)
      const next = { ...o }
      if (value === undefined) delete next[k]
      else next[k] = value
      return next
    })
  const exclude = (rowKey: string, on: boolean) => setExcluded((x) => (on ? [...new Set([...x, rowKey])] : x.filter((k) => k !== rowKey)))
  const setOne = (code: SheetCode, st: SheetState) => setSheetState((s) => ({ ...s, [code]: st }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBar steps={["选择文件", "内容与校验", "确认导入", "结果"]} current={STEP_INDEX[step]} />
        <button className="text-[13px] text-primary hover:underline" onClick={onHome}>
          返回导入首页
        </button>
      </div>

      {step === "file" ? (
        <StepFile
          file={file}
          failure={failure}
          loading={loading}
          hint={hint}
          focus={focus}
          completed={completed}
          onPick={pickFile}
          onSample={loadSample}
          onClear={clearFile}
          onNext={() => setStep("content")}
          onOpenLog={onOpenLog}
        />
      ) : null}

      {file && plan && step === "content" ? (
        <StepContent
          file={file}
          plan={plan}
          sheetState={sheetState}
          setSheetState={setOne}
          onBack={() => setStep("file")}
          onNext={() => setStep("preview")}
        />
      ) : null}

      {file && plan && step === "preview" ? (
        <StepPreview
          file={file}
          plan={plan}
          activeSheet={activeSheet}
          setActiveSheet={setActiveSheet}
          openRow={setDrawerRow}
          setValue={setValue}
          onBack={() => setStep("content")}
          onNext={() => setStep("confirm")}
        />
      ) : null}

      {file && plan && step === "confirm" ? (
        <StepConfirm
          file={file}
          plan={plan}
          completed={completed}
          onBack={() => setStep("preview")}
          onOpenLog={onOpenLog}
          onDone={(kind, batchId) => {
            setResult({ kind, batchId, planKey: plan.key })
            setStep("result")
          }}
        />
      ) : null}

      {file && plan && step === "result" && result ? (
        <StepResult
          file={file}
          plan={plan}
          kind={result.kind}
          batchId={result.batchId}
          onChangeKind={(k) => setResult({ ...result, kind: k })}
          onOpenLog={onOpenLog}
          onRestart={() => {
            clearFile()
            onHome()
          }}
          onBackToPreview={() => setStep("preview")}
        />
      ) : null}

      {plan ? (
        <IssueDrawer
          plan={plan}
          rowKey={drawerRow}
          onClose={() => {
            const k = drawerRow
            setDrawerRow(null)
            if (k) requestAnimationFrame(() => document.getElementById(`row-${k}`)?.scrollIntoView({ block: "center" }))
          }}
          actions={{ setValue, setSheetState: setOne, exclude }}
        />
      ) : null}
    </div>
  )
}
