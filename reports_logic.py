import re
import json
import datetime
import os  
import pandas as pd

from utils import (
    load_merged_db, 
    find_col, 
    get_val_smart, 
    is_required_course, 
    get_db_dataframe, 
    normalize_headers_with_alias,
    is_elective_course
)
from config import (
    REPORT_TEMPLATES, 
    normalize_title, 
    COLUMN_ALIAS, 
    UPLOAD_DIR, 
    schema_manager
)

# ==========================================
# ★★★ 필수이수 교과목 커스텀 정렬 로직 ★★★
# ==========================================
REQUIRED_COURSES_ORDER = [
    "보건의료정보관리학", "보건의료정보관리실무", "보건의료조직관리", "건강정보보호",
    "질병및의료행위분류1", "의무기록정보분석실무", "의무기록정보질향상실무", "암등록",
    "의료의질관리", "건강보험이론및실무", "보건의료통계", "보건의료데이터관리",
    "의료정보기술", "의료관계법규", "의학용어(1)", "의학용어(2)", "병리학개론",
    "해부생리학", "현장실습"
]

def get_req_course_order(course_name):
    """과목명이 들어오면 리스트에서의 순위(숫자)를 반환합니다."""
    if not course_name: return 999
    cname = str(course_name).replace(" ", "")
    for idx, name in enumerate(REQUIRED_COURSES_ORDER):
        if name.replace(" ", "") in cname:
            return idx
    return 999

# ==========================================
# ★★★ 선택이수 교과목 커스텀 정렬 로직 ★★★
# ==========================================
ELECTIVE_COURSES_ORDER = [
    "공중보건학개론", "보건행정학", "역학", "질병및의료행위분류2", "의무기록전사"
]

def get_elec_course_order(course_name):
    if not course_name: return 999
    cname = str(course_name).replace(" ", "")
    for idx, name in enumerate(ELECTIVE_COURSES_ORDER):
        if name.replace(" ", "") in cname:
            return idx
    return 999

# ==========================================
# ★★★ [커스텀 로직] 1.3.1-1 전용 (날짜 범위 비교 수정판) ★★★
# ==========================================
def fetch_custom_1_3_1_1():
    report_title = "[표 1.3.1-1] 프로그램 책임자 현황"
    
    # [체크] 만약 '교수인적사항 자체변형' DB를 사용 중이라면 아래 이름을 변경하세요.
    db_name = "교수인적사항" 
    # db_name = "교수인적사항 자체변형" 

    target_years = [2023, 2024, 2025, 2026] 
    clean_title = normalize_title(report_title)
    template_headers = REPORT_TEMPLATES.get(clean_title)

    df, err = get_db_dataframe(db_name)
    if df is None: return {"headers": template_headers or [], "rows": [], "message": err}

    df = a(df)

    # 프로그램 책임자 필터링 (O 표시된 사람만)
    prog_col = 'is_prog_head' if 'is_prog_head' in df.columns else '프로그램 책임 여부'
    if prog_col in df.columns:
        df = df[df[prog_col].astype(str).str.upper().str.strip() == 'O']

    target_col_name = "프로그램 책임자 발령기간(년.월.일 ~ 년.월.일)" 
    if template_headers:
        for h in template_headers:
            if "발령기간" in h: target_col_name = h; break

    # 날짜 파싱 헬퍼 (YYYY.MM.DD 변환)
    def parse_date(val, is_end=False):
        s = str(val).strip().replace('-', '.').replace('/', '.')
        if not s or s.lower() == 'nan':
            # 종료일이 없으면 '현재'로 간주 -> 아주 먼 미래로 설정
            return datetime.datetime(9999, 12, 31) if is_end else None
        
        parts = s.split('.')
        try:
            y = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 1
            d = int(parts[2]) if len(parts) > 2 else 1
            return datetime.datetime(y, m, d)
        except:
            return None

    # 출력용 문자열 포맷팅
    def format_date_str(val):
        s = str(val).strip().replace('-', '.').replace('/', '.')
        parts = s.split('.')
        if len(parts) == 3: 
            return f"{parts[0]}.{parts[1].zfill(2)}.{parts[2].zfill(2)}"
        return s

    year_map = {y: [] for y in target_years}

    for _, row in df.iterrows():
        s_val = row.get('ph_start_date') or row.get('프로그램 책임 임용일') or row.get('임용일자', '')
        e_val = row.get('ph_end_date') or row.get('프로그램 책임 종료일') or row.get('퇴사일', '')

        dt_start = parse_date(s_val)
        dt_end = parse_date(e_val, is_end=True)
        
        # 날짜 정보가 유효할 때만 계산
        if dt_start and dt_end:
            period_str = f"{format_date_str(s_val)} ~ {format_date_str(e_val)}"
            
            # [핵심 로직 변경] 단순 연도 비교 -> 학년도 기간 겹침 확인
            for year in target_years:
                # 해당 학년도: Year.03.01 ~ (Year+1).02.28 (사실상 3월 1일 전까지)
                school_year_start = datetime.datetime(year, 3, 1)
                school_year_end_limit = datetime.datetime(year + 1, 3, 1) # 다음 해 3월 1일 '미만'

                # 교수의 재직 기간과 학년도 기간이 조금이라도 겹치면 포함
                # 조건: (교수임기종료 >= 학기시작) AND (교수임기시작 < 다음학기시작)
                if dt_end >= school_year_start and dt_start < school_year_end_limit:
                    row_data = row.to_dict()
                    row_data[target_col_name] = period_str
                    year_map[year].append(row_data)

    # 결과 조립
    result_rows = []
    for year in target_years:
        professors = year_map.get(year, [])
        if not professors:
            empty_row = {h: "" for h in template_headers} if template_headers else {}
            empty_row["연도"] = str(year)
            result_rows.append(empty_row)
        else:
            for prof_data in professors:
                final_row = {}
                if template_headers:
                    for header in template_headers:
                        if header == "연도": 
                            final_row[header] = str(year)
                        elif header == target_col_name and header in prof_data:
                            final_row[header] = prof_data[header]
                        elif header in prof_data:
                            final_row[header] = prof_data[header]
                        else:
                            found_val = ""
                            aliases = COLUMN_ALIAS.get(header, [])
                            for alias in aliases:
                                if alias in prof_data: found_val = prof_data[alias]; break
                            final_row[header] = found_val
                else: 
                    final_row = prof_data
                result_rows.append(final_row)
                
    return {"headers": template_headers, "rows": result_rows}

# ==========================================
# ★★★ [커스텀 로직] 1.3.2-1 전용 (0.0개월 완전 제외 + 그룹화) ★★★
# ==========================================
def fetch_custom_1_3_2_1():
    report_title = "[표 1.3.2-1] 운영지원 인력 현황"
    clean_title = normalize_title(report_title)
    template_headers = REPORT_TEMPLATES.get(clean_title)
    
    # 1. 평가 기간 정의
    PERIODS = {
        2023: {"start": datetime.datetime(2023, 9, 1), "end": datetime.datetime(2024, 2, 29), "base": 6},
        2024: {"start": datetime.datetime(2024, 3, 1), "end": datetime.datetime(2025, 2, 28), "base": 12},
        2025: {"start": datetime.datetime(2025, 3, 1), "end": datetime.datetime(2025, 8, 31), "base": 6},
        2026: {"start": datetime.datetime(2025, 9, 1), "end": datetime.datetime(2026, 2, 28), "base": 6},
    }
    target_years = sorted(PERIODS.keys())
    
    # 2. 학생 수 계산
    student_counts = {y: 0 for y in target_years}
    student_db_name = "학생"
    if os.path.exists(UPLOAD_DIR):
        for d in os.listdir(UPLOAD_DIR):
            if "학생" in d: student_db_name = d; break     
    df_student, _ = get_db_dataframe(student_db_name)
    if df_student is not None and '연도' in df_student.columns:
        counts = df_student['연도'].value_counts().to_dict()
        for y_str, count in counts.items():
            try:
                y_int = int(str(y_str).split('.')[0])
                if y_int in student_counts: student_counts[y_int] = count
            except: pass

    # 3. 운영지원 인력 데이터 로드
    target_staff_db_folder = None
    if os.path.exists(UPLOAD_DIR):
        for d in os.listdir(UPLOAD_DIR):
            if "운영" in d and "지원" in d:
                target_staff_db_folder = d; break
    
    if not target_staff_db_folder:
        return {"headers": template_headers or [], "rows": [], "message": "운영지원인력 DB 폴더를 찾을 수 없습니다."}

    df_staff, err = get_db_dataframe(target_staff_db_folder)
    if df_staff is None:
        return {"headers": template_headers or [], "rows": [], "message": err}
    
    # 스키마 매핑
    schema_db_name = next((k for k in schema_manager.get_db_list() if "운영" in k and "지원" in k), None)
    
    col_start = None; col_end = None; col_name = None; col_pos = None; col_rate = None
    if schema_db_name:
        staff_columns = schema_manager.get_columns(schema_db_name)
        label_map = {col['label'].strip(): col['name'].strip() for col in staff_columns}
        for label, var_name in label_map.items():
            if "시작일" in label or "발령일" in label: col_start = var_name
            if "종료일" in label or "퇴사일" in label: col_end = var_name
            if "성명" in label and not col_name: col_name = var_name
            if ("직급" in label or "직위" in label) and not col_pos: col_pos = var_name
            if "참여율" in label: col_rate = var_name
            
    # Safety Net
    if not col_start: col_start = next((c for c in df_staff.columns if c in ["start_date", "appoint_date", "hire_date"]), None)
    if not col_end: col_end = next((c for c in df_staff.columns if c in ["end_date", "retire_date"]), None)

    if not col_start: return {"headers": template_headers, "rows": [], "message": "시작일 컬럼을 찾을 수 없습니다."}

    year_rows = {y: [] for y in target_years}
    
    def to_dt(val, is_end=False):
        s = str(val).strip().replace('/', '.').replace('-', '.')
        if not s or s.lower() == 'nan' or '재직' in s or '현재' in s or 'null' in s.lower():
            return datetime.datetime(9999, 12, 31) if is_end else None
        parts = s.split('.')
        try:
            if len(parts) >= 3: return datetime.datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            elif len(parts) == 2: return datetime.datetime(int(parts[0]), int(parts[1]), 1)
        except: return None
        return None

    # 4. 데이터 계산
    for idx, row in df_staff.iterrows():
        s_val = row.get(col_start, '')
        e_val = row.get(col_end, '') if col_end else ''
        
        dt_start = to_dt(s_val)
        dt_end = to_dt(e_val, is_end=True)
        
        name_val = row.get(col_name, "") if col_name else ""
        pos_val = row.get(col_pos, "") if col_pos else ""
        
        user_rate = 100.0
        if col_rate and col_rate in row:
            try:
                val = str(row[col_rate]).replace('%', '').strip()
                if val and val.lower() != 'nan': user_rate = float(val)
            except: pass

        if dt_start and dt_end:
            for year, period in PERIODS.items():
                p_start = period["start"]
                p_end = period["end"]
                base_months = period["base"]
                
                if dt_start <= p_end and dt_end >= p_start:
                    overlap_start = max(dt_start, p_start)
                    overlap_end = min(dt_end, p_end)
                    days_worked = (overlap_end - overlap_start).days + 1
                    
                    months_worked = min(days_worked / 30.4, base_months)
                    months_worked = max(0, months_worked)
                    
                    # [중요 수정] 반올림 했을 때 0.0이면 과감히 제외 (1일 근무 등 미미한 경우 제외)
                    final_months = round(months_worked, 1)

                    if final_months > 0:
                        real_support = (months_worked / base_months) * (user_rate / 100.0)
                        is_at_end = (dt_start <= p_end and dt_end >= p_end)
                        
                        row_data = row.to_dict()
                        row_data['성명'] = name_val
                        row_data['직급'] = pos_val
                        # 임시 저장
                        row_data['__months'] = final_months
                        row_data['__rate'] = user_rate
                        row_data['__real'] = round(real_support, 2)
                        row_data['__is_at_end'] = is_at_end
                        
                        year_rows[year].append(row_data)

    # 5. 최종 결과 조립 및 "병합 효과" (Top Alignment)
    result_rows = []
    
    # 템플릿 매핑 함수
    def map_to_template(target_dict, source_data, template_cols):
        if not template_cols: return source_data
        new_row = {}
        for h in template_cols:
            if h in target_dict: new_row[h] = target_dict[h]
            elif h in source_data: new_row[h] = source_data[h]
            else:
                found = ""
                aliases = COLUMN_ALIAS.get(h, [])
                for k, v in source_data.items():
                    if k in aliases: found = v; break
                new_row[h] = found
        return new_row

    for year in target_years:
        staff_list = year_rows.get(year, [])
        total_unique_count = len(staff_list)
        subtotal_end_count = sum(1 for s in staff_list if s.get('__is_at_end'))
        
        secure_rate = 0
        if student_counts[year] > 0:
            secure_rate = (subtotal_end_count / student_counts[year]) * 100
        
        if not staff_list:
            # 데이터 없음 (빈 줄 1개)
            empty_row = {
                '연도': str(year),
                '편제정원(명)': student_counts[year],
                '운영지원 인원(명)': 0,
                '연간 소계(명)': 0,
                '확보율(%)': 0
            }
            final_row = map_to_template(empty_row, {}, template_headers)
            result_rows.append(final_row)
        else:
            for idx, staff in enumerate(staff_list):
                staff['근무기간(개월), A'] = staff['__months']
                staff['업무 참여율(%), B'] = staff['__rate']
                staff['실 지원 인력(명), A/12 X B/100'] = staff['__real']
                
                # [병합 효과] 첫 번째 행에만 통계값 표시, 나머지는 빈칸
                if idx == 0:
                    staff['연도'] = str(year)
                    staff['편제정원(명)'] = student_counts[year]
                    staff['운영지원 인원(명)'] = total_unique_count
                    staff['연간 소계(명)'] = subtotal_end_count
                    staff['확보율(%)'] = round(secure_rate, 1)
                else:
                    staff['연도'] = ""
                    staff['편제정원(명)'] = ""
                    staff['운영지원 인원(명)'] = ""
                    staff['연간 소계(명)'] = ""
                    staff['확보율(%)'] = ""

                final_row = map_to_template(staff, staff, template_headers)
                
                # 임시 키 삭제
                for k in ['__months', '__rate', '__real', '__is_at_end']:
                    if k in final_row: del final_row[k]
                    
                result_rows.append(final_row)
                
    return {"headers": template_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 1.3.3-1] 프로그램 책임자 및 보건의료정보관리사 교수의 프로그램 운영 의사결정 참여 실적  ★★★
