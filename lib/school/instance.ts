// 当前部署实例的学校身份。
// 产品采用“每所学校单独部署一个实例”，一个运行中的实例只属于一所学校。
// 这里是本实例的配置数据（原型中以静态模块表达，生产中应来自实例配置），
// 不是所有学校共用的全局常量；后续学生/教职工编号规则须引用 CURRENT_SCHOOL.code。

export interface SchoolMilestone {
  id: string
  period: string // 时间描述；未确认时明确写“待确认”
  title: string
  body: string
  placeholder: boolean
}

export interface SchoolEvent {
  id: string
  title: string
  body: string
  placeholder: boolean
}

export interface SchoolInstance {
  code: string
  numbering: {
    code: string
    preset: "standard" | "short"
  }
  nameZh: string
  nameEn: string
  brand: {
    logoWhite: string // 深色背景使用
    logoRed: string // 浅色背景使用
    crestRed: string // 纯校徽（红），用于侧栏等窄位
    crestMono: string // 纯校徽（单色）
    campus: string
  }
  intro: { text: string; placeholder: boolean }
  history: { text: string; placeholder: boolean }
  milestones: SchoolMilestone[]
  events: SchoolEvent[]
}

export const CURRENT_SCHOOL: SchoolInstance = {
  code: "TGS",
  numbering: { code: "TG", preset: "short" },
  nameZh: "天行创世纪学校",
  nameEn: "Teensen Genesis School",
  brand: {
    logoWhite: "/brand/tgs-logo-white.png",
    logoRed: "/brand/tgs-logo-red.png",
    crestRed: "/brand/tgs-crest-red.png",
    crestMono: "/brand/tgs-crest-bw.png",
    campus: "/brand/tgs-campus.jpg",
  },
  intro: {
    placeholder: true,
    text: "此处用于展示学校简介：办学理念、课程体系与育人目标。当前为原型占位内容，正式文案由学校提供后替换。",
  },
  history: {
    placeholder: true,
    text: "此处用于展示学校历史沿革：学校的起源、关键阶段与传承。当前未录入真实历史资料，不展示任何创校年份或具体事实。",
  },
  milestones: [
    { id: "m1", period: "时间待确认", title: "阶段一 · 待补充", body: "发展历程节点占位：由学校确认后填写真实时间与事件。", placeholder: true },
    { id: "m2", period: "时间待确认", title: "阶段二 · 待补充", body: "发展历程节点占位：由学校确认后填写真实时间与事件。", placeholder: true },
    { id: "m3", period: "时间待确认", title: "阶段三 · 待补充", body: "发展历程节点占位：由学校确认后填写真实时间与事件。", placeholder: true },
    { id: "m4", period: "当前", title: "启用周反馈系统（本实例）", body: "学校独立部署本系统实例，学校代码为 TGS。", placeholder: false },
  ],
  events: [
    { id: "e1", title: "大事件 · 待补充", body: "重要事件占位，不代表真实事件。", placeholder: true },
    { id: "e2", title: "大事件 · 待补充", body: "重要事件占位，不代表真实事件。", placeholder: true },
    { id: "e3", title: "大事件 · 待补充", body: "重要事件占位，不代表真实事件。", placeholder: true },
  ],
}
