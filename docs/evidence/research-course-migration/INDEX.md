# 2026-10-13 框架移植验证证据

- result.json：最终类型、64 项测试、生产构建与人工状态。
- tested-source.json：被测未提交代码文件 SHA-256 与聚合哈希。
- protected-files.json：98 个外壳、Provider、原教学/作业文件哈希，变更为 0。
- acceptance.json：9 类实际浏览器流程、四种屏幕宽度，无页面异常。
- roles-and-regressions.json：6 类普通教师、科组范围、只读课表、Topic、篮子与导航历史。
- review-regressions.json：4 类审查修复的实际浏览器回归。
- production-smoke.json：生产构建路由、原 PDF 字节响应与保留的左栏跳转。

浏览器使用隔离合成记录。截图保留在 Playground/work/wfb-browser-evidence，原始日志在本机 /private/tmp/wfb-v3-*。这些机器证据不能冒充 Owner 人工验收。Next 构建自动生成 next-env.d.ts，非外壳改版。
