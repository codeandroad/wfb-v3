# 原型实施报告 — 统一「课节信息」弹窗 (R4)

- 执行日期：2026-09-26
- 范围：本包（PROTOTYPE_PROMPT_2026-09-26_r4）完整替代本轮课节弹窗相关旧要求
- 状态：已在预览中实际验证，等待核验；未进入真实系统实施

## 一、目标与背景

参考的两张问题截图分别显示：

1. `01-current-edit-wrong.png`：已有课卡「调整」弹窗与新增弹窗结构不一致，标题下带有说明/位置/时间摘要，信息区缺失或顺序错乱。
2. `02-current-create-wrong.png`：空格「新增课次」使用另一套简化弹窗，缺少完整六个信息区。

本轮把两个入口合并为**同一个完整「课节信息」弹窗**。

## 二、核心要求落实情况

| # | 要求 | 落实 |
|---|------|------|
| 1 | 空格新增与已有课卡编辑共用同一个完整「课节信息」弹窗 | ✅ 新建 `components/timetable/lesson-dialog.tsx`，create/edit 两种模式共用 |
| 2 | 六个信息区、顺序、显示控制与保存逻辑一致 | ✅ 顺序：教学目标 → 生效范围 → 教学分工 → 自定义标签 → 备注 → 教室 |
| 3 | 标题下没有说明、位置或时间摘要 | ✅ 标题仅「课节信息」，`Modal` 不传 `desc` |
| 4 | 保留仅本次／固定区间；课次位置只通过网格拖拽移动 | ✅ 生效范围含「仅本次／固定区间」分段控件；弹窗内无位置编辑控件 |
| 5 | 自定义标签开启后只显示自定义文字，不同时显示共享分工名；真实分工关联保留 | ✅ 开启自定义时禁用「教学分工显示到课卡」开关但保留其值；课卡渲染 `customShown` 时只显示自定义文字 |
| 6 | 关闭自定义后恢复共享分工文字 | ✅ 已验证：关闭后课卡恢复显示共享分工「M1」 |

## 三、改动清单

- `lib/timetable/data.ts`
  - `SlotEdit` 增加信息字段（display mode / 自定义标签 / 备注 / 生效范围终点等）
  - 新增 `finalMarker()`（canonical 视图下自定义标签降级为共享分工）、责任分工/行政班选项
  - `applyRename` 与两处 `add` 分支（周视图 / 模板视图）透传新字段
- `lib/timetable/store.tsx`
  - `DraftSession` / `SchoolDraft` / `newSlotEdit` / create-data 类型扩展
  - 教师端 `beginDraft`/`setDraftScope`/`draftEdit`/`draftAdd`
  - 教务端 `beginSchoolDraft`/`setSchoolDraftScope`/`schoolDraftEdit`/`schoolDraftAdd`
  - **关键修复**：`matchesBase` 现在同时比较信息字段，避免「仅改信息、未移动位置」的编辑被「拖回原位」还原逻辑误丢弃
- `components/timetable/lesson-dialog.tsx`（新增）：统一弹窗，六信息区
- `components/timetable/week-grid.tsx`：`ClassCard` 渲染 `finalMarker`（canonical 感知）、自定义标签、备注摘要；`WeekGrid` 透传 `canonical`
- `app/(app)/timetable/my/page.tsx`：教师端 create/edit 均改用 `LessonDialog`
- `components/timetable/overview-panel.tsx`：教务端 create/edit 改用 `LessonDialog`；只读教师视图设 `canonical`

## 四、实际验证证据（预览操作）

均在运行预览中用浏览器实际操作完成：

1. **编辑弹窗**：打开已有课卡 → 显示统一「课节信息」六信息区、无标题摘要（`/tmp/agent-browser/edit-unified.png`）
2. **自定义标签开启**：开启后「教学分工显示到课卡」开关禁用；填入「纯数基础」并保存 → 课卡由「M1」改为显示「纯数基础」
3. **自定义标签关闭**：关闭后课卡恢复共享分工「M1」
4. **新增弹窗**：空格「新增课次」打开同一统一弹窗、六信息区、无标题摘要
5. **固定区间**：切到「固定区间」显示起止两个日期选择器；新增「高一2班 · 物理」草稿卡落格成功
6. **备注摘要**：课卡渲染备注摘要
7. **保存重开**：修复 `matchesBase` 后，信息类编辑保存后重开保持
8. **教师端拖拽**：网格拖拽移动课次正常
9. **教务端拖拽**：`高一1班 · CIE 数学 M1` 拖至周日第1节成功、撤销按钮激活（`/tmp/agent-browser/admin-unified-dialog.png`）

## 五、类型检查

`tsc` 仅剩一处与本改动无关的既有报错（`invite-sheet.tsx`）；本轮改动全部类型通过。

## 六、保留项

其余已正确页面与功能未改动。真实分工关联仍保留；自定义标签只影响课卡显示文字，不改变底层分工数据。

## 七、待核验

请核验预览与上述证据。核验通过前不自动进入真实系统实施。
