# 2026-10-19 颜色编辑修复与教师样式统一独立审查

- Reviewer：`timetable_review`；未参与实现，仅写本审查记录。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；工作区未提交。本报告只评估本轮九个实现文件的颜色编辑、教师侧统一及“场所”文案增量。
- 结论：原问题及本轮发现的兼容问题均已修复并验证，没有剩余必须修复项。没有进行浏览器视觉或用户人工验收。
- 已读取本仓库与父目录 AGENTS；未修改实现、未提交代码。

## 只读诊断与复现

原问题主要发生在未保存的候选预览层，没有发现逐属性保存会删除另一项已保存颜色。

旧 `StyleColorInput` 各自持有本地 draft，父组件却只有一个 `preview.patch`。另一个输入的回调会替换整个 patch；任一成功保存或输入暂时无效时的 `onPreview(null)` 还会清除全部候选。旧教师 `StyleCard` 使用相同结构，并存在恢复全部不清预览、切换对象再返回可恢复残留候选的情况。

独立复现顺序：

1. 对象名称文字原为 `#2d4f7c`，在文字色输入 `#A2422E`，不保存，预览变红。
2. 在文字底色输入 `#E7EFF8`，不保存。预览文字恢复为 `#2d4f7c`，但文字色输入框仍显示 `#A2422E`。
3. 保存底色，会再次清掉全部预览，另一输入的本地草稿却仍保留。
4. 任一输入暂时变为无效的 `#`，也会撤掉另一项有效候选。

使用当时实际 `saveAppearancePatch` 独立验证：顺序保存这两个 patch 后，文字与底色分别为 `#A2422E` / `#E7EFF8`，整卡背景仍为 `#e8f3ec`。由此区分预览覆盖与存储问题。

## 修复审查

### SE-01 · P2 · 颜色候选和输入草稿不一致（已关闭）

`StyleColorInput` 改为受控输入，`useStyleDrafts` 按 color/bg/borderColor 保留原始草稿并从有效值派生完整候选 patch。教务与教师编辑器都使用同一机制。

- 两个字段的候选同时存在；无效输入只取消该字段的有效预览，保留错误原文和其他字段。
- 成功保存只清除本次 patch 包含的字段；失败不清草稿、不假装保存成功。
- 恢复单项、恢复整个部位、同值保存都能同步清理对应输入，不依赖 React key 恰好改变。
- 对象、层级和页签切换清除候选；回到原对象不会恢复残留草稿。

### SE-02 · P2 · 统一界面丢失教师原 AUTO 配色入口（已关闭）

审查发现旧教师设置中的“跟随主题色”按钮在初版共用控件中缺失。实施者已补“跟随对象名称颜色 / 跟随文字颜色”入口，并在 AUTO 激活时说明其自动配套关系。原 AUTO 数据和配置能力均保留；选明确底色后不随文字色变化。

### SE-03 · 合法演示任务编辑与渲染不一致（实施者自查，已复审关闭）

实施者发现 `permittedTasks` 可公开合法的大班演示任务，但初版标题/场所/预览按 task.owner 严格判断，导致可设置却不生效。Reviewer 建议使用当前身份的显式许可任务列表，并同步检查真卡整卡外观路径。

最终 `Appearance.teachingTaskIds` 来自当前 `permittedTasks`；`personalAppearanceTask` 在有列表时以列表为准，没有列表时兼容旧 owner 判断。标题、场所、预览以及 ClassCard 的标题/外观解析使用同一选择逻辑。保存键仍为当前真实教师身份，未转为演示任务的拥有者。空列表或未包含任务时不会应用补充样式。

## 教师端兼容性与调用链