# ==========================================
def fetch_custom_1_3_3_1():
    exact_headers = ["연도", "일정", "참석자 명단", "주체", "내용", "프로그램 책임자", "보건의료정보관리사 교수"]
    
    df = load_merged_db("회의록")
    
    if df is None or df.empty:
        return {"headers": exact_headers, "rows": [], "message": "회의록 데이터가 없습니다."}

    year_col = find_col(df, ['연도', '년도', '학년도', 'year'])
    date_col = find_col(df, ['일정', '일시', '회의 일정', '회의일정', '회의일시', 'date'])
    attendee_col = find_col(df, ['참석자', '참석자 명단', '회의 참석자', '회의 참석자 명단', '참여인원', 'attendees'])
    subject_col = find_col(df, ['주체', '회의주체', '회의명', '구분', 'subject'])
    content_col = find_col(df, ['내용', '회의내용', '안건', '주요내용', 'content'])
    place_col = find_col(df, ['장소', '회의장소', 'place'])
        
    # ★ 딕셔너리를 사용하여 중복 시 최신 데이터로 덮어쓰기
    meetings_dict = {}
    
    for _, row in df.iterrows():
        year_val = str(row.get(year_col, "")).strip() if year_col else str(get_val_smart(row, "연도") or "").strip()
        if not year_val or year_val.lower() == 'nan': 
            continue
        if '.' in year_val:
            year_val = year_val.split('.')[0]
            
        subject_raw = str(row.get(subject_col, "")).strip() if subject_col else str(get_val_smart(row, "주체") or "").strip()
        subject_clean = subject_raw.replace("회의록", "").strip()
        
        schedule = str(row.get(date_col, "")).strip() if date_col else str(get_val_smart(row, "회의 일정") or "").strip()
        
        # 고유 키 (연도 + 주체 + 일정)
        unique_key = f"{year_val}_{subject_clean}_{schedule}"

        content_raw = str(row.get(content_col, "")).strip() if content_col else str(get_val_smart(row, "내용") or "").strip()
        content_val = content_raw
        try:
            if content_raw.startswith("{"):
                parsed = json.loads(content_raw)
                if isinstance(parsed, dict):
                    if parsed.get("isSpecial"):
                        content_val = parsed.get("topContent", content_raw)
                    else:
                        content_val = parsed.get("내용", parsed.get("content", content_raw))
        except Exception:
            pass
            
        attendees_raw = str(row.get(attendee_col, "")).strip() if attendee_col else str(get_val_smart(row, "회의 참석자 명단") or "").strip()
        att_list = [a.strip() for a in attendees_raw.split(',') if a.strip()]
        masked = []
        for a in att_list:
            if len(a) >= 3:
                masked.append(a[0] + 'O' * (len(a)-2) + a[-1])
            elif len(a) == 2:
                masked.append(a[0] + 'O')
            else:
                masked.append(a)
        
        location = str(row.get(place_col, "")).strip() if place_col else str(row.get("장소", "") or "").strip()
        
        # ★ 고유 키를 바탕으로 딕셔너리에 계속 덮어씌웁니다 (가장 마지막 수정본이 남음)
        meetings_dict[unique_key] = {
            "연도": year_val,
            "일정": schedule,
            "장소": location, 
            "참석자 명단": ", ".join(masked),
            "주체": subject_clean,
            "내용": content_val,
            "프로그램 책임자": "", 
            "보건의료정보관리사 교수": "",
            "_row_key": unique_key 
        }
        
    # 결과 리스트로 변환 후 최신 일정 순으로 정렬
    result_rows = list(meetings_dict.values())
    result_rows.sort(key=lambda x: (x["연도"], x["일정"]), reverse=True)
    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.2-X] 이수영역별 교육과정표 (이수영역 병합 / 상세구분 채우기) ★★★
# ==========================================
def fetch_curriculum_tables(report_id):
    # 1. 연도 추출
    try:
        target_year = re.search(r'(\d{4})', report_id).group(1)
    except:
        return {"headers": [], "rows": [], "message": f"보고서 제목에서 연도를 찾을 수 없습니다: {report_id}"}
    
    headers = ["이수영역", "상세구분", "교과목명", "학점(이론-실습)", "개설학년-학기", "비고"]
    print(f"\n🔍 [진단] {report_id} 분석 시작 (타겟 연도: {target_year})")

    # 2. DB 로드
    df = load_merged_db("교과목")
    if df is None: 
        print("❌ [오류] '교과목' DB 파일을 찾을 수 없습니다.")
        return {"headers": headers, "rows": [], "message": "데이터 없음"}
    
    # 3. 연도 컬럼 식별 및 필터링 (가장 빈번한 오류 지점)
    year_col = find_col(df, ['curr_year', '구분', '연도', '학년도', 'year'])
    if not year_col:
        print(f"❌ [오류] 연도 컬럼을 찾을 수 없습니다. 현재 컬럼들: {df.columns.tolist()}")
        return {"headers": headers, "rows": [], "message": "연도 컬럼 미식별"}

    # 소수점 데이터(2023.0 등) 방어 및 필터링
    df[year_col] = df[year_col].astype(str).str.replace(".0", "", regex=False)
    df_year = df[df[year_col].str.contains(target_year, na=False)]
    
    print(f"📂 DB 로드 완료: 총 {len(df)}행 / {target_year}년 데이터 {len(df_year)}행 발견")

    if df_year.empty:
        print(f"⚠️ [경고] {target_year}에 해당하는 데이터가 0건입니다. DB의 연도 형식을 확인하세요.")
        return {"headers": headers, "rows": [], "message": f"{target_year}학년도 데이터 없음"}

    # 4. 데이터 가공
    temp_list = []
    for idx, row in df_year.iterrows():
        # 데이터 유실 방지: get_val_smart 실패 시 대체 컬럼 탐색
        school_type_val = get_val_smart(row, "school_type") or get_val_smart(row, "area_1") 
        subject_name = get_val_smart(row, "교과목명")
        sem_val = get_val_smart(row, "open_sem")
        
        # 학점 데이터 방어 로직 (비어있거나 문자인 경우 0으로 치환)
        def safe_int(val):
            try: return int(float(str(val).strip()))
            except: return 0

        t_val = row.get("theory_cred", 0) # COLUMN_ALIAS 연동 안될 경우 직접 참조 시도
        p_val = row.get("prac_cred", 0)
        
        # 만약 get_val_smart가 빈칸을 뱉는다면 로그 출력
        if not subject_name and idx == df_year.index[0]:
            print(f"⚠️ [주의] 첫 번째 행의 과목명이 비어있습니다. COLUMN_ALIAS 설정을 확인하세요. (현재 행: {row.to_dict()})")

        t_num = safe_int(t_val if t_val != "" else 0)
        p_num = safe_int(p_val if p_val != "" else 0)
        total_cred = t_num + p_num
        credit_str = f"{total_cred} ({t_num}-{p_num})"

        # ----------------------------------------------------
        # ★ 신규 '이수영역' 및 '상세구분' 분류 로직 적용
        # ----------------------------------------------------
        domain = "기타"
        detail = str(school_type_val).strip()
        sort_order = 99

        check_type = detail.replace(" ", "")
        check_name = str(subject_name).replace(" ", "")

        if check_type in ['교기', '교필', '교선']:
            domain = "교양"
            if check_type == '교기':
                detail = "기본교양"
                sort_order = 11
            elif check_type == '교필':
                detail = "교양필수"
                sort_order = 12
            elif check_type == '교선':
                detail = "교양선택"
                sort_order = 13
                
        elif check_type in ['전선', '전필']:
            domain = "전공"
            # 우선순위 1: 전공이면서 과목명이 '현장실습'인 경우
            if "현장실습" in check_name:
                detail = "전공실습"
                sort_order = 23
            # 우선순위 2: 실습학점(p_num) 유무에 따라 실기/이론 구분
            elif p_num > 0:
                detail = "실기"
                sort_order = 22
            else:
                detail = "이론"
                sort_order = 21

        temp_list.append({
            "sort": sort_order, "domain": domain, "detail": detail,
            "name": subject_name, "credit": credit_str, "sem": sem_val
        })

    # ==========================================
    # ★ 신규 추가: 완벽한 중복 교과목 제거 방어 로직
    # ==========================================
    unique_list = []
    seen = set()
    for item in temp_list:
        # '교과목명'과 '개설학년-학기'가 완전히 동일한 경우 하나만 통과시킴
        identifier = (item['name'], item['sem'])
        if identifier not in seen:
            seen.add(identifier)
            unique_list.append(item)
            
    temp_list = unique_list # 중복이 제거된 깔끔한 리스트로 교체
    # ==========================================

    # 5. 정렬 및 결과 조립
    # 1차 정렬(sort_order: 이수영역/상세구분), 2차 정렬(개설학년-학기), 3차 정렬(교과목명)
    temp_list.sort(key=lambda x: (x['sort'], str(x['sem']), str(x['name'])))
    
    result_rows = []
    prev_domain = None
    for item in temp_list:
        # 이수영역이 이전 행과 같으면 빈칸 처리 (병합 효과)
        display_domain = item['domain'] if item['domain'] != prev_domain else ""
        result_rows.append({
            "이수영역": display_domain,
            "상세구분": item['detail'],
            "교과목명": item['name'],
            "학점(이론-실습)": item['credit'],
            "개설학년-학기": item['sem'],
            "비고": ""
        })
        prev_domain = item['domain']

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.2.2-1] ~ [표 2.2.2-3]교육과정 선-후수 체계 (통합/연도 자동인식) ★★★
# ==========================================
def fetch_custom_pre_post_system(report_id=None):
    # 1. 학년도 추출
    target_year = None
    if report_id:
        match = re.search(r'(\d{4})', report_id)
        if match:
            target_year = int(match.group(1))

    # 2. 헤더 고정
    final_headers = [
        "학년", "학기", "교과목명", "▶", "필수", 
        "학년" + "\u200B", "학기" + "\u200B", "교과목명" + "\u200B"
    ]

    # 3. 도구 함수로 DB 로드 (복잡한 os.walk/concat 대체)
    df, err = get_db_dataframe("교과목")
    if df is None: 
        # [수정] template_headers 대신 final_headers 사용
        return {"headers": final_headers, "rows": [], "message": err}
    
    # 이제 df는 순수한 데이터프레임이므로 아래 함수가 정상 작동합니다.
    df = normalize_headers_with_alias(df)

    # 4. 도구 함수로 컬럼 식별
    year_col = find_col(df, ['구분', '연도', '학년도', 'year', 'curr_year'])
    name_col = find_col(df, ["교과목명", "과목명", "course_name", "subject_name"])
    sem_col = find_col(df, ["개설학년-학기", "open_sem", "year_sem", "개설"])

    # 5. 연도 필터링
    if target_year and year_col:
        df = df[df[year_col].astype(str).str.contains(str(target_year))]

    # 6. 데이터 파싱
    subject_map = {} 
    def parse_num(val):
        nums = re.findall(r'\d+', str(val))
        return int(nums[0]) if nums else 0

    for _, row in df.iterrows():
        # get_val_smart 사용
        name_raw = get_val_smart(row, "교과목명")
        if not name_raw: continue

        sem_raw = str(row.get(sem_col, "")).strip()
        nums = re.findall(r'\d+', sem_raw)
        g_val = nums[0] if len(nums) >= 1 else ""
        s_val = nums[1] if len(nums) >= 2 else ("1" if len(nums) == 1 else "")

        key = name_raw.replace(" ", "")
        score = (1 if g_val else 0) + (1 if s_val else 0)

        if key not in subject_map or score > subject_map[key]['score']:
            subject_map[key] = {
                "name": name_raw,
                "grade": g_val,
                "semester": s_val,
                "score": score,
                "grade_num": parse_num(g_val),
                "sem_num": parse_num(s_val)
            }

    # 7. 통합 과목 & 특수 처리
    SPECIAL_CASES = {
        "의학용어": {"name": "의학용어", "grade": "1", "semester": "1, 2", "grade_num": 1, "sem_num": 1},
        "질병및의료행위분류": {"name": "질병및의료행위분류", "grade": "3", "semester": "1, 2", "grade_num": 3, "sem_num": 1}
    }

    if target_year and target_year >= 2024:
        SPECIAL_CASES["병리학"] = {
            "name": "병리학개론", "grade": "2", "semester": "1", "grade_num": 2, "sem_num": 1
        }
    
    # 8. 규칙 정의
    rules = [
        (["의학용어", "병리학", "해부생리학"], ["질병및의료행위분류", "의무기록정보분석실무", "의무기록정보질향상실무", "암등록", "건강보험이론및실무"]),
        (["질병및의료행위분류"], ["의무기록정보질향상실무"]),
        (["보건의료정보관리학"], ["보건의료정보관리실무"])
    ]

    def get_subjects_info(keyword):
        if keyword in SPECIAL_CASES: return [SPECIAL_CASES[keyword]]
        return [info for key, info in subject_map.items() if keyword in key and not any(sp in info['name'] for sp in SPECIAL_CASES)]

    # 9. 결과 데이터 생성
    result_rows = []
    seen_pairs = set()

    for pre_keywords, post_keywords in rules:
        for pre_k in pre_keywords:
            for post_k in post_keywords:
                for pre in get_subjects_info(pre_k):
                    for post in get_subjects_info(post_k):
                        pair_key = (pre['name'], post['name'])
                        if pair_key in seen_pairs: continue
                        seen_pairs.add(pair_key)

                        result_rows.append({
                            "학년": pre['grade'], "학기": pre['semester'], "교과목명": pre['name'],
                            "▶": "▶", "필수": "필수",
                            "학년" + "\u200B": post['grade'], 
                            "학기" + "\u200B": post['semester'], 
                            "교과목명" + "\u200B": post['name']
                        })

    return {"headers": final_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.2.2-5] 프로그램 교육과정 이수체계 준수 실적 (헤더 이름 수정) ★★★
