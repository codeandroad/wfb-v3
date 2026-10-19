# 2026-10-19 跨部位样式保留与教务活动浏览独立审查

- Reviewer：`timetable_review`，未参与实现。仅修改本审查记录，并按实施者要求在 `.local-artifacts/timetable-style-retention-activities/` 保存独立诊断回放与日志。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；工作区未提交。审查范围为文末九文件的本轮增量。
- 结论：**没有剩余必须修复项。R1、R2 均已修复并验证关闭。** 原用户报告的跨部位丢失已有明确复现及修复验证。
- 已读取适用 AGENTS。未修改实现、未提交；本轮遵守不使用浏览器自动化的限制，没有浏览器视觉或 Owner 人工验收。

## 原问题诊断

旧输入框的取色与 HEX 修改仅写入候选草稿；必须另点每个字段的保存才进入业务存储。教师和教务的部位按钮均无条件调用 `drafts.reset()`，且草稿 key 包含部位，切换到课卡外观会撤销当前部位的候选。前轮“切换 key 清候选”的测试预期没有覆盖本轮用户要求的跨部位保留。

Reviewer 用实际 `MtProvider.command` / `commitBiz`、教师/教务父编辑器及 hook/事件回放独立区分两条路径：

1. 修改名称文字色和底色但不另点保存，预览改变；切到课卡外观，候选消失，存储未变化。
2. 对象名称、教师姓名、场所的文字色和底色六个属性分别明确保存后，切到课卡外观仍保留。连续两次保存也保留前一字段，内存与持久化 JSON 一致。

因此确认的是候选生命周期与界面保存方式造成的丢失体验；没有复现“已成功保存属性被切页删除”。实际 store 从最新 `bizRef` 执行 reducer，成功写入后才更新 ref 和状态；存储失败不假装成功。

最终行为：取色和六位 HEX 立即保存当前属性；三位 HEX 保留编辑原文，在失焦、Enter 或点击另一部位时提交。无效输入不写入；失败与无效原文在同一对象的各部位分别保留，其他部位有未保存输入时给出提示。保存成功只清本次字段，失败保留错误信息与重试入口。对象、viewer 或教学范围改变时不携带旧候选。

## R1 · P2 · 三位 HEX 过早展开打断六位输入（已关闭）

初版自动保存对所有有效 HEX 立即规范化。逐键输入 `#123456` 到 `#123` 时就保存为 `#112233` 并清除 raw；输入框重渲染后再键入 `4` 得到 `#1122334`，无法按正常顺序完成六位色。

修复后仅完整六位/取色立即提交，三位保留原文直到失焦、Enter 或部位切换。颜色输入组件 key 不再包含已保存的颜色，避免每次成功保存都重新挂载取色控件。

验证采用上一次渲染输入框的实际 value 追加下一个字符，而不是依次注入预构造完整字符串。在教师/教务 × 教学对象/活动四路径中，六位逐键输入、三位失焦与直接点击部位保存全部通过。

- 反例记录：`.local-artifacts/timetable-style-retention-activities/reviewer-hex-before.log`。该文件明确标注为初版已读 handler 逻辑与实际 `normalizeHex` 的历史回放，不冒充最终组件或浏览器执行结果。
- 修复回放：`reviewer-provider-harness.cjs` / `.log`，见下方验证范围。

## R2 · P2 · 活动目录周计数未处理跨周调休（已关闭）

初版左栏按 `schoolWeekEntries` 原周投影累计 `weekCount`，右侧 WeekGrid 则继续应用完整校历。构造 10 月 19 日活动调到 10 月 31 日的例子，实际复现结果：当前周原始活动为 0、目录 `weekCount=0`，而真实 ActivityView SSR 显示 `1 / 1` 并包含“补 10/19”。左栏据此显示“本周暂无安排”会与右侧矛盾。

按实施者选择，最终删除目录中的重复周计数与“本周暂无安排”文案；目录显示参与教师数量及“学校发布”。本周课卡数量和空态统一由完整校历投影后的 WeekGrid 展示。活动目录仍包含不在当前周的活动，跨周活动可以选择。

- 真实修复前反例：`.local-artifacts/timetable-style-retention-activities/reviewer-counter-before.log`，记录当时实际 helper 输出及真实 ActivityView SSR。
- 修复回归：真实 Overview 切换活动后不再输出矛盾周空态；跨周补课显示 1/1，补课目标日再设假日时显示 0/0，均通过。

## 其余接线与兼容性

