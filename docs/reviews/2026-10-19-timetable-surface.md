# 2026-10-19 课卡外观与文字样式分离独立审查

- Reviewer：`timetable_review`；未参与实现，仅编写本审查记录。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；当前未提交工作区包含前几轮课表改进。本轮审查范围为四个实现文件的外观/文字分离增量。
- 状态：独立代码审查完成，发现的 1 项兼容缺陷已修复并验证，无剩余必须修复项。未进行浏览器视觉或用户人工验收。
- 指令：已读取本仓库及父目录 AGENTS；未修改实现或提交代码。

## 已读范围

`components/timetable/display-settings.tsx`、`components/timetable/week-grid.tsx`、`lib/timetable/display.ts`、新增 `lib/timetable/surface.ts`；另读取原 `lib/mt/styles.ts` 和新增 `tests/timetable-surface.test.cjs`，沿用前轮保存、身份隔离、课卡状态及过滤调用链审查结果。

## 设计与实现判断

整张课卡设置分为“课卡外观 / 对象名称 / 教师姓名 / 办公室／教室”。外观集中背景、边框颜色/粗细/线型及圆角；三个文字页共用同一颜色、局部底色、字重、字体控件。预览也使用真实共享组件与解析器。

存储兼容性符合设计：

- 旧 `CARD.bg` 继续表示整卡背景；旧 `CARD.color/font/weight` 继续表示对象标题，没有把旧背景变成文字底色，也不迁移已有值。
- 新 `CARD_SURFACE` 保存边框与圆角；新 `CARD_OBJECT_TEXT.bg` 仅表示对象名称局部底色。
- `saveAppearancePatch` 对编辑页做明确拆分。重置对象名称只清标题三属性及局部底色，保留 `CARD.bg` 和边框；重置外观只清 `CARD.bg` 与 surface，保留所有文字设置。逐属性保存不会清除其他属性。
- 边框颜色、宽度、线型及圆角均经过受控校验；`borderWidth=0`、`radius=0` 是有效显式设置，不会被当作未设置。无效输入保留已有有效值。
- 保存与候选预览使用同一拆分保存逻辑；`appearanceEditorEffective`、`cardSurfaceStyle`、`objectTextBackground` 使显示值与实际卡片采用同一有效配色。
- `ClassCard` 仅对普通状态应用自定义 surface。已过期、已记录历史、停课、草稿、个人调整、调休补课保留原状态边框与底色；冲突/待核对的环线、标签与原因不受覆盖。
- 查看者/admin/对象隔离保留。活动与教师模式不读取新的教学对象 surface 或对象名称底色，原 TEACHER/ACTIVITY 机制保留。
- `lib/mt/styles.ts` 的内容哈希仍为 `470b80ba678160c928c2363c4190861b3be0954c0b20ba07a45b08cbd1931552`，与首轮独立审查相同；本轮没有修改旧 TASK/CLASS/COURSE 逐属性最后成功保存算法。

## 缺陷与修复

### TS-01 · P2 · 自动配套背景的颜色输入与真卡不一致（已修复）

首次实现将 `appearanceEditorPref(CARD_SURFACE)` 的单独 bg 送入通用解析器，缺少 AUTO 所依赖的最终标题色。独立复现旧 `CARD={color:'#000000',bg:'AUTO'}`：真卡背景为 `#e0e0e0`，编辑器输入却为默认文字色推导的 `#ebeced`。直接保存这个输入会改变已有背景色。对象名称局部 AUTO 底色继承教师颜色时也存在同类风险。

实施者新增并接入 `appearanceEditorEffective`：surface 使用最终整卡解析，对象文字使用最终标题颜色解析自己的局部底色。独立复审确认实际弹窗调用该 helper；新增回归验证普通 CARD 与继承教师色场景，实际颜色输入和预览/真卡保持 `#e0e0e0`。本项关闭。

## 独立验证

- 新增 surface 测试已逐项阅读。独立执行 surface、card-text、teacher-appearance、display、conflicts 五组：55/55 PASS，其中本轮新增 11 项。
- 测试包含真实 `ClassCard`、`TimetableCardPreview`、`AppearanceEditorControls` SSR；覆盖预览/真卡 surface CSS 一致、三个文字页同构、外观控件分离、AUTO 输入一致、状态与冲突保留、有效零值、非法值、JSON 重载、分项重置及旧背景兼容。
- 另执行 25 组确定性旧 CARD/TEACHER 组合检查：增加边框不影响旧整卡解析；对象名称底色不替换整卡背景；外观/文字分别重置不误清其他字段且不修改输入对象，PASS。
- `git diff --check`：PASS。
- 实施者报告全量 135/135 测试及 typecheck 通过；本 Reviewer 未重复全量执行。记录时 build 尚在运行，不据此宣称构建通过。
- 本 Reviewer 未运行浏览器视觉或人工核验，也未重复全量构建；全量验证由实施记录另行报告。本报告不代表用户已验收。

## 被审实现指纹

未提交，故不虚构 Review commit SHA。按下列四路径字典序生成 `sha256  path\n` 清单，再计算清单 SHA-256：

- 实现指纹：`c1b74c15cdae38452a8f633f065d1973bbd24ef001b717fd46c6f9217fbfff25`

```text
569202bf670ff065f2692d4a944049ef7e416dfb2d06e5c3c953c196cdb4d97d  components/timetable/display-settings.tsx
29cb549b6a4fb85d08ac184149537bf144807131388630bd4d30b7f6a71426b5  components/timetable/week-grid.tsx
322106ba6c57f2ed83f9443edb756f7a10e9473eb8e4a93bde6e2517e029d102  lib/timetable/display.ts
8ec35ec0500776ed5538be71bd319a729a98c49fc45a8768c5174d07289c4c82  lib/timetable/surface.ts
```
