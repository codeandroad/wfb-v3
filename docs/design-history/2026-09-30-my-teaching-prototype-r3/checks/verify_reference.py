"""Validate this handoff's files and finite synthetic examples, not any application."""
from __future__ import annotations
from collections import defaultdict
from copy import deepcopy
from datetime import date, datetime
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / 'fixtures/demo_scenario.json').read_text(encoding='utf-8'))
T = {x['id']: x for x in D['tasks']}
S = {x['id']: x for x in D['students']}
C = {x['id']: x for x in D['classes']}
DU = {x['id']: x for x in D['duties']}
P = {x['id']: x for x in D['period_definitions']}
L = {x['id']: x for x in D['lessons']}
CURRENT = next(x for x in D['teachers'] if x['id']=='TEACHER_LYNN')['permitted_task_ids']
checks: list[str] = []


def check(name, predicate):
    predicate()
    checks.append(name)


def label(normative, default, override):
    value = override if override is not None else default
    if value and value['custom_enabled']:
        text = value['text'].strip()
        if not text:
            raise ValueError('请输入自定义分工')
        return text
    return normative or None


def elapsed_groups(data, now_text):
    """Scope to the explicitly permitted fixture tasks and their dated members."""
    now = datetime.fromisoformat(now_text)
    periods = {p['id']:p for p in data['period_definitions']}
    students = {s['id']:s for s in data['students']}
    tasks = {t['id']:t for t in data['tasks']}
    groups = defaultdict(set)
    for l in data['lessons']:
        tid, day = l['task_id'], l['actual_date']
        if tid not in CURRENT or not l['applied'] or l['status']!='EFFECTIVE' or l['is_non_teaching_activity']:
            continue
        if not data['period']['start'] <= day <= data['period']['end_inclusive']:
            continue
        end = datetime.fromisoformat(f"{day}T{periods[l['period_id']]['end']}:00+08:00")
        if end > now:
            continue
        task=tasks[tid]
        if not task['valid_from'] <= day <= task['valid_through']:
            continue
        for sid in task['student_ids']:
            s=students[sid]
            if s['membership_from'] <= day <= s['membership_until']:
                groups[(tid,day,sid)].add(l['id'])
    return groups


def complete(r, applicable):
    return bool(r and r['attendance_confirmed']
                and r['grade_handling'] in {'CONFIRMED','EXPLICIT_EMPTY','NOT_APPLICABLE'}
                and not r.get('pending_conflict')
                and applicable <= set(r['attendance_covered_lesson_ids'])
                and applicable <= set(r['grade_covered_lesson_ids']))


def validate_ids():
    for k in ('tasks','students','classes','duties','lessons','classroom_records','assignments','publications'):
        ids=[x['id'] for x in D[k]]
        assert len(ids)==len(set(ids)), k
    for t in T.values():
        assert t['class_id'] in C and set(t['student_ids'])<=S.keys()
        assert t['duty_id'] is None or DU[t['duty_id']]['class_id']==t['class_id']
        assert not any(k.startswith('expected_') for k in t)
    for l in L.values():
        assert l['task_id'] in T and l['period_id'] in P
    for r in D['classroom_records']:
        assert r['student_id'] in T[r['task_id']]['student_ids']
        assert all(L[x]['task_id']==r['task_id'] and L[x]['actual_date']==r['date'] for x in r['source_lesson_ids'])
        assert set(r['attendance_covered_lesson_ids'])<=set(r['source_lesson_ids'])
        assert set(r['grade_covered_lesson_ids'])<=set(r['source_lesson_ids'])
        assert 'record_confirmed' not in r


def validate_rosters():
    assert CURRENT==D['expected']['visible_task_ids']
    assert [len(T[t]['student_ids']) for t in CURRENT]==[12,16,8,8]
    assert len(set().union(*(set(T[t]['student_ids']) for t in CURRENT)))==24
    assert sum(len(T[t]['student_ids']) for t in CURRENT)==44
    for cid, expected in D['expected']['class_unique_student_counts'].items():
        actual=set().union(*(set(t['student_ids']) for t in T.values() if t['class_id']==cid))
        assert len(actual)==expected
    assert 'TASK_OTHER_M1' not in CURRENT
    assert T['TASK_CS_WHOLE']['duty_id'] is None


def validate_schedule():
    own=[l for l in L.values() if l['task_id'] in CURRENT]
    assert len(own)==10
    assert {l['id'] for l in own if date.fromisoformat(l['actual_date']).weekday()>=5}==set(D['expected']['weekend_lesson_ids'])
    start=date.fromisoformat(D['term']['start'])
    monday=start.toordinal()-start.weekday()
    assert (date.fromisoformat(D['period']['start']).toordinal()-monday)//7+1==5
    for i,a in enumerate(D['lessons']):
        for b in D['lessons'][i+1:]:
            if a['actual_date']!=b['actual_date']: continue
            pa,pb=P[a['period_id']],P[b['period_id']]
            overlap=pa['start']<pb['end'] and pb['start']<pa['end']
            ta,tb=T[a['task_id']],T[b['task_id']]
            shared=(ta['teacher_id']==tb['teacher_id'] or (a['room_id'] is not None and a['room_id']==b['room_id']) or bool(set(ta['student_ids'])&set(tb['student_ids'])))
            assert not(overlap and shared),(a['id'],b['id'])


