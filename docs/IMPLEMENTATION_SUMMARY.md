# 2026-10-22 学校资料改进验收与提交授权

Owner反馈 U-IMPORT-20261022-06：“核验没发现问题，请把当前代码提交并推送。”本次验收对应统一学校业务库、人员/部门/职务/场所导入与界面还原的当前原型，不延伸为生产认证或全系统后端验收；该授权替代此前暂不提交要求。

提交前核对54个实现/配置/测试文件与已审查交付证据完全一致，指纹 `057a1abc086e48440e27734b45c7fd73fd38767e2959936dcabe2b994adf6c06`。本地main与origin/main基线均为 `96c4b1341627d596108c47d720beb24fffb0629d`。本轮仅记录验收和发布，不修改已验收产品实现。真实工作簿、业务库、迁移备份、会话密钥与浏览器资料不纳入Git，继续留在本机忽略目录。

将对干净代码提交复跑319项测试、Python解析、类型检查与Webpack构建，通过后普通推送既有origin/main。实际提交SHA、复验和远端回执补入 [发布证据](evidence/school-files-import/publication.json)。下方PENDING/未提交均为先前阶段状态，保留历史不倒写。

---

# 2026-10-22 学校业务库统一持久化与界面还原（当前有效）

按最新指令U-IMPORT-20261022-05，删除近期导入相关横幅、数量提示、来源说明和范围开关；教职工与基础目录改为同一学校SQLite业务库，浏览器缓存不再作为唯一数据源。Excel与生成导入包仅由显式提取/初始化操作读取，普通页面只读写业务数据库。旧记录、旧浏览器修改、来源别名、完整场所用途与历史工号保留；迁移冲突保留两份内容，版本检查防止旧窗口覆盖。

表单和两条人员导入路径均等待服务器成功再提示完成；事务失败可原输入重试。数据库强制保留工号历史；服务器成功但浏览器缓存不可写时使用当前页面内存，刷新后仍从系统恢复。layout只新增无可见UI的provider，原侧栏、顶栏、作业与其他业务存储未改。共享范围限人员档案、部门/职务/场所和E类编号，不声称全部原型业务已迁移。

当前本机预览从普通入口可见127人员、11部门条目、65场所，含保留原记录；独立站点存储与两套HTTP会话均核验一致。临时断开生成导入包后仍可读同一数据，已原hash恢复；Excel未改。319项测试、Python4项、类型检查、Webpack构建通过；独立66项复核PASS。真实资料仅在忽略的私有数据目录，数据库权限600、目录700，生产追踪不含私有目录。

该共享API沿用本机开发态模拟身份与固定学校签名会话，生产关闭，正式部署须接入真实认证；不把本地原型认证称为生产权限系统。用户人工内容核验PENDING，未提交、未推送。此前“浏览器持久化”“自动源补载”“导入资料 / 全部资料”描述均仅为下方历史记录，已被本节替代。

[设计与实现](design-history/2026-10-22-school-files-import/DESIGN_AND_IMPLEMENTATION.md) · [普通入口核验](milestones/school-files-import/MANUAL_VERIFICATION_GUIDE.md) · [最终证据](evidence/school-files-import/shared-school-database.json) · [独立审查](reviews/2026-10-22-school-files-import.md)。

---

# 2026-10-22 人员组织映射与场所导入

最新有效指令（U-IMPORT-20261022-04）：Excel只在一次性导入时提取，写入原型既有持久化业务存储；普通页面启动和刷新不得再从本机导入文件加载。上一轮跨浏览器自动补载方案被本指令替代，保留下方历史证据但不继续沿用。

本轮移除普通 `/school` 的导入元信息读取、自动补载hook/hydrator、公共目录接口及服务端投影。教职工、部门、职务和场所页面直接使用已保存的staff/foundation存储；专用入口仅作显式一次性导入，不参与普通导航。源文件不存在、访问凭据失效或接口不可用均不影响已保存的业务记录。原Excel、来源ID、示例与人工修改保留；不把真实名单硬编码进源码或仓库。