1. 教学设置中的 `StyleCard` 和课表中的整张课卡设置都进入同一个 `TeacherCardStyleEditor`；统一为课卡外观、对象名称、教师姓名、场所四页，保留 TASK/CLASS/COURSE 范围。
2. 旧 scope 键中的 color/font/weight/bg 未迁移，继续分别表示对象标题与整卡背景。补充外观、局部底色、教师姓名及场所使用 scope 键后缀；旧 `lib/mt/styles.ts` 解析与保存算法未改动。
3. 原属性和补充属性都保留逐字段最后成功保存、确定性旧数据回退和清除墓碑。清除新范围值不会复活旧范围颜色；零宽度、零圆角和 NONE/AUTO 的语义保留。
4. 教师日卡、周卡、完整 WeekGrid、标题和场所分别接入对应共享解析器。导航焦点边框、合并日卡左标识，以及 WeekGrid 的锁定/停课/草稿/调休外观与冲突提示保留。
5. 教师视图不重复显示姓名。场所仍使用实际 room；缺失显示“未安排场所”，不创建位置数据。教学设置的样例优先取真实周课次，仅未排任务补缺失场所样例。
6. 教务查看者命名空间及旧 CARD/TEACHER/ACTIVITY 解析保持，教师真实身份样式不会替换教务显示设置。没有修改原侧栏、顶栏或作业业务。

## 独立验证与边界

- 已阅读新增教师适配及草稿交互测试，并独立运行七组课表显示相关回归：87/87 PASS。其中草稿 16 项、教师部位 16 项、此前显示/冲突/外观等 55 项。
- 草稿测试调用真实 hook、控件、输入事件和保存 reducer；使用 hook 状态 harness，不是浏览器 DOM、原生颜色弹窗、布局、hydration 或 React scheduler 测试，不将其声称为端到端浏览器核验。
- 真实组件 SSR 覆盖教师编辑器的旧范围与四页签，普通任务和合法演示任务的 ClassCard/Preview/标题/场所一致性，许可列表排除、教师姓名隐藏及状态标识保留。
- Reviewer 另行独立 SSR 检查普通教师任务：整卡外观、对象局部底色、场所、姓名隐藏、已过期/停课/草稿保护通过；另检查合法大班任务真卡样式及空许可列表排除通过。
- `npm run typecheck`：独立执行 PASS；`git diff --check`：PASS。
- 实施者报告最终全量 167/167 测试及 typecheck 通过，九文件指纹未变；记录时最终 build 尚在运行，不据此宣称构建通过。
- 没有进行浏览器视觉或用户验收，未重复全量构建。完整全量验证由实施记录另行报告。

## 九文件实现指纹

未提交，不虚构 Review commit SHA。下列文件按路径字典序生成 `sha256  path\n` 清单，再计算 SHA-256，独立计算与实施者清单一致。

- 指纹：`ab862e8e030fe626d2620eeeda8247c9074b388624d7eec011977461d24f4f84`

```text
e170820b1c963df42e59a2e02abe94a4826aad0b7cd3285cc5434160e5dbe054  components/mt/day-cards-view.tsx
e98d15be3b17cc2b5323de158c0dd8f82bfe9a12cc3ee5300605312db864aa83  components/mt/style-color-input.tsx
ac78d15c6764247ac789e9f2956ca6280e603f551abff1c398708d27f606dbb5  components/mt/teacher-prefs.tsx
5085e1d9d07af91c9864cecd621ce6f306a0cbe1ded4e22297f8dcb6bb61f6e3  components/mt/use-style-drafts.ts
5d21ddba5b61c37aee270224dee72d0287cb5489317b48c1d854c334008fc171  components/mt/week-schedule.tsx
3dc5181d8838c5eea929930229bd14a664a30c7da3e0c489add4000927f72d5b  components/timetable/display-settings.tsx
d1d3829b9f275f28efbe6c5595b01d89a7df128d4b4c880a5f056d8af50037ce  components/timetable/week-grid.tsx
530e35c55b1a07a2b00c2b41135a5faa1e32be1988ebeb296db641618e2688f0  lib/timetable/display.ts
3e389fb73c9c001d6c669234d07c3f3b7bee9a06360a3a0d8f09b66e7db668c2  lib/timetable/teacher-appearance.ts
```
