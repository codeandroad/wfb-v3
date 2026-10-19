# 2026-10-19 教务课卡教师姓名与地点文字独立审查

- Reviewer：`timetable_review`；未参与实现，除本记录外未修改文件。
- 基线：`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；工作区尚未提交。本轮聚焦整张课卡设置内新增教师姓名、地点文字样式的增量。
- 结论：代码审查与独立自动验证通过，未发现必须修复项。用户人工视觉核验未进行。
- 指令：遵循本仓库及父目录 AGENTS；未提交代码。

## 范围和数据含义

用户提出在整张课卡下增加“教师和办公室”设置。实施者已向用户说明暂按课卡内部文字样式处理；这不是用户已明确确认的进一步业务定义。本报告评估这一实现口径，不替代后续用户核验。

已读 `lib/timetable/display.ts`、`components/timetable/display-settings.tsx`、`components/timetable/week-grid.tsx`，以及原 `lib/mt/styles.ts`、课卡数据模型和相关测试。核查了课表、教学、个人资料及职员模型中的 office/办公室字段：课卡现有 `room` 表示实际排定的教室或活动地点；职员数据出现的“办公室”是部门名，没有可用于课卡的个人办公位置字段。实现继续使用 `entry.room`，未替换为部门或虚构办公室。

## 实现结论

1. 教务设置在“整张课卡”中保留对象选择，再切换“对象样式 / 教师姓名 / 办公室／教室”。保存与临时预览都使用当前 `savedPart`；切换对象或部位清除临时预览，原 CARD 设置不被覆盖。
2. 新增 `CARD_TEACHER_TEXT`、`CARD_ROOM_TEXT` 独立存储键，按当前查看者、admin 模式、课卡完整名称隔离。它们与按教师设置整卡的 TEACHER 偏好含义、作用对象不同。
3. `resolveCardTextAppearance` 只解析该部位本身的偏好，不自动继承整卡标题的颜色、背景、字体或字重。未设置、清除后以及不适用模式均保留该行原默认样式，未改动旧 TASK/CLASS/COURSE 逐属性保存规则。
4. 预览与真实课卡共用 `StyledCardText` 和相同解析器。文字底色只施加在文本 span；课卡背景、名称片段、分工和冲突/状态标识的处理逻辑保留。
5. 教师姓名行仍受 `showTeacher` 控制，教师视图不重复显示姓名。地点继续来自实际 `room`；缺失时显示“未排教室”，设置预览也不生成示例教室。
6. 活动课卡不读取这两个教学对象文字偏好，继续使用现有整卡/按教师样式。新代码没有改变校历、课次、名单、发布或过滤逻辑。

没有发现剩余必须修复项。当前“办公室／教室”指排课地点文字，不是教师人事档案中的办公位置；界面已说明“沿用已排地点”。

## 独立验证

- 已读新增 `tests/timetable-card-text.test.cjs`，独立执行该文件及 teacher-appearance、display、conflicts 三组回归：44/44 PASS（新增部位样式 7 项、按教师 9 项、既有显示 14 项、冲突 14 项）。
- 新增测试覆盖真实 ClassCard SSR、片段背景与整卡背景隔离、查看者/模式/对象/字段隔离、JSON 清除持久化、活动排除、缺失地点、教师视图姓名隐藏及冲突标识保留。
- 另执行独立 250 组确定性组合检查：新增及清除文字偏好不影响原整卡解析结果、不修改输入偏好、活动不读取教学对象文字设置；PASS。
- `git diff --check`：PASS。
- 实施者报告全量 124 项测试、typecheck、build 通过；本 Reviewer 未重复运行全量，以实施记录为准。
- 本 Reviewer 未运行浏览器视觉操作，也未重复全量构建；对应结果应由实施记录分别说明，不能据本报告宣称用户已验收。

## 被审增量指纹

本轮未提交，不虚构 Review commit SHA。以下三个实现文件按路径排序，对 `sha256  path\n` 清单再次计算 SHA-256：

- 指纹：`51f44035f13a489861fe31bf6ba3685feefcc99c4f810a42f7bdc4c86ef1c2f9`

```text
f4d6147a125ae06c4b0059af18e7cb1708c78694184a821043e8ee32e9632d45  components/timetable/display-settings.tsx
b4e94be9371e880da5cdb5984d9e79841487a966db00100256eba334e3573d96  components/timetable/week-grid.tsx
b511d4fbf9e60469988ab45428237961d98ceb5c50e61211d8d3f5eefcc504ab  lib/timetable/display.ts
```
