/**
 * GradePage.jsx
 * 
 * 의존성 추가 필요:
 *   npm install docx
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Form, Button, Table, Badge } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Document, Packer, Paragraph, TextRun,
  Table as DocxTable, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageOrientation,
} from 'docx';

// ─────────────────────────────────────────────────────────────────────────────
const GRADE_POINTS  = { A: 3, B: 3, C: 2, D: 1, F: 0 };
const YEARS         = ['2022', '2023', '2024', '2025', '2026'];
const PO_COLUMNS    = ['PO1','PO2','PO3','PO4','PO5','PO6','PO7','PO8','PO9','PO10'];

const STATIC_PO_MAPPING = [
  { keywords: ['보건의료정보관리학'],                       pos: ['PO1','PO2'] },
  { keywords: ['보건의료정보관리실무'],                      pos: ['PO2'] },
  { keywords: ['보건의료조직관리'],                         pos: ['PO6','PO7'] },
  { keywords: ['건강정보보호'],                             pos: ['PO3','PO8'] },
  { keywords: ['질병및의료행위분류1','질병및의료행위분류(1)'],  pos: ['PO2'] },
  { keywords: ['의무기록정보분석실무'],                      pos: ['PO2'] },
  { keywords: ['의무기록정보질향상실무'],                    pos: ['PO2'] },
  { keywords: ['암등록'],                                  pos: ['PO2','PO3'] },
  { keywords: ['의료의질관리'],                             pos: ['PO4'] },
  { keywords: ['건강보험이론및실무'],                        pos: ['PO2','PO6'] },
  { keywords: ['보건의료통계'],                             pos: ['PO3'] },
  { keywords: ['보건의료데이터관리'],                        pos: ['PO3'] },
  { keywords: ['의료정보기술'],                             pos: ['PO5'] },
  { keywords: ['의료관계법규'],                             pos: ['PO4'] },
  { keywords: ['의학용어(1)','의학용어1'],                   pos: ['PO1'] },
  { keywords: ['의학용어(2)','의학용어2'],                   pos: ['PO1'] },
  { keywords: ['병리학'],                                  pos: ['PO1'] },
  { keywords: ['해부생리학'],                               pos: ['PO1'] },
  { keywords: ['현장실습'],                                pos: ['PO6','PO7'] },
  { keywords: ['의무기록전사'],                             pos: ['PO3','PO7'] },
  { keywords: ['보건행정학'],                              pos: ['PO7'] },
  { keywords: ['질병및의료행위분류2','질병및의료행위분류(2)'],  pos: ['PO2'] },
  { keywords: ['공중보건학개론'],                           pos: ['PO7','PO8'] },
  { keywords: ['역학'],                                    pos: ['PO9','PO10'] },
];

const getPosForSubject = (subjName, apiPoMap = {}) => {
  if (apiPoMap[subjName]) {
    const fromApi = apiPoMap[subjName].split(',').map(p => p.trim()).filter(Boolean);
    if (fromApi.length > 0) return fromApi;
  }
  const norm = subjName.replace(/\s+/g, '');
  for (const entry of STATIC_PO_MAPPING) {
    for (const kw of entry.keywords) {
      if (norm.includes(kw.replace(/\s+/g, ''))) return entry.pos;
    }
  }
  return [];
};

// ── localStorage 헬퍼 ──────────────────────────────────────────────────────
const LS = {
  gradesKey:   y => `grades_data_${y}`,
  savedAtKey:  y => `grades_saved_at_${y}`,
  subjectsKey: y => `subjects_data_${y}`,
  poMapKey:    y => `po_map_data_${y}`,
  get: key => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del: key => { try { localStorage.removeItem(key); } catch {} },
};
const getSavedAt = year => { try { return localStorage.getItem(LS.savedAtKey(year)) || null; } catch { return null; } };
const writeSavedAt = year => { try { localStorage.setItem(LS.savedAtKey(year), new Date().toLocaleString('ko-KR')); } catch {} };

// ─────────────────────────────────────────────────────────────────────────────
// Word 생성 유틸리티
// ─────────────────────────────────────────────────────────────────────────────
const CB = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const BORDERS = { top: CB, bottom: CB, left: CB, right: CB };
const HDR_BG = 'D9E1F2';
const PO_BG  = 'FFF2CC';

const makeCell = (text, opts = {}) => {
  const lines = Array.isArray(text) ? text : String(text).split('\n');
  return new TableCell({
    rowSpan: opts.rowSpan || 1,
    columnSpan: opts.colSpan || 1,
    borders: BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.bg ? { fill: opts.bg.replace('#',''), type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: lines.map(line =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: line,
          bold: opts.bold || false,
          size: opts.size || 18,
          font: '맑은 고딕',
          color: (opts.color || '000000').replace('#',''),
        })],
      })
    ),
  });
};

// [표 2.7.1-X] PO별 성취도 측정 실적 테이블
const buildPoAchievementTable = (year, subjects, gradesData, apiPoMap) => {
  const W = [560, 700, 560, 2800, 1440, 2700];
  const poGroups = PO_COLUMNS
    .map(po => ({ po, subjects: subjects.filter(s => getPosForSubject(s.name, apiPoMap).includes(po)) }))
    .filter(g => g.subjects.length > 0);
  const totalRows = poGroups.reduce((s, g) => s + g.subjects.length, 0);

  const getPassRate = subjName => {
    const list = gradesData.filter(g => g.subject === subjName && g.isParticipating);
    if (!list.length) return null;
    return ((list.filter(g => g.grade !== 'D' && g.grade !== 'F').length / list.length) * 100).toFixed(1) + '%';
  };

  const getGoalLines = poSubjs => {
    const withData = poSubjs.filter(s => gradesData.some(g => g.subject === s.name));
    if (!withData.length) return ['진행예정'];
    const rates = withData.map(s => {
      const list = gradesData.filter(g => g.subject === s.name && g.isParticipating);
      return list.length ? (list.filter(g => g.grade !== 'D' && g.grade !== 'F').length / list.length) * 100 : 0;
    });
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (withData.length < poSubjs.length) return ["수행수준 70% 이상 '중'", "이상 도달", "진행중"];
    return ["수행수준 70% 이상 '중'", "이상 도달", avg >= 70 ? "✔ 도달" : "✘ 미달"];
  };

  const header = new TableRow({
    tableHeader: true,
    children: [
      makeCell('연도', { bold: true, bg: HDR_BG, width: W[0] }),
      makeCell('대상', { bold: true, bg: HDR_BG, width: W[1] }),
      makeCell('PO',   { bold: true, bg: HDR_BG, width: W[2] }),
      makeCell('평가도구', { bold: true, bg: HDR_BG, width: W[3] }),
      makeCell('수행 측정 결과\n(=성취수준)', { bold: true, bg: HDR_BG, width: W[4] }),
      makeCell('목표달성 여부', { bold: true, bg: HDR_BG, width: W[5] }),
    ],
  });

  const rows = [];
  let isFirst = true;
  poGroups.forEach(({ po, subjects: ps }) => {
    const goalLines = getGoalLines(ps);
    ps.forEach((subj, si) => {
      const rate = getPassRate(subj.name);
      const cells = [];
      if (isFirst && si === 0) {
        cells.push(makeCell(year, { rowSpan: totalRows, width: W[0] }));
        cells.push(makeCell(`${year}\n학년`, { rowSpan: totalRows, width: W[1] }));
      }
      if (si === 0) cells.push(makeCell(po, { rowSpan: ps.length, bold: true, bg: PO_BG, width: W[2] }));
      cells.push(makeCell(`교과기반평가 (${subj.name})`, { width: W[3] }));
      cells.push(makeCell(rate !== null ? rate : '진행예정', {
        color: rate !== null ? '1F3864' : '888888', bold: rate !== null, width: W[4],
      }));
      if (si === 0) {
        cells.push(new TableCell({
          rowSpan: ps.length, borders: BORDERS, verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          width: { size: W[5], type: WidthType.DXA },
          children: goalLines.map(line => new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: line, size: 18, font: '맑은 고딕' })],
          })),
        }));
      }
      rows.push(new TableRow({ children: cells }));
      if (si === 0) isFirst = false;
    });
  });

  return new DocxTable({ width: { size: 9360, type: WidthType.DXA }, columnWidths: W, rows: [header, ...rows] });
};

// [표 2.7.1-7] 프로그램 최종성과 PO 성취도 표 (가로)
const buildPoOverallTable = (year, subjects, gradesData, apiPoMap) => {
  const POW = 510;
  const W   = [560, 700, 2000, ...Array(10).fill(POW), 700];

  const getAvg = subjName => {
    const list = gradesData.filter(g => g.subject === subjName && g.isParticipating);
    if (!list.length) return null;
    return (list.reduce((a, c) => a + (Number(c.points) || 0), 0) / list.length).toFixed(2);
  };
  const getOvAvg = po => {
    const avgs = subjects.filter(s => getPosForSubject(s.name, apiPoMap).includes(po))
      .map(s => getAvg(s.name)).filter(v => v !== null).map(Number);
    if (!avgs.length) return null;
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
  };

  const hdr1 = new TableRow({
    tableHeader: true,
    children: [
      makeCell('연도',    { bold: true, bg: HDR_BG, rowSpan: 2, width: W[0] }),
      makeCell('대상',    { bold: true, bg: HDR_BG, rowSpan: 2, width: W[1] }),
      makeCell('평가도구', { bold: true, bg: HDR_BG, rowSpan: 2, width: W[2] }),
      ...PO_COLUMNS.map((po, i) => makeCell(po, { bold: true, bg: PO_BG, width: W[3+i] })),
      makeCell('측정완료\n여부', { bold: true, bg: HDR_BG, rowSpan: 2, width: W[13] }),
    ],
  });
  const hdr2 = new TableRow({
    tableHeader: true,
    children: PO_COLUMNS.map((_, i) => makeCell('측정결과', { bg: '#faf8e8', size: 16, width: W[3+i] })),
  });

  const bodyRows = subjects.map((subj, idx) => {
    const avg     = getAvg(subj.name);
    const subjPos = getPosForSubject(subj.name, apiPoMap);
    const hasData = gradesData.some(g => g.subject === subj.name);
    return new TableRow({
      children: [
        ...(idx === 0 ? [
          makeCell(year, { rowSpan: subjects.length + 1, width: W[0] }),
          makeCell(`${year}학년`, { rowSpan: subjects.length + 1, width: W[1] }),
        ] : []),
        makeCell(`교과기반평가\n(${subj.name})`, { width: W[2] }),
        ...PO_COLUMNS.map((po, i) => {
          const mapped = subjPos.includes(po);
          return makeCell(
            !mapped ? '' : (avg !== null ? avg : '예정'),
            { bg: mapped ? '#fffde7' : undefined, color: avg !== null && mapped ? '1F3864' : '888888', bold: mapped && avg !== null, width: W[3+i] }
          );
        }),
        makeCell(hasData ? '완료' : '예정', { color: hasData ? '1A7A1A' : '888888', bold: hasData, width: W[13] }),
      ],
    });
  });

  const summaryRow = new TableRow({
    children: [
      makeCell('총괄평가', { bold: true, bg: '#FFF9C4', width: W[2] }),
      ...PO_COLUMNS.map((po, i) => {
        const active = subjects.some(s => getPosForSubject(s.name, apiPoMap).includes(po));
        const avg    = getOvAvg(po);
        return makeCell(!active ? '' : (avg !== null ? avg : '예정'), {
          bg: active ? '#FFF9C4' : undefined, bold: avg !== null, color: avg !== null ? 'C00000' : '888888', width: W[3+i],
        });
      }),
      makeCell('', { width: W[13] }),
    ],
  });

  return new DocxTable({ width: { size: 12960, type: WidthType.DXA }, columnWidths: W, rows: [hdr1, hdr2, ...bodyRows, summaryRow] });
};

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
const GradePage = ({ yearFilter, onYearChange }) => {
  const [subjects,        setSubjects]        = useState([]);
  const [apiPoMap,        setApiPoMap]        = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [gradesData,      setGradesData]      = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [activeTab,       setActiveTab]       = useState('input');
  const [savedAt,         setSavedAtState]    = useState(null);
  const [saveStatus,      setSaveStatus]      = useState('');
  const [exporting,       setExporting]       = useState(false);
  const isFirstRender = useRef(true);

  // gradesData 변경 시 자동 백업
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!yearFilter || !gradesData.length) return;
    LS.set(LS.gradesKey(yearFilter), gradesData);
  }, [gradesData]);

  const loadGradesData = useCallback(async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/grades/${yearFilter}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setGradesData(res.data);
        LS.set(LS.gradesKey(yearFilter), res.data);
        writeSavedAt(yearFilter); setSavedAtState(getSavedAt(yearFilter));
        return;
      }
    } catch {}
    const local = LS.get(LS.gradesKey(yearFilter));
    if (local?.length) { setGradesData(local); setSavedAtState(getSavedAt(yearFilter)); }
    else setGradesData([]);
  }, [yearFilter]);

  useEffect(() => {
    if (!yearFilter) return;
    isFirstRender.current = true;
    setGradesData([]); setSavedAtState(getSavedAt(yearFilter)); setSaveStatus('');

    (async () => {
      setLoading(true);
      try {
        const subjRes = await axios.get(`http://localhost:8000/api/명세서/courses?year=${yearFilter}`);
        const processed = (subjRes.data.courses || []).map(s => ({
          name: s.course_name || s.과목명 || s.교과목명 || '',
          type: s.area_1 || s.교과영역_1 || '필수',
          term: s.grade_sem || `${s.개설학년||'-'}학년 ${s.개설학기||'-'}학기`,
        })).sort((a, b) =>
          String(a.type).includes('필수') === String(b.type).includes('필수') ? 0
            : String(a.type).includes('필수') ? -1 : 1
        );
        setSubjects(processed);
        LS.set(LS.subjectsKey(yearFilter), processed);

        try {
          const specRes = await axios.get(`http://localhost:8000/api/load-draft/${encodeURIComponent('명세서')}`);
          const map = {};
          (specRes.data.rows || []).forEach(row => {
            const name = row.course_name || row['교과목명'];
            const pos = [];
            for (let i = 1; i <= 10; i++) {
              if (['O','V'].includes(row[`po${i}`] || row[`PO${i}`])) pos.push(`PO${i}`);
            }
            if (name) map[name] = pos.join(', ');
          });
          setApiPoMap(map);
          LS.set(LS.poMapKey(yearFilter), map);
        } catch {}
      } catch {
        const cached = LS.get(LS.subjectsKey(yearFilter));
        if (cached?.length) setSubjects(cached);
        const cachedMap = LS.get(LS.poMapKey(yearFilter));
        if (cachedMap) setApiPoMap(cachedMap);
      } finally { setLoading(false); }
    })();
    loadGradesData();
  }, [yearFilter]);

  // ── 엑셀 업로드 ──────────────────────────────────────────────────────────
  const handleExcelUpload = e => {
    const file = e.target.files[0];
    if (!file || !selectedSubject) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type:'array', codepage:949 });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
        const entries = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const studentId       = String(row[0]||'').trim();
          const name            = String(row[1]||'').trim();
          const isParticipating = String(row[2]||'').trim().toUpperCase() !== 'X';
          const rawGrade        = String(row[3]||'F').trim().toUpperCase().charAt(0);
          entries.push({
            id: `G-${yearFilter}-${selectedSubject.name}-${studentId}-${Date.now()}`,
            year: yearFilter, subject: selectedSubject.name,
            studentId, name, isParticipating,
            grade: rawGrade, points: GRADE_POINTS[rawGrade] ?? 0,
          });
        }
        if (!entries.length) { alert('데이터가 없습니다. 형식을 확인해주세요.'); return; }
        setGradesData(prev => {
          const updated = [...prev.filter(g => g.subject !== selectedSubject.name), ...entries];
          LS.set(LS.gradesKey(yearFilter), updated);
          writeSavedAt(yearFilter); setSavedAtState(getSavedAt(yearFilter));
          return updated;
        });
        alert(`✅ [${selectedSubject.name}] ${entries.length}명 업로드 완료`);
      } catch { alert('파일 처리 중 오류가 발생했습니다.'); }
      finally { e.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── 계산 함수들 ───────────────────────────────────────────────────────────
  const getSubjectAvg = subjName => {
    const list = gradesData.filter(g => g.subject === subjName && g.isParticipating);
    if (!list.length) return null;
    return (list.reduce((a, c) => a + (Number(c.points)||0), 0) / list.length).toFixed(2);
  };

  // 이수율 % (D·F 제외)
  const getPassRate = subjName => {
    const list = gradesData.filter(g => g.subject === subjName && g.isParticipating);
    if (!list.length) return null;
    const passed = list.filter(g => g.grade !== 'D' && g.grade !== 'F').length;
    return ((passed / list.length) * 100).toFixed(1) + '%';
  };

  const getPoCell = (subjName, poCol) => {
    if (!getPosForSubject(subjName, apiPoMap).includes(poCol)) return null;
    const avg = getSubjectAvg(subjName);
    return avg !== null ? avg : '예정';
  };

  const getCompletionStatus = subjName => {
    const pos = getPosForSubject(subjName, apiPoMap);
    if (!pos.length) return '';
    return gradesData.some(g => g.subject === subjName) ? '완료' : '예정';
  };

  const getPoOverallAvg = poCol => {
    const avgs = subjects.filter(s => getPosForSubject(s.name, apiPoMap).includes(poCol))
      .map(s => getSubjectAvg(s.name)).filter(v => v !== null).map(Number);
    if (!avgs.length) return null;
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
  };

  const getPoGoalStatus = poSubjects => {
    const withData = poSubjects.filter(s => gradesData.some(g => g.subject === s.name));
    if (!withData.length) return { lines: ['진행예정'], color: 'text-secondary' };
    const rates = withData.map(s => {
      const list = gradesData.filter(g => g.subject === s.name && g.isParticipating);
      return list.length ? (list.filter(g => g.grade !== 'D' && g.grade !== 'F').length / list.length) * 100 : 0;
    });
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (withData.length < poSubjects.length)
      return { lines: ["수행수준 70% 이상 '중' 이상 도달", "진행중"], color: 'text-warning' };
    return avg >= 70
      ? { lines: ["수행수준 70% 이상 '중' 이상 도달", "✔ 도달"], color: 'text-success' }
      : { lines: ["수행수준 70% 이상 '중' 이상 도달", "✘ 미달"], color: 'text-danger' };
  };

  // ── 최종 저장 ─────────────────────────────────────────────────────────────
  const handleFinalSave = async () => {
    if (!gradesData.length) { alert('저장할 성적 데이터가 없습니다.'); return; }
    if (!window.confirm(`${yearFilter}학년도 성적 데이터를 최종 저장하시겠습니까? (총 ${gradesData.length}건)`)) return;
    setSaveStatus('saving');
    LS.set(LS.gradesKey(yearFilter), gradesData);
    writeSavedAt(yearFilter); setSavedAtState(getSavedAt(yearFilter));
    try {
      await axios.post('http://localhost:8000/api/save/final/성적', { year: yearFilter, data: gradesData });
      setSaveStatus('saved');
      alert(`✅ 서버 + 로컬 저장 완료 (${gradesData.length}건)`);
    } catch (e) {
      setSaveStatus('error');
      alert(`⚠️ 서버 저장 실패. 로컬(브라우저)에는 저장되었습니다.\n${e.message}`);
    }
  };

  const handleClearData = () => {
    if (!window.confirm(`[${yearFilter}학년도] 성적 데이터를 모두 삭제하시겠습니까?`)) return;
    setGradesData([]);
    LS.del(LS.gradesKey(yearFilter)); LS.del(LS.savedAtKey(yearFilter));
    setSavedAtState(null); setSaveStatus('');
  };

  // ── Word 내보내기: PO별 성취도 ([표 2.7.1-1 ~ 5]) ──────────────────────
  // 연도→표 번호 고정 매핑: 2022→1, 2023→2, 2024→3, 2025→4, 2026→5
  const YEAR_TABLE_NUM = { '2022': 1, '2023': 2, '2024': 3, '2025': 4, '2026': 5 };

  const exportPoAchievementWord = async () => {
    setExporting(true);
    try {
      const children = [];
      let isFirst = true;
      for (const yr of YEARS) {
        const yrSubjects = LS.get(LS.subjectsKey(yr)) || (yr === yearFilter ? subjects : []);
        const yrGrades   = LS.get(LS.gradesKey(yr))   || (yr === yearFilter ? gradesData : []);
        const yrPoMap    = LS.get(LS.poMapKey(yr))    || (yr === yearFilter ? apiPoMap : {});
        if (!yrSubjects.length) continue;

        // 연도에 해당하는 고정 표 번호 사용 (2022→1, 2023→2, ...)
        const tNum = YEAR_TABLE_NUM[yr] ?? (YEARS.indexOf(yr) + 1);

        children.push(new Paragraph({
          children: [new TextRun({
            text: `[표 2.7.1-${tNum}]  ${yr}학년도 PO별 성취도 측정 실적`,
            bold: true, size: 22, font: '맑은 고딕',
          })],
          spacing: { before: isFirst ? 0 : 560, after: 140 },
        }));
        children.push(buildPoAchievementTable(yr, yrSubjects, yrGrades, yrPoMap));
        isFirst = false;
      }

      if (!children.length) { alert('내보낼 데이터가 없습니다.\n연도별 과목 데이터를 먼저 로드해주세요.'); return; }

      const doc = new Document({
        styles: { default: { document: { run: { font: '맑은 고딕', size: 20 } } } },
        sections: [{
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
            },
          },
          children,
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'PO별_성취도_측정_실적.docx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('Word 생성 오류: ' + e.message); }
    finally { setExporting(false); }
  };

  // ── Word 내보내기: PO 성취도 표 ([표 2.7.1-7]) ───────────────────────────
  const exportPoOverallWord = async () => {
    setExporting(true);
    try {
      const doc = new Document({
        styles: { default: { document: { run: { font: '맑은 고딕', size: 20 } } } },
        sections: [{
          properties: {
            page: {
              size: { width: 15840, height: 12240, orientation: PageOrientation.LANDSCAPE },
              margin: { top: 1080, right: 720, bottom: 1080, left: 720 },
            },
          },
          children: [
            new Paragraph({
              children: [new TextRun({
                text: `[표 2.7.1-7]  프로그램 최종성과(PO) 성취도 측정 실적  (${yearFilter}학년도)`,
                bold: true, size: 22, font: '맑은 고딕',
              })],
              spacing: { after: 140 },
            }),
            buildPoOverallTable(yearFilter, subjects, gradesData, apiPoMap),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `[표2.7.1-7]_PO성취도_${yearFilter}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('Word 생성 오류: ' + e.message); }
    finally { setExporting(false); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB 1: 성적 입력
  // ══════════════════════════════════════════════════════════════════════════
  const renderInputTab = () => (
    <Row className="g-4">
      <Col lg={5}>
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-dark text-white fw-bold py-3">{yearFilter}학년도 교과목 리스트</Card.Header>
          <Card.Body className="p-0">
            <Table hover responsive className="m-0 text-center align-middle">
              <thead className="table-light small">
                <tr><th>구분</th><th>교과목명</th><th>학년-학기</th><th>입력</th></tr>
              </thead>
              <tbody className="small">
                {subjects.map((subj, idx) => (
                  <tr key={idx} onClick={() => setSelectedSubject(subj)}
                      style={{ cursor:'pointer', backgroundColor: selectedSubject?.name === subj.name ? '#f0f7ff' : '' }}>
                    <td><Badge bg={subj.type.includes('필수') ? 'danger' : 'primary'}>{subj.type.substring(0,2)}</Badge></td>
                    <td className="text-start fw-bold">{subj.name}</td>
                    <td className="text-muted">{subj.term}</td>
                    <td>{gradesData.some(g => g.subject === subj.name)
                      ? <Badge bg="success">O</Badge> : <Badge bg="secondary">X</Badge>}
                    </td>
                  </tr>
                ))}
                {!subjects.length && !loading && <tr><td colSpan="4" className="py-5 text-muted">데이터가 없습니다.</td></tr>}
              </tbody>
            </Table>
            {loading && <div className="p-4 text-center"><div className="spinner-border spinner-border-sm text-primary" /></div>}
          </Card.Body>
        </Card>
      </Col>
      <Col lg={7}>
        {selectedSubject ? (
          <Card className="shadow-sm border-0 border-top border-4 border-primary">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <div>
                <h5 className="fw-bold m-0">{selectedSubject.name}</h5>
                <Badge bg="info" className="mt-1">
                  연계 PO: {getPosForSubject(selectedSubject.name, apiPoMap).join(', ') || '미지정'}
                </Badge>
              </div>
              <div className="text-end">
                <div className="small text-secondary">이수율 (D·F 제외)</div>
                <div className="fs-3 fw-bold text-success">{getPassRate(selectedSubject.name) ?? '—'}</div>
                <div className="small text-muted">3점 평균 <strong className="text-primary">{getSubjectAvg(selectedSubject.name) ?? '—'}</strong> / 3.00</div>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="p-3 bg-light rounded border mb-4">
                <Form.Label className="fw-bold small">📁 성적 엑셀 파일 불러오기</Form.Label>
                <Form.Control type="file" size="sm" onChange={handleExcelUpload} accept=".xlsx,.xls,.csv" />
                <div className="mt-2 text-muted" style={{ fontSize:'0.78rem' }}>※ 형식: 학번 | 이름 | 이수여부(O/X) | 성적(A~F)</div>
              </div>
              <h6 className="fw-bold mb-3">학생별 성적 내역 ({gradesData.filter(g => g.subject === selectedSubject.name).length}명)</h6>
              <div style={{ maxHeight:'420px', overflowY:'auto' }} className="border rounded shadow-sm">
                <Table size="sm" striped hover className="text-center m-0 align-middle">
                  <thead className="table-secondary sticky-top small">
                    <tr><th>학번</th><th>이름</th><th>이수여부</th><th>성적</th><th>점수</th></tr>
                  </thead>
                  <tbody className="small">
                    {gradesData.filter(g => g.subject === selectedSubject.name).map((g, idx) => (
                      <tr key={idx}>
                        <td className="text-muted">{g.studentId}</td>
                        <td className="fw-bold">{g.name}</td>
                        <td><Badge bg={g.isParticipating ? 'success' : 'secondary'}>{g.isParticipating ? 'O' : 'X'}</Badge></td>
                        <td className="fw-bold text-primary">{g.grade}</td>
                        <td>{g.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
            <Card.Footer className="bg-white py-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="small">
                  {saveStatus === 'saving' && <span className="text-secondary"><span className="spinner-border spinner-border-sm me-1"/>저장 중...</span>}
                  {saveStatus === 'saved'  && <span className="text-success">✅ 최종 저장 완료</span>}
                  {saveStatus === 'error'  && <span className="text-warning">⚠️ 서버 실패 (로컬 저장됨)</span>}
                  {saveStatus === ''       && savedAt && <span className="text-muted">💾 마지막 저장: {savedAt}</span>}
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-danger" size="sm" onClick={handleClearData}>초기화</Button>
                  <Button variant="primary" className="px-4 fw-bold" onClick={handleFinalSave} disabled={saveStatus === 'saving'}>
                    {saveStatus === 'saving' ? '저장 중...' : '최종 저장'}
                  </Button>
                </div>
              </div>
            </Card.Footer>
          </Card>
        ) : (
          <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted bg-light rounded"
               style={{ minHeight:'500px', border:'2px dashed #dee2e6' }}>
            <div className="display-4 mb-3">⬅️</div>
            <h5 className="fw-bold">왼쪽 과목 목록에서 하나를 선택해 주세요.</h5>
          </div>
        )}
      </Col>
    </Row>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB 2: PO 성취도 표
  // ══════════════════════════════════════════════════════════════════════════
  const renderPoTable = () => {
    const isPoActive = po => subjects.some(s => getPosForSubject(s.name, apiPoMap).includes(po));
    const hasAnyData = subjects.some(s => gradesData.some(g => g.subject === s.name));
    return (
      <Card className="shadow-sm border-0 mt-2">
        <Card.Header className="bg-dark text-white fw-bold py-3 d-flex justify-content-between align-items-center">
          <span>📋 {yearFilter}학년도 PO 성취도 측정 현황</span>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="light" text="dark" className="fw-normal fs-6">총 {subjects.length}개 과목</Badge>
            <Button variant="outline-light" size="sm" disabled={exporting} onClick={exportPoOverallWord}>
              {exporting ? '생성 중...' : '📄 Word [표 2.7.1-7]'}
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div style={{ overflowX:'auto' }}>
            <table className="table table-bordered text-center align-middle m-0" style={{ fontSize:'0.78rem', minWidth:'1100px' }}>
              <thead>
                <tr className="table-dark">
                  <th rowSpan={2} style={{ width:'46px' }}>연도</th>
                  <th rowSpan={2} style={{ width:'64px' }}>대상</th>
                  <th rowSpan={2} style={{ minWidth:'185px' }}>평가도구</th>
                  {PO_COLUMNS.map(po => <th key={po} style={{ width:'72px', backgroundColor:'#f5f0d0', color:'#333' }}>{po}</th>)}
                  <th rowSpan={2} style={{ width:'80px' }}>측정완료여부</th>
                </tr>
                <tr>
                  {PO_COLUMNS.map(po => <th key={po} className="text-muted fw-normal" style={{ backgroundColor:'#faf8e8', fontSize:'0.68rem' }}>측정결과</th>)}
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj, idx) => {
                  const subjPos = getPosForSubject(subj.name, apiPoMap);
                  return (
                    <tr key={idx} style={{ cursor:'pointer' }} onClick={() => { setSelectedSubject(subj); setActiveTab('input'); }}>
                      {idx === 0 && <td rowSpan={subjects.length+1} className="fw-bold bg-light" style={{ verticalAlign:'middle' }}>{yearFilter}</td>}
                      {idx === 0 && <td rowSpan={subjects.length+1} className="bg-light" style={{ verticalAlign:'middle', fontSize:'0.75rem' }}>{yearFilter}학년</td>}
                      <td className="text-start ps-2">
                        교과기반평가<br/><span className="text-muted" style={{ fontSize:'0.7rem' }}>({subj.name})</span>
                      </td>
                      {PO_COLUMNS.map(po => {
                        const val = getPoCell(subj.name, po);
                        return (
                          <td key={po} style={{ backgroundColor: subjPos.includes(po) ? '#fffde7' : 'transparent' }}>
                            {val === null ? '' : val === '예정' ? <span className="text-secondary">예정</span> : <span className="fw-bold text-primary">{val}</span>}
                          </td>
                        );
                      })}
                      <td>
                        {getCompletionStatus(subj.name) === '완료' ? <Badge bg="success">완료</Badge>
                          : getCompletionStatus(subj.name) === '예정' ? <span className="text-secondary">예정</span>
                          : <span className="text-muted">-</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="table-warning fw-bold">
                  <td className="text-start ps-2">총괄평가</td>
                  {PO_COLUMNS.map(po => {
                    const active = isPoActive(po); const avg = getPoOverallAvg(po);
                    return (
                      <td key={po} style={{ backgroundColor: active ? '#fff9c4' : 'transparent' }}>
                        {!active ? '' : avg === null ? <span className="text-secondary fw-normal">예정</span> : <span className="text-danger fw-bold">{avg}</span>}
                      </td>
                    );
                  })}
                  <td>{hasAnyData ? <Badge bg="warning" text="dark">진행중</Badge> : <span className="text-secondary fw-normal">예정</span>}</td>
                </tr>
                {!subjects.length && !loading && <tr><td colSpan={14} className="py-5 text-muted">데이터가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          {loading && <div className="p-4 text-center"><div className="spinner-border spinner-border-sm text-primary"/></div>}
        </Card.Body>
        <Card.Footer className="bg-white text-muted small py-2">
          💡 행 클릭 → 성적 입력 이동&nbsp;|&nbsp;🟡 노란 셀: PO 연계&nbsp;|&nbsp;숫자: 3점 만점 평균
        </Card.Footer>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TAB 3: PO별 성취도 보고 (신규)
  // ══════════════════════════════════════════════════════════════════════════
  const renderPoAchievementTab = () => {
    const poGroups = PO_COLUMNS
      .map(po => ({ po, subjects: subjects.filter(s => getPosForSubject(s.name, apiPoMap).includes(po)) }))
      .filter(g => g.subjects.length > 0);
    const totalRows = poGroups.reduce((s, g) => s + g.subjects.length, 0);

    return (
      <Card className="shadow-sm border-0 mt-2">
        <Card.Header className="bg-dark text-white fw-bold py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>📊 {yearFilter}학년도 PO별 성취도 측정 실적</span>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-light text-dark fw-normal" style={{ fontSize:'0.72rem' }}>
              이수율 = (A+B+C 학생 수) ÷ 전체 이수자 × 100
            </span>
            <Button variant="outline-light" size="sm" disabled={exporting} onClick={exportPoAchievementWord}>
              {exporting ? '📄 생성 중...' : '📄 Word 내보내기 [표 2.7.1-1~5]'}
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div style={{ overflowX:'auto' }}>
            <table className="table table-bordered text-center align-middle m-0" style={{ fontSize:'0.83rem', minWidth:'860px' }}>
              <thead>
                <tr style={{ backgroundColor:'#D9E1F2' }}>
                  <th style={{ width:'52px' }}>연도</th>
                  <th style={{ width:'72px' }}>대상</th>
                  <th style={{ width:'68px', backgroundColor:'#FFF2CC' }}>PO</th>
                  <th style={{ minWidth:'260px' }}>평가도구</th>
                  <th style={{ width:'160px' }}>
                    수행 측정 결과<br/>
                    <small className="fw-normal text-muted">(=성취수준)</small>
                  </th>
                  <th style={{ minWidth:'200px' }}>목표달성 여부</th>
                </tr>
              </thead>
              <tbody>
                {!poGroups.length && !loading && (
                  <tr><td colSpan={6} className="py-5 text-muted">
                    데이터가 없습니다. 과목 목록이 로드된 후 확인하세요.
                  </td></tr>
                )}
                {poGroups.map(({ po, subjects: poSubjs }, gIdx) => {
                  const goal      = getPoGoalStatus(poSubjs);
                  const isVeryFirst = gIdx === 0;
                  return poSubjs.map((subj, si) => {
                    const rate = getPassRate(subj.name);
                    return (
                      <tr key={`${po}-${si}`} style={{ cursor:'pointer' }}
                          onClick={() => { setSelectedSubject(subj); setActiveTab('input'); }}>
                        {isVeryFirst && si === 0 && (
                          <td rowSpan={totalRows} className="fw-bold bg-light align-middle">{yearFilter}</td>
                        )}
                        {isVeryFirst && si === 0 && (
                          <td rowSpan={totalRows} className="bg-light align-middle" style={{ fontSize:'0.78rem' }}>
                            {yearFilter}<br/>학년
                          </td>
                        )}
                        {si === 0 && (
                          <td rowSpan={poSubjs.length} className="fw-bold align-middle"
                              style={{ backgroundColor:'#FFF2CC', fontSize:'0.9rem' }}>{po}</td>
                        )}
                        <td className="text-start ps-3">
                          교과기반평가
                          <br/><span className="text-muted" style={{ fontSize:'0.72rem' }}>({subj.name})</span>
                        </td>
                        <td>
                          {rate !== null
                            ? <span className="fw-bold text-primary" style={{ fontSize:'1.05rem' }}>{rate}</span>
                            : <span className="text-secondary small">진행예정</span>}
                        </td>
                        {si === 0 && (
                          <td rowSpan={poSubjs.length} className={`align-middle ${goal.color}`}
                              style={{ lineHeight:'1.6' }}>
                            {goal.lines.map((line, li) => (
                              <div key={li} className={li === 0 ? 'fw-semibold' : 'fw-bold'} style={{ fontSize: li === 0 ? '0.78rem' : '0.88rem' }}>
                                {line}
                              </div>
                            ))}
                          </td>
                        )}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
          {loading && <div className="p-4 text-center"><div className="spinner-border spinner-border-sm text-primary"/></div>}
        </Card.Body>
        <Card.Footer className="bg-white text-muted small py-2">
          💡 행 클릭 → 성적 입력 이동&nbsp;|&nbsp;
          Word 내보내기: 로컬에 저장된 모든 연도의 [표 2.7.1-1] ~ [표 2.7.1-5] 자동 생성&nbsp;|&nbsp;
          각 연도 과목 목록을 최소 1회 방문해야 내보내기에 포함됩니다.
        </Card.Footer>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  메인 렌더
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 bg-white min-vh-100 overflow-auto">
      <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
        <div>
          <h4 className="fw-bold text-primary m-0">📊 성적 및 PO 성취도 분석</h4>
          {savedAt && <small className="text-muted">💾 {yearFilter}학년도 마지막 저장: {savedAt}</small>}
        </div>
        <ul className="nav nav-pills">
          {YEARS.map(y => (
            <li className="nav-item" key={y}>
              <button
                className={`nav-link py-1 px-3 ${yearFilter === y ? 'active fw-bold' : 'text-secondary'}`}
                onClick={() => { onYearChange(y); setSelectedSubject(null); setSaveStatus(''); }}
              >{y}</button>
            </li>
          ))}
          <li className="nav-item ps-2">
            <Button variant="outline-secondary" size="sm" onClick={() => {
              const n = prompt('추가할 연도를 입력하세요'); if (n) onYearChange(n);
            }}>+</Button>
          </li>
        </ul>
      </div>

      <ul className="nav nav-tabs mb-4">
        {[
          { key:'input',           label:'✏️ 성적 입력' },
          { key:'po-table',        label:'📋 PO 성취도 표' },
          { key:'po-achievement',  label:'📊 PO별 성취도 보고' },
        ].map(tab => (
          <li className="nav-item" key={tab.key}>
            <button
              className={`nav-link fw-bold ${activeTab === tab.key ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab(tab.key)}
            >{tab.label}</button>
          </li>
        ))}
      </ul>

      {activeTab === 'input'          && renderInputTab()}
      {activeTab === 'po-table'       && renderPoTable()}
      {activeTab === 'po-achievement' && renderPoAchievementTab()}
    </div>
  );
};

export default GradePage;
