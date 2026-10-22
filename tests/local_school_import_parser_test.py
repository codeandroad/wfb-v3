"""Synthetic matrix tests only. No private workbook, paths or personal data are read."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare-local-school-import.py"
SPEC = importlib.util.spec_from_file_location("local_school_import_parser", SCRIPT)
PARSER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARSER)


class LocalSchoolImportParserTest(unittest.TestCase):
    def fixtures(self):
        staff = [
            ("合成工作表甲", [
                ["合成标题"],
                ["序号", "姓名", "部门", "职位"],
                [1, "合成人员甲", "教务处", "数学、物理教师"],
                [1, "合成人员甲", "合成办公室", "合成组长"],
                [2, "合成人员乙", "教务处", "数学教师"],
                [3, None, "教务处", "空行"],
            ]),
            ("合成备用部门", [["姓名", "部门", "职务"], ["合成人员丙", None, "艺术教师"]]),
        ]
        cells = {
            (3, 2): "合成北区", (3, 3): "A101", (3, 4): "数学组", (4, 4): "合成备课室",
            (3, 5): "A201", (3, 6): "合成教学班", (5, 3): "走廊",
            (6, 2): "合成南区", (6, 3): "A101", (6, 4): "合成会议室",
        }
        merges = [(3, 2, 5, 2), (3, 3, 4, 3)]
        return staff, "合成分布图", cells, merges

    def test_source_rows_not_names_or_reused_serials_define_identity(self):
        args = self.fixtures()
        data = PARSER.assemble(*args, "school-files-synthetic-a")
        self.assertEqual(len(data["staff"]), 4)
        self.assertEqual(len({item["id"] for item in data["staff"]}), 4)
        self.assertEqual(data["summary"]["duplicateNameRows"], 2)
        self.assertEqual([item["duplicateName"] for item in data["staff"]], [True, True, False, False])
        repeated = PARSER.assemble(*args, "school-files-synthetic-b")
        self.assertEqual([item["id"] for item in data["staff"]], [item["id"] for item in repeated["staff"]])

    def test_explicit_department_and_multiple_subject_hints_do_not_grant_roles(self):
        data = PARSER.assemble(*self.fixtures(), "school-files-synthetic-a")
        first, second, _, fallback = data["staff"]
        self.assertEqual(first["department"], "教务处")
        self.assertEqual(first["departmentAffiliations"], ["教务处"])
        self.assertEqual(first["suggestedResearchSubjects"], ["数学", "物理"])
        self.assertEqual(second["department"], "合成办公室")
        self.assertEqual(fallback["department"], "合成备用部门")
        for person in data["staff"]:
            self.assertEqual(person["accountStatus"], "none")
            self.assertEqual(person["duties"], [])
            self.assertEqual(person["systemRoles"], [])
            self.assertEqual(person["employeeNo"], "")
            self.assertEqual(person["phone"], "")
            self.assertEqual(person["email"], "")
            self.assertNotIn("joinedAt", person)
        self.assertEqual(data["summary"]["suggestedSubjects"], {"数学": 2, "物理": 1, "艺术": 1})

    def test_merged_room_code_keeps_multiple_usages_without_invented_floor(self):
        data = PARSER.assemble(*self.fixtures(), "school-files-synthetic-a")
        self.assertEqual(len(data["places"]), 3)
        self.assertEqual(data["summary"]["multiUsePlaces"], 1)
        self.assertEqual(data["summary"]["ignoredLayoutMarkers"], 1)
        north = next(item for item in data["places"] if item["area"] == "合成北区" and item["roomCode"] == "A101")
        self.assertEqual(north["usage"], "数学组 / 合成备课室")
        self.assertEqual(north["kind"], "office")
        self.assertIn("同一门牌", north["note"])
        same_codes = [item for item in data["places"] if item["roomCode"] == "A101"]
        self.assertEqual(len({item["id"] for item in same_codes}), 2)
        self.assertTrue(all(item["floor"] == "" for item in data["places"]))

    def test_unmapped_usage_and_missing_area_fail_without_silent_omission(self):
        staff, name, cells, merges = self.fixtures()
        invalid = {**cells, (8, 4): "合成无门牌办公室"}
        with self.assertRaisesRegex(ValueError, "room code"):
            PARSER.assemble(staff, name, invalid, merges, "school-files-synthetic-a")
        invalid = {**cells, (8, 3): "Z101", (8, 4): "合成无区域教室"}
        with self.assertRaisesRegex(ValueError, "explicit area"):
            PARSER.assemble(staff, name, invalid, merges, "school-files-synthetic-a")


if __name__ == "__main__":
    unittest.main()
