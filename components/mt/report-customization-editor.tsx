"use client";
import { useEffect, useState } from "react";
import { useMt } from "@/lib/mt/store";
import { ATT_LABEL, SUBMISSION_LABEL } from '@/lib/mt/model';
import { SYSTEM_REVS } from "@/lib/mt/schemes";
import {
  DEFAULT_METADATA,
  FIELDS,
  INITIAL_RULES,
  colorValue,
  type ElementStyle,
  type FormatRule,
} from "@/lib/mt/report-customization";
import type { ReportTemplate, FrozenReport } from "@/lib/mt/reports";
import { Btn, inputCls } from "./ui";

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const invalid = !!draft && !colorValue(draft);
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <div className="flex gap-2">
        <input
          aria-label={`${label}取色`}
          type="color"
          value={value ?? "#263a33"}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
        />
        <input
          className={inputCls}
          aria-label={`${label} HEX或RGB`}
          aria-invalid={invalid}
          placeholder="继承；HEX / RGB"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value) onChange(undefined);
            else {
              const c = colorValue(e.target.value);
              if (c) onChange(c);
            }
          }}
        />
      </div>
      {invalid ? <span role="alert">颜色无效，预览保留最后有效值</span> : null}
    </label>
  );
}
function NumericInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value?: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const invalid =
    draft !== "" &&
    (!Number.isFinite(Number(draft)) ||
      Number(draft) < min ||
      Number(draft) > max);
  return (
    <label className="text-sm">
      {label}
      <input
        aria-label={`元素${label}`}
        aria-invalid={invalid}
        className={inputCls}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        placeholder="继承"
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          if (text === "") onChange(undefined);
          else if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
      {invalid ? (
        <span role="alert">
          请输入 {min}–{max}，预览保留有效值
        </span>
      ) : null}
    </label>
  );
}
export function ReportCustomizationEditor({
  value,
  onChange,
  currentReport,
}: {
  currentReport?: FrozenReport;
  value: ReportTemplate;
  onChange: (t: ReportTemplate) => void;
}) {
  const mt = useMt(),
    c = value.customization ?? {},
    [target, setTarget] = useState("metadata");
  const tables =
    value.kind === "personal"
      ? ["classroom", "homework", "lessons"]
      : ["classroom", "homework"];
  const tableNames: Record<string, string> = {
    classroom: "课堂表",
    homework: "作业表",
    lessons: "课次明细",
  };
  const available: Record<string, string[]> = {
    classroom:
      value.kind === "class"
        ? ["date", "name", "attendance", "classroom", "quality"]
        : ["date", "attendance", "classroom"],
    homework: [
      ...(value.kind === "class" ? ["name"] : []),
      "assignment",
      "date",
      ...(value.kind === "personal" ? ["deadline"] : []),
      "submission",
      "quality",
      "score",
      "feedback",
    ],
    lessons: [
      "date",
      "lesson",
      "time",
      "location",
      "attendance",
      "observation",
    ],
  };
  const targets = [
    ["metadata", "元信息 · 共同默认样式"],
    ...(c.metadata??DEFAULT_METADATA).map(row=>[`metadata.${row.id}`,`元信息 · ${row.label}`]),
    ...tables.map((t) => [`${t}.title`, `${tableNames[t]} · 模块标题`]),
    ...tables.flatMap((table) =>
      available[table].flatMap((field) =>
        ["header", "body"].map((part) => [
          `${table}.${field}.${part}`,
          table==='homework'&&field==='assignment'&&part==='body'?'作业名称 · 内容／矩阵小字（默认 10 号）':`${tableNames[table]} · ${FIELDS[field as keyof typeof FIELDS]} · ${part === "header" ? "表头" : "正文"}`,
        ]),
      ),
    ),
    ...[
      "teaching",
      "learning",
      "highlights",
      ...(value.kind === "personal" ? ["comment", "next"] : []),
    ].flatMap((key) =>
      ["title", "body"].map((part) => [
        `${key}.${part}`,
        `${({ teaching: "教学介绍", learning: "学情介绍", highlights: "亮点", comment: "个人评语／观察", next: "后续说明" } as Record<string, string>)[key]} · ${part === "title" ? "标题" : "正文"}`,
      ]),
    ),
  ];
  const style = c.elements?.[target] ?? {};
  const update = (patch: Partial<ElementStyle>) => {
    const next = { ...style, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k as keyof ElementStyle] === undefined)
        delete next[k as keyof ElementStyle];
    });
    onChange({
      ...value,
      customization: { ...c, elements: { ...c.elements, [target]: next } },
    });
  };
  const rules = c.rules ?? [];
  const setRules = (next: FormatRule[]) =>
    onChange({ ...value, customization: { ...c, rules: next } });
  const revisions = [...SYSTEM_REVS, ...Object.values(mt.biz.schemes.revs)];
  const facts=(currentReport?.tables??[]).flatMap(t=>(t.facts??[]).flat()).flatMap(f=>f?[f,...(f.related??[]),...(f.parts??[]).flatMap(p=>p.fact?[p.fact]:[])]:[]);
  const activeRevisions=(field:string)=>revisions.filter(r=>facts.some(f=>f.field===field&&f.revision===r.id));
  return (
    <div className="flex flex-col gap-3">
      <details><summary className="cursor-pointer font-semibold">元信息内容</summary><div className="flex flex-col gap-3 py-3"><p className="text-sm text-muted-foreground">系统行自动使用当前报告的已保存数据；每行可在元素细调中独立设置样式。自定义内容随样式保存。</p>{(c.metadata??DEFAULT_METADATA).map((row,index)=><div key={row.id} className="flex flex-wrap items-center gap-2"><span>{row.label}</span>{row.source==='custom'?<><input aria-label="自定义元信息标签" className={inputCls} value={row.label} maxLength={100} onChange={e=>onChange({...value,customization:{...c,metadata:(c.metadata??DEFAULT_METADATA).map((r,i)=>i===index?{...r,label:e.target.value}:r)}})}/><input aria-label="自定义元信息内容" className={inputCls} value={row.text??''} maxLength={500} placeholder="例如教师联系电话" onChange={e=>onChange({...value,customization:{...c,metadata:(c.metadata??DEFAULT_METADATA).map((r,i)=>i===index?{...r,text:e.target.value}:r)}})}/></>:<span className="text-sm text-muted-foreground">系统字段（自动读取）</span>}<Btn size="sm" onClick={()=>onChange({...value,customization:{...c,metadata:(c.metadata??DEFAULT_METADATA).filter((_,i)=>i!==index)}})}>删除行</Btn></div>)}<div className="flex flex-wrap gap-2"><Btn size="sm" disabled={(c.metadata??DEFAULT_METADATA).length>=20} onClick={()=>onChange({...value,customization:{...c,metadata:[...(c.metadata??DEFAULT_METADATA),{id:crypto.randomUUID(),source:'custom',label:'联系电话',text:''}]}})}>添加自定义行</Btn><Btn size="sm" onClick={()=>onChange({...value,customization:{...c,metadata:[...DEFAULT_METADATA,...(c.metadata??[]).filter(r=>r.source==='custom')]}})}>恢复系统三行</Btn></div></div></details>
      <details>
        <summary className="cursor-pointer font-semibold">元素细调</summary>
        <div className="flex flex-col gap-3 py-3">
          <label className="text-sm">
            编辑元素
            <select
              aria-label="报告样式元素"
              className={inputCls}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {targets.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div
            className="grid gap-3 sm:grid-cols-2"
            key={`${value.id}:${target}`}
          >
            <ColorInput
              label="文字颜色"
              value={style.color}
              onChange={(color) => update({ color })}
            />
            <ColorInput
              label="文字背景颜色"
              value={style.background}
              onChange={(background) => update({ background })}
            />
            <ColorInput label="单元格背景颜色" value={style.cellBackground} onChange={cellBackground=>update({cellBackground})}/>
            {(
              [
                ["size", "字号", 10, 36],
                ["padding", "内边距", 0, 24],
                ["lineHeight", "行高", 1, 2],
                ...(tables.some((t) => target.startsWith(`${t}.`)) &&
                target.endsWith(".body")
                  ? [
                      ["width", "列宽权重（设计像素）", 30, 600],
                      ["minHeight", "最小行高", 0, 240],
                    ]
                  : []),
              ] as [keyof ElementStyle, string, number, number][]
            ).map(([key, label, min, max]) => (
              <NumericInput
                key={key}
                label={label}
                min={min}
                max={max}
                step={key === "lineHeight" ? 0.1 : 1}
                value={style[key] as number | undefined}
                onChange={(n) => update({ [key]: n })}
              />
            ))}
            <label className="text-sm">
              字重
              <select
                className={inputCls}
                value={style.weight ?? ""}
                onChange={(e) =>
                  update({
                    weight: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              >
                <option value="">继承</option>
                <option value="400">常规</option>
                <option value="600">半粗</option>
              </select>
            </label>
            {target !== "metadata" ? (
              <label className="text-sm">
                对齐
                <select
                  className={inputCls}
                  value={style.align ?? ""}
                  onChange={(e) =>
                    update({
                      align:
                        (e.target.value as ElementStyle["align"]) || undefined,
                    })
                  }
                >
                  <option value="">继承</option>
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              size="sm"
              onClick={() => {
                const elements = { ...c.elements };
                delete elements[target];
                onChange({ ...value, customization: { ...c, elements } });
              }}
            >
              恢复此元素
            </Btn>
            <Btn
              size="sm"
              disabled={!style.cellBackground}
              onClick={() => {
                const elements = { ...c.elements };
                for (const [key] of targets.filter(([key]) =>
                  key.endsWith(".header"),
                ))
                  elements[key] = {
                    ...elements[key],
                    cellBackground: style.cellBackground,
                  };
                onChange({ ...value, customization: { ...c, elements } });
              }}
            >
              统一全部表头背景
            </Btn>
          </div>
          <p className="text-sm text-muted-foreground">
            空值表示继承；颜色与字号只修改报告呈现。条件格式后应用，同属性后面的规则优先。
          </p>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">条件格式</summary>
        <div className="flex flex-col gap-3 py-3">
          <Btn
            size="sm"
            onClick={() =>
              setRules([
                ...rules,
                ...INITIAL_RULES.filter(
                  (r) => !rules.some((x) => x.id === r.id),
                ),
              ])
            }
          >
            加入出勤与未交提示规则
          </Btn>
          {rules.map((rule, index) => {
            const patch = (p: Partial<FormatRule>) =>
              setRules(rules.map((r, i) => (i === index ? { ...r, ...p } : r)));
            return (
              <fieldset
                key={rule.id}
                className="flex flex-col gap-2 rounded border border-border p-3"
              >
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  <input
                    className={inputCls}
                    aria-label="规则名称"
                    value={rule.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </label>
                {rule.field === "classroom" || rule.field === "quality" ? (
                  <>
                    <label className="text-sm">
                      实际评价方案修订
                      <p>{activeRevisions(rule.field).find(r=>r.id===rule.revision)?.name??'此规则不属于当前报告采用的方案，请删除后重新添加'}{rule.revision?` · ${rule.revision}`:''}</p>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {activeRevisions(rule.field)
                        .find((r) => r.id === rule.revision)
                        ?.levels.map((l) => (
                          <label className="text-sm" key={l.id}>
                            <input
                              type="checkbox"
                              checked={rule.grades?.includes(l.id) ?? false}
                              onChange={(e) =>
                                patch({
                                  grades: e.target.checked
                                    ? [...(rule.grades ?? []), l.id]
                                    : (rule.grades ?? []).filter(
                                        (id) => id !== l.id,
                                      ),
                                })
                              }
                            />{" "}
                            {l.code} {l.label}
                          </label>
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">{Object.entries(rule.field==='attendance'?ATT_LABEL:{...SUBMISSION_LABEL,MISSING_CONFIRMED:'确认未交'}).filter(([key])=>key!=='MISSING').map(([key,label])=><label key={key} className="text-sm"><input type="checkbox" checked={rule.statuses?.includes(key)??false} onChange={e=>patch({statuses:e.target.checked?[...(rule.statuses??[]),key]:(rule.statuses??[]).filter(s=>s!==key)})}/>{label}</label>)}</div>
                )}
                {rule.field==='quality'?<fieldset className="flex flex-wrap gap-2"><legend className="text-sm">同时满足提交情况（不选表示不限）</legend>{(['ON_TIME','LATE','SUBMITTED'] as const).map(status=><label key={status} className="text-sm"><input type="checkbox" checked={rule.submissionStatuses?.includes(status)??false} onChange={e=>patch({submissionStatuses:e.target.checked?[...(rule.submissionStatuses??[]),status]:(rule.submissionStatuses??[]).filter(s=>s!==status)})}/>{SUBMISSION_LABEL[status]}</label>)}</fieldset>:null}
                <ColorInput
                  key={`${rule.id}-text`}
                  label="命中文字"
                  value={rule.style.color}
                  onChange={(color) =>
                    patch({ style: { ...rule.style, color } })
                  }
                />
                <ColorInput
                  key={`${rule.id}-bg`}
                  label="命中文字背景"
                  value={rule.style.background}
                  onChange={(background) =>
                    patch({ style: { ...rule.style, background } })
                  }
                />
                <ColorInput label="命中单元格背景" value={rule.style.cellBackground} onChange={cellBackground=>patch({style:{...rule.style,cellBackground}})}/>
                <NumericInput label="命中字号" min={10} max={36} step={1} value={rule.style.size} onChange={size=>patch({style:{...rule.style,size}})}/><label className="text-sm">命中字重<select className={inputCls} value={rule.style.weight??''} onChange={e=>patch({style:{...rule.style,weight:e.target.value?Number(e.target.value):undefined}})}><option value="">继承</option><option value="400">常规</option><option value="600">半粗</option><option value="700">加粗</option></select></label>
                <div className="flex gap-2">
                  <Btn
                    size="sm"
                    onClick={() =>
                      setRules(rules.filter((_, i) => i !== index))
                    }
                  >
                    删除
                  </Btn>
                  <Btn
                    size="sm"
                    disabled={index === rules.length - 1}
                    onClick={() => {
                      const next = [...rules];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      setRules(next);
                    }}
                  >
                    提高优先级
                  </Btn>
                </div>
              </fieldset>
            );
          })}
          <div className="flex flex-wrap gap-2">
            {(["attendance", "classroom", "submission", "quality"] as const).map((field) => (
              <Btn
                key={field}
                disabled={(field==='classroom'||field==='quality')&&!activeRevisions(field).length}
                size="sm"
                onClick={() =>
                  setRules([
                    ...rules,
                    ...(field==='classroom'||field==='quality'?activeRevisions(field):[undefined]).map(revision=>({id:crypto.randomUUID(),name:`${FIELDS[field]}规则${revision?` · ${revision.name}`:''}`,field,revision:revision?.id,enabled:true,style:{color:'#166534'}})),
                  ])
                }
              >
                添加{FIELDS[field]}规则
              </Btn>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
