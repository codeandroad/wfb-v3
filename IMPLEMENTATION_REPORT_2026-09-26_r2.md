# 原型实施报告 · 教学 UI 全量重构（R2）

- 执行日期：2026-09-26
- 交接包：PROTOTYPE_TEACHING_UI_FULL_HANDOFF_2026-09-26_r2
- 性质：交互原型（模拟登录、权限与发布，未接入真实服务）。本轮为本原型的**完整替代实现**，不拼接旧建班向导、官方单元组或旧字段顺序，不做旧数据兼容，不执行上一份交接包中的 Codex 生产实施任务。

---

## 1. 交付范围与结论

本轮按 R2 提示词与配套规范（UI_DESIGN、GRID_IMPORT_SPEC、OWNER_VERIFICATION、contracts）完成教学 UI 主链路重构，并以 `contracts/demo_fixture.json` 为唯一数据事实来源重建模拟数据。所有强制项均可操作，路由全部编译通过（HTTP 200）：`/`、`/school`、`/teaching`、`/timetable`、`/timetable/my`。

强制项落地情况：

| 强制项 | 状态 | 位置 |
| --- | --- | --- |
| 最小建班抽屉（不含官方单元组/旧字段） | 已实现 | `components/school/teaching-class-create-sheet.tsx` |
| 教学班详情工作台（教学安排/学生名单/基本信息 + 按需教学分工） | 已实现 | `components/school/teaching-class-workspace.tsx` |
| 我的教学（本人分工派生、整门班无显示菜单） | 已实现 | `app/(app)/teaching/page.tsx` |
| 行政班课表双视图（归属安排 / 学生实际去向） | 已实现 | `components/school/homeroom-timetable-sheet.tsx` |
| 教师「我的课表」一级入口 | 已实现 | 侧栏「我的课表」→ `/timetable/my` |
| 本人导入（教师视角）与学校导入（班级视角） | 已实现 | `components/timetable/import-workspace.tsx`（mode=personal/school） |
| 双端真实拖拽（指针拖拽，非模拟） | 已实现并实测 | `components/timetable/week-grid.tsx` 手动调整模式 |
| 结构化发布（全体/部分/按生效日） | 已实现 | 课表中心「发布与更新」+ `lib/timetable/store.tsx` |
| 教师一键更新（采用新版本 + 差异保留个人调整） | 已实现 | `/timetable/my` 采用流程 |

---

## 2. 数据事实来源（重建，不兼容旧数据）

新增 `lib/teaching/store.tsx`，直接以 `contracts/demo_fixture.json` 为种子：课程、教学班、教学分工（任课/共同任课/代课）、学生范围、排课事件与作息表。关键派生规则：

- **任教安排摘要**：按「教师 / 单元」聚合并去重展示，如「林老师/P1、周老师/S1」。
- **学生计数**：按稳定目标去重（同一学生多单元不重复计数），如高一1班·数学 = 16。
- **归属 ≠ 去向**：行政班「归属安排」显示本班容器课次；「学生实际去向」按落点聚合，跨班教学班（英语强化B班、数学竞赛A班）计入实际去向格的人数（12/20/8/2 人去向）。

演示数据均为「示例」前缀虚构主体，不含真实个人信息，不连接生产 API / 数据库 / 消息服务。

---

## 3. 主要变更清单

新增：
- `lib/teaching/store.tsx` — fixture 驱动的教学域 store（含 `tasksForTeacher`、`weeklySchedule`、`placementEvents`、`destinationEvents`、个人显示偏好）。
- `components/school/homeroom-timetable-sheet.tsx` — 行政班课表双视图抽屉。
- `IMPLEMENTATION_REPORT_2026-09-26_r2.md` — 本报告。

重写：
- `components/school/teaching-class-create-sheet.tsx` — 最小建班抽屉。
- `components/school/teaching-class-workspace.tsx` — 三页签工作台 + 按需教学分工编辑。
- `components/school/teaching-class-panel.tsx` — 列表 + 工作台 + 建班入口。
- `app/(app)/teaching/page.tsx` — 我的教学（分工派生、整门班无显示菜单）。

改动：
- `components/providers.tsx` — 注册 TeachingProvider。
- `components/school/admin-class-panel.tsx` — 行政班卡片加「课表」入口并挂载双视图。

复用（实测可用，未重写）：
- 课表中心与发布/采用子系统：`lib/timetable/store.tsx`、`components/timetable/week-grid.tsx`、`components/timetable/import-workspace.tsx`、`components/timetable/overview-panel.tsx`。

---

## 4. 实测证据（浏览器真实操作）

均在预览环境 1150×807、light 模式下实机执行，DOM 文本与截图一并核对：

1. **教学班列表** `/tmp/agent-browser/tc-list.png` — 列头与摘要符合规范：`教学班｜学科｜排课归属｜本期课程｜任教安排｜学生｜操作`；摘要「林老师/P1、周老师/S1」，未设课程显示「设置课程」。
2. **最小建班抽屉** — 仅班组标识/学科/名称等最小字段，无官方单元组、无旧字段顺序；选择排课归属后名称自动建议。
3. **工作台** `/tmp/agent-browser/tc-workspace.png` — 新建空班落在「教学安排」页签：未设课程、未指定教师、0 学生、空分工、可「添加教学分工」。
4. **行政班双视图** `/tmp/agent-browser/homeroom-tt.png`（归属安排）与 `/tmp/agent-browser/homeroom-dest.png`（学生实际去向）— 同一行政班两视图内容明显不同，去向视图出现跨班教学班与人数。
5. **我的课表 + 发布** `/tmp/agent-browser/publish-panel.png`、`/tmp/agent-browser/my-schedule.png` — 发布版本、生效日、变更教师、结构化发布动作与撤回；教师端显示采用/个人调整/导入/手动调整与 9/28 待更新标记。
6. **双端真实拖拽** `/tmp/agent-browser/drag-after.png` — 进入「手动调整」后，将「高一1班 M1」指针拖拽至周三第3节，卡片实际移动并标记「手动调整」，撤销/保存草稿/确认应用随变更计数启用。

---

## 5. 边界与后续核验建议

- 本轮为交互原型：登录、权限、发布、通知均为模拟；导入仅读取标准 .xlsx 数值，不执行公式。
- 建议核验重点：建班抽屉字段最小性、任教摘要去重、归属/去向差异、拖拽落点冲突不静默覆盖、教师采用后个人调整保留。
- 可运行预览：侧栏「学校管理 / 我的教学 / 课表中心 / 我的课表」四入口贯穿全链路。

等待核验。