实际内置浏览器核验时，暂时移走生成的导入包（未动Excel），从左栏学校管理进入人员117条导入/总127条、部门6条、场所60条；整页刷新后数量保留。源不可用时三个普通路由HTTP200，两个旧源接口404，普通HTML没有导入批次元信息。合成回归同时阻断源模块和网络，直接渲染三类真实页面，清空会话并重载模块仍保留导入记录与修改。全量检查、来源原样恢复、最终指纹及独立复核见 `docs/evidence/school-files-import/persisted-ordinary-entry.json`。状态VERIFYING，当前浏览器内容由用户核验，暂不提交、不推送。

当前原型持久化仍为相应浏览器的localStorage，不是跨浏览器后台数据库；清理站点数据或另一浏览器需显式导入，普通启动不播种。此前将另一个核验窗口的结果代表用户窗口的判断已纠正。

最新用户截图反馈（U-IMPORT-20261022-03）确认当前浏览器仍只有6个旧示例部门、没有导入汇总。前一轮仅在核验浏览器确认数据，误把问题全部归因于目录排序；该结论不适用于用户的独立浏览器。本轮修正载入方式：普通 `/school` 在开发态回环服务取得批次元信息，自动载入不含人员姓名/档案的6部门、39职务、60场所目录；等待/失败有明确状态，不能把示例当成已完成导入。117条完整人员资料仍需本次专用入口建立受限本机会话，已连接浏览器后续可自动补载，未连接则明确提示。原身份、数据与修改保留，不自动授予真实人员账号或职责。

来源ID别名防止改名后反复追加；兼容早期已改名的已知示例条目。公共场所手工修改后不被完整资料覆盖，来源文件人数单独保存并标识，连接人员后改用当前归属计数。完整304项测试、类型检查、Webpack构建通过；无cookie的实际HTTP取得6/39/60目录且无来源人名，无凭据人员接口404，有效凭据/已有会话均返回117条；生产接口404、私有构建追踪0条。独立复核51项通过，无剩余必须修复项。证据见 `docs/evidence/school-files-import/cross-browser-source.json`；用户当前浏览器内容核验PENDING，未提交、未推送。

后续用户反馈基础资料仍显示旧数据：从实际 `/school` 入口核对，正式数据已存在，旧示例与历史学科部门标签排前且混在同一列表，导致观感未更新。本轮增加“导入资料 / 全部资料”，有导入时默认前者，明确汇总6部门/39职务/60场所；全部资料保留原11个部门条目和65个场所。自然去重仅补来源、旧批次共享部门兼容识别、可见条目排序与新增后切至全部资料均保留既有内容。完整291项测试、类型检查、构建、最终差异检查及实际浏览器范围切换通过；证据追加于 `docs/evidence/school-files-import/foundation-source-scope.json`，不覆盖首次候选与验证快照。人工内容核验仍PENDING，未提交代码。

后续用户明确要求打开本机核验页并完成导入，仍暂不提交。本轮通过现有内置浏览器确认“已导入当前浏览器”，刷新后恢复本批次资料；本批次117条人员、6个正式部门、60个场所。管理页包含原示例，实际合计127条人员、11个部门条目、65个场所。核验页已保持打开，具体内容与视觉仍待用户核验；未改产品代码。此前浏览器NOT_RUN保留为首次实施阶段状态，本轮UI结果追加于同一证据文件的browserFollowUp，不包含真实名单或访问令牌。

用户提供人员部门表与场所分布图，要求明确教务处下的学科教研组映射并更新系统供核验。基线main `96c4b1341627d596108c47d720beb24fffb0629d`，开始时干净。本轮不沿用上一轮提交授权，不提交、不推送。

教研组旧归口迁移为教务处，保留稳定ID与职责；人员正式部门不再静默改名。职位学科只作为待核对线索，新档案无账号、无角色、无职责，缺失字段留空，同名记录不自动合并。部门/职务/场所接入持久目录，场所成为课表候选，既有数据保留。

