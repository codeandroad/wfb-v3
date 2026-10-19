# 2026-10-19 教务活动摘要课卡独立审查

- Reviewer：`timetable_review`，未参与实现；仅写本记录与 `.local-artifacts/activity-summary-cards/` 下的独立验证日志。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；工作区未提交。本轮审查四个实现文件，见文末指纹。
- 结论：**没有剩余必须修复项。** 显示聚合没有合并原安排或改变业务身份，原冲突、样式和详情路径保留。
- 已读取适用 AGENTS。未修改实现、未提交代码；遵守不使用浏览器自动化的限制，未进行浏览器视觉或 Owner 人工验收。

## 设计边界与实际实现

1. **限定入口。** 只有教务 ActivityView 显式启用聚合；WeekGrid 还要求 admin 显示模式、activity 范围及非编辑状态。教师、教学班、行政班与编辑课表继续逐条显示，未修改原应用主侧栏、顶栏或作业流程。
2. **仅显示归组。** 分组键为实际日期、节次 ID、完整活动名称。不同日期、节次或名称分别显示；名称不裁剪、不推断同名就是一场共同活动。每条原 ProjectedEntry 引用保留，同一教师的多项安排及重复输入没有被擅自去重为业务记录。
3. **计数清楚。** 摘要用去重 teacherId 计算教师人数，用原 entries 数量计算安排数。顶部区分“项安排”与聚合后“张课卡”。只有一项时使用原 ClassCard，保留姓名和原教师样式。
4. **场所准确。** 已知场所去重用于显示数量；缺失或空白场所逐安排单列。一个已知场所加若干未知场所不会被误述为所有安排都在同一地点。归组时的场所标签整理不修改原安排地点。
5. **冲突先于筛选和聚合。** 原完整校历投影及 assessSchedule 先执行，再做活动范围和显示筛选，最后归组。摘要标出任一成员的冲突并保留原因，展开后各成员继续携带自己的冲突；被隐藏课程与活动的教师/场所冲突仍可见。同名分组不撤销原冲突判断。
6. **样式不取首位教师。** 摘要身份去掉 teacherId，只应用当前查看者对完整活动名称的设置，避免随机继承第一位教师的默认颜色。展开成员仍使用真实 ClassCard 和各自教师默认、活动分部位样式及状态优先规则。筛选到一项时恢复该教师原配色。
7. **状态逐项表达。** 停课、过期、补课、个人调整/草稿及显式锁定分别计数，不把第一项状态复制给全组。非普通状态组不套普通整卡外观；所有条目停课或过期时使用相应状态底色。
8. **展开及后续导航。** 摘要点击后显示该组原始安排，每项包含教师、实际场所、状态和冲突。点击一项先关闭组弹窗，再调用原 onCardClick 打开该条完整详情，没有创建新业务事件或改变原安排。
9. **避免陈旧详情。** 打开组保存分组键与周次/筛选/范围上下文；上下文变化后关闭，返回原上下文不复活旧弹窗。同键源数据更新时从当前 displayGroups 重取成员与场所；缩为单项或消失时关闭。

## 独立验证

- 阅读新增 `tests/timetable-activity-groups.test.cjs` 的 14 项纯函数、真实组件 SSR 与状态/事件测试，以及既有活动浏览 9 项的更新。覆盖精确分组键、同教师多安排、未知场所、输入不可变、过滤后单项、隐藏课程冲突、摘要与成员不同样式、混合状态、原详情回调及陈旧弹窗清理。
- 最终独立运行全部 `tests/timetable-*.test.cjs`：**142/142 PASS**，日志 `.local-artifacts/activity-summary-cards/reviewer-tests.log`。
- 另行执行真实 ActivityGroupCard SSR：100 位教师的 100 项同名安排仍只呈现人数/安排数摘要，没有成员名单，也未采用第一位教师默认色；2 个已知场所与 34 项未安排场所分别表达；完整活动名称显式样式正常；混合停课、补课、锁定及冲突原因保留。日志 `reviewer-summary-ssr.log`。
- `npm run typecheck`：独立执行 PASS，日志 `reviewer-typecheck.log`；`git diff --check`：PASS，日志 `reviewer-diff-check.log`。
- 独立计算四文件指纹，与实施者冻结清单一致；日志 `reviewer-implementation-manifest.txt`。
- 实施者报告最终全量 **214/214 PASS**、typecheck/build/diff PASS、两侧预览 HTTP 200，最终实现指纹未变；Reviewer 未重复完整构建，这些结果按实施者报告记录。
- 组件测试替换 portal 外壳并以 hook 状态驱动事件；本轮没有执行浏览器自动化，不将 SSR/harness 声称为原生弹窗、焦点管理、布局、React scheduler 或人工视觉验收。

## 四文件实现指纹

未提交，不虚构 Review commit SHA。按路径字典序生成 `sha256  path\n` 清单后计算 SHA-256。

- 指纹：`1e603eb89ae9aab55b0dd9e588d283d617fb9a73206c30e0f91daf786af613db`

```text
3d3f5835a88596b342d0eeebf76ab437680e8bc62702df4094858de1eb8039e6  components/timetable/activity-group-card.tsx
a06a9da7bf87624db39cc2ae3c841ce83a8494294209748333aabefc71af1b1b  components/timetable/overview-panel.tsx
17e84c2f5dee76c5b338b382d283487d623ae52aa38b4addff379a762e75dced  components/timetable/week-grid.tsx
8ec65e9e6c26f030befddf0952fa60a508b866185acb54b4818e0150510d89da  lib/timetable/activity-groups.ts
```
