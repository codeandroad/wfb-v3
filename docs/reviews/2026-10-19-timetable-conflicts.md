# 2026-10-19 课表冲突提示与行政归属范围独立审查

- Reviewer：`timetable_review`，未参与实现，除本记录外不修改文件。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；本次为同一未提交工作区的后续修复，重点审查冲突与归属增量。
- 状态：初审及修复复审完成，无剩余必须修复项；人工视觉验收仍待进行。
- 指令：已读取适用的仓库与父目录 AGENTS，遵循当前用户要求；没有提交代码。

## 实际阅读

`lib/timetable/conflict-display.ts`、`lib/timetable/data.ts`、`components/timetable/week-grid.tsx`、`components/timetable/overview-panel.tsx`、`app/(app)/timetable/my/page.tsx` 的当前实现和差异；关联读取 `lib/mt/model.ts` 的任务/日期成员关系、`lib/mt/store.tsx` 的加载状态、`lib/teaching/store.tsx` 的教学班/分工/归属/名单规则、`lib/timetable/calendar-store.ts` 的调休与停课投影、`lib/timetable/store.tsx` 的学校/教师课表来源、`components/providers.tsx`。

## 必须修复

1. **TC-01 / P2：旧 studentGroup 判断压过逐日名单并绕过 namespace 隔离。** 初版 `assessSchedule` 先保留 `detectConflicts` 产生的 student 冲突，后续名单只补充、不撤销。独立复现：两卡同 studentGroup、不同教师/教室同节，在“同 mt 域名单完全分离”“mt/catalog 不同域”“一侧当日名单为空”三种情况中均返回学生冲突。实现已在 assessSchedule 中剔除旧 studentGroup 快路径，学生冲突仅由同 namespace 的当日名单交集产生。复审运行覆盖以上三种反例的回归测试，均通过。状态：RESOLVED。
2. **TC-02 / P2：名单加载失败仍可能使用种子/旧名单作确定判断。** WeekGrid 无条件传入 `mt.biz.memberships`；MtProvider 在 ready=false 或 loadFail 时保留 freshBiz/旧状态。教务课表不会由我的教学错误页阻挡。实现已在 WeekGrid 中仅于 mt.ready && !mt.loadError 时传任务名单，否则传 null；entryStudentRoster 对 null 不回退 catalog。教师/教室检测仍保留。已阅读调用边界并运行 null 名单回归测试。状态：RESOLVED。

## 已确认的边界

- 行政班聚合从全校教师来源取课次，再按显式教学班 placement 归属筛选；不再把任课教师全部课程归入该行政班。
- 任务 ID 存在时，名单取任务的逐日成员关系；无有效任务不静默回退另一学生数据域。
- 学生名单以 mt/catalog namespace 区分；同节不应单独构成学生冲突证据。
- WeekGrid 先完整投影校历，再排除停课/搬走来源课次进行判断，随后才施加显示筛选；隐藏课卡不应消除完整范围的提示。
- 明确教师、教室冲突采用红色文字/边框；未知学生关系使用待核对提示；同时保留原显示样式。
- 行政班 SourceBar 已明确“仅汇总明确归属本班的教学课次；走班学生的实际去向可能不同”，避免将行政归属等同实际学生去向。

## 验证与限制

- 已独立执行 TC-01 的三个反例，均复现初版缺陷。
- 未执行浏览器或人工截图验收，不声称视觉验收通过。
- 独立执行 `node --test tests/timetable-conflicts.test.cjs tests/timetable-display.test.cjs`：27/27 PASS，其中本轮冲突测试 13 项，上一轮样式/检索回归 14 项。
- 独立执行研究组日课表 SSR 回归（`rendered daily timetable`）：1/1 PASS。测试环境补入真实根布局已有的 TeachingProvider，未删除原断言。
- `git diff --check`：PASS。
- 全量测试/构建以实施证据索引记录为准；未将局部通过冒称全量通过。

## 复审增量实现指纹

当前尚未提交，不存在本轮 Review commit SHA。以下 5 个实现文件按相对路径排序，以 `sha256  path\n` 清单计算指纹。

- 指纹：`1eabd49a958881c71da4020f267964bdcbaaeed93fea81a31542af3641bbcaef`

```text
9bbe688c29dcaa81f463758cb65d23dd3f34022ddfa45bf764c83afbe864241a  app/(app)/timetable/my/page.tsx
8b7aeda6b0a606cba1ee10a78649673349eb0357c4622829a4c463278f5554bd  components/timetable/overview-panel.tsx
8ace045459f0d23291b8bf8f2897d7036bb6688f290b614d2fdc922d6ca88ba4  components/timetable/week-grid.tsx
f320e4adbc18197371383f1a10b7e6495f761ed0c5b0601980f7294435b6358a  lib/timetable/conflict-display.ts
d3ccf4f58c452a07600b90f17007db691d34f59b2eb37c4cf757926e70c60356  lib/timetable/data.ts
```
