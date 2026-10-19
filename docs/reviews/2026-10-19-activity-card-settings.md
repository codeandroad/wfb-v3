# 2026-10-19 活动并入课卡设置对象独立审查

- Reviewer：`timetable_review`，未参与本轮实现；只写本审查记录。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，工作区未提交。本轮范围为 `display-settings.tsx`、`display.ts`、`surface.ts` 三文件的活动设置合并增量。
- 结论：未发现剩余必须修复项。已读取本仓库与父目录 AGENTS，未修改实现、未提交代码。
- 浏览器视觉及 Owner 人工核验：未执行；本记录不代表人工验收。

## 审查范围与结果

1. **入口合并与对象身份。** 教师与教务的样式类别均移除独立活动入口。整张课卡的选择框用“教学对象 / 活动”分组，选择后共用课卡外观、对象名称、教师姓名、场所四部位。教务选择值为类型与完整名称的 JSON 元组；教师教学对象使用类型与任务/班级/课程 ID，活动使用类型与完整名称。同名教学对象和活动可以区分，重复活动课次合并为同一个设置对象。
2. **旧活动设置保持。** `ACTIVITY` 的原完整名称键继续存储并解析整卡背景、名称文字色、字重和字体，没有迁移或重新解释旧颜色。选择器的 JSON 标识不进入持久化键。同名活动跨日期继续共享设置；教务按教师默认色与具体活动逐属性覆盖关系保持。活动不拆分学科或行政班。
3. **补充部位隔离。** 活动的四部位映射到独立 `ACTIVITY_*` 键，不读取同名教学对象的 `CARD_*`。外观仅修改旧活动 bg 与补充边框/圆角；对象名称仅修改旧活动 color/font/weight 与局部文字底色；姓名和场所各自独立。逐项清除和整个部位恢复不会清除其他部位，JSON 持久化后仍成立。
4. **教师无任务场景。** `TeacherCardStyleEditor` 使用教学/活动可区分的 target 类型。只有教学对象要求当前真实教师身份及 `permittedTasks`；活动 target 来自课表，`teacherId=null` 且没有 MT 教学任务时仍可选择、预览和保存。活动使用当前 viewer 的 teacher 显示命名空间，未创建伪造教师身份。活动选中后隐藏任务/班级/课程范围；教学对象保持旧范围与最后成功保存规则。
5. **候选草稿与保存。** 活动使用映射后的部位及完整名称组成 draft key；教学对象保留旧教师 scope key。切换对象、范围、部位会清空候选；成功保存仅清本次属性，失败保留候选。活动与同名教学对象不会共用候选状态。实际保存继续经过 `mt.command` 及加载/失败检查，没有另外建立绕过持久化的状态。
6. **预览和实际课卡。** 活动预览、ClassCard 的外观、名称局部底色、姓名和场所均调用相同解析器。未配置补充部位时保持旧活动显示；教师视图不重复显示姓名，缺失场所仍显示“未安排场所”。锁定、停课、草稿、个人调整及调休状态外观优先；冲突标识和原因保留。
7. **边界保持。** 本轮未改动原教师 TASK/CLASS/COURSE 解析算法，也未修改排课、活动安排、参与人员、校历、筛选、侧栏、顶栏或作业业务。样式仅影响当前查看者在对应 teacher/admin 模式中的显示。

## 独立验证

- 阅读新增 `tests/timetable-activity-settings.test.cjs`，独立运行 11/11 PASS：旧 ACTIVITY 颜色、AUTO/NONE、四部位隔离、同名教学对象隔离、viewer/mode 隔离、真实 ClassCard 与预览 SSR、状态保护、教务保存原键、无 MT 身份的教师活动保存、混合选择框与旧范围。
- 独立运行此前七组相关回归 87/87 PASS；本轮独立运行合计 **98/98 PASS**。
- 另行执行只读组合检查：teacher/admin × 四种文字色 × 五种背景，共 **40 组 PASS**，核对旧活动解析、整卡外观、文字与外观恢复互不影响、JSON 往返、输入不被修改，以及同名教学对象隔离。
- 另行实际组件 SSR：`TeacherCardStyleEditor` 在 `teacherId=null`、仅有活动时仍显示四部位及实际场所，隐藏教学 scope 按钮，未显示无对象提示。
- `npm run typecheck`：独立执行 PASS；`git diff --check`：独立执行 PASS。
- 新增测试的保存路径调用真实编辑器、控件回调和 reducer；替换 portal 外壳及 provider hook 供 SSR 执行。既有草稿测试使用 hook/事件 harness。它们不等同于浏览器 DOM、原生颜色弹窗、布局或 React scheduler 验证。
- 实施者报告全量 **178/178 PASS**、最终 typecheck/build/diff 检查通过，教师与教务预览 HTTP 200。Reviewer 未重复完整构建或浏览器核验，以上全量结果按实施者报告记录。

## 三文件实现指纹

未提交，不虚构 Review commit SHA。按文件路径字典序生成 `sha256  path\n` 清单后再计算 SHA-256，独立计算与冻结清单一致。

- 指纹：`7dd7ad740d2a8dfc8c283ef295af852030be4dd30c504cd09a78c440b940459f`

```text
cd9dc4666622f92052bbe69e282873d0d9fd4d9776bd869697c3e952bec1e8e5  components/timetable/display-settings.tsx
1241e4e2c5739159b228b2b875fcd19c4e96b382d223f6bf6f6dcf0f0e89d7d9  lib/timetable/display.ts
be1d945c6ac6260eaab4e6221f3bff3dff7616ae7d2856f47c23b3c54422599c  lib/timetable/surface.ts
```