# ==========================================
def fetch_custom_2_2_2_5(report_id=None):
    # 1. 보고서 양식 준비
    template_headers = [
        "연도", "학년도", "후수 교과목명", "전체 학생 수", 
        "프로그램 소속 학생 수", "선수과목 이수학생 수", 
        "선수과목 미이수자 중 승인 학생 수", 
        "선수과목 미이수자 중 미승인 학생 수", "이수체계 준수율(%)"
    ]

    # 2. 대상 교과목 리스트 및 클리닝
    TARGET_SUBJECTS = [
        '질병및의료행위분류1', '질병및의료행위분류2', '의무기록정보분석실무',
        '의무기록정보질향상실무', '암등록', '건강보험이론및실무', '보건의료정보관리학'
    ]
    target_subs_clean = {s.replace(" ", ""): s for s in TARGET_SUBJECTS}

    # 3. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": template_headers, "rows": [], "message": "교과목 DB를 찾을 수 없습니다."}

    name_col = find_col(df, ['교과목명', '과목명', 'course_name'])
    sem_col = find_col(df, ['개설학년', '학년-학기', 'open_sem', '학기', '학년'])

    if not name_col or not sem_col:
        return {"headers": template_headers, "rows": [], "message": "필수 컬럼을 찾을 수 없습니다."}

    # 4. 과목별 '개설학년' 추출
    subject_grade_map = {}
    for _, row in df.iterrows():
        sub_name = str(row.get(name_col, '')).strip().replace(" ", "")
        sem_val = str(row.get(sem_col, '')).strip()
        
        if sub_name in target_subs_clean:
            match = re.search(r'(\d+)', sem_val)
            if match:
                subject_grade_map[sub_name] = int(match.group(1))

    # 5. 연도별 스케줄 생성 (YEAR_RULES 적용)
    result_rows = []
    YEAR_RULES = {
        2023: [2022, 2023],
        2024: [2022, 2023, 2024],
        2025: [2022, 2023, 2024, 2025],
        2026: [2023, 2024, 2025, 2026]
    }

    for year in sorted(YEAR_RULES.keys()):
        for adm_year in YEAR_RULES[year]:
            calculated_grade = year - adm_year + 1
            
            # 해당 학년에 맞는 과목 필터링 및 정렬
            found_subjects = [
                target_subs_clean[name] 
                for name, grade in subject_grade_map.items() 
                if grade == calculated_grade
            ]
            
            # 지정된 순서대로 결과 행 추가
            sorted_subs = [s for s in TARGET_SUBJECTS if s in found_subjects]
            for sub_name in sorted_subs:
                new_row = {h: "" for h in template_headers}
                new_row["연도"] = str(year)
                new_row["학년도"] = str(adm_year)
                new_row["후수 교과목명"] = sub_name
                result_rows.append(new_row)

    return {"headers": template_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.3.1-1] 2023학년도~2025학년도 필수이수 교과목 편성표 ★★★
# ==========================================
def fetch_custom_2_3_1_1():
    exact_headers = ["교과목명", "2023학년도 개설학년/학기", "2023학년도 학점", "2023학년도 실습 여부", 
                     "2024학년도 개설학년/학기", "2024학년도 학점", "2024학년도 실습 여부", 
                     "2025학년도 개설학년/학기", "2025학년도 학점", "2025학년도 실습 여부", "변경 내용"]
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    target_years = ['2023', '2024', '2025']
    subject_map = {}
    for _, row in df.iterrows():
        if not is_required_course(row): continue 
        
        # 이제 "연도" 키로 "구분" 컬럼의 데이터를 정확히 가져옵니다.
        year_val = get_val_smart(row, "연도") 
        year_raw = str(year_val).split('.')[0]
        matched_year = next((ty for ty in target_years if ty in year_raw), None)
        
        if matched_year:
            name_val = get_val_smart(row, "교과목명")
            if name_val:
                # 학점 추출 시 ALIAS에 추가한 '학점구성-소계' 등을 활용
                t_val = int(float(get_val_smart(row, "theory_cred") or 0))
                p_val = int(float(get_val_smart(row, "prac_cred") or 0))
                tot_val = int(float(get_val_smart(row, "total_cred") or (t_val + p_val)))
                
                if name_val not in subject_map:
                    subject_map[name_val] = {h: "" for h in exact_headers}
                    subject_map[name_val]["교과목명"] = name_val
                
                subject_map[name_val][f"{matched_year}학년도 개설학년/학기"] = get_val_smart(row, "open_sem")
                subject_map[name_val][f"{matched_year}학년도 학점"] = str(tot_val) if tot_val > 0 else ""
                subject_map[name_val][f"{matched_year}학년도 실습 여부"] = "O" if p_val > 0 else ""
                
    return {"headers": exact_headers, "rows": sorted(list(subject_map.values()), key=lambda x: get_req_course_order(x["교과목명"])) or [{h: "" for h in exact_headers}]}

# ==========================================
# [표 2.3.1-2] 2026학년도 필수이수 교과목 편성표
# ==========================================
def fetch_custom_2_3_1_2():
    # 1. 헤더 고정
    exact_headers = ["교과목명", "2026학년도 개설학년/학기", "2026학년도 학점", "2026학년도 실습 여부", "변경 내용"]

    # 2. 도구 함수로 DB 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}

    # 3. 데이터 가공
    subject_map = {}
    for _, row in df.iterrows():
        # ★ 우리가 만든 똑똑한 판별기 사용 (전필, 교필 등 모두 인식)
        if not is_required_course(row):
            continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = str(get_val_smart(row, "연도")).split('.')[0]
        
        # 2026년도 데이터만 처리
        if '2026' in year_raw and name_val:
            # 학점 계산 로직 (이론 + 실습)
            t_val = int(float(get_val_smart(row, "theory_cred") or 0))
            p_val = int(float(get_val_smart(row, "prac_cred") or 0))
            tot_val = int(float(get_val_smart(row, "total_cred") or (t_val + p_val)))

            if name_val not in subject_map:
                subject_map[name_val] = {h: "" for h in exact_headers}
                subject_map[name_val]["교과목명"] = name_val

            # 데이터 주입
            subject_map[name_val]["2026학년도 개설학년/학기"] = get_val_smart(row, "open_sem")
            subject_map[name_val]["2026학년도 학점"] = str(tot_val) if tot_val > 0 else ""
            subject_map[name_val]["2026학년도 실습 여부"] = "O" if p_val > 0 else ""

    # 4. 결과 조립 및 정렬
    result_rows = sorted(list(subject_map.values()), key=lambda x: get_req_course_order(x["교과목명"]))
    
    # 데이터가 아예 없을 경우 빈 줄 반환
    if not result_rows:
        result_rows.append({h: "" for h in exact_headers})

    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.3.1-5 ~ 2.3.1-8] 필수이수 교과목 운영실적 (통합 로직) ★★★
