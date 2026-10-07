// 学校管理模块 — 合成演示数据（仅用于交互原型，非生产初始化数据）
// 覆盖：学年与学期、课程目录（学科 / 课程 / 单元库 / 课程单元关联）、
// 行政班（多名班主任）、教学班、教职工、学生资料（含字段显示控制）。

import { STUDENTS } from "./data"

/* ============================================================
 * 学年与学期
 * ========================================================== */

export interface TermRow {
  id: string
  name: "上学期" | "下学期"
  yearRange: string // 学年范围
  termRange: string // 学期日期
  status: "current" | "upcoming" | "ended"
  weeks: number
  currentWeek?: number
}

export interface AcademicYear {
  id: string
  label: string // 2026–2027
  terms: TermRow[]
}

export const ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: "ay-2627",
    label: "2026–2027",
    terms: [
      {
        id: "t-2627-1",
        name: "上学期",
        yearRange: "2026-09-01 – 2027-07-13",
        termRange: "2026-09-01 – 2027-01-29",
        status: "current",
        weeks: 22,
        currentWeek: 4,
      },
      {
        id: "t-2627-2",
        name: "下学期",
        yearRange: "2026-09-01 – 2027-07-13",
        termRange: "2027-02-22 – 2027-07-13",
        status: "upcoming",
        weeks: 21,
      },
    ],
  },
  {
    id: "ay-2526",
    label: "2025–2026",
    terms: [
      {
        id: "t-2526-1",
        name: "上学期",
        yearRange: "2025-09-01 – 2026-07-14",
        termRange: "2025-09-01 – 2026-01-30",
        status: "ended",
        weeks: 22,
      },
      {
        id: "t-2526-2",
        name: "下学期",
        yearRange: "2025-09-01 – 2026-07-14",
        termRange: "2026-02-23 – 2026-07-14",
        status: "ended",
        weeks: 21,
      },
    ],
  },
]

export const CURRENT_TERM_LABEL = "上学期 · 第 4 周"

/* ============================================================
 * 课程目录：学科 / 课程 / 单元库 / 课程单元关联
 * 取自导入工作簿 v3.0 的真实结构，节选为演示子集。
 * ========================================================== */

export interface CatalogSubject {
  code: string // 文件内学科标记 S001
  name: string
  en: string
  order: number
  courses: number // 目录内课程数
  note: string
}

export const CATALOG_SUBJECTS: CatalogSubject[] = [
  { code: "S001", name: "数学", en: "Mathematics", order: 10, courses: 6, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S002", name: "物理", en: "Physics", order: 20, courses: 4, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S003", name: "化学", en: "Chemistry", order: 30, courses: 3, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S004", name: "生物", en: "Biology", order: 40, courses: 3, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S005", name: "计算机", en: "Computer Science", order: 50, courses: 3, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S007", name: "经济", en: "Economics", order: 70, courses: 2, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S008", name: "商科", en: "Business", order: 80, courses: 2, note: "校内学科分类；课程体系与考试局在课程层区分" },
  { code: "S010", name: "英语", en: "English", order: 100, courses: 2, note: "校内学科分类；课程体系与考试局在课程层区分" },
]

export interface CatalogCourse {
  code: string // C001
  subjectCode: string
  name: string
  en: string
  board: string // 考试局／机构
  system: string // 课程体系／资格族
  region: string // 适用体系地区
  org: string // 教学组织方式
  structure: string // 考核结构
  officialCode: string // 官方课程代码
  syllabusVersion?: string
  sourceUrl?: string
  note: string
}

