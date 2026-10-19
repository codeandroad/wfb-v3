# 课表整体核验记录（2026-10-19）

用户反馈U-TT-20261019-01：当前核验未发现问题、暂时接受，并授权归档、提交和推送。未将此反馈扩展为所有异常路径或生产上线验收。

统一入口、原型人物能力与后续回归步骤见 [课表改进总览第2、9、12节](../../design-history/2026-10-19-timetable-improvements/DESIGN_AND_IMPLEMENTATION.md)。该文档是完整可独立阅读的设计与实现说明，本页不重复维护另一套流程。

教师用原示例教师人物进入 `/timetable/my` 或 `/teaching/settings`；具教务能力的人物进入 `/timetable`。多人答疑演示为 `/timetable/demo/math-qa`，不需要重置数据。具体演示步骤仍见 [多人答疑指南](../math-qa-demo/MANUAL_VERIFICATION_GUIDE.md)；其中历史PENDING指该阶段当时状态，最新接受状态为本页所记。

已知限制：本机合成原型、当前来源范围冲突核对、行政归属不等于完整走班去向、独立演示不播种业务数据。原生取色器、弹窗焦点和浏览器hydration不属于SSR自动检查保证范围。