私有工作簿只读，实际记录仅存忽略的本机数据与浏览器本地存储；源码、fixture、截图、日志与本报告不含真实名单。首次导入使用专门的开发态回环入口及随机能力令牌，普通页面服务端只返回汇总，生产构建排除私有文件。机器测试使用合成数据。当前浏览器是否完成导入及视觉效果由用户核验，不伪造浏览器验收。

[设计与实现](design-history/2026-10-22-school-files-import/DESIGN_AND_IMPLEMENTATION.md) · [人工核验](milestones/school-files-import/MANUAL_VERIFICATION_GUIDE.md) · [验证证据](evidence/school-files-import/verification.json) · [独立审查](reviews/2026-10-22-school-files-import.md)。状态VERIFYING，人工PENDING，父make check与浏览器自动化NOT_RUN；验证数与候选指纹以证据文件为准。

---

# 2026-10-22 当前代码提交推送授权

用户明确要求“请把当前代码提交并推送”，本次授权覆盖当前已审查的大纲归属／学校维护、组内课程资源导航及真题预览改进，取代此前临时不提交要求；不将此视为全部视觉或生产验收通过。33个实现与测试文件均与两轮独立审查指纹一致，原课表、主外壳和作业范围保持不变。

代码已提交为 `906d636371cc1f8149d9020fbd4121dbb7de4259`，在该干净提交上完成253项测试、类型检查及Webpack构建，检查前后工作区均干净，并已普通推送到 `origin/main`；通过远端查询核对同一SHA。合并审查范围指纹 `2748c531c5398992fabe1466fb8324e595519fa2c46db675a29b340caa16c596` 保持一致，源码备份及日志哈希见 [发布证据](evidence/research-delivery-2026-10-22/publication.json)。本次后续文档提交只记录验证与推送回执，不修改已测实现。下方阶段记录中的“未提交”是当时状态，历史结论不倒写；浏览器自动化及父make check仍NOT_RUN，人工视觉核验PENDING。

---

# 2026-10-22 真题预览样式与原文件空间优化

用户要求按附件 HTML 恢复真题预览风格，保留现有右上角按钮，压缩原文件页顶部。已恢复220px题号目录、居中900px单列题卡、题干在上／答案在下；保留所有原操作。原文件改为紧凑页头和每栏独立文件选择，去掉重复返回及常驻实现说明，PDF使用剩余高度，窄屏可上下对照。原文件、个人批注、科组课程上下文和此前未提交大纲改进继续保留。

基线main `d2530f155fbd03e65a4e409ea573737d01ee987e`加上此前未提交修改；本轮增量仅3个预览实现文件和1个测试文件。全套253项测试、类型检查、Webpack构建通过；最终独立审查、HTTP结果和范围指纹见 [证据](evidence/paper-preview-refresh/verification.json) 与 [审查](reviews/2026-10-22-paper-preview-refresh.md)。[设计与实现](design-history/2026-10-22-paper-preview-refresh/DESIGN_AND_IMPLEMENTATION.md)；[人工核验](milestones/paper-preview-refresh/MANUAL_VERIFICATION_GUIDE.md)。浏览器自动化和父make check NOT_RUN，人工核验PENDING；未提交、未推送。

---

# 2026-10-22 大纲归属与课程导航完善

用户授权明确学校、组内与个人大纲的归属和权限，补齐学校维护入口，修复教学资源切换丢失导航/误入个人的问题；明确保留既有数据、暂不提交。基线 main `d2530f155fbd03e65a4e409ea573737d01ee987e`，本轮验证未提交工作区，不沿用此前课表人工接受结论。

学校大纲接入真实 `course_material` 具体课程授权及统一职责存储；标准教务配置仅在 C101/C201 内可安排维护人，新授予不带再授权。学校原稿在我的教研内只读，通过明确入口前往 `/catalog?tab=syllabi` 新建/修订/归档；组内原稿仅有效可写组长维护，个人副本仅本人维护。命令重新核查最新授权，不迁改已有大纲 owner/ID/修订快照。

课程五项导航保持 group/space/course；简化资源目录仅用于无课程内容上下文的入口。学校嵌套编辑留在课程管理，历年真题与个人副本明确外跳并提供返回入口。个人列表不再混入学校原稿，其他教师个人资料不再误标学校维护。

