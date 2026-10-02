// 听课协作 MO · 原型静态示例数据
import { CURRENT_SCHOOL } from "@/lib/school/instance"
// 全部为合成示例，仅用于页面设计与导航演示，不代表真实业务数据或数据同步。

export const SCHOOL_NAME = CURRENT_SCHOOL.nameZh
export const TERM_LABEL = "2026学年 第3周"

/* ---------------- 示例人物 ---------------- */

export const PEOPLE = {
  lin: { name: "示例林老师", subject: "计算机", initial: "林" },
  wang: { name: "示例王老师", subject: "数学", initial: "王" },
  chen: { name: "示例陈老师", subject: "物理", initial: "陈" },
  zhao: { name: "示例赵老师", subject: "英语", initial: "赵" },
  coordinator: { name: "示例协调管理员", subject: "教务", initial: "管" },
  reviewer: { name: "示例审阅人", subject: "教研组长", initial: "阅" },
} as const

/* ---------------- 原型视图 ---------------- */

/* ---------------- 开放听课课节 ---------------- */

export type OpenStatus = "open" | "full" | "closed"

export type OpenSession = {
  id: string
  topic: string
  teacher: string
  course: string
  date: string
  weekday: string
  time: string
  campus: string
  focus: string
  seatsLeft: number
  seatsTotal: number
  deadline: string
  status: OpenStatus
}

export const OPEN_SESSIONS: OpenSession[] = [
  {
    id: "op-1",
    topic: "二分查找的边界处理",
    teacher: "示例王老师",
    course: "高一信息 · 算法入门",
    date: "09-22",
    weekday: "周一",
    time: "10:05 – 10:50 (第3节)",
    campus: "本部 · A栋",
    focus: "如何用边界案例驱动课堂提问",
    seatsLeft: 3,
    seatsTotal: 6,
    deadline: "09-21 18:00 截止",
    status: "open",
  },
  {
    id: "op-2",
    topic: "概率分布的课堂讨论",
    teacher: "示例陈老师",
    course: "高二数学 · 统计",
    date: "09-23",
    weekday: "周二",
    time: "14:00 – 14:45 (第6节)",
    campus: "本部 · B栋",
    focus: "小组讨论中如何暴露常见误解",
    seatsLeft: 1,
    seatsTotal: 4,
    deadline: "09-22 18:00 截止",
    status: "open",
  },
  {
    id: "op-3",
    topic: "实验探究中的提问设计",
    teacher: "示例陈老师",
    course: "高一物理 · 力学",
    date: "09-24",
    weekday: "周三",
    time: "09:10 – 09:55 (第2节)",
    campus: "本部 · 实验楼",
    focus: "开放性问题的搭建与追问",
    seatsLeft: 0,
    seatsTotal: 4,
    deadline: "已满",
    status: "full",
  },
  {
    id: "op-4",
    topic: "英语阅读中的证据表达",
    teacher: "示例赵老师",
    course: "高一英语 · 阅读",
    date: "09-19",
    weekday: "上周五",
    time: "10:05 – 10:50 (第3节)",
    campus: "本部 · A栋",
    focus: "引导学生用文本证据支持观点",
    seatsLeft: 2,
    seatsTotal: 5,
    deadline: "报名已截止",
    status: "closed",
  },
]

/* ---------------- 我的安排 ---------------- */

export type ReserveStatus = "reserved" | "cancelled"
export type AttendStatus = "self-going" | "pending-check" | "checked-present" | "cannot-confirm"
export type RecordStatus = "none" | "draft" | "submitted" | "shared"

export type Arrangement = {
  id: string
  topic: string
  teacher: string
  course: string
  date: string
  weekday: string
  time: string
  room?: string
  reserve: ReserveStatus
  attend: AttendStatus
  record: RecordStatus
  change?: { oldTime: string; newTime: string }
}

