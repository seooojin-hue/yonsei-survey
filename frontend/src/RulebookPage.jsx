import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Grid from '@toast-ui/react-grid';
import 'tui-grid/dist/tui-grid.css';

const RulebookPage = () => {
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRule, setSelectedRule] = useState(null);
  
  // ★ 다운로드/삭제를 위한 순서 배열 (예: ['rule_id_1', 'rule_id_3', ...])
  const [selectedIds, setSelectedIds] = useState([]);
  
  const gridRef = useRef(null);

  const [formData, setFormData] = useState({
    rule_id: '', url: '', rule_name: '', revision_date: '', department: '', task_date: '', content: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchRules(); }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredRules(rules);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredRules(rules.filter(r => r.rule_name.toLowerCase().includes(lower)));
    }
  }, [searchTerm, rules]);

  const fetchRules = () => {
    axios.get('http://localhost:8000/api/규정집/list')
      .then(res => {
        setRules(res.data.rules || []);
        setFilteredRules(res.data.rules || []);
      })
      .catch(err => console.error("규정집 로드 에러:", err));
  };

  const resetForm = () => {
    setFormData({ rule_id: '', url: '', rule_name: '', revision_date: '', department: '', task_date: '', content: '' });
    setSelectedRule(null);
  };

  const handleRowClick = (ev) => {
    const instance = gridRef.current?.getInstance();
    if (!instance || ev.rowKey === null || ev.rowKey === undefined) return;
    
    const rowData = instance.getRow(ev.rowKey);

    // ★ 1. 순서 지정 열을 클릭했을 때의 로직
    if (ev.columnName === '_order') {
      setSelectedIds(prev => {
        const idx = prev.indexOf(rowData.rule_id);
        if (idx > -1) {
          // 이미 번호가 있다면 배열에서 빼기 (순서 취소)
          return prev.filter(id => id !== rowData.rule_id);
        } else {
          // 번호가 없다면 배열 맨 뒤에 추가 (새 순서 부여)
          return [...prev, rowData.rule_id];
        }
      });
      return; 
    }

    // URL 열을 눌렀을 때는 무시
    if (ev.columnName === 'url') return;

    // 그 외 본문 열을 누르면 규정 상세 확인
    setSelectedRule(rowData.rule_name);
    setFormData({
      rule_id: rowData.rule_id || '',
      url: rowData.url || '',
      rule_name: rowData.rule_name || '',
      revision_date: rowData.revision_date || '',
      department: rowData.department || '',
      task_date: rowData.task_date || '',
      content: rowData.content || ''
    });
  };

  const handleCrawl = async () => {
    if (!formData.url.trim()) return alert('URL을 먼저 입력해주세요!');
    setIsLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/규정집/crawl', { url: formData.url });
      const { rule_name, revision_date, department, content } = res.data;
      
      const today = new Date().toISOString().split('T')[0];
      const newId = `rule_${Date.now()}`;
      
      const newData = {
        rule_id: formData.rule_id || newId, url: formData.url, rule_name: rule_name || '제목을 찾을 수 없음',
        revision_date: revision_date || '날짜 없음', department: department || '-', task_date: today, content: content || '내용을 불러오지 못했습니다.'
      };
      
      setFormData(newData);
      alert('크롤링 완료! 데이터가 자동으로 저장됩니다.');
      
      await axios.post('http://localhost:8000/api/규정집/save', newData);
      fetchRules();
      setSelectedRule(newData.rule_name);
    } catch (error) {
      console.error(error); alert('크롤링에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 통합 다운로드 로직 (지정한 순서 배열 그대로 전송)
  const handleDownloadWord = async () => {
    let targetData = [];
    if (selectedIds.length > 0) {
      // 선택한 순서대로 데이터를 재조립!
      targetData = selectedIds.map(id => rules.find(r => r.rule_id === id)).filter(Boolean);
    } else if (selectedRule) {
      targetData = [formData];
    } else {
      return alert('목록 맨 앞의 순서 동그라미를 눌러 다운로드할 규정들을 선택해주세요.');
    }

    try {
      const res = await axios.post(`http://localhost:8000/api/규정집/download/docx`, { rules: targetData }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      
      if (targetData.length === 1) link.setAttribute('download', `${targetData[0].rule_name}.docx`);
      else link.setAttribute('download', `규정집_통합다운로드.docx`); // ★ 이름 변경
      
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert(`다운로드에 실패했습니다.`); console.error(e);
    }
  };

  // ★ 다중 삭제 로직
  const handleDelete = async () => {
    if (selectedIds.length === 0) return alert('목록 맨 앞의 순서 동그라미를 눌러 삭제할 규정들을 선택해주세요.');

    if (!window.confirm(`선택한 ${selectedIds.length}개의 규정을 정말로 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)`)) {
      return;
    }

    try {
      await axios.post('http://localhost:8000/api/규정집/delete', { rule_ids: selectedIds });
      alert('성공적으로 삭제되었습니다.');
      
      // 삭제 후 순서 배열 초기화
      setSelectedIds([]);
      // 열려있던 폼이 지워졌다면 비워줌
      if (selectedIds.some(id => id === formData.rule_id)) resetForm();
      fetchRules();
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.'); console.error(e);
    }
  };

  // 표 렌더링을 위해 filteredRules에 _order 속성 부여 (선택 배열 기반)
  const gridDataWithOrder = filteredRules.map(rule => {
    const orderIdx = selectedIds.indexOf(rule.rule_id);
    return {
      ...rule,
      _order: orderIdx > -1 ? orderIdx + 1 : ''
    };
  });

  const renderFormattedContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (/^제\s*\d+\s*장/.test(line)) {
        return <div key={idx} className="mt-4 mb-3 text-center fw-bold" style={{ fontSize: '18px', color: '#111' }}>{line}</div>;
      }
      const articleMatch = line.match(/^(제\s*\d+\s*조\s*(?:\([^)]+\))?)(.*)/);
      if (articleMatch) {
        return (
          <div key={idx} className="mt-3 mb-1" style={{ textIndent: '-0.5em', paddingLeft: '0.5em' }}>
            <span className="fw-bold" style={{ fontSize: '16px', color: '#000', marginRight: '5px' }}>{articleMatch[1]}</span>
            <span>{articleMatch[2]}</span>
          </div>
        );
      }
      const isListItem = /^[①②③④⑤⑥⑦⑧⑨⑩\d+\.]/.test(line.trim());
      return <div key={idx} style={{ minHeight: '1.2em', paddingLeft: isListItem ? '1em' : '0', textIndent: isListItem ? '-1em' : '0' }}>{line}</div>;
    });
  };

  return (
    <div className="d-flex w-100 h-100 p-3 gap-3">
      {/* 왼쪽: 규정집 목록 */}
      <div className="bg-white border rounded shadow-sm d-flex flex-column" style={{ width: '580px', minWidth: '580px', overflow: 'hidden' }}>
        <div className="p-3 border-bottom bg-light fw-bold text-primary d-flex justify-content-between align-items-center">
          <span>📚 규정집 목록</span>
        </div>
        
        <div className="p-2 border-bottom bg-white d-flex gap-2">
          <input type="text" className="form-control form-control-sm" placeholder="🔍 규정명으로 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {/* ★ 순서 초기화 버튼 추가 */}
          <button className="btn btn-sm btn-outline-secondary text-nowrap" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
            순서 초기화
          </button>
        </div>

        <div className="p-2 border-bottom bg-light d-flex gap-2 justify-content-center align-items-center">
          <button className="btn btn-outline-dark btn-sm flex-grow-1 fw-bold" onClick={handleDownloadWord}>
            📑 선택 순서대로 통합문서 다운로드 (.docx)
          </button>
          <button className="btn btn-outline-danger btn-sm px-3 fw-bold" onClick={handleDelete} title="선택된 규정 삭제">🗑️ 삭제</button>
        </div>

        <div className="flex-grow-1" style={{ position: 'relative' }}>
          <Grid
            ref={gridRef}
            data={gridDataWithOrder}
            rowHeaders={[]} // ★ 체크박스 제거
            columns={[
              { 
                header: '순서', 
                name: '_order', 
                width: 50, 
                align: 'center',
                // ★ 번호가 있으면 파란 동그라미, 없으면 빈 동그라미 렌더링
                formatter: ({ value }) => {
                  if (value) {
                    return `<div style="background:#0d6efd; color:white; border-radius:50%; width:22px; height:22px; display:inline-block; line-height:22px; font-weight:bold; cursor:pointer;">${value}</div>`;
                  }
                  return `<div style="border:2px solid #ccc; border-radius:50%; width:22px; height:22px; display:inline-block; cursor:pointer;"></div>`;
                }
              },
              { header: '규정명', name: 'rule_name', minWidth: 150 },
              { header: '개정일', name: 'revision_date', align: 'center', width: 90 },
              { 
                header: '원문 링크', 
                name: 'url', 
                align: 'center',
                width: 100, 
                formatter: ({ value }) => {
                  if (!value) return '';
                  let targetLink = value;
                  if (value.includes('search#')) {
                    const ruleId = value.split('search#')[1].trim();
                    targetLink = `https://rules.yonsei.ac.kr/ruleseq${ruleId}/print`;
                  }
                  return `<a href="${targetLink}" target="_blank" class="btn btn-sm btn-outline-primary py-0" style="font-size:12px; font-weight:bold; padding:2px 8px; text-decoration:none;">바로가기🔗</a>`;
                }
              }
            ]}
            bodyHeight="fitToParent"
            onClick={handleRowClick}
            selectionUnit="row"
          />
        </div>
      </div>

      {/* 오른쪽: 문서 뷰어 폼 */}
      <div className="bg-white border rounded shadow-sm flex-grow-1 d-flex flex-column" style={{ overflowY: 'auto', minWidth: 0 }}>
        
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center sticky-top bg-white" style={{ zIndex: 5 }}>
          <div className="d-flex align-items-center">
            <span className="fw-bold fs-5 text-dark">
              {selectedRule ? `[${selectedRule}] 규정 확인` : '새로운 규정 불러오기'}
            </span>
            {!selectedRule && (
              <a href="https://rules.yonsei.ac.kr/" target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-info fw-bold ms-3">
                🌐 연세대학교 규정집 사이트 열기
              </a>
            )}
          </div>
          {selectedRule && (
            <button className="btn btn-sm btn-outline-secondary fw-bold" onClick={resetForm}>
              ✖ 닫기 (새로 입력)
            </button>
          )}
        </div>

        <div className="p-4 flex-grow-1 d-flex flex-column" style={{ backgroundColor: '#fcfcfc' }}>
          
          <div className="input-group mb-4 shadow-sm">
            <span className="input-group-text bg-primary text-white fw-bold">URL 입력</span>
            <input type="text" className="form-control" placeholder="복사한 규정의 URL을 붙여넣으세요..." value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} />
            <button className="btn btn-warning fw-bold px-4" onClick={handleCrawl} disabled={isLoading}>
              {isLoading ? '크롤링 중...' : '자동 불러오기'}
            </button>
          </div>

          <div className="flex-grow-1 p-5 bg-white border shadow-sm rounded" style={{ overflowY: 'auto', minHeight: '500px', fontFamily: '"Malgun Gothic", "맑은 고딕", serif' }}>
            {formData.rule_name ? (
              <div style={{ maxWidth: '850px', margin: '0 auto', color: '#333' }}>
                <h2 className="text-center fw-bold mb-4" style={{ letterSpacing: '-1px', color: '#000', fontSize: '28px' }}>
                  {formData.rule_name}
                </h2>
                
                <div className="d-flex justify-content-between align-items-end text-muted mb-4 pb-3 border-bottom" style={{ fontSize: '14.5px' }}>
                  <div className="text-start">
                    <span className="d-block mb-1"><strong>개정일:</strong> {formData.revision_date}</span>
                  </div>
                  <div className="text-end">
                    <span className="me-4"><strong>담당부서:</strong> {formData.department || '-'}</span>
                    <span><strong>작업 날짜:</strong> {formData.task_date}</span>
                  </div>
                </div>

                <div style={{ lineHeight: '1.9', fontSize: '15px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  {renderFormattedContent(formData.content)}
                </div>
              </div>
            ) : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📄</div>
                <h5 className="fw-bold">상단의 링크를 눌러 사이트에서 복사한 URL을 입력해주세요.</h5>
                <p>자동 불러오기를 실행하면 이 곳에 깔끔한 규정 문서가 나타납니다.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default RulebookPage;