详细设计与实际读取范围：[本轮文档](design-history/2026-10-22-syllabus-ownership-navigation/DESIGN_AND_IMPLEMENTATION.md)；[人工核验](milestones/syllabus-ownership-navigation/MANUAL_VERIFICATION_GUIDE.md)；[独立审查](reviews/2026-10-22-syllabus-ownership-navigation.md)；[验证证据](evidence/syllabus-ownership-navigation/verification.json)。最终246项测试、类型检查、构建、差异检查及4条入口HTTP检查通过；独立96项相关回归与7种实时撤权检查通过，无剩余必须修复项。27实现文件加3测试的指纹为 `06354a9b36f18630917c3af46d5e78e53a59058730ebcfcc7be57eb4543b9f32`，与独立审查一致。浏览器自动化和父 make check NOT_RUN，人工核验 PENDING。不提交、不推送。

---

# 2026-10-19 课表完整归档与提交推送

用户当前反馈“核验没发现问题，暂时可以接受”，要求把所有课表改进整理成一份文档并提交推送。记录U-TT-20261019-01：当前原型暂时接受及提交推送授权；不延伸为所有浏览器/设备或生产启用验收。该授权取代本轮此前暂不提交的限制。

完整设计与实现统一记录在 [课表改进总览](design-history/2026-10-19-timetable-improvements/DESIGN_AND_IMPLEMENTATION.md)，覆盖样式细分、两侧四部位、教师默认、颜色保存修复、筛选、教师姓名、明确行政归属、冲突、活动浏览/摘要及四教师演示；并澄清已有教研课表边界。旧分阶段文件作为当时快照保留，PENDING和未提交不代表当前状态。

本轮仅归档文档、复核现有代码并发布，无新增业务代码。基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，25实现文件+13测试文件+.gitignore的集合指纹`0b956f87a1ba5ddaf71eede01e2f8df4a9c501d99393325b0b61e9d298014fad`，独立范围核对一致。原左栏/顶栏/作业、共享排课与校历store无改动；.local-artifacts日志不入Git。已在干净代码提交`f946ac29335b1ccb7d4c4e10677c7090011ead5b`上执行原型现有检查，并普通推送至既有origin/main，远端SHA核对一致；最终记录见 [交付证据](evidence/timetable-improvements/publication.json) 和 [独立复核](reviews/2026-10-19-timetable-consolidation.md)。

最终干净提交复验：221项测试、类型和构建PASS，检查前后工作区干净；此前149项独立课表回归PASS。本次代码已推送，后续仅以文档提交记录复验与推送回执，不修改已测实现。浏览器自动化和父make check仍NOT_RUN，用户本次实际人工反馈单独保留。原始日志与源代码备份留在忽略目录.local-artifacts/timetable-consolidation/，证据记录哈希。

---

# 2026-10-19 多人数学答疑独立演示

Owner要求为多人答疑摘要、教师筛选和展开明细添加可直接核验的演示，保留现有数据、暂不提交。已增加独立路由和课表顶部入口：2026-10-28周三第8节，4位专用合成数学教师在D101/D102/D105/D208答疑。复用真实WeekGrid和CardDetail，筛选至单人恢复原卡，清除恢复摘要。演示不写业务数据/共享时钟/周次/校历；原TEACHERS目录不变，原样式只读保留。退出回课表中心，重新体验只清本页状态。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，6文件指纹`4000a0fe20a3f2b3749b04f49a552eeb751e50fc3828afc44ac4b363e36d6709`。类型检查、221项测试（新增7项）、构建及diff检查通过；演示/教务/教师入口HTTP200。SSR与组件事件验证不是实际浏览器测试；浏览器/视觉及父make check NOT_RUN，人工核验PENDING。独立最终审查149项课表回归与额外SSR通过，6文件指纹一致，无剩余必须修复项。保留所有既有修改，未提交或推送。

设计/实施：docs/design-history/2026-10-19-math-qa-demo/；证据：docs/evidence/math-qa-demo/verification.json；独立审查：docs/reviews/2026-10-19-math-qa-demo.md；人工指南：docs/milestones/math-qa-demo/MANUAL_VERIFICATION_GUIDE.md。