// 按日期分组的示例安排
export const ARRANGEMENTS: Arrangement[] = [
  {
    id: "ar-1",
    topic: "二分查找的边界处理",
    teacher: "示例王老师",
    course: "高一信息 · 算法入门",
    date: "09-22",
    weekday: "周一",
    time: "10:05 – 10:50 (第3节)",
    room: "A栋 305",
    reserve: "reserved",
    attend: "self-going",
    record: "none",
  },
  {
    id: "ar-2",
    topic: "概率分布的课堂讨论",
    teacher: "示例陈老师",
    course: "高二数学 · 统计",
    date: "09-23",
    weekday: "周二",
    time: "14:00 – 14:45 (第6节)",
    reserve: "reserved",
    attend: "self-going",
    record: "none",
    change: { oldTime: "09-23 周二 14:00", newTime: "09-24 周三 14:00" },
  },
  {
    id: "ar-3",
    topic: "英语阅读中的证据表达",
    teacher: "示例赵老师",
    course: "高一英语 · 阅读",
    date: "09-19",
    weekday: "上周五",
    time: "10:05 – 10:50 (第3节)",
    room: "A栋 210",
    reserve: "reserved",
    attend: "pending-check",
    record: "draft",
  },
  {
    id: "ar-4",
    topic: "函数图像的动态演示",
    teacher: "示例王老师",
    course: "高一数学 · 函数",
    date: "09-15",
    weekday: "上周一",
    time: "08:10 – 08:55 (第1节)",
    room: "B栋 108",
    reserve: "reserved",
    attend: "checked-present",
    record: "submitted",
  },
]

/* ---------------- 申请与回复 ---------------- */

export type SentStatus = "await-reply" | "await-pick" | "settled" | "declined"
export type RecvStatus = "await-offer" | "await-pick" | "settled"

export type SentApplication = {
  id: string
  target: string
  topic: string
  wish: string
  myTime: string
  note: string
  lastReply: string
  status: SentStatus
  candidates?: { id: string; date: string; weekday: string; time: string; course: string; campus: string }[]
}

export const SENT_APPLICATIONS: SentApplication[] = [
  {
    id: "sa-1",
    target: "示例王老师",
    topic: "算法课的课堂提问设计",
    wish: "希望观察“边界案例如何进入课堂提问”",
    myTime: "本周一、周三上午",
    note: "我在准备一节算法公开课，想学习提问的组织方式。",
    lastReply: "对方已提供 2 个候选课节，待你选定",
    status: "await-pick",
    candidates: [
      { id: "c1", date: "09-22", weekday: "周一", time: "10:05 – 10:50", course: "高一信息 · 算法入门", campus: "本部 · A栋" },
      { id: "c2", date: "09-24", weekday: "周三", time: "10:05 – 10:50", course: "高一信息 · 算法进阶", campus: "本部 · A栋" },
    ],
  },
  {
    id: "sa-2",
    target: "示例陈老师",
    topic: "实验探究的追问方式",
    wish: "希望观察开放性问题的搭建",
    myTime: "本周四下午",
    note: "关注实验课中如何追问。",
    lastReply: "已发送申请，等待授课教师回复",
    status: "await-reply",
  },
  {
    id: "sa-3",
    target: "示例赵老师",
    topic: "阅读课的证据表达",
    wish: "希望观察学生如何引用文本证据",
    myTime: "上周五上午",
    note: "已完成一次听课。",
    lastReply: "已约定：09-19 周五 10:05，A栋 210",
    status: "settled",
  },
]

export type RecvApplication = {
  id: string
  from: string
  topic: string
  wish: string
  applicantTime: string
  note: string
  status: RecvStatus
  offered?: { id: string; date: string; weekday: string; time: string; course: string; campus: string }[]
}

// 授课教师自己的可提供课次（用于回复申请时挑选候选，不展开完整课表）
export const MY_TEACHING_SLOTS = [
  { id: "ts-1", date: "09-22", weekday: "周一", time: "10:05 – 10:50", course: "高一信息 · 算法入门", campus: "本部 · A栋" },
  { id: "ts-2", date: "09-24", weekday: "周三", time: "10:05 – 10:50", course: "高一信息 · 算法进阶", campus: "本部 · A栋" },
  { id: "ts-3", date: "09-25", weekday: "周四", time: "14:00 – 14:45", course: "高一信息 · 项目实践", campus: "本部 · A栋" },
]

