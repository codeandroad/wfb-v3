# 多人数学答疑演示实施（2026-10-19）

## 指令、读取和范围

Owner要求增加同一时段、不同场所的多人数学答疑场景，核验摘要、教师筛选和明细；保留现有数据，不提交。已读取本地和上级AGENTS、Next安装文档use-client/page规范、package.json、课表page/demo-bar、WeekGrid、ActivityGroupCard/Dialog、CardDetail、card-filters、data/display/activities/store、app-shell/persona导航和前轮摘要设计/证据。沿用已确定的界面风格。

新增独立路由、演示组件及只读fixture；修改demo-bar入口、teacherById专用演示名称回退、WeekGrid可选样式入口控制。不改原排课数据、共享校历、学校教师目录、发布/个人模板、教师周次/时钟、作业管理或原外壳。

## 结果

入口 `/timetable/demo/math-qa`，课表顶部“多人答疑演示”可直达。2026-10-28周三第8节15:15–15:55，4位演示数学教师A/B/C/D分别使用D101/D102/D105/D208。复用真实摘要卡、筛选器、展开课卡与CardDetail。无业务写入，重新体验仅清本页状态；退出返回课表中心。非教务人物沿用课表中心的角色跳转；不自动改角色。

`allowStyleEditing`默认true，原页面入口不变；演示传false同时隐藏按钮与弹窗。既有样式继续只读使用。专用教师ID仅补充名称解析，TEACHERS原数组未修改，fixture对data是type-only依赖。

## 版本与验证

分支main，基线`42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，原工作区修改全部保留。6项实现文件指纹`4000a0fe20a3f2b3749b04f49a552eeb751e50fc3828afc44ac4b363e36d6709`；本轮未创建提交/推送。

- `pnpm typecheck`：PASS。
- `pnpm test`：221/221 PASS，含新增7项演示专项。
- `pnpm build`：PASS，生成独立演示路由。
- `git diff --check`：PASS。
- HTTP `/timetable/demo/math-qa`、`/timetable`、`/timetable/my`：200，SSR含演示摘要和真实入口。
- 专项运行真实providers/组件计算与事件回调：默认4项/1卡、教师筛选及姓名搜索、清除恢复、摘要展开4项、点原课卡进入详情、重试本页状态、fixture与业务state不变、业务命令/storage写哨兵无调用、普通样式入口保留及角色路由。
- 测试替换Modal portal外壳和局部React状态槽以模拟事件，不是浏览器运行，也不代替浏览器effect/hydration与视觉核验。
- 独立Reviewer另外以2030共享时钟、已有活动样式、冻结fixture做真实组件SSR核验，保留固定演示日期与原样式读取；独立149项课表回归、类型与diff检查PASS，最终无剩余必须修复项，6文件指纹一致。
- 浏览器交互/视觉NOT_RUN，遵守此前自动化拒绝，不绕过。父`make check` NOT_RUN（本原型无对应目标）。Owner人工验收PENDING。

证据：`docs/evidence/math-qa-demo/verification.json`；原始日志：`.local-artifacts/math-qa-demo/`；审查：`docs/reviews/2026-10-19-math-qa-demo.md`；人工步骤：`docs/milestones/math-qa-demo/MANUAL_VERIFICATION_GUIDE.md`。历史摘要卡指南只追加本场景入口，不倒写当时验证状态。
