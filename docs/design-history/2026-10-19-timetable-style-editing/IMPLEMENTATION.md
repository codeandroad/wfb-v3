# 颜色编辑修复与教师统一实施（2026-10-19）

## 依据与范围

Owner要求修复文字色/底色互相影响，教师侧采用教务的外观与文字分离方式，保留已有设置，地点标签改“场所”。基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，本轮未提交。已读本仓库与父AGENTS、安装版Next.js use-client指南、frontend-design技能、既有输入/设置/样式存储/教师身份与卡片渲染、前轮设计及测试。沿用现有配色、布局和控件体系；不改顶栏、侧栏、作业及研究课程功能。

本轮9实现文件：components/mt/style-color-input.tsx、use-style-drafts.ts、teacher-prefs.tsx、week-schedule.tsx、day-cards-view.tsx；components/timetable/display-settings.tsx、week-grid.tsx；lib/timetable/display.ts、teacher-appearance.ts。新增两组测试，旧缺失地点测试只更新文案断言；本轮未修改lib/mt/styles.ts原解析器。

## 根因与修复

原设置只保留一个临时patch，第二个颜色输入会替换第一个字段的候选；每个输入各持有draft，任意保存或无效输入又清整份预览。因此输入仍显示新值，而预览已回到旧值。原逐项保存函数没有删除其他已保存属性。

改用useStyleDrafts按当前对象/范围/部位和字段管理原始字符串，合法字段共同生成预览；输入组件受控，原始输入与预览同源。保存仅清已保存字段，失败不清；恢复字段同时清草稿；上下文变化丢弃旧草稿。颜色、背景、边框互相隔离。

## 教师侧兼容

两个教师设置入口共享TeacherCardStyleEditor及与教务相同的AppearanceEditorControls，四子页为课卡外观、对象名称、教师姓名、场所。原TASK/CLASS/COURSE仍由真实MT teacherId寻址；旧背景/标题色/字体/字重原键不变，补充属性按部位后缀存储。逐属性成功序号与清除标记确保跨范围行为不变，JSON持久化清除不会复活旧值。保留AUTO可选按钮并明确其自动配套含义。

完整课表、我的教学课次/日卡、共享名称/场所文字组件接同一教师适配器。状态表面、冲突、聚焦边框、合并日卡标记保留。本人视图不重复显示教师姓名。预览优先使用真实周课次场所；未排任务不虚构场所。合法大班演示任务由permittedTasks列表授权，仍用当前教师偏好键，所有新增显示部位与外观一致；显式空授权列表优先，不套用其他任务样式。

## 验证

最终pnpm typecheck、167/167测试、pnpm build、git diff --check均PASS；/timetable、/timetable/my、/teaching HTTP200。新增32项（教师适配与真实SSR16项、草稿与实际组件事件16项）。首轮旧“未排教室”断言因文案改“未安排场所”失败，保留原失败日志后更新对应文案断言，最终全量通过。

轻量事件测试运行真实hook、Controls、ColorInput事件与存储纯函数，覆盖两种保存顺序、同一轮连续输入、非法值、失败保存、恢复同值、边框、A/B/A上下文。SSR运行真实教师卡、预览、编辑器及状态保护。它们不包含DOM、浏览器原生取色器、hydration或视觉，浏览器交互/视觉NOT_RUN；父生产make check在本原型无目标，NOT_RUN。

9文件指纹 `ab862e8e030fe626d2620eeeda8247c9074b388624d7eec011977461d24f4f84`，文件与日志哈希见../../evidence/timetable-style-editing/verification.json。独立审查无剩余必须修复项，87项专项回归及类型/差异检查通过，9文件指纹匹配；见../../reviews/2026-10-19-timetable-style-editing.md；人工指南见../../milestones/timetable-style-editing/MANUAL_VERIFICATION_GUIDE.md。人工验收PENDING，未提交或推送；前轮证据保留历史状态。