export const RECV_APPLICATIONS: RecvApplication[] = [
  {
    id: "ra-1",
    from: "示例林老师",
    topic: "算法课的课堂提问设计",
    wish: "希望观察“边界案例如何进入课堂提问”",
    applicantTime: "本周一、周三上午",
    note: "在准备一节算法公开课，想学习提问的组织方式。",
    status: "await-offer",
  },
  {
    id: "ra-2",
    from: "示例赵老师",
    topic: "算法思维如何迁移到文科课堂",
    wish: "希望观察分步拆解问题的方式",
    applicantTime: "本周四",
    note: "尝试把结构化思维用在阅读教学。",
    status: "await-pick",
    offered: [{ id: "ts-3", date: "09-25", weekday: "周四", time: "14:00 – 14:45", course: "高一信息 · 项目实践", campus: "本部 · A栋" }],
  },
]

/* ---------------- 我开放的课 ---------------- */

export type PublishStatus = "draft" | "enrolling" | "full" | "closed" | "ended"

export type PublishedSession = {
  id: string
  topic: string
  course: string
  date: string
  weekday: string
  time: string
  seatsLeft: number
  seatsTotal: number
  deadline: string
  status: PublishStatus
  enrolled: string[]
}

export const PUBLISHED_SESSIONS: PublishedSession[] = [
  {
    id: "pb-1",
    topic: "二分查找的边界处理",
    course: "高一信息 · 算法入门",
    date: "09-22",
    weekday: "周一",
    time: "10:05 – 10:50",
    seatsLeft: 3,
    seatsTotal: 6,
    deadline: "09-21 18:00",
    status: "enrolling",
    enrolled: ["示例林老师", "示例赵老师", "示例孙老师"],
  },
  {
    id: "pb-2",
    topic: "递归与栈的可视化",
    course: "高一信息 · 算法进阶",
    date: "09-25",
    weekday: "周四",
    time: "10:05 – 10:50",
    seatsLeft: 0,
    seatsTotal: 4,
    deadline: "09-24 18:00",
    status: "full",
    enrolled: ["示例陈老师", "示例赵老师", "示例周老师", "示例吴老师"],
  },
  {
    id: "pb-3",
    topic: "排序算法的对比实验",
    course: "高一信息 · 算法入门",
    date: "09-18",
    weekday: "上周四",
    time: "14:00 – 14:45",
    seatsLeft: 2,
    seatsTotal: 5,
    deadline: "已结束",
    status: "ended",
    enrolled: ["示例林老师", "示例赵老师", "示例孙老师"],
  },
  {
    id: "pb-4",
    topic: "图的广度优先遍历",
    course: "高一信息 · 算法进阶",
    date: "09-29",
    weekday: "下周一",
    time: "10:05 – 10:50",
    seatsLeft: 6,
    seatsTotal: 6,
    deadline: "草稿未发布",
    status: "draft",
    enrolled: [],
  },
]

/* ---------------- 到场核对 ---------------- */

export type CheckStatus = "pending" | "present" | "absent" | "cannot"

export const ATTENDANCE_ROSTER: { name: string; subject: string; initial: CheckStatus }[] = [
  { name: "示例林老师", subject: "计算机", initial: "pending" },
  { name: "示例赵老师", subject: "英语", initial: "pending" },
  { name: "示例孙老师", subject: "地理", initial: "pending" },
]

/* ---------------- 听课记录 ---------------- */

export type RecordListStatus = "draft" | "submitted" | "shared"

export type ObservationRecord = {
  id: string
  topic: string
  teacher: string
  course: string
  date: string
  time: string
  status: RecordListStatus
  updatedAt: string
  makeup?: boolean
}

export const RECORDS: ObservationRecord[] = [
  {
    id: "rc-1",
    topic: "英语阅读中的证据表达",
    teacher: "示例赵老师",
    course: "高一英语 · 阅读",
    date: "09-19",
    time: "10:05 – 10:50",
    status: "draft",
    updatedAt: "09-19 11:20 保存",
  },
  {
    id: "rc-2",
    topic: "函数图像的动态演示",
    teacher: "示例王老师",
    course: "高一数学 · 函数",
    date: "09-15",
    time: "08:10 – 08:55",
    status: "shared",
    updatedAt: "09-15 16:40 提交",
  },
  {
    id: "rc-3",
    topic: "力学实验的误差分析",
    teacher: "示例陈老师",
    course: "高一物理 · 力学",
    date: "09-11",
    time: "09:10 – 09:55",
    status: "submitted",
    updatedAt: "09-11 17:05 提交",
    makeup: true,
  },
]