def validate_counts():
    groups=elapsed_groups(D,D['clock']['now'])
    rows={(r['task_id'],r['date'],r['student_id']):r for r in D['classroom_records']}
    assert len(rows)==len(D['classroom_records'])
    assert set(groups)==set(rows)
    total=done=0
    for tid in CURRENT:
        subset={k:v for k,v in groups.items() if k[0]==tid}
        n=sum(complete(rows.get(k),v) for k,v in subset.items())
        e=D['expected']['per_task'][tid]
        assert (n,len(subset))==(e['elapsed_confirmed'],e['elapsed_total'])
        total+=len(subset);done+=n
    assert (done,total)==(42,56)


def validate_display():
    for item in D['display_test_cases']:
        try:
            result=label(item['normative'],item['default'],item['override'])
        except ValueError as e:
            assert str(e)==item.get('expected_error')
        else:
            assert result==item['expected'] and 'expected_error' not in item
    defaults={(x['teacher_id'],x['task_id']):x for x in D['task_display_preferences']}
    over={(x['teacher_id'],x['lesson_id']):x for x in D['lesson_display_overrides']}
    for lid,expected in D['expected']['lesson_display_labels'].items():
        task=T[L[lid]['task_id']]
        norm=DU[task['duty_id']]['normative_label'] if task['duty_id'] else None
        assert label(norm,defaults.get((task['teacher_id'],task['id'])),over.get((task['teacher_id'],lid)))==expected
    assert label('P1',{'custom_enabled':True,'text':'新默认'},{'custom_enabled':False,'text':'保留'})=='P1'
    assert label('P1',{'custom_enabled':True,'text':'新默认'},None)=='新默认'


def validate_ordinary_cases():
    def ordinary_pending(r):
        return (not r['pending_conflict'] and not r['attendance_confirmed']
                and r['attendance'] in (None,'NORMAL') and r['grade_handling']=='PENDING'
                and all(v=='UNSET' for v in r['field_origins'].values()))
    for c in D['per_student_confirmation_cases']:
        actual={r['id'] for r in D['classroom_records'] if r['task_id']==c['task_id'] and r['student_id']==c['student_id'] and ordinary_pending(r)}
        assert actual==set(c['expected_record_ids']),c['id']


def validate_lesson_variants():
    for v in D['scenario_variants'][:2]:
        changed=D['lessons']+v['add_lessons']
        assert len([l for l in changed if l['task_id'] in CURRENT])==11
        tid=v['add_lessons'][0]['task_id']
        ls=[l for l in changed if l['task_id']==tid]
        days={l['actual_date'] for l in ls}
        if tid=='TASK_CS_WHOLE': assert (len(ls),len(days))==(3,2)
        else: assert (len(ls),len(days))==(5,4)


def validate_midday_coverage():
    d=deepcopy(D)
    v=d['scenario_variants'][0]
    d['lessons']+=v['add_lessons']
    d['period_definitions']+=v['add_period_definitions']
    key=('TASK_CS_WHOLE','2026-09-30','DEMO_STU_19')
    earlier=elapsed_groups(d,'2026-09-30T08:45:00+08:00')[key]
    later=elapsed_groups(d,'2026-09-30T09:31:00+08:00')[key]
    assert earlier=={'LESSON_002'}
    assert later=={'LESSON_002','LESSON_CS_WED_SECOND'}
    r={'attendance_confirmed':True,'grade_handling':'CONFIRMED', 'pending_conflict':False,
       'attendance_covered_lesson_ids':list(earlier),'grade_covered_lesson_ids':list(earlier)}
    assert complete(r,earlier) and not complete(r,later)
    assert set(r['attendance_covered_lesson_ids'])==earlier # passage of time did not alter facts


