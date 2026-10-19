# 教务按教师样式实施（2026-10-19）

## 范围与基线

Owner 要求教务侧可按不同教师设置样式。基于 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f` 的现有未提交工作区增量实现；保留前两轮课表样式/筛选和行政班/冲突修复。实际实现只增改 lib/timetable/display.ts、components/timetable/display-settings.tsx、components/timetable/week-grid.tsx；新测试为 tests/timetable-teacher-appearance.test.cjs。未提交或推送。

已读仓库和父目录指令、frontend-design skill、安装版 Next.js use-client 指南、当前样式设计/实施摘要，以及 display、display-settings、week-grid、mt/styles/store、data 教师登记、card-filters、现有显示测试与 Modal。沿用既有视觉与控件；不修改旧样式算法、排课存储、权限、作业、顶栏或左栏。

## 实现

DisplayPart 增加 TEACHER，仅教务弹窗提供“按教师”。对象由完整传入课表按 teacherId 去重，姓名取教师登记，保存继续使用当前浏览者/admin隔离键和原 mt.command；未就绪/读取失败按既有逻辑阻止假保存。

新增 resolveCardAppearance，先逐属性组合教师默认与具体 CARD/ACTIVITY 值，再调用原 resolvePreference；清除墓碑表示继承而非具体值，NONE 为明确透明，AUTO 按合并后的文字色派生。ClassCard 和弹窗预览使用同一解析器。预览显示教师姓名及独立课卡覆盖属性，提供清楚的恢复继承路径。标题片段与状态提示保持原优先级。

旧教师端 TASK/CLASS/COURSE 逐属性最后成功保存算法完全未变；新规则仅作用于当前教务的教师默认层。无教师设置时保留旧可见样式。

## 验证

pnpm typecheck PASS；pnpm test 117/117 PASS；pnpm build PASS；git diff --check PASS。新增9项测试验证教师身份跨课程/活动、不同查看者和模式隔离、具体属性优先、JSON持久化清除、NONE/AUTO、实际 ClassCard 应用与状态保留。/timetable 和 /timetable/my HTTP 200。

独立 Reviewer 未参与实现，实际复核37项样式/冲突测试通过，并独立运行500组旧整卡可见样式兼容检查；无必须修复项。报告 ../../reviews/2026-10-19-admin-teacher-appearance.md。3项增量实现指纹 `3b932eab8646369387431f1671d4fdbcfe1500ae5005001ea79db4d98dc33b0a` 与复审相同，文件/日志哈希见 ../../evidence/admin-teacher-appearance/verification.json。

自动浏览器交互/截图 NOT_RUN；当前原型无父仓库 make check 目标，本项 NOT_RUN；不把HTTP或SSR算作点击/视觉验收。Owner 人工核验 PENDING，入口与步骤见 ../../milestones/admin-teacher-appearance/MANUAL_VERIFICATION_GUIDE.md。此前108项冲突验证为历史阶段结果，当前联合候选117项。
