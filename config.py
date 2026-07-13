import os
import re
import pandas as pd

# 기본 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
REFERENCE_FILE_PATH = os.path.join(BASE_DIR, "DB 자료형 구분.xlsx")
TEMPLATE_FILE_PATH = os.path.join(BASE_DIR, "표 컬럼.xlsx")

# 동의어(별칭) 사전 (중복 제거된 최종 버전)
COLUMN_ALIAS = {
    "성명": ["교수명", "이름", "prof_name", "Name", "성명(한글)", "직원명", "담당교수명", "교수"],
    "교수명": ["성명", "이름", "Name", "담당교수"],
    "전공": ["학과", "소속", "major", "dept"],
    "임용일자": ["임용일", "발령일", "hire_date", "start_date"],
    "비고": ["Note", "memo", "기타"],
    "담당시수": ["시수", "주당시수", "주당담당시수", "수업시수", "hours", "teaching_hours", "학점"],
    "교과목명": ["과목명", "수업명", "course_name", "subject", "강좌명"],
    "course_desc": ["교과목개요", "학습내용요약", "개요", "description", "summary"],
    "연도": ["구분", "학년도", "연도", "year", "curr_year", "curr"],
    "area_1": ["교과영역_1", "교과영역", "인증이수구분", "이수영역", "area_1"],
    "school_type": ["학교이수구분", "이수구분", "과목종별", "school_type"],
    "대학구분": ["대학", "소속대학", "univ_type", "University"],

    "theory_cred": ["이론학점", "theory_cred", "이론", "theory", "학점구성-이론"],
    "prac_cred": ["실습학점", "prac_cred", "실습", "practice", "학점구성-실습"],
    "total_cred": ["총학점", "total_cred", "학점", "학점소계", "학점구성-소계"],
    "open_sem": ["개설학년학기", "open_sem", "개설", "학년-학기", "개설학기", "개설학년-학기"],
    "직위": ["직급", "prof_position", "Position", "직위구분", "Rank"],
    "직급": ["직위", "prof_position", "Position", "직위구분", "Rank"],
    "specialized_area": ["특성화학습영역", "특성화영역", "구분영역_2", "교과영역_2", "area_2"],
    "시수": ["hours", "총시수", "수업시수", "시간", "시수(시간)", "주당시수", "총수업시수"]
}

def smart_read_df(file_path, **kwargs):
    if not os.path.exists(file_path): return None
    if file_path.lower().endswith(('.xlsx', '.xls')):
        return pd.read_excel(file_path, engine='openpyxl', **kwargs)
    for enc in ['utf-8-sig', 'cp949', 'utf-8', 'euc-kr']:
        try: return pd.read_csv(file_path, encoding=enc, **kwargs)
        except: continue
    return None

# ==========================================
# 3. 표 양식(Template) 파서
# ==========================================
REPORT_TEMPLATES = {}

def normalize_title(title):
    if not isinstance(title, str): return str(title)
    return re.sub(r'\s+', '', title).strip()

REPORT_TEMPLATES = {}

def normalize_title(title):
    if not isinstance(title, str): return str(title)
    return re.sub(r'\s+', '', title).strip()

def load_report_templates():
    df = smart_read_df(TEMPLATE_FILE_PATH, header=None)
    
    if df is None:
        print(f"⚠️ [양식 로드 실패] '{TEMPLATE_FILE_PATH}' 파일이 없습니다.")
        return

    for r_idx, row in df.iterrows():
        for c_idx, cell_value in enumerate(row):
            cell_str = str(cell_value).strip()
            if pd.notna(cell_value) and cell_str.startswith("[") and ("표" in cell_str or "별표" in cell_str):
                title = normalize_title(cell_str)
                if title in REPORT_TEMPLATES: continue
                if r_idx + 1 >= len(df): continue
                    
                headers = []
                next_row = df.iloc[r_idx + 1]
                for scan_c in range(c_idx, df.shape[1]):
                    if scan_c >= len(next_row): break
                    header_val = next_row.iloc[scan_c]
                    if pd.isna(header_val) or str(header_val).strip() == "": break
                    headers.append(str(header_val).strip())
                
                if headers:
                    REPORT_TEMPLATES[title] = headers
                    print(f"✅ [양식 등록] {title} ({len(headers)}개 컬럼)")

