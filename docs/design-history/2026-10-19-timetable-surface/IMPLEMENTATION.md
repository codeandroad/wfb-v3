# 课卡外观分离实施（2026-10-19）

## 范围与依据

按Owner最新要求，将整卡背景、边框从对象文字样式独立，并统一三个文字设置页。基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`；本轮未提交。已读本仓库及父目录AGENTS、安装版Next.js use-client指南、现有display-settings/week-grid/display/mt styles、颜色输入及前轮设计与测试。保留所有此前未提交课表改动。

本轮4项实现文件：components/timetable/display-settings.tsx、components/timetable/week-grid.tsx、lib/timetable/display.ts、lib/timetable/surface.ts；新增tests/timetable-surface.test.cjs。原顶栏、侧栏、作业、研究与课程页面不在本轮变更范围。

## 实现

新增CARD_SURFACE和CARD_OBJECT_TEXT编辑部位。appearanceEditorPref/saveAppearancePatch继续复用原CARD.bg作为整卡背景，CARD颜色/字体/字重作为对象文字；对象局部背景、受控边框/圆角分别存独立键。清除只操作当前部位，部分保存保留其他属性；颜色归一化，宽度/线型/圆角只接受列举值，显式0可持久化。

AppearanceEditorControls为三个文字部位提供同一布局。TimetableCardPreview与ClassCard共用cardSurfaceStyle；真实状态卡继续由原状态处理覆盖常规外观。StyledLessonTitle只在配置局部底色时包裹名称，已设置的学科/行政班片段继续生效。

独立审查发现旧AUTO配套背景的输入框曾按默认灰色而非有效标题色计算（实际黑色标题背景#e0e0e0，输入错误#ebeced），已通过appearanceEditorEffective统一解析修复，并加入实际HEX控件回归测试。对象AUTO底色继承教师标题颜色也已覆盖。

## 验证与交付状态

pnpm typecheck PASS；全量135/135测试PASS（本轮新增11项）；pnpm build PASS；git diff --check PASS；本地/timetable和/timetable/my HTTP200。测试包含保存/恢复隔离、JSON持久化、非法值、旧色板/NONE/AUTO、真实ClassCard与预览一致、三个文字页控件同构、状态外观与冲突标识。

4文件组合指纹：`c1b74c15cdae38452a8f633f065d1973bbd24ef001b717fd46c6f9217fbfff25`。独立审查无剩余必须修复项，55项专项回归与25组兼容检查通过，指纹匹配；见../../reviews/2026-10-19-timetable-surface.md；文件与日志哈希见../../evidence/timetable-surface/verification.json。

浏览器视觉/交互NOT_RUN，不能以SSR和HTTP成功替代；人工核验PENDING。父生产make check在wfb-v3无目标，NOT_RUN。原始日志在忽略的.local-artifacts/timetable-surface/；人工步骤见../../milestones/timetable-surface/MANUAL_VERIFICATION_GUIDE.md。本轮未提交或推送。
