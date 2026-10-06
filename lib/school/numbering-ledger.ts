export type NumberingConfig = { schoolId: string; code: string; preset: "standard" | "short" }
export function numberingForSchool(schoolId: string, code: string, preset: NumberingConfig["preset"] = "standard"): NumberingConfig { return { schoolId, code, preset } }
export type NumberType = "S" | "E"
export type Claim = { schoolId: string; type: NumberType; no: string; owner?: string; yyyymm?: string; serial?: string }

export function parseNumber(no: string, type: NumberType, config: NumberingConfig) {
  if (!/^[A-Z]{2}$/.test(config.code)) return null
  const pattern = config.preset === "short" ? `^${config.code}(\\d{2})(\\d{2})${type}(\\d{3})$` : `^${config.code}(\\d{4})(\\d{2})${type}(\\d{3})$`
  const match = new RegExp(pattern).exec(no)
  if (!match) return null
  const year = config.preset === "short" ? `20${match[1]}` : match[1]
  return { yyyymm: `${year}${match[2]}`, serial: match[3] }
}

export function createNumberingLedger(initial: Claim[] = []) {
  const claims = [...initial]
  const occupied = (no: string, type: NumberType, config: NumberingConfig) => {
    const parsed = parseNumber(no, type, config)
    return claims.some((claim) => claim.schoolId === config.schoolId && claim.type === type && (claim.no === no || !!parsed && claim.yyyymm === parsed.yyyymm && claim.serial === parsed.serial))
  }
  return {
    claims,
    occupied,
    register(no: string, type: NumberType, config: NumberingConfig, owner?: string) {
      const exact = claims.find((claim) => claim.schoolId === config.schoolId && claim.type === type && claim.no === no)
      if (exact) {
        if (owner && exact.owner && exact.owner !== owner) throw new Error("编号已被其他人员占用。")
        if (owner) exact.owner = owner
        return
      }
      if (occupied(no, type, config)) throw new Error("该逻辑号码已有历史归属。")
      claims.push({ schoolId: config.schoolId, type, no, owner, ...parseNumber(no, type, config) })
    },
    next(type: NumberType, yyyymm: string, config: NumberingConfig, reserved: ReadonlySet<string> = new Set()) {
      if (!/^[A-Z]{2}$/.test(config.code)) throw new Error("学校编号代码须为两位大写字母。")
      if (!/^(?!0000)\d{4}(?:0[1-9]|1[0-2])$/.test(yyyymm)) throw new Error("请填写合法的首次年月。")
      const year = Number(yyyymm.slice(0, 4))
      if (config.preset === "short" && (year < 2000 || year > 2099)) throw new Error("本校简短编号只支持 2000—2099 年；可保持待编号。")
      for (let n = 1; n <= 999; n++) {
        const no = `${config.code}${config.preset === "short" ? yyyymm.slice(2) : yyyymm}${type}${String(n).padStart(3, "0")}`
        if (!occupied(no, type, config) && !reserved.has(no)) return no
      }
      throw new Error("该年月号段已用尽（001—999 均被占用）。")
    },
  }
}