export const CATALOG_COURSES: CatalogCourse[] = [
  {
    code: "C101",
    subjectCode: "S001",
    name: "CAIE 数学",
    en: "Cambridge International AS & A Level Mathematics",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "9709",
    note: "本校主用数学课程；教学班按 P/S/M 单元组织。Syllabus code 与 Paper 号分离。",
  },
  {
    code: "C102",
    subjectCode: "S001",
    name: "CAIE 高等数学",
    en: "Cambridge International AS & A Level Further Mathematics",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "9231",
    note: "以 9709 为先修；FP/FM/FS 单元。",
  },
  {
    code: "C103",
    subjectCode: "S001",
    name: "Edexcel IAL 数学",
    en: "Pearson Edexcel International AS / A Level Mathematics",
    board: "Pearson Edexcel",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "XMA01 / YMA01",
    note: "14 单元统一池；Cash-in 分 IAS / IAL 出口。",
  },
  {
    code: "C201",
    subjectCode: "S002",
    name: "CAIE 物理",
    en: "Cambridge International AS & A Level Physics",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "9702",
    note: "含 AS-only 路径；实践试卷单列。",
  },
  {
    code: "C301",
    subjectCode: "S003",
    name: "Edexcel IAL 化学",
    en: "Pearson Edexcel International AS / A Level Chemistry",
    board: "Pearson Edexcel",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "XCH11 / YCH11",
    note: "6 单元；实验技能单元独立考核。",
  },
  {
    code: "C401",
    subjectCode: "S004",
    name: "Edexcel IAL 生物",
    en: "Pearson Edexcel International AS / A Level Biology",
    board: "Pearson Edexcel",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "XBI11 / YBI11",
    note: "6 单元；IAS 三单元、IA2 三单元。",
  },
  {
    code: "C501",
    subjectCode: "S005",
    name: "CAIE 计算机科学",
    en: "Cambridge International AS & A Level Computer Science",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "9618",
    note: "含受控实操与理论试卷。",
  },
  {
    code: "C701",
    subjectCode: "S007",
    name: "Edexcel IAL 经济",
    en: "Pearson Edexcel International AS / A Level Economics",
    board: "Pearson Edexcel",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化",
    officialCode: "XEC11 / YEC11",
    note: "4 单元；宏观与微观分列。",
  },
  {
    code: "C302",
    subjectCode: "S003",
    name: "CAIE 化学",
    en: "Cambridge International AS & A Level Chemistry",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "按 AS / A2 阶段教学",
    structure: "分阶段试卷制（非独立模块累积）",
    officialCode: "9701",
    syllabusVersion: "2025–2027 · Version 1",
    sourceUrl: "https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf",
    note: "涵盖物理化学、无机化学、有机化学及分析与实验技能。AS 修读并考核 P1、P2、P3；完整 A Level 另需 P4、P5。可按官方规则结转 AS 成绩；各试卷不是可独立 Cash-in 的单元资格。",
  },
  {
    code: "C702",
    subjectCode: "S007",
    name: "CAIE 经济",
    en: "Cambridge International AS & A Level Economics",
    board: "Cambridge International",
    system: "International AS / A Level",
    region: "国际版",
    org: "按 AS / A2 阶段教学",
    structure: "分阶段试卷制（非独立模块累积）",
    officialCode: "9708",
    syllabusVersion: "2026–2028 · Version 2",
    sourceUrl: "https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf",
    note: "涵盖资源配置、微观经济、宏观经济、政府干预及国际经济。AS 考核 P1、P2；完整 A Level 另需 P3、P4。P2、P4 均包含数据分析、微观论文和宏观论文；试卷不是独立模块资格。",
  },
  {
    code: "C104",
    subjectCode: "S001",
    name: "CAIE IGCSE 数学",
    en: "Cambridge IGCSE Mathematics",
    board: "Cambridge International",
    system: "IGCSE",
    region: "国际版",
    org: "整门课程教学（Core / Extended 分层）",
    structure: "线性制 · 两条分层试卷路径",
    officialCode: "0580",
    syllabusVersion: "2025–2027 · Version 3",
    sourceUrl: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf",
    note: "涵盖数、代数与图像、坐标几何、几何、度量、三角、变换与向量、概率及统计。Core 选 P1 + P3（C–G）；Extended 选 P2 + P4（A*–E），两条路径不可混搭。2025 起 P1、P2 为非计算器卷，P3、P4 为计算器卷；无独立模块资格。",
  },
  {
    code: "C105",
    subjectCode: "S001",
    name: "CAIE IGCSE 附加数学",
    en: "Cambridge IGCSE Additional Mathematics",
    board: "Cambridge International",
    system: "IGCSE",
    region: "国际版",
    org: "整门课程教学",
    structure: "线性制 · 两份必考试卷",
    officialCode: "0606",
    syllabusVersion: "2025–2027 · Version 1",
    sourceUrl: "https://www.cambridgeinternational.org/Images/662470-2025-2027-syllabus.pdf",
    note: "在 IGCSE 数学基础上拓展函数、多项式、指数与对数、圆的坐标几何、三角、排列组合、级数、二维向量及微积分。P1 非计算器卷与 P2 计算器卷均必考，各占 50%；等级 A*–E，无 Core / Extended 分层及独立模块资格。",
  },
  {
    code: "C502",
    subjectCode: "S005",
    name: "CAIE IGCSE 计算机科学",
    en: "Cambridge IGCSE Computer Science",
    board: "Cambridge International",
    system: "IGCSE",
    region: "国际版",
    org: "整门课程教学",
    structure: "线性制 · 两份必考试卷",
    officialCode: "0478",
    syllabusVersion: "2026–2028 · Version 6",
    sourceUrl: "https://www.cambridgeinternational.org/Images/697167-2026-2028-syllabus.pdf",
    note: "涵盖计算机系统与算法、编程及逻辑。P1、P2 均为笔试，各占 50%，不允许计算器；P2 含情境编程题，不是上机实操考试。教学应包含编程实践；无预发布材料，等级 A*–G，无独立模块资格。",
  },
  {
    code: "C106",
    subjectCode: "S001",
    name: "Edexcel IGCSE 数学 A",
    en: "Pearson Edexcel International GCSE Mathematics (Specification A)",
    board: "Pearson Edexcel",
    system: "International GCSE (9–1)",
    region: "国际版",
    org: "整门课程教学（Foundation / Higher 分层）",
    structure: "线性制 · 同一考季两份试卷",
    officialCode: "4MA1",
    syllabusVersion: "2016 规格 · Issue 2 · 2018 起首考",
    sourceUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Mathematics%20A/2016/Specification%20and%20sample%20assessments/international-gcse-in-mathematics-spec-a.pdf",
    note: "此目录采用 Mathematics A 的线性版本，不是 Mathematics B（4MB1）或模块化版本（4XMA1）。涵盖数、代数、几何及统计。Foundation 选 1F + 2F（5–1）；Higher 选 1H + 2H（9–4），两卷须在同一考季参加，各占 50%，均可使用计算器；无独立模块资格。",
  },
  {
    code: "C503",
    subjectCode: "S005",
    name: "Edexcel IAL 计算机科学",
    en: "Pearson Edexcel International AS / A Level Computer Science",
    board: "Pearson Edexcel",
    system: "International AS / A Level",
    region: "国际版",
    org: "分单元教学",
    structure: "模块化 · 四单元",
    officialCode: "XCP01 / YCP01",
    syllabusVersion: "2026 规格 · Issue 1",
    sourceUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/computer-science/2026/specification-and-sample-assessments/ial-computer-science-specification.pdf",
    note: "2026 年 9 月首教；IAS 首考 2027 年 5–6 月，完整 IAL 首考 2028 年 5–6 月。IAS 由 U1、U2 组成；IAL 需 U1–U4。官方报考代码以 WCP01/01–04 区分四个单元。U1、U3 为理论考核（纸笔或屏幕），U2、U4 为 Python 3 上机编程；每单元占 IAL 的 25%。",
  },
]

