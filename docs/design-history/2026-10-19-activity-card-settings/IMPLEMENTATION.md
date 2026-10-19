# 活动统一课卡设置实施（2026-10-19）

## 依据与范围

Owner指出活动课卡应放入整张课卡的设置对象，而不是单独页签。按此前外观/文字分离框架统一教师和教务两侧入口。基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，本轮未提交。已读仓库AGENTS、已安装Next.js use-client指南、现有display/surface/display-settings及前轮记录；此前未提交改动全部保留。

本轮仅调整3个实现文件：components/timetable/display-settings.tsx、lib/timetable/display.ts、lib/timetable/surface.ts；新增tests/timetable-activity-settings.test.cjs。未改变教学任务scope适配器、原styles解析、导航、作业和课表业务。

## 实现

两侧顶层类别移除活动；设置对象按教学对象和活动使用optgroup显示，选择值编码类型和身份，实际保存仍传完整名称/原对象ID。教师对象目标为有类型的教学/活动联合，活动无须MT任务身份，选中后隐藏任务/班级/课程范围，切回教学对象保留原范围语义。

新增ACTIVITY_SURFACE、ACTIVITY_OBJECT_TEXT、ACTIVITY_TEACHER_TEXT、ACTIVITY_ROOM_TEXT。外观和对象文字编辑继续拆分读取/写入原ACTIVITY中的bg及color/font/weight，局部底色/边框/姓名/场所保存各自部位。cardPartForEntry统一将四教学部位映射活动部位；真实卡、预览、有效色解析都使用相同映射。旧CARD键不被活动读取，活动不会拆分学科/行政班；按查看者与teacher/admin模式隔离。

候选预览与逐项保存复用上轮useStyleDrafts，切换不同类型同名对象仍改变上下文键并清草稿；分部位恢复不清其他文字或表面。原活动底色、按教师基础样式、锁定/草稿/停课/补课及冲突提示保留。

## 验证与状态

最终pnpm typecheck、178/178测试（新增活动专项11项）、pnpm build与git diff --check通过，两侧课表HTTP200。新增测试覆盖旧ACTIVITY色板/AUTO/NONE、同名教学/活动隔离、四部位及JSON恢复、viewer/mode隔离、同名活动应用、真实ClassCard/Preview及状态、无MT任务教师真实设置保存。设置SSR仅替换Modal portal外壳并调用真实输入保存回调，不替代浏览器操作。文件和日志哈希见../../evidence/activity-card-settings/verification.json；独立审查无必须修复项，98项专项及40组兼容检查通过，三文件指纹匹配；见../../reviews/2026-10-19-activity-card-settings.md。本轮3文件组合指纹 `7dd7ad740d2a8dfc8c283ef295af852030be4dd30c504cd09a78c440b940459f`。

浏览器原生选择器、点击/刷新持久化与视觉未自动运行，Owner人工核验PENDING。父生产make check在本原型无目标，NOT_RUN；不以SSR/HTTP替代浏览器验收。人工步骤见../../milestones/activity-card-settings/MANUAL_VERIFICATION_GUIDE.md。未提交或推送。