---

# 2026-10-19 多教师活动摘要卡

Owner指出多个数学教师的同名答疑不应堆放所有姓名。本轮仅在教务只读活动视图，把同实际日期、同节次、同完整名称的可见安排归组为摘要：教师人数、安排数、场所及状态/冲突；单项继续原卡。点开弹窗逐项查看原ClassCard，保留每人的场所/样式/备注与原详情导航。完整源冲突先计算再筛选/归组，未合并业务存储；摘要不随机继承第一位教师默认色。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，4文件指纹 `1e603eb89ae9aab55b0dd9e588d283d617fb9a73206c30e0f91daf786af613db`。类型检查、214项测试、构建和diff检查通过，两侧HTTP200。独立最终审查142项课表回归与100位教师摘要SSR通过，指纹一致，无剩余必须修复项。原样式/活动入口修复继续保留。浏览器/视觉、父make check NOT_RUN；Owner核验PENDING，默认数据不足多人活动时对应人工项保持待核验，不自动覆盖用户浏览器数据。未提交或推送。

设计/实施：docs/design-history/2026-10-19-activity-summary-cards/；证据：docs/evidence/activity-summary-cards/verification.json；独立审查：docs/reviews/2026-10-19-activity-summary-cards.md；人工指南：docs/milestones/activity-summary-cards/MANUAL_VERIFICATION_GUIDE.md。

---

# 2026-10-19 颜色跨部位保留与教务活动浏览

Owner反馈切到课卡外观后文字设置失效、教务没有活动入口。本轮确认候选预览在切部位时被清空，改为取色/六位HEX立即保存、三位HEX失焦/回车/切部位保存；保留各字段独立和旧偏好，失败/非法输入在同对象各部位保留。教务新增活动对象类及名称筛选，汇总学校发布源，显示教师/场所并沿用详情。完整学校课表与校历先判冲突，再按活动范围筛选；目录不再重复不完整的本周计数。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，9文件指纹 `cf97e1416d6d1fd7c5394587910759e5ff889b559f7e57f3ce1c2882311c092e`。类型检查、200项测试、构建、diff检查通过；两侧HTTP200。审查发现R1三位HEX过早规范化和R2目录跨周计数不一致，均已修复并保留反例。独立最终128项回归及4条真实provider保存路径通过，指纹匹配，无剩余必须修复项。浏览器/视觉和父make check NOT_RUN，人工核验PENDING；未提交或推送。

设计/实施：docs/design-history/2026-10-19-timetable-style-retention-activities/；证据：docs/evidence/timetable-style-retention-activities/verification.json；独立审查：docs/reviews/2026-10-19-timetable-style-retention-activities.md；人工指南：docs/milestones/timetable-style-retention-activities/MANUAL_VERIFICATION_GUIDE.md。此前候选仅手动保存/跨部位清除的交互由本轮替代，历史测试结果不倒写。

---

# 2026-10-19 活动并入整张课卡设置对象

Owner指出活动课卡应放在整张课卡对象中。本轮教师/教务两侧移除独立活动类别，下拉框按教学对象和活动分组，统一外观/名称/教师姓名/场所四部位。旧ACTIVITY完整名键及配色保留；同名教学对象与活动的选择与存储隔离。教师活动不依赖MT任务身份，选中时按同名活动生效，教学范围仅在教学对象下显示。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，3文件指纹 `7dd7ad740d2a8dfc8c283ef295af852030be4dd30c504cd09a78c440b940459f`。类型检查、178项测试（新增11项）、构建及diff检查通过；两侧课表HTTP200。独立审查98项专项与40组兼容检查通过、指纹一致，无必须修复项。浏览器/视觉和父make check NOT_RUN，人工核验PENDING；未提交或推送。

设计/实施：docs/design-history/2026-10-19-activity-card-settings/；证据：docs/evidence/activity-card-settings/verification.json；审查：docs/reviews/2026-10-19-activity-card-settings.md；人工指南：docs/milestones/activity-card-settings/MANUAL_VERIFICATION_GUIDE.md。前轮活动独立入口记录由本轮替代，原验证状态保留。

