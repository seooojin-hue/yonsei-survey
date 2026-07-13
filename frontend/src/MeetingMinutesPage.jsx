import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FIXED_YEARS = ['2022', '2023', '2024', '2025', '2026'];
const SEMESTERS = ['1학기', '2학기']; 

const parseSpecialContent = (contentStr) => {
  if (!contentStr) return null;
  if (typeof contentStr === 'object') return contentStr.isSpecial ? contentStr : null;
  try {
    let obj = contentStr;
    let maxDepth = 5; 
    while (typeof obj === 'string' && maxDepth > 0) {
      obj = JSON.parse(obj);
      maxDepth--;
    }
    if (obj && typeof obj === 'object' && obj.isSpecial) return obj;
  } catch (e) { return null; }
  return null;
};

export default function MeetingMinutesPage({ yearFilter: globalYear, onYearChange }) {
  const [currentYear, setCurrentYear] = onYearChange ? [globalYear, onYearChange] : useState('2026');
  const [currentSemester, setCurrentSemester] = useState('1학기');

  // ⭐️ [핵심] 모든 연도/학기의 데이터를 한 번에 관리하여 복제 및 덮어쓰기 방지
  const [allMinutes, setAllMinutes] = useState([]);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // ⭐️ 화면에 렌더링될 데이터는 전체 데이터에서 현재 탭 조건에 맞는 것만 즉시 필터링
  const minutes = allMinutes.filter(m => 
    String(m['연도']) === String(currentYear) && String(m['학기']) === currentSemester
  );

  // 탭 변경 시 선택 항목만 초기화 (서버 재요청 제거로 엄청나게 빨라짐)
  useEffect(() => {
    setSelectedMinute(null);
  }, [currentYear, currentSemester]);

  // 페이지 처음 진입 시 1번만 데이터 로드
  useEffect(() => {
    fetchMinutes();
  }, []);

  const fetchMinutes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/load-draft/회의록`);
      if (res.data && res.data.rows) {
        
        // ⭐️ [중복 제거 필터] 서버에서 2번 중복해서 보내주는 파일 병합 버그 원천 차단!
        const seen = new Set();
        const uniqueRows = [];
        
        for (let i = res.data.rows.length - 1; i >= 0; i--) {
          const r = res.data.rows[i];
          if (!r['주체'] && !r['내용']) continue; // 빈 행 무시
          
          // 주체, 일정, 내용 일부를 조합하여 절대 중복될 수 없는 지문(Hash) 생성
          const hash = `${r['연도']}_${r['학기']}_${r['주체']}_${r['회의 일정']}_${String(r['내용']).substring(0, 30)}`;
          
          if (!seen.has(hash)) {
            seen.add(hash);
            uniqueRows.unshift(r); // 최신 데이터 유지
          }
        }

        setAllMinutes(uniqueRows.map((row, idx) => ({ 
          ...row, 
          _id: Date.now() + idx,
          '장소': row['장소'] || '',
          '병합_안건_및_내용': row['내용'] || '' 
        })));
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleAddTemplate = async (templateName) => {
    let specialContent = '';
    let subjectName = templateName === '기본 양식' ? '기본 회의록' : `${templateName} 회의록`;

    if (templateName === '교육혁신위원회' || templateName === '평가관리위원회') {
      try {
        const isFirstSem = currentSemester === '1학기';
        const targetYear = isFirstSem ? String(Number(currentYear) - 1) : currentYear;
        const targetSuffix = isFirstSem ? '-2' : '-1'; 

        const res = await axios.get(`http://localhost:8000/api/load-draft/교과목?year=${targetYear}`);
        const rows = res.data.rows || [];
        const isChecked = (val) => ['O', 'Y', '1', 'TRUE', '적용', '○'].includes(String(val).toUpperCase().trim());
        const targetRows = rows.filter((r) => {
          const area = String(r['area_1'] || r['교과영역_1'] || '');
          const openSem = String(r['open_sem'] || r['개설학년/학기'] || '');
          return (area.includes('필수이수') || area.includes('선택이수')) && openSem.endsWith(targetSuffix);
        });

        if (templateName === '교육혁신위원회') {
          const mapper = (r) => ({ sem: r['open_sem'] || r['개설학년/학기'] || '', name: r['course_name'] || r['교과목명'] || '', note: '' });
          specialContent = JSON.stringify({ isSpecial: true, templateType: 'education', topContent: '', creative: targetRows.filter(r => isChecked(r['eval_method']) || isChecked(r['교수평가방법'])).map(mapper), effective: targetRows.filter(r => isChecked(r['teach_method']) || isChecked(r['교수학습방법'])).map(mapper), improvement: targetRows.map(mapper), bottomMemo: '' });
        } else if (templateName === '평가관리위원회') {
          const courses = targetRows.map(r => ({ name: r['course_name'] || r['교과목명'] || '', achieve: '', eval: '' }));
          specialContent = JSON.stringify({ isSpecial: true, templateType: 'evaluation', topContent: '', devPlan: { year: currentYear, contentRange: '', level: '', method: '', opinion: '', etc: '', courses: courses }, counseling: [{ prof: '', total: '', count: '', ratio: '' }], memos: [], bottomMemo: '' });
        }
      } catch (e) {
        specialContent = JSON.stringify({ isSpecial: true, topContent: '', bottomMemo: '' });
      }
    }

    const newMinute = { _id: Date.now(), '연도': currentYear, '학기': currentSemester, '주체': subjectName, '회의 일정': '', '회의 참석자 명단': '', '장소': '', '병합_안건_및_내용': specialContent };
    
    // ⭐️ 새 양식 추가 시 전체 리스트에 병합
    setAllMinutes([newMinute, ...allMinutes]);
    setSelectedMinute(newMinute);
    setShowTemplateMenu(false); 
  };

  const handleFieldChange = (field, value) => {
    if (!selectedMinute) return;
    const updated = { ...selectedMinute, [field]: value };
    setSelectedMinute(updated);
    setAllMinutes(allMinutes.map(m => m._id === selectedMinute._id ? updated : m));
  };

  const mutateSpecialData = (mutatorFunc) => {
    const specialData = parseSpecialContent(selectedMinute['병합_안건_및_내용']);
    if (!specialData) return;
    const newData = JSON.parse(JSON.stringify(specialData)); 
    mutatorFunc(newData);
    handleFieldChange('병합_안건_및_내용', JSON.stringify(newData));
  };

  // ⭐️ 영구 삭제 및 복제 방지
  const handleDelete = async () => {
    if (!selectedMinute) return;
    if (!window.confirm("현재 선택한 회의록을 삭제하시겠습니까?")) return;

    const updatedAll = allMinutes.filter(m => m._id !== selectedMinute._id);
    try {
      setLoading(true);
      // 현재 보고 있는 "해당 연도"의 모든 데이터를 서버에 덮어씌움
      const currentYearData = updatedAll.filter(m => String(m['연도']) === String(currentYear));
      const cleanData = currentYearData.map(m => ({
        '연도': m['연도'], '학기': m['학기'], '주체': m['주체'],
        '회의 일정': m['회의 일정'], '회의 참석자 명단': m['회의 참석자 명단'],
        '장소': m['장소'], '내용': m['병합_안건_및_내용'] 
      }));
      
      await axios.post(`http://localhost:8000/api/save/final/회의록`, { data: cleanData, year: currentYear });
      
      setAllMinutes(updatedAll);
      setSelectedMinute(null);
      alert("삭제되었습니다.");
      // ⭐️ 핵심: 불필요한 서버 재요청(fetchMinutes)을 제거하여 복제 부활을 완벽히 차단!
    } catch (err) { alert("삭제 반영 중 오류가 발생했습니다."); } finally { setLoading(false); }
  };

  // ⭐️ 완전한 데이터 보존 및 복제 방지 저장 로직
  const handleSaveCurrent = async () => {
    if (!selectedMinute) return;
    try {
      setLoading(true);
      // "해당 연도"의 1학기, 2학기 데이터 모두를 모아서 저장 (덮어쓰기 방지)
      const currentYearData = allMinutes.filter(m => String(m['연도']) === String(currentYear));
      const cleanData = currentYearData.map(m => ({ 
        '연도': m['연도'], '학기': m['학기'], '주체': m['주체'], 
        '회의 일정': m['회의 일정'], '회의 참석자 명단': m['회의 참석자 명단'], 
        '장소': m['장소'], '내용': m['병합_안건_및_내용'] 
      }));
      
      await axios.post(`http://localhost:8000/api/save/final/회의록`, { data: cleanData, year: currentYear });
      
      alert(`현재 연도(${currentYear})의 회의록이 안전하게 저장되었습니다.`);
      // ⭐️ 핵심: 서버 재요청 제거! 중복 증식 원천 차단.
    } catch (err) { alert('저장 중 오류가 발생했습니다.'); } finally { setLoading(false); }
  };

  const attendeesStr = selectedMinute?.['회의 참석자 명단'] || '';
  const attendeesList = attendeesStr.split(',').map(s => s.trim()).filter(s => s !== '');
  const displayAttendees = attendeesList.length > 0 ? attendeesList : [''];
  const specialData = selectedMinute ? parseSpecialContent(selectedMinute['병합_안건_및_내용']) : null;

  return (
    <div className="d-flex w-100 h-100 bg-light overflow-hidden">
      <div className="border-end bg-white d-flex flex-column flex-shrink-0" style={{ width: '300px', zIndex: 10 }}>
        <div className="p-3 border-bottom bg-light d-flex justify-content-between align-items-center shadow-sm position-relative">
          <span className="fw-bold text-primary" style={{ fontSize: '0.95rem' }}>📋 {currentYear} {currentSemester} 회의록</span>
          <div className="d-flex gap-2">
            {selectedMinute && <button className="btn btn-outline-danger btn-sm fw-bold shadow-sm px-2" onClick={handleDelete} title="삭제">🗑️</button>}
            <div className="dropdown">
              <button className="btn btn-primary btn-sm fw-bold shadow-sm" onClick={() => setShowTemplateMenu(!showTemplateMenu)}>➕ 추가</button>
              {showTemplateMenu && (
                <ul className="dropdown-menu show position-absolute end-0 mt-1 shadow" style={{ zIndex: 1000, minWidth: '180px' }}>
                  <li><button className="dropdown-item fw-bold text-dark py-2" onClick={() => handleAddTemplate('기본 양식')}>기본 양식</button></li>
                  <li><hr className="dropdown-divider my-1" /></li>
                  <li><button className="dropdown-item fw-bold text-primary py-2" onClick={() => handleAddTemplate('교육혁신위원회')}>교육혁신위원회 양식</button></li>
                  <li><button className="dropdown-item fw-bold text-success py-2" onClick={() => handleAddTemplate('평가관리위원회')}>평가관리위원회 양식</button></li>
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-auto p-2 flex-grow-1 custom-scrollbar" onClick={() => setShowTemplateMenu(false)}>
          {loading ? ( <div className="text-center mt-5"><div className="spinner-border text-primary"/></div> ) : minutes.length === 0 ? (
            <div className="text-center text-muted mt-5 px-3">등록된 회의록이 없습니다.</div>
          ) : (
            minutes.map((m) => (
              <div key={m._id} className={`card mb-2 shadow-sm ${selectedMinute?._id === m._id ? 'border-primary bg-primary text-white' : 'border-0 hover-shadow'}`} style={{ cursor: 'pointer', transition: 'all 0.1s' }} onClick={() => setSelectedMinute(m)}>
                <div className="card-body p-3">
                  <h6 className="card-title fw-bold mb-2 text-truncate">{m['주체'] || '(회의명 없음)'}</h6>
                  <div className={`small ${selectedMinute?._id === m._id ? 'text-white-50' : 'text-muted'}`}>📅 {m['회의 일정'] || '일정 미입력'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-grow-1 d-flex flex-column bg-white overflow-hidden">
        <div className="bg-light px-3 border-bottom shadow-sm flex-shrink-0 d-flex justify-content-between align-items-center z-1 position-relative" style={{ minHeight: '60px' }}>
          <div className="d-flex align-items-center gap-3 pt-2">
            <span className="fw-bold fs-5 text-dark border-start border-4 border-success ps-3 mb-2">회의록 관리</span>
            <ul className="nav nav-tabs border-0 m-0" style={{ gap: '4px' }}>
              {FIXED_YEARS.map(y => (
                <li className="nav-item" key={y}>
                  <button className={`nav-link border-0 rounded-top transition-all py-1 px-3 mb-0 ${currentYear === String(y) ? 'fw-bold text-success bg-white shadow-sm' : 'text-secondary bg-transparent'}`} style={{ borderBottom: currentYear === String(y) ? '3px solid #198754' : '3px solid transparent' }} onClick={() => setCurrentYear(String(y))}>{y}학년도</button>
                </li>
              ))}
            </ul>
            <div className="btn-group shadow-sm mb-2 ms-2" style={{ height: '32px' }}>
              {SEMESTERS.map(s => <button key={s} className={`btn btn-sm ${currentSemester === s ? 'btn-success fw-bold' : 'btn-outline-secondary bg-white'}`} onClick={() => setCurrentSemester(s)}>{s}</button>)}
            </div>
          </div>
        </div>
        
        <div className="overflow-auto p-4 flex-grow-1 bg-light d-flex justify-content-center custom-scrollbar" onClick={() => setShowTemplateMenu(false)}>
          {selectedMinute ? (
            <div className="bg-white border shadow-sm p-4 w-100" style={{ maxWidth: '1400px', height: 'fit-content' }}>
              <table className="table table-bordered border-dark align-middle text-center mb-0" style={{ tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '85%' }} /></colgroup>
                <tbody><tr><th className="bg-light py-3">회의명</th><td className="p-0"><input type="text" className="form-control border-0 text-center w-100 h-100 shadow-none px-3" style={{ fontSize: '1.1rem', fontWeight: 'bold' }} value={selectedMinute['주체'] || ''} onChange={(e) => handleFieldChange('주체', e.target.value)} /></td></tr></tbody>
              </table>

              <table className="table table-bordered border-dark border-top-0 align-middle text-center mb-0" style={{ tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '35%' }} /><col style={{ width: '15%' }} /><col style={{ width: '35%' }} /></colgroup>
                <tbody>
                  <tr>
                    <th className="bg-light py-3 border-top-0">일시</th><td className="p-0 border-top-0"><input type="text" className="form-control border-0 text-center w-100 h-100 shadow-none" value={selectedMinute['회의 일정'] || ''} onChange={(e) => handleFieldChange('회의 일정', e.target.value)} /></td>
                    <th className="bg-light py-3 border-top-0">장소</th><td className="p-0 border-top-0"><input type="text" className="form-control border-0 text-center w-100 h-100 shadow-none bg-white" value={selectedMinute['장소'] || ''} onChange={(e) => handleFieldChange('장소', e.target.value)} /></td>
                  </tr>
                  <tr><th className="bg-light py-3">참석자</th><td colSpan="3" className="p-0"><input type="text" className="form-control border-0 text-center w-100 h-100 shadow-none px-3" placeholder="쉼표(,)로 구분 (예: 김상미, 이호철)" value={selectedMinute['회의 참석자 명단'] || ''} onChange={(e) => handleFieldChange('회의 참석자 명단', e.target.value)} /></td></tr>
                </tbody>
              </table>

              <table className="table table-bordered border-dark border-top-0 align-middle text-center mb-0" style={{ tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '35%' }} /><col style={{ width: '15%' }} /><col style={{ width: '35%' }} /></colgroup>
                <tbody>
                  <tr><th colSpan="4" className="bg-light text-center fw-bold py-2 border-top-0" style={{ fontSize: '1rem' }}>회의 내용</th></tr>
                  <tr>
                    <td colSpan="4" className="p-0 text-start">
                      {specialData ? (
                        specialData.templateType === 'evaluation' ? (
                          <div className="p-4 bg-white">
                            <div className="d-flex mb-4 align-items-start"><div className="fw-bold text-success me-3 pt-1" style={{ minWidth: '40px' }}>내용</div><textarea className="form-control shadow-sm" style={{ resize: 'none', height: '80px' }} value={specialData.topContent} onChange={(e) => mutateSpecialData(d => d.topContent = e.target.value)} /></div>
                            <h6 className="fw-bold mb-3 text-primary">1. 발전계획 성과 검토</h6>
                            <EvalDevPlanTable devPlan={specialData.devPlan} mutateSpecialData={mutateSpecialData} />
                            <h6 className="fw-bold mt-5 mb-3 text-primary">2. 학기별 상담</h6>
                            <EvalCounselingTable counseling={specialData.counseling} mutateSpecialData={mutateSpecialData} />
                            {specialData.memos.map((memo, idx) => {
                              const title = typeof memo === 'object' ? memo.title : '메모';
                              const content = typeof memo === 'object' ? memo.content : memo;
                              return (
                                <div key={idx} className="mt-5 mb-3 p-3 bg-light rounded border">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="d-flex align-items-center w-75"><h6 className="fw-bold text-primary mb-0 me-2" style={{ whiteSpace: 'nowrap' }}>{idx + 3}.</h6><input type="text" className="form-control form-control-sm border-0 fw-bold text-primary bg-transparent px-2" style={{ fontSize: '1rem' }} value={title} onChange={e => mutateSpecialData(d => { if (typeof d.memos[idx] === 'string') d.memos[idx] = { title: e.target.value, content: d.memos[idx] }; else d.memos[idx].title = e.target.value; })} /></div>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => mutateSpecialData(d => d.memos.splice(idx, 1))}>🗑️ 삭제</button>
                                  </div>
                                  <textarea className="form-control shadow-sm" style={{ resize: 'none', height: '120px' }} value={content} onChange={e => mutateSpecialData(d => { if (typeof d.memos[idx] === 'string') d.memos[idx] = { title: '메모', content: e.target.value }; else d.memos[idx].content = e.target.value; })} />
                                </div>
                              );
                            })}
                            <button className="btn btn-outline-primary btn-sm w-100 mt-3 mb-4 shadow-sm fw-bold py-2" onClick={() => mutateSpecialData(d => d.memos.push({ title: '새 항목', content: '' }))}>➕ 새로운 안건(메모) 추가</button>
                            <textarea className="form-control mt-4 border-0 bg-light" style={{ resize: 'none', height: '150px' }} value={specialData.bottomMemo || ''} onChange={(e) => mutateSpecialData(d => d.bottomMemo = e.target.value)} placeholder="여기에 추가적인 메모를 작성하세요." />
                          </div>
                        ) : (
                          <div className="p-4 bg-white">
                            <div className="d-flex mb-4 align-items-start"><div className="fw-bold text-success me-3 pt-1" style={{ minWidth: '40px' }}>내용</div><textarea className="form-control shadow-sm" style={{ resize: 'none', height: '80px' }} value={specialData.topContent} onChange={(e) => mutateSpecialData(d => d.topContent = e.target.value)} /></div>
                            <h6 className="fw-bold mb-3 text-primary">1. 창의적 교수법</h6><CourseTable data={specialData.creative} onNoteChange={(idx, val) => mutateSpecialData(d => d.creative[idx].note = val)} />
                            <h6 className="fw-bold mt-4 mb-3 text-primary">2. 효과적 교수방법</h6><CourseTable data={specialData.effective} onNoteChange={(idx, val) => mutateSpecialData(d => d.effective[idx].note = val)} />
                            <h6 className="fw-bold mt-4 mb-3 text-primary">3. 교육과정 개선</h6><CourseTable data={specialData.improvement} onNoteChange={(idx, val) => mutateSpecialData(d => d.improvement[idx].note = val)} />
                            <textarea className="form-control mt-4 border-0 bg-light" style={{ resize: 'none', height: '150px' }} value={specialData.bottomMemo || ''} onChange={(e) => mutateSpecialData(d => d.bottomMemo = e.target.value)} placeholder="여기에 추가적인 메모를 작성하세요." />
                          </div>
                        )
                      ) : (
                        <textarea className="form-control border-0 w-100 h-100 shadow-none p-3" style={{ resize: 'none', minHeight: '350px', lineHeight: '1.8' }} value={selectedMinute['병합_안건_및_내용'] || ''} onChange={(e) => handleFieldChange('병합_안건_및_내용', e.target.value)} />
                      )}
                    </td>
                  </tr>
                  {displayAttendees.map((name, idx) => (
                    <tr key={`sign-${idx}`}>
                      {idx === 0 && <th className="bg-light py-3 align-middle" rowSpan={displayAttendees.length || 1}>참석자<br/>서명</th>}
                      <td className="p-2 text-center align-middle fw-bold" style={{ fontSize: '1.05rem', borderRight: '1px solid #dee2e6' }}>{name}</td>
                      <td colSpan="2" className="p-2 text-start align-middle text-muted ps-4">(서명)</td>
                    </tr>
                  ))}
                  <tr><td colSpan="4" className="text-start p-2 py-3 border-top-0" style={{ backgroundColor: '#fcfcfc' }}><span className="text-danger fw-bold small">*불가피한 경우, 외부참석자는 서명 생략 가능</span></td></tr>
                </tbody>
              </table>
            </div>
          ) : <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted"><div className="display-4 opacity-25 mb-3">📄</div>👈 양식을 추가해 주세요.</div>}
        </div>
        <div className="bg-white border-top p-2 px-3 d-flex justify-content-end align-items-center flex-shrink-0 shadow-sm">
           <button className="btn btn-success fw-bold shadow-sm px-4" onClick={handleSaveCurrent} disabled={!selectedMinute}>💾 현재 회의록 저장</button>
        </div>
      </div>
    </div>
  );
}

function EvalDevPlanTable({ devPlan, mutateSpecialData }) {
  const courses = devPlan.courses || [];
  const rowCount = courses.length > 0 ? courses.length : 1;
  const renderMergedTextarea = (value, field) => (
    <td rowSpan={rowCount} className="p-0 align-middle" style={{ height: '1px' }}>
      <textarea className="form-control border-0 w-100 h-100 bg-transparent text-center custom-scrollbar p-3" 
        style={{ resize: 'none', minHeight: '120px', outline: 'none', boxShadow: 'none', lineHeight: '1.6' }} 
        value={value} onChange={e => mutateSpecialData(d => d.devPlan[field] = e.target.value)} 
      />
    </td>
  );
  return (
    <table className="table table-bordered table-sm text-center align-middle mb-4 shadow-sm" style={{ fontSize: '0.85rem' }}>
      <thead className="table-light"><tr><th style={{ width: '8%' }}>학년도</th><th style={{ width: '18%' }}>해당교과</th><th style={{ width: '12%' }}>교육내용범위</th><th style={{ width: '8%' }}>수준</th><th style={{ width: '12%' }}>교육방법</th><th style={{ width: '12%' }}>개별평가의견</th><th style={{ width: '10%' }}>학습성과<br/>달성도</th><th style={{ width: '10%' }}>강의평가</th><th style={{ width: '10%' }}>기타</th></tr></thead>
      <tbody>
        {courses.length > 0 ? courses.map((c, i) => (
          <tr key={i}>{i === 0 && <td rowSpan={rowCount} className="bg-light fw-bold">{devPlan.year}</td>}<td className="fw-bold">{c.name}</td>
            {i === 0 && renderMergedTextarea(devPlan.contentRange, 'contentRange')}{i === 0 && renderMergedTextarea(devPlan.level, 'level')}{i === 0 && renderMergedTextarea(devPlan.method, 'method')}{i === 0 && renderMergedTextarea(devPlan.opinion, 'opinion')}
            <td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-3" value={c.achieve || ''} onChange={e => mutateSpecialData(d => d.devPlan.courses[i].achieve = e.target.value)} /></td>
            <td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-3" value={c.eval || ''} onChange={e => mutateSpecialData(d => d.devPlan.courses[i].eval = e.target.value)} /></td>
            {i === 0 && renderMergedTextarea(devPlan.etc, 'etc')}
          </tr>
        )) : <tr><td className="bg-light fw-bold">{devPlan.year}</td><td className="text-muted">해당 과목 없음</td>{renderMergedTextarea(devPlan.contentRange, 'contentRange')}{renderMergedTextarea(devPlan.level, 'level')}{renderMergedTextarea(devPlan.method, 'method')}{renderMergedTextarea(devPlan.opinion, 'opinion')}<td className="p-0"></td><td className="p-0"></td>{renderMergedTextarea(devPlan.etc, 'etc')}</tr>}
      </tbody>
    </table>
  );
}

function EvalCounselingTable({ counseling, mutateSpecialData }) {
  return (
    <>
      <table className="table table-bordered table-sm text-center align-middle mb-2 shadow-sm" style={{ fontSize: '0.85rem' }}>
        <thead className="table-light"><tr><th style={{ width: '25%' }}>담당교수</th><th style={{ width: '25%' }}>학생수</th><th style={{ width: '25%' }}>면담수</th><th style={{ width: '25%' }}>비율</th></tr></thead>
        <tbody>{counseling.map((row, i) => (
          <tr key={i}><td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-2" value={row.prof || ''} onChange={e => mutateSpecialData(d => d.counseling[i].prof = e.target.value)} /></td><td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-2" value={row.total || ''} onChange={e => mutateSpecialData(d => d.counseling[i].total = e.target.value)} /></td><td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-2" value={row.count || ''} onChange={e => mutateSpecialData(d => d.counseling[i].count = e.target.value)} /></td><td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-2" value={row.ratio || ''} onChange={e => mutateSpecialData(d => d.counseling[i].ratio = e.target.value)} /></td></tr>
        ))}</tbody>
      </table>
      <div className="text-end mb-4"><button className="btn btn-sm btn-outline-secondary fw-bold" onClick={() => mutateSpecialData(d => d.counseling.push({prof: '', total: '', count: '', ratio: ''}))}>➕ 학기별 상담 행 추가</button></div>
    </>
  );
}

function CourseTable({ data, onNoteChange }) {
  const safeData = Array.isArray(data) ? data : [];
  return (
    <table className="table table-bordered table-sm text-center align-middle mb-4 shadow-sm" style={{ fontSize: '0.85rem' }}>
      <thead className="table-light"><tr><th style={{ width: '20%' }}>개설학년/학기</th><th style={{ width: '40%' }}>교과목명</th><th>비고</th></tr></thead>
      <tbody>{safeData.length > 0 ? safeData.map((c, i) => (
        <tr key={i}><td>{c.sem}</td><td className="fw-bold">{c.name}</td><td className="p-0"><input type="text" className="form-control form-control-sm border-0 text-center bg-transparent py-2" value={c.note || ''} onChange={(e) => onNoteChange(i, e.target.value)} /></td></tr>
      )) : <tr><td colSpan="3" className="text-muted py-3">해당 과목이 없습니다.</td></tr>}</tbody>
    </table>
  );
}