import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'; 
import DataGrid from './components/DataGrid';
import ReportOutput from './components/ReportOutput';
import MyungseseoPage from './MyungseseoPage';
import RulebookPage from './RulebookPage';
import ProfessorAssignmentPage from './ProfessorAssignmentPage';
import MeetingMinutesPage from './MeetingMinutesPage';
import CalendarPage from './CalendarPage'; 
import TimetableReportPage from './TimetableReportPage';
import GradePage from './GradePage'; // 👈 성적 페이지 불러오기
import SurveyPage from './SurveyPage'; // 👈 [추가됨] 설문지 페이지 불러오기

const COLORS = { primary: '#003366' };
const YEAR_SPLIT_DBS = ['교과목', '학생', '운영지원인력', '명세서', '교수진 강의담당 분석', '회의록'];
const EDITABLE_TABS_DBS = ['명세서', '학교현황', '운영', '지원'];
const FIXED_YEARS = ['2022', '2023', '2024', '2025', '2026'];

const facilityOptions = ["이론 강의실", "실무 실습실", "전산 실습실", "교수 연구실", "시간강사 준비실", "학과/학부 사무실", "해당없음"];
const semesterOptions = ["2022년 1학기", "2022년 2학기", "2023년 1학기", "2023년 2학기", "2024년 1학기", "2024년 2학기", "2025년 1학기", "2025년 2학기", "2026년 1학기"];

const getFacTypeKey = (s) => `fac_type_${s.substring(0, 4)}_${s.substring(6, 7)}`;

const sortClassroomColumns = (cols) => {
  const exactLabels = [
    '학년도', '학기', '전용/공용', '수용인원', '면적(m²)', '건물명', '호실'
  ];

  const orderedCols = [];
  const remainingCols = [];

  exactLabels.forEach(labelName => {
    const found = cols.find(c => c.label === labelName || c.header === labelName);
    if (found) orderedCols.push(found);
  });

  cols.forEach(c => {
    const colName = c.label || c.header;
    if (!exactLabels.includes(colName)) {
      remainingCols.push(c);
    }
  });

  return [...orderedCols, ...remainingCols];
};

const StatusIndicator = ({ status }) => {
  let percent = 0;
  const s = String(status || '').trim().toUpperCase();
  if (s.includes('%')) percent = parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
  else if (s === 'O' || s === '완료' || s === '100') percent = 100;
  else if (s === '진행중' || s === '진행' || s === '△') percent = 50;
  const color = percent === 100 ? '#28a745' : (percent > 0 ? '#ffc107' : 'rgba(255,255,255,0.1)');
  const trackColor = 'rgba(255,255,255,0.1)';
  return <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: `conic-gradient(${color} ${percent}%, ${trackColor} 0)`, border: `1px solid ${percent === 0 ? 'rgba(255,255,255,0.3)' : color}`, marginRight: '10px', flexShrink: 0 }} title={`진행사항: ${status || '정보 없음'}`} />;
};

