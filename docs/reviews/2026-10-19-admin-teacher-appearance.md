# 2026-10-19 教务按教师设置课卡样式独立审查

- Reviewer：`timetable_review`；未参与实现，除本记录外不修改任何文件。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；当前未提交工作区包含前两轮课表改进。本报告关注新增按教师配置样式的增量。
- 状态：设计与实际实现独立审查完成，未发现必须修复项；人工视觉验收未进行。
- 指令：遵循已读取的本仓库及父目录 AGENTS；没有提交代码。

## 已读范围

当前 `lib/timetable/display.ts`、`components/timetable/display-settings.tsx`、`components/timetable/week-grid.tsx`；沿用前两轮已审查的 `lib/mt/styles.ts` 与保存、预览、状态标识调用链。

## 设计判断

新增 TEACHER 设置使用当前查看者 viewer/admin 命名空间，按课卡 entry.teacherId 标识所设置的教师。它作为课程与活动整卡的可选默认值；既有 CARD/ACTIVITY 具体属性优先，SUBJECT/HOMEROOM 片段仅覆盖相应名称。未设置时沿用已有显示。此规则不改变原教师 TASK/CLASS/COURSE 的逐属性最后成功保存规则，两种样式系统存储范围和作用对象分离。

实现复审重点：

1. 合并原始颜色、背景、字重、字体后再解析，使 AUTO 背景由最终文字色计算。
2. 具体卡片清除属性后恢复继承教师默认；不能把保存序号的清除墓碑当作显式覆盖。NONE 仍表示明确无染色。
3. 当前查看者、教务/教师模式、不同教师之间隔离；旧范围样式不改变。
4. 预览与实际卡片调用同一解析器，具体覆盖的优先关系在界面说明。
5. 锁定、停课、草稿、调休底色及冲突/待核对标识继续优先，不改变排课、名单、发布或过滤逻辑。

## 实现审查结论

以上 5 项边界均符合已读实现：

- `resolveCardAppearance` 只在 admin 模式读取 TEACHER，教师 ID 来自课卡，查看者来自独立命名空间。先逐属性合并具体 CARD/ACTIVITY 与教师默认，再调用原 `resolvePreference`。
- 合并只看有效属性值，不把 `order` 清除墓碑当作具体值。NONE 保留明确透明；AUTO 在合并后的颜色上解析。
- 弹窗仅在 admin 模式显示“按教师”，由当前完整课表范围的教师 ID 去重生成选项，显示姓名；保存继续使用 `mt.command` 与原保存补丁逻辑。
- 预览与真实 ClassCard 均调用同一解析器。界面解释教师默认和具体卡片优先关系；预览存在具体覆盖时列出覆盖属性及恢复继承位置。
- 原教师 TASK/CLASS/COURSE 解析本轮没有改动；既有标题片段、锁定/停课/草稿/调休背景及冲突/待核对标识分支保留。

未发现剩余必须修复项。此结论为代码与自动检查结论，不代替用户人工验收。

## 独立验证

- 独立断言逐属性覆盖、合并后 AUTO、JSON 持久化清除、NONE、查看者/模式隔离：PASS。
- 500 组确定性既有整卡偏好比较：无 TEACHER 配置时，新解析器各可见样式属性与旧单对象 `resolvePreference` 一致，PASS。
- 已阅读新增 `tests/timetable-teacher-appearance.test.cjs`，并独立执行该文件与样式、冲突回归三组测试：37/37 PASS（新增按教师 9 项、样式 14 项、冲突 14 项）。覆盖真实 ClassCard SSR、活动整体渲染、其他教师隔离与状态标识保留。
- `git diff --check`：PASS。
- 实施者报告全量 117 项测试、typecheck、build 通过；本 Reviewer 未重复运行全量，完整证据以实施记录为准。
- 未进行浏览器视觉操作或人工验收；未提交代码。


## 复审增量实现指纹

本轮未提交，不虚构 Review commit SHA。以下 3 个实现文件按路径排序，以 `sha256  path\n` 清单再计算指纹。

- 指纹：`3b932eab8646369387431f1671d4fdbcfe1500ae5005001ea79db4d98dc33b0a`

```text
c0b127b12a9ed359ad8a78c4a4aea969662ba4ea373b18243a5d82d89102995d  components/timetable/display-settings.tsx
5f70558b19f07d2b9b590691d02c9d4c6fb01a410f55ab2017eb679a65561c8f  components/timetable/week-grid.tsx
c5684551efb8219bfa86e159e4f5bbc52211a50d5c9a99d1be71833c769dae0e  lib/timetable/display.ts
```
