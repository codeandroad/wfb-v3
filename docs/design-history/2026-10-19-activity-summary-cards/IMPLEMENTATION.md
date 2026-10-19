# 多教师活动摘要卡实施（2026-10-19）

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`。依据Owner关于多数学教师答疑的反馈，保留此前未提交修改；已读AGENTS、Next.js已安装use-client指南、activity目录/完整发布源、WeekGrid/真实ClassCard、Modal与CardDetail以及显示样式/冲突逻辑。

本轮修改范围：新增 `lib/timetable/activity-groups.ts` 和 `components/timetable/activity-group-card.tsx`，调整 `components/timetable/week-grid.tsx`、`components/timetable/overview-panel.tsx`，并新增/更新对应回归。没有修改排课模板、发布数据、教师名单或存储结构。

helper按精确日期/节次/完整名称显示归组，保留每条原记录引用；教师与已知场所去重，未知场所独计。WeekGrid在完整校历/冲突之后对可见安排归组，只允许admin只读活动范围显式启用。普通卡渲染与原编辑操作保留。计数改为安排数与卡数分别展示。

摘要清除用于样式解析的单教师身份，采用活动公共设置；状态按全部成员统计。弹窗使用真实ClassCard逐项展示，选中后关闭摘要并进入原CardDetail。打开组只存key及上下文，详情从当前可见分组重算，避免成员过期。

类型检查、214/214回归、构建和diff检查通过，两侧课表HTTP200。新增活动归组专项14项，加上活动浏览9项覆盖真实摘要/原卡/详情SSR、组件事件、筛选、隐藏课程冲突、默认色、混合状态、切上下文关闭和同key成员/场所实时更新。此类回归不模拟浏览器或原生交互。

本轮4文件组合指纹：`1e603eb89ae9aab55b0dd9e588d283d617fb9a73206c30e0f91daf786af613db`。最终代码指纹、测试和日志见 `../../evidence/activity-summary-cards/verification.json`；审查见 `../../reviews/2026-10-19-activity-summary-cards.md`；人工指南见 `../../milestones/activity-summary-cards/MANUAL_VERIFICATION_GUIDE.md`。

独立最终审查无剩余必须修复项，142项课表回归及100位教师摘要SSR验证通过；类型/diff检查与四文件指纹独立核对一致。

浏览器交互/视觉NOT_RUN，Owner核验PENDING；本原型无父生产Makefile目标，make check NOT_RUN。未提交或推送。