# ==========================================
def _fetch_2_3_1_operation_base(table_num):
    exact_headers = ["연도", "학기", "운영 교과목", "학점", "실습 여부"]
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    
    config = {
        5: {'admission_year': '2023', 'exclude': []},
        6: {'admission_year': '2024', 'exclude': [(2023, 2)]},
        7: {'admission_year': '2025', 'exclude': [(2023, 2), (2024, 1), (2024, 2)]},
        8: {'admission_year': '2026', 'exclude': [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2)]}
    }
    
    admission_year = config[table_num]['admission_year']
    exclude_list = config[table_num]['exclude']
    
    courses = []
    seen_names = set()
    
    for _, row in df.iterrows():
        # ★ 수정된 필터링: '필수이수' 단어만 찾는 게 아니라 전필/전공필수 등을 모두 포함
        origin_type = str(get_val_smart(row, "area_1")).replace(" ", "")
        is_required = any(kw in origin_type for kw in ['전필', '전공필수', '필수이수', 'major_req'])
        if not is_required: continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = str(get_val_smart(row, "연도")).split('.')[0]
        
        if admission_year in year_raw and name_val and name_val not in seen_names:
            t_val = int(float(get_val_smart(row, "theory_cred") or 0))
            p_val = int(float(get_val_smart(row, "prac_cred") or 0))
            tot_val = int(float(get_val_smart(row, "total_cred") or (t_val + p_val)))
            
            sem_raw = str(row.get(sem_col, '')).strip()
            nums = re.findall(r'\d+', sem_raw)
            g_val = int(nums[0]) if len(nums) >= 1 else 1
            s_val = int(nums[1]) if len(nums) >= 2 else 1
            
            op_year = int(admission_year) + g_val - 1
            courses.append({"name": name_val, "total_cred": tot_val, "prac_cred": p_val, "op_year": op_year, "op_sem": s_val})
            seen_names.add(name_val)
            
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], get_req_course_order(x["name"])))
    time_periods = [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    
    for c in courses:
        y, s = c["op_year"], c["op_sem"]
        if (y, s) in time_periods and (y, s) not in exclude_list:
            result_rows.append({
                "연도": str(y), "학기": f"{s}학기", "운영 교과목": c["name"],
                "학점": str(c["total_cred"]) if c["total_cred"] > 0 else "",
                "실습 여부": "O" if c["prac_cred"] > 0 else "X"
            })
            
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

def fetch_custom_2_3_1_5(): return _fetch_2_3_1_operation_base(5)
def fetch_custom_2_3_1_6(): return _fetch_2_3_1_operation_base(6)
def fetch_custom_2_3_1_7(): return _fetch_2_3_1_operation_base(7)
def fetch_custom_2_3_1_8(): return _fetch_2_3_1_operation_base(8)

# ==========================================
# ★★★ [표 2.3.2-1 ~ 2.3.2-2] 필수이수 교과목 학습내용 요약 ★★★
# ==========================================
def _fetch_2_3_2_learning_summary(target_admissions):
    exact_headers = ["구분", "교과목명", "학습내용 요약", "학점(개설학기)"]
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    result_rows = []

    for adm_year in target_admissions:
        # 2개 학년도 이상 출력 시 소제목 행 추가
        if len(target_admissions) > 1:
            result_rows.append({h: "" for h in exact_headers})
            result_rows[-1]["구분"] = f"▶ {adm_year}학년도 기준"

        subject_map = {}
        for _, row in df.iterrows():
            # 1. 필수이수 여부 확인 (전필, 교필 포함)
            if not is_required_course(row): continue
            
            # 2. 입학년도 매칭
            year_raw = str(get_val_smart(row, "연도")).split('.')[0]
            if str(adm_year) not in year_raw: continue
            
            name_val = get_val_smart(row, "교과목명")
            if not name_val: continue
            
            # 3. 운영 연도/학기 계산
            sem_raw = str(row.get(sem_col, '')).strip()
            nums = re.findall(r'\d+', sem_raw)
            g_val = int(nums[0]) if len(nums) >= 1 else 1
            s_val = int(nums[1]) if len(nums) >= 2 else 1
            
            op_year = int(adm_year) + g_val - 1
            
            # [수정] 2026-1 커트라인 체크 조건 삭제 (끝까지 모두 표시)
            
            # 4. 데이터 추출
            t_val = int(float(get_val_smart(row, "theory_cred") or 0))
            p_val = int(float(get_val_smart(row, "prac_cred") or 0))
            tot_val = int(float(get_val_smart(row, "total_cred") or (t_val + p_val)))
            desc_val = get_val_smart(row, "course_desc")
            
            if name_val not in subject_map:
                subject_map[name_val] = {
                    "구분": str(op_year),
                    "교과목명": name_val,
                    "학습내용 요약": desc_val,
                    "학점(개설학기)": f"{tot_val} ({sem_raw})",
                    # ⭐️ 정렬 기준: 1순위(운영 연도), 2순위(커스텀 과목 순서)
                    "sort_key": (op_year, get_req_course_order(name_val))
                }
            elif not subject_map[name_val]["학습내용 요약"]:
                subject_map[name_val]["학습내용 요약"] = desc_val

        # 블록별 정렬 후 추가
        sorted_subjects = sorted(list(subject_map.values()), key=lambda x: x["sort_key"])
        for subj in sorted_subjects:
            del subj["sort_key"]
            result_rows.append(subj)

    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

def fetch_custom_2_3_2_1(): return _fetch_2_3_2_learning_summary([2024, 2025])
def fetch_custom_2_3_2_2(): return _fetch_2_3_2_learning_summary([2026])

# ==========================================
# ★★★ [표 2.3.2-3 ~ 2.3.2-6] 필수이수 교과목 학습내용 반영 운영실적 ★★★
# ==========================================
def _fetch_2_3_2_operation_base(table_num):
    exact_headers = ["연도", "학기", "운영 교과목", "학습내용 요약", "학습운영"]
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    
    config = {
        3: {'admission_year': '2023', 'exclude': []},
        4: {'admission_year': '2024', 'exclude': [(2023, 2)]},
        5: {'admission_year': '2025', 'exclude': [(2023, 2), (2024, 1), (2024, 2)]},
        6: {'admission_year': '2026', 'exclude': [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2)]}
    }
    
    admission_year = config[table_num]['admission_year']
    exclude_list = config[table_num]['exclude']
    
    courses = []
    seen_names = set()
    
    for _, row in df.iterrows():
        # 1. 필수이수 여부 확인
        if not is_required_course(row): continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = str(get_val_smart(row, "연도")).split('.')[0]
        
        # 2. 해당 입학년도 데이터만 추출
        if admission_year in year_raw and name_val and name_val not in seen_names:
            sem_raw = str(row.get(sem_col, '')).strip()
            nums = re.findall(r'\d+', sem_raw)
            g_val = int(nums[0]) if len(nums) >= 1 else 1
            s_val = int(nums[1]) if len(nums) >= 2 else 1
            
            op_year = int(admission_year) + g_val - 1
            courses.append({"name": name_val, "op_year": op_year, "op_sem": s_val})
            seen_names.add(name_val)
            
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], get_req_course_order(x["name"])))
    
    # 평가 기간 커트라인 매칭 (2023-2 ~ 2026-1)
    time_periods = [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    
    for c in courses:
        y, s = c["op_year"], c["op_sem"]
        if (y, s) in time_periods and (y, s) not in exclude_list:
            result_rows.append({
                "연도": str(y),
                "학기": f"{s}학기",
                "운영 교과목": c["name"],
                "학습내용 요약": "",           # 지침상 빈칸
                "학습운영": "( )주 운영"      # 고정 텍스트
            })
            
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# ★ 래퍼(Wrapper) 함수 생성 (3, 4, 5, 6번)
def fetch_custom_2_3_2_3(): return _fetch_2_3_2_operation_base(3)
def fetch_custom_2_3_2_4(): return _fetch_2_3_2_operation_base(4)
def fetch_custom_2_3_2_5(): return _fetch_2_3_2_operation_base(5)
def fetch_custom_2_3_2_6(): return _fetch_2_3_2_operation_base(6)

# ==========================================
# ★★★ [표 2.4.1-1 ~ 2.4.1-4] 각 학년도 선택이수 교과목 특성화 영역 현황 ★★★
# ==========================================
def _fetch_2_4_1_specialized_elective(table_num):
    # 1. 5개 컬럼 강제 고정
    exact_headers = ["번호", "특성화 학습영역", "교과목명", "개설학년/학기", "학습내용 요약"]
    
    # 2. 도구 함수로 DB 로드
    df, err = get_db_dataframe("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": err}

    df = normalize_headers_with_alias(df)
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설학년/학기', '개설'])
    
    # 3. 표 번호별 설정 (커트라인 제한 삭제, 해당 연도 입학생이면 모두 통과)
    config = {
        1: {'admission_year': '2023'},
        2: {'admission_year': '2024'},
        3: {'admission_year': '2025'},
        4: {'admission_year': '2026'}
    }
    
    if table_num not in config:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
        
    admission_year = config[table_num]['admission_year']
    
    courses = []
    seen_keys = set() # ★ 중복 체크를 위한 세트

    # 4. 데이터 필터링 및 가공
    for _, row in df.iterrows():
        # '선택이수'이면 모두 통과
        if not is_elective_course(row): continue
            
        year_raw = str(get_val_smart(row, "연도")).split('.')[0]
        if admission_year not in year_raw: continue
            
        name_val = get_val_smart(row, "교과목명")
        if not name_val: continue
            
        area2_val = get_val_smart(row, "specialized_area")
        sem_raw = str(row.get(sem_col, '')).strip()
        
        # 중복 제거 (영역, 이름, 학기가 같으면 제외)
        unique_key = (area2_val, name_val, sem_raw)
        if unique_key in seen_keys:
            continue
        seen_keys.add(unique_key)

        nums = re.findall(r'\d+', sem_raw)
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
        
        # 이전 코드에 있던 g_val, s_val 커트라인 차단 로직 삭제됨!

        courses.append({
            "area2": area2_val, "name": name_val, "sem_raw": sem_raw,
            "g_val": g_val, "s_val": s_val
        })
        
    # 5. 정렬 및 결과 조립 (★ 커스텀 정렬 적용)
    courses.sort(key=lambda x: (get_elec_course_order(x["name"]), x["g_val"], x["s_val"]))
    
    result_rows = []
    for idx, c in enumerate(courses, 1):
        result_rows.append({
            "번호": str(idx), 
            "특성화 학습영역": c["area2"],
            "교과목명": c["name"],
            "개설학년/학기": c["sem_raw"],
            "학습내용 요약": ""
        })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# 라우터 연결용 래퍼 함수들
def fetch_custom_2_4_1_1(): return _fetch_2_4_1_specialized_elective(1)
def fetch_custom_2_4_1_2(): return _fetch_2_4_1_specialized_elective(2)
def fetch_custom_2_4_1_3(): return _fetch_2_4_1_specialized_elective(3)
def fetch_custom_2_4_1_4(): return _fetch_2_4_1_specialized_elective(4)

# ==========================================
# ★★★ [표 2.4.2-1]  2023학년도 ~ 2025학년도 선택이수 교과목 학점 편성 현황 ★★★
# ==========================================
def fetch_custom_2_4_2_1():
    # 1. 프롬프트에 명시된 컬럼 헤더 고정 (2023~2025학년도 3개년 비교)
    exact_headers = [
        "교과목명",
        "2023학년도 개설학년/학기", "2023학년도 학점", "2023학년도 실습 여부",
        "2024학년도 개설학년/학기", "2024학년도 학점", "2024학년도 실습 여부",
        "2025학년도 개설학년/학기", "2025학년도 학점", "2025학년도 실습 여부",
        "변경 내용"
    ]

    # 2. 교과목 DB 로드 (스마트 병합 방식)
    df, err = get_db_dataframe("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": err}

    df.columns = [str(c).strip() for c in df.columns]

    # 3. 필수 컬럼 찾기 (최신 변수명 탐색 로직 적용)
    name_col = 'course_name' if 'course_name' in df.columns else next((c for c in df.columns if '교과목' in c), None)
    area_col = 'area_1' if 'area_1' in df.columns else next((c for c in df.columns if '교과영역_1' in c or '교과영역' in c), None)
    year_col = 'curr_year' if 'curr_year' in df.columns else next((c for c in df.columns if c in ['연도', '학년도', '구분']), '연도')
    sem_col = 'open_sem' if 'open_sem' in df.columns else next((c for c in df.columns if '개설' in c), None)
    theory_col = 'theory_cred' if 'theory_cred' in df.columns else next((c for c in df.columns if '이론' in c), None)
    prac_col = 'prac_cred' if 'prac_cred' in df.columns else next((c for c in df.columns if '실습' in c), None)
    total_cred_col = 'total_cred' if 'total_cred' in df.columns else next((c for c in df.columns if '학점구성-소계' in c or '졸업학점' in c), None)

    if not name_col or not area_col:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "필수 컬럼 누락"}

    # 4. 데이터 필터링 및 가공
    target_years = ['2023', '2024', '2025']
    subject_map = {}

    for _, row in df.iterrows():
        area_val = str(row.get(area_col, '')).strip()
        
        # ★ 핵심 변경점: '선택이수' 과목만 추출
        if '선택이수' not in area_val:
            continue
            
        name_val = str(row.get(name_col, '')).strip()
        if not name_val or name_val.lower() == 'nan': continue
            
        year_raw = str(row.get(year_col, '')).strip()
        if '.' in year_raw: year_raw = year_raw.split('.')[0]
        
        matched_year = next((ty for ty in target_years if ty in year_raw), None)
        
        if matched_year and name_val:
            def get_val(c_name):
                if c_name and c_name in row:
                    try: return int(float(row[c_name]))
                    except: return 0
                return 0
                
            t_val = get_val(theory_col)
            p_val = get_val(prac_col)
            tot_val = get_val(total_cred_col) if total_cred_col else (t_val + p_val)
            sem_val = str(row.get(sem_col, '')).strip()
            
            # 실습 여부: 실습 학점이 0보다 크면 'O'
            prac_mark = "O" if p_val > 0 else ""

            if name_val not in subject_map:
                subject_map[name_val] = {h: "" for h in exact_headers}
                subject_map[name_val]["교과목명"] = name_val

            # 연도별 컬럼에 데이터 삽입
            subject_map[name_val][f"{matched_year}학년도 개설학년/학기"] = sem_val
            subject_map[name_val][f"{matched_year}학년도 학점"] = str(tot_val) if tot_val > 0 else ""
            subject_map[name_val][f"{matched_year}학년도 실습 여부"] = prac_mark

    # 5. 결과 조립 및 가나다순 정렬
    result_rows = list(subject_map.values())
    result_rows.sort(key=lambda x: get_elec_course_order(x.get("교과목명", "")))

    if not result_rows:
        result_rows.append({h: "" for h in exact_headers})

    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.4.2-2]  2026학년도 선택이수 교과목 학점 편성 현황 (2주기 평가·인증 기준 적용) ★★★
# ==========================================
def fetch_custom_2_4_2_2():
    # 1. 프롬프트에 명시된 컬럼 헤더 고정 (2026학년도 단일)
    exact_headers = [
        "교과목명",
        "2026학년도 개설학년/학기", "2026학년도 학점", "2026학년도 실습 여부",
        "변경 내용"
    ]

    df, err = get_db_dataframe("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": err}

    df.columns = [str(c).strip() for c in df.columns]

    name_col = 'course_name' if 'course_name' in df.columns else next((c for c in df.columns if '교과목' in c), None)
    area_col = 'area_1' if 'area_1' in df.columns else next((c for c in df.columns if '교과영역_1' in c or '교과영역' in c), None)
    year_col = 'curr_year' if 'curr_year' in df.columns else next((c for c in df.columns if c in ['연도', '학년도', '구분']), '연도')
    sem_col = 'open_sem' if 'open_sem' in df.columns else next((c for c in df.columns if '개설' in c), None)
    theory_col = 'theory_cred' if 'theory_cred' in df.columns else next((c for c in df.columns if '이론' in c), None)
    prac_col = 'prac_cred' if 'prac_cred' in df.columns else next((c for c in df.columns if '실습' in c), None)
    total_cred_col = 'total_cred' if 'total_cred' in df.columns else next((c for c in df.columns if '학점구성-소계' in c or '졸업학점' in c), None)

    if not name_col or not area_col:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "필수 컬럼 누락"}

    subject_map = {}

    for _, row in df.iterrows():
        area_val = str(row.get(area_col, '')).strip()
        
        # ★ 핵심 변경점: '선택이수' 과목만 추출
        if '선택이수' not in area_val:
            continue
            
        name_val = str(row.get(name_col, '')).strip()
        if not name_val or name_val.lower() == 'nan': continue
            
        year_raw = str(row.get(year_col, '')).strip()
        if '.' in year_raw: year_raw = year_raw.split('.')[0]
        
        # 2026학년도 데이터만 필터링
        if '2026' in year_raw and name_val:
            def get_val(c_name):
                if c_name and c_name in row:
                    try: return int(float(row[c_name]))
                    except: return 0
                return 0
                
            t_val = get_val(theory_col)
            p_val = get_val(prac_col)
            tot_val = get_val(total_cred_col) if total_cred_col else (t_val + p_val)
            sem_val = str(row.get(sem_col, '')).strip()
            prac_mark = "O" if p_val > 0 else ""

            if name_val not in subject_map:
                subject_map[name_val] = {h: "" for h in exact_headers}
                subject_map[name_val]["교과목명"] = name_val

            subject_map[name_val]["2026학년도 개설학년/학기"] = sem_val
            subject_map[name_val]["2026학년도 학점"] = str(tot_val) if tot_val > 0 else ""
            subject_map[name_val]["2026학년도 실습 여부"] = prac_mark

    result_rows = list(subject_map.values())
    result_rows.sort(key=lambda x: get_elec_course_order(x.get("교과목명", "")))

    if not result_rows:
        result_rows.append({h: "" for h in exact_headers})

    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.4.2-5 ~ 2.4.2-8] 필수이수 교과목 운영실적 (통합 로직) ★★★
