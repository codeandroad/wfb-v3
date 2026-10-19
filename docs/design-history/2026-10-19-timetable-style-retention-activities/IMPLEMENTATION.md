# 课表颜色保留与教务活动浏览实施（2026-10-19）

## 依据与范围

Owner本轮要求修复文字样式切到外观丢失，并补齐教务活动浏览及筛选。基线main `42ba585f5e5b351c7beb333c15bdbb4e2e0c580f`，保留此前未提交修改。已读父/本目录AGENTS、已安装Next.js use-client指南、颜色控件与draft hook、两侧父编辑器、MT command/持久化、学校课表投影、WeekGrid、冲突/筛选规则和相关测试。

预计修改范围为颜色输入、draft hook、共享设置组件，以及教务overview、活动投影helper、filter、WeekGrid范围与活动冲突分支。原外壳、作业、排课发布/编辑行为和既有偏好键保留。

## 实现

StyleColorInput的有效颜色完成后直接写入，仅清当前成功字段；六位即时、三位离开输入框/回车时保存。输入组件key保持稳定，不因保存颜色而重挂取色器。父编辑器切换部位也提交有效候选，同对象按部位保留失败/非法输入，显示其他部位未保存提示。

教务增加活动对象类，按学校发布模板汇总名称；新增ActivityView沿用WeekGrid及课卡详情。WeekGrid先计算完整学校周表的有效冲突，再使用固定范围过滤显示，活动筛选、计数及样式对象只取活动范围。活动与课程仍检查教师/场所冲突，活动不进入学生名单缺失待核对分支。

## 独立审查修复

- R1：初版即时保存把输入到第三位的HEX展开，阻碍继续输入六位。已改为六位即时、三位失焦/回车/切部位保存，增加逐键真实输入值回归。
- R2：活动目录原始周计数没有计入跨周调休，与实际右侧课表矛盾。已去掉目录重复计数，左侧只展示参与教师数量和学校发布来源，周计数与空态由共享课表校历投影提供。跨周测试同时检查左栏和右表。

两项历史反例保留在证据目录引用的原始日志中。独立最终审查无剩余必须修复项，128项课表回归、4条真实provider保存路径、类型检查与diff检查通过，九文件指纹一致。

## 核验状态

最终类型检查、200/200测试、构建和diff检查通过，两侧课表入口HTTP200。测试包含19项颜色控件/hook、10项父编辑器事件、9项活动浏览专项；独立Reviewer另使用真实MtProvider command/commitBiz回放教务/教师×课程/活动四条路径，确认持久化JSON、跨部位、非法输入和失败重试。事件harness/SSR不冒充浏览器测试。

本轮9项实现文件组合指纹：`cf97e1416d6d1fd7c5394587910759e5ff889b559f7e57f3ce1c2882311c092e`。检查结果、逐文件哈希和日志见 `../../evidence/timetable-style-retention-activities/verification.json`，独立审查见 `../../reviews/2026-10-19-timetable-style-retention-activities.md`。人工指南见 `../../milestones/timetable-style-retention-activities/MANUAL_VERIFICATION_GUIDE.md`。

浏览器交互/视觉NOT_RUN，Owner人工核验PENDING。父生产make check在本原型无Makefile目标，NOT_RUN。未提交或推送。
