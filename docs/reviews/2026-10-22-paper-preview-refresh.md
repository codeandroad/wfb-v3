# 真题预览样式与原文件阅读器独立审查

- 日期：2026-10-22
- 审查者：独立子代理 `paper_preview_review`，未参与产品实现或本轮测试编写。
- 结论：**PASS（代码与自动化证据）；页面视觉、原生 PDF 阅读器和人工交互验收待核验。**
- 用户要求：采用所附 `past-papers-1.0 (7) 12.07.12.html` 的真题预览风格，保留当前顶部右侧操作，压缩“原文件”页面顶部空间；保留已有数据和上一轮未提交修改，不提交代码。
- 审查对象：未提交工作区的三份产品文件和新增专项测试。以 `.local-artifacts/paper-preview-refresh/baseline/` 的开工快照隔离本轮修改；没有把此前的大纲归属、权限、资源导航修改误计为本轮回归。

## 读取与审查范围

读取项目与父级 `AGENTS.md`、用户提供的参考 HTML、`components/research/source-paper-reader.tsx`、`paper-reader.tsx`、`replica.module.css`、`modal.tsx`、`workspace.module.css`、`source-ui.tsx`、`primitives.tsx`，以及 `tests/paper-preview.test.cjs` 和既有真题资产/来源身份测试。审查未操作浏览器、未改写产品代码或业务存储。

审查包含：

1. 参考 HTML 的结构为左侧题号目录及居中的单列题卡，题干在上、答案与评分在下。本轮恢复 220px 目录和最大 900px 阅读列，保留原有右侧对照/仅试卷/仅答案、选用与保存、JSON 导出、原文件及条件性编辑操作。
2. 阅读模式现在绑定真实 `mode-*` 类与 `hidden` 状态；隐藏题干/答案时不留下原来的半宽列。仅答案模式去掉孤立的上边框。目录选中态及题目滚动目标保持一致。
3. 原文件阅读器的返回操作合并为一个；主栏仅保留返回、标题和单/双栏模式。各窗文件选择器与独立打开/下载在各自窗头横向排列，删除常驻技术说明及重复文件信息行。文件名与大小仍可在下载入口提示中查看。
4. 高度链条为原生全屏 dialog → 100% 高度的 SourceRoot → flex 列 → 可收缩 grid → flex 预览窗 → iframe。相关收缩节点有 `min-height:0`，目录/题目保持各自滚动；760px 以下双窗改为上下排列并由预览区滚动。此项属于 CSS 静态审查，未声称已用浏览器测量高度或像素一致性。
5. `#reader` 限定的覆盖优先级高于旧通用 `.reader` 样式；同元素 `.pp-embed` 与 `.paper-original-root` 选择器匹配实际 SourceRoot。新增预览规则未修改学校大纲访问提示、学校课程选择器或此前的资源导航规则。
6. 原文件仍只从已登记 `paperRecords` 与 `paper-assets.json` 解析，保留个人副本 `paperSource` 与来源引用的回溯方式；PDF 使用原 URL，Word/ZIP 保留下载路径。单个文件时禁用双栏，缺失原文件仍能返回。未增加数据迁移、清空存储、重写试题或修改权限规则。
7. 共享 Modal 未改动。嵌套原文件窗口通过既有关闭回调返回题目阅读器，个人修正草稿、显示模式和共享文档保留。Escape、焦点锁与焦点恢复仍使用原实现，实际浏览器行为未重新验证。

## 独立验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node --test tests/paper-preview.test.cjs` | PASS，7 项 | `.local-artifacts/paper-preview-refresh/review-preview-tests.log` |
| 既有真题课程/单元、原文件二进制哈希、空题目副本来源身份专项 | PASS，3 项 | `.local-artifacts/paper-preview-refresh/review-asset-tests.log` |
| 开工快照至交付文件差异检查 | PASS，仅本轮预览区域变更 | `.local-artifacts/paper-preview-refresh/review-*.diff` |
| 浏览器自动化及原生 PDF 加载、控件、滚动、实际布局 | NOT_RUN | 延续现有不进行浏览器自动化的边界；需人工核验 |
| Owner 视觉与业务验收 | PENDING | 不以代码审查代替验收 |

专项事件测试运行真实组件回调并进行服务端渲染，但替代了 React hook 调度和原生 dialog portal；不能证明原生 focus、PDF 网络加载或 CSS 视觉效果。既有资产测试验证了全部 76 个登记原文件的 SHA-256、大小和文件头未改变。

本次独立审查未发现必须修复的代码缺陷。完整回归、类型检查、构建及预览 HTTP 状态由主代理另外记录，不重复声称为本审查者执行。

## 被审文件指纹

| 文件 | SHA-256 |
| --- | --- |
| `components/research/source-paper-reader.tsx` | `730c7b6696f6f18c4a14159f68edb5623d7690603112962e784d0eff1d456964` |
| `components/research/paper-reader.tsx` | `9309b45ae48acf935a494c63f575cf508c4e45f97b598186ef41bc60a6a3d9b5` |
| `components/research/replica.module.css` | `b23601c3eb6f6b21aa1ae38f43bd39ac50a0d640993b0a943bf0a34a7501ddfd` |
| `tests/paper-preview.test.cjs` | `7e126f881f2d63707b34c1408df19fd8cac720571be0754cca97fffd4e72981d` |

未提交、未推送；本记录不构成人工验收结论。
