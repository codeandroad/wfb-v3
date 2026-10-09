'use client'

import { entryKey, scopeTask, useMt, useTextWriters } from '@/lib/mt/store'
import { useAutoText, inputCls, Btn } from './ui'
import { SaveState } from './shared'
import { weekOfDate } from '@/lib/mt/model'
import { RichText } from '@/components/research/primitives'

export function CommonSummary({ taskId, week, label }: { taskId: string; week: number; label?: string }) {
  const mt = useMt()
  const tx = useTextWriters()
  const saved = mt.biz.summaries[entryKey(taskId, week)]
  const teaching = useAutoText(saved?.teaching ?? '', v => tx.setSummaryPart(taskId, week, 'teaching', v))
  const learning = useAutoText(saved?.learning ?? '', v => tx.setSummaryPart(taskId, week, 'learning', v))
  const actual = Object.entries(mt.biz.teachingContent ?? {}).filter(([key]) => key.startsWith(`${taskId}|`) && weekOfDate(key.slice(taskId.length + 1)) === week).sort(([a], [b]) => a.localeCompare(b))
  const candidate = actual.flatMap(([key, contents]) => contents.map(content => `${key.slice(taskId.length + 1)} · ${content.title}\n${content.text}`)).join('\n\n')
  return <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">共同内容{label ? ` · ${label}` : ''}</h3><SaveState scope={scopeTask(taskId)} compact /></div>
    <p className="text-sm text-muted-foreground">本任务第 {week} 周共用正文。修改同步至周编辑和发布准备，面向该范围家长，不填写个体隐私。</p>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">教学介绍<textarea aria-label={`教学介绍${label ? ` · ${label}` : ''}`} className={inputCls} rows={3} value={teaching.value} onChange={e => teaching.onChange(e.target.value)} onBlur={teaching.flush} placeholder="本周实际讲授、复习或训练的内容（选填）" /></label>
      <label className="flex flex-col gap-1 text-sm">学情介绍<textarea aria-label={`学情介绍${label ? ` · ${label}` : ''}`} className={inputCls} rows={3} value={learning.value} onChange={e => learning.onChange(e.target.value)} onBlur={learning.flush} placeholder="班级整体学习状态、共性困难与建议（选填）" /></label>
    </div>
    {candidate && <details><summary className="cursor-pointer text-sm text-primary">本人已确认的实际教学 · 可选周简介候选</summary><div className="flex flex-col gap-3 pt-3"><RichText text={candidate} /><p className="text-sm text-muted-foreground">仅来自本任务本周已发生课堂的教师确认，不代表学生已掌握。来源更新不覆盖此候选或你已写的教学介绍；可明确追加后自行删改。</p><Btn size="sm" className="self-start" onClick={() => teaching.set([teaching.value, candidate].filter(Boolean).join('\n\n'))}>明确追加候选到教学介绍（保留原文）</Btn></div></details>}
    {saved?.text.trim() ? <details><summary className="cursor-pointer text-sm text-primary">旧公共总结原文 · 人工分类整理</summary><p className="whitespace-pre-wrap py-2 text-sm">{saved.text}</p><p className="text-sm text-muted-foreground">原文完整保留，不自动拆分或进入新报告。采用后请编辑核对，不覆盖已写正文。</p><div className="flex flex-wrap gap-2 py-2"><Btn size="sm" onClick={() => teaching.set([teaching.value, saved.text].filter(Boolean).join('\n'))}>追加到教学介绍</Btn><Btn size="sm" onClick={() => learning.set([learning.value, saved.text].filter(Boolean).join('\n'))}>追加到学情介绍</Btn></div></details> : null}
  </section>
}
