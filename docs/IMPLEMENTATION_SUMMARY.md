# 2026-10-19 Git 提交与推送授权

Owner 当前明确要求：“请提交当前的代码并推送。”该指令取代此前暂不提交的限制。本次保留当前 main 和 origin/main 的正常提交历史，不强推。提交推送授权与此前尚未单独确认的逐页视觉验收状态分开记录；不据此宣称生产启用或全面人工验收通过。

提交前已从 origin/main 快进同步两次课表相关提交（64af4e2、d9b32e8），与本次教研改动无重叠。整合基线为 d9b32e82068adf160f4ceabf7830d9cee9d86784。原140个实现/测试/原件文件仍与已独立复审的候选哈希01dcded033e6e41d6d02bec6b6320e350d40afede225c5546d2163d1cdc57ae9一致；98个受保护文件不变。新增.gitignore规则仅排除Next.js/TypeScript生成文件，不提交next-env.d.ts、tsconfig.tsbuildinfo或本机缓存。

2026-10-19在整合后的实际工程再次运行pnpm typecheck、pnpm test、pnpm build，均通过；测试80/80（新增远端课表回归8项，另含原staff脚本21条内部检查）。提交前只读范围复核无必须处理项。证据见docs/evidence/exact-html-replica/git-publication-2026-10-19.json；实际提交ID和推送结果以Git提交历史和origin/main引用为准。原10月13日审查与机器核验记录保留，不倒写历史结果。

---

# 2026-10-13 最终 HTML 复刻：最新候选

状态：本轮原生页面实现和机器验证完成，独立Review见本轮报告，Owner人工核验PENDING。未提交、未合并、未推送。

Owner指出此前大纲阅读、考核、真题库、组卷台几乎完全不同，明确要求完全按照最终单HTML复刻。本轮按真实DOM/CSS和完整内容逐页重建阅读目录/正文、考核网格/方案/量表、Paper与Variant横行、组卷配置/搜索/已选双栏，并恢复资源四列表格、计划内容树表/四子页签及个人资料行。五项一级分类和四项大纲子分类保持固定，原外壳、顶栏、左栏和作业管理仍保留。

数学原大纲48节点/34要求/6考核/5方案/2量表；教材目录计划83节点/72计时项目。校本小题连同同版本共同题干、父项及上游引用链保存，复合篮身份区分原题与个人副本。JSON安全批量导回、私有标注导回、历史链接、计划CSV/打印和原AssignForm接入均已实测。

实际目标typecheck PASS，72测试/0失败（另含staff脚本21检查），build PASS；12课程、6保留教研学校、6普通教师导航、6生产检查PASS，98受保护文件哈希未变。代码+资产+测试140文件聚合SHA256：`01dcded033e6e41d6d02bec6b6320e350d40afede225c5546d2163d1cdc57ae9`；文件级证据和源HTML哈希见docs/evidence/exact-html-replica/。Owner未授权提交，故没有制造新提交SHA；主项目make check本轮NOT_RUN。

当前设计与实施：docs/design-history/2026-10-13-exact-html-replica/；人工指南：docs/milestones/exact-html-replica/MANUAL_VERIFICATION_GUIDE.md。预览http://localhost:3109/research?group=math&tab=courses&course=C101&view=syllabus&sub=read，/catalog为学校统筹。原HTML/localhost存储不同，未自动迁移或清除Owner个人编辑；原HTML重复数学题ID去重后为133道，冲突满分待核对。原PDF/Word/ZIP保留，未完整解析的正文需教师核对。无生产后端、真实消息或自动全文解析的就绪宣称。

下方保留此前迁移与风格恢复的历史记录；其当时机器通过不能覆盖本轮Owner否定视觉差异的反馈。

---

# 2026-10-13 教研与课程框架移植及原 HTML 风格恢复

状态：实现、机器验证和独立 Review 完成，等待 Owner 人工核验。未提交、未合并、未推送。

## 最新人工反馈：保留原 HTML 风格

用户指出此前移植内容区外观偏离单 HTML，本轮已恢复行式科组入口、绿色下划线页签、浅绿白面板、五列科组概况、成员业务表单、课程卡片与阅读目录、独立聊天面板、统一教研课表。外壳和作业管理继续保留原实现。新增视觉样式全部限于 research CSS Module，原 homework 的样式隔离实际核验通过。

