# 2026-10-13 原 HTML 风格恢复独立复审

未参与实现的 migration_review 只读审查实际 wfb-v3 工作区及原 HTML 对照截图。基线 main 5308673；用户明确禁止提交，审查实际未提交差异。复审通过，无剩余必须修复事项；不是 Owner 人工验收。

- CSS规则抽查全部限定在局部工作区或弹窗；95个外壳、导航、MT和作业代码与 HEAD 一致，实施者另外全量验证98个受保护文件。
- 发现 P2：dialog 卸载后 activeElement 回到 BODY。修复为捕获触发元素，清理后在没有新 modal 且触发元素仍 connected 时恢复焦点，避免抢下一弹窗。
- 补充全周期 Tab 首末控件循环；独立验证任务弹窗收起 details 正向45次、展开后正向60次和反向60次、日志正向40次，焦点始终在当前弹窗。Escape恢复触发按钮。
- 日卡→日志→返回日卡全过程仅一个 dialog，overflow保持hidden，焦点在当前层；4xl详情宽900px，390px无整体横向溢出，无pageerror。
- 已恢复原行式科组入口、主次栏、下划线页签、独立成员栏、任务弹窗层次。不同课程与人数来自保留的 wfb数据。可选细边框入口和modal width建议均已落实。

限制：本轮未作不同数据、不同外层导航的逐像素复刻宣称；最终视觉确认由 Owner 完成。最终代码文件级哈希及最新截图见 docs/evidence/html-style-restoration/ 与对应 design-history/evidence/。