---

# 2026-10-19 颜色编辑修复与教师样式设置统一

Owner要求修复颜色/底色互相影响，将教师设置按教务方式分开并改“场所”。已修复临时预览单patch互相覆盖和输入本地草稿残留，逐字段预览/保存/恢复，切换上下文不复活候选。教师两入口共享四部位编辑器，保留原TASK/CLASS/COURSE偏好与逐属性最后保存规则；新增边框/文字属性独立保存。实际课次、日卡、完整课表同步生效，状态与合并/聚焦标记保留。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，9文件指纹 `ab862e8e030fe626d2620eeeda8247c9074b388624d7eec011977461d24f4f84`。类型检查、167项测试（新增32项）、构建及diff检查通过；3条入口HTTP200。独立审查87项专项回归通过、指纹匹配，无剩余必须修复项。浏览器/视觉和父make check NOT_RUN，Owner人工核验PENDING。本轮未提交或推送。

设计/实施：docs/design-history/2026-10-19-timetable-style-editing/；证据：docs/evidence/timetable-style-editing/verification.json；审查：docs/reviews/2026-10-19-timetable-style-editing.md；人工指南：docs/milestones/timetable-style-editing/MANUAL_VERIFICATION_GUIDE.md。历史记录不倒写。

---

# 2026-10-19 课卡外观与文字样式分离

Owner要求整卡背景、边框独立设置，统一对象名称、教师姓名和办公室／教室的文字控制。本轮整张课卡下分为课卡外观、对象名称、教师姓名、办公室／教室；外观设置背景/边框/圆角，三个文字页共用颜色/局部底色/字重/字体。旧CARD背景含义不变，分部位恢复互不清除。状态外观、冲突提示和原按教师默认保留。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，4文件指纹 `c1b74c15cdae38452a8f633f065d1973bbd24ef001b717fd46c6f9217fbfff25`。类型检查、135项测试（新增11项）、构建、diff检查通过；两条课表HTTP200。独立审查指出AUTO输入与实际背景色不一致，已修复并补回归；55项专项及25组兼容检查通过，最终指纹匹配，无剩余必须修复项。浏览器/视觉及父make check NOT_RUN，人工核验PENDING；未提交或推送。

设计/实施：docs/design-history/2026-10-19-timetable-surface/；证据：docs/evidence/timetable-surface/verification.json；审查：docs/reviews/2026-10-19-timetable-surface.md；人工指南：docs/milestones/timetable-surface/MANUAL_VERIFICATION_GUIDE.md。此前结果保留为历史。

---

# 2026-10-19 整张课卡的教师与地点文字样式

Owner要求整张课卡下增加教师和办公室设置。Owner随后明确确认需要课卡内部文字样式，当前实现一致：对象选择下增加对象样式、教师姓名、办公室／教室三种部位，分别保存颜色、文字底色、字体、字重和恢复默认。沿用实际room，不更改教师或地点数据；按教师整卡配色保持原功能。需求理解已确认；人工视觉核验仍PENDING。本次答复只更新需求记录，代码和已有测试证据不变。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，3项实现指纹 `51f44035f13a489861fe31bf6ba3685feefcc99c4f810a42f7bdc4c86ef1c2f9` 与独立审查匹配。类型检查、124项测试（新增7项）、构建、diff检查通过，两条课表HTTP200；独立审查44项专项及250组组合断言通过，无必须修复项。浏览器/视觉和父make check NOT_RUN，Owner核验PENDING；本轮未提交或推送。

设计/实施：docs/design-history/2026-10-19-timetable-card-text/；证据：docs/evidence/timetable-card-text/verification.json；审查：docs/reviews/2026-10-19-timetable-card-text.md；人工指南：docs/milestones/timetable-card-text/MANUAL_VERIFICATION_GUIDE.md。旧结果保留为历史。

---

# 2026-10-19 教务按教师设置课卡样式

