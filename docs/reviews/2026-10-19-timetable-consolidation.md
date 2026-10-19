# 2026-10-19 课表累计改进汇总与提交范围独立审核

- Reviewer：`timetable_review`，未参与产品实现。本轮仅整理审核记录及本地证据，不提交、不推送、不修改产品代码。
- 实际依据：Owner 明确表示“核验没发现问题，暂时可以接受”，要求把所有课表改进设计和实现汇总为一份文档，再提交、推送代码。
- 核验边界：这是对当前原型的暂时接受及 Git 操作授权，不泛化为全部浏览器、全部场景或生产服务验收。
- 基线：`main` 的 `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`。已读取适用 AGENTS，沿用前序独立审查；本轮只审核汇总和累计提交范围。
- 状态：**PASS，无剩余必须修复项。** 提交范围和汇总正文与当前实现一致；实际提交后的复验及远端推送由实施者继续完成，未提前记为成功。

## 提交范围

已逐项核对 `git diff` 和 `git ls-files --others --exclude-standard`。本轮累计产品/测试范围为 25 个实现文件、13 个测试文件以及 `.gitignore`，其余为本次课表十个阶段的设计、实施、人工指南、独立审查和证据索引，以及汇总文档和索引更新。

- 教师显示：教学设置复用统一编辑器，保留原 TASK / CLASS / COURSE 的逐属性最后成功保存及清除墓碑；简版课表、日卡、任务标题使用一致解析。筛选零结果不回退显示全部任务。
- 教务显示：按当前查看者隔离的整卡/教师默认/学科/行政班文字设置；按部位拆分外观与文字；课卡教师姓名按视图显示；保留状态和冲突表达。
- 编辑可靠性：逐字段/逐部位候选、完整 HEX 及时保存、三位 HEX 完成编辑再保存、失败和非法候选保留及重试；旧活动/教学对象键及范围不混用。
- 课表与活动：完整校历投影后冲突判断及显示筛选、明确行政班归属、不同名单命名空间隔离；教务活动目录、同日同时段同名活动的显示摘要和原详情；独立数学答疑演示。
- 未发现应从提交范围剔除的无关修改；没有新增依赖、锁文件、外部资源或真实人员数据文件。

两个容易被误排除的文件已单独核对：

1. `.gitignore` 只增加 `.local-artifacts/`，防止原始日志、临时脚本和验证快照进入仓库，应随本轮提交。
2. `tests/research-workflows.test.cjs` 只给原 SSR provider 包装补入真实根布局原本已有的 `TeachingProvider`，满足共享 WeekGrid 使用 `useTeaching` 的上下文需求；未改原断言、删测试或放宽判断，应随共享组件修改提交。

主外壳 `components/app-shell.tsx`、主导航 `lib/demo/nav.ts`、作业入口 `app/(app)/homework/page.tsx`、课表共享状态 `lib/timetable/store.tsx`、校历共享状态 `lib/timetable/calendar-store.ts`、教学持久化 `lib/mt/store.tsx` 与基线逐字节一致。课表显示相关适配没有修改这些业务存储或周边入口。

## 文件与证据检查

- 当前候选文件均为源码、测试、Markdown 或 JSON 文本；没有图片、压缩包、构建结果、日志或 `.tsbuildinfo` 被纳入。
- `git check-ignore` 确认 `.local-artifacts/` 中的独立脚本与日志被排除，提交文档仅保留证据路径和校验信息。
- 十份新增阶段证据 JSON 均可解析。有限私钥头/AWS Key 签名检查没有命中；此项不称为全面安全或隐私审计。
- 前序最终实现已完成独立功能审查，最近一次独立课表测试 149/149、typecheck 和 diff 检查通过；本次无产品变更，不把文档整理包装为重新进行浏览器功能核验。
- 本轮范围证据：`.local-artifacts/timetable-consolidation/reviewer-scope.json`、`reviewer-product-test-manifest.txt`、`reviewer-pre-doc-validation.log`。

## 汇总文档审核

已通读 `docs/design-history/2026-10-19-timetable-improvements/DESIGN_AND_IMPLEMENTATION.md`，并对照实际 `display.ts`、`surface.ts`、`teacher-appearance.ts`、`display-settings.tsx`、WeekGrid、overview、活动/冲突 helper，以及既有教研课表和日志规则。

- 教师 TASK / CLASS / COURSE 的逐属性最后成功保存与教务“具体对象优先于教师默认”明确分开，没有错误地把两种优先级等同。
- 四部位、片段识别、旧键兼容、活动完整名称范围、AUTO / NONE、三位和六位 HEX 保存时机、错误候选保留与恢复边界与最终实现一致。
- 姓名按视图显示、明确行政归属、完整来源范围内的冲突/待核对、过滤后活动显示归组与独立演示的数据隔离均准确；没有声称所有视角都检查全校课表。
- 审核建议将行政班“所有教师”措辞限定为“已配置教师目录中的学校课次”，实施者已修正，与 AdminClassView 遍历 TEACHERS 的实际口径一致，未以文档整理新增产品逻辑。
- 教研课表关联段已对照 `group-schedule.tsx` 和 `workspace-model.ts`：固定周模板与日期活动分离，有效成员可记录已经发生日期的日志；未夸大为自动同步所有教师个人课表，也未把旧教研实现列为本轮新功能。
- 汇总、CURRENT、INDEX、IMPLEMENTATION_SUMMARY 和统一人工指南均把 U-TT-20261019-01 记录为当前原型暂时接受及提交推送授权；旧阶段 PENDING / 未提交明确为历史快照，没有倒写历史审查结论。
- 汇总文档的 12 个相对链接均存在；交付证据 JSON 可解析，其中 39 项源码/测试/配置清单与独立指纹一致。
- `publication.json` 目前将干净提交复验记为 `PENDING_ON_COMMITTED_TREE`、提交推送记为 `AUTHORIZED_PENDING`，区分此前已完成的 221 项测试与尚待执行的发布步骤。未提前声称新提交/推送或浏览器自动核验成功。
- 本轮 `git diff --check` PASS；无产品变化，独立验证未重跑或虚构整套功能测试。文档链接证据为 `reviewer-document-links.json`。

## 累计产品与测试范围指纹

按路径字典序，对 25 个实现文件、13 个测试文件及 `.gitignore` 生成 `sha256  path\n` 清单后计算 SHA-256。

- 范围指纹：`0b956f87a1ba5ddaf71eede01e2f8df4a9c501d99393325b0b61e9d298014fad`
- 清单：`.local-artifacts/timetable-consolidation/reviewer-product-test-manifest.txt`
- 汇总与审查文档继续编写期间不包含在此产品范围指纹中；最终待提交文件仍须由实施者在暂存后核对。

Reviewer 未执行 Git 提交或推送；提交结果以实施者实际操作和仓库引用为准。
