import { classicMatrix, homeworkCheckDate } from "./report-classic-data";
import type { MtBiz } from "./store";
import type { TaskWeek } from "./derive";
import {
  ATT_LABEL,
  feedbackPeriodId,
  lessonTimeLabel,
  studentById,
  HOMEROOMS,
  requirementOf,
  SUBMISSION_LABEL,
  type StudentDay,
  type Assignment,
  type LessonView,
} from "./model";
import { classroomRevFor, revById, levelOf, parentText } from "./schemes";
import { hwStatus } from "./hw";
import { validHighlights } from "./publish";
import { reportOptions } from "./report-options";
import type { ReportTable, ReportTemplate, Preparation } from "./reports";

export const reportDate = (date: string, full = false) =>
  `${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(date + "T12:00:00+08:00").getUTCDay()]} ${full ? date : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`}`;
export function reportTables(
  b: MtBiz,
  tws: TaskWeek[],
  sid: string | undefined,
  template: ReportTemplate,
  excluded: { assignmentId: string; studentId: string }[] = [],
  prep?: Preparation,
): ReportTable[] {
  const tables: ReportTable[] = [],
    o = reportOptions(template),
    preset = template.preset ?? template.id,
    now = Date.parse(b.clock);
  const header = (texts: string[]) => texts.map((text) => ({ text }));
  const dateText = (date: string) => reportDate(date, o.dateFormat === "full");
  for (const tw of tws) {
    const ids = sid ? tw.students.filter((id) => id === sid) : tw.students;
    if (!ids.length) continue;
    const dates = [...new Set(tw.days.map((d) => d.date))].sort();
    const rev = revById(
      classroomRevFor(
        b.schemes,
        tw.task.id,
        tw.task.teacher_id,
        feedbackPeriodId(tw.week),
        tw.week,
      ).revId,
    );
    const lessonAtt = (d: StudentDay, l: LessonView) =>
      d.state === "NOT_APPLICABLE"
        ? "不适用"
        : /cancel/i.test(l.status)
          ? "取消"
          : /suspend/i.test(l.status)
            ? "停课"
            : l.startTs > now
              ? "未发生"
              : l.endTs > now
                ? "进行中"
                : d.rec.att[l.id]
                  ? o.normalShort && d.rec.att[l.id].v === "NORMAL"
                    ? "√"
                    : ATT_LABEL[d.rec.att[l.id].v]
                  : "待核对";
    const attendance = (d: StudentDay | undefined) =>
      !d || d.state === "NOT_APPLICABLE"
        ? "不适用"
        : d.lessons
            .map((l) => `${lessonTimeLabel(l)}：${lessonAtt(d, l)}`)
            .join("\n");
    const grade = (d: StudentDay | undefined) => {
      if (!d || d.state === "NOT_APPLICABLE") return "不适用";
      if (d.elig.kind === "ABSENT") return "无需评价";
      if (!d.elapsed.length)
        return d.lessons.some((l) => l.startTs <= now && l.endTs > now)
          ? "进行中"
          : "未发生";
      if (d.handlingEff === "EXPLICIT_EMPTY") return "明确不评价";
      const level =
        d.gradeEff &&
        d.elig.kind === "ELIGIBLE" &&
        d.handlingEff === "CONFIRMED"
          ? levelOf(rev, d.gradeEff)
          : null;
      return level && rev
        ? o.gradeText
          ? parentText(rev, level)
          : level.code
        : d.gradeEff && d.handlingEff === "CONFIRMED"
          ? `${d.gradeEff}（标准待核对）`
          : "未记录";
    };
    const assignments = tw.assignments.filter(
      (a) =>
        !a.deadline ||
        Date.parse(a.deadline) <= now ||
        ids.some((id) => !!a.results[id]?.submission),
    );
    const result = (a: Assignment, id: string) => {
      if (!a.recipients.includes(id)) return ["不适用", "不适用", "", ""];
      if (excluded.some((x) => x.assignmentId === a.id && x.studentId === id))
        return ["本次暂不纳入", "不适用", "", ""];
      const r = a.results[id],
        status = hwStatus(a, id, now),
        scheme = revById(a.schemeRevId);
      const submitted =
        !!r?.submission &&
        r.submission !== "MISSING" &&
        requirementOf(a, id) !== "EXEMPT" &&
        r.participating !== false;
      const level = submitted && r.quality ? levelOf(scheme, r.quality) : null;
      return [
        submitted ? SUBMISSION_LABEL[r.submission!] : status.label,
        level && scheme
          ? o.gradeText
            ? parentText(scheme, level)
            : level.code
          : submitted
            ? r.noGrade
              ? "明确不评价"
              : "待评价"
            : "不适用",
        submitted && r.score != null ? String(r.score) : "",
        r?.note ?? "",
      ];
    };
    const homeworkDateFields = sid
      ? o.homeworkDateMode === "both"
        ? ["date", "deadline"]
        : o.homeworkDateMode === "check"
          ? ["date"]
          : ["deadline"]
      : ["date"];
    const homeworkDateLabels = sid
      ? o.homeworkDateMode === "both"
        ? ["检查日期", "有效截止"]
        : o.homeworkDateMode === "check"
          ? ["检查日期"]
          : ["有效截止"]
      : [o.classic ? "检查日期" : "有效截止"];
    const homeworkDateValues = (a: Assignment, id: string) => {
      const check = homeworkCheckDate(a, prep) || "未设置",
        deadline =
          (a.results[id]?.extDeadline ?? a.deadline)?.slice(0, 10) || "未设置";
      return sid
        ? o.homeworkDateMode === "both"
          ? [check, deadline]
          : o.homeworkDateMode === "check"
            ? [check]
            : [deadline]
        : [o.classic ? check : deadline];
    };
    const identityTitles = [
      ...(o.numbering ? ["序号"] : []),
      "姓名",
      ...(o.studentCode ? ["学号"] : []),
      ...(o.homeroom ? ["来源行政班"] : []),
    ];
    const identity = (id: string, i: number) => [
      ...(o.numbering ? [String(i + 1)] : []),
      studentById(id)?.name ?? "未知姓名",
      ...(o.studentCode ? ["未提供"] : []),
      ...(o.homeroom
        ? [
            HOMEROOMS.find((h) => h.id === studentById(id)?.homeroom_id)
              ?.name ?? "未提供",
          ]
        : []),
    ];
    if (sid) {
      tables.push({
        kind: "classroom",
        fields: ["date", "attendance", "classroom"],
        title: tws.length === 1 ? "课堂记录" : `${tw.task.label} · 课堂记录`,
        headers: [header(["日期", "出勤", "本日课堂评价"])],
        facts: dates.map((date) => {
          const d = tw.byStudent[sid]?.find((d) => d.date === date),
            states = [
              ...new Set(
                d?.elapsed.map((l) => d.rec.att[l.id]?.v).filter(Boolean),
              ),
            ];
          return [
            undefined,
            {
              field: "attendance",
              status: states.length === 1 ? states[0] : undefined,
              parts:d&&d.state!=='NOT_APPLICABLE'?[...new Map(d.lessons.map(l=>[lessonAtt(d,l),l])).entries()].flatMap(([text,l],i)=>[...(i?[{text:' / '}]:[]),{text,fact:{field:'attendance',status:l.endTs<=now?d.rec.att[l.id]?.v:undefined}}]):undefined,
            },
            {
              field: "classroom",
              revision: rev?.id,
              grade:
                d?.elig.kind === "ELIGIBLE" &&
                d.handlingEff === "CONFIRMED" &&
                d.elapsed.length
                  ? (d.gradeEff ?? undefined)
                  : undefined,
            },
          ];
        }),
        rows: dates.map((date) => {
          const d = tw.byStudent[sid]?.find((d) => d.date === date);
          return [
            dateText(date),
            d
              ? [...new Set(d.lessons.map((l) => lessonAtt(d, l)))].join(" / ")
              : "–",
            grade(d),
          ];
        }),
      });
      if (o.lessons)
        tables.push({
          kind: "lessons",
          fields: [
            "date",
            "lesson",
            ...(o.lessonTimes ? ["time"] : []),
            ...(o.location ? ["location"] : []),
            "attendance",
            "observation",
          ],
          facts: (tw.byStudent[sid] ?? []).flatMap((d) =>
            d.lessons.map((l) => [
              undefined,
              undefined,
              ...(o.lessonTimes ? [undefined] : []),
              ...(o.location ? [undefined] : []),
              {
                field: "attendance",
                status:
                  d.state !== "NOT_APPLICABLE" && l.endTs <= now
                    ? d.rec.att[l.id]?.v
                    : undefined,
              },
              undefined,
            ]),
          ),
          title: tws.length === 1 ? "课次明细" : `${tw.task.label} · 课次明细`,
          headers: [
            header([
              "日期",
              "课次",
              ...(o.lessonTimes ? ["时间"] : []),
              ...(o.location ? ["地点"] : []),
              "出勤",
              "选入观察",
            ]),
          ],
          rows: (tw.byStudent[sid] ?? []).flatMap((d) =>
            d.lessons.map((l) => [
              dateText(d.date),
              `第${l.period.number}节${l.makeupFrom ? `\n补课来源 ${l.makeupFrom}` : ""}`,
              ...(o.lessonTimes ? [`${l.period.start}–${l.period.end}`] : []),
              ...(o.location ? [l.room ?? "未提供"] : []),
              lessonAtt(d, l),
              (prep?.observations ?? [])
                .filter((selection) => {
                  const source = b.observations[selection.key];
                  return (
                    source?.taskId === tw.task.id &&
                    source.authorId === tw.task.teacher_id &&
                    source.lessonId === l.id &&
                    (source.studentId === sid || source.studentId === null) &&
                    d.state !== "NOT_APPLICABLE" &&
                    d.elig.kind !== "ABSENT"
                  );
                })
                .map((x) => x.text.trim())
                .filter(Boolean)
                .join("\n"),
            ]),
          ),
        });
      if (preset === "P03") {
        const facts = (prep?.focus ?? [])
          .filter((f) => f.studentId === sid && f.taskId === tw.task.id)
          .flatMap((f) => {
            const day = tw.byStudent[sid]?.find((d) => d.date === f.source),
              a = assignments.find(
                (a) => a.id === f.source && a.recipients.includes(sid),
              );
            return day
              ? [
                  [
                    dateText(day.date),
                    `${attendance(day)}\n课堂：${grade(day)}`,
                    f.suggestion,
                  ],
                ]
              : a
                ? [
                    [
                      a.title,
                      result(a, sid).slice(0, 3).join(" · "),
                      f.suggestion,
                    ],
                  ]
                : [];
          });
        if (facts.length)
          tables.unshift({
            kind: "focus",
            title: `${tw.task.label} · 本次关注与建议`,
            headers: [header(["来源", "已记录事实", "教师建议"])],
            rows: facts,
          });
      }
    } else if (o.classic) {
      tables.push(classicMatrix(b, tw, template, prep, excluded));
    } else {
      const split = o.mode === "B",
        extras = [
          ...(o.highlights ? ["亮点"] : []),
          ...(o.homework === "inline" ? ["具体作业结果"] : []),
        ];
      const stable = [...identityTitles, ...extras].map((text) => ({
        text,
        rowSpan: split ? 2 : 1,
      }));
      tables.push({
        kind: "classroom",
        identityColumns: identityTitles.length,
        groupSize: split ? 2 : 1,
        title: `${tw.task.label} · ${preset === "C03" ? "紧凑对��" : "课堂矩阵"}`,
        headers: split
          ? [
              [
                ...stable.slice(0, identityTitles.length),
                ...dates.map((date) => ({ text: dateText(date), span: 2 })),
                ...stable.slice(identityTitles.length),
              ],
              header(dates.flatMap(() => ["出勤", "课堂表现"])),
            ]
          : [header([...identityTitles, ...dates.map(dateText), ...extras])],
        rows: ids.map((id, i) => [
          ...identity(id, i),
          ...dates.flatMap((date) => {
            const d = tw.byStudent[id]?.find((d) => d.date === date);
            return split
              ? [attendance(d), grade(d)]
              : [`出勤：${attendance(d)}\n课堂：${grade(d)}`];
          }),
          ...(o.highlights
            ? [
                validHighlights(b, tw, id)
                  .map(
                    (h) => `${h.date ? `${dateText(h.date)}：` : ""}${h.text}`,
                  )
                  .join("\n"),
              ]
            : []),
          ...(o.homework === "inline"
            ? [
                assignments
                  .map(
                    (a) =>
                      `${a.title}：${result(a, id).filter(Boolean).join(" · ")}`,
                  )
                  .join("\n"),
              ]
            : []),
        ]),
      });
    }
    if (!sid && preset === "C04") {
      tables.push({
        kind: "homework",
        identityColumns: identityTitles.length,
        groupSize: o.scores ? 3 : 2,
        title: `${tw.task.label} · 作业结果矩阵`,
        headers: [
          [
            ...identityTitles.map((text) => ({ text, rowSpan: 2 })),
            ...assignments.map((a) => ({
              text: a.title,
              span: o.scores ? 3 : 2,
            })),
          ],
          header(
            assignments.flatMap(() => [
              "提交",
              "质量",
              ...(o.scores ? ["分数"] : []),
            ]),
          ),
        ],
        rows: ids.map((id, i) => [
          ...identity(id, i),
          ...assignments.flatMap((a) =>
            result(a, id).slice(0, o.scores ? 3 : 2),
          ),
        ]),
      });
    }
    if (sid || (o.classic ? o.homeworkAppendix : o.homework === "separate"))
      tables.push({
        kind: "homework",
        fields: [
          ...(sid ? [] : ["name"]),
          "assignment",
          ...homeworkDateFields,
          ...(o.combinedHomework ? ["quality"] : ["submission", "quality"]),
          ...(o.scores ? ["score"] : []),
          ...(o.feedback ? ["feedback"] : []),
        ],
        facts: ids.flatMap((id) =>
          assignments
            .filter(
              (a) =>
                a.recipients.includes(id) &&
                !excluded.some(
                  (x) => x.assignmentId === a.id && x.studentId === id,
                ),
            )
            .map((a) => {
              const r = a.results[id],
                allowed =
                  !!r &&
                  !r.review &&
                  requirementOf(a, id) !== "EXEMPT" &&
                  r.participating !== false,
                submitted =
                  allowed && !!r.submission && r.submission !== "MISSING";
              return [
                ...(sid ? [] : [undefined]),
                undefined,
                ...homeworkDateFields.map(() => undefined),
                ...(o.combinedHomework
                  ? []
                  : [
                      {
                        field: "submission",
                        status: allowed
                          ? r.submission === "MISSING"
                            ? r.submissionConfirmed
                              ? "MISSING_CONFIRMED"
                              : undefined
                            : (r.submission ?? undefined)
                          : undefined,
                      },
                    ]),
                {
                  field: "quality",
                  related:submitted?[{field:'submission',status:r.submission??undefined}]:undefined,
                  parts:o.combinedHomework?[{text:result(a,id)[0],fact:{field:'submission',status:allowed?(r.submission==='MISSING'?(r.submissionConfirmed?'MISSING_CONFIRMED':undefined):r.submission??undefined):undefined}},{text:' · '},{text:result(a,id)[1],fact:{field:'quality',revision:submitted?a.schemeRevId??undefined:undefined,grade:submitted?r.quality??undefined:undefined,related:submitted?[{field:'submission',status:r.submission??undefined}]:undefined}}]:undefined,
                  revision: submitted
                    ? (a.schemeRevId ?? undefined)
                    : undefined,
                  grade: submitted ? (r.quality ?? undefined) : undefined,
                },
                ...(o.scores
                  ? [
                      {
                        field: "score",
                        score:
                          submitted && r.score != null ? r.score : undefined,
                      },
                    ]
                  : []),
                ...(o.feedback ? [undefined] : []),
              ];
            }),
        ),
        title: tws.length === 1 ? "作业明细" : `${tw.task.label} · 作业明细`,
        headers: [
          header([
            ...(sid ? [] : ["姓名"]),
            "作业",
            ...homeworkDateLabels,
            ...(o.combinedHomework ? ["提交与质量"] : ["提交情况", "质量评价"]),
            ...(o.scores ? ["已有分数"] : []),
            ...(o.feedback ? ["教师反馈"] : []),
          ]),
        ],
        rows: ids.flatMap((id) =>
          assignments
            .filter(
              (a) =>
                a.recipients.includes(id) &&
                !excluded.some(
                  (x) => x.assignmentId === a.id && x.studentId === id,
                ),
            )
            .map((a) => {
              const r = result(a, id);
              return [
                ...(sid ? [] : [studentById(id)?.name ?? "未知姓名"]),
                a.title,
                ...homeworkDateValues(a, id),
                ...(o.combinedHomework
                  ? [r.slice(0, 2).join(" · ")]
                  : r.slice(0, 2)),
                ...(o.scores ? [r[2]] : []),
                ...(o.feedback ? [r[3]] : []),
              ];
            }),
        ),
      });
  }
  if (o.classic)
    for (const table of tables)
      table.rows = table.rows.map((row) =>
        row.map((cell) =>
          /^(无需评价|不适用|未记录|待评价|明确不评价|未提供|未设置)$/.test(
            cell,
          )
            ? o.emptyValue === "blank"
              ? ""
              : "–"
            : cell,
        ),
      );
  if(template.options?.showHomeworkName===false)for(const table of tables){const col=table.fields?.indexOf('assignment')??-1;if(col<0)continue;table.fields!.splice(col,1);table.headers.forEach(row=>row.splice(col,1));table.rows.forEach(row=>row.splice(col,1));table.facts?.forEach(row=>row.splice(col,1))}
  return tables;
}
