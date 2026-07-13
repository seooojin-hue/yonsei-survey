import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Grid from '@toast-ui/react-grid';
import * as XLSX from 'xlsx'; 
import 'tui-grid/dist/tui-grid.css';

// ⭐️ 시수 자동 계산 함수: 쉼표(,)를 기준으로 개수를 셉니다!
const calculateSisu = (time1, time2) => {
  const getCount = (str) => {
    if (!str) return 0;
    return String(str).split(',').filter(x => x.trim() !== '').length;
  };
  return getCount(time1) + getCount(time2);
};

const ProfessorAssignmentPage = ({ yearFilter, onYearChange }) => {
  const [gridData, setGridData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [helperCourses, setHelperCourses] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [versionList, setVersionList] = useState([]);
  const [currentVersion, setCurrentVersion] = useState('Draft');
  const [lastUploadedFileName, setLastUploadedFileName] = useState(''); 
  const gridRef = useRef(null);

  const FIXED_YEARS = ['2022', '2023', '2024', '2025', '2026'];
  const BLDG_MAP = { '백': '백운관', '컨': '컨버전스', '창': '창조관', '미': '미래관', '청': '청송관' };

  const getVal = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
        return String(obj[k]).trim();
      }
    }
    return "";
  };

  const fetchCurriculumMaster = async () => {
    let masterData = [];
    const requests = FIXED_YEARS.map(y => 
      axios.get(`http://localhost:8000/api/load-draft/교과목`, { params: { year: y } })
        .then(res => res.data?.rows || (Array.isArray(res.data) ? res.data : []))
        .catch(() => [])
    );
    const results = await Promise.all(requests);
    results.forEach(rows => { masterData = [...masterData, ...rows]; });
    return masterData;
  };

  const loadAll = async (targetVersion = 'Draft') => {
    setLoading(true);
    try {
      const dbName = '교수진 강의담당 분석';
      const params = { year: yearFilter };

      const schemaRes = await axios.get(`http://localhost:8000/api/schema/${encodeURIComponent(dbName)}`, { params });
      if (schemaRes.data && schemaRes.data.columns) {
        let rawCols = schemaRes.data.columns;
        
        if (!rawCols.find(c => c.name === 'teaching_hours')) {
          rawCols.push({ name: 'teaching_hours', label: '시수' });
        }

        // ⭐️ 'univ_type'(대학구분)과 'fulltime_type'(전임구분)을 맨 뒤로 배치
        const desiredOrder = [
          'curr_year', 
          'prof_name', 
          'course_name', 
          'grade', 
          'semester', 
          'total_cred', 
          'teaching_hours', 
          'area_1', 
          'school_type', 
          'univ_type', 
          'fulltime_type' // 👈 맨 끝에 전임구분 추가
        ];
        
        let sortedCols = desiredOrder.map(name => rawCols.find(c => c.name === name)).filter(Boolean);
        rawCols.forEach(c => { if (!desiredOrder.includes(c.name)) sortedCols.push(c); });
        
        setColumns(sortedCols.map(c => ({ 
          header: c.label || c.name, 
          name: c.name, 
          align: 'center', 
          editor: 'text', 
          resizable: true 
        })));
      }

      let dataRes = (targetVersion === 'Draft') 
        ? await axios.get(`http://localhost:8000/api/load-draft/${encodeURIComponent(dbName)}`, { params })
        : await axios.get(`http://localhost:8000/api/load-version/${encodeURIComponent(dbName)}/${encodeURIComponent(targetVersion)}`);
      
      setGridData(dataRes.data?.rows || []);

      const vRes = await axios.get(`http://localhost:8000/api/versions/${encodeURIComponent(dbName)}`, { params });
      setVersionList(vRes.data.versions || []);
      
      const master = await fetchCurriculumMaster();
      setHelperCourses(master);

      setTimeout(() => gridRef.current?.getInstance().refreshLayout(), 200);
    } catch (e) { 
        console.error("로드 오류:", e); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => {
    loadAll('Draft');
    setCurrentVersion('Draft');
    setLastUploadedFileName(''); 
  }, [yearFilter]);

  const handleExcelDownload = () => {
    const gridInstance = gridRef.current?.getInstance();
    if (!gridInstance) return;
    const cleanData = gridInstance.getData().map(({ rowKey, _attributes, ...rest }) => rest);
    
    setLoading(true);
    axios.post(`http://localhost:8000/api/download/excel/${encodeURIComponent('교수진 강의담당 분석')}`, 
      { data: cleanData }, { responseType: 'blob' }
    ).then(res => {
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `교수진_강의담당_분석_${yearFilter}.xlsx`);
      document.body.appendChild(link); link.click(); link.remove();
    }).catch(err => {
      alert("엑셀 다운로드에 실패했습니다.");
    }).finally(() => setLoading(false));
  };

  const handleDeleteRows = () => {
    const grid = gridRef.current?.getInstance();
    if (!grid) return;
    const checkedRows = grid.getCheckedRowKeys();
    if (checkedRows.length === 0) { alert("삭제할 행을 선택해주세요."); return; }
    if (window.confirm(`${checkedRows.length}개의 행을 삭제하시겠습니까?`)) { grid.removeCheckedRows(); }
  };

  const handleAfterChange = (ev) => {
    const grid = gridRef.current?.getInstance();
    if (!grid) return;
    
    ev.changes.forEach(change => {
      if (change.columnName === 'first_build' || change.columnName === 'second_build') {
        const val = String(change.value || '').trim();
        if (BLDG_MAP[val]) {
          setTimeout(() => { grid.setValue(change.rowKey, change.columnName, BLDG_MAP[val]); }, 10);
        }
      }

      if (change.columnName === 'first_time' || change.columnName === 'second_time') {
        setTimeout(() => {
          const row = grid.getRow(change.rowKey);
          if (row) {
            const newSisu = calculateSisu(row.first_time, row.second_time);
            grid.setValue(change.rowKey, 'teaching_hours', newSisu);
          }
        }, 10);
      }
    });
  };

  const handleHandbookUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name === lastUploadedFileName) {
      alert("이미 동일한 파일을 업로드하셨습니다.");
      e.target.value = ''; return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
      
      if (data.length === 0) { alert("파일에 데이터가 없습니다."); return; }

      const firstRowSem = String(data[0]?.['학기'] || '');
      const detectedYear = firstRowSem.substring(0, 4);
      if (detectedYear !== yearFilter) {
        alert(`연도가 다릅니다. (현재 탭: ${yearFilter}년, 파일 데이터: ${detectedYear}년)`);
        e.target.value = ''; return;
      }

      const processedRows = data.map(row => {
        const t1 = row['시간1'];
        const t2 = row['시간2'];

        return {
          curr_year: yearFilter,
          prof_name: row['교수명'] || row['담당교수'] || '', 
          course_name: row['과목명'] || row['교과목명'] || '', 
          grade: row['학년'] || '',
          semester: row['학기']?.includes('-') ? row['학기'].split('-')[1] : row['학기'],
          total_cred: row['학점'] || '',
          teaching_hours: calculateSisu(t1, t2), 
          school_type: row['과목종별'] || row['이수구분'] || '', 
          first_build: BLDG_MAP[row['건물1']] || row['건물1'] || '', 
          first_room: row['호실1'] || '',
          first_day: row['요일1'] || '', 
          first_time: t1,
          second_build: BLDG_MAP[row['건물2']] || row['건물2'] || '', 
          second_room: row['호실2'] || '',
          second_day: row['요일2'] || '', 
          second_time: t2,
          univ_type: row['대학구분'] || row['대학'] || '', 
          fulltime_type: row['전임구분'] || '' // ⭐️ 전임구분 매핑 추가
        };
      });

      setGridData(prev => [...prev, ...processedRows]);
      setLastUploadedFileName(file.name);
      alert(`${processedRows.length}건의 데이터를 추가했습니다. (시수 자동 계산 완료)`);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleCheckCert = () => {
    const courses = helperCourses;
    if (!courses || courses.length === 0) { alert("비교할 교과목 데이터가 로드되지 않았습니다."); return; }
    const grid = gridRef.current?.getInstance();
    const allData = grid.getData();
    let count = 0;
    const currentYearStr = String(yearFilter).substring(0, 4);

    allData.forEach(row => {
      const schoolType = String(row.school_type || '').trim();
      if (schoolType.includes('전필') || schoolType.includes('전선')) {
        const inputName = String(row.course_name || '').replace(/[^가-힣a-zA-Z0-9]/g, '').trim();
        const inputGrade = String(row.grade || '').replace(/[^0-9]/g, '').trim();
        const inputSem = String(row.semester || '').replace(/[^0-9]/g, '').trim();
        const pattern = `${inputGrade}-${inputSem}`;

        const matched = courses.find(c => {
          const targetName = getVal(c, ['course_name', '교과목명']).replace(/[^가-힣a-zA-Z0-9]/g, '').trim();
          const targetYear = getVal(c, ['curr_year', '구분']).replace(/[^0-9]/g, '').substring(0, 4);
          const targetSemStr = getVal(c, ['open_sem', '개설학년-학기']);
          return targetName === inputName && targetYear === currentYearStr && targetSemStr.replace(/\s/g, '').includes(pattern);
        });

        if (matched) {
          const areaVal = getVal(matched, ['area_1', '교과영역_1']);
          grid.setValue(row.rowKey, 'area_1', areaVal);
          count++;
        }
      }
    });
    alert(count > 0 ? `${count}건의 과목 정보를 동기화했습니다.` : "일치하는 정보를 찾지 못했습니다.");
  };

  const handleTempSave = async () => {
    const cleanData = gridRef.current.getInstance().getData().map(({rowKey, _attributes, ...rest}) => rest);
    await axios.post(`http://localhost:8000/api/save/temp/${encodeURIComponent('교수진 강의담당 분석')}`, { data: cleanData, year: yearFilter });
    alert('임시 저장되었습니다.');
  };

  const handleFinalSave = async () => {
    if (!window.confirm("최종 저장하시겠습니까?")) return;
    const cleanData = gridRef.current.getInstance().getData().map(({rowKey, _attributes, ...rest}) => rest);
    await axios.post(`http://localhost:8000/api/save/final/${encodeURIComponent('교수진 강의담당 분석')}`, { data: cleanData, year: yearFilter });
    alert('최종 저장되었습니다.');
    loadAll('Draft');
  };

  return (
    <div className="p-0 h-100 d-flex flex-column bg-light">
      <div className="bg-white border-bottom p-3 shadow-sm d-flex justify-content-between align-items-center w-100">
        <div className="d-flex align-items-center gap-3">
          <span className="fs-5 fw-bold text-dark border-start border-4 border-primary ps-3">교수진 강의담당 분석</span>
          <select className="form-select form-select-sm w-auto shadow-sm fw-bold" value={currentVersion} 
            onChange={(e) => { setCurrentVersion(e.target.value); loadAll(e.target.value); }}> 
            <option value="Draft">파일 불러오기</option> 
            {versionList.map(v => <option key={v} value={v}>{v}</option>)} 
          </select>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success btn-sm shadow-sm fw-bold" onClick={() => document.getElementById('handbookUp').click()}>수강편람 업로드</button>
          <input type="file" id="handbookUp" hidden onChange={handleHandbookUpload} />
          <button className="btn btn-outline-primary btn-sm shadow-sm" onClick={handleExcelDownload}>엑셀 다운로드</button>
        </div>
      </div>

      <div className="bg-white px-3 border-bottom shadow-sm">
        <ul className="nav nav-tabs border-0 mt-2" style={{ gap: '4px' }}>
          {FIXED_YEARS.map(y => (
            <li className="nav-item" key={y}>
              <button className={`nav-link border-0 rounded-top transition-all ${yearFilter === String(y) ? 'fw-bold text-primary' : 'text-secondary'}`} 
                style={{ borderBottom: yearFilter === String(y) ? '3px solid #003366' : '3px solid transparent', backgroundColor: yearFilter === String(y) ? '#f8f9fa' : 'transparent', padding: '10px 20px' }}
                onClick={() => onYearChange(String(y))}> {y}학년도 </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-grow-1 p-3 overflow-hidden d-flex flex-column position-relative">
        {loading && (
          <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-50 d-flex justify-content-center align-items-center" style={{ zIndex: 1000 }}>
            <div className="spinner-border text-primary" />
          </div>
        )}
        <div className="card flex-grow-1 shadow-sm border-0 overflow-hidden">
          <div className="card-body p-0 h-100">
            <Grid ref={gridRef} data={gridData} columns={columns} bodyHeight="fitToParent" rowHeaders={['checkbox']} onAfterChange={handleAfterChange} />
          </div>
        </div>
      </div>

      <div className="bg-white border-top p-2 px-3 d-flex justify-content-end gap-2 align-items-center w-100 shadow-sm">
        <button className="btn btn-outline-danger btn-sm shadow-sm fw-bold" onClick={handleDeleteRows}>🗑️ 행 삭제</button>
        <button className="btn btn-outline-success btn-sm shadow-sm" onClick={() => gridRef.current?.getInstance().appendRow({})}>➕ 행 추가</button>
        <button className="btn btn-outline-info btn-sm shadow-sm fw-bold" onClick={handleCheckCert}>🔍 인증과목 확인</button>
        <button className="btn btn-outline-primary btn-sm shadow-sm fw-bold" onClick={handleTempSave}>임시 저장</button>
        <button className="btn btn-primary btn-sm shadow-sm fw-bold" onClick={handleFinalSave}>최종 저장</button>
      </div>
    </div>
  );
};
export default ProfessorAssignmentPage;