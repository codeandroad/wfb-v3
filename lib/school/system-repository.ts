import "server-only"
import { DatabaseSync } from "node:sqlite"
import { mkdirSync, chmodSync, existsSync } from "node:fs"
import path from "node:path"
import { randomBytes, randomUUID, createHash } from "node:crypto"
import { SCHOOL_ID, canonical, retainSchoolNumbers, migrateSchoolRecords, validateSchoolChange, validateSchoolRecords, type SchoolRecords, type SchoolSnapshot } from "./system-model"
export class SchoolConflict extends Error { constructor(public revision:number,migration=false) { super(migration?"历史资料存在不同修改，两份内容均已保留在系统迁移备份中，请核对后处理。":"学校资料已被其他窗口更新，请刷新后重试；本次输入未覆盖其他修改。") } }
export function createSchoolRepository(file: string) {
  const open = () => { if (!existsSync(file)) throw Error("学校数据库尚未初始化。" ); const db = new DatabaseSync(file); db.exec("PRAGMA busy_timeout=5000"); return db }
  const snapshot = (db:DatabaseSync): SchoolSnapshot => {
    const row = db.prepare("SELECT system_id, revision, records FROM school_records WHERE school_id=?").get(SCHOOL_ID) as {system_id:string;revision:number;records:string}|undefined
    if (!row) throw Error("学校数据库尚未初始化。")
    return {systemId:row.system_id,revision:row.revision,records:validateSchoolRecords(JSON.parse(row.records))}
  }
  return {
    initialize(records:SchoolRecords) {
      records=retainSchoolNumbers(null,records); validateSchoolRecords(records); mkdirSync(path.dirname(file),{recursive:true,mode:0o700}); chmodSync(path.dirname(file),0o700)
      const db = new DatabaseSync(file); chmodSync(file,0o600)
      try {
        db.exec("PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS school_records (school_id TEXT PRIMARY KEY, system_id TEXT NOT NULL, revision INTEGER NOT NULL, records TEXT NOT NULL, baseline TEXT NOT NULL, secret TEXT NOT NULL); CREATE TABLE IF NOT EXISTS school_migrations (school_id TEXT NOT NULL, browser_id TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL, conflicts TEXT NOT NULL, PRIMARY KEY(school_id,browser_id,digest));")
        db.exec("BEGIN IMMEDIATE")
        const existed=db.prepare("SELECT 1 FROM school_records WHERE school_id=?").get(SCHOOL_ID)
        if (!existed) db.prepare("INSERT INTO school_records VALUES(?,?,1,?,?,?)").run(SCHOOL_ID,randomUUID(),canonical(records),canonical(records),randomBytes(32).toString("hex"))
        const existing=snapshot(db),normalized=retainSchoolNumbers(existing.records,existing.records)
        if(canonical(normalized)!==canonical(existing.records))db.prepare("UPDATE school_records SET revision=revision+1,records=? WHERE school_id=?").run(canonical(normalized),SCHOOL_ID)
        const result=snapshot(db);db.exec("COMMIT");return result
      } finally { db.close() }
    },
    read() { const db=open(); try { return snapshot(db) } finally {db.close()} },
    secret() { const db=open(); try { return (db.prepare("SELECT secret FROM school_records WHERE school_id=?").get(SCHOOL_ID) as {secret:string}).secret } finally {db.close()} },
    save(expectedRevision:number,records:SchoolRecords) {
      const db=open(); try { db.exec("BEGIN IMMEDIATE"); const before=snapshot(db); if (before.revision!==expectedRevision) throw new SchoolConflict(before.revision); records=retainSchoolNumbers(before.records,records); validateSchoolChange(before.records,records); db.prepare("UPDATE school_records SET revision=revision+1,records=? WHERE school_id=? AND revision=?").run(canonical(records),SCHOOL_ID,expectedRevision); const result=snapshot(db); db.exec("COMMIT"); return result } catch(error) { try {db.exec("ROLLBACK")} catch{} throw error } finally {db.close()}
    },
    migrate(browserId:string,incoming:SchoolRecords) {
      validateSchoolRecords(incoming)
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(browserId)) throw Error("浏览器迁移标识无效。")
      const digest=createHash("sha256").update(canonical(incoming)).digest("hex"),db=open()
      try {
        db.exec("BEGIN IMMEDIATE"); const before=snapshot(db)
        const receipt=db.prepare("SELECT conflicts FROM school_migrations WHERE school_id=? AND browser_id=? AND digest=?").get(SCHOOL_ID,browserId,digest) as {conflicts:string}|undefined
        if (receipt) { db.exec("COMMIT"); if (JSON.parse(receipt.conflicts).length) throw new SchoolConflict(before.revision,true); return before }
        const baseline=JSON.parse((db.prepare("SELECT baseline FROM school_records WHERE school_id=?").get(SCHOOL_ID) as {baseline:string}).baseline)
        const result=migrateSchoolRecords(baseline,before.records,incoming);result.records=retainSchoolNumbers(before.records,result.records)
        db.prepare("INSERT INTO school_migrations VALUES(?,?,?,?,?)").run(SCHOOL_ID,browserId,digest,canonical(incoming),canonical(result.conflicts))
        if (!result.conflicts.length) validateSchoolChange(before.records,result.records,true)
        if (!result.conflicts.length && canonical(result.records)!==canonical(before.records)) db.prepare("UPDATE school_records SET revision=revision+1, records=? WHERE school_id=?").run(canonical(result.records),SCHOOL_ID)
        const after=snapshot(db); db.exec("COMMIT"); if (result.conflicts.length) throw new SchoolConflict(after.revision,true); return after
      } catch(error) {try {db.exec("ROLLBACK")}catch{} throw error} finally {db.close()}
    },
  }
}
export function schoolRepository() { return createSchoolRepository(path.join(process.cwd(),".local-data","school.sqlite")) }
