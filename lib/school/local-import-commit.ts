import { getFoundation, mergeFoundationImport } from "./foundation-store"
import { getStaffList, mergeImportedStaff } from "./staff-store"
import { validateLocalSchoolImport, type LocalSchoolImportBundle } from "./local-import-model"

export function applyLocalSchoolImport(bundle: LocalSchoolImportBundle, canMaintain: boolean) {
  if (!canMaintain) throw new Error("需要教职工维护权限。")
  validateLocalSchoolImport(bundle)
  // Independent local stores can fail separately. Each merge is idempotent;
  // callers must report incomplete import and retain a retry path on failure.
  mergeFoundationImport({ departments: bundle.departments, jobs: bundle.jobs, places: bundle.places })
  const result = mergeImportedStaff(bundle.staff)
  if (!bundle.staff.every(item => getStaffList().some(existing => existing.id === item.id)) || !bundle.places.every(item => getFoundation().places.some(existing => existing.id === item.id || existing.sourceIds?.includes(item.id) || (existing.building === item.building && existing.roomCode === item.roomCode)))) throw new Error("导入结果尚不完整，请重试。")
  return result
}