function App() {
  const [roomYear, setRoomYear] = useState('2026');
  const [roomSemester, setRoomSemester] = useState('1학기');
  
  const [dbList, setDbList] = useState([]);      
  const [reportList, setReportList] = useState([]); 
  const [selectedDb, setSelectedDb] = useState(null); 
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  const [isInputMenuOpen, setIsInputMenuOpen] = useState(true);
  const [isOutputMenuOpen, setIsOutputMenuOpen] = useState(false);
  const [columns, setColumns] = useState([]);    
  const [gridData, setGridData] = useState([]);  
  const [loading, setLoading] = useState(false); 
  const [versionList, setVersionList] = useState([]);
  const [currentVersion, setCurrentVersion] = useState('Draft');
  const [yearFilter, setYearFilter] = useState('2024');
  
  const gridRef = useRef(null);

  const isYearSplitDb = useMemo(() => YEAR_SPLIT_DBS.includes(selectedDb), [selectedDb]);
  const isReadOnly = useMemo(() => currentVersion !== '' && currentVersion !== 'Draft', [currentVersion]);
  const isButtonDisabled = useMemo(() => !selectedDb || isReadOnly, [selectedDb, isReadOnly]);

  useEffect(() => {
    axios.get('http://localhost:8000/api/db-list').then(res => {
      const fetchedDbs = res.data.dbs || [];
      if (!fetchedDbs.includes('규정집')) fetchedDbs.push('규정집');
      if (!fetchedDbs.includes('회의록')) fetchedDbs.push('회의록');
      if (!fetchedDbs.includes('성적')) fetchedDbs.push('성적'); 
      if (!fetchedDbs.includes('설문지')) fetchedDbs.push('설문지'); // 👈 [추가됨] 백엔드에 없을 시 메뉴 강제 노출
      setDbList(fetchedDbs);
    });
    axios.get('http://localhost:8000/api/reports/list').then(res => setReportList(res.data || []));
  }, []);

  const handleDbSelect = (dbName, targetYear = null) => {
    const activeYear = targetYear || yearFilter; 
    setSelectedDb(dbName);
    setCurrentVersion('Draft');
    setSelectedReportId(null);

    // 👈 [추가됨] '설문지'도 API 호출 없이 바로 커스텀 화면을 띄우도록 예외 처리 목록에 추가
    if (dbName === '규정집' || dbName === '명세서' || dbName === '교수진 강의담당 분석' || dbName === '회의록' || dbName === '성적' || dbName === '설문지') return;

    setLoading(true);
    const params = YEAR_SPLIT_DBS.includes(dbName) ? { year: activeYear } : {};

    axios.get(`http://localhost:8000/api/schema/${encodeURIComponent(dbName)}`, { params })
      .then(res => {
        let rawCols = res.data.columns || [];
        if (dbName === '강의실') rawCols = sortClassroomColumns(rawCols);
        setColumns(rawCols.map(col => ({
          header: col.label || col.name, name: col.name, align: 'center', resizable: true,
          editor: (dbName === '강의실' && col.name.startsWith('fac_type_')) ? { type: 'select', options: { listItems: facilityOptions.map(opt => ({ text: opt, value: opt })) } } : 'text'
        })));
        return axios.get(`http://localhost:8000/api/load-draft/${encodeURIComponent(dbName)}`, { params });
      })
      .then(res => {
        setGridData(res.data.rows || []);
        axios.get(`http://localhost:8000/api/versions/${encodeURIComponent(dbName)}`, { params }).then(v => setVersionList(v.data.versions || []));
        setTimeout(() => gridRef.current?.getInstance().refreshLayout(), 200);
      })
      .finally(() => setLoading(false));
  };

  const handleExcelDownload = () => {
    const gridInstance = gridRef.current?.getInstance();
    if (!gridInstance) return;
    const cleanData = gridInstance.getData().map(({ rowKey, _attributes, ...rest }) => rest);
    axios.post(`http://localhost:8000/api/download/excel/${encodeURIComponent(selectedDb)}`, { data: cleanData }, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${selectedDb}_${yearFilter}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }).catch(err => {
        console.error(err);
        alert("엑셀 다운로드에 실패했습니다.");
      });
  };

  const handleTempSave = async () => {
    const cleanData = gridRef.current?.getInstance().getData().map(({ rowKey, _attributes, ...rest }) => rest);
    await axios.post(`http://localhost:8000/api/save/temp/${encodeURIComponent(selectedDb)}`, { data: cleanData, year: isYearSplitDb ? yearFilter : null });
    alert('임시 저장되었습니다.');
  };

  const handleFinalSave = async () => {
    if (!window.confirm("최종 저장하시겠습니까?")) return;
    const cleanData = gridRef.current?.getInstance().getData().map(({ rowKey, _attributes, ...rest }) => rest);
    await axios.post(`http://localhost:8000/api/save/final/${encodeURIComponent(selectedDb)}`, { data: cleanData, year: isYearSplitDb ? yearFilter : null });
    alert('최종 저장되었습니다.');
    handleDbSelect(selectedDb, yearFilter);
  };

  const handleExcelUpload = (e) => {
    const selectedFiles = e.target.files; 
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const fd = new FormData(); 
    for (let i = 0; i < selectedFiles.length; i++) {
      fd.append('files', selectedFiles[i]); 
    }
    if (isYearSplitDb) fd.append('year', yearFilter);
    
    setLoading(true); 
    axios.post(`http://localhost:8000/api/upload/${encodeURIComponent(selectedDb)}`, fd)
      .then(() => { 
        handleDbSelect(selectedDb, yearFilter); 
        alert(`${selectedFiles.length}개의 파일 업로드 성공!`); 
      })
      .catch((err) => {
        console.error("업로드 에러:", err);
        alert(`업로드 실패: ${err.response?.data?.detail || err.message}`);
      })
      .finally(() => { 
        setLoading(false); 
        e.target.value = ''; 
      });
  };

  const handleExtractRooms = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/extract-rooms');
      const result = response.data; 
      
      if (result.status === 'success') {
        if (result.has_other_building) {
          alert("알 수 없는 건물명('기타')이 포함되어 있습니다. 확인 후 저장하시겠습니까?");
        }
        
        const filteredRows = result.rows.filter(
          row => String(row.room_year) === roomYear && String(row.room_semester) === roomSemester
        );
        
        if (filteredRows.length === 0) {
            alert(`선택하신 ${roomYear}년 ${roomSemester}에 해당하는 강의실 데이터가 없습니다.\n(교수진 강의담당 분석 DB를 확인해 주세요.)`);
        } else {
            setGridData(filteredRows); 
            alert("데이터 자동 불러오기가 완료되었습니다.");
        }
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("강의실 데이터 추출 오류:", error);
      alert("데이터를 불러오는 중 오류가 발생했습니다."); 
    }
  };

  const handleAutoCompleteRooms = async () => {
    try {
      const response = await axios.get(`http://localhost:8000/api/auto-complete-rooms?current_year=${roomYear}&current_semester=${roomSemester}`);
      const result = response.data;
      
      if (result.status === 'success' && result.data) {
        const updatedRows = gridData.map(row => { 
          const key = `${row.room_building}_${row.room_number}`;
          if (result.data[key]) {
            return {
              ...row,
              room_capacity: result.data[key].room_capacity || row.room_capacity,
              room_area: result.data[key].room_area || row.room_area
            };
          }
          return row;
        });
        
        setGridData(updatedRows); 
        alert(`[${result.prev_term}] 데이터를 바탕으로 자동 완성이 완료되었습니다.`);
      } else {
        alert(result.message || "자동 완성할 직전 학기 데이터가 없습니다.");
      }
    } catch (error) {
      console.error("자동 완성 오류:", error);
      alert("자동 완성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="d-flex vh-100 w-100 overflow-hidden">
      {/* 🟢 사이드바 영역 */}
      <div className="bg-dark text-white d-flex flex-column shadow" style={{ width: '280px', minWidth: '280px', flexShrink: 0, zIndex: 10 }}>
        <div className="p-4 fs-5 fw-bold border-bottom border-secondary text-center" style={{ backgroundColor: COLORS.primary }}>Yonsei DataHub</div>
        <div className="flex-grow-1 overflow-auto p-2 custom-scrollbar">
          <div className="mb-4">
            
            {/* ⭐️ 캘린더 단독 메뉴 추가 (가장 위로 배치) */}
            <div className={`p-2 ps-4 mt-1 mb-3 rounded transition-all d-flex align-items-center ${activeTab === 'calendar' ? 'bg-info shadow-sm text-dark fw-bold' : 'text-white-50 hover-bg-secondary'}`} 
                 style={{ cursor: 'pointer', fontSize: '0.95rem' }} 
                 onClick={() => { setActiveTab('calendar'); setSelectedDb(null); setSelectedReportId(null); }}>
              <span className="me-2">📅</span> <span className="text-truncate">캘린더 및 시간표</span>
            </div>

            {/* 입력 DB 1 영역 */}
            <div className="p-2 small text-secondary fw-bold text-uppercase" style={{ cursor: 'pointer' }} onClick={() => setIsInputMenuOpen(!isInputMenuOpen)}> {isInputMenuOpen ? '▼' : '▶'} 입력 DB 1 </div>
            {/* 👇 [추가됨] 입력 DB 1 렌더링을 위한 배열 끝에 '설문지' 추가 */}
            {isInputMenuOpen && ['교과목', '교수진 강의담당 분석', '명세서', '규정집', '운영지원인력', '프로그램 최종성과 평가모델', '학생', '학교현황', '회의록', '성적', '설문지'].map(db => (
              dbList.includes(db) && (
                <div key={db} className={`p-2 ps-4 mt-1 rounded transition-all d-flex align-items-center ${selectedDb === db && activeTab === 'input' ? 'bg-primary shadow-sm' : 'text-white-50 hover-bg-secondary'}`} 
                     style={{ cursor: 'pointer', fontSize: '0.95rem' }} onClick={() => { setActiveTab('input'); handleDbSelect(db); }}>
                  <span className="me-2">🗂️</span> <span className="text-truncate">{db === '명세서' ? '교과목 명세서 & 강의계획서' : db === '설문지' ? '설문지 분석 시스템' : db}</span>
                </div>
              )
            ))}

            {/* 입력 DB 2 영역 */}
            <div className="p-2 mt-3 small text-secondary fw-bold text-uppercase" style={{ cursor: 'pointer' }} onClick={() => setIsInputMenuOpen(!isInputMenuOpen)}> {isInputMenuOpen ? '▼' : '▶'} 입력 DB 2 </div>
            {isInputMenuOpen && ['교수인적사항', '교수수업', '강의실'].map(db => (
              dbList.includes(db) && (
                <div key={db} className={`p-2 ps-4 mt-1 rounded transition-all d-flex align-items-center ${selectedDb === db && activeTab === 'input' ? 'bg-primary shadow-sm' : 'text-white-50 hover-bg-secondary'}`} 
                     style={{ cursor: 'pointer', fontSize: '0.95rem' }} onClick={() => { setActiveTab('input'); handleDbSelect(db); }}>
                  <span className="me-2">🗂️</span> <span className="text-truncate">{db}</span>
                </div>
              )
            ))}
          </div>
          <div>
            {/* 출력 보고서 영역 */}
            <div className="p-2 small text-secondary fw-bold text-uppercase" style={{ cursor: 'pointer' }} onClick={() => setIsOutputMenuOpen(!isOutputMenuOpen)}> {isOutputMenuOpen ? '▼' : '▶'} 출력 보고서 </div>
            {isOutputMenuOpen && reportList.map(r => (
              <div key={r.id} className={`p-2 ps-4 mt-1 rounded transition-all d-flex align-items-center ${selectedReportId === r.id && activeTab === 'output' ? 'bg-success shadow-sm text-white' : 'text-white-50 hover-bg-secondary'}`} 
                   style={{ cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => { setActiveTab('output'); setSelectedReportId(r.id); setSelectedDb(null); }}>
                <StatusIndicator status={r.status} /> <span className="text-truncate">{r.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🟢 메인 콘텐츠 영역 */}
      <div className="flex-grow-1 d-flex flex-column bg-light overflow-hidden">
        {activeTab === 'calendar' ? (
          <CalendarPage />
        ) : selectedReportId === '[별책] 시간표' ? ( 
          <TimetableReportPage />
        ) : activeTab === 'output' ? (
          <ReportOutput selectedReportId={selectedReportId} />
        ) : selectedDb === '명세서' ? (
          <MyungseseoPage yearFilter={yearFilter} onYearChange={setYearFilter} />
        ) : selectedDb === '교수진 강의담당 분석' ? (
          <ProfessorAssignmentPage yearFilter={yearFilter} onYearChange={setYearFilter} />
        ) : selectedDb === '회의록' ? ( 
          <MeetingMinutesPage yearFilter={yearFilter} />
        ) : selectedDb === '성적' ? ( 
          <GradePage yearFilter={yearFilter} onYearChange={setYearFilter} />
        ) : selectedDb === '설문지' ? (
  <div style={{ overflowY: 'auto', height: '100%' }}>
    <SurveyPage yearFilter={yearFilter} />
  </div>
        ) : selectedDb === '규정집' ? (
          <RulebookPage />
        ) : selectedDb ? (
          <>
            <div className="bg-white border-bottom p-3 shadow-sm d-flex justify-content-between align-items-center w-100">
              <div className="d-flex align-items-center gap-3">
                <span className="fs-5 fw-bold text-dark border-start border-4 border-primary ps-3">{selectedDb}</span>
                <select className="form-select form-select-sm w-auto shadow-sm fw-bold" value={currentVersion} onChange={(e) => { const v = e.target.value; setCurrentVersion(v); if (v === 'Draft') handleDbSelect(selectedDb, yearFilter); else axios.get(`http://localhost:8000/api/load-version/${encodeURIComponent(selectedDb)}/${encodeURIComponent(v)}`).then(res => setGridData(res.data.rows || [])); }}> 
                  <option value="Draft">파일 불러오기</option> 
                  {versionList.map(v => <option key={v} value={v}>{v}</option>)} 
                </select>
              </div>
              <div className="d-flex gap-2">
                {selectedDb !== '강의실' && (
                  <>
                    <button 
                      className="btn btn-outline-success btn-sm shadow-sm" 
                      disabled={isButtonDisabled} 
                      onClick={() => document.getElementById('exUp').click()}
                    >
                      엑셀 업로드
                    </button>
                    <input 
                      id="exUp" 
                      type="file" 
                      style={{ display: 'none' }} 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleExcelUpload} 
                      multiple 
                    />
                  </>
                )}
                <button className="btn btn-outline-primary btn-sm shadow-sm" onClick={handleExcelDownload}>엑셀 다운로드</button>
              </div>
            </div>

            {isYearSplitDb && (
              <div className="bg-white px-3 border-bottom shadow-sm">
                <ul className="nav nav-tabs border-0 mt-2" style={{ gap: '4px' }}>
                  {FIXED_YEARS.map(y => (
                    <li className="nav-item" key={y}>
                      <button className={`nav-link border-0 rounded-top transition-all ${yearFilter === String(y) ? 'fw-bold text-primary' : 'text-secondary'}`} style={{ borderBottom: yearFilter === String(y) ? '3px solid #003366' : '3px solid transparent', backgroundColor: yearFilter === String(y) ? '#f8f9fa' : 'transparent', padding: '10px 20px' }} onClick={() => { setYearFilter(String(y)); handleDbSelect(selectedDb, String(y)); }}>
                        {y}학년도
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedDb === '강의실' && (
              <div className="d-flex align-items-center gap-2 p-2 px-3 bg-light border-bottom">
                <span className="fw-bold me-2">조회 및 필터:</span>
                <select className="form-select form-select-sm w-auto shadow-sm" value={roomYear} onChange={(e) => setRoomYear(e.target.value)}>
                  {['2022', '2023', '2024', '2025', '2026'].map(year => (
                    <option key={year} value={year}>{year}학년도</option>
                  ))}
                </select>
                <select className="form-select form-select-sm w-auto shadow-sm" value={roomSemester} onChange={(e) => setRoomSemester(e.target.value)}>
                  {['1학기', '여름학기', '2학기', '겨울학기'].map(semester => (
                    <option key={semester} value={semester}>{semester}</option>
                  ))}
                </select>
                <div className="ms-auto d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm shadow-sm" onClick={handleExtractRooms}>데이터 자동 불러오기</button>
                  <button className="btn btn-outline-success btn-sm shadow-sm" onClick={handleAutoCompleteRooms}>자동 완성 (수용인원/면적)</button>
                </div>
              </div>
            )}

            <div className="flex-grow-1 p-3 overflow-hidden d-flex flex-column">
              <div className="card flex-grow-1 shadow-sm border-0 overflow-hidden">
                <div className="card-body p-0 h-100 position-relative">
                  {loading && <div className="position-absolute top-0 start-0 w-100 h-100 bg-white bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 100 }}><div className="spinner-border text-primary" /></div>}
                  <DataGrid ref={gridRef} columns={columns} data={gridData} readOnly={isButtonDisabled} />
                </div>
              </div>
            </div>

            <div className="bg-white border-top p-2 px-3 d-flex justify-content-end gap-2 align-items-center w-100 shadow-sm">
              <button className="btn btn-outline-success btn-sm shadow-sm" onClick={() => gridRef.current?.getInstance().appendRow({}, {focus:true})}>➕ 행 추가</button>
              <button className="btn btn-outline-secondary btn-sm shadow-sm" onClick={() => handleDbSelect(selectedDb, yearFilter)}>🔄 새로고침</button>
              <button className="btn btn-outline-primary btn-sm shadow-sm" onClick={handleTempSave} disabled={isButtonDisabled}> {isYearSplitDb ? `${yearFilter}년 임시 저장` : '임시 저장'} </button>
              <button className="btn btn-primary btn-sm shadow-sm fw-bold" onClick={handleFinalSave} disabled={isButtonDisabled}> {isYearSplitDb ? `${yearFilter}년 최종 저장` : '최종 저장'} </button>
            </div>
          </>
        ) : (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted bg-white bg-opacity-50"> <div className="display-1 opacity-25 mb-3">🗂️</div> <h3 className="fw-light">입력 DB를 선택해주세요</h3> </div>
        )}
      </div>
    </div>
  );
}

export default App;