export interface CatalogUnit {
  code: string // U001
  name: string
  en: string
  short: string // 单元简称 P1 / S1
  officialCode: string // 官方单元代码
  nature: "官方模块" | "官方试卷" | "校内板块"
  stage: "IAS" | "IA2" | "IGCSE"
  courseCode: string // 关联课程（演示中一对一便于展示）
  rule: "必修" | "选修" | "路径必修"
  note: string
}

// 单元库（节选，围绕本校主用的 CAIE 9709 数学，并含少量其他课程单元）
export const CATALOG_UNITS: CatalogUnit[] = [
  { code: "U101", name: "纯数学 1", en: "Pure Mathematics 1", short: "P1", officialCode: "9709/01", nature: "官方模块", stage: "IAS", courseCode: "C101", rule: "必修", note: "AS 阶段必修；本校高一数学A班本学期教学单元。" },
  { code: "U102", name: "纯数学 2", en: "Pure Mathematics 2", short: "P2", officialCode: "9709/02", nature: "官方模块", stage: "IAS", courseCode: "C101", rule: "选修", note: "AS 备选纯数路径，与 P3 二选一进入不同资格组合。" },
  { code: "U103", name: "纯数学 3", en: "Pure Mathematics 3", short: "P3", officialCode: "9709/03", nature: "官方模块", stage: "IA2", courseCode: "C101", rule: "必修", note: "A2 阶段纯数；示例王老师任教。" },
  { code: "U104", name: "力学 1", en: "Mechanics 1", short: "M1", officialCode: "9709/04", nature: "官方模块", stage: "IAS", courseCode: "C101", rule: "选修", note: "应用数学单元；本学期作为拓展单元开设。" },
  { code: "U105", name: "概率与统计 1", en: "Probability & Statistics 1", short: "S1", officialCode: "9709/05", nature: "官方模块", stage: "IAS", courseCode: "C101", rule: "必修", note: "AS 阶段统计单元；本校高一数学A班本学期教学单元。" },
  { code: "U106", name: "概率与统计 2", en: "Probability & Statistics 2", short: "S2", officialCode: "9709/06", nature: "官方模块", stage: "IA2", courseCode: "C101", rule: "选修", note: "A2 阶段统计单元。" },
  { code: "U201", name: "物理 AS 结构", en: "Physics AS Papers", short: "P1–3", officialCode: "9702", nature: "官方模块", stage: "IAS", courseCode: "C201", rule: "必修", note: "含多项选择、结构化与实践试卷。" },
  { code: "U301", name: "化学结构、键合与反应", en: "Structure, Bonding and Introduction to Organic Chemistry", short: "U1", officialCode: "WCH11", nature: "官方模块", stage: "IAS", courseCode: "C301", rule: "必修", note: "IAS 首单元。" },
  { code: "U401", name: "分子、饮食、运输与健康", en: "Molecules, Diet, Transport and Health", short: "U1", officialCode: "WBI11", nature: "官方模块", stage: "IAS", courseCode: "C401", rule: "必修", note: "IAS 首单元。" },
  { code: "U501", name: "计算机基础理论", en: "Theory Fundamentals", short: "P1", officialCode: "9618/01", nature: "官方模块", stage: "IAS", courseCode: "C501", rule: "必修", note: "AS 理论试卷。" },
  { code: "U990", name: "数学衔接与拓展", en: "Bridging & Enrichment Mathematics", short: "校内", officialCode: "（未设置）", nature: "校内板块", stage: "IAS", courseCode: "C101", rule: "选修", note: "校内示例板块；无官方资格出口，显式标记为校内。" },
  { code: "U311", name: "化学多项选择", en: "Multiple Choice", short: "P1", officialCode: "9701/1", nature: "官方试卷", stage: "IAS", courseCode: "C302", rule: "必修", note: "AS 内容；75 分钟，40 分。占 AS 的 31%、A Level 的 15.5%。" },
  { code: "U312", name: "化学 AS 结构化问题", en: "AS Level Structured Questions", short: "P2", officialCode: "9701/2", nature: "官方试卷", stage: "IAS", courseCode: "C302", rule: "必修", note: "AS 内容；75 分钟，60 分。占 AS 的 46%、A Level 的 23%。" },
  { code: "U313", name: "化学高级实验技能", en: "Advanced Practical Skills", short: "P3", officialCode: "9701/3", nature: "官方试卷", stage: "IAS", courseCode: "C302", rule: "必修", note: "实际实验操作与结构化问题；2 小时，40 分。占 AS 的 23%、A Level 的 11.5%；须具备实验场地与设备。" },
  { code: "U314", name: "化学 A Level 结构化问题", en: "A Level Structured Questions", short: "P4", officialCode: "9701/4", nature: "官方试卷", stage: "IA2", courseCode: "C302", rule: "必修", note: "完整 A Level 必考，假定具备 AS 知识；2 小时，100 分，占 A Level 的 38.5%。" },
  { code: "U315", name: "化学实验规划、分析与评价", en: "Planning, Analysis and Evaluation", short: "P5", officialCode: "9701/5", nature: "官方试卷", stage: "IA2", courseCode: "C302", rule: "必修", note: "实验技能笔试，非现场实验操作；75 分钟，30 分，占 A Level 的 11.5%。" },
  { code: "U711", name: "经济 AS 多项选择", en: "AS Level Multiple Choice", short: "P1", officialCode: "9708/1", nature: "官方试卷", stage: "IAS", courseCode: "C702", rule: "必修", note: "AS 内容；1 小时，30 分。占 AS 的 33%、A Level 的 17%。" },
  { code: "U712", name: "经济 AS 数据分析与论文", en: "AS Level Data Response and Essays", short: "P2", officialCode: "9708/2", nature: "官方试卷", stage: "IAS", courseCode: "C702", rule: "必修", note: "2 小时，60 分；数据分析、微观论文、宏观论文各 20 分。占 AS 的 67%、A Level 的 33%。" },
  { code: "U713", name: "经济 A Level 多项选择", en: "A Level Multiple Choice", short: "P3", officialCode: "9708/3", nature: "官方试卷", stage: "IA2", courseCode: "C702", rule: "必修", note: "A Level 内容，假定具备 AS 知识；75 分钟，30 分，占 A Level 的 17%。" },
  { code: "U714", name: "经济 A Level 数据分析与论文", en: "A Level Data Response and Essays", short: "P4", officialCode: "9708/4", nature: "官方试卷", stage: "IA2", courseCode: "C702", rule: "必修", note: "2 小时，60 分；数据分析、微观论文、宏观论文各 20 分，占 A Level 的 33%。论文为无分小问的完整论述。" },
  { code: "U141", name: "数学非计算器卷（Core）", en: "Non-calculator (Core)", short: "P1", officialCode: "0580/1", nature: "官方试卷", stage: "IGCSE", courseCode: "C104", rule: "路径必修", note: "选择 Core 路径时与 P3 配对，不能与 Extended 试卷混搭；90 分钟，80 分，占 50%，不允许计算器。" },
  { code: "U142", name: "数学非计算器卷（Extended）", en: "Non-calculator (Extended)", short: "P2", officialCode: "0580/2", nature: "官方试卷", stage: "IGCSE", courseCode: "C104", rule: "路径必修", note: "选择 Extended 路径时与 P4 配对；2 小时，100 分，占 50%，不允许计算器。" },
  { code: "U143", name: "数学计算器卷（Core）", en: "Calculator (Core)", short: "P3", officialCode: "0580/3", nature: "官方试卷", stage: "IGCSE", courseCode: "C104", rule: "路径必修", note: "选择 Core 路径时与 P1 配对；90 分钟，80 分，占 50%，须使用科学计算器。" },
  { code: "U144", name: "数学计算器卷（Extended）", en: "Calculator (Extended)", short: "P4", officialCode: "0580/4", nature: "官方试卷", stage: "IGCSE", courseCode: "C104", rule: "路径必修", note: "选择 Extended 路径时与 P2 配对；2 小时，100 分，占 50%，须使用科学计算器。" },
  { code: "U151", name: "附加数学非计算器卷", en: "Paper 1 (Non-calculator)", short: "P1", officialCode: "0606/1", nature: "官方试卷", stage: "IGCSE", courseCode: "C105", rule: "必修", note: "2 小时，80 分，占 50%；结构化与非结构化问题，不允许计算器；与 P2 均必考。" },
  { code: "U152", name: "附加数学计算器卷", en: "Paper 2 (Calculator)", short: "P2", officialCode: "0606/2", nature: "官方试卷", stage: "IGCSE", courseCode: "C105", rule: "必修", note: "2 小时，80 分，占 50%；结构化与非结构化问题，须使用科学计算器；与 P1 均必考。" },
  { code: "U521", name: "计算机系统", en: "Computer Systems", short: "P1", officialCode: "0478/1", nature: "官方试卷", stage: "IGCSE", courseCode: "C502", rule: "必修", note: "主题 1–6：数据表示、数据传输、硬件、软件、互联网及自动化与新兴技术。105 分钟，75 分，占 50%；笔试，不允许计算器。" },
  { code: "U522", name: "算法、编程与逻辑", en: "Algorithms, Programming and Logic", short: "P2", officialCode: "0478/2", nature: "官方试卷", stage: "IGCSE", courseCode: "C502", rule: "必修", note: "主题 7–10：算法设计与问题解决、编程、数据库及布尔逻辑。105 分钟，75 分，占 50%；含情境题的笔试，非上机考试，不允许计算器。" },
  { code: "U161", name: "数学 A 基础卷 1", en: "Paper 1F (Foundation Tier)", short: "1F", officialCode: "4MA1/1F", nature: "官方试卷", stage: "IGCSE", courseCode: "C106", rule: "路径必修", note: "Foundation 路径，与 2F 在同一考季配对；2 小时，100 分，占 50%，可使用计算器。" },
  { code: "U162", name: "数学 A 基础卷 2", en: "Paper 2F (Foundation Tier)", short: "2F", officialCode: "4MA1/2F", nature: "官方试卷", stage: "IGCSE", courseCode: "C106", rule: "路径必修", note: "Foundation 路径，与 1F 在同一考季配对；2 小时，100 分，占 50%，可使用计算器。" },
  { code: "U163", name: "数学 A 高阶卷 1", en: "Paper 1H (Higher Tier)", short: "1H", officialCode: "4MA1/1H", nature: "官方试卷", stage: "IGCSE", courseCode: "C106", rule: "路径必修", note: "Higher 路径，与 2H 在同一考季配对，不可与 Foundation 混搭；2 小时，100 分，占 50%，可使用计算器。" },
  { code: "U164", name: "数学 A 高阶卷 2", en: "Paper 2H (Higher Tier)", short: "2H", officialCode: "4MA1/2H", nature: "官方试卷", stage: "IGCSE", courseCode: "C106", rule: "路径必修", note: "Higher 路径，与 1H 在同一考季配对；2 小时，100 分，占 50%，可使用计算器。" },
  { code: "U531", name: "计算机科学原理", en: "Principles of Computer Science", short: "U1", officialCode: "WCP01/01", nature: "官方模块", stage: "IAS", courseCode: "C503", rule: "必修", note: "计算机系统、数据表示、网络与加密、数据结构、问题解决及使能技术。90 分钟，80 分；占 IAS 的 50%、IAL 的 25%；纸笔 WCP01/01 或屏幕 WCP01/01C。2027 年 5–6 月首考。" },
  { code: "U532", name: "实践编程与问题解决", en: "Practical Programming and Problem-solving", short: "U2", officialCode: "WCP01/02", nature: "官方模块", stage: "IAS", courseCode: "C503", rule: "必修", note: "编程、数据组织与处理、最佳实践、计算思维与算法；Python 3 上机考试 WCP01/02。3 小时，80 分；占 IAS 的 50%、IAL 的 25%。2027 年 5–6 月首考。" },
  { code: "U533", name: "高级计算机科学原理", en: "Advanced Principles of Computer Science", short: "U3", officialCode: "WCP01/03", nature: "官方模块", stage: "IA2", courseCode: "C503", rule: "必修", note: "计算机系统与数据表示、网络安全、编程语言、数据结构、问题解决及新兴技术与专业实践。90 分钟，80 分，占 IAL 的 25%；纸笔 WCP01/03 或屏幕 WCP01/03C。2028 年 5–6 月首考。" },
  { code: "U534", name: "高级实践编程与问题解决", en: "Advanced Practical Programming and Problem-solving", short: "U4", officialCode: "WCP01/04", nature: "官方模块", stage: "IA2", courseCode: "C503", rule: "必修", note: "高级编程、数据表示与处理、最佳实践、其他编程范式及算法；Python 3 上机考试 WCP01/04。3 小时，80 分，占 IAL 的 25%。2028 年 5–6 月首考。" },
]

