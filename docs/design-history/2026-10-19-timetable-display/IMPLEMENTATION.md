# 2026-10-19 实施与验证

状态：实现、自动检查与独立复审完成，Owner 人工核验 PENDING。此次新增工作未提交或推送。

基线 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，开工工作区干净。父 AGENTS 的生产仓库约定在本原型的实际能力内执行；没有为取得审查提交而自行 commit。主项目 make check：NOT_RUN（本 wfb-v3 没有该目标），使用本工程 pnpm typecheck/test/build。

## 实际读取与范围

读取项目/父 AGENTS、frontend-design 技能、安装包 Next.js 16.3.3 server-and-client-components/use-search-params/typescript 指南，以及 lib/mt/styles、model、store、derive、scenario，lib/timetable/data、store、calendar-store、duty-store，lib/demo/nav，lib/teaching/fixture，components/timetable/week-grid/overview-panel/detail，components/mt/teacher-prefs/week-schedule/day-cards-view/task-list/teaching-hub/style-color-input/scheme-settings，my/page、kit、providers、schedule/app-providers、现有 tests 和集中摘要。

实现仅触及教师样式与标题呈现、完整课表与教务课表展示、差异展示；新增共享 display 元数据/样式弹窗/筛选工具与行为测试。整卡原样式解析抽出共享内部函数，外部输出不变；增量偏好复用 MtBiz.styles 但隔离当前浏览者与 teacher/admin 视图的命名空间。

顶栏、左栏、作业组件及原作业数据模型无差异。新增 .gitignore 的 .local-artifacts/ 仅排除本地验证日志。所有新数据为现有合成示例。

## 验证结果

- pnpm typecheck：PASS（独立于构建的实际 TypeScript 检查）。
- pnpm test：94/94 PASS，其中新增课表显示行为 14 项；另保留既有 staff 脚本内部检查。
- pnpm build：PASS，全部路由正常生成。
- git diff --check：PASS。
- 预览 /timetable、/timetable/my、/teaching/settings?tab=style、/homework 均 HTTP 200；此项仅证明路由服务响应。
- 独立 Reviewer：首次发现预览未继承整体样式、搜索未索引可见分工，两项均已修复并复审。1000 组确定性偏好的新旧解析输出一致。报告见 ../../reviews/2026-10-19-timetable-display.md。
- 自动浏览器交互/截图：NOT_RUN；会话已有浏览器访问策略限制，未绕过。SSR 行为测试与 HTTP 响应不替代人工视觉验收。

13 个实现文件指纹：`961f6939e0ff4c9a981294ba61b55b1511f921d8953cc46aff7e916fa23aa5e2`，与独立复审逐文件匹配。完整文件列表、测试文件哈希及日志哈希见 ../../evidence/timetable-display/verification.json。原始日志保存在忽略的 .local-artifacts/timetable-display/。

## 待人工核验与限制

使用 ../../milestones/timetable-display/MANUAL_VERIFICATION_GUIDE.md 核验真实界面，包括选色、刷新、键盘、小屏、卡片筛选、补课及隐藏占位。设计中的行政班仍保留旧成员教师聚合语义，并未实施精确学生选课关系；未知名称按整体处理。以上限制已写入设计及人工指南，未冒充已完成的业务能力。
