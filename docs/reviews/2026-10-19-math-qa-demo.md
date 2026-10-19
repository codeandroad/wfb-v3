# 2026-10-19 多人数学答疑演示独立审查

- Reviewer：`timetable_review`，未参与产品实现，仅写本记录及 `.local-artifacts/math-qa-demo/` 下的独立验证证据。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；当前工作区未提交。本轮以修改前文件快照对照六个冻结实现文件，既有未提交功能不作为本轮新增重新归因。
- 结论：**没有剩余必须修复项。** 演示使用独立合成安排，复用真实活动归组、筛选及详情路径，没有把演示教师或课次加入原有学校数据。
- 已读取适用 AGENTS 及本地 Next.js `page.md` 指南。未修改实现、未提交代码，未使用浏览器自动化；Owner 人工核验仍待进行。

## 实际实现与边界

1. **独立入口。** `TimetableDemoBar` 的“多人答疑演示”进入 `/timetable/demo/math-qa`。入口和页面均沿用 `PERSONAS[persona].admin` 判断：教务与兼任教务的林老师可访问，纯教师人物不显示入口，直达时不渲染演示内容并导航到我的课表。没有自动切换人物或扩展原主侧栏、顶栏。
2. **场景准确。** 四个专用 `demo-math-qa-*` 身份均为明确合成的数学教师，固定在 2026-10-28 周三 `a3`（第 8 节，15:15–15:55）分别使用 D101、D102、D105、D208。完整名称均为“数学答疑”，保留四条独立活动安排，不绑定教学班或学生名单，也不假定四人为一场共同活动。
3. **原数据隔离。** fixture 不写 `TEACHERS`、`TEACHER_SCHEDULES`、`BASELINE_TEMPLATES`、发布记录、个人采用/草稿或校历。`teacherById` 仅在原教师查找失败时识别四个专用演示 ID，使筛选选项、姓名搜索、单人卡和详情沿用同一解析路径；其他未知 ID 仍返回 undefined。fixture 对 `data.ts` 只有类型导入，没有运行时循环依赖。
4. **展示日期独立。** WeekGrid 显式接收固定演示周、演示日期及 `calendarEvents=[]`，同时使用 canonical 模式；真实校历不会迁移或停止演示安排，也不会走本人课表的来源回退。不调用共享时钟、周次、人物或排课 setter。
5. **真实交互复用。** 页面使用实际 WeekGrid、ActivityGroupCard/Dialog、ClassCard、TimetableFilterBar 和 CardDetail。默认呈现“4 项安排 · 1 张课卡”，摘要中不堆叠姓名；展开可见四条原安排，点击其中一项打开对应教师、日期、时段和实际场所详情。教师或姓名筛选到一人时恢复原单人卡，清除筛选恢复摘要。
6. **显示样式只读。** WeekGrid 新增 `allowStyleEditing`，默认 true，普通课表原入口保持。演示显式 false，同时阻止按钮和设置弹窗渲染，即使已有 `stylesOpen` 状态也不能显示设置。已有 ACTIVITY 名称/场所配色继续读取，未创建另一套样式解析或存储。
7. **重试与退出。** “重新体验”只清本页详情及通过 key 重建筛选/归组弹窗状态，不调用共享 reset；“退出演示”是返回 `/timetable` 的链接。活动详情不提供教学记录写入入口。
8. **周边功能保持。** 与本轮修改前快照比较，筛选器、CardDetail、共享课表 store、校历 store、导航定义及 AppShell 文件均未改变。主导航、原课表和作业流程不属于本轮改动。

## 独立验证

- 已完整阅读新增 `tests/timetable-math-qa-demo.test.cjs` 的 7 项回归，覆盖专用身份、真实摘要/筛选/清除/展开/单项详情/重试、姓名关键词、命令与存储写入哨兵、冻结 fixture、普通样式入口、已打开设置状态下的只读守卫，以及页面和入口的演示人物能力规则。
- 独立运行全部 `tests/timetable-*.test.cjs`：**149/149 PASS**。日志：`.local-artifacts/math-qa-demo/reviewer-tests.log`。
- 独立补验真实 MathQaDemo + WeekGrid SSR：固定周三四项/一张摘要、四处场所，无教师/场所冲突；provider 时钟设为 2030 年时仍按固定演示日期展示；现有 ACTIVITY 对象与场所文字样式可见，保存命令哨兵未触发；冻结 fixture 正常渲染，原教师目录、发布模板和校历值不变。脚本及日志：`reviewer-demo-ssr.cjs`、`reviewer-demo-ssr.log`。
- `npm run typecheck`、`git diff --check`：独立执行 PASS。日志：`reviewer-typecheck.log`、`reviewer-diff-check.log`。
- 本轮修改前快照与周边文件不变检查：`reviewer-before.json`、`reviewer-boundary.log`。六文件实现清单独立计算后与冻结 manifest 一致：`reviewer-implementation-manifest.txt`。
- 已读取实施者最终全量测试日志：**221/221 PASS**。实施者另报告 typecheck/build PASS，以及演示页、课表中心、我的课表三个入口 HTTP 200；Reviewer 未重复构建或发起 HTTP 验证，按实施者证据记录。

组件事件测试使用真实组件和 provider 的 SSR，并保留局部 hook 状态、替换 portal 外壳和路由调用。命令及存储哨兵结论限定于这些实际执行的渲染/事件路径；没有执行浏览器 hydration、冷加载迁移、原生弹窗焦点或视觉布局检查。原有 provider 的初始化迁移逻辑没有因演示页被改写，不能把 SSR 中的零写入泛称为所有浏览器生命周期零写入。上述检查不代替 Owner 人工验收，也不声称已实现生产服务端授权。

## 六文件实现指纹

未提交，不虚构 Review commit SHA。按路径字典序生成 `sha256  path\n` 清单后计算 SHA-256。

- 指纹：`4000a0fe20a3f2b3749b04f49a552eeb751e50fc3828afc44ac4b363e36d6709`

```text
fe90ab0fdec2b158eeb7121749c0e8b94881e33d7a98aac6652abced720118a9  app/(app)/timetable/demo/math-qa/page.tsx
a9a19e9f6275049cebf8ff668ce483ff7f31503b05003f6fc51e221015000f54  components/timetable/demo-bar.tsx
d399150900fb92607456b2e250053c4e890a68be6375d4097ffd4b58e64e8e23  components/timetable/math-qa-demo.tsx
77f383f0587fb484741a69b9bb7a26c34b8a04b1de51da3980535148be907062  components/timetable/week-grid.tsx
eb12b6c010568832fa7a494ea9666369e560ad45ccf8ccd13083fadc3bc533ca  lib/timetable/data.ts
95f0e3e310a13b42c140e8506311c294c7821b84922213bd8f36bf27dcc24fc0  lib/timetable/math-qa-demo.ts
```
