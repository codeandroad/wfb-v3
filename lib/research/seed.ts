import { emptyAccess, emptyDocument, emptyItem, referenceFor, type ResearchState, type Criterion } from "./model"

export function researchSeed(period: number | null = null): ResearchState {
  const syllabus = emptyDocument("syllabus-demo","大纲","函数教学要求 · 共建示例","math","u-lin","C101",null)
  Object.assign(syllabus,{ source: "学校自编教学要求（合成演示，不是考试局官方大纲）", sourceVersion: "2026 学校演示版", years: "2026–2027（演示）", scope: "units", unitIds: ["U101"], objectives: "用不同表示描述函数；通过代数与图像解释变化；用文字说明推理依据。", prerequisites: "代数式变形、一元二次方程、坐标平面。", notes: "完整展示本示例的两个章节及三条学习要求；其余官方章节未整理，不冒充官方完整大纲。", share: { audience: "school", groups: [], staff: [] } })
  syllabus.items = [
    { ...emptyItem("chapter-functions"), title: "函数与图像", origin: "学校自编", source: "学校自编演示第 1 章" },
    { ...emptyItem("r1"), parentId: "chapter-functions", title: "二次函数的表示与图像", body: String.raw`比较解析式、表格与图像三种表示；通过配方解释顶点位置，说明开口方向与系数的关系，并在限定定义域中说明值域。
$$y=a(x-h)^2+k,\quad a\ne0$$`, original: "Explain the relation between a quadratic expression and its graph.（学校编写的英语示例，非官方原文）", translation: "强调解释表达式与图像的对应，不仅是机械描点。", notes: "要求学生给出配方过程、标注顶点与对称轴，并说明参数变化。讨论定义域限制会怎样改变值域；用代入与图像同时检查结论。遇到非典型图像，应保留推理过程，而不是套用结论。", supplement: "可先用校园拱门截面引入，并说明数学模型的适用条件。", source: "第 1 章 §1.1 · 印刷页 8 / 文件页 10", origin: "学校自编", unitIds: ["U101"] },
    { ...emptyItem("r2"), parentId: "chapter-functions", title: "方程的根与图像交点", body: String.raw`用图像解释一元二次方程的实根个数，联系判别式与横轴交点；对含参数的条件说明等号情况。
$$\Delta=b^2-4ac$$`, notes: "判别式讨论仅适用于明确给定的二次项非零情形。", source: "第 1 章 §1.2 · 印刷页 12 / 文件页 14", origin: "学校自编", unitIds: ["U101"] },
    { ...emptyItem("chapter-modelling"), title: "函数建模", origin: "学校自编", source: "学校自编演示第 2 章" },
    { ...emptyItem("r3"), parentId: "chapter-modelling", title: "建模与解释模型范围", body: "把简单情境整理为变量、定义域及函数表达式，解释图像的关键点，并区分数学推论与情境中可使用的范围。", notes: "单位、精度及模型假设都要注明。", source: "第 2 章 §2.1 · 印刷页 19 / 文件页 21", origin: "学校自编", unitIds: ["U101"] },
  ]
  syllabus.assessments = [{ id: "assessment-functions", title: "函数解释与应用（学校演示考核项目）", unitIds: ["U101"], itemIds: ["r1","r2","r3"], conditions: "完成函数表示与方程先修练习；校内演示，不是资格考试规则。", source: "学校自编演示 §评价结构", rubric: "关注表示是否准确、推理能否解释、情境限制是否合理。源材料未提供具体分档分值。" }]
  syllabus.paths = [{ id: "path-school", target: "本示例函数单元学习目标", required: ["assessment-functions"], optional: [], choose: null, weights: { "assessment-functions": null }, conditions: "无其他已整理项目。权重未提供，不虚构数字。", source: "学校自编演示 §评价结构" }]
  const plan = emptyDocument("plan-demo","计划","函数入门 · 教学计划","math","u-lin","C101",period)
  Object.assign(plan,{ scope: "units", unitIds: ["U101"], budget: 161, reserve: 20, source: "syllabus-demo@1（学校自编）", notes: "可先备课再采用；本示例保留 1 分钟均分余数。" })
  plan.items = [syllabus.items[1],syllabus.items[2],syllabus.items[4]].map((i,index) => ({ ...structuredClone(i), parentId: null, minutes: index === 0 ? 40 : null, fixed: index === 0, references: [referenceFor(syllabus,i)], weeks: index === 0 ? [{ week: 1, minutes: 20 },{ week: 2, minutes: 20 }] : [] }))
  const textbook = emptyDocument("textbook-demo","资源","函数教学手册 · 目录与练习","math","u-lin","C101",null)
  Object.assign(textbook,{ scope: "units", unitIds: ["U101"], edition: "学校演示第 1 版", publisher: "学校教研组（合成）", source: "校内自编手册；仅整理目录与下面两个练习，无完整附件", share: { audience: "school", groups: [], staff: [] } })
  textbook.items = [{ ...emptyItem("textbook-q1a"), title: "配方与顶点 · 1(a)", body: String.raw`把表达式写为顶点形式，指出顶点和对称轴。
$$y=2x^2-8x+5$$`, stem: "以下各题均基于同一函数，后续小题需要使用第一小题的顶点形式。", question: "1", subquestion: "(a)", printedPage: "8", filePage: "10", origin: "学校自编", source: "教学手册 §1.1", unitIds: ["U101"], maxScore: 3, scoring: "校内演示：正确配方步骤 1 分；顶点 1 分；对称轴 1 分。不是官方评分细则。", answer: { documentId: "answers-demo", itemId: "answer-1a" } }, { ...emptyItem("textbook-q1b"), title: "函数的单调区间 · 1(b)", body: "沿用 1(a) 的顶点形式，说明函数在哪些区间递减或递增，并解释判断依据。", stem: "本题仍使用 1(a) 的函数；选本小题时保留共同题干，不假定学生已看到上一页。", question: "1", subquestion: "(b)", printedPage: "9", filePage: "11", origin: "学校自编", source: "教学手册 §1.1", unitIds: ["U101"], maxScore: 2, scoring: "校内演示：区间 1 分；用图像或顶点解释 1 分。" }]
  const second = emptyDocument("workbook-demo","资源","函数训练册 · 分层题组","math","u-lin","C101",null)
  Object.assign(second,{ resourceType: "练习册", edition: "演示版 2026", scope: "units", unitIds: ["U101"], source: "校内合成第二来源；只有引用与选题正文，没有整本附件", share: { audience: "school", groups: [], staff: [] } })
  second.items = [{ ...emptyItem("workbook-q2"), title: "图像交点 · 练习 2", body: "用判别式解释参数变化时的交点个数。", stem: String.raw`设 $$f(x)=x^2-2x+m$$。`, question: "2", printedPage: "17", filePage: "19", unitIds: ["U101"], maxScore: 4, scoring: "校内演示：列判别式 1 分，分情况并说明等号 3 分。", origin: "学校自编", source: "训练册 §2" }]
  const answer = emptyDocument("answers-demo","资源","函数手册 · 受限教师答案","math","u-lin","C101",null)
  Object.assign(answer,{ resourceType: "答案与评分资料", restricted: true, copyPolicy: "reference-only", share: { audience: "specified", groups: [], staff: ["u-lin"] }, scope: "units", unitIds: ["U101"], source: "合成演示答案；只授权示例林老师，不随练习分享" })
  answer.items = [{ ...emptyItem("answer-1a"), title: "1(a) 参考解答", body: String.raw`$$y=2(x-2)^2-3$$
顶点为 (2, −3)，对称轴为 x＝2。`, origin: "学校自编", source: "合成演示答案 §1" }]
  const paper = emptyDocument("unreleased-demo","资源","未使用测试卷 · 受限示例","math","u-lin","C101",null)
  Object.assign(paper,{ resourceType: "真题", restricted: true, copyPolicy: "reference-only", share: { audience: "specified", groups: [], staff: ["u-lin"] }, examYear: "2026（合成）", session: "校内示例", paperCode: "DEMO-FUNCTIONS", notes: "这不是官方真题。用于验证未公开试卷不能通过组合分享外泄。", scope: "units", unitIds: ["U101"] })
  paper.items = [{ ...emptyItem("unreleased-q"), title: "未公开命题示例", body: "受限试题正文只对明确授权人开放。", unitIds: ["U101"], origin: "学校自编" }]
  const physics = emptyDocument("physics-resource-demo","资源","运动模型 · 实验材料","physics","u-chen","C201",null)
  Object.assign(physics,{ resourceType: "实验材料", share: { audience: "school", groups: [], staff: [] }, notes: "明确共享此对象，不开放物理组其他内部材料。" })
  physics.items = [{ ...emptyItem("motion-experiment"), title: "匀变速运动的测量", body: String.raw`利用小车与计时数据比较实验模型。
$$s=ut+\frac12at^2$$`, notes: "器材检查、采样误差及安全要求由活动前确认。", origin: "学校自编", source: "物理组校内演示讲义" }]
  const physicsPlan = emptyDocument("physics-plan-demo","计划","运动模型 · 独立备课计划","physics","u-chen","C201",period)
  physicsPlan.items = [{ ...structuredClone(physics.items[0]), references: [referenceFor(physics,physics.items[0])], minutes: null }]
  const personal = { ...structuredClone(plan), id: "personal-plan-demo", title: "函数入门 · 我的调整版", owner: "u-lin", share: emptyAccess("u-lin"), items: plan.items.map(i => ({ ...structuredClone(i), references: [...i.references,referenceFor(plan,i,{ staff: "u-lin", date: "2026-09-01", enabled: true })] })) }
  const bundle = emptyDocument("bundle-demo","练习组合","函数巩固 · 多来源练习","math","u-lin","C101",null)
  Object.assign(bundle,{ scope: "units", unitIds: ["U101"], share: { audience: "school", groups: [], staff: [] }, notes: "两个来源；答案只保留引用，按其独立授权显示。" })
  bundle.items = [textbook.items[0],second.items[0]].map((i,index) => ({ ...structuredClone(i), id: `bundle-${index+1}`, references: [referenceFor(index === 0 ? textbook : second,i)] }))
  const documents = [syllabus,plan,textbook,second,answer,paper,physics,physicsPlan,personal,bundle]
  const criterion = (id: string,kind: Criterion["kind"]): Criterion => ({ id, group: "math", title: `${kind} · 组内共建示例`, kind, version: 1, source: "校内自定合成示例；A＝优秀，沿用系统字典，不是官方分数线", notes: "推荐不等于教师已经采用，不改写存量评价。", recommended: true, dimensions: [{ id: "dimension-1", name: kind === "课堂表现方案" ? "推理与表达" : "完成与解释", meaning: "以实际观察或作业内容为依据，不代表出勤或提交状态。" }], levels: [{ id: "A", code: "A", label: "优秀", guide: "能完整解释推理，表达准确。" },{ id: "B", code: "B", label: "良好", guide: "基本达成，少量提示后完成。" },{ id: "C", code: "C", label: "合格", guide: "部分达成，仍需巩固。" },{ id: "D", code: "D", label: "待改进", guide: "需要针对性支持。" }], documentId: null, itemId: null, maxScore: null, scoring: "", testName: "", thresholds: [] })
  return {
    schema: 2, documents, revisions: Object.fromEntries(documents.map(d => [`${d.id}@1`,structuredClone(d)])), drafts: {},
    appointments: [
      { id: "app-lin-math", staff: "u-lin", group: "math", role: "组长", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-lin-physics", staff: "u-lin", group: "physics", role: "成员", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-chen-physics", staff: "u-chen", group: "physics", role: "组长", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-zhou-math", staff: "u-zhou", group: "math", role: "成员", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-wang-math", staff: "u-wang", group: "math", role: "成员", start: "2026-09-01", end: "2027-07-31" },
      { id: "app-zhou-expired", staff: "u-zhou", group: "physics", role: "成员", start: "2025-09-01", end: "2026-07-31" },
      { id: "app-zhou-future", staff: "u-zhou", group: "physics", role: "成员", start: "2027-09-01", end: "2028-07-31" },
    ],
    groupSchedules: [
      { id: "math-tue4", group: "math", weekday: 2, periodId: "m4", title: "数学教研", room: "D110" },
      { id: "math-tue5", group: "math", weekday: 2, periodId: "m5", title: "数学教研", room: "D110" },
      { id: "math-thu6", group: "math", weekday: 4, periodId: "a1", title: "数学教研", room: "D110" },
      { id: "math-thu7", group: "math", weekday: 4, periodId: "a2", title: "数学教研", room: "D110" },
    ],
    forms: {}, grants: [{ staff: "u-lin", group: "math", mode: "统筹", start: "2026-09-01", end: "2027-07-31" },{ staff: "u-lin", group: "physics", mode: "统筹", start: "2026-09-01", end: "2027-07-31" },{ staff: "u-xu", group: "math", mode: "查看", start: "2026-09-01", end: "2027-07-31" }],
    schoolTasks: [{ id: "school-task-1", title: "学期教学内容整理", groups: ["math","physics"], due: "2026-11-01", requirements: "各组引用本组已有大纲或教学计划；牵头提交，不要求教师另填报告。", acceptance: false, createdBy: "u-lin", createdAt: "2026-09-01" }],
    tasks: ["math","physics"].map(group => ({ id: `task-${group}`, title: "学期教学内容整理", group, parent: null, schoolTaskId: "school-task-1", course: "", owner: "", collaborators: [], submitters: [], due: "2026-11-01", mode: "牵头提交", requirements: "引用已有成果即可。", acceptance: false, status: "待承接", outcomes: [], acceptedNote: "" })),
    activities: [{ id: "activity-demo", group: "math", title: "函数教学导入 · 独立试讲", type: "独立试讲", owner: "u-lin", course: "C101", taskId: null, start: "2026-10-15T15:15", end: "2026-10-15T15:55", participants: ["u-lin","u-zhou","u-wang"], lesson: null, materials: [{ documentId: "plan-demo", version: 1 }], conclusion: "", share: emptyAccess("math"), responses: {}, attendance: {}, criterionId: null, trials: [], version: 1 }],
    discussions: [], notices: [{ id: "notice-demo", group: "math", title: "备课资料选用提醒", body: "共享资料中的教师答案采用独立授权；普通通知无需回执。", recipients: ["u-lin","u-zhou"], requiresAck: false, acknowledged: [], author: "u-lin", at: "2026-09-28" }], issues: [],
    criteria: [criterion("criterion-classroom","课堂表现方案"),criterion("criterion-homework","作业质量方案"),{ ...criterion("criterion-question","题目评分依据"), documentId: "textbook-demo", itemId: "textbook-q1a", maxScore: 3, scoring: "以所关联 1(a) 的得分点为准；校内演示，不是官方评分细则。" },{ ...criterion("criterion-test","单次考核等级换算"), recommended: false, testName: "函数校内模拟测试（演示）", notes: "未提供分数线，暂不配置。需明确绑定某次作业／模考及名单，不能作为整科永久规则。" }],
  }
}
