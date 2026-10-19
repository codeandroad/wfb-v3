# 2026-10-13 最终 HTML 复刻实施记录

## 对象与依据

工作目录：`resources/wfb-v3`，分支 main，基线 `5308673a8e957099e4fc3fee1e067dbfeafa067c`。Owner 禁止提交，故实际被测对象为未提交文件，而不是新提交。140个修改代码/测试/原件文件的聚合 SHA-256：`01dcded033e6e41d6d02bec6b6320e350d40afede225c5546d2163d1cdc57ae9`，文件级清单与方法见 `../../evidence/exact-html-replica/tested-source.json`。既有迁移与样式恢复文档保留为历史，本轮替代其内容区视觉实现。

读取了仓库及父 AGENTS、已安装 Next 文档、原单 HTML 内联样式/脚本、research-workspace 的真实课程与科组渲染、原数据库及计划快照、现有 research 模型、存储、命令、导航和原作业接口。独立 Reviewer 按父 AGENTS 安排，只读审查实际候选，未进行并行源码修改。

## 实现

新增 source-reader/assessments/library/versions/plan/papers/paper-reader/selection/personal 原生 React 组件及局部 replica.module.css。source-layout 为旧无 layout 数据提供默认元信息；source-fixture/source-plans/source-seed 保存原基线内容。新样式不覆盖 AppShell/顶部/左栏/原作业，98个受保护文件校验全未变。

course-workspace 统一五项分类、四项大纲子分类、课程上下文和资料选择；指定文档/版本/节点保持身份，失效引用明确提示，不自动换成官方大纲。共享空间明确 view 不强制跳回 resources。

source-transfer 处理受权导出与原子批量导入；selection 使用文档+版本+条目复合键，保存校本共同题干完整引用链。原作业通过 HomeworkHandoff 和既有 AssignForm 接入。Modal 的多弹窗滚动锁计数、键盘退出、关闭草稿与打印隔离已验证。

未改 package/lockfile、Provider、AppShell、NAV、components/mt、lib/mt、homework 页面。next-env.d.ts 和 tsconfig.tsbuildinfo 为 Next/TypeScript 运行产物。所有页面、数据与原件运行时内置于工程，不依赖外部 HTML 路径。

## 验证与证据

实际目标 pnpm typecheck PASS；pnpm test 72/72，另含原 staff-refinement 21条内部检查；pnpm build PASS。最终12类课程浏览器流程、6类保留教研/学校流程、6类普通教师/导航检查、6类生产构建检查 PASS。320/390/768/1440无整页横向溢出，大纲子页签顶部几何位置一致。

生产构建核验包含六类课程直达、QP/MS PDF字节、嵌套原文件弹窗后退、原左栏学校跳转、业务弹窗 Escape 留稿、加载教研样式后 SPA 返回原作业页的计算样式比对。临时生产端口3111用于核验，日常预览3109继续提供人工入口。

原76份文件逐一哈希与签名核验，69 PDF、6 ZIP、1 Word，共38,416,421字节；PDF只引用已登记路径。四类重点页面已进行同内容宽度截图自检，对照保存在本目录 evidence。

首轮审查的导出/异步/打印/草稿/历史导航问题、第二轮个人副本篮身份/弹窗锁/计划预览操作/旧下拉问题、最终共同题干显示及引用链/私有标注导回问题已修复并聚焦复核。审查明细见 `../../reviews/2026-10-13-exact-html-replica.md`。以前失败日志留在本机核验目录，最新证据只记录实际最终运行结果。

## 人工核验和限制

[人工指南](../../milestones/exact-html-replica/MANUAL_VERIFICATION_GUIDE.md) 提供四个重点页面直达链接及短流程。Owner 状态 PENDING，未提交、未合并、未推送；机器通过不等于人工接受视觉一致性。原本机 HTML 数据、原框架已修改资料和历史修订均不清除或改写。本轮不宣称生产鉴权、PDF全文解析、真实发送或主项目make check已完成。