# ==========================================
def _fetch_2_4_2_operation_base(table_num):
    # 1. 6개 컬럼 강제 고정
    exact_headers = ["연도", "학기", "운영 교과목", "학습내용 요약", "학점", "학습운영"]
    
    # 2. 도구 함수로 DB 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}
        
    # 3. 도구 함수로 필수 컬럼 식별
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설학년/학기', '개설'])
    
    # 4. 표 번호별 설정 (3~6번)
    config = {
        3: {'admission_year': '2023', 'exclude': []},
        4: {'admission_year': '2024', 'exclude': [(2023, 2)]},
        5: {'admission_year': '2025', 'exclude': [(2023, 2), (2024, 1), (2024, 2)]},
        6: {'admission_year': '2026', 'exclude': [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2)]}
    }
    
    admission_year = config[table_num]['admission_year']
    exclude_list = config[table_num]['exclude']
    
    # 5. 데이터 추출 및 운영 연도/학기 계산
    courses = []
    seen_names = set()
    
    for _, row in df.iterrows():
        # ★ 수정된 필터링: '선택이수' 단어만 찾는 게 아니라 전선/전공선택/일선 등을 포함
        origin_type = str(get_val_smart(row, "area_1")).replace(" ", "")
        is_elective = any(kw in origin_type for kw in ['전선', '전공선택', '전공심화', '선택이수', 'major_sel'])
        if not is_elective: continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = get_val_smart(row, "연도").split('.')[0]
        
        if admission_year in year_raw and name_val and name_val not in seen_names:
            # 학점 계산 (이론+실습)
            t_val = int(float(get_val_smart(row, "theory_cred") or 0))
            p_val = int(float(get_val_smart(row, "prac_cred") or 0))
            tot_val = int(float(get_val_smart(row, "total_cred") or (t_val + p_val)))
            
            # 개설학년-학기 파싱 및 운영 연도 역산
            sem_raw = str(row.get(sem_col, '')).strip()
            nums = re.findall(r'\d+', sem_raw)
            g_val = int(nums[0]) if len(nums) >= 1 else 1
            s_val = int(nums[1]) if len(nums) >= 2 else 1
            
            op_year = int(admission_year) + g_val - 1
            
            courses.append({
                "name": name_val,
                "total_cred": tot_val,
                "op_year": op_year,
                "op_sem": s_val
            })
            seen_names.add(name_val)
            
    # 정렬: 운영 연도 -> 운영 학기 -> 교과목명
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], get_elec_course_order(x["name"])))
    
    # 6. 평가 기간 커트라인 매칭 (2023-2 ~ 2026-1)
    time_periods = [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    
    for c in courses:
        y, s = c["op_year"], c["op_sem"]
        if (y, s) in time_periods and (y, s) not in exclude_list:
            result_rows.append({
                "연도": str(y),
                "학기": f"{s}학기",
                "운영 교과목": c["name"],
                "학습내용 요약": "",           # 요구사항: 항상 빈칸
                "학점": str(c["total_cred"]) if c["total_cred"] > 0 else "",
                "학습운영": "( )주 운영"      # 요구사항: 고정 텍스트
            })
            
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# 라우터 연결용 래퍼 함수들
def fetch_custom_2_4_2_3(): return _fetch_2_4_2_operation_base(3)
def fetch_custom_2_4_2_4(): return _fetch_2_4_2_operation_base(4)
def fetch_custom_2_4_2_5(): return _fetch_2_4_2_operation_base(5)
def fetch_custom_2_4_2_6(): return _fetch_2_4_2_operation_base(6)

# ==========================================
# ★★★ [표 2.5.1-1] 2023학년도 ~ 2025학년도 이론 교과목의 효과적 교수학습방법 적용 계획 ★★★
# ==========================================
def fetch_custom_2_5_1_1():
    # 1. 15개 컬럼 헤더 고정
    exact_headers = [
        "교과목명", "개설학년/학기",
        "2023_방1", "2023_방2", "2023_방3", "2023_방4",
        "2024_방1", "2024_방2", "2024_방3", "2024_방4",
        "2025_방1", "2025_방2", "2025_방3", "2025_방4",
        "변경내용"
    ]

    # 2. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}

    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    
    # 3. 데이터 필터링 및 가공
    target_years = ['2023', '2024', '2025']
    subject_map = {}

    for _, row in df.iterrows():
        # 실습 학점이 0인 '이론' 교과목만 필터링
        prac_val = int(float(get_val_smart(row, "prac_cred") or 0))
        if prac_val > 0: continue

        name_val = get_val_smart(row, "교과목명")
        year_raw = get_val_smart(row, "연도").split('.')[0]
        matched_year = next((ty for ty in target_years if ty in year_raw), None)
        
        if matched_year and name_val:
            # 교수학습방법 적용 여부 확인
            teach_val = get_val_smart(row, "teach_method").upper()
            if teach_val in ['O', 'Y', '1', 'TRUE', '적용']:
                if name_val not in subject_map:
                    subject_map[name_val] = {h: "" for h in exact_headers}
                    subject_map[name_val]["교과목명"] = name_val
                    subject_map[name_val]["개설학년/학기"] = str(row.get(sem_col, ''))
                
                # 해당 연도의 모든 방법(방1~방4)에 'O' 표시
                for i in range(1, 5):
                    subject_map[name_val][f"{matched_year}_방{i}"] = "O"

    result_rows = sorted(list(subject_map.values()), key=lambda x: x["교과목명"])
    
    # 4. 합계 행 추가 (요구사항 고정값 반영)
    result_rows.append({
        "교과목명": "합계", "개설학년/학기": "적용 대상 교과목 수",
        **{f"{y}_방1": "14" for y in target_years}, "변경내용": ""
    })
    result_rows.append({
        "교과목명": "", "개설학년/학기": "적용 교과목 수",
        **{f"{y}_방1": "2" for y in target_years}, "변경내용": ""
    })

    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.5.1-2] 2026학년도 이론 교과목의 효과적 교수학습방법 적용 계획 ★★★
# ==========================================
def fetch_custom_2_5_1_2():
    # 1. 7개 컬럼 헤더 고정
    exact_headers = ["교과목명", "개설학년/학기", "2026_방1", "2026_방2", "2026_방3", "2026_방4", "변경내용"]

    # 2. 도구 함수로 DB 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}

    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    
    # 3. 데이터 가공 (2026년 이론 과목 대상)
    result_rows = []
    for _, row in df.iterrows():
        prac_val = int(float(get_val_smart(row, "prac_cred") or 0))
        year_raw = get_val_smart(row, "연도")
        
        if prac_val == 0 and '2026' in year_raw:
            name_val = get_val_smart(row, "교과목명")
            teach_val = get_val_smart(row, "teach_method").upper()
            
            if name_val and teach_val in ['O', 'Y', '1', '적용']:
                row_data = {h: "" for h in exact_headers}
                row_data["교과목명"] = name_val
                row_data["개설학년/학기"] = str(row.get(sem_col, ''))
                for i in range(1, 5):
                    row_data[f"2026_방{i}"] = "O"
                result_rows.append(row_data)

    result_rows.sort(key=lambda x: x["교과목명"])
    
    # 4. 합계 행 추가 (고정값 반영)
    result_rows.append({"교과목명": "합계", "개설학년/학기": "적용 대상 교과목 수", "2026_방1": "14", "변경내용": ""})
    result_rows.append({"교과목명": "", "개설학년/학기": "적용 교과목 수", "2026_방1": "2", "변경내용": ""})

    return {"headers": exact_headers, "rows": result_rows}

# ==========================================
# ★★★ [표 2.5.2-3 ~ 2.5.2-6] 각 학년도 다양한 평가방법 적용 실적 ★★★
# ==========================================
def _fetch_2_5_2_performance_base(table_num):
    # 1. 7개 컬럼 헤더 고정
    exact_headers = ["년도", "학기", "운영교과목", "방법1", "방법2", "방법3", "평가방법 적용 운영(주)"]
    
    # 2. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}
        
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설학년/학기', '개설'])
    
    # 3. 표 번호별 설정 (3~6번)
    config = {
        3: {'admission_year': '2023', 'exclude': []},
        4: {'admission_year': '2024', 'exclude': [(2023, 2)]},
        5: {'admission_year': '2025', 'exclude': [(2023, 2), (2024, 1), (2024, 2)]},
        6: {'admission_year': '2026', 'exclude': [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2)]}
    }
    
    if table_num not in config:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
        
    admission_year = config[table_num]['admission_year']
    exclude_list = config[table_num]['exclude']

    courses = []
    seen_names = set()
    
    # 4. 데이터 필터링 및 운영 연도/학기 계산
    for _, row in df.iterrows():
        # 실습 학점이 0인 이론 과목만 통과
        prac_val = int(float(get_val_smart(row, "prac_cred") or 0))
        if prac_val > 0: continue
            
        # 평가방법(eval_method) 적용 여부 확인
        eval_val = get_val_smart(row, "eval_method").upper()
        if eval_val not in ['O', 'Y', '1', 'TRUE', '적용']: continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = get_val_smart(row, "연도").split('.')[0]
        
        if admission_year in year_raw and name_val and name_val not in seen_names:
            # 개설학년-학기 파싱 및 운영 연도 역산
            sem_raw = str(row.get(sem_col, '')).strip()
            nums = re.findall(r'\d+', sem_raw)
            g_val = int(nums[0]) if len(nums) >= 1 else 1
            s_val = int(nums[1]) if len(nums) >= 2 else 1
            
            op_year = int(admission_year) + g_val - 1
            
            courses.append({
                "op_year": op_year,
                "op_sem": s_val,
                "name": name_val
            })
            seen_names.add(name_val)
            
    # 정렬: 운영 연도 -> 학기 -> 교과목명
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], x["name"]))
    
    # 5. 평가 기간 커트라인 매칭 (2023-2 ~ 2026-1) 및 결과 생성
    time_periods = [(2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    
    for c in courses:
        y, s = c["op_year"], c["op_sem"]
        if (y, s) in time_periods and (y, s) not in exclude_list:
            result_rows.append({
                "년도": str(y),
                "학기": f"{s}학기",
                "운영교과목": c["name"],
                "방법1": "O",
                "방법2": "O",
                "방법3": "O",
                "평가방법 적용 운영(주)": "( )주 운영"
            })
        
    # 6. 합계 행 추가
    applied_count = len(result_rows)
    result_rows.append({
        "년도": "합계",
        "학기": "",
        "운영교과목": "적용 실적이 있는 교과목 수",
        "방법1": str(applied_count), 
        "방법2": "", "방법3": "", "평가방법 적용 운영(주)": ""
    })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# 라우터용 래퍼 함수들
def fetch_custom_2_5_2_3(): return _fetch_2_5_2_performance_base(3)
def fetch_custom_2_5_2_4(): return _fetch_2_5_2_performance_base(4)
def fetch_custom_2_5_2_5(): return _fetch_2_5_2_performance_base(5)
def fetch_custom_2_5_2_6(): return _fetch_2_5_2_performance_base(6)

# ==========================================
# ★★★ [표 2.6.1-1] 학습성과 성취도 종합적 분석 실적 (운영 현황) ★★★
# ==========================================
def fetch_custom_2_6_1_1():
    # 1. 8개 컬럼 헤더 고정
    exact_headers = ["연도", "학년", "학기", "운영 교과목", "성취도 및 강의평가 결과분석", "검토 주체 및 일자", "분석내용", "검토 결과"]
    
    # 2. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}
        
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설학년/학기', '개설'])
    
    # 3. 데이터 필터링 및 운영 연도/학년/학기 계산
    courses = []
    for _, row in df.iterrows():
        # 필수이수 또는 선택이수 과목만 포함
        area_val = get_val_smart(row, "area_1")
        if '필수이수' not in area_val and '선택이수' not in area_val:
            continue
            
        name_val = get_val_smart(row, "교과목명")
        if not name_val: continue
            
        # 입학년도 추출 (22학번 이후만)
        year_raw = get_val_smart(row, "연도")
        adm_match = re.search(r'20\d{2}', year_raw)
        if not adm_match: continue
        adm_year = int(adm_match.group())
        if adm_year < 2022: continue

        # 개설학년-학기 파싱
        sem_raw = str(row.get(sem_col, '')).strip()
        nums = re.findall(r'\d+', sem_raw)
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
            
        # 운영 연도 계산 = 입학년도 + 학년 (학년별 순차 운영 가정)
        op_year = adm_year + g_val
        
        courses.append({
            "op_year": op_year,
            "op_grade": g_val,
            "op_sem": s_val,
            "name": name_val
        })
            
    # 정렬: 운영 연도 -> 학기 -> 학년 -> 교과목명
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], x["op_grade"], x["name"]))
    
    # 4. 평가 기간 커트라인 매칭 (2023-1 ~ 2026-1)
    time_periods = [(2023, 1), (2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    seen = set()
    
    for c in courses:
        y, s, g = c["op_year"], c["op_sem"], c["op_grade"]
        if (y, s) not in time_periods:
            continue
            
        # 중복 제거 (학년/과목명 기준)
        unique_key = f"{y}_{s}_{g}_{c['name']}"
        if unique_key in seen: continue
        seen.add(unique_key)
            
        result_rows.append({
            "연도": str(y),
            "학년": f"{g}학년",
            "학기": f"{s}학기",
            "운영 교과목": c["name"],
            "성취도 및 강의평가 결과분석": "",
            "검토 주체 및 일자": "",
            "분석내용": "",
            "검토 결과": ""
        })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# ==========================================
# ★★★ [표 2.6.2-1 ~ 2.6.2-3] 지속적 질 개선 및 개선 계획 ★★★
# ==========================================
def _fetch_2_6_2_base(table_num):
    # 1. 표 번호별 헤더 정의
    if table_num == 1:
        exact_headers = ["연도", "학년", "학기", "운영 교과목", "CQI검토결과", "개선 방안", "개선방안 적용여부", "비고"]
    elif table_num == 2:
        exact_headers = ["연도", "학년", "학기", "운영 교과목", "공유방법", "공유일자"]
    else:
        exact_headers = ["연도", "학년", "학기", "운영 교과목", "성취도 일정수준 미만 대상 개선계획 내용요약"]

    # 2. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}
        
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설학년/학기', '개설'])
    
    # 3. 데이터 추출 및 운영 연도/학년/학기 계산
    courses = []
    for _, row in df.iterrows():
        # 필수이수 또는 선택이수 과목만 포함
        area_val = get_val_smart(row, "area_1")
        if '필수이수' not in area_val and '선택이수' not in area_val:
            continue
            
        name_val = get_val_smart(row, "교과목명")
        if not name_val: continue
            
        # 입학년도 추출 (22학번 이후)
        year_raw = get_val_smart(row, "연도")
        adm_match = re.search(r'20\d{2}', year_raw)
        if not adm_match: continue
        adm_year = int(adm_match.group())
        if adm_year < 2022: continue

        # 개설학년-학기 파싱
        sem_raw = str(row.get(sem_col, '')).strip()
        nums = re.findall(r'\d+', sem_raw)
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
            
        op_year = adm_year + g_val
        
        courses.append({
            "op_year": op_year,
            "op_grade": g_val,
            "op_sem": s_val,
            "name": name_val
        })
            
    # 정렬
    courses.sort(key=lambda x: (x["op_year"], x["op_sem"], x["op_grade"], x["name"]))

    # 4. 평가 기간 커트라인 매칭 (2023-1 ~ 2026-1) 및 행 조립
    time_periods = [(2023, 1), (2023, 2), (2024, 1), (2024, 2), (2025, 1), (2025, 2), (2026, 1)]
    result_rows = []
    seen = set()

    for c in courses:
        y, s, g = c["op_year"], c["op_sem"], c["op_grade"]
        if (y, s) not in time_periods: continue
            
        unique_key = f"{y}_{s}_{g}_{c['name']}"
        if unique_key in seen: continue
        seen.add(unique_key)
            
        base_row = {h: "" for h in exact_headers}
        base_row.update({
            "연도": str(y),
            "학년": f"{g}학년",
            "학기": f"{s}학기",
            "운영 교과목": c["name"]
        })
        result_rows.append(base_row)

    # 5. 합계 행 추가
    if not result_rows:
        result_rows.append({h: "" for h in exact_headers})

    sum_row = {h: "" for h in exact_headers}
    sum_row["연도"] = "합계" 
    if table_num == 2:
        sum_row["운영 교과목"] = "(학과/학부 교수와 공유한 교과목 수)"

    result_rows.append(sum_row)

    return {"headers": exact_headers, "rows": result_rows}

# 래퍼 함수들
def fetch_custom_2_6_2_1(): return _fetch_2_6_2_base(1)
def fetch_custom_2_6_2_2(): return _fetch_2_6_2_base(2)
def fetch_custom_2_6_2_3(): return _fetch_2_6_2_base(3)

# ==========================================
# ★★★ [표 5.1.2-2] 필수이수 실습 교과목의 실습실 운영 현황 ★★★
# ==========================================
def fetch_custom_5_1_2_2():
    # 1. 8개 컬럼 헤더 고정
    exact_headers = ["교과명", "운영시기", "구분", "총 수업 시수", "수용 인원", "수강 인원", "위치", "비고"]
    
    # 2. 도구 함수로 DB 및 컬럼 로드
    df = load_merged_db("교과목")
    if df is None:
        return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}], "message": "데이터 없음"}
        
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    hours_col = find_col(df, ['hours', '시수', '총시수', '시간'])

    courses = []
    # 3. 필수이수 & 실습학점 필터링
    for _, row in df.iterrows():
        # 필수이수 확인
        if '필수이수' not in get_val_smart(row, "area_1"): continue
            
        # 실습학점 > 0 확인
        prac_val = float(get_val_smart(row, "prac_cred") or 0)
        if prac_val <= 0: continue
            
        name_val = get_val_smart(row, "교과목명")
        year_raw = get_val_smart(row, "연도")
        adm_match = re.search(r'20\d{2}', year_raw)
        if not name_val or not adm_match: continue
        
        curr_year = int(adm_match.group())

        # 개설학년-학기 파싱 및 운영 연도 계산
        sem_raw = str(row.get(sem_col, '')).strip()
        nums = re.findall(r'\d+', sem_raw)
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
        
        op_year = curr_year + g_val - 1
        
        # 평가 기간 필터 (2023-2 ~ 2026-1)
        if op_year < 2023 or op_year > 2026: continue
        if op_year == 2023 and s_val == 1: continue
        if op_year == 2026 and s_val >= 2: continue
            
        # 시수 정수 변환
        h_raw = str(row.get(hours_col, '')).strip()
        try:
            hours_val = str(int(float(h_raw))) if h_raw and h_raw.lower() != 'nan' else ""
        except:
            hours_val = h_raw
        
        courses.append({
            "name": name_val, "op_period": f"{op_year}-{s_val}", "hours": hours_val
        })
            
    # 정렬 및 중복 제거
    courses.sort(key=lambda x: (x["name"], x["op_period"]))
    result_rows = []
    seen = set()
    for c in courses:
        unique_key = f"{c['name']}_{c['op_period']}"
        if unique_key in seen: continue
        seen.add(unique_key)
        
        result_rows.append({
            "교과명": c["name"], "운영시기": c["op_period"], "구분": "",
            "총 수업 시수": c["hours"], "수용 인원": "", "수강 인원": "", "위치": "", "비고": ""
        })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# ==========================================