export function unitsByCourse(courseCode: string) {
  return CATALOG_UNITS.filter((u) => u.courseCode === courseCode)
}
export function courseByCode(code: string) {
  return CATALOG_COURSES.find((c) => c.code === code)
}
export function subjectByCode(code: string) {
  return CATALOG_SUBJECTS.find((s) => s.code === code)
}

/* ============================================================
 * 行政班（可有多名班主任：主班主任 / 教辅班主任 / 生活班主任）
 * ========================================================== */

// 班主任角色沿用受控词表：主班主任（主岗最多一人、可暂缺）、辅助班主任（可多人）
export type HeadRole = "主班主任" | "辅助班主任"

export interface HeadTeacher {
  staffId: string
  name: string
  role: HeadRole
}

// 班级大事件：班主任填写的活动参与 / 获奖 / 集体记录
export interface ClassEvent {
  id: string
  date: string
  title: string
  note: string
}

export interface AdminClass {
  id: string
  name: string
  grade: string
  room: string
  heads: HeadTeacher[]
  studentCount: number
  boys: number
  girls: number
  foundedDate: string // 创班日期（创建时可填、可修改，非必填；空串表示未填写）
  events: ClassEvent[] // 大事件
  note: string
}

export const ADMIN_CLASSES: AdminClass[] = [
  {
    id: "ac-g1-1",
    name: "高一1班",
    grade: "高一",
    room: "教学楼 A-301",
    heads: [{ staffId: "u-lin", name: "示例林老师", role: "主班主任" }],
    studentCount: 12,
    boys: 7,
    girls: 5,
    foundedDate: "2026-09-01",
    events: [
      { id: "ev-g11-1", date: "2026-09-16", title: "校运会班级方阵第一名", note: "全班参与开幕式方阵评比，获年级第一。" },
      { id: "ev-g11-2", date: "2026-09-10", title: "教师节主题班会", note: "自主策划并录制感谢视频。" },
    ],
    note: "本例发布基准日有效名单 12 人。",
  },
  {
    id: "ac-g1-2",
    name: "高一2班",
    grade: "高一",
    room: "教学楼 A-302",
    // 主班主任暂缺，一名辅助班主任；用于演示“允许暂时空缺”与添加班主任流程
    heads: [{ staffId: "u-wang", name: "示例王老师", role: "辅助班主任" }],
    studentCount: 10,
    boys: 6,
    girls: 4,
    foundedDate: "2026-09-01",
    events: [{ id: "ev-g12-1", date: "2026-09-14", title: "志愿服务实践", note: "组织社区图书整理志愿活动。" }],
    note: "本例发布基准日有效名单 10 人；主班主任暂缺。",
  },
  {
    id: "ac-g2-1",
    name: "高二1班",
    grade: "高二",
    room: "教学楼 B-201",
    heads: [],
    studentCount: 24,
    boys: 13,
    girls: 11,
    foundedDate: "2025-09-01",
    events: [],
    note: "示例数据；主辅班主任均暂缺。",
  },
]