def validate_leave_assignments_publication():
    for r in D['classroom_records']:
        if r['student_id']=='DEMO_STU_02' and r['date']=='2026-09-28':
            assert r['attendance']=='LEAVE' and r['leave_source_id']=='LEAVE_001'
            assert r['classroom_grade'] is None and r['grade_handling']=='NOT_APPLICABLE'
    for a in D['assignments']:
        assert set(a['recipient_ids'])<=set(T[a['task_id']]['student_ids'])
        ov={r['student_id']:r['requirement'] for r in a.get('requirement_overrides',[])}
        for r in a['results']:
            assert r['student_id'] in a['recipient_ids']
            if r['participation']=='OPTIONAL_NOT_PARTICIPATING':
                assert ov.get(r['student_id'],a['default_requirement'])=='OPTIONAL'
            if r['participation'] in ('EXEMPT','OPTIONAL_NOT_PARTICIPATING'):
                assert r['submission'] is None and r['quality'] is None
    p=D['publications'][0]
    assert set(r['student_id'] for r in p['classroom_snapshot'])==set(p['student_ids'])
    assert p['read_status']=='NOT_AVAILABLE_IN_PROTOTYPE'
    assert not any(r.get('internal_reason') for r in p['classroom_snapshot'])


def validate_navigation():
    for c in D['navigation_reference_cases']:
        if c['case']=='same_task_many_lessons':
            assert {L[l]['task_id'] for l in c['lesson_ids']}=={c['expected_task_id']}
            assert all(D['period']['start']<=L[l]['actual_date']<=D['period']['end_inclusive'] for l in c['lesson_ids'])
            assert c['editor_scope']=='WHOLE_FEEDBACK_PERIOD' and c['source_lesson_is_filter'] is False
        if c['case']=='distinct_p1':
            a,b=[T[t] for t in c['task_ids']]
            assert a['id']!=b['id'] and a['class_id']!=b['class_id']


def validate_documents_and_files():
    for n in ('V0_PROMPT_2026-09-30_r3.md','DESIGN_MY_TEACHING_2026-09-30_r3.md','OWNER_VERIFICATION_2026-09-30_r3.md'):
        txt=(ROOT/n).read_text(encoding='utf-8')
        assert '2026-09-30' in txt and len(txt)>1000
    p=(ROOT/'V0_PROMPT_2026-09-30_r3.md').read_text(encoding='utf-8')
    for phrase in ('r2均未交给v0实施','本周教学安排','连续两节也分开','确认该生常规情况','恢复任务默认','课堂批量**不联动作业**','真实产品实施置后','v0自主决定布局和视觉'):
        assert phrase in p,phrase
    assert '```' not in p # no included visual wireframe/code scaffold
    acceptance=(ROOT/'OWNER_VERIFICATION_2026-09-30_r3.md').read_text(encoding='utf-8')
    rows=[line for line in acceptance.splitlines() if line.startswith('|MT')]
    assert len(rows)==44 and all(line.split('|')[-2].strip()=='NOT_RUN' for line in rows)
    from PIL import Image
    pngs=list((ROOT/'references').glob('*.png'))
    assert len(pngs)==5
    for f in pngs:
        with Image.open(f) as im: im.verify()
    assert not any('CODEX_PROMPT' in f.name for f in ROOT.rglob('*') if f.is_file())


if __name__=='__main__':
    groups=[
        ('合成ID、任务/分工/名单、记录来源与确认coverage引用',validate_ids),
        ('本人任务12/16/8/8、去重24及班级12/20/12',validate_rosters),
        ('真实课节时间、周末、周号与基线资源冲突',validate_schedule),
        ('从发生范围与字段确认计算42/56，不读取预写统计',validate_counts),
        ('默认/覆盖/显式关闭/恢复与空值显示用例',validate_display),
        ('逐生常规候选及手工/空白/请假保护示例',validate_ordinary_cases),
        ('连堂及非连续课次分开、日粒度保持',validate_lesson_variants),
        ('部分当天的来源覆盖不因时间推进自动扩展',validate_midday_coverage),
        ('请假映射、独立作业参与和旧发布示例',validate_leave_assignments_publication),
        ('同任务多课卡整周导航的引用关系',validate_navigation),
        ('文档文件、44项NOT_RUN及参考图可读性',validate_documents_and_files)]
    for n,f in groups: check(n,f)
    report=['# 本包材料与有限示例核对', '', '执行日期：2026-09-30。以下仅运行本目录参考检查，不运行用户原型或产品。', '']
    report += ['- PASS：'+s for s in checks]
    report += ['', '这些结果仅证明本包的有限示例/字段引用和文档存在性，不证明当前代码、所有规则或所有时序正确。',
               '准备阶段曾因核验脚本要求Markdown表格分隔符两侧空格而误判；已改为按列解析状态并完整重跑。该修正不是用户原型缺陷修复。',
               'NOT_RUN：v0浏览器运行、实际路由、自动保存/恢复、并发与权限、上传解析、发布、图片生成以及拖拽。',
               '本次没有修改用户当前原型源码、产品源码、接口或数据库，也没有生成实际业务图片。',
               '复核：在本包目录执行 `python checks/verify_reference.py`。']
    (ROOT/'checks/REFERENCE_CHECK_RESULT.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    print(f'{len(checks)} limited material/reference checks passed; prototype tests NOT_RUN.')
