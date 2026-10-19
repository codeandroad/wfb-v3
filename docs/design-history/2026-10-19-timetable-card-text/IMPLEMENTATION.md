# 课卡教师与地点文字样式实施（2026-10-19）

## 指令、范围与已读

用户要求在整张课卡设置下增加教师与办公室设置。Owner随后已确认需要分别设置课卡中教师姓名、办公室／教室文字的颜色和字体，与现有实现一致；没有改排课教师/地点内容。保留“按教师”的整卡默认设置与此前课表改动。

基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，当前未提交工作区。本轮增改3个实现文件：lib/timetable/display.ts、components/timetable/display-settings.tsx、components/timetable/week-grid.tsx；新增 tests/timetable-card-text.test.cjs。已读仓库/父目录指令、安装版Next.js use-client指南、上述文件与原样式解析/颜色输入/字段模型/详情及已有测试，确认没有独立办公室字段。

## 实现

新增 CARD_TEACHER_TEXT/CARD_ROOM_TEXT 和 resolveCardTextAppearance，仅教务非活动课卡按当前对象className取独立偏好。未配置时不继承标题的ps.hex/font等，保持原教师行、地点行默认。预览和真实ClassCard共用StyledCardText，文字背景仅作用于span。

整张课卡对象选择下增加对象样式、教师姓名、办公室／教室部位。保存与未保存候选预览分别按当前部位键操作，恢复只清该部位。原CARD/TEACHER/学科/行政班样式、冲突检测、校历、过滤及业务存储不变。姓名仍由showTeacher控制；room为空不伪造示例地点，教师模式和活动不套用新字段偏好。

## 验证与独立审查

类型检查PASS；全量124/124测试PASS，新增7项字段隔离/JSON保存清除/真实ClassCard渲染回归；构建PASS；diff检查PASS。本地/timetable与/timetable/my响应200。浏览器交互和视觉NOT_RUN；父生产仓库make check在当前wfb-v3无目标，本项NOT_RUN。

独立Reviewer未参与实现，44项专项回归与250组组合断言通过，未发现必须修复项。报告 ../../reviews/2026-10-19-timetable-card-text.md；3项实现指纹 `51f44035f13a489861fe31bf6ba3685feefcc99c4f810a42f7bdc4c86ef1c2f9` 与审查一致。详细文件及日志哈希见 ../../evidence/timetable-card-text/verification.json。

## 状态

Owner已确认需求理解；人工视觉核验PENDING。本次确认仅更新文档，未改代码或重复执行测试。实际入口与步骤见 ../../milestones/timetable-card-text/MANUAL_VERIFICATION_GUIDE.md。未提交或推送。历史117项及更早结果保留为当时证据，当前联合候选以本轮124项为准。不以SSR/HTTP充当浏览器或人工验收。