/* ============================================================
 * 教学班（共同修读某门课程的学生集合，可跨行政班）
 * ========================================================== */

export interface TeachingClassRow {
  id: string
  name: string
  course: string // 显示用课程标识
  courseCode: string
  units: string[] // 短码
  teachers: { name: string; units: string[] }[]
  studentCount: number
  fromRooms: { room: string; count: number }[]
  term: string
}

export const TEACHING_CLASSES: TeachingClassRow[] = [
  {
    id: "tc-math-a",
    name: "高一1班 • 数学",
    course: "CAIE 数学 · 9709",
    courseCode: "C101",
    units: ["P1", "S1", "M1", "P3"],
    teachers: [
      { name: "示例林老师", units: ["P1", "S1"] },
      { name: "示例王老师", units: ["P3"] },
    ],
    studentCount: 22,
    fromRooms: [
      { room: "高一1班", count: 12 },
      { room: "高一2班", count: 10 },
    ],
    term: "2026–2027 上学期",
  },
  {
    id: "tc-math-b",
    name: "高一2班 • 数学",
    course: "CAIE 数学 · 9709",
    courseCode: "C101",
    units: ["P1", "S1"],
    teachers: [{ name: "示例周老师", units: ["P1", "S1"] }],
    studentCount: 20,
    fromRooms: [
      { room: "高一1班", count: 9 },
      { room: "高一2班", count: 11 },
    ],
    term: "2026–2027 上学期",
  },
  {
    id: "tc-phys-a",
    name: "高一物理A班",
    course: "CAIE 物理 · 9702",
    courseCode: "C201",
    units: ["AS"],
    teachers: [{ name: "示例陈老师", units: ["AS"] }],
    studentCount: 18,
    fromRooms: [
      { room: "高一1班", count: 8 },
      { room: "高一2班", count: 10 },
    ],
    term: "2026–2027 上学期",
  },
]

