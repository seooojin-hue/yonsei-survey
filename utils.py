import pandas as pd
import os
import re
import glob
from config import COLUMN_ALIAS, UPLOAD_DIR, smart_read_df, schema_manager

# ==========================================
# 1. 데이터 추출 도구 (중복 컬럼 및 에러 방지형)
# ==========================================
def get_val_smart(row, std_key):
    """
    std_key와 그 별칭들 중 데이터가 있는 첫 번째 값을 반환합니다.
    동일한 이름의 컬럼이 여러 개 있어 Series가 반환되는 상황을 안전하게 처리합니다.
    """
    # 확인할 키 후보들 (표준 키 + 별칭 리스트)
    keys_to_check = [std_key] + COLUMN_ALIAS.get(std_key, [])
    
    for k in keys_to_check:
        if k in row:
            val = row[k]
            
            # [핵심 수정] 만약 같은 이름의 컬럼이 여러 개라 Series가 반환되면 처리
            if isinstance(val, pd.Series):
                # 실제 값이 있는(NaN이 아닌) 항목들만 필터링
                valid_vals = val[pd.notna(val)]
                if not valid_vals.empty:
                    val = valid_vals.iloc[0]
                else:
                    continue # 다음 키로 넘어감
            
            # 단일 값일 경우 빈 문자열이 아닌지 확인 후 반환
            if pd.notna(val) and str(val).strip() != "":
                return str(val).strip()
                
    return ""

# ==========================================
# 2. 이수구분 판별기 (필수/선택)
# ==========================================
def is_required_course(row):
    """행 데이터를 보고 필수이수(전필, 교필 등) 여부를 판별합니다."""
    val1 = str(get_val_smart(row, "area_1")).replace(" ", "")
    val2 = str(row.get("학교이수구분", "")).replace(" ", "")
    keywords = ['전필', '교필', '전공필수', '필수교양', '필수이수', 'major_req', 'gen_req']
    return any(kw in val1 for kw in keywords) or any(kw in val2 for kw in keywords)

def is_elective_course(row):
    """행 데이터를 보고 선택이수(전선, 교선 등) 여부를 판별합니다."""
    val1 = str(get_val_smart(row, "area_1")).replace(" ", "")
    val2 = str(row.get("학교이수구분", "")).replace(" ", "")
    # '전선', '교선' 등 모든 선택 관련 키워드 포함
    elective_keywords = ['전선', '교선', '선택이수', 'major_sel', 'gen_sel', '전공선택', '교양선택', '전공심화']
    return any(kw in val1 for kw in elective_keywords) or any(kw in val2 for kw in elective_keywords)

# ==========================================
# 3. DB 로드 및 도구 함수들
# ==========================================
def find_col(df, candidates):
    """리스트에 있는 후보 이름 중 데이터프레임에 존재하는 컬럼명을 찾습니다."""
    cols = [str(c).strip() for c in df.columns]
    for cand in candidates:
        if cand in cols: return cand
    for cand in candidates:
        for c in cols:
            if cand in c: return c
    return None

def load_merged_db(db_keyword: str):
    """지정된 DB 폴더 내의 모든 CSV/Excel 파일을 하나로 합쳐서 가져옵니다."""
    target_dir = os.path.join(UPLOAD_DIR, db_keyword)
    if not os.path.exists(target_dir): return None
    
    df_list = []
    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.lower().endswith(('.csv', '.xlsx')):
                df = smart_read_df(os.path.join(root, file))
                if df is not None: df_list.append(df)
    
    if not df_list: return None
    return pd.concat(df_list, ignore_index=True)

def get_db_dataframe(db_name: str):
    """DB 폴더 내의 모든 파일을 유연하게 읽어 통합 (오류 메시지 포함 반환)"""
    df = load_merged_db(db_name) 
    if df is None or df.empty:
        return None, f"'{db_name}' 폴더에 데이터 파일이 없습니다."
    return df, None

def apply_aliases_and_template(df, template_headers, db_name):
    """보고서 양식에 맞춰 컬럼명을 변경하고 데이터를 정렬합니다."""
    schema_cols = schema_manager.get_columns(db_name)
    if schema_cols:
        reverse_map = {col['name']: col['label'] for col in schema_cols}
        df.rename(columns=reverse_map, inplace=True)

    final_rows = []
    for _, row in df.iterrows():
        new_row = {}
        for header in template_headers:
            val = get_val_smart(row, header)
            new_row[header] = val
        final_rows.append(new_row)
    return final_rows

