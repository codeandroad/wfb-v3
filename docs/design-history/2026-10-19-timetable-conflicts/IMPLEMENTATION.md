# 课表归属与冲突提示实施（2026-10-19）

## 实际指令、基线与范围

Owner 反馈行政班课表同一时段两张不同卡却无冲突标识。本轮排查、修复和验证基于 main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f` 的未提交工作区；保留上一轮课表样式、筛选及教师姓名改进。未提交或推送，不修改原课表存储、发布快照、名单、左栏、顶栏或作业业务。

已读取仓库/父目录 AGENTS、安装版本 Next.js server-and-client-components 指南、课表 data/store/calendar-store/overview-panel/week-grid、my/page、teaching/store 与 fixture、mt/model/store/scenario、实际 Providers 和相关测试。独立发现/测试/审查代理分工互斥：实现由主代理负责，测试代理仅补 tests/timetable-conflicts.test.cjs，Reviewer 只读实现并维护 review 文档。

## 实际实现

- lib/timetable/data.ts 为教学班补明确行政归属；同本地 key 的不同教师课次不再在冲突检测中互相跳过；教师、教室、旧学生组资源检查可同时给出结果。
- lib/timetable/conflict-display.ts 新建班级归属解析、有效日期名单解析、名单范围隔离和完整课次评估。显示层学生冲突忽略旧 studentGroup 快路径，仅由同域逐日名单交集给出。
- overview-panel 的行政班按明确教学班归属筛选全体教师学校发布版本，教师摘要来自课次；补课来源同范围。移除旧页面级不完整冲突条。
- WeekGrid 从完整有效校历投影计算冲突，再应用显示筛选；把冲突/待核对直接送入真实课卡并显示清单。任务名单仅在成功就绪时使用；读取失败视为未知。我的课表同步使用此唯一展示链路。
- tests/research-workflows.test.cjs 的隔离 SSR 环境补上真实应用已有的 TeachingProvider，保留全部旧断言。

## 验证与修复证据

pnpm typecheck PASS；pnpm test 108/108 PASS；pnpm build PASS；git diff --check PASS。新增14项冲突测试覆盖截图对应基线、漏课修正、有效期/归属优先、日期名单与数据域、旧组标签反例、重复投影、停课补课和真实 WeekGrid 自动连接冲突课卡。真实组件测试不手传 conflictKeys/meta，验证两张课卡自动标红、未知名单标黄、停课后移除提示。

初始完整测试暴露隔离 SSR Provider 缺失，补齐后通过。独立审查 TC-01/TC-02 发现并复现的误判已修复并加入反例。报告见 ../../reviews/2026-10-19-timetable-conflicts.md。5项增量实现清单指纹 `1eabd49a958881c71da4020f267964bdcbaaeed93fea81a31542af3641bbcaef` 与独立复审完全一致；逐文件及日志哈希见 ../../evidence/timetable-conflicts/verification.json。

本地 /timetable、/timetable/my、/research?group=math&tab=schedule、/homework HTTP 200。自动浏览器交互/截图 NOT_RUN，父生产仓库 make check NOT_RUN（当前 wfb-v3 无该目标）；没有把HTTP/SSR当成视觉验收。此前样式里程碑94项测试记录为历史证据，当前联合候选以本轮108项为准。

## 人工核验与边界

Owner 人工核验 PENDING，见 ../../milestones/timetable-conflicts/MANUAL_VERIFICATION_GUIDE.md。本轮只检查当前完整视图范围，不声称全校资源审计；归属安排不是走班学生实际去向；没有任务/目录名单的活动与自由课班不能确定学生冲突。已有显示偏好保留，未修改发布数据以掩盖问题。
