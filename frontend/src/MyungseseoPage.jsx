import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Grid from '@toast-ui/react-grid';
import 'tui-grid/dist/tui-grid.css';

const MyungseseoPage = ({ yearFilter, onYearChange }) => {
  // 모드 상태: '명세서' 또는 '강의계획서' (초기 기본값)
  const [mode, setMode] = useState('명세서');
  
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const gridRef = useRef(null);

  // === 상태: O/X 체크를 위한 데이터 ===
  const [myungStatus, setMyungStatus] = useState([]); // 명세서 최종저장 완료 목록
  const [syllabusStatus, setSyllabusStatus] = useState([]); // 강의계획서 업로드 완료 목록

  // === 명세서 폼 상태 ===
  const [courseInfo, setCourseInfo] = useState({ year: '', course_name: '', grade_sem: '', actual_sem: '', area_1: '' });
  const [professor, setProfessor] = useState('');
  const [overview, setOverview] = useState('');
  const [learningContent, setLearningContent] = useState('');
  const [teachingMethod, setTeachingMethod] = useState('');
  const [prerequisite, setPrerequisite] = useState('');
  const [poChecks, setPoChecks] = useState({ po1: false, po2: false, po3: false, po4: false, po5: false, po6: false, po7: false, po8: false, po9: false, po10: false });
  const [cloList, setCloList] = useState([{ no: 1, content: '' }]);
  const [evalData, setEvalData] = useState([{ criteria: '', method: '', target: '' }]);

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyCandidates, setCopyCandidates] = useState([]);

  // === 강의계획서 폼 상태 ===
  const [uploading, setUploading] = useState(false);
  const [pdfRefreshKey, setPdfRefreshKey] = useState(Date.now());
  const fileInputRef = useRef(null);

  const linkedPO = Object.entries(poChecks).filter(([_, v]) => v).map(([k]) => `PO${k.replace('po', '')}`).join(', ');
  const poReflected = Object.values(poChecks).some(v => v) ? 'O' : '';

  // 교과목 데이터 로드
  useEffect(() => {
    if (!yearFilter) return;
    axios.get(`http://localhost:8000/api/명세서/courses?year=${yearFilter}`)
      .then(res => {
        setCourses(res.data.courses || []);
        setSelectedCourse(null);
        resetForm();
      })
      .catch(err => console.error("교과목 로드 에러:", err));
  }, [yearFilter]);

  // O/X 상태 데이터 로드 (명세서 & 강의계획서 둘 다)
  const fetchStatuses = () => {
    if (!yearFilter) return;
    // 명세서 상태 가져오기
    axios.get(`http://localhost:8000/api/명세서/status?year=${yearFilter}`)
      .then(res => setMyungStatus(res.data.completed_courses || []))
      .catch(err => console.error(err));
    // 강의계획서 상태 가져오기
    axios.get(`http://localhost:8000/api/강의계획서/status?year=${yearFilter}`)
      .then(res => setSyllabusStatus(res.data.uploaded_courses || []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchStatuses();
  }, [yearFilter]);

  const resetForm = () => {
    setProfessor(''); setOverview(''); setLearningContent(''); setTeachingMethod(''); setPrerequisite('');
    setPoChecks({ po1: false, po2: false, po3: false, po4: false, po5: false, po6: false, po7: false, po8: false, po9: false, po10: false });
    setCloList([{ no: 1, content: '' }]);
    setEvalData([{ criteria: '', method: '', target: '' }]);
  };

  // ★ 표의 셀을 클릭했을 때의 마법 같은 동작!
  const handleCourseClick = (ev) => {
    const instance = gridRef.current?.getInstance();
    if (!instance || ev.rowKey === null || ev.rowKey === undefined) return;
    const rowData = instance.getRow(ev.rowKey);
    
    // 클릭한 열이 무엇인지에 따라 모드를 자동 전환
    let targetMode = mode;
    if (ev.columnName === '_myung_status') {
      targetMode = '명세서';
    } else if (ev.columnName === '_syllabus_status') {
      targetMode = '강의계획서';
    }

    setMode(targetMode);
    setSelectedCourse(rowData.course_name);
    
    // 명세서 모드일 때는 해당 과목의 명세서 데이터를 불러옵니다.
    if (targetMode === '명세서') {
      const newCourseInfo = { year: yearFilter, course_name: rowData.course_name, grade_sem: rowData.grade_sem, actual_sem: rowData.actual_sem, area_1: rowData.area_1 };
      setCourseInfo(newCourseInfo);

      axios.get(`http://localhost:8000/api/명세서/load?year=${yearFilter}&course_name=${encodeURIComponent(rowData.course_name)}`)
        .then(res => {
          if (res.data.status === 'success') {
            const d = res.data.data;
            setProfessor(d.professor || ''); setOverview(d.overview || ''); setLearningContent(d.learning_content || '');
            setTeachingMethod(d.teaching_method || ''); setPrerequisite(d.prerequisite || '');
            setPoChecks({
              po1: d.po1 === 'O', po2: d.po2 === 'O', po3: d.po3 === 'O', po4: d.po4 === 'O', po5: d.po5 === 'O',
              po6: d.po6 === 'O', po7: d.po7 === 'O', po8: d.po8 === 'O', po9: d.po9 === 'O', po10: d.po10 === 'O'
            });
            try {
              const parsedClo = JSON.parse(d.clo_list); const parsedEval = JSON.parse(d.eval_data);
              setCloList(parsedClo.length > 0 ? parsedClo : [{ no: 1, content: '' }]);
              setEvalData(parsedEval.length > 0 ? parsedEval : [{ criteria: '', method: '', target: '' }]);
            } catch (e) {
              setCloList([{ no: 1, content: '' }]); setEvalData([{ criteria: '', method: '', target: '' }]);
            }
          } else { resetForm(); }
        }).catch(err => { console.error("데이터 로드 에러:", err); resetForm(); });
    }
  };

  // 명세서 기능들
  const addClo = () => { setCloList(prev => [...prev, { no: prev.length + 1, content: '' }]); setEvalData(prev => [...prev, { criteria: '', method: '', target: '' }]); };
  const removeClo = (idx) => { setCloList(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, no: i + 1 }))); setEvalData(prev => prev.filter((_, i) => i !== idx)); };
  const buildPayload = () => {
    const data = {
      year: courseInfo.year, course_name: courseInfo.course_name, grade_sem: courseInfo.grade_sem, actual_sem: courseInfo.actual_sem, area_1: courseInfo.area_1,
      professor, overview, learning_content: learningContent, teaching_method: teachingMethod, prerequisite,
      po1: poChecks.po1 ? "O" : "", po2: poChecks.po2 ? "O" : "", po3: poChecks.po3 ? "O" : "", po4: poChecks.po4 ? "O" : "", po5: poChecks.po5 ? "O" : "",
      po6: poChecks.po6 ? "O" : "", po7: poChecks.po7 ? "O" : "", po8: poChecks.po8 ? "O" : "", po9: poChecks.po9 ? "O" : "", po10: poChecks.po10 ? "O" : "",
      linked_po: linkedPO, po_reflected: poReflected, clo_list: JSON.stringify(cloList), eval_data: JSON.stringify(evalData)
    };
    return { year: courseInfo.year, course_name: courseInfo.course_name, data };
  };

  const handleTempSave = async () => {
    if (!selectedCourse) return alert('교과목을 먼저 선택해주세요.');
    try { await axios.post('http://localhost:8000/api/명세서/save-temp', buildPayload()); alert('임시 저장되었습니다.'); } catch (e) { alert('임시 저장 실패'); }
  };

  const handleFinalSave = async () => {
    if (!selectedCourse) return alert('교과목을 먼저 선택해주세요.');
    if (!window.confirm('최종 저장하시겠습니까?')) return;
    try { 
      await axios.post('http://localhost:8000/api/명세서/save-final', buildPayload()); 
      alert('최종 저장되었습니다.'); 
      fetchStatuses(); // ★ 최종 저장 후 표의 O/X 상태 즉각 갱신
    } catch (e) { alert('최종 저장 실패'); }
  };

  const handleCopyClick = async () => {
    if (!selectedCourse) return alert('교과목을 먼저 선택해주세요.');
    try {
      const res = await axios.get(`http://localhost:8000/api/명세서/copy-candidates?course_name=${encodeURIComponent(courseInfo.course_name)}&current_year=${yearFilter}`);
      if (res.data.candidates && res.data.candidates.length > 0) { setCopyCandidates(res.data.candidates); setShowCopyModal(true); } 
      else { alert('복사할 수 있는 이전 년도의 최종 저장 파일이 없습니다.'); }
    } catch (e) { alert('목록 로드 실패'); }
  };

  const handleExcelDownload = async () => {
    if (!selectedCourse) return alert('교과목을 먼저 선택해주세요.');
    try {
      const res = await axios.post('http://localhost:8000/api/명세서/download-excel', buildPayload(), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url;
      const yearStr = String(courseInfo.year || ''); const shortYear = yearStr.length >= 2 ? yearStr.slice(-2) : yearStr;
      link.setAttribute('download', `${shortYear}${courseInfo.course_name}_명세서.xlsx`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (e) { alert('엑셀 다운로드에 실패했습니다.'); }
  };

  // 모드에 맞춰 다운로드 방식 자동 변경
  const handleDownloadAll = async () => {
    try {
      if (mode === '명세서') {
        const res = await axios.get(`http://localhost:8000/api/명세서/download-all-excel?year=${yearFilter}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a'); link.href = url;
        link.setAttribute('download', `${yearFilter}학년도_전체명세서.xlsx`);
        document.body.appendChild(link); link.click(); link.remove();
      } else {
        const res = await axios.get(`http://localhost:8000/api/강의계획서/download-all-pdf?year=${yearFilter}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a'); link.href = url;
        link.setAttribute('download', `${yearFilter}학년도_전체강의계획서.pdf`);
        document.body.appendChild(link); link.click(); link.remove();
      }
    } catch (e) { alert(`${mode} 다운로드에 실패했습니다. (업로드된 파일이 없을 수 있습니다.)`); }
  };

  // 강의계획서 기능
  const handlePdfUpload = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      return alert('업로드할 PDF 파일을 선택해주세요.');
    }
    const file = fileInputRef.current.files[0];
    if (file.type !== 'application/pdf') return alert('PDF 파일만 업로드 가능합니다.');
    
    const uploadData = new FormData();
    uploadData.append('year', yearFilter);
    uploadData.append('course_name', selectedCourse);
    uploadData.append('file', file);

    setUploading(true);
    try {
      await axios.post('http://localhost:8000/api/강의계획서/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('성공적으로 업로드되었습니다!');
      fetchStatuses(); // ★ 업로드 후 표의 O/X 상태 즉각 갱신
      setPdfRefreshKey(Date.now()); 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    } catch (err) { alert('업로드에 실패했습니다.'); } finally { setUploading(false); }
  };

  // 표에 O/X 상태 데이터를 맵핑
  const gridDataWithAdditions = courses.map(course => ({
    ...course,
    _myung_status: myungStatus.includes(course.course_name) ? '✅' : '❌',
    _syllabus_status: syllabusStatus.includes(course.course_name) ? '✅' : '❌'
  }));

  // ★ 표의 열 구조 (버튼 없이 항상 이 구조 유지)
  const gridColumns = [
    { header: '학년-학기', name: 'grade_sem', align: 'center', width: 75 },
    { header: '실제강의', name: 'actual_sem', align: 'center', width: 85 },
    { header: '교과목명', name: 'course_name', minWidth: 120 },
    { 
      header: '명세서', name: '_myung_status', align: 'center', width: 65,
      formatter: ({ value }) => `<div style="cursor:pointer; font-size:15px;" title="클릭하여 명세서 보기">${value}</div>`
    },
    { 
      header: '강의계획서', name: '_syllabus_status', align: 'center', width: 80,
      formatter: ({ value }) => `<div style="cursor:pointer; font-size:15px;" title="클릭하여 강의계획서 보기">${value}</div>`
    }
  ];

  const titleBg = '#d9d9d9'; const dataBg = '#ffffff';  
  const getColSpan = (index) => {
    const totalCols = 10; const numItems = evalData.length || 1;
    const base = Math.floor(totalCols / numItems); const rem = totalCols % numItems;
    return base + (index < rem ? 1 : 0);
  };

  return (
    <div className="d-flex w-100 h-100 p-3 gap-3" style={{ minHeight: '100vh', overflow: 'hidden' }}>
      
      {/* === 왼쪽 교과목 목록 패널 === */}
      {/* 5개의 열이 다 보이도록 패널 너비를 조금 넓혀주었습니다. */}
      <div className="bg-white border rounded shadow-sm d-flex flex-column" style={{ width: '500px', minWidth: '500px', flexShrink: 0 }}>
        
        <div className="p-3 border-bottom bg-light d-flex justify-content-between align-items-center">
          <span className="fw-bold text-primary fs-5">📚 교과목 목록</span>
          <span className="badge bg-secondary fs-6">{yearFilter}학년도</span>
        </div>

        <div className="flex-grow-1" style={{ position: 'relative' }}>
          <Grid
            ref={gridRef}
            data={gridDataWithAdditions}
            columns={gridColumns}
            bodyHeight="fitToParent"
            rowHeaders={['rowNum']} 
            onClick={handleCourseClick}
            selectionUnit="row"
          />
        </div>
      </div>

      {/* === 오른쪽 메인 작업 패널 === */}
      <div className="bg-white border rounded shadow-sm flex-grow-1 d-flex flex-column" style={{ overflowY: 'auto', minWidth: 0 }}>
        
        <div className="bg-light border-bottom px-4 pt-3 d-flex justify-content-between align-items-end">
          <h5 className="m-0 fw-bold text-primary pb-3">
            {mode === '명세서' ? '명세서 관리' : '강의계획서 관리 (PDF)'}
          </h5>
          <ul className="nav nav-pills custom-pills pb-2">
            {['2022', '2023', '2024', '2025', '2026'].map(y => (
              <li className="nav-item" key={y}>
                <button className={`nav-link py-1 px-3 ${yearFilter === y ? 'active fw-bold' : 'text-secondary'}`} onClick={() => { onYearChange(y); setSelectedCourse(null); }}>
                  {y}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 border-bottom d-flex justify-content-between align-items-center sticky-top bg-white" style={{ zIndex: 5 }}>
          <div className="d-flex align-items-center">
            <span className="fw-bold fs-5 text-dark">
              {selectedCourse ? `[${selectedCourse}] ${mode} 확인` : `👈 표에서 과목의 [${mode}] 칸을 클릭해주세요`}
            </span>
            <button className="btn btn-secondary btn-sm fw-bold ms-4 shadow-sm" onClick={handleDownloadAll}>
              📥 학년도 전체 {mode} 다운로드
            </button>
          </div>
          
          {mode === '명세서' && selectedCourse && (
            <div className="d-flex gap-2 align-items-center">
              <button className="btn btn-outline-primary btn-sm fw-bold px-3 border-2" onClick={addClo}>➕ CLO 추가</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={handleTempSave}>임시저장</button>
              <button className="btn btn-dark btn-sm" onClick={handleFinalSave}>최종저장</button>
              <button className="btn btn-outline-info btn-sm" onClick={handleCopyClick}>표복사</button>
              <button className="btn btn-outline-success btn-sm" onClick={handleExcelDownload}>엑셀 다운로드</button>
            </div>
          )}
        </div>

        {/* --- [모드 1] 명세서 작업 화면 --- */}
        {mode === '명세서' && selectedCourse && (
          <div className="p-4 flex-grow-1" style={{ backgroundColor: '#fcfcfc' }}>
            <table className="table table-bordered align-middle text-center border-dark" style={{ fontSize: '13px', tableLayout: 'fixed', width: '100%', borderColor: '#ccc' }}>
              <colgroup><col width="8%" /><col width="8%" /><col width="6%" /><col width="6%" /><col width="10%" /><col width="10%" /><col width="10%" /><col width="10%" /><col width="10%" /><col width="10%" /><col width="6%" /><col width="6%" /></colgroup>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>교과목명</td>
                  <td colSpan={2} style={{ backgroundColor: dataBg }}>{courseInfo.course_name}</td>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>구분</td>
                  <td colSpan={2} style={{ backgroundColor: dataBg }}>{courseInfo.area_1}</td>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>책임교수</td>
                  <td colSpan={2} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 text-center bg-transparent" value={professor} onChange={e=>setProfessor(e.target.value)} /></td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>교과목개요</td>
                  <td colSpan={10} style={{ backgroundColor: dataBg, padding: 0 }}><textarea className="form-control border-0 bg-transparent" rows={2} value={overview} onChange={e=>setOverview(e.target.value)} /></td>
                </tr>
                <tr>
                  <td colSpan={2} rowSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>프로그램<br/>최종성과</td>
                  {Array.from({length: 10}).map((_, i) => <td key={`po-h-${i}`} style={{ backgroundColor: titleBg, fontWeight: 'bold', padding: '5px' }}>PO{i+1}</td>)}
                </tr>
                <tr>
                  {Array.from({length: 10}).map((_, i) => (
                    <td key={`po-c-${i}`} style={{ backgroundColor: dataBg, cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }} onClick={() => setPoChecks(p => ({...p, [`po${i+1}`]: !p[`po${i+1}`]}))}>
                      {poChecks[`po${i+1}`] ? 'O' : ''}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td colSpan={2} rowSpan={cloList.length + 1} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>학습목표<br/>(교과목 학습성과)</td>
                  <td colSpan={6} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>학습목표<br/>(교과목 학습성과 CLO)</td>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>연계 PO</td>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>PO 성취도평가<br/>반영 여부</td>
                </tr>
                {cloList.map((clo, idx) => (
                  <tr key={`clo-${idx}`}>
                    <td style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>{clo.no}</td>
                    <td colSpan={5} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 bg-transparent" value={clo.content} onChange={e => { const n = [...cloList]; n[idx].content = e.target.value; setCloList(n); }} /></td>
                    <td colSpan={2} style={{ backgroundColor: dataBg }}>{linkedPO}</td>
                    <td colSpan={1} style={{ backgroundColor: dataBg }}>{poReflected}</td>
                    <td colSpan={1} style={{ padding: 0, backgroundColor: dataBg }}><button className="btn btn-sm btn-outline-danger w-100 h-100 rounded-0 border-0 fw-bold" onClick={() => removeClo(idx)}>삭제</button></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>학습내용</td>
                  <td colSpan={10} style={{ backgroundColor: dataBg, padding: 0 }}><textarea className="form-control border-0 bg-transparent" rows={2} value={learningContent} onChange={e=>setLearningContent(e.target.value)} /></td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>교수법</td>
                  <td colSpan={10} style={{ backgroundColor: dataBg, padding: 0 }}><textarea className="form-control border-0 bg-transparent" rows={2} value={teachingMethod} onChange={e=>setTeachingMethod(e.target.value)} /></td>
                </tr>
                <tr>
                  <td rowSpan={5} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>평가</td>
                  <td rowSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>영역</td>
                  <td colSpan={10} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>학습목표(교과목 학습성과)</td>
                </tr>
                <tr>{evalData.map((_, i) => <td key={`ev-h-${i}`} colSpan={getColSpan(i)} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>CLO{i+1}</td>)}</tr>
                <tr>
                  <td style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>평가기준(배점율)</td>
                  {evalData.map((ev, i) => <td key={`ev-c-${i}`} colSpan={getColSpan(i)} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 text-center bg-transparent" value={ev.criteria} onChange={e=>{const n=[...evalData]; n[i].criteria=e.target.value; setEvalData(n);}} /></td>)}
                </tr>
                <tr>
                  <td style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>평가방법</td>
                  {evalData.map((ev, i) => <td key={`ev-m-${i}`} colSpan={getColSpan(i)} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 text-center bg-transparent" value={ev.method} onChange={e=>{const n=[...evalData]; n[i].method=e.target.value; setEvalData(n);}} /></td>)}
                </tr>
                <tr>
                  <td style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>목표수준</td>
                  {evalData.map((ev, i) => <td key={`ev-t-${i}`} colSpan={getColSpan(i)} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 text-center bg-transparent" value={ev.target} onChange={e=>{const n=[...evalData]; n[i].target=e.target.value; setEvalData(n);}} /></td>)}
                </tr>
                <tr>
                  <td colSpan={2} style={{ backgroundColor: titleBg, fontWeight: 'bold' }}>선수과목</td>
                  <td colSpan={10} style={{ backgroundColor: dataBg, padding: 0 }}><input className="form-control border-0 bg-transparent" value={prerequisite} onChange={e=>setPrerequisite(e.target.value)} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* --- [모드 2] 강의계획서 작업 화면 --- */}
        {mode === '강의계획서' && selectedCourse && (
          <div className="flex-grow-1 d-flex flex-column p-4" style={{ backgroundColor: '#fcfcfc' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="fw-bold fs-6 text-dark">
                {syllabusStatus.includes(selectedCourse) ? '✅ PDF 파일이 등록되어 있습니다.' : '❌ 등록된 파일이 없습니다.'}
              </span>
              <div className="d-flex gap-2">
                <input type="file" accept="application/pdf" className="form-control form-control-sm" ref={fileInputRef} style={{ width: '250px' }} />
                <button className="btn btn-primary btn-sm fw-bold shadow-sm" onClick={handlePdfUpload} disabled={uploading}>
                  {uploading ? '업로드 중...' : 'PDF 업로드'}
                </button>
              </div>
            </div>

            <div className="flex-grow-1 border rounded shadow-sm bg-white overflow-hidden d-flex flex-column">
              {syllabusStatus.includes(selectedCourse) ? (
                <iframe 
                  src={`http://localhost:8000/api/강의계획서/view?year=${yearFilter}&course_name=${encodeURIComponent(selectedCourse)}&t=${pdfRefreshKey}`} 
                  width="100%" height="100%" style={{ border: 'none', flexGrow: 1 }} title="PDF Viewer"
                />
              ) : (
                <div className="m-auto text-center text-muted">
                  <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📄</div>
                  <h5 className="fw-bold">등록된 강의계획서가 없습니다.</h5>
                  <p>우측 상단에서 PDF 파일을 선택하여 업로드해주세요.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 선택하지 않았을 때 기본 화면 */}
        {!selectedCourse && (
          <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
            <div style={{ fontSize: '4rem', marginBottom: '15px' }}>👈</div>
            <h4 className="fw-bold">왼쪽 표에서 과목의 <span className="text-primary">[{mode}] 칸의 체크표시(O/X)</span>를 눌러주세요.</h4>
          </div>
        )}

      </div>

      {showCopyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold">표 복사 (이전 데이터 가져오기)</h5>
                <button className="btn-close" onClick={() => setShowCopyModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>가져올 데이터를 선택하세요:</p>
                <div className="list-group">
                  {copyCandidates.map(c => (
                    <button key={c.path} className="list-group-item list-group-item-action" onClick={() => { /* copy handle function */ }}>
                      {c.year}학년도 - {c.filename}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyungseseoPage;