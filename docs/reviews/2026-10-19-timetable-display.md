# 2026-10-19 课表显示改进独立审查

- Reviewer：独立只读子代理 `timetable_review`，未参与实现；仅维护本审查记录。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`（当前未提交工作区）。
- 审查状态：初审及修复复审完成，未发现剩余必须修复问题。人工视觉验收仍为待核验。
- 指令：已读取本仓库 `AGENTS.md` 与父目录 `../../AGENTS.md`。

## 实际审查范围

已读新增 `lib/timetable/display.ts`、`components/timetable/display-settings.tsx`、`components/timetable/card-filters.tsx`，以及 `lib/mt/styles.ts`、`components/timetable/week-grid.tsx`、`components/timetable/overview-panel.tsx`、`components/timetable/detail.tsx`、`app/(app)/timetable/my/page.tsx`、`components/mt/teacher-prefs.tsx`、`components/mt/week-schedule.tsx`、`components/mt/day-cards-view.tsx`、`components/mt/task-list.tsx` 的实际差异。

关联读取：`lib/mt/model.ts`、`lib/mt/derive.ts`、`lib/mt/store.tsx`、`lib/mt/scenario.json`、`lib/demo/nav.ts`、`lib/teaching/fixture.json`、`lib/timetable/data.ts`、`lib/timetable/store.tsx`、`components/mt/style-color-input.tsx`、`components/research/schedule-days.tsx` 的相关调用或定义。

## 必须修复及复审

1. **TD-01 / P2：细分预览未继承已有整卡样式。** 初审中学科/行政班预览固定采用默认背景和中粗文字，无法反映已有整卡背景、字体与颜色，和实际显示不一致。实现者已增加 `base` 解析：教师采用原 `resolveStyle`，教务采用本人 `CARD` 样式，再叠加文字片段候选。复审已确认完整背景/颜色/字体继承，并采用 `cn` 合并默认字重与覆盖字重。状态：RESOLVED。
2. **TD-02 / P2：课卡搜索不匹配可见自定义分工。** 初审 `matchesCardFilters` 只匹配 `entry.group`，未匹配教师课卡上实际显示的个人任务分工或 `customLabel`。独立调用中，显示分工为“纯数1”的 P1 课卡搜索“纯数1”返回 false；现有合成数据也存在该偏好。修复使用 `cardDisplayLabels` 统一课卡与搜索索引的分工解析；WeekGrid 按同一 canonical/本人上下文补充搜索文本。复审独立执行：任务个人分工可搜索、单课自定义优先于任务偏好、canonical 模式不返回或命中私人名称，均 PASS。状态：RESOLVED。

## 已验证的设计边界

- 样式命名空间由当前查看者 `persona.staffId` 与 teacher/admin 模式构成，未使用被查看教师作为保存所有者。
- 可选片段样式仅作用于可识别的名称片段；活动不拆分；未设置属性通过 CSS 继承既有课卡。
- 课表过滤发生在完整校历投影之后；格子占用、移动/复制依据仍使用未过滤的条目集合。
- 教学班/行政班模式显式启用教师姓名；教师模式没有重复姓名行。
- 差异先由完整两侧计算，再按任意一侧匹配过滤，不因隐藏某一侧产生伪新增/删除。教师确认/采用操作仍处理完整本周，并显示说明。
- 学校/教师/草稿跨周调休来源通过对应来源读取函数提供；教学班来源保留所选教学班范围。
- 未发现对原左栏、顶部导航或作业业务实现的改动。

## 独立检查

- 新旧 `resolveStyle` 在 1,000 组确定性随机偏好组合中输出一致，覆盖旧无序号偏好、属性时间戳、清除墓碑及 AUTO/NONE 背景。结果 PASS。
- 新增 `tests/timetable-display.test.cjs` 已阅读，并独立执行当时 11 项测试：11/11 PASS，覆盖属性保存/清除、身份隔离、标题识别/SSR、课卡过滤、教师姓名及状态标识。
- 私人分工检索与 canonical 隔离独立断言：PASS。
- `git diff --check`：PASS。
- 本审查未执行浏览器或截图验收；完整项目测试/构建以实施证据索引为准。未声称生产服务端授权或人工视觉验收已通过。

## 复审代码指纹

本次未提交，不能虚构 Review commit SHA。以下 13 个实际实现文件按相对路径排序，以 `sha256  path\n` 清单再计算 SHA-256；测试补充与交付文档不包含在此实现指纹中。

- 实现清单指纹：`961f6939e0ff4c9a981294ba61b55b1511f921d8953cc46aff7e916fa23aa5e2`

```text
73ee7685cead4b6a04ab129e158d43228dfd2dac00055bf272844fab1633383e  app/(app)/timetable/my/page.tsx
dcb9f3c98f6242fc74bf9432de5efb3433ff05d152957b43738e1073eb69f593  components/mt/day-cards-view.tsx
bacdf5dec84818b22d3e4ba8d3902353d8426458c98ebde97c330ff056214400  components/mt/task-list.tsx
bbbbc1e752806c18128e8df449491d4f298b8d0fff28d8b935f312fc325bc1a9  components/mt/teacher-prefs.tsx
5d5f8f71f9d8cad89396657f66d210c255b67c3b534cc7c4a784b6bfe24ee2e6  components/mt/week-schedule.tsx
33894684a90a79d5e84c5b2bb80f4af7f5acb29321a32995a243577b0b143f92  components/timetable/card-filters.tsx
012eea961f02e0ae3e25ebe9f1e01c659fef2cd76b8be54ff195dabf8b22bf91  components/timetable/detail.tsx
86981308c0ac098428eeb0d3537b68aacf7da0ee86449d6c46b369c4690b2fb5  components/timetable/display-settings.tsx
970d3a6c31bad974cb798ffea0957f0cba780fcfecfab75ee27173678691e85f  components/timetable/overview-panel.tsx
6d3def10a11e6d45637f3579497cecbbf178ae53ef31e80460edd4818212d6e6  components/timetable/week-grid.tsx
470b80ba678160c928c2363c4190861b3be0954c0b20ba07a45b08cbd1931552  lib/mt/styles.ts
3b21c58360360b932ecd3c54cfcad2b1028dee478c230202b7e3a323fd3e19e6  lib/timetable/data.ts
33d032dcca9efe2dfadb1efb8c4f1a6ec60e8ee402f08d02bb28dbb281e6c697  lib/timetable/display.ts
```