最终 typecheck、64测试、构建、9主流程/6普通教师/4审查回归与5类样式键盘隔离核验通过，独立复审通过。98个受保护文件哈希未变。当前被测未提交代码 SHA256：16f455bf376e54d153b255e5e5a13025302ce1481b81df62b0046c38d5d56106。新证据见 docs/evidence/html-style-restoration/，设计与实施见 docs/design-history/2026-10-13-html-style-restoration/。Owner 人工核验仍PENDING，未提交/合并/推送。下面原迁移记录与当时hash保留作为历史。

## 指令与范围

将 Playground 最终单 HTML 的我的教研、课程管理实现移植到 wfb-v3 的 Next.js / React / TypeScript 框架。AppShell、顶部导航、现有左栏排列和作业管理全部保留。基线 main 5308673，工作区原为干净状态。已有 /research 和 /catalog 两个入口，沿用，不新增重复入口。

## 已读取

AGENTS.md 及父目录 AGENTS.md；Next.js 16.3.3 安装包内 layouts-and-pages、server-and-client-components、use-search-params 指南；app-shell、demo/nav、providers、research/model/store/commands/context、document/task/activity/school/schedule UI、homework-handoff 与作业组件接口。源 HTML 的 research-workspace 模块和最终业务弹窗作为迁移依据。

## 设计与技术

复用现有人事职责、课程目录、任教任务、校历和资料对象。将已确认的成员自建任务/活动规则接入集中命令校验；正式任命、学校承接、共享资源维护和教研周模板沿用原职责边界。内容区为原生 React 页面，不嵌入旧 HTML，不新建作业系统。日志、群聊、收藏、试卷和组卷通过教研存储兼容扩展；保留既有存储和版本快照。

## 实际范围

修改 app/(app)/catalog/page.tsx、components/research/*、lib/research/*、相关 fixtures/tests/docs 和 public/research-papers。AppShell、NAV、布局、Provider、共享日程、components/mt、lib/mt、homework 路由共 98 个受保护文件与基线哈希完全一致。原锁文件和其他页面未改；Next 运行自动生成 next-env.d.ts。

已登记的 76 份原文件全部找到并签名/哈希核验移入工程（69 PDF、6 ZIP、1 Word，共 38,416,421 字节）。PDF iframe 仅显示已导入原 PDF，不嵌入旧 HTML。重复评分方法合并为同题，冲突分值待核验，原 Topic 保留。

## 验证记录

迁移前 pnpm install --frozen-lockfile 成功，56 项测试及生产构建通过。实际目标最终 pnpm typecheck 通过，pnpm test 为 64 通过、0 失败（另含原人员细化脚本的 21 项检查），pnpm build 成功。

隔离 Chrome 的 9 类主流程、6 类普通教师检查、4 类审查回归通过。320/390/768/1440 无整体横向溢出，顶部位置一致。生产构建原生路由、QP/MS 原 PDF 字节响应与左栏跳转冒烟通过，无页面异常。

被测未提交代码聚合 SHA-256：093c23b07bf3e1a4224c16bbeb0900c471fb740efae014f569df57df02f9d332。文件级记录和证据索引在 docs/evidence/research-course-migration/。

## Review 与人工核验

按父 AGENTS 安排未参与实现的独立只读 Reviewer。首轮 6 项问题全部修复并聚焦复审通过；追加原文件阅读的 2 项兼容问题修复后复审通过。报告见 docs/reviews/2026-10-13-research-course-migration.md。用户禁止提交优先于干净提交的 Review 要求，因此只审查基线和未提交差异，没有为制造 Review SHA 自行提交。

本机预览 http://localhost:3109/research 和 /catalog 保持运行，临时生产冒烟端口 3110 已关闭。人工指南见 docs/milestones/research-course-migration/MANUAL_VERIFICATION_GUIDE.md。完整设计与实施在本轮 design-history 目录，原 INDEX 历史条目保留。Owner 人工核验 PENDING。

file:// HTML 与 localhost 为不同浏览器来源，原 HTML 的 localStorage 不会自动进入框架；未清空或改写用户原 HTML 的浏览器数据。原型未提供真实消息服务、生产鉴权或自动 PDF/Word 全文解析，未完整解析的正文仍需教师核对。原 AssignForm/HomeworkCenter、名单、截止、评分和锁定规则继续使用 wfb-v3 实现。
