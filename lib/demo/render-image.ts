// 运行时用 Canvas 生成反馈图片（真实 PNG，可下载）。非设计资源，故不用图片生成工具。

export interface SummaryImageInput {
  school: string
  week: string
  weekRange: string
  className: string
  course: string
  units: string[]
  homeroom: string
  studentCount: number
  sections: { label: string; text: string }[]
  weekend?: { title: string; body: string } | null
}

const W = 1080
const PAD = 64
const GREEN = "#245f50"
const DARK = "#21372f"
const MUTED = "#5f7168"
const LINE = "#dbe3df"
const FONT =
  'Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif'

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(line)
      line = ""
      continue
    }
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function renderSummaryImage(input: SummaryImageInput): Promise<string> {
  // 先用测量画布估算高度
  const measure = document.createElement("canvas").getContext("2d")!
  const contentWidth = W - PAD * 2

  let h = 0
  h += 200 // header
  const blocks: { label: string; lines: string[] }[] = []
  measure.font = `400 26px ${FONT}`
  for (const s of input.sections) {
    if (!s.text.trim()) continue
    const lines = wrapText(measure, s.text, contentWidth)
    blocks.push({ label: s.label, lines })
    h += 46 + lines.length * 40 + 24
  }
  if (input.weekend && input.weekend.body.trim()) {
    const lines = wrapText(measure, input.weekend.body, contentWidth)
    blocks.push({ label: input.weekend.title, lines })
    h += 46 + lines.length * 40 + 24
  }
  h += 120 // footer

  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = W * scale
  canvas.height = h * scale
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)

  // 背景
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, h)

  // 顶部色带
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, W, 140)
  ctx.fillStyle = "#ffffff"
  ctx.font = `700 34px ${FONT}`
  ctx.fillText(input.school, PAD, 60)
  ctx.font = `400 24px ${FONT}`
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.fillText(`${input.week} · ${input.weekRange}`, PAD, 100)

  // 班级信息条
  let y = 180
  ctx.fillStyle = DARK
  ctx.font = `700 30px ${FONT}`
  ctx.fillText(`${input.className} · ${input.course}`, PAD, y)
  y += 40
  ctx.fillStyle = MUTED
  ctx.font = `400 24px ${FONT}`
  ctx.fillText(`单元 ${input.units.join(" + ")} · ${input.homeroom} · ${input.studentCount} 名学生`, PAD, y)
  y += 30

  // 分隔线
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 40

  // 各段落
  for (const b of blocks) {
    ctx.fillStyle = GREEN
    ctx.font = `700 27px ${FONT}`
    // 小标记
    ctx.fillRect(PAD, y - 20, 6, 24)
    ctx.fillText(b.label, PAD + 18, y)
    y += 44
    ctx.fillStyle = DARK
    ctx.font = `400 26px ${FONT}`
    for (const ln of b.lines) {
      ctx.fillText(ln, PAD, y)
      y += 40
    }
    y += 24
  }

  // 页脚
  y = h - 70
  ctx.strokeStyle = LINE
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  y += 34
  ctx.fillStyle = MUTED
  ctx.font = `400 22px ${FONT}`
  ctx.fillText("本图由独立周反馈系统生成 · 交互原型示例数据", PAD, y)

  // 模拟渲染耗时
  await new Promise((r) => setTimeout(r, 700))
  return canvas.toDataURL("image/png")
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