# ==========================================
# 4. 스키마 매니저
# ==========================================
class SchemaManager:
    def __init__(self, file_path: str = REFERENCE_FILE_PATH):
        self.file_path = file_path
        self.schemas = {}

    def load_schema(self):
        if not os.path.exists(self.file_path): 
            print(f"❌ 설정 파일 없음: {self.file_path}")
            return {}
        try: 
            df = pd.read_excel(self.file_path, header=None, engine='openpyxl')
        except Exception as e: 
            print(f"❌ 엑셀 로드 실패: {e}")
            return {}
        
        db_indices = {}
        row0 = df.iloc[0]
        # ★ 수정: 모든 열을 검사하여 <...> 태그가 있는 모든 DB를 다 찾아냅니다.
        for idx, val in enumerate(row0):
            val_str = str(val).strip()
            if pd.notna(val) and val_str.startswith('<') and val_str.endswith('>'):
                db_name = val_str.replace('<', '').replace('>', '').strip()
                db_indices[db_name] = idx
        
        print(f"🔍 발견된 DB 목록: {list(db_indices.keys())}")

        sorted_indices = sorted(db_indices.items(), key=lambda x: x[1])
        for i, (db_name, start_idx) in enumerate(sorted_indices):
            end_idx = sorted_indices[i+1][1] if i + 1 < len(sorted_indices) else df.shape[1]
            block = df.iloc[1:, start_idx:end_idx].copy()
            
            # 헤더 행 정규화
            header_row = block.iloc[0].astype(str).str.strip()
            block.columns = header_row
            block = block[1:].reset_index(drop=True)
            
            # 컬럼명 유연하게 찾기
            label_col = next((c for c in block.columns if '항목' in c), None)
            name_col = next((c for c in block.columns if '변수명' in c), None)
            type_col = next((c for c in block.columns if '형태' in c), '형태')

            if not label_col or not name_col:
                print(f"⚠️ {db_name} DB에서 '항목' 또는 '변수명' 컬럼을 찾을 수 없음")
                continue

            columns_info = []
            for _, row in block.iterrows():
                l_val = str(row.get(label_col, '')).strip()
                n_val = str(row.get(name_col, '')).strip()
                if not l_val or l_val == 'nan' or not n_val or n_val == 'nan': continue
                
                columns_info.append({
                    "label": l_val, 
                    "name": n_val, 
                    "type": str(row.get(type_col, '문자열'))
                })
            self.schemas[db_name] = columns_info

        return self.schemas

    def get_db_list(self):
        if not self.schemas: self.load_schema()
        return list(self.schemas.keys())
    
    def get_columns(self, db_name: str, dynamic_cols=None):
        if not self.schemas: self.load_schema()
        
        # ⭐️ 회의록 DB 구조 강제 고정
        if db_name == "회의록":
            return [
                {"label": "연도", "name": "연도"},
                {"label": "학기", "name": "학기"}, # 학기 누락 방지 추가
                {"label": "회의 일정", "name": "회의 일정"},
                {"label": "장소", "name": "장소"}, # 장소 누락 방지 추가
                {"label": "회의 참석자 명단", "name": "회의 참석자 명단"},
                {"label": "주체", "name": "주체"},
                {"label": "내용", "name": "내용"}
            ]
        
        # ⭐️ 교수진 강의담당 분석 DB 구조 완벽 매핑 (새로 추가됨)
        if db_name == "교수진 강의담당 분석":
            return [
                {"label": "교수명", "name": "prof_name"},    # 👈 여기를 '담당교수'에서 '교수명'으로 변경!
                {"label": "교과목명", "name": "course_name"},
                {"label": "학년", "name": "grade"},
                {"label": "학기", "name": "semester"},
                {"label": "학점", "name": "total_cred"},
                {"label": "시수", "name": "teaching_hours"},
                {"label": "이수구분(인증)", "name": "area_1"},
                {"label": "과목종별", "name": "school_type"},
                {"label": "건물1", "name": "first_build"},
                {"label": "호실1", "name": "first_room"},
                {"label": "요일1", "name": "first_day"},
                {"label": "시간1", "name": "first_time"},
                {"label": "건물2", "name": "second_build"},
                {"label": "호실2", "name": "second_room"},
                {"label": "요일2", "name": "second_day"},
                {"label": "시간2", "name": "second_time"},
                {"label": "대학구분", "name": "univ_type"},
                {"label": "전임구분", "name": "fulltime_type"}
            ]
        
        # ⭐️ 캘린더 DB 구조 추가 (수동 등록용)
        if db_name == "캘린더":
            return [
                {"label": "연도", "name": "curr_year"},
                {"label": "일자", "name": "event_date"},
                {"label": "행사명", "name": "title"},
                {"label": "장소", "name": "location"},
                {"label": "내용", "name": "description"},
                {"label": "증빙서류명", "name": "file_name"},
                {"label": "파일경로", "name": "file_path"}
            ]
        
        # 강의실 DB 특수 로직
        if db_name == "강의실":
            fixed_cols = [
                {"label": "학년도", "name": "room_year"},
                {"label": "학기", "name": "room_semester"},
                {"label": "전용/공용", "name": "room_usage_type"},
                {"label": "수용인원", "name": "room_capacity"},
                {"label": "면적(m²)", "name": "room_area"},
                {"label": "건물명", "name": "room_building"},
                {"label": "호실", "name": "room_number"}
            ]
            dynamic_fields = []
            if dynamic_cols:
                fac_keys = sorted([c for c in dynamic_cols if str(c).startswith('fac_type_')], reverse=True)
                for k in fac_keys:
                    parts = k.split('_')
                    label = f"{parts[2]}년 {parts[3]}학기" if len(parts) >= 4 else k
                    dynamic_fields.append({"label": label, "name": k})
            return fixed_cols + dynamic_fields
            
        return self.schemas.get(db_name, [])
    

schema_manager = SchemaManager()