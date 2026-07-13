import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, Card, Table } from 'react-bootstrap';

const TimetableReportPage = () => {
  const [searchProf, setSearchProf] = useState("");
  const [searchYear, setSearchYear] = useState("2026");
  const [searchSemester, setSearchSemester] = useState("1학기");
  const [profTimetable, setProfTimetable] = useState([]);

  const handleSearch = async () => {
    if (!searchProf.trim()) return alert("교수님 성함을 입력해주세요.");
    try {
      const res = await axios.get(`http://localhost:8000/api/load-draft/교수진 강의담당 분석`);
      const allData = res.data?.rows || [];
      const filtered = allData.filter(row => 
        row.prof_name === searchProf.trim() &&
        String(row.curr_year) === searchYear &&
        String(row.semester).includes(searchSemester)
      );
      if (filtered.length === 0) alert("해당 조건의 강의가 없습니다.");
      setProfTimetable(filtered);
    } catch (e) {
      alert("데이터 로드 실패");
    }
  };

  const renderCell = (day, period) => {
    const lecture = profTimetable.find(item => 
      (item.first_day === day && item.first_time?.split(',').includes(String(period))) ||
      (item.second_day === day && item.second_time?.split(',').includes(String(period)))
    );
    if (!lecture) return null;
    const isFirst = lecture.first_day === day && lecture.first_time?.split(',').includes(String(period));
    return (
      <div className="p-2 h-100 d-flex flex-column justify-content-center" style={{ backgroundColor: '#f0f7ff', fontSize: '0.85rem', borderRadius: '4px' }}>
        <div className="fw-bold text-primary mb-1">{lecture.course_name}</div>
        <div className="text-muted small">{isFirst ? lecture.first_room : lecture.second_room}</div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-white h-100 overflow-auto">
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body className="bg-light">
          <h5 className="fw-bold mb-3">[별책] 교수별 시간표 조회</h5>
          <div className="d-flex gap-3 align-items-end">
            <Form.Group style={{ width: '150px' }}>
              <Form.Label className="small fw-bold">학년도 선택</Form.Label>
              <Form.Select value={searchYear} onChange={(e) => setSearchYear(e.target.value)}>
                {['2024','2025','2026'].map(y => <option key={y} value={y}>{y}년</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group style={{ width: '150px' }}>
              <Form.Label className="small fw-bold">학기 선택</Form.Label>
              <Form.Select value={searchSemester} onChange={(e) => setSearchSemester(e.target.value)}>
                <option value="1학기">1학기</option><option value="2학기">2학기</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="flex-grow-1" style={{ maxWidth: '300px' }}>
              <Form.Label className="small fw-bold">교수 성함</Form.Label>
              <Form.Control type="text" placeholder="성함을 입력하세요" value={searchProf} onChange={(e) => setSearchProf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            </Form.Group>
            <Button variant="primary" className="px-4" onClick={handleSearch}>시간표 조회</Button>
            <Button variant="outline-secondary" onClick={() => window.print()}>🖨️ 인쇄하기</Button>
          </div>
        </Card.Body>
      </Card>

      <Table bordered className="text-center align-middle" style={{ tableLayout: 'fixed' }}>
        <thead className="table-secondary">
          <tr>
            <th style={{ width: '80px' }}>교시</th>
            {['월','화','수','목','금'].map(d => <th key={d}>{d}요일</th>)}
          </tr>
        </thead>
        <tbody>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(p => (
            <tr key={p} style={{ height: '70px' }}>
              <td className="fw-bold bg-light">{p}</td>
              {['월','화','수','목','금'].map(d => <td key={d} className="p-1">{renderCell(d, p)}</td>)}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default TimetableReportPage;