1. 教务新增活动对象入口、全部活动及按名称目录，不依赖当前选中的教师。目录汇总最新学校发布来源，包含无教师账号及仅在发布模板中出现的教师；未纳入学校草稿或教师私人调整。
2. 活动名称筛选严格区分同名教学对象。切换课程/活动类型会清除不兼容的教学班、学科或活动约束，保留教师与关键词；零结果仍保留筛选栏和清除入口。
3. ActivityView 将全校课程与活动作为完整数据交给 WeekGrid，先完成校历投影及冲突判断，再限制活动范围和显示筛选。活动与被隐藏课程之间的教师/场所冲突继续显示；摘要保留涉及该活动范围的配对解释。
4. 活动不适用学生名单，跳过活动相关的学生名单不完整待核对；教师和场所冲突仍检查。教学课次的名单命名空间、日期有效性及原冲突规则保持。
5. 活动课卡保留教师姓名、实际场所、详情回调和既有显示样式入口。计数、筛选选项及可设置对象按当前活动范围取值，实际冲突来源保持完整。
6. 旧 ACTIVITY 完整名称键、teacher/admin/viewer 隔离、教师 TASK/CLASS/COURSE 保存顺序、四部位恢复、状态外观及同名教学/活动隔离没有改变。本轮没有修改原顶栏、应用主侧栏或作业业务。

## 独立验证与证据边界

- 最终九文件下独立运行全部 `tests/timetable-*.test.cjs`：**128/128 PASS**，日志 `reviewer-tests.log`。包括实际父组件/控件事件、活动目录、筛选、真实课卡与 WeekGrid SSR，以及此前样式、冲突和旧数据兼容回归。
- 独立 provider 回放：**4/4 路径 PASS**，覆盖 teacher/admin × teaching/activity，实际 `MtProvider.command` / `commitBiz`、父编辑器、真实颜色输入回调、逐键六位输入、三位 blur/直接部位切换、跨部位保留、无效输入、存储失败与重试、内存/持久化 JSON 一致性。
- 回放源与输出：`.local-artifacts/timetable-style-retention-activities/reviewer-provider-harness.cjs` / `reviewer-provider-harness.log`。使用 Node 内存 localStorage 替身及 hook 驱动，未访问浏览器或真实浏览器存储；不声称验证 DOM 焦点事件顺序、原生取色面板、hydration、React scheduler 或视觉布局。
- `npm run typecheck`：独立执行 PASS，日志 `reviewer-typecheck.log`；`git diff --check`：独立执行 PASS。
- 实施者已报告最终 R2 代码全量 **200/200 PASS**、typecheck/build PASS、预览 HTTP 200，最终指纹未变。Reviewer 未重复完整构建；以上全量、构建与 HTTP 结果按实施者报告记录。
- 未执行浏览器自动化或用户人工验收，未提交代码。

## 最终九文件指纹

未提交，不虚构 Review commit SHA。以下按路径字典序生成 `sha256  path\n` 清单后计算 SHA-256，独立计算与实施者最终冻结清单一致。

- 指纹：`cf97e1416d6d1fd7c5394587910759e5ff889b559f7e57f3ce1c2882311c092e`

```text
48d51ee866d2ebdda58ab7203a76bb5a6cb17952f0ba4828a625e756fc9e9b32  components/mt/style-color-input.tsx
da83d10d9f681eb266ba6fc4cb71acb96667ca764006b34849660b4616d93ecf  components/mt/use-style-drafts.ts
4a17fbe0b0645ae927dee63bdcadb000743ecbe9309df38c66dd54964134364c  components/timetable/card-filters.tsx
8a8de605f5df39de1fc7434eae3a0094725d1ba7af254c5fbdd3e45e654366d2  components/timetable/display-settings.tsx
3bfb87f5ac40a647a706201e17d7e581d1a98c53d30c36e22655f259592b5bbc  components/timetable/overview-panel.tsx
4f5f48ac879c9fc609797e7d0eed825434a76bbc4d2aeebab63d4e2939b46371  components/timetable/week-grid.tsx
b6d1474741ff03121905bc11e9bc059db99fd26406925a67840c5ec99d6d0a8a  lib/timetable/activities.ts
b85d6f378ecb234edbfb1cf56005f37ec36281f492dded1c8caf3a4c25b1cf5f  lib/timetable/conflict-display.ts
cd27a678453441118a223217c71586642acf679646e571fbf5e0f477165188b5  lib/timetable/display.ts
```
