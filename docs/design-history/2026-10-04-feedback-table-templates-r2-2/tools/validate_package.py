#!/usr/bin/env python3
"""Read-only checks for this r2.2 handoff package; no application/network tests."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

class ValidationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        require(key not in out, f'Duplicate JSON key: {key}')
        out[key] = value
    return out


def read_json(path: Path) -> Any:
    def reject_constant(value: str) -> None:
        raise ValidationError(f'Non-standard JSON value: {value}')
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object,
                      parse_constant=reject_constant)


def validate_header(example: dict[str, Any]) -> None:
    rows = example['headerRows']
    width = example['leafColumnCount']
    grid: list[list[Any]] = [[None] * width for _ in rows]
    for r, cells in enumerate(rows):
        cursor = 0
        for cell in cells:
            while cursor < width and grid[r][cursor] is not None:
                cursor += 1
            rs, cs = cell['rowSpan'], cell['colSpan']
            require(isinstance(rs, int) and rs > 0 and isinstance(cs, int) and cs > 0,
                    'Header spans must be positive integers')
            require(r + rs <= len(rows) and cursor + cs <= width,
                    f'Header span out of bounds: {example["id"]}')
            for rr in range(r, r + rs):
                for cc in range(cursor, cursor + cs):
                    require(grid[rr][cc] is None, 'Overlapping header span')
                    grid[rr][cc] = cell
            if cell['role'] == 'time':
                require(not any(word in cell['label'] for word in ['出勤','课堂','提交','质量','评价']),
                        f'Metric inside time header: {cell["label"]}')
                d = date.fromisoformat(cell['key'])
                require(cell['label'] == f'周{"一二三四五六日"[d.weekday()]} {d.month}/{d.day}',
                        'Incorrect example weekday/date')
            if cell.get('parentTime'):
                require(r > 0 and grid[0][cursor]['key'] == cell['parentTime'],
                        'Metric not beneath its own time group')
            cursor += cs
    require(all(all(cell is not None for cell in row) for row in grid), 'Incomplete header grid')


def validate(root: Path, content_only: bool) -> dict[str, Any]:
    required = [
        'V0_FEEDBACK_TABLE_TEMPLATES_2026-10-04_r2_2.md', 'REPORT_TABLE_STRUCTURE.md',
        'TABLE_HEADER_EXAMPLES.json','DEMO_CASES.json','DEMO_CASES_GUIDE.md',
        'ACCEPTANCE_CHECKLIST.md','README.md','SOURCE_NOTES.md','START_HERE.txt',
        'tools/validate_package.py'
    ]
    for filename in required:
        p = root / filename
        require(p.is_file() and p.stat().st_size > 0, f'Missing/empty file: {filename}')
        text = p.read_text(encoding='utf-8')
        require('\ufffd' not in text, f'Encoding replacement character in {filename}')
    main = (root/required[0]).read_text(encoding='utf-8')
    for term in ['一日一格','字段子表头','个人·周学习记录','个人·课堂与作业详报','个人·学习跟进报告',
                 '教学介绍','学情总结','Asia/Shanghai','FT301—FT364']:
        require(term in main, f'Main specification missing: {term}')
    checklist = (root/'ACCEPTANCE_CHECKLIST.md').read_text(encoding='utf-8')
    ids = re.findall(r'^\| (FT\d+) \|', checklist, flags=re.M)
    require(ids == [f'FT{x}' for x in range(301,365)], 'Checklist IDs must be FT301–FT364')
    require(checklist.count('| NOT_RUN |') == 64, 'Product checks must remain NOT_RUN in the unimplemented package')

    headers = read_json(root/'TABLE_HEADER_EXAMPLES.json')
    require(headers['version']=='r2.2' and headers['notVisualLayout'] is True, 'Header version/boundary mismatch')
    for example in headers['classModes']:
        validate_header(example)
    templates = {t['id']:t for t in headers['templates']}
    require(set(templates)=={'C01','C02','C03','C04','P01','P02','P03'}, 'Exactly seven template definitions required')
    for pid in ['P01','P02','P03']:
        require({'PERSONAL_WEEK_DAILY','PERSONAL_HOMEWORK_DETAIL'} <= set(templates[pid]['requiredTables']),
                f'{pid} must retain both complete core tables')
    detail = next(t for t in headers['personalTables'] if t['id']=='PERSONAL_LESSON_DETAIL')
    require(detail['formalGradeFieldAllowed'] is False, 'Per-lesson formal grades not permitted')
    require(not any(re.search('grade|evaluation', c['key'], flags=re.I) for c in detail['columns']),
            'Formal grade unexpectedly present in lesson-detail columns')

    data = read_json(root/'DEMO_CASES.json')
    require(data['version']=='r2.2' and data['notDatabaseSchema'] is True, 'Fixture version/boundary mismatch')
    require([len(c['students']) for c in data['cases']]==[28,72,123], 'Fixture sizes changed')
    schemes = {s['id']:{level['code'] for level in s['levels']} for s in data['schemes']}
    numbers: set[str] = set()
    case_summaries = []
    for case in data['cases']:
        prefix = case['caseId']
        students = {s['id']:s for s in case['students']}
        require(len(students)==len(case['students']), f'Duplicate student in {prefix}')
        require(len(students)==case['expected']['studentRows'], 'Expected row count mismatch')
        task_ids = set(case['context']['selectedTaskIds'])
        start = date.fromisoformat(case['context']['period']['starts'])
        end = date.fromisoformat(case['context']['period']['endsInclusive'])
        clock = datetime.fromisoformat(case['fixtureClock'])
        require(case['context']['timeZone']=='Asia/Shanghai', 'Fixture time zone mismatch')
        for student in students.values():
            number = student['studentNumber']
            require(re.fullmatch(r'[A-Z]{2}\d{6}S\d{3}',number) is not None and not number.endswith('000'),
                    'Invalid synthetic student number')
            require(number not in numbers, 'Duplicate synthetic student number')
            numbers.add(number)
        lessons = {l['id']:l for l in case['lessons']}
        require(len(lessons)==len(case['lessons'])==case['expected']['lessonCount'], 'Lesson count/identity mismatch')
        for lesson in lessons.values():
            require(lesson['taskId'] in task_ids, 'Lesson task mismatch')
            require(start <= date.fromisoformat(lesson['date']) <= end, 'Lesson outside sample period')
            a,b = datetime.fromisoformat(lesson['startsAt']), datetime.fromisoformat(lesson['endsAt'])
            require(a < b and a.date().isoformat()==lesson['date'], 'Lesson timing invalid')
            require(lesson['hasOccurred']==(clock >= b), 'Fixture occurrence flag does not match fixed test clock')
        daily_keys: set[tuple[str,str,str]] = set()
        absence_count = 0
        for record in case['dailyRecords']:
            sid,task,day = record['studentId'],record['taskId'],record['date']
            require(sid in students and task in task_ids, 'Invalid daily record identity')
            key = (sid,task,day)
            require(key not in daily_keys, 'Duplicate formal daily record')
            daily_keys.add(key)
            require(start <= date.fromisoformat(day) <= end, 'Daily record outside period')
            attendance = record['attendance']
            require(len({a['lessonId'] for a in attendance})==len(attendance), 'Duplicate attendance within day')
            for a in attendance:
                require(a['lessonId'] in lessons, 'Attendance references missing lesson')
                lesson = lessons[a['lessonId']]
                require(lesson['date']==day and lesson['taskId']==task, 'Attendance crosses day/task')
            evaluation = record['classroomEvaluation']
            code = evaluation['gradeCode']
            require(evaluation['schemeId'] in schemes, 'Unknown classroom scheme')
            require(code is None or code in schemes[evaluation['schemeId']], 'Unknown classroom grade')
            require((evaluation['state']=='RECORDED')==(code is not None), 'Grade/state inconsistency')
            all_absent = bool(attendance) and all(a['status'] in {'LEAVE','ABSENT','OTHER_CLASS'} for a in attendance)
            if all_absent or not record['applicable']:
                require(code is None and not record['publicHighlights'], 'Non-attendee received formal grade/highlight')
            if all_absent and record['applicable']:
                absence_count += 1
            if not record['applicable']:
                require(all(a['status']=='NOT_APPLICABLE' for a in attendance), 'Inapplicable attendance not explicit')
        require(len(daily_keys)==case['expected']['dailyRecordCount'], 'Daily record count mismatch')
        homework = {w['id']:w for w in case['homework']}
        for work in homework.values():
            require(work['taskId'] in task_ids, 'Homework task mismatch')
            require(work['presentation']['displayDate'] is None, 'Homework is not implicitly day-bound')
            require(work['presentation']['doesNotChangeBusinessDates'] is True, 'Display changes business dates')
            require(len({r['studentId'] for r in work['results']})==len(students)==len(work['results']), 'Homework roster incomplete/duplicated')
            for result in work['results']:
                require(result['studentId'] in students, 'Homework student mismatch')
                grade = result['gradeCode']; score = result['rawScore']
                if grade is not None:
                    require(work['schemeId'] in schemes and grade in schemes[work['schemeId']], 'Unknown homework grade')
                if score is not None:
                    require(isinstance(score,(int,float)) and not isinstance(score,bool), 'Invalid raw score')
                    require(work['maxScore'] is not None and 0<=score<=work['maxScore'], 'Score outside maximum')
                if result['submission']!='SUBMITTED':
                    require(grade is None and score is None, 'Unsubmitted/inapplicable homework graded')
                if result['state']=='EXTENDED':
                    require(datetime.fromisoformat(result['effectiveDueAt']) > clock, 'Extension sample must remain pending')
        h2 = next(w for w in homework.values() if w['reportLabel']=='H2')
        require(next(r for r in h2['results'] if r['studentId']==prefix+'_STU_002')['rawScore']==0, '0-score case lost')
        observations = {o['id']:o for o in case['lessonObservations']}
        require(not case['personalSupplementSelection'], 'Personal default selection must be empty')
        require(all(o['selectedForReportByDefault'] is False for o in observations.values()), 'Observation auto-selected')
        for test in case['personalReportTests']:
            sid = test['studentId']
            records = [r for r in case['dailyRecords'] if r['studentId']==sid and r['applicable']]
            expected_keys = [sid+'|'+r['taskId']+'|'+r['date'] for r in records]
            expected_lessons = [a['lessonId'] for r in records for a in r['attendance']]
            expected_work = [w['id'] for w in homework.values() if w['presentation']['section']=='RESULTS'
                             and next(r for r in w['results'] if r['studentId']==sid)['requirement']!='NOT_APPLICABLE']
            require(test['expectedApplicableDailyRecordKeys']==expected_keys, 'Personal day coverage mismatch')
            require(test['expectedApplicableLessonIds']==expected_lessons, 'Personal lesson coverage mismatch')
            require(test['expectedApplicableResultHomeworkIds']==expected_work, 'Personal work coverage mismatch')
            require(set(test['templatesToTest'])=={'P01','P02','P03'}, 'Personal template missing from tests')
            for oid in test['selectObservationIdsForThisTest']:
                observation = observations[oid]
                require(observation['studentId']==sid and observation['canExplicitlySelectForPersonalReport'], 'Invalid observation selection')
                require(observation['lessonId'] in expected_lessons, 'Observation not in individual scope')
            require(test['formalGradePerLessonAllowed'] is False, 'Personal test permits per-lesson formal grades')
        raw = json.dumps(case,ensure_ascii=False)
        for marker in case['expected']['privateFieldPrefixesForbiddenInReports']:
            require(marker in raw, f'Privacy negative test marker missing: {marker}')
        case_summaries.append({'case':prefix,'students':len(students),'dailyRecords':len(daily_keys),
                               'lessons':len(lessons),'personalScenarios':len(case['personalReportTests']),
                               'confirmedAbsentDays':absence_count})
    checksums_verified = 0
    if not content_only:
        require((root/'PACKAGE_CHECK_REPORT.md').is_file(), 'Missing actual package-check report')
        checksum_path = root/'CHECKSUMS.sha256'
        require(checksum_path.is_file(), 'Missing CHECKSUMS.sha256')
        manifest_names: set[str] = set()
        for line in checksum_path.read_text(encoding='utf-8').splitlines():
            digest, name = line.split('  ',1)
            path = (root/name).resolve()
            require(path.is_relative_to(root.resolve()) and path.is_file(), 'Unsafe or missing manifest path')
            require(name not in manifest_names, 'Duplicate checksum entry')
            manifest_names.add(name)
            require(hashlib.sha256(path.read_bytes()).hexdigest()==digest, f'Checksum mismatch: {name}')
            checksums_verified += 1
        actual_names = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and p.name!='CHECKSUMS.sha256'}
        require(manifest_names==actual_names, 'Manifest file coverage mismatch')
    return {'status':'PASS_PACKAGE_CHECKS_ONLY','version':'r2.2','productTests':'NOT_RUN',
            'productAcceptanceItems':64,'templateDefinitions':7,'headerExamples':len(headers['classModes']),
            'cases':case_summaries,'checksumsVerified':checksums_verified,
            'scope':'Files, semantic examples and synthetic-fixture consistency only; no v0/browser/export/delivery tests.'}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--content-only',action='store_true',help='Check content before packaging; skip checksum manifest.')
    parser.add_argument('--json',action='store_true',help='Print machine-readable result.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        result = validate(root,args.content_only)
    except (ValidationError,OSError,ValueError,KeyError,TypeError,StopIteration) as exc:
        print(f'PACKAGE CHECK FAILED: {exc}',file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result,ensure_ascii=False,indent=2))
    else:
        print('PASS — r2.2包文件、表头语义与合成数据一致性检查。')
        print('模板定义：7；产品核验项：64（全部NOT_RUN）。')
        for case in result['cases']:
            print(f"{case['case']}: {case['students']}学生 / {case['dailyRecords']}日记录 / {case['lessons']}课次 / {case['personalScenarios']}个人场景")
        print(f"文件摘要核验：{result['checksumsVerified']}项。")
        print('本检查未运行v0、浏览器、PNG导出、投送或权限测试。')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
