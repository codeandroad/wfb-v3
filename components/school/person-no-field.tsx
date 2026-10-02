"use client"

import { Field, Input } from "@/components/kit"
import { Button } from "@/components/ui/button"
import { CURRENT_SCHOOL } from "@/lib/school/instance"
import {
  PERSON_DATE_LABEL,
  PERSON_TYPE_LABEL,
  checkPersonNo,
  formatYyyymm,
  nextSerialPreview,
  patternFor,
  yyyymmOf,
  type PersonType,
} from "@/lib/school/person-no"
import { AlertCircle, CheckCircle2, Eraser, Info, Lock, PencilLine, Sparkles } from "lucide-react"
import { useId, useState } from "react"

/**
 * 新增学生 / 教职工共用的编号字段。
 * 两种方式：填写已有编号（逐项校验）或留空（创建成功后按首次正式入学 / 入职年月自动生成）。
 * 错误时只说明原因并给出“修改编号 / 清空改为自动生成”，绝不静默改写用户输入。
 */
export function PersonNoField({
  type,
  value,
  onChange,
  sourceDate,
  showErrors,
  className,
}: {
  type: PersonType
  value: string
  onChange: (v: string) => void
  sourceDate: string
  showErrors: boolean
  className?: string
}) {
  const id = useId()
  const [blurred, setBlurred] = useState(false)
  const check = checkPersonNo(value, type, sourceDate)
  const yyyymm = yyyymmOf(sourceDate)
  const reveal = showErrors || blurred
  const invalid = check.status === "invalid" && reveal
  const label = type === "S" ? "学号" : "员工编号"

  return (
    <Field label={`${label}（可选）`} htmlFor={id} className={className}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setBlurred(true)}
        placeholder={`留空则自动生成，或填写已有编号，如 ${CURRENT_SCHOOL.code}202609088${type}`}
        className="font-mono tracking-wide"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={`${id}-state`}
      />

      <div id={`${id}-state`} aria-live="polite">
        {check.status === "empty" ? (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <p className="leading-relaxed">
              创建成功后自动生成：
              <span className="mx-1 font-mono font-medium text-foreground">{patternFor(type, yyyymm)}</span>
              {yyyymm ? (
                <>
                  （按{PERSON_DATE_LABEL[type]}年月 {formatYyyymm(yyyymm)}；该段{PERSON_TYPE_LABEL[type]}流水号当前预计从{" "}
                  <span className="font-mono">{nextSerialPreview(type, yyyymm)}</span> 起，最终以创建结果为准）
                </>
              ) : (
                <>（请先填写{PERSON_DATE_LABEL[type]}日期）</>
              )}
            </p>
          </div>
        ) : null}

        {check.status === "valid" ? (
          <div className="flex flex-col gap-1 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-[12.5px]">
            <p className="flex items-center gap-1.5 font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              编号格式正确且未被占用，可使用
            </p>
            {check.monthMismatch && yyyymm ? (
              <p className="flex items-start gap-1.5 leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                提示：编号中的年月 {formatYyyymm(check.yyyymm)} 与{PERSON_DATE_LABEL[type]}年月 {formatYyyymm(yyyymm)}{" "}
                不一致，请确认是否为该人员的原有编号。
              </p>
            ) : null}
          </div>
        ) : null}

        {check.status === "invalid" && !reveal ? (
          <p className="text-xs text-muted-foreground/80">输入完成后将校验编号。</p>
        ) : null}

        {invalid && check.status === "invalid" ? (
          <div role="alert" className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[12.5px]">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <p className="font-medium text-destructive">{check.title}</p>
                <p className="leading-relaxed text-foreground/80">{check.detail}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-5">
              <span className="text-xs text-muted-foreground">你可以：</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => document.getElementById(id)?.focus()}>
                <PencilLine className="size-3" />
                修改编号
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  onChange("")
                  setBlurred(false)
                }}
              >
                <Eraser className="size-3" />
                清空，改为自动生成
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <NoStructure type={type} />
    </Field>
  )
}

function NoStructure({ type }: { type: PersonType }) {
  const parts = [
    { k: CURRENT_SCHOOL.code, d: "学校代码" },
    { k: "YYYYMM", d: `${PERSON_DATE_LABEL[type]}年月` },
    { k: "NNN", d: "流水号 001–999" },
    { k: type, d: PERSON_TYPE_LABEL[type] },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span className="mr-1">编号结构</span>
      {parts.map((p) => (
        <span key={p.k} className="inline-flex items-baseline gap-1 rounded bg-muted px-1.5 py-0.5">
          <span className="font-mono font-semibold text-foreground">{p.k}</span>
          <span>{p.d}</span>
        </span>
      ))}
      <span className="basis-full pt-0.5 text-muted-foreground/70">
        {type === "S"
          ? "年级、行政班、教学班、课程体系变化不会重新编号；学生与教职工流水号互相独立。"
          : "部门、职务、任教学科、班主任身份、权限角色变化不会重新编号；教职工与学生流水号互相独立。"}
      </span>
    </div>
  )
}

/** 已创建人员的正式编号展示：稳定值，不能在普通资料编辑中修改。 */
export function FormalNoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground" title="正式编号创建后保持稳定，不能在资料编辑中修改">
      <Lock className="size-3" aria-hidden />
      正式编号 · 不可编辑
    </span>
  )
}