Owner 要求教务样式增加不同教师设置。已在原弹窗增加“按教师”，支持当前完整课表范围内教师的文字、背景、字体、字重及恢复继承；按teacherId跨课程/活动使用。教师作为默认，具体CARD/ACTIVITY属性及学科/行政班片段优先，预览明确显示覆盖关系。样式仍按当前浏览者/admin隔离保存，教师端旧解析和排课业务不变。

基线 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，3项实现指纹 `3b932eab8646369387431f1671d4fdbcfe1500ae5005001ea79db4d98dc33b0a` 与独立审查一致。类型检查、117项测试（新增9项）、构建、diff检查通过，两条课表预览HTTP200；独立审查无必须修复项，37项专项与500组旧样式兼容验证通过。浏览器交互/视觉、父仓库make check NOT_RUN；Owner人工核验PENDING。本轮代码未提交或推送。

设计/实施：docs/design-history/2026-10-19-admin-teacher-appearance/；证据：docs/evidence/admin-teacher-appearance/verification.json；审查：docs/reviews/2026-10-19-admin-teacher-appearance.md；人工指南：docs/milestones/admin-teacher-appearance/MANUAL_VERIFICATION_GUIDE.md。下方各阶段原指纹与结果作为历史保留。

---

# 2026-10-19 行政班课表归属与冲突提示修正

Owner 反馈高一（2）班周五第3节出现高一1班数学/高一2班历史且无冲突标识。查明旧视图聚合任课教师整张课表，且课卡未接冲突判断。本轮按教学班显式行政归属汇总学校课次，标明“归属安排”，保留走班学生实际去向的区别；完整有效课次判断后再筛选，教师/教室/已知学生交集标红，名单不足或不同数据域标黄待核对。名单加载失败不以种子数据确定学生冲突。现有样式、筛选及原数据保留。

基线 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；5项增量实现指纹 `1eabd49a958881c71da4020f267964bdcbaaeed93fea81a31542af3641bbcaef` 与独立复审匹配。类型检查、108项测试（本轮新增14项含真实WeekGrid渲染）、构建、diff检查通过；4条预览路由HTTP200。独立审查TC-01旧组标签误判、TC-02未加载名单误判均修复，无剩余必须修复项。自动浏览器/视觉和父仓库make check NOT_RUN，Owner核验PENDING。未提交或推送本轮工作。

设计/实施：docs/design-history/2026-10-19-timetable-conflicts/；证据：docs/evidence/timetable-conflicts/verification.json；审查：docs/reviews/2026-10-19-timetable-conflicts.md；人工指南：docs/milestones/timetable-conflicts/MANUAL_VERIFICATION_GUIDE.md。下方样式任务的“仍按成员教师聚合”是历史状态，已由本轮修正替代，旧验证记录不倒写。

---

# 2026-10-19 课表样式细分、教务显示与筛选

本轮按最新课表反馈实现可选学科/行政班文字样式，活动整体设置；旧整卡逐属性保存/清除规则保留。教务按浏览者保存独立样式，教学班/行政班卡片显示教师，修复同一教师多个教学班同时选中问题。完整投影后筛选，原占位、冲突与差异计算保留；关键词匹配可见分工，教务规范视图不引入私人名称。顶栏、左栏、作业原实现无差异。

基线 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；13 实现文件指纹 `961f6939e0ff4c9a981294ba61b55b1511f921d8953cc46aff7e916fa23aa5e2`，与独立复审匹配。pnpm typecheck、94项测试、pnpm build、diff check 通过；新增14项课表行为测试。4个预览路由HTTP200。独立审查2项P2已修复，最终无必须修复项。自动浏览器交互/截图及父仓库make check NOT_RUN，不将SSR/服务响应算作视觉验收。Owner人工核验PENDING，本次新增工作未提交或推送。

设计/实施：docs/design-history/2026-10-19-timetable-display/；证据：docs/evidence/timetable-display/verification.json；审查：docs/reviews/2026-10-19-timetable-display.md；人工指南：docs/milestones/timetable-display/MANUAL_VERIFICATION_GUIDE.md。行政班沿用原成员教师聚合口径，未臆造跨班学生去向；未知自由标题保留整体显示。

---

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