/* ============================================================
 * 学生资料（列表不显示学号；详情页可控制字段显示）
 * ========================================================== */

// 选课记录：学生在某��教学班内修读某门课程的若干单元
export interface CourseEnrollment {
  teachingClass: string // 教学班正式名
  course: string // 课程显示名
  units: { short: string; name: string }[] // 修读单元（本班简称 + 单元名称）
  role: "整门修读" | "分单元修读"
  since: string // 选课生效日
  status: "在读" | "已退出"
}

// 行为记录：班主任/任课教师填写的表扬、提醒或事件
export interface BehaviorRecord {
  id: string
  date: string
  kind: "表扬" | "提醒" | "事件"
  title: string
  note: string
  by: string // 记录人
  scope: string // 记录来源（行政班 / 教学班）
}

export interface StudentProfile {
  id: string
  name: string
  gender: "男" | "女"
  adminClass: "高一1班" | "高一2班"
  studentNo: string // 学号：仅详情页、按字段开关显示
  status: "在读"
  enrollDate: string
  joinClassDate: string // 进班日期：进入当前主班级的日期
  birthday: string
  nationality: string
  path: "AS" | "Full"
  teachingClasses: string[]
  courses: CourseEnrollment[] // 选课列表
  behaviors: BehaviorRecord[] // 行为记录
  guardianName: string
  guardianPhone: string // 敏感：默认不在列表显示
  guardianContactMissing?: boolean
  note?: string
}