def normalize_headers_with_alias(df):
    """데이터프레임의 모든 컬럼명을 COLUMN_ALIAS에 정의된 표준 키로 변환합니다."""
    df.columns = df.columns.astype(str).str.strip()
    # 보호막 설정: 이 이름들은 변환 과정에서 제외 (이미 정규화되었거나 특수 목적)
    protected_cols = ['구분', '특성화학습영역', 'curr_year', 'specialized_area']
    new_columns = {}
    
    for col in df.columns:
        if col in COLUMN_ALIAS or col in protected_cols:
            continue
            
        found = False
        # 1. 직접 매핑 확인
        for std, aliases in COLUMN_ALIAS.items():
            if col in aliases:
                new_columns[col] = std
                found = True; break
        
        # 2. 퍼지 매핑 (공백 무시) 확인
        if not found:
            col_simple = re.sub(r'[\s_]', '', col)
            for std, aliases in COLUMN_ALIAS.items():
                for alias in aliases:
                    if col_simple == re.sub(r'[\s_]', '', alias):
                        new_columns[col] = std
                        found = True; break
                if found: break
                
    if new_columns:
        df.rename(columns=new_columns, inplace=True)
    return df

def enforce_year_sorting(df, db_name=""):
    """데이터를 연도 내림차순으로 정렬합니다."""
    exclusion_keywords = ["강의실", "프로그램 최종성과 평가모델", "교수인적사항", "교수수업"]
    if any(keyword in db_name for keyword in exclusion_keywords):
        return df

    target_col = None
    for col in df.columns:
        c_str = str(col).lower().replace(" ", "")
        if "학년도" in c_str or "연도" in c_str or "year" in c_str:
            target_col = col; break
            
    if target_col:
        try:
            df['__sort_temp'] = pd.to_numeric(df[target_col], errors='coerce')
            df = df.sort_values(by='__sort_temp', ascending=False)
            df = df.drop(columns=['__sort_temp'])
        except: pass
    return df

def process_upload_data(temp_path, original_filename, db_name):
    """업로드된 파일을 읽고 연도 정보를 추출하여 저장용 DF를 만듭니다."""
    dfs = []
    
    if original_filename.lower().endswith(('.xlsx', '.xls')):
        try:
            sheets_dict = pd.read_excel(temp_path, sheet_name=None, engine='openpyxl')
            for sheet_name, df_sheet in sheets_dict.items():
                if df_sheet.empty: continue
                year_match = re.search(r'20\d{2}', str(sheet_name))
                df_sheet['_extracted_year_'] = year_match.group(0) if year_match else str(sheet_name)
                dfs.append(df_sheet)
        except:
            df = smart_read_df(temp_path)
            if df is not None: dfs.append(df)
    else:
        df = smart_read_df(temp_path)
        if df is not None: dfs.append(df)

    if not dfs: raise Exception("데이터를 읽을 수 없습니다.")
    final_df = pd.concat(dfs, ignore_index=True)

    exclusion_keywords = ["강의실", "프로그램 최종성과 평가모델", "교수인적사항", "교수수업"]
    if any(kw in db_name for kw in exclusion_keywords):
        if '_extracted_year_' in final_df.columns:
            final_df.drop(columns=['_extracted_year_'], inplace=True)
        return final_df

    target_year_vals = final_df.get('_extracted_year_')
    if target_year_vals is None:
        year_src_col = find_col(final_df, ['구분', '입학일시', '입학년도', '학번'])
        if year_src_col:
            raw_data = final_df[year_src_col].astype(str)
            if year_src_col in ['학번', '입학일시']:
                target_year_vals = raw_data.str.slice(0, 4)
            else:
                target_year_vals = raw_data.str.extract(r'(20\d{2})')[0]

    if target_year_vals is not None:
        target_col = find_col(final_df, ['연도']) or '연도'
        final_df[target_col] = final_df.get(target_col, pd.Series([None]*len(final_df))).fillna(target_year_vals)

    if '_extracted_year_' in final_df.columns:
        final_df.drop(columns=['_extracted_year_'], inplace=True)
        
    return final_df