# ★★★ [표 5.1.2-3] 전산 실습실 운영 현황 ★★★
# ==========================================
def fetch_custom_5_1_2_3():
    exact_headers = ["실습 교과목명", "연도", "학기", "강의실", "구분", "수용 인원", "수강 인원", "총 시수", "전산 실습실 수업시수", "전산 실습실 운영 비율(%)", "비고"]
    
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    hours_col = find_col(df, ['hours', '시수', '총시수'])

    courses = []
    for _, row in df.iterrows():
        name_val = get_val_smart(row, "교과목명").replace(" ", "")
        
        # 표준 이름 매칭
        standard_name = None
        if '보건의료통계' in name_val: standard_name = '보건의료 통계'
        elif '보건의료데이터' in name_val: standard_name = '보건의료 데이터 관리'
        elif '보건의료정보관리실무' in name_val: standard_name = '보건의료정보 관리 실무'
            
        if not standard_name: continue
            
        year_raw = get_val_smart(row, "연도")
        adm_match = re.search(r'20\d{2}', year_raw)
        if not adm_match: continue
        
        # 운영 시기 계산 및 필터링 (2023-2 ~ 2026-1)
        nums = re.findall(r'\d+', str(row.get(sem_col, '')))
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
        op_year = int(adm_match.group()) + g_val - 1
        
        if op_year < 2023 or op_year > 2026: continue
        if op_year == 2023 and s_val == 1: continue
        if op_year == 2026 and s_val >= 2: continue
            
        # 시수 정수화
        h_raw = str(row.get(hours_col, '')).strip()
        try: hours_val = str(int(float(h_raw))) if h_raw and h_raw.lower() != 'nan' else ""
        except: hours_val = h_raw
        
        courses.append({"name": standard_name, "year": op_year, "sem": s_val, "hours": hours_val})
            
    courses.sort(key=lambda x: (x["name"], x["year"], x["sem"]))
    result_rows = []
    seen = set()
    for c in courses:
        key = f"{c['name']}_{c['year']}_{c['sem']}"
        if key in seen: continue
        seen.add(key)
        result_rows.append({
            "실습 교과목명": c["name"], "연도": str(c["year"]), "학기": str(c["sem"]),
            "강의실": "", "구분": "", "수용 인원": "", "수강 인원": "",
            "총 시수": c["hours"], "전산 실습실 수업시수": "", "전산 실습실 운영 비율(%)": "", "비고": ""
        })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# ==========================================
# ★★★ [표 5.1.2-4] 실무/전산 실습실 운영 현황 ★★★
# ==========================================
def fetch_custom_5_1_2_4():
    exact_headers = ["실습 교과목명", "개설 여부", "연도-학기", "강의실", "구분", "수용 인원", "수강 인원", "총 시수", "실습실 수업 시수", "실습실 운영 비율(%)", "실습실 평균 운영 비율(%)"]
    
    df = load_merged_db("교과목")
    if df is None: return {"headers": exact_headers, "rows": [{h: "" for h in exact_headers}]}
    
    sem_col = find_col(df, ['open_sem', '개설학년-학기', '개설'])
    hours_col = find_col(df, ['hours', '시수', '총시수'])

    courses = []
    for _, row in df.iterrows():
        name_val = get_val_smart(row, "교과목명").replace(" ", "")
        
        standard_name = None
        if '질병' in name_val and '분류' in name_val: standard_name = '질병 및 의료행위 분류'
        elif '의무기록정보분석' in name_val: standard_name = '의무기록정보분석 실무'
        elif '의무기록정보질향상' in name_val: standard_name = '의무기록정보질 향상 실무'
        elif '건강보험' in name_val: standard_name = '건강보험 이론 및 실무'
        elif '암등록' in name_val: standard_name = '암 등록'
            
        if not standard_name: continue
            
        year_raw = get_val_smart(row, "연도")
        adm_match = re.search(r'20\d{2}', year_raw)
        if not adm_match: continue
        
        nums = re.findall(r'\d+', str(row.get(sem_col, '')))
        g_val = int(nums[0]) if len(nums) >= 1 else 1
        s_val = int(nums[1]) if len(nums) >= 2 else 1
        op_year = int(adm_match.group()) + g_val - 1
        
        if op_year < 2023 or op_year > 2026: continue
        if op_year == 2023 and s_val == 1: continue
        if op_year == 2026 and s_val >= 2: continue
            
        h_raw = str(row.get(hours_col, '')).strip()
        try: hours_val = str(int(float(h_raw))) if h_raw and h_raw.lower() != 'nan' else ""
        except: hours_val = h_raw
        
        courses.append({"name": standard_name, "period": f"{op_year}-{s_val}", "hours": hours_val})
            
    courses.sort(key=lambda x: (x["name"], x["period"]))
    result_rows = []
    seen = set()
    for c in courses:
        key = f"{c['name']}_{c['period']}"
        if key in seen: continue
        seen.add(key)
        result_rows.append({
            "실습 교과목명": c["name"], "개설 여부": "", "연도-학기": c["period"],
            "강의실": "", "구분": "", "수용 인원": "", "수강 인원": "",
            "총 시수": c["hours"], "실습실 수업 시수": "", "실습실 운영 비율(%)": "", "실습실 평균 운영 비율(%)": ""
        })
        
    return {"headers": exact_headers, "rows": result_rows or [{h: "" for h in exact_headers}]}