// 主班主任：按主班级从行政班配置解析（主岗最多一人，可暂缺）
export function mainHeadTeacherOf(room: string): string | null {
  const cls = ADMIN_CLASSES.find((c) => c.name === room)
  return cls?.heads.find((h) => h.role === "主班主任")?.name ?? null
}

// 学生详情页可控字段（学号、生日、监护人电话等属于可显示/隐藏字段）
export type StudentFieldKey =
  | "studentNo"
  | "gender"
  | "birthday"
  | "nationality"
  | "enrollDate"
  | "path"
  | "guardianName"
  | "guardianPhone"
  | "teachingClasses"

export interface StudentFieldDef {
  key: StudentFieldKey
  label: string
  sensitive?: boolean // 敏感字段：家长/普通列表默认隐藏
  defaultInList: boolean // 是否默认在列表展示
}

// 字段目录：列表默认仅显示姓名/性别/行政班/状态等；学号与敏感字段默认隐藏
export const STUDENT_FIELDS: StudentFieldDef[] = [
  { key: "studentNo", label: "学号", defaultInList: false },
  { key: "gender", label: "性别", defaultInList: true },
  { key: "birthday", label: "出生日期", defaultInList: false },
  { key: "nationality", label: "国籍/地区", defaultInList: false },
  { key: "enrollDate", label: "入学日期", defaultInList: true },
  { key: "path", label: "修读路径", defaultInList: true },
  { key: "teachingClasses", label: "所在教学班", defaultInList: false },
  { key: "guardianName", label: "监护人", defaultInList: false },
  { key: "guardianPhone", label: "监护人电话", sensitive: true, defaultInList: false },
]

const NATIONS = ["中国", "中国", "中国", "中国香港", "马来西亚", "中国", "新加坡", "中国"]

// 行为记录样例池：按索引取用，制造多样的表扬 / 提醒 / 事件
const BEHAVIOR_SAMPLES: Omit<BehaviorRecord, "id">[] = [
  { date: "2026-09-18", kind: "表扬", title: "课堂积极发言", note: "P1 单元讲评中主动板演并讲清思路。", by: "示例林老师", scope: "高一1班 • 数学 · P1" },
  { date: "2026-09-15", kind: "事件", title: "学科竞赛获奖", note: "校级数学思维挑战赛二等奖。", by: "示例林老师", scope: "高一1班" },
  { date: "2026-09-11", kind: "提醒", title: "作业提交提醒", note: "S1 周末作业迟交一次，已与家长沟通。", by: "示例周老师", scope: "高一1班 • 数学 · S1" },
  { date: "2026-09-08", kind: "表扬", title: "值日尽责", note: "本周班级卫生检查满分，带头维护。", by: "示例林老师", scope: "高一1班" },
]

// 基于既有 22 名示例学生扩展出完整资料
export const STUDENT_PROFILES: StudentProfile[] = STUDENTS.map((s, i) => {
  const n = i + 1
  const mathUnits = s.asOnly
    ? [
        { short: "P1", name: "纯数学 1" },
        { short: "S1", name: "概率与统计 1" },
      ]
    : [
        { short: "P1", name: "纯数学 1" },
        { short: "S1", name: "概率与统计 1" },
        { short: "M1", name: "力学 1" },
      ]
  const courses: CourseEnrollment[] = [
    {
      teachingClass: "高一1班 • 数学",
      course: "CIE 数学",
      units: mathUnits,
      role: "分单元修读",
      since: "2026-09-01",
      status: "在读",
    },
  ]
  // 部分学生额外修读物理，展示多教学班选课
  if (n % 3 === 0) {
    courses.push({
      teachingClass: "高一1班 • 物理",
      course: "CIE 物理",
      units: [{ short: "F1", name: "力学与运动" }],
      role: "整门修读",
      since: "2026-09-01",
      status: "在读",
    })
  }
  // 行为记录：靠前的学生给较完整记录，其余给 1 条，制造真实差异
  const behaviors: BehaviorRecord[] = (n <= 3 ? BEHAVIOR_SAMPLES : [BEHAVIOR_SAMPLES[(n + 1) % BEHAVIOR_SAMPLES.length]]).map(
    (b, bi) => ({ ...b, id: `bh-${s.id}-${bi}` }),
  )
  return {
    id: s.id,
    name: s.name,
    gender: n % 5 === 0 || n % 3 === 0 ? "女" : "男",
    adminClass: s.homeroom,
    // 首次正式入学 2026-09；本段 001–006 为早先已发放编号，示例学生为 007–028
    studentNo: `TGS202609${String(n + 6).padStart(3, "0")}S`,
    status: "在读",
    enrollDate: "2026-09-01",
    joinClassDate: "2026-09-01",
    birthday: `2010-${String(((n * 7) % 12) + 1).padStart(2, "0")}-${String(((n * 3) % 27) + 1).padStart(2, "0")}`,
    nationality: NATIONS[i % NATIONS.length],
    path: s.asOnly ? "AS" : "Full",
    teachingClasses: s.asOnly
      ? ["高一1班 • 数学 · P1", "高一1班 • 数学 · S1"]
      : ["高一1班 • 数学 · P1", "高一1班 • 数学 · S1", "高一1班 • 数学 · M1"],
    courses,
    behaviors,
    guardianName: `示例家长${String(n).padStart(2, "0")}`,
    guardianPhone: s.parentContactMissing ? "" : "139****" + String(2000 + n),
    guardianContactMissing: s.parentContactMissing,
    note: s.asOnly ? "仅修读 AS 阶段，同时修读本例 P1、S1。" : undefined,
  }
})

