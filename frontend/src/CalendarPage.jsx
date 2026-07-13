import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Table, Row, Col, Card } from 'react-bootstrap';

const CalendarPage = () => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [tasks, setTasks] = useState([]);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(null);
  
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [newTask, setNewTask] = useState({ date: '', content: '표 1.1.2-1' });

  const years = ['2022', '2023', '2024', '2025', '2026'];
  const taskOptions = ['표 1.1.2-1', '표 1.1.1-1', '기타 행사'];

  useEffect(() => {
    fetchTasks();
  }, [selectedYear]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/calendar/events?year=${selectedYear}`);
      setTasks(res.data || []);
      setSelectedTaskIdx(null);
    } catch (e) { console.error("로드 실패", e); }
  };

  // 1. 전년도 내역 불러오기
  const handleLoadPrevYear = async () => {
    const prevYear = String(parseInt(selectedYear) - 1);
    if (!window.confirm(`${prevYear}년도의 작업 목록을 가져오시겠습니까?`)) return;
    try {
      const res = await axios.get(`http://localhost:8000/api/calendar/events?year=${prevYear}`);
      const prevTasks = res.data.map(t => ({
        ...t,
        year: selectedYear, // 연도만 현재로 변경
        status: '진행중',
        images: { homepage: [], board: [], ot: [], evidence: [] }
      }));
      setTasks([...tasks, ...prevTasks]);
      alert("전년도 내역을 가져왔습니다. '임시저장'을 눌러 반영하세요.");
    } catch (e) { alert("전년도 데이터를 찾을 수 없습니다."); }
  };

  // 2. 상태 색상 계산 로직
  const getStatusColor = (task) => {
    if (task.status === '완료') return '#28a745'; // 초록색
    const today = new Date().toISOString().split('T')[0];
    if (task.date >= today) return '#ffc107'; // 노란색 (지나지 않음)
    return '#dc3545'; // 빨간색 (지남)
  };

  const handleSave = async (type) => {
    try {
      await axios.post(`http://localhost:8000/api/calendar/save-all`, { year: selectedYear, tasks, type });
      alert(type === 'final' ? "최종 저장되었습니다." : "임시 저장되었습니다.");
      fetchTasks();
    } catch (e) { alert("저장 실패"); }
  };

  const handleDeleteTask = async () => {
    if (selectedTaskIdx === null) return;
    if (!window.confirm("선택한 작업을 삭제하시겠습니까?")) return;
    const updatedTasks = tasks.filter((_, i) => i !== selectedTaskIdx);
    setTasks(updatedTasks);
    setSelectedTaskIdx(null);
  };

  const handleImageUpload = async (category, file) => {
    if (selectedTaskIdx === null) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await axios.post("http://localhost:8000/api/calendar/upload", fd);
      const updatedTasks = [...tasks];
      updatedTasks[selectedTaskIdx].images[category].push({ url: res.data.file_url, name: res.data.file_name });
      setTasks(updatedTasks);
    } catch (e) { alert("업로드 실패"); }
  };

  const selectedTask = selectedTaskIdx !== null ? tasks[selectedTaskIdx] : null;

  return (
    <div className="d-flex h-100 bg-white overflow-hidden">
      {/* 🟢 왼쪽 창: 목록 관리 */}
      <div className="border-end d-flex flex-column" style={{ width: '450px', minWidth: '450px' }}>
        <div className="p-3 border-bottom bg-light">
          <div className="d-flex gap-1 mb-3">
            {years.map(y => (
              <Button key={y} variant={selectedYear === y ? "primary" : "outline-secondary"} size="sm" className="flex-grow-1" onClick={() => setSelectedYear(y)}>
                {y}
              </Button>
            ))}
          </div>
          <div className="d-grid gap-2">
            <Button variant="success" className="fw-bold" onClick={() => setShowWriteModal(true)}>+ 작업 내용 작성</Button>
            <div className="d-flex gap-1">
              <Button variant="outline-primary" size="sm" className="flex-grow-1" onClick={() => handleSave('temp')}>임시저장</Button>
              <Button variant="primary" size="sm" className="flex-grow-1" onClick={() => handleSave('final')}>최종저장</Button>
              <Button variant="outline-danger" size="sm" className="flex-grow-1" onClick={handleDeleteTask}>삭제</Button>
            </div>
            <Button variant="outline-secondary" size="sm" onClick={handleLoadPrevYear}>🔄 전년도 내역 불러오기</Button>
          </div>
        </div>
        
        <div className="flex-grow-1 overflow-auto">
          <Table hover className="mb-0 text-center align-middle" style={{ fontSize: '0.9rem' }}>
            <thead className="table-light sticky-top">
              <tr>
                <th style={{ width: '100px' }}>월/일</th>
                <th>작업 내용</th>
                <th style={{ width: '80px' }}>여부</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, idx) => (
                <tr key={idx} onClick={() => setSelectedTaskIdx(idx)} style={{ cursor: 'pointer' }} className={selectedTaskIdx === idx ? "table-primary" : ""}>
                  <td>{task.date?.substring(5)}</td>
                  <td className="text-start">{task.content}</td>
                  <td>
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', backgroundColor: getStatusColor(task), margin: 'auto' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>

      {/* 🔵 오른쪽 창: 증빙자료 상세 관리 */}
      <div className="flex-grow-1 p-4 overflow-auto bg-light">
        {selectedTask ? (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-2">
              <h4 className="fw-bold m-0"><span className="text-primary">[{selectedTask.date}]</span> {selectedTask.content}</h4>
              <Button variant="outline-success" size="sm" onClick={() => {
                const updated = [...tasks];
                updated[selectedTaskIdx].status = '완료';
                setTasks(updated);
              }}>작업 완료 처리</Button>
            </div>
            
            <Row className="g-4">
              {[
                { key: 'homepage', label: '홈페이지 화면' },
                { key: 'board', label: '학과 게시판' },
                { key: 'ot', label: 'OT 사진' },
                { key: 'evidence', label: '증빙자료' }
              ].map(cat => (
                <Col md={12} key={cat.key} className="mb-3">
                  <Card className="shadow-sm border-0">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="fw-bold mb-0">{cat.label}</h6>
                        <label className="btn btn-primary btn-sm mb-0">추가 <input type="file" hidden onChange={(e) => handleImageUpload(cat.key, e.target.files[0])} /></label>
                      </div>
                      <div className="d-flex flex-wrap gap-4">
                        {selectedTask.images[cat.key]?.map((img, i) => (
                          <div key={i} className="border shadow-sm bg-white" style={{ width: '14.8cm', height: '21cm', overflow: 'hidden' }}>
                            <img src={img.url} alt="proof" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        ))}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ) : (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted">
            <h3>작업을 선택하여 증빙을 관리하세요.</h3>
          </div>
        )}
      </div>

      <Modal show={showWriteModal} onHide={() => setShowWriteModal(false)}>
        <Modal.Header closeButton><Modal.Title>새 작업 내용 작성</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>날짜</Form.Label>
            <Form.Control type="date" onChange={(e) => setNewTask({...newTask, date: e.target.value})} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>작업 내용</Form.Label>
            <Form.Select onChange={(e) => setNewTask({...newTask, content: e.target.value})}>
              {taskOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => {
             setTasks([...tasks, { ...newTask, year: selectedYear, status: '진행중', images: { homepage: [], board: [], ot: [], evidence: [] } }]);
             setShowWriteModal(false);
          }}>목록에 추가</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CalendarPage;