import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

export default function ReportOutput({ selectedReportId }) {
  const [data, setData] = useState({ headers: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');

  // ★ 신규 추가: [표 1.3.3-1] O/X 클릭 상태 저장용
  const [oxStates, setOxStates] = useState({});

  // 1. 특정 표(2.1.1-2) 및 1.3.3-1 표 필터링 활성화 여부
  const isTargetTable = selectedReportId && selectedReportId.includes('2.1.1-2');
  const is1331Table = selectedReportId && selectedReportId.includes('1.3.3-1');

  useEffect(() => {
    if (!selectedReportId) return;

    setLoading(true);
    setError(null);
    setData({ headers: [], rows: [] });
    setSelectedYear('');
    
    console.log("요청 보고서:", selectedReportId);

    // ★ 신규 추가: O/X 데이터 로컬 스토리지에서 불러오기
    if (selectedReportId.includes('1.3.3-1')) {
      const savedStates = localStorage.getItem('report_1331_ox_states');
      if (savedStates) setOxStates(JSON.parse(savedStates));
    }

    axios.get(`http://localhost:8000/api/report/preview?report_id=${encodeURIComponent(selectedReportId)}`)
      .then(res => {
        if (res.data.message) {
          setError(res.data.message);
        } else {
          console.log("받은 데이터:", res.data);
          setData(res.data);
        }
      })
      .catch(err => {
        console.error(err);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      })
      .finally(() => setLoading(false));
  }, [selectedReportId]);

  // ★ 신규 추가: O/X 클릭 토글 함수 (빈칸 -> O -> X -> 빈칸)
  const handleToggleOX = (rowKey, header) => {
    if (!is1331Table || (header !== '프로그램 책임자' && header !== '보건의료정보관리사 교수')) return;
    
    const stateKey = `${rowKey}_${header}`;
    const current = oxStates[stateKey] || '';
    let next = '';
    if (current === '') next = 'O';
    else if (current === 'O') next = 'X';
    else next = '';
    
    const newStates = { ...oxStates, [stateKey]: next };
    setOxStates(newStates);
    
    // 로컬 스토리지에 영구 자동 저장
    localStorage.setItem('report_1331_ox_states', JSON.stringify(newStates));
  };

  // 연도 목록 추출
  const availableYears = useMemo(() => {
    if (!data.rows || data.rows.length === 0) return [];
    const firstRow = data.rows[0];
    if (firstRow['학년도'] === undefined) return [];

    const years = [...new Set(data.rows.map(r => String(r['학년도'])))].sort();
    return years;
  }, [data]);

  // 초기 연도 선택
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // 행 필터링
  const filteredRows = useMemo(() => {
    if (!isTargetTable) return data.rows;
    if (availableYears.length === 0) return data.rows;
    return data.rows.filter(row => String(row['학년도']) === selectedYear);
  }, [data.rows, selectedYear, availableYears, isTargetTable]);

  const handleDownloadExcel = async () => {
    if (!selectedReportId) return;
    try {
      const response = await axios.get(
        `http://localhost:8000/api/report/download/excel?report_id=${encodeURIComponent(selectedReportId)}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const safeName = selectedReportId.replace(/[\[\]]/g, '').trim(); 
      link.setAttribute('download', `${safeName}.xlsx`); 
      
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error(e);
      alert("엑셀 다운로드에 실패했습니다.");
    }
  };

  if (!selectedReportId) {
    return (
      <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted">
        <h3>👈 왼쪽에서 보고서를 선택해주세요</h3>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column h-100">
      <div className="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center shadow-sm">
        <div className="d-flex align-items-center gap-3" style={{ maxWidth: '70%' }}>
          <h5 className="fw-bold text-dark mb-0 text-truncate">{selectedReportId}</h5>
          {isTargetTable && availableYears.length > 0 && (
            <select 
              className="form-select form-select-sm w-auto border-primary shadow-sm"
              style={{ fontWeight: 'bold', color: '#003366', minWidth: '120px' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}학년도</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <button 
            className="btn btn-success d-flex align-items-center gap-2 shadow-sm fw-bold"
            onClick={handleDownloadExcel}
            disabled={loading || error || data.rows.length === 0}
          >
            <span>📊 엑셀(Excel) 다운로드</span>
          </button>
        </div>
      </div>

      <div className="flex-grow-1 p-4 overflow-auto bg-light">
        {loading ? (
          <div className="text-center mt-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2 text-muted">데이터를 분석하여 표를 만드는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="alert alert-warning text-center mt-4 shadow-sm">
            <h5>⚠️ 알림</h5><p>{error}</p>
          </div>
        ) : filteredRows.length > 0 ? (
          <div className="d-flex flex-column align-items-center">

            {/* ★ 신규 추가: O/X 테이블 이용 안내 메시지 */}
            {is1331Table && (
               <div className="alert alert-info py-2 px-3 mb-3 shadow-sm w-100" style={{ maxWidth: '1000px', fontSize: '0.85rem' }}>
                  💡 <b>안내:</b> 우측 두 개의 열(프로그램 책임자, 보건의료정보관리사 교수)의 <span className="text-danger fw-bold">빈칸을 클릭</span>하시면 <b>O / X</b> 로 변경되며, 값은 내 PC에 영구 자동 저장됩니다!
               </div>
            )}

            <div className="card shadow-sm border-0 w-100">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-bordered table-hover mb-0 text-center align-middle" style={{ minWidth: '1000px' }}>
                    <thead className="table-light">
                      {selectedReportId && (selectedReportId.includes('2.3.1-1') || selectedReportId.includes('2.4.2-1')) ? (
                        <>
                          <tr>
                            <th rowSpan="2" className="bg-light align-middle">교과목명</th>
                            <th colSpan="3" className="bg-light">2023학년도</th>
                            <th colSpan="3" className="bg-light">2024학년도</th>
                            <th colSpan="3" className="bg-light">2025학년도</th>
                            <th rowSpan="2" className="bg-light align-middle">변경 내용</th>
                          </tr>
                          <tr>
                            <th>개설학년/학기</th><th>학점</th><th>실습 여부</th>
                            <th>개설학년/학기</th><th>학점</th><th>실습 여부</th>
                            <th>개설학년/학기</th><th>학점</th><th>실습 여부</th>
                          </tr>
                        </>
                      ) : selectedReportId && (selectedReportId.includes('2.3.1-2') || selectedReportId.includes('2.4.2-2')) ? (
                        <>
                          <tr>
                            <th rowSpan="2" className="bg-light align-middle">교과목명</th>
                            <th colSpan="3" className="bg-light">2026학년도</th>
                            <th rowSpan="2" className="bg-light align-middle">변경 내용</th>
                          </tr>
                          <tr>
                            <th>개설학년/학기</th><th>학점</th><th>실습 여부</th>
                          </tr>
                        </>
                      ) : selectedReportId && selectedReportId.includes('2.5.1-1') ? (
                        <>
                          <tr>
                            <th rowSpan="3" className="bg-light align-middle">교과목명</th>
                            <th rowSpan="3" className="bg-light align-middle">개설학년/학기</th>
                            <th colSpan="4" className="bg-light">2023학년도</th>
                            <th colSpan="4" className="bg-light">2024학년도</th>
                            <th colSpan="4" className="bg-light">2025학년도</th>
                            <th rowSpan="3" className="bg-light align-middle">변경내용</th>
                          </tr>
                          <tr>
                            <th colSpan="4" className="bg-light py-1 small">교수학습방법</th>
                            <th colSpan="4" className="bg-light py-1 small">교수학습방법</th>
                            <th colSpan="4" className="bg-light py-1 small">교수학습방법</th>
                          </tr>
                          <tr className="small">
                            <th>방1</th><th>방2</th><th>방3</th><th>방4</th>
                            <th>방1</th><th>방2</th><th>방3</th><th>방4</th>
                            <th>방1</th><th>방2</th><th>방3</th><th>방4</th>
                          </tr>
                        </>
                      ) : selectedReportId && selectedReportId.includes('2.5.1-2') ? (
                        <>
                          <tr>
                            <th rowSpan="3" className="bg-light align-middle">교과목명</th>
                            <th rowSpan="3" className="bg-light align-middle">개설학년/학기</th>
                            <th colSpan="4" className="bg-light">2026학년도</th>
                            <th rowSpan="3" className="bg-light align-middle">변경내용</th>
                          </tr>
                          <tr>
                            <th colSpan="4" className="bg-light py-1 small">교수학습방법</th>
                          </tr>
                          <tr className="small">
                            <th>방1</th><th>방2</th><th>방3</th><th>방4</th>
                          </tr>
                        </>
                      ) : selectedReportId && selectedReportId.includes('2.6.1-1') ? (
                        <>
                          <tr>
                            <th rowSpan="2" className="bg-light align-middle">연도</th>
                            <th rowSpan="2" className="bg-light align-middle">학년</th>
                            <th rowSpan="2" className="bg-light align-middle">학기</th>
                            <th rowSpan="2" className="bg-light align-middle">운영 교과목</th>
                            <th rowSpan="2" className="bg-light align-middle" style={{minWidth: '150px'}}>성취도 및<br/>강의평가 결과분석</th>
                            <th colSpan="3" className="bg-light py-1">종합적 분석</th>
                          </tr>
                          <tr>
                            <th className="bg-light small py-2">검토 주체 및 일자</th>
                            <th className="bg-light small py-2">분석내용</th>
                            <th className="bg-light small py-2">검토 결과</th>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          {data.headers && data.headers.map((h, idx) => (
                            <th key={idx} className="py-3 bg-light">{h}</th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {filteredRows.map((row, rIdx) => {
                        const isSummary1 = row['개설학년/학기'] === '적용 대상 교과목 수';
                        const isSummary2 = row['개설학년/학기'] === '적용 교과목 수';
                        
                        if (selectedReportId && selectedReportId.includes('2.5.1-1') && (isSummary1 || isSummary2)) {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              {isSummary1 && <td rowSpan="2" className="align-middle">합계</td>}
                              <td>{row['개설학년/학기']}</td>
                              <td colSpan="4">{row['2023_방1']}</td>
                              <td colSpan="4">{row['2024_방1']}</td>
                              <td colSpan="4">{row['2025_방1']}</td>
                              {isSummary1 && <td rowSpan="2"></td>}
                            </tr>
                          );
                        }

                        if (selectedReportId && selectedReportId.includes('2.5.1-2') && (isSummary1 || isSummary2)) {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              {isSummary1 && <td rowSpan="2" className="align-middle">합계</td>}
                              <td>{row['개설학년/학기']}</td>
                              <td colSpan="4">{row['2026_방1']}</td>
                              {isSummary1 && <td rowSpan="2"></td>}
                            </tr>
                          );
                        }

                        if (selectedReportId && selectedReportId.match(/2\.5\.2-[3456]/) && row['년도'] === '합계') {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              <td colSpan="2" className="text-center align-middle">합계</td>
                              <td className="text-center">{row['운영교과목']}</td>
                              <td colSpan="4" className="text-center fs-5 text-primary">
                                {row['방법1']}
                              </td>
                            </tr>
                          );
                        }
                        
                        if (selectedReportId && selectedReportId.includes('2.6.2-1') && row['연도'] === '합계') {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              <td colSpan="3" className="text-center align-middle">합계</td>
                              <td colSpan="5"></td>
                            </tr>
                          );
                        }

                        if (selectedReportId && selectedReportId.includes('2.6.2-2') && row['연도'] === '합계') {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              <td colSpan="3" className="text-center align-middle">합계</td>
                              <td className="text-center">{row['운영 교과목']}</td> 
                              <td colSpan="2"></td> 
                            </tr>
                          );
                        }

                        if (selectedReportId && selectedReportId.includes('2.6.2-3') && row['연도'] === '합계') {
                          return (
                            <tr key={rIdx} className="table-secondary fw-bold text-dark align-middle">
                              <td colSpan="3" className="text-center align-middle">합계</td>
                              <td colSpan="2"></td> 
                            </tr>
                          );
                        }

                        // =====================================
                        // 일반 데이터 렌더링 + ★ O/X 클릭 로직 적용
                        // =====================================
                        const rowKey = row._row_key || rIdx; 

                        return (
                          <tr key={rIdx}>
                            {data.headers.map((h, cIdx) => {
                              const isOXColumn = is1331Table && (h === '프로그램 책임자' || h === '보건의료정보관리사 교수');
                              const cellValue = isOXColumn ? (oxStates[`${rowKey}_${h}`] || '') : row[h];

                              return (
                                <td key={cIdx} 
                                    className={`py-2 align-middle ${isOXColumn ? 'cursor-pointer' : ''}`}
                                    onClick={() => handleToggleOX(rowKey, h)}
                                    style={isOXColumn ? { 
                                      cursor: 'pointer', 
                                      userSelect: 'none',
                                      fontWeight: 'bold', 
                                      fontSize: '1.1rem',
                                      color: cellValue === 'O' ? '#0d6efd' : (cellValue === 'X' ? '#dc3545' : '#adb5bd') 
                                    } : {}}
                                    title={isOXColumn ? "클릭하여 O/X 변경" : ""}
                                >
                                  {isOXColumn ? (cellValue || '(클릭)') : row[h]}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted mt-5"><p>데이터가 없습니다.</p></div>
        )}
      </div>
    </div>
  );
}