// 一份完整的示例记录正文（五组），用于编辑页与审阅视图
export const SAMPLE_RECORD = {
  topic: "二分查找的边界处理",
  teacher: "示例王老师",
  course: "高一信息 · 算法入门",
  date: "09-22 周一",
  time: "10:05 – 10:50 (第3节)",
  room: "A栋 305",
  sections: [
    {
      key: "focus",
      title: "本次关注点",
      value: "边界案例如何进入课堂提问。",
    },
    {
      key: "observe",
      title: "课堂观察",
      value:
        "先展示目标不存在的输入，让学生比较循环终止条件，再讨论两组边界测试；学生在“区间为空”时出现分歧，教师借机组织了一次快速表决。",
    },
    {
      key: "borrow",
      title: "可借鉴做法",
      value: "先预测结果，再验证思路——让学生在运行代码前写下预期，暴露误解后再修正。",
    },
    {
      key: "reflect",
      title: "个人反思",
      value: "自己的课堂示例偏向成功情况，需要增加失败案例，让学生主动构造反例。",
    },
    {
      key: "question",
      title: "希望与授课教师交流的问题",
      value: "���何安排学生独立构造反例？在时间有限时怎样取舍？",
    },
  ],
  // 默认分享设置：个人反思默认不分享
  shareable: {
    focus: true,
    observe: true,
    borrow: true,
    reflect: false,
    question: true,
  },
}

/* ---------------- 学校侧：安排与协调 ---------------- */

export const COORD_ROWS: {
  teacher: string
  session: string
  date: string
  status: string
  tone: "info" | "warning" | "success" | "neutral"
  pending: string
}[] = [
  { teacher: "示例林老师", session: "二分查找的边界处理 · 示例王老师", date: "09-22 周一", status: "已预约", tone: "info", pending: "待授课教师核对到场" },
  { teacher: "示例赵老师", session: "概率分布的课堂讨论 · 示例陈老师", date: "09-23 → 09-24", status: "时间变更待确认", tone: "warning", pending: "已通知申请人确认新时间" },
  { teacher: "示例孙老师", session: "英语阅读中的证据表达 · 示例赵老师", date: "09-19 周五", status: "已完成", tone: "success", pending: "记录已提交（协调侧不展示全文）" },
  { teacher: "示例周老师", session: "力学实验的误差分析 · 示例陈老师", date: "09-11 周四", status: "补录待核验", tone: "neutral", pending: "线下听课补录，待授课教师核验" },
]

/* ---------------- 学校侧的听课要求 ---------------- */

export const REQUIREMENT_DEFAULT_OFF = true

export const REQUIREMENT_SAMPLE = {
  scope: "全体任课教师（试用期教师除外）",
  cycle: "每学期",
  count: "建议 2 次（不设红色欠额提示）",
  condition: "完成听课并提交记录视为达成",
  effective: "2026学年 第2学期起",
  exception: "临时代课、脱产培训期间自动豁免",
}

/* ---------------- 学校侧：完成情况 ---------------- */

export const COMPLETION_ROWS: {
  teacher: string
  attended: number
  submitted: number
  pending: number
}[] = [
  { teacher: "示例林老师", attended: 2, submitted: 1, pending: 1 },
  { teacher: "示例王老师", attended: 1, submitted: 1, pending: 0 },
  { teacher: "示例陈老师", attended: 3, submitted: 2, pending: 0 },
  { teacher: "示例赵老师", attended: 1, submitted: 0, pending: 0 },
]

/* ---------------- 学校侧：记录审阅（仅审阅人视图） ---------------- */

export const REVIEW_QUEUE: {
  id: string
  author: string
  topic: string
  teacher: string
  date: string
  status: "await-review" | "reviewed"
}[] = [
  { id: "rv-1", author: "示例林老师", topic: "二分查找的边界处理", teacher: "示例王老师", date: "09-22", status: "await-review" },
  { id: "rv-2", author: "示例孙老师", topic: "英语阅读中的证据表达", teacher: "示例赵老师", date: "09-19", status: "reviewed" },
]