# ==========================================
# ★★★ [표 I-3] 교수진 강의담당 분석 ★★★
# ==========================================
def fetch_custom_I_3(report_id="[표 I-3] 교수진 강의담당 분석"):
    headers = [
        "교수진(이름)", 
        "전임,비전임(겸임/계약/객원 등) 또는 시간강사", 
        "학년도/학기", 
        "구분", 
        "교과영역", 
        "교과목명", 
        "학점", 
        "비고"
    ]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    df = load_merged_db("교수진 강의담당 분석")
    if df is None or df.empty:
        print("❌ [오류] '교수진 강의담당 분석' DB 파일을 찾을 수 없습니다.")
        return {"headers": headers, "rows": [], "message": "데이터 없음"}

    # 유연한 컬럼 찾기
    prof_col = find_col(df, ['prof_name', '교수명', '담당교수', '성명'])
    fulltime_col = find_col(df, ['fulltime_type', '전임구분'])
    course_col = find_col(df, ['course_name', '교과목명', '과목명'])
    year_col = find_col(df, ['curr_year', '연도', '학년도', 'year'])
    sem_col = find_col(df, ['semester', '학기'])
    cred_col = find_col(df, ['total_cred', '학점'])
    type_col = find_col(df, ['school_type', '과목종별', '이수구분'])
    univ_col = find_col(df, ['univ_type', '대학구분', '대학'])

    temp_list = []
    for idx, row in df.iterrows():
        prof_name = str(row.get(prof_col, '')).strip() if prof_col else ""
        fulltime_val = str(row.get(fulltime_col, '')).strip() if fulltime_col else ""
        course_name = str(row.get(course_col, '')).strip() if course_col else ""
        year_val = str(row.get(year_col, '')).strip() if year_col else ""
        sem_val = str(row.get(sem_col, '')).strip() if sem_col else ""
        cred_val = str(row.get(cred_col, '')).strip() if cred_col else "0"
        school_type = str(row.get(type_col, '')).strip() if type_col else ""
        univ_type = str(row.get(univ_col, '')).strip() if univ_col else ""

        if not prof_name or not course_name:
            continue

        # 1. 학년도 추출
        year_match = re.search(r'20\d{2}', year_val)
        if not year_match:
            continue
        year_num = int(year_match.group())

        # 2. 학기 추출
        sem_nums = re.findall(r'\d+', sem_val)
        sem_num = int(sem_nums[0]) if sem_nums else 1

        # 3. 기간 필터링 (2023-1 ~ 2026-1)
        if not (2023 <= year_num <= 2026):
            continue
        if year_num == 2026 and sem_num >= 2:
            continue

        year_sem_str = f"{year_num}학년도 {sem_num}학기"
        sort_year_sem = f"{year_num}-{sem_num}"

        # 4. 대학/대학원 구분 및 정렬 순서
        if '대학원' in univ_type:
            gu_bun = '대학원'
            gu_bun_sort = 2
        else:
            gu_bun = '학사'
            gu_bun_sort = 1

        # 5. 교과영역 단어 변환
        area = school_type
        if area == '전선': area = '전공선택'
        elif area == '전필': area = '전공필수'
        elif area == '교기': area = '교양기초'
        elif area == '교선': area = '교양선택'
        elif area == '교필': area = '교양필수'

        # 6. 학점 수치화
        try:
            cred_num = int(float(cred_val))
        except:
            cred_num = 0

        temp_list.append({
            "prof_name": prof_name,
            "fulltime_type": fulltime_val, 
            "year_sem_str": year_sem_str,
            "sort_year_sem": sort_year_sem,
            "gu_bun": gu_bun,
            "gu_bun_sort": gu_bun_sort,
            "area": area,
            "course_name": course_name,
            "credit": cred_num
        })

    # 7. 정렬
    temp_list.sort(key=lambda x: (x['prof_name'], x['sort_year_sem'], x['gu_bun_sort'], x['course_name']))

    from itertools import groupby
    result_rows = []
    
    for prof, prof_group in groupby(temp_list, key=lambda x: x['prof_name']):
        prof_items = list(prof_group)
        prof_displayed = False 
        
        for y_s_str, sem_group in groupby(prof_items, key=lambda x: x['year_sem_str']):
            sem_items = list(sem_group)
            sem_displayed = False 
            subtotal_cred = 0
            gu_bun_displayed = ""
            
            # ⭐️ 해당 '학기'의 첫 번째 데이터에서 전임구분 값을 가져옵니다 (학기별 변동 반영)
            semester_status = sem_items[0]['fulltime_type'] if sem_items else ""
            
            for item in sem_items:
                subtotal_cred += item['credit']
                
                result_rows.append({
                    "교수진(이름)": item['prof_name'] if not prof_displayed else "",
                    # ⭐️ '전임구분'을 '학년도/학기'가 표시될 때 나란히 표시되도록 수정
                    "전임,비전임(겸임/계약/객원 등) 또는 시간강사": semester_status if not sem_displayed else "",
                    "학년도/학기": item['year_sem_str'] if not sem_displayed else "",
                    "구분": item['gu_bun'] if item['gu_bun'] != gu_bun_displayed else "",
                    "교과영역": item['area'],
                    "교과목명": item['course_name'],
                    "학점": str(item['credit']),
                    "비고": ""
                })
                prof_displayed = True
                sem_displayed = True
                gu_bun_displayed = item['gu_bun']
            
            # 소계 행
            result_rows.append({
                "교수진(이름)": "",
                "전임,비전임(겸임/계약/객원 등) 또는 시간강사": "",
                "학년도/학기": "",
                "구분": "소계",
                "교과영역": "",
                "교과목명": "",
                "학점": str(subtotal_cred),
                "비고": ""
            })

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [표 4.1.2-2] 전임교원 수업시수 현황 ★★★
# ==========================================
def fetch_custom_4_1_2_2(report_id="[표 4.1.2-2] 전임교원 수업시수 현황"):
    headers = [
        "연도", 
        "전임교원 명", 
        "책임 수업시수", 
        "1학기 수업시수", 
        "2학기 수업시수", 
        "1인당 총 수업시수", 
        "1인당 평균 수업시수", 
        "비고"
    ]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    df = load_merged_db("교수진 강의담당 분석")
    if df is None or df.empty:
        print("❌ [오류] '교수진 강의담당 분석' DB 파일을 찾을 수 없습니다.")
        return {"headers": headers, "rows": [], "message": "데이터 없음"}

    # 유연한 컬럼 찾기
    year_col = find_col(df, ['curr_year', '연도', '학년도', 'year'])
    prof_col = find_col(df, ['prof_name', '교수명', '담당교수', '성명'])
    fulltime_col = find_col(df, ['fulltime_type', '전임구분'])
    sem_col = find_col(df, ['semester', '학기'])
    hours_col = find_col(df, ['teaching_hours', '시수', '담당시수'])

    # 데이터 집계용 딕셔너리 {연도: {교수명: {'sem1': 0, 'sem2': 0}}}
    data_dict = {}

    for idx, row in df.iterrows():
        y_val = str(row.get(year_col, '')).strip() if year_col else ""
        year_match = re.search(r'20\d{2}', y_val)
        if not year_match:
            continue
        year_num = year_match.group()

        prof_name = str(row.get(prof_col, '')).strip() if prof_col else ""
        if not prof_name:
            continue

        ft_val = str(row.get(fulltime_col, '')).strip() if fulltime_col else ""
        
        # 1. '전임구분'에서 '전임'만 추출 ('비전임' 제외)
        if "전임" not in ft_val or "비전임" in ft_val:
            continue

        # 2. 학기 구분 (2학기라는 단어가 포함되어 있으면 2학기, 아니면 1학기로 간주)
        sem_val = str(row.get(sem_col, '')).strip() if sem_col else ""
        is_sem2 = "2" in sem_val

        # 3. 시수 추출
        h_raw = str(row.get(hours_col, '0')).strip()
        try:
            hours_num = int(float(h_raw))
        except:
            hours_num = 0

        # 딕셔너리에 데이터 누적
        if year_num not in data_dict:
            data_dict[year_num] = {}
        if prof_name not in data_dict[year_num]:
            data_dict[year_num][prof_name] = {'sem1': 0, 'sem2': 0}
        
        if is_sem2:
            data_dict[year_num][prof_name]['sem2'] += hours_num
        else:
            data_dict[year_num][prof_name]['sem1'] += hours_num

    # 4. 정렬 및 결과 조립
    result_rows = []
    sorted_years = sorted(data_dict.keys())
    
    for year in sorted_years:
        profs = sorted(data_dict[year].keys()) # 교수명 가나다(ㄱ-ㅎ) 순 정렬
        if not profs:
            continue
        
        year_displayed = False
        prof_count = len(profs)
        
        # 소계 계산용 변수들
        sum_s1 = 0
        sum_s2 = 0
        sum_total = 0
        sum_avg = 0.0
        
        for p in profs:
            s1 = data_dict[year][p]['sem1']
            s2 = data_dict[year][p]['sem2']
            total = s1 + s2
            
            # ⭐️ 각 전임 교수 당 (1학기 + 2학기) / 2
            avg = total / 2.0  
            
            # 소계용 데이터 누적
            sum_s1 += s1
            sum_s2 += s2
            sum_total += total
            sum_avg += avg
            
            # 소수점 처리 (딱 떨어지면 정수로, 아니면 소수점 첫째 자리까지)
            avg_str = f"{avg:.1f}".rstrip('0').rstrip('.') if avg % 1 != 0 else f"{int(avg)}"
            
            result_rows.append({
                "연도": year if not year_displayed else "", # 첫 줄에만 연도 표시
                "전임교원 명": p,
                "책임 수업시수": "",
                "1학기 수업시수": str(s1),
                "2학기 수업시수": str(s2),
                "1인당 총 수업시수": str(total),
                "1인당 평균 수업시수": avg_str,
                "비고": ""
            })
            year_displayed = True
            
        # ⭐️ 연도별 데이터 끝에 '소계' 행 추가
        # 1인당 평균 수업시수의 소계 = 1인당 평균 수업시수의 합 / 전임교원 수
        subtotal_avg = sum_avg / prof_count if prof_count > 0 else 0
        subtotal_avg_str = f"{subtotal_avg:.1f}".rstrip('0').rstrip('.') if subtotal_avg % 1 != 0 else f"{int(subtotal_avg)}"
        
        result_rows.append({
            "연도": "",
            "전임교원 명": "소계",
            "책임 수업시수": "",
            "1학기 수업시수": str(sum_s1),
            "2학기 수업시수": str(sum_s2),
            "1인당 총 수업시수": str(sum_total),
            "1인당 평균 수업시수": subtotal_avg_str,
            "비고": ""
        })

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [표 4.2.1-1] 필수이수 교과목에 대한 담당교수의 전공일치 현황 ★★★
# ==========================================
def fetch_custom_4_2_1_1(report_id="[표 4.2.1-1] 필수이수 교과목에 대한 담당교수의 전공일치 현황"):
    headers = [
        "연도", 
        "필수이수 교과목", 
        "개설학기", 
        "담당 교수명", 
        "구분", 
        "최종학위명", 
        "전공", 
        "학위취득교명", 
        "일치 여부", 
        "비고"
    ]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    # 1. DB 로드
    df_course = load_merged_db("교과목")
    df_assign = load_merged_db("교수진 강의담당 분석")

    if df_course is None or df_course.empty:
        return {"headers": headers, "rows": [], "message": "교과목 데이터 없음"}

    # 2. 컬럼 식별
    # 교과목 DB용
    c_name_col = find_col(df_course, ['교과목명', 'course_name'])
    c_area_col = find_col(df_course, ['교과영역_1', 'area_1'])
    c_sem_col = find_col(df_course, ['개설학년-학기', 'open_sem'])
    c_year_col = find_col(df_course, ['curr_year', '연도', '학년도', '구분'])

    # 교수진 배정 DB용 (학년, 학기 각각 식별)
    a_prof_col = find_col(df_assign, ['prof_name', '교수명', '성명'])
    a_course_col = find_col(df_assign, ['course_name', '교과목명'])
    a_grade_col = find_col(df_assign, ['grade', '학년']) # '학년' 항목
    a_sem_col = find_col(df_assign, ['semester', '학기']) # '학기' 항목
    a_year_col = find_col(df_assign, ['curr_year', '연도', '학년도'])
    a_ft_col = find_col(df_assign, ['fulltime_type', '전임구분'])

    target_years = ["2024", "2025", "2026"]
    result_rows = []

    for year in target_years:
        # 해당 연도 + 필수이수 과목 필터링
        df_year_req = df_course[
            (df_course[c_year_col].astype(str).str.contains(year, na=False)) &
            (df_course[c_area_col].astype(str).str.contains("필수이수", na=False))
        ].copy()

        if df_year_req.empty:
            continue

        # 필수이수 교과목 커스텀 순서 정렬
        df_year_req['sort_idx'] = df_year_req[c_name_col].apply(get_req_course_order)
        df_year_req = df_year_req.sort_values(by='sort_idx')

        year_displayed = False
        
        for _, c_row in df_year_req.iterrows():
            c_name = str(c_row.get(c_name_col, '')).strip()
            c_sem = str(c_row.get(c_sem_col, '')).strip() # 예: "1-1", "2-2"

            matched_prof_data = []

            # 교수 배정 DB와 대조
            if df_assign is not None and not df_assign.empty:
                # 해당 연도와 과목명이 같은 데이터들 1차 필터링
                df_assign_year = df_assign[
                    (df_assign[a_year_col].astype(str).str.contains(year, na=False)) &
                    (df_assign[a_course_col].astype(str) == c_name)
                ]

                for _, a_row in df_assign_year.iterrows():
                    # 학년과 학기를 가져와서 "학년-학기" 형식의 매칭 키 생성
                    grade_val = str(a_row.get(a_grade_col, '')).strip()
                    raw_sem_val = str(a_row.get(a_sem_col, '')).strip()
                    
                    # ⭐️ 학기 변환 (1학기 -> 1, 2학기 -> 2)
                    sem_num = "1" if "1" in raw_sem_val else ("2" if "2" in raw_sem_val else "")
                    
                    # 조합된 키: "1-1", "2-2" 등
                    a_sem_key = f"{grade_val}-{sem_num}"

                    # 교과목 DB의 개설학기(c_sem)와 정확히 일치하는지 확인
                    if a_sem_key == c_sem:
                        matched_prof_data.append({
                            "name": str(a_row.get(a_prof_col, '')).strip(),
                            "type": str(a_row.get(a_ft_col, '')).strip()
                        })

            # 매칭된 교수가 있는 경우 행 추가
            if matched_prof_data:
                for p_info in matched_prof_data:
                    result_rows.append({
                        "연도": year if not year_displayed else "",
                        "필수이수 교과목": c_name,
                        "개설학기": c_sem,
                        "담당 교수명": p_info["name"],
                        "구분": p_info["type"],
                        "최종학위명": "",
                        "전공": "",
                        "학위취득교명": "",
                        "일치 여부": "",
                        "비고": ""
                    })
                    year_displayed = True
            else:
                # 매칭된 교수가 없는 경우 (빈칸으로 행 유지)
                result_rows.append({
                    "연도": year if not year_displayed else "",
                    "필수이수 교과목": c_name,
                    "개설학기": c_sem,
                    "담당 교수명": "",
                    "구분": "",
                    "최종학위명": "",
                    "전공": "",
                    "학위취득교명": "",
                    "일치 여부": "",
                    "비고": ""
                })
                year_displayed = True

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [표 4.2.2-1] 필수 및 선택이수 교과목 전임교원 강의 학점 분담 비율 ★★★
# ==========================================
def fetch_custom_4_2_2_1(report_id="[표 4.2.2-1] 필수 및 선택이수 교과목 전임교원 강의 학점 분담 비율"):
    headers = [
        "연도", 
        "학기", 
        "교과목(임시)",
        "편성 필수 이수 총 학점", 
        "편성 선택이수 총 학점", 
        "학점 소계", 
        "담당 필수이수 학점", 
        "필수이수 학점 비율", 
        "담당 선택이수 학점", 
        "선택이수 학점 비율", 
        "담당 학점 계", 
        "담당 학점 비율"
    ]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    # 1. DB 로드
    df_course = load_merged_db("교과목")
    df_assign = load_merged_db("교수진 강의담당 분석")

    if df_course is None or df_course.empty:
        return {"headers": headers, "rows": [], "message": "교과목 데이터 없음"}

    # 2. 컬럼 식별
    # 교과목 DB용
    c_name_col = find_col(df_course, ['교과목명', 'course_name'])
    c_area_col = find_col(df_course, ['교과영역_1', 'area_1'])
    c_sem_col = find_col(df_course, ['개설학년-학기', 'open_sem'])
    c_year_col = find_col(df_course, ['curr_year', '연도', '학년도', '구분'])
    c_cred_col = find_col(df_course, ['학점구성-소계', 'total_cred', '학점', '졸업학점'])

    # 교수진 배정 DB용
    a_course_col = find_col(df_assign, ['course_name', '교과목명'])
    a_grade_col = find_col(df_assign, ['grade', '학년'])
    a_sem_col = find_col(df_assign, ['semester', '학기'])
    a_year_col = find_col(df_assign, ['curr_year', '연도', '학년도'])
    a_ft_col = find_col(df_assign, ['fulltime_type', '전임구분'])

    target_years = ["2024", "2025", "2026"]
    # 1-1 학기부터 4-2 학기까지
    semesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2']
    result_rows = []

    for year in target_years:
        year_displayed = False

        # 해당 연도 교과목 필터링 (필수이수 및 선택이수)
        df_c_year = df_course[
            (df_course[c_year_col].astype(str).str.contains(year, na=False)) &
            (df_course[c_area_col].astype(str).str.contains("필수이수|선택이수", na=False))
        ].copy()

        # 전임교원 담당 과목 세트 구성 (중복 방지)
        fulltime_courses = set()
        if df_assign is not None and not df_assign.empty:
            df_a_year = df_assign[
                (df_assign[a_year_col].astype(str).str.contains(year, na=False))
            ]
            for _, a_row in df_a_year.iterrows():
                ft_val = str(a_row.get(a_ft_col, '')).strip()
                
                # '전임'이 포함되고 '비전임'이 아닌 경우만 전임교원으로 간주
                if "전임" in ft_val and "비전임" not in ft_val:
                    c_name = str(a_row.get(a_course_col, '')).strip()
                    g_val = str(a_row.get(a_grade_col, '')).strip()
                    raw_s_val = str(a_row.get(a_sem_col, '')).strip()
                    
                    # 학기를 1과 2로 변환하여 "학년-학기" 키 생성 (예: 2-1)
                    s_num = "1" if "1" in raw_s_val else ("2" if "2" in raw_s_val else "")
                    sem_key = f"{g_val}-{s_num}"
                    
                    fulltime_courses.add((c_name, sem_key))

        for sem in semesters:
            # 해당 연도, 해당 학기 교과목 추출
            df_sem = df_c_year[df_c_year[c_sem_col].astype(str) == sem].copy()
            
            if df_sem.empty:
                continue

            # 커스텀 정렬 적용 (과거의 필수이수 지정 순서)
            if 'sort_idx' not in df_sem.columns:
                df_sem['sort_idx'] = df_sem[c_name_col].apply(get_req_course_order)
            df_sem = df_sem.sort_values(by='sort_idx')

            req_total = 0
            sel_total = 0
            req_ft_total = 0
            sel_ft_total = 0
            course_names = []

            for _, c_row in df_sem.iterrows():
                c_name = str(c_row.get(c_name_col, '')).strip()
                area = str(c_row.get(c_area_col, '')).strip()
                cred_raw = str(c_row.get(c_cred_col, '0')).strip()
                
                try:
                    cred = int(float(cred_raw))
                except:
                    cred = 0

                course_names.append(c_name)

                is_req = "필수이수" in area
                is_sel = "선택이수" in area
                
                # 전임교원 목록에 해당 과목과 학기가 들어있는지 매칭
                is_ft_taught = (c_name, sem) in fulltime_courses

                if is_req:
                    req_total += cred
                    if is_ft_taught:
                        req_ft_total += cred
                elif is_sel:
                    sel_total += cred
                    if is_ft_taught:
                        sel_ft_total += cred

            # 합계 및 비율 계산
            subtotal = req_total + sel_total
            ft_total = req_ft_total + sel_ft_total

            req_ratio = (req_ft_total / req_total * 100) if req_total > 0 else 0.0
            sel_ratio = (sel_ft_total / sel_total * 100) if sel_total > 0 else 0.0
            total_ratio = (ft_total / subtotal * 100) if subtotal > 0 else 0.0

            result_rows.append({
                "연도": year if not year_displayed else "",
                "학기": sem,
                "교과목(임시)": ", ".join(course_names), # 어떤 과목이 포함되었는지 확인
                "편성 필수 이수 총 학점": str(req_total),
                "편성 선택이수 총 학점": str(sel_total),
                "학점 소계": str(subtotal),
                "담당 필수이수 학점": str(req_ft_total),
                "필수이수 학점 비율": f"{req_ratio:.1f}%",
                "담당 선택이수 학점": str(sel_ft_total),
                "선택이수 학점 비율": f"{sel_ratio:.1f}%",
                "담당 학점 계": str(ft_total),
                "담당 학점 비율": f"{total_ratio:.1f}%"
            })
            year_displayed = True

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [표 4.2.2-2] 필수 및 선택이수 교과목별 전임/비전임 교수의 강의 시수 현황 ★★★
# ==========================================
def fetch_custom_4_2_2_2(report_id="[표 4.2.2-2] 필수 및 선택이수 교과목별 전임/비전임 교수의 강의 시수 현황"):
    headers = [
        "연도", 
        "학기", 
        "필수/선택 교과목명", 
        "전임/비전임", 
        "학점", 
        "시수", 
        "전임교원 담당 학점", 
        "전임교원 담당 시수", 
        "비고"
    ]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    # 1. DB 로드
    df_course = load_merged_db("교과목")
    df_assign = load_merged_db("교수진 강의담당 분석")

    if df_course is None or df_course.empty:
        return {"headers": headers, "rows": [], "message": "교과목 데이터 없음"}

    # 2. 컬럼 식별
    c_name_col = find_col(df_course, ['교과목명', 'course_name'])
    c_area_col = find_col(df_course, ['교과영역_1', 'area_1'])
    c_sem_col = find_col(df_course, ['개설학년-학기', 'open_sem'])
    c_year_col = find_col(df_course, ['curr_year', '연도', '학년도', '구분'])
    c_cred_col = find_col(df_course, ['학점구성-소계', 'total_cred', '학점'])
    # ⭐️ 시수 컬럼을 'hours' 변수명 우선으로 찾도록 수정
    c_hours_col = find_col(df_course, ['hours', '시수', '주당시수'])

    a_course_col = find_col(df_assign, ['course_name', '교과목명'])
    a_grade_col = find_col(df_assign, ['grade', '학년'])
    a_sem_col = find_col(df_assign, ['semester', '학기'])
    a_year_col = find_col(df_assign, ['curr_year', '연도', '학년도'])
    a_ft_col = find_col(df_assign, ['fulltime_type', '전임구분'])

    target_years = ["2024", "2025", "2026"]
    semesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2']
    result_rows = []

    for year in target_years:
        year_displayed = False
        
        sum_cred = 0
        sum_hours = 0
        sum_ft_cred = 0
        sum_ft_hours = 0

        # 해당 연도 필수/선택이수 과목 필터링
        df_c_year = df_course[
            (df_course[c_year_col].astype(str).str.contains(year, na=False)) &
            (df_course[c_area_col].astype(str).str.contains("필수이수|선택이수", na=False))
        ].copy()

        for sem in semesters:
            df_sem = df_c_year[df_c_year[c_sem_col].astype(str) == sem].copy()
            if df_sem.empty: continue

            # 기존 필수이수 순서 정렬 적용
            df_sem['sort_idx'] = df_sem[c_name_col].apply(get_req_course_order)
            df_sem = df_sem.sort_values(by='sort_idx')

            for _, c_row in df_sem.iterrows():
                c_name = str(c_row.get(c_name_col, '')).strip()
                cred = int(float(str(c_row.get(c_cred_col, '0'))))
                # ⭐️ 변수명 'hours'에서 시수 값 추출
                hours = int(float(str(c_row.get(c_hours_col, '0'))))

                # 전임/비전임 판단 로직
                ft_type = "비전임" 
                if df_assign is not None and not df_assign.empty:
                    df_matched = df_assign[
                        (df_assign[a_year_col].astype(str).str.contains(year, na=False)) &
                        (df_assign[a_course_col].astype(str) == c_name)
                    ]
                    
                    for _, a_row in df_matched.iterrows():
                        g_val = str(a_row.get(a_grade_col, '')).strip()
                        s_raw = str(a_row.get(a_sem_col, '')).strip()
                        s_num = "1" if "1" in s_raw else ("2" if "2" in s_raw else "")
                        if f"{g_val}-{s_num}" == sem:
                            raw_ft = str(a_row.get(a_ft_col, '')).strip()
                            if "전임" in raw_ft and "비전임" not in raw_ft:
                                ft_type = "전임"
                                break

                sum_cred += cred
                sum_hours += hours
                
                ft_cred_display = ""
                if ft_type == "전임":
                    ft_cred_display = str(cred)
                    sum_ft_cred += cred
                    sum_ft_hours += hours 

                result_rows.append({
                    "연도": year if not year_displayed else "",
                    "학기": sem,
                    "필수/선택 교과목명": c_name,
                    "전임/비전임": ft_type,
                    "학점": str(cred),
                    "시수": str(hours),
                    "전임교원 담당 학점": ft_cred_display,
                    "전임교원 담당 시수": "", # 요청대로 일반 행은 빈칸
                    "비고": ""
                })
                year_displayed = True

        # 연도별 소계 행 추가
        result_rows.append({
            "연도": "",
            "학기": "소계",
            "필수/선택 교과목명": "",
            "전임/비전임": "",
            "학점": str(sum_cred),
            "시수": str(sum_hours),
            "전임교원 담당 학점": str(sum_ft_cred),
            "전임교원 담당 시수": str(sum_ft_hours), # 소계에서만 시수 합계 표시
            "비고": ""
        })

    print(f"✅ [성공] {len(result_rows)}건의 결과 행을 생성했습니다.")
    return {"headers": headers, "rows": result_rows}

