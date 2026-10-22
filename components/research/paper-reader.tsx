"use client"
import { useWorkspaceNavigation } from "@/lib/research/navigation"
import { paperRecords } from "@/lib/research/papers"
import assets from "@/lib/research/paper-assets.json"
import type { Document } from "@/lib/research/model"
import { SButton } from "./source-ui"

const labels: Record<string,string> = { qp: "QP 试卷", ms: "MS 答案与评分", insert: "Insert 附件", in: "Insert 附件", sf: "Source 源文件", gt: "Grade Thresholds 等级线" }

export function PaperReader({ document: doc, onStructured }: { document: Document; onStructured: () => void }) {
  const { params, navigate } = useWorkspaceNavigation()
  const paper = paperRecords.find(p => p.id === doc.id || p.id === doc.paperSource?.id || doc.items.some(i => i.references.some(ref => ref.documentId === p.id)))
  const files = Object.entries(paper?.files || {}).flatMap(([type, path]) => {
    const asset = (assets as Record<string,{ url: string; sha256: string; bytes: number; kind: string }>)[path]
    return asset ? [{ type, path, ...asset }] : []
  })
  const left = files.find(f => f.type === params.get("left")) || files.find(f => f.type === "qp") || files[0]
  const right = files.find(f => f.type === params.get("right")) || files.find(f => f.type === "ms" && f !== left) || files.find(f => f !== left)
  const pair = params.get("pair") !== "0" && files.length > 1
  const visibleFiles = left ? [left, ...(pair && right ? [right] : [])] : []

  return <section className="paper-original" aria-label="试卷原文件对照阅读">
    <header className="original-head">
      <SButton onClick={onStructured}>返回题目对照</SButton>
      <h2 title={doc.title}>{doc.title}</h2>
      {left && <div className="original-modes" role="group" aria-label="原文件阅读方式">
        <button type="button" aria-pressed={!pair} className={!pair ? "on" : ""} onClick={() => navigate({ pair: "0" })}>单栏阅读</button>
        <button type="button" aria-pressed={pair} className={pair ? "on" : ""} disabled={files.length < 2} onClick={() => navigate({ pair: "1" })}>双栏对照</button>
      </div>}
    </header>
    {!left ? <div className="original-empty"><p>此试卷尚未导入原文件，可返回查看已有题目与个人批注。</p></div> :
      <div className={`original-panes${pair ? " paired" : ""}`}>
        {visibleFiles.map((file, index) => {
          const side = index === 0 ? "左侧" : "右侧"
          const name = labels[file.type] || file.type.toUpperCase()
          return <section key={index} className="original-pane" aria-label={`${side}原文件预览`}>
            <header className="original-pane-head">
              <label className="original-file-picker">
                <span>{pair ? side : "文件"}</span>
                <select aria-label={`${side}原文件`} value={file.type} onChange={event => navigate({ [index === 0 ? "left" : "right"]: event.target.value })}>
                  {files.map(f => <option key={f.type} value={f.type}>{labels[f.type] || f.type.toUpperCase()}</option>)}
                </select>
              </label>
              <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={`独立打开或下载${side}${name}`} title={`${file.path.split("/").pop()} · ${(file.bytes / 1024 / 1024).toFixed(1)} MB`}>独立打开 / 下载</a>
            </header>
            {file.kind === "pdf" ? <iframe title={`${side} ${name} 原 PDF`} src={file.url} className="original-frame" /> :
              <div className="original-download"><p>此文件需下载后使用对应软件打开（Word / ZIP）。</p><a href={file.url} download>下载源文件</a></div>}
          </section>
        })}
      </div>}
  </section>
}