export function studentProfilesByClass(room: string) {
  return STUDENT_PROFILES.filter((s) => s.adminClass === room)
}

/* ============================================================
 * 新增教学班：命名规范与候选数据（见《班级命名与教学组织规范 v1.0》）
 *  - 教学班正式名：<班组标识> • <课程显示名>
 *  - 教学单元组完整名：<父教学班正式名> • <课程单元名称>
 *  - 分隔符统一为两侧各一个空格的 " • "
 *  - 正式名与简称分离；简称仅用于简短显示，不改变正式名
 * ========================================================== */

export const NAME_SEP = " • "

// 教学班组织方式（仅命名与填写便利，不构成新的组织层级）
export type ClassOrganize = "single" | "cross-grade-班" | "cross-year"
export const ORGANIZE_OPTIONS: { value: ClassOrganize; label: string; hint: string }[] = [
  { value: "single", label: "单一行政班", hint: "以某个行政班为班组标识，如“高一1班”。" },
  { value: "cross-grade-班", label: "同年级跨班", hint: "同年级走班分组，如“高一 A 组”。" },
  { value: "cross-year", label: "跨年级", hint: "跨年级组建，如“跨年级 A 组”。" },
]

// 建班可选课程（取自课程目录，仅展示校内显示名与体系/版本用于选择器）
export interface CourseOption {
  code: string
  name: string // 校内显示名，如 CIE 数学
  board: string
  officialCode: string
}
export const COURSE_OPTIONS: CourseOption[] = [
  { code: "C101", name: "CIE 数学", board: "Cambridge International", officialCode: "9709" },
  { code: "C201", name: "CIE 物理", board: "Cambridge International", officialCode: "9702" },
  { code: "C301", name: "CIE 化学", board: "Pearson Edexcel", officialCode: "XCH11 / YCH11" },
  { code: "SCH-COMP-CHEM", name: "化学竞赛训练", board: "校本课程", officialCode: "（未设置）" },
  { code: "SCH-COMP-PHYS", name: "物理竞赛训练", board: "校本课程", officialCode: "（未设置）" },
]

// 课程可开设的教学单元（本轮用于“按教学单元组织”）；校本竞赛课程尚未展开单元
export interface UnitOption {
  short: string // 目录内已保存的建议简称（可为空）
  name: string // 课程单元名称（以目录实际保存为准）
}
export const COURSE_UNIT_OPTIONS: Record<string, UnitOption[]> = {
  C101: [
    { short: "P1", name: "纯数学 1" },
    { short: "P3", name: "纯数学 3" },
    { short: "S1", name: "概率与统计 1" },
    { short: "M1", name: "力学 1" },
  ],
  C201: [
    { short: "AS", name: "物理 AS 结构" },
    { short: "A2", name: "物理 A2 结构" },
  ],
  C301: [
    { short: "U1", name: "结构、键合与有机化学导论" },
    { short: "U2", name: "能量、动力学与无机化学" },
  ],
  // 校本竞赛课程：目录未展开单元，仅支持整门教学
  "SCH-COMP-CHEM": [],
  "SCH-COMP-PHYS": [],
}

// 班组标识建议（按组织方式给出示例预填）
export const GROUP_TAG_SUGGESTIONS: Record<ClassOrganize, string[]> = {
  single: ["高一1班", "高一2班", "高二1班"],
  "cross-grade-班": ["高一 A 组", "高一 B 组"],
  "cross-year": ["跨年级 A 组", "跨年级 B 组"],
}

// 参考行政班（可选，仅用于建议班组标识，不建立名单/权限关系）
export function referenceRoomOptions() {
  return ADMIN_CLASSES.map((c) => c.name)
}

// 正式名生成：<班组标识> • <课程显示名>
export function buildClassFormalName(groupTag: string, courseName: string): string {
  const tag = groupTag.trim()
  if (!tag || !courseName) return ""
  return `${tag}${NAME_SEP}${courseName}`
}

// 教学单元组完整名：<父教学班正式名> • <课程单元名称>
export function buildUnitFullName(parentFormalName: string, unitName: string): string {
  if (!parentFormalName || !unitName) return ""
  return `${parentFormalName}${NAME_SEP}${unitName}`
}

// 重名候选（同课程 + 规范化正式名一致）——用于“可能重复”提示，不作硬唯一
export function findSimilarTeachingClasses(courseName: string, formalName: string) {
  const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase()
  return TEACHING_CLASSES.filter(
    (t) => norm(t.name) === norm(formalName) || (t.course.includes(courseName) && norm(t.name) === norm(formalName)),
  )
}