# ==========================================
# ★★★ [별책] 시간표 추출 로직 ★★★
# ==========================================
def fetch_timetable_report(report_id="[별책] 시간표"):
    headers = ["교수명", "학년도", "학기", "교시", "월", "화", "수", "목", "금"]
    print(f"\n🔍 [진단] {report_id} 분석 시작")

    df = load_merged_db("교수진 강의담당 분석")
    if df is None or df.empty:
        return {"headers": headers, "rows": [], "message": "데이터 없음"}

    # 컬럼 식별
    p_col = find_col(df, ['prof_name', '교수명'])
    y_col = find_col(df, ['curr_year', '연도', '학년도'])
    s_col = find_col(df, ['semester', '학기'])
    
    # 시간표 데이터 매핑용 (교수-연도-학기를 키로 사용)
    # structure: {(교수, 연도, 학기): {교시: {요일: 과목(강의실)}}}
    timetable_map = {}

    for _, row in df.iterrows():
        prof = str(row.get(p_col, '')).strip()
        year = str(row.get(y_col, '')).strip()
        sem = str(row.get(s_col, '')).strip()
        if not prof or not year: continue

        key = (prof, year, sem)
        if key not in timetable_map:
            timetable_map[key] = {p: {d: "" for d in ["월", "화", "수", "목", "금"]} for p in range(1, 13)}

        # 1차 수업 정보
        d1 = str(row.get('first_day', '')).strip()
        t1 = str(row.get('first_time', '')).strip().split(',')
        b1 = str(row.get('first_build', '')).strip()
        r1 = str(row.get('first_room', '')).strip()
        cname = str(row.get('course_name', '')).strip()

        for t in t1:
            if t.isdigit() and 1 <= int(t) <= 12 and d1 in timetable_map[key][int(t)]:
                timetable_map[key][int(t)][d1] = f"{cname}\n({b1} {r1})"

        # 2차 수업 정보
        d2 = str(row.get('second_day', '')).strip()
        t2 = str(row.get('second_time', '')).strip().split(',')
        b2 = str(row.get('second_build', '')).strip()
        r2 = str(row.get('second_room', '')).strip()

        for t in t2:
            if t.isdigit() and 1 <= int(t) <= 12 and d2 in timetable_map[key][int(t)]:
                timetable_map[key][int(t)][d2] = f"{cname}\n({b2} {r2})"

    # 결과 행 생성
    result_rows = []
    # 교수명 -> 연도 -> 학기 순으로 정렬
    sorted_keys = sorted(timetable_map.keys(), key=lambda x: (x[0], x[1], x[2]))

    for prof, year, sem in sorted_keys:
        first_row_in_group = True
        for period in range(1, 11): # 보통 10교시까지 표시
            row_data = {
                "교수명": prof if first_row_in_group else "",
                "학년도": year if first_row_in_group else "",
                "학기": sem if first_row_in_group else "",
                "교시": f"{period}교시",
                "월": timetable_map[(prof, year, sem)][period]["월"],
                "화": timetable_map[(prof, year, sem)][period]["화"],
                "수": timetable_map[(prof, year, sem)][period]["수"],
                "목": timetable_map[(prof, year, sem)][period]["목"],
                "금": timetable_map[(prof, year, sem)][period]["금"]
            }
            result_rows.append(row_data)
            first_row_in_group = False

    return {"headers": headers, "rows": result_rows}