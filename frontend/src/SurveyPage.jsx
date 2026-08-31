import { useState, useEffect, useRef, useCallback } from "react";
import {
  Container, Row, Col, Card, Button, Form,
  ProgressBar, Badge, Alert, Tab, Nav, Table, Spinner
} from "react-bootstrap";

// ============================================================
//  API 설정 — 실제 백엔드 주소로 변경하세요
// ============================================================
const GS_URL = "https://script.google.com/macros/s/AKfycbw-QN9wfe_inEtGkXpU49veyeg5lQO0XhGvJbIoIwb96rkX8-T9j0jdQIfwZsI5KMPf6w/exec";

// ── 관리자 비밀번호 (변경 후 git push 하세요) ──────────────────────────────
const ADMIN_PASSWORD = "yonsei2024";

// ============================================================
//  상수 데이터 정의
// ============================================================

const UNIV = "연세대학교";
const DEPT = "AI보건정보관리학과";

// 2주기(2027~2031) — 직무능력 필요도 7문항
const s0_q1 = [
  "양질의 보건의료정보가 안전하고 효율적으로 생성, 저장, 활용되도록 관리함으로써 국가와 기관의 보건의료데이터 거버넌스를 구현하는 능력",
  "보건의료정보의 컨텐츠와 기술의 국제 표준을 준수하고, AI가 활용 가능한 형태로 이를 적용·개발함으로써 국가 보건의료정보의 신뢰성과 상호운용성을 확보하고 정보교류 및 효율적 활용을 촉진하는 능력",
  "보건의료정보 분야의 국제 표준을 준수하여 진단·의료행위를 분류하고, AI 기반 자동 분류·코딩 결과를 검증함으로써 가치 있는 정보생성 및 활용에 기여하는 능력",
  "의무기록 기반의 정확하고 윤리적인 보험 청구 및 평가 데이터의 생성, 분석, 연계를 제공하는 능력",
  "보건의료정보의 전생애주기를 관리하고 가명처리·데이터신임(DRB) 등 2차 활용 절차를 포함한 안전한 정보 보호 관리 체계를 구축하는 능력",
  "인공지능·빅데이터 분석 기술을 활용하여 보건의료정보를 다양하게 분석함으로 부가가치 높은 지식과 정보를 생산하는 능력",
  "국가와 기관이 올바르고 미래지향적인 보건의료 및 디지털 헬스케어 정책을 세울 수 있도록 발전방향을 제시하고 협력하는 능력",
];

// 2주기 — 학과 핵심역량 4문항
const s0_q2 = [
  "보건의료정보관리 전문지식과 AI·데이터 기술을 조합 및 융합하는 능력",
  "보건의료정보의 가치를 인식하고 2차 활용 가능성까지 고려하여 관리하는 정보 능력",
  "실무 수행에 필요한 법적, 윤리적 책임과 개인정보보호·AI 윤리를 인식하는 능력",
  "문제 해결에 필요한 보건의료 다직종 협업 및 의사소통 능력",
];

// 2주기 — 인재상 4문항
const s0_q3 = [
  "AI 시대에 요구되는 우수한 직무능력을 갖춘 인력",
  "인간존중의 인성을 갖춘 인력",
  "AI 등 기술 환경 변화에 자기주도적으로 적응하는 인력",
  "창의적/혁신적 문제 해결 능력을 갖춘 인력",
];

const SUBJECTS = [
  ["1-2", "인체해부생리학"], ["1-2", "공중보건학"],
  ["2-1", "보건의료정보관리학"], ["2-1", "의학용어 Ⅰ"],
  ["2-2", "보건의료정보관리 실무"], ["2-2", "보건의료정보기술"],
  ["2-2", "의학용어 Ⅱ"], ["2-2", "병리학"],
  ["3-1", "보건의료조직 관리"], ["3-1", "질병 및 의료행위분류"],
  ["3-1", "의무기록정보 분석 실무"], ["3-1", "보건의료통계학"],
  ["3-2", "암등록"], ["3-2", "보건의료데이터관리"],
  ["3-2", "질병분류심화"], ["3-2", "원무관리"],
  ["4-1", "의료관계법규"], ["4-1", "의료의 질관리"],
  ["4-1", "건강보험 이론 및 실무(CDI)"], ["4-1", "병원현장 실습"],
  ["4-1", "조사방법론"], ["4-2", "건강정보보호"],
  ["4-2", "의무기록정보 질향상 실무"],
];

// 2주기 — Ⅰ.교육과정 및 운영 23문항 (산업체·졸업생·재학생 공통)
const s23_q1 = [
  // Q1~Q2: 보건의료정보관리사의 필요도
  "AI 대전환에 따라, 보건의료정보관리사의 역할이 의무기록 관련에서 보건의료데이터의 표준화·품질관리·분석으로 확대되고 있습니다. 추후 보건의료정보관리사의 역할 및 진출이 활발해질 것이라고 생각하십니까?",
  "귀 기관에서 AI·보건의료데이터 관련 업무를 수행할 보건의료정보관리사의 필요도가 증가할 것이라고 생각하십니까?",
  // Q3~Q9: 보건의료정보관리사의 직무능력
  "양질의 보건의료정보가 안전하고 효율적으로 생성, 저장, 활용되도록 관리함으로써 국가와 기관의 보건의료데이터 거버넌스를 구현하는 능력",
  "보건의료정보의 컨텐츠와 기술의 국제 표준을 준수하고, AI가 활용 가능한 형태로 이를 적용·개발함으로써 국가 보건의료정보의 신뢰성과 상호운용성을 확보하고 정보교류 및 효율적 활용을 촉진하는 능력",
  "보건의료정보 분야의 국제 표준을 준수하여 진단·의료행위를 분류하고, AI 기반 자동 분류·코딩 결과를 검증함으로써 가치 있는 정보생성 및 활용에 기여하는 능력",
  "의무기록 기반의 정확하고 윤리적인 보험 청구 및 평가 데이터의 생성, 분석, 연계를 제공하는 능력",
  "보건의료정보의 전생애주기를 관리하고 가명처리·데이터신임(DRB) 등 2차 활용 절차를 포함한 안전한 정보 보호 관리 체계를 구축하는 능력",
  "인공지능·빅데이터 분석 기술을 활용하여 보건의료정보를 다양하게 분석함으로 부가가치 높은 지식과 정보를 생산하는 능력",
  "국가와 기관이 올바르고 미래지향적인 보건의료 및 디지털 헬스케어 정책을 세울 수 있도록 발전방향을 제시하고 협력하는 능력",
  // Q10~Q13: 학과 핵심역량
  "보건의료정보관리 전문지식과 AI·데이터 기술을 조합 및 융합하는 능력",
  "보건의료정보의 가치를 인식하고 2차 활용 가능성까지 고려하여 관리하는 정보 능력",
  "실무 수행에 필요한 법적, 윤리적 책임과 개인정보보호·AI 윤리를 인식하는 능력",
  "문제 해결에 필요한 보건의료 다직종 협업 및 의사소통 능력",
  // Q14~Q17: 학과 교육과정 이수자에게 요구되는 인재상
  "AI 시대에 요구되는 우수한 직무능력을 갖춘 인력",
  "인간존중의 인성을 갖춘 인력",
  "AI 등 기술 환경 변화에 자기주도적으로 적응하는 인력",
  "창의적/혁신적 문제 해결 능력을 갖춘 인력",
  // Q18~Q23: 교과 운영의 중요도
  "사회(현장)의 요구 반영",
  "학과 교육목표와 교육 내용의 일관성",
  "체계적이고 전문적 강의",
  "강의시설 및 AI·데이터 실습 환경",
  "교수의 수",
  "행정적 지원",
];

// 2주기 — 산업체 만족도 9문항
const s2_q2 = [
  "본 학과 졸업생은 성실하며, 직업에 대한 소명의식을 가지고 있습니까?",
  "본 학과 졸업생은 직장에서 보건의료 다직종과 원만한 대인관계를 유지하는 능력을 가지고 있습니까?",
  "본 학과 졸업생은 주어진 직무 수행에 요구되는 직업 기초 능력을 갖추고 있습니까?",
  "본 학과 졸업생의 AI·보건의료정보 관련 직무 수행에 만족하십니까?",
  "본 학과 졸업생을 앞으로 채용할 의사가 있으십니까?",
  "본 학과의 교육목표와 인재상이 AI 시대의 사회(현장) 요구에 맞게 수립되어 있다고 생각하십니까?",
  "본 학과는 귀 기관에 필요한 AI·보건의료정보 융합 인재를 양성할 수 있는 교육과정을 가지고 있다고 생각하십니까?",
  "본 학과는 정규 교육과정 외, 다양한 방법으로 사회(현장)에서 필요한 인재를 양성하고 있다고 생각하십니까?",
  "귀 기관은 본 학과와 다양한 산학협력을 통하여 긴밀한 유대관계를 맺고 있습니까?",
];

// 2주기 — 졸업생 만족도 9문항
const s3_q2 = [
  "본 교육과정을 통하여 성실하며, 직업에 대한 소명의식을 지니게 되었습니까?",
  "본 교육과정을 통하여 직장에서 보건의료 다직종과 원만한 대인관계를 유지하는 능력을 가지게 되었습니까?",
  "본 교육과정을 통하여 주어진 직무 수행에 요구되는 직업 기초 능력을 갖추게 되었습니까?",
  "본 교육과정을 통하여 습득된 AI·보건의료정보 직무능력으로 주어진 직무를 원활히 수행할 수 있습니까?",
  "본 학과 졸업생을 본인이 근무하는 기관 또는 타 기관에 소개할 의사가 있으십니까?",
  "본 학과의 교육목표와 인재상이 AI 시대의 사회(현장) 요구에 맞게 수립되어 있습니까?",
  "본 학과는 현장에 필요한 AI·보건의료정보 융합 인재를 양성할 수 있는 교육과정을 가지고 있습니까?",
  "본 학과는 정규 교육과정 외, 다양한 방법으로 사회(현장)에서 필요한 인재를 양성하고 있다고 생각하십니까?",
  "본 학과가 맺고 있는 다양한 산학협력이 취업에 도움이 되었습니까?",
];

// 2주기 PO1~PO10 — 학습성과 (산업체·졸업생·재학생 공통)
const s23_q3 = [
  "[PO1] 보건의료정보관리의 기초 지식과 정보기술을 이해하고, 이를 AI 기반 보건의료정보 실무에 적용한다.",
  "[PO2] 데이터품질관리(DQM)를 위해 보건의료정보의 질을 개선하고, 질병·의료행위 분류에 AI 자동분류·검증 기술을 활용한다.",
  "[PO3] 보건의료 빅데이터를 다양한 이용 목적에 맞춰 변환하고, 인공지능·기계학습 기법을 활용하여 분석한다.",
  "[PO4] 보건의료정보관리에 영향을 미치는 법·제도·기술 변화를 이해하고, 마이데이터 등 디지털 전환 요소를 조직의 정보관리 정책에 반영·관리한다.",
  "[PO5] 양질의 정보 생성을 위한 보건의료정보 표준과 관련 정보기술을 이해하고, AI·클라우드 기반 정보시스템에 적용하는 방법을 이해한다.",
  "[PO6] 보건의료정보의 품질 향상을 위해 의료진·IT·데이터 등 관련 분야 전문가와 효과적으로 협업하고 의사소통한다.",
  "[PO7] 지능형 의료정보 환경에서 조직·팀 내 보건의료정보관리사의 역할을 이해하고 주도적으로 수행한다.",
  "[PO8] 보건의료정보관리사의 업무와 윤리, 사회적 책임을 이해하고, AI·데이터 활용에 따른 개인정보보호·정보보안 책임을 실천한다.",
  "[PO9] 보건의료정보관리에 영향을 미치는 국내·외 보건의료 정책과 디지털 헬스케어 정책 변화를 확인하고 분석한다.",
  "[PO10] 보건의료 및 AI·정보기술 환경 변화에 능동적으로 대응하여 진로를 개발하고, 평생학습을 통해 지속적으로 자기개발을 한다.",
];

const s4_q1 = [
  `${UNIV} ${DEPT}의 교육목표(비전·인재상)를 알고 있다`,
  "보건의료정보관리사 인증 기준(Program Output)을 알고 있다",
  "학과 홈페이지에 교육목표와 프로그램 성과가 공지되어 있음을 알고 있다",
  "재학 중 취득해야 할 자격증 및 면허증의 종류를 알고 있다",
  "학과에서 요구하는 졸업 요건을 알고 있다",
];

const s4_q2 = [
  "선수과목 이수 후 후수과목을 수강할 때 학습이 더 효과적이라고 느낀다",
  "선-후수 교과목 체계가 체계적으로 구성되어 있다고 생각한다",
  "선수과목 미이수 시 후수과목 학습에 어려움이 있었던 경험이 있다",
  "현재 교과목 연계 체계에 전반적으로 만족한다",
];

const EXAM_SUBJECTS = [
  "건강보험 이론 및 실무", "암 등록", "건강정보보호", "의료관계 법규",
  "병리학", "의료의 질 관리", "보건의료데이터 관리", "의료정보기술",
  "보건의료정보관리 실무", "의무기록정보 분석 실무", "보건의료정보관리학",
  "의무기록정보 질 향상 실무", "보건의료조직 관리", "의학 용어",
  "보건의료 통계", "질병 및 의료행위 분류", "해부생리학",
];

const s6_q1 = [
  "학과는 학생들의 국가고시 지원을 위해 계획을 수립하고 있다.",
  "학과는 학생들에게 국가고시와 관련한 정보를 공지한다.",
  "학과에서 시행하는 국가고시 관련특강에 대해 만족한다.",
  "학과에서 시행하는 국가고시 대비 모의고사에 대해 만족한다.",
  "학과의 국가고시 대비 모의고사 문제풀이(오답풀이)에 대해 만족한다.",
  "학과에서 제공하는  국가고시 합격률 등 결과 분석 정보 제공에 대해 만족한다.",
];

const SURVEY_TABS = [
  { key: "s0", title: "① 재학생 설문1", badge: "직무능력" },
  { key: "s1", title: "② 재학생 설문2", badge: "진로/요구도" },
  { key: "s2", title: "③ 산업체 설문", badge: "만족도" },
  { key: "s3", title: "④ 졸업생 설문", badge: "만족도" },
  { key: "s4", title: "⑤ 교육목표 인지도", badge: "인지도" },
  { key: "s5", title: "⑥ 국시 요구도", badge: "요구도" },
  { key: "s6", title: "⑦ 국시 만족도", badge: "만족도" },
];

const LIKERT_LABELS_DEFAULT = ["매우낮음", "낮음", "보통", "높음", "매우높음"];
const LIKERT_LABELS_SATIS = ["매우불만족", "불만족", "보통", "만족", "매우만족"];
const LIKERT_LABELS_AWARE = ["전혀모름", "모름", "보통", "알고있음", "잘알고있음"];
const LIKERT_LABELS_AGREE = ["전혀아님", "아님", "보통", "그렇다", "매우그렇다"];

// ============================================================
//  재사용 컴포넌트
// ============================================================

/** 5점 리커트 척도 테이블 */
function LikertTable({ questions, prefix, answers, onChange, labels = LIKERT_LABELS_DEFAULT }) {
  return (
    <div className="table-responsive">
      <Table bordered hover size="sm" className="align-middle" style={{ minWidth: 480 }}>
        <thead className="table-primary">
          <tr>
            <th style={{ minWidth: 200 }}>문항</th>
            {labels.map((l, i) => (
              <th key={i} className="text-center" style={{ minWidth: 64, fontSize: 11 }}>
                ①{i+1}<br />{l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q, qi) => (
            <tr key={qi}>
              <td style={{ fontSize: 13 }}>
                <strong className="text-primary">{qi + 1}.</strong> {q}
              </td>
              {[1, 2, 3, 4, 5].map((v) => (
                <td key={v} className="text-center" style={{ cursor: "pointer" }}
                  onClick={() => onChange(`${prefix}_${qi}`, v)}>
                  <Form.Check
                    type="radio"
                    name={`${prefix}_${qi}`}
                    value={v}
                    checked={answers[`${prefix}_${qi}`] === v}
                    onChange={() => onChange(`${prefix}_${qi}`, v)}
                    style={{ accentColor: "#0d6efd", pointerEvents: "none" }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** 결과 막대 그래프 (SVG — 픽셀 고정 높이) */
function BarChart({ id, labels, data, color = "rgba(13,110,253,0.75)", maxVal: maxValProp }) {
  const dataMax = Math.max(...data, 1);
  const maxVal = maxValProp ?? (dataMax <= 5 ? 5 : Math.ceil(dataMax / 5) * 5);
  const tickCount = maxVal <= 5 ? maxVal : 5;
  const rowH = 36;          // 행 높이 (px)
  const labelW = 200;       // 라벨 영역 너비 (px)
  const barMaxW = 320;      // 바 최대 너비 (px)
  const axisH = 20;         // 하단 축 라벨 높이 (px)
  const padTop = 6;
  const svgW = labelW + barMaxW + 50;
  const svgH = labels.length * rowH + padTop + axisH;

  return (
    <div style={{ overflowX: "auto", marginBottom: 8 }}>
      <svg width={svgW} height={svgH}
        style={{ display: "block", fontFamily: "sans-serif", fontSize: 12, maxWidth: "100%" }}>
        {/* 배경 그리드 */}
        {Array.from({length: tickCount + 1}, (_, i) => i).map(v => {
          const tickVal = Math.round((v / tickCount) * maxVal);
          const x = labelW + (tickVal / maxVal) * barMaxW;
          return (
            <g key={v}>
              <line x1={x} y1={padTop} x2={x} y2={svgH - axisH}
                stroke={v === 0 ? "#aaa" : "#e5e5e5"} strokeDasharray={v === 0 ? "" : "3,3"} />
              <text x={x} y={svgH - 4} textAnchor="middle" fill="#999" fontSize={10}>{tickVal}</text>
            </g>
          );
        })}
        {/* 바 + 라벨 */}
        {labels.map((label, i) => {
          const val = data[i] ?? 0;
          const barW = (val / maxVal) * barMaxW;
          const y = padTop + i * rowH;
          const short = label.length > 20 ? label.slice(0, 20) + "…" : label;
          return (
            <g key={i}>
              <text x={labelW - 6} y={y + rowH / 2 + 4}
                textAnchor="end" fill="#333" fontSize={11}>
                {short}
              </text>
              <rect x={labelW} y={y + 5} width={Math.max(barW, 2)} height={rowH - 10}
                fill={color} rx={3} />
              <text x={labelW + barW + 5} y={y + rowH / 2 + 4} fill="#555" fontSize={11}>
                {val > 0 ? val.toFixed(2) : "-"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** 결과 요약 테이블 */
function ResultsTable({ labels, avgs }) {
  return (
    <Table striped bordered size="sm" className="mt-3">
      <thead className="table-primary">
        <tr>
          <th style={{ width: 36 }}>#</th>
          <th>문항</th>
          <th style={{ width: 64 }}>평균</th>
          <th style={{ width: 180 }}>분포 (5점 만점)</th>
        </tr>
      </thead>
      <tbody>
        {labels.map((q, i) => (
          <tr key={i}>
            <td className="text-primary fw-bold text-center">{i + 1}</td>
            <td style={{ fontSize: 12 }}>{q}</td>
            <td className="fw-bold text-primary text-center">{avgs[i] ? avgs[i].toFixed(2) : "-"}</td>
            <td style={{ verticalAlign: "middle" }}>
              <ProgressBar
                now={avgs[i] ? avgs[i] * 20 : 0}
                label={avgs[i] ? `${(avgs[i]*20).toFixed(0)}%` : ""}
                style={{ height: 14 }}
                variant="primary"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** 헤더 카드 */
function SurveyHeader({ title, subtitle, notice, isImage = false }) {
  return (
    <Card className="mb-3 border-0 shadow-sm" style={{ borderTop: "6px solid #6610f2" }}>
      <Card.Body className="p-4">
        <h4 className="fw-bold mb-1">{title}</h4>
        <p className="text-muted mb-2">{subtitle}</p>
        {isImage && (
          <Alert variant="success" className="py-2 px-3 mb-2" style={{ fontSize: 12 }}>
            📋 원본 설문지의 이미지를 텍스트로 변환하여 재구성한 설문입니다.
          </Alert>
        )}
        <Alert variant="warning" className="py-2 px-3 mb-0" style={{ fontSize: 13 }}>
          {notice}
        </Alert>
      </Card.Body>
    </Card>
  );
}

/** 인적사항 라디오 그룹 */
function InfoRadio({ name, options, value, onChange }) {
  return (
    <div className="d-flex gap-4 flex-wrap">
      {options.map((opt) => (
        <Form.Check
          key={opt}
          type="radio"
          label={`□ ${opt}`}
          name={name}
          value={opt}
          checked={value === opt}
          onChange={(e) => onChange(name, e.target.value)}
        />
      ))}
    </div>
  );
}

// ============================================================
//  유틸 함수
// ============================================================
function getAvg(responses, prefix, count) {
  return Array.from({ length: count }, (_, i) => {
    const vals = responses.map((r) => r[`${prefix}_${i}`]).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
}

function initLikert(prefix, count) {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}_${i}`, 0]));
}

// 리커트 테이블 전체 응답 여부 확인 (0 = 미응답)
const checkLikert = (answers, prefix) =>
  Object.entries(answers)
    .filter(([k]) => k.startsWith(prefix + "_"))
    .every(([, v]) => Number(v) > 0);

// 미응답 항목 알림 + 제출 차단
const guardSubmit = (e, checks, submitFn) => {
  e.preventDefault();
  const missing = checks.filter(c => !c.ok).map(c => c.label);
  if (missing.length > 0) {
    alert(`⚠ 응답하지 않은 필수 항목이 있습니다:\n\n${missing.map(m => `• ${m}`).join('\n')}`);
    return;
  }
  submitFn();
};

// ============================================================
//  ① 재학생 설문 1
// ============================================================
function Survey0({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender: "", grade: "", ...initLikert("s0q1", s0_q1.length),
    ...initLikert("s0q2", s0_q2.length),
    ...initLikert("s0q3", s0_q3.length),
    ...initLikert("s0q4", s23_q3.length),
  });

  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: !!answers.gender,                    label: "성별" },
        { ok: !!answers.grade,                     label: "학년" },
        { ok: checkLikert(answers, "s0q1"),         label: "Ⅱ. 직무능력 필요도 (전 문항)" },
        { ok: checkLikert(answers, "s0q2"),         label: "Ⅲ. 핵심역량 필요도 (전 문항)" },
        { ok: checkLikert(answers, "s0q3"),         label: "Ⅳ. 인재상 및 교과운영 (전 문항)" },
        { ok: checkLikert(answers, "s0q4"),         label: "Ⅴ. 학습성과 (전 문항)" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="① 재학생 설문 1"
        subtitle="보건의료정보관리사의 직무 능력 조사 (1차)"
        isImage
        notice={`본 설문조사의 목적은 교육수요자의 의견을 수렴하여 AI 시대 직무적합형 인재를 양성하기 위하여 ${UNIV} 미래캠퍼스 보건과학대학 ${DEPT}의 2주기(2027~2031) 교육목표 및 교육과정을 설정하기 위함입니다. 바쁘시더라도 설문에 응답해 주실 것을 부탁드립니다. 응답 내용은 통계법 제33조에 의거 통계적 목적 외에는 절대 사용하지 않을 것이며 개인의 응답 내용의 비밀을 보장하겠습니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 응답자 일반사항</Badge>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="fw-semibold">1. 성별</Form.Label>
              <div className="d-flex gap-4">
                {["남", "여"].map((v, i) => (
                  <Form.Check key={v} type="radio" label={`${i === 0 ? "①" : "②"} ${v}`}
                    name="s0_gender" value={v} checked={answers.gender === v}
                    onChange={(e) => set("gender", e.target.value)} required />
                ))}
              </div>
            </Col>
            <Col md={6}>
              <Form.Label className="fw-semibold">학년</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {["1학년", "2학년", "3학년", "4학년"].map((v) => (
                  <Form.Check key={v} type="radio" label={v} name="s0_grade" value={v}
                    checked={answers.grade === v} onChange={(e) => set("grade", e.target.value)} />
                ))}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 보건의료정보관리사 직무능력 필요도 인식</Badge>
          <LikertTable questions={s0_q1} prefix="s0q1" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅲ. 학과 핵심역량 필요도 인식</Badge>
          <LikertTable questions={s0_q2} prefix="s0q2" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅳ. 인재상 및 교과운영 중요도</Badge>
          <LikertTable questions={s0_q3} prefix="s0q3" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅴ. 학습성과</Badge>
          <LikertTable questions={s23_q3} prefix="s0q4" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center flex-wrap my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary" onClick={() => setAnswers(a => ({ ...a, gender: "", grade: "" }))}>초기화</Button>
      </div>
    </Form>
  );
}

/** ① 결과 */
function Results0({ responses }) {
  const a1 = getAvg(responses, "s0q1", s0_q1.length);
  const a2 = getAvg(responses, "s0q2", s0_q2.length);
  const a3 = getAvg(responses, "s0q3", s0_q3.length);
  const a4 = getAvg(responses, "s0q4", s23_q3.length);
  return (
    <>
      <h6 className="border-start border-primary border-4 ps-2 mb-3">직무능력 필요도 평균 점수</h6>
      <div style={{ height: Math.max(200, s0_q1.length * 34) }}>
        <BarChart id="c0-1" labels={s0_q1} data={a1} />
      </div>
      <h6 className="border-start border-purple border-4 ps-2 mt-4 mb-3" style={{ borderColor: "#6610f2!important" }}>핵심역량 및 인재상 평균 점수</h6>
      <div style={{ height: Math.max(200, (s0_q2.length + s0_q3.length) * 34) }}>
        <BarChart id="c0-2" labels={[...s0_q2, ...s0_q3]} data={[...a2, ...a3]} color="rgba(102,16,242,0.7)" />
      </div>
      <h6 className="border-start border-success border-4 ps-2 mt-4 mb-3">학습성과 평균 점수</h6>
      <div style={{ height: Math.max(200, s23_q3.length * 34) }}>
        <BarChart id="c0-3" labels={s23_q3} data={a4} color="rgba(25,135,84,0.7)" />
      </div>
      <ResultsTable labels={[...s0_q1, ...s0_q2, ...s0_q3, ...s23_q3]} avgs={[...a1, ...a2, ...a3, ...a4]} />
    </>
  );
}

// ============================================================
//  ② 재학생 설문 2
// ============================================================
function Survey1({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender: "", grade: "", career: { 보건의료정보부서: "", 보건교육: "", 병원행정부서: "", 공무원: "", 보험회사: "" },
    careerOther: "", certs: [], certOther: "", q3: "", q4: 0, improve: {},
    weakSubs: [], subRatings: {},
  });
  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  const toggleCert = (v) => {
    setAnswers((p) => ({
      ...p,
      certs: p.certs.includes(v) ? p.certs.filter((c) => c !== v) : [...p.certs, v],
    }));
  };
  const toggleWeak = (v) => {
    setAnswers((p) => ({
      ...p,
      weakSubs: p.weakSubs.includes(v) ? p.weakSubs.filter((s) => s !== v) : [...p.weakSubs, v],
    }));
  };

  const CERTS = ["보건의료정보관리사","ADSp","SQLD","컴퓨터활용능력1급","사회조사분석사","토익 850점 이상","빅데이터분석기사","기타"];
  const CAREER_ITEMS = ["보건의료정보부서","보건교육","병원행정부서","공무원","보험회사"];

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: !!answers.gender,          label: "성별" },
        { ok: !!answers.grade,           label: "학년" },
        { ok: answers.certs.length > 0,  label: "취득 희망 면허/자격증 (1개 이상 선택)" },
        { ok: !!answers.q3,              label: "홈페이지 공지 인지 여부 (YES/NO)" },
        { ok: answers.q4 > 0,            label: "진로 설계 도움 여부 (①~⑤ 선택)" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="② 재학생 설문 2"
        subtitle="진로 및 면허증, 과목별 학습 성취 요구도 측정"
        notice={`안녕하십니까? 본 설문조사의 목적은 재학생의 의견을 수렴하여 AI 시대 직무적합형 인재를 양성하기 위하여 ${UNIV} 미래캠퍼스 ${DEPT}의 2주기(2027~2031) 교육목표 및 교육과정을 설정하기 위함입니다. 바쁘시더라도 설문에 응답해 주실 것을 부탁드립니다. 응답 내용은 통계법 제33조에 의거 통계적 목적 외에는 절대 사용하지 않을 것이며 개인의 응답 내용의 비밀을 보장하겠습니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 응답자 일반사항</Badge>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label className="fw-semibold">1. 성별</Form.Label>
              <div className="d-flex gap-4">
                {["남", "여"].map((v, i) => (
                  <Form.Check key={v} type="radio" label={`${i === 0 ? "①" : "②"} ${v}`}
                    name="s1_gender" value={v} checked={answers.gender === v}
                    onChange={(e) => set("gender", e.target.value)} required />
                ))}
              </div>
            </Col>
          </Row>
          <div className="d-flex gap-2 flex-wrap mt-3">
            {["1학년","2학년","3학년","4학년"].map((v) => (
              <Form.Check key={v} type="radio" label={v} name="s1_grade" value={v}
                checked={answers.grade === v} onChange={(e) => set("grade", e.target.value)} />
            ))}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 진로 및 면허(자격증)</Badge>
          <Form.Label className="fw-semibold">1. 졸업 후 희망하는 진로는 무엇입니까(1부터 5까지 순서로 적어주세요)?</Form.Label>
          <Table bordered size="sm" className="mb-3">
            <thead className="table-primary"><tr><th>항목</th>{CAREER_ITEMS.map(c=><th key={c} className="text-center">{c}</th>)}</tr></thead>
            <tbody><tr><td className="fw-semibold">순위 (1~5)</td>
              {CAREER_ITEMS.map(c=>(
                <td key={c} className="text-center">
                  <Form.Control type="number" min={1} max={5} size="sm" style={{width:55,margin:"0 auto"}}
                    value={answers.career[c]} onChange={(e)=>set("career",{...answers.career,[c]:e.target.value})} />
                </td>
              ))}</tr>
            </tbody>
          </Table>
          <Form.Label className="fw-semibold small text-muted">기타 직종:</Form.Label>
          <Form.Control size="sm" placeholder="기타 직종을 기재하세요" value={answers.careerOther}
            onChange={(e) => set("careerOther", e.target.value)} />

          <Form.Label className="fw-semibold mt-4 d-block">2. 졸업 전·후 취득하고자 하는 면허증 및 자격증은? (대상에 모두 √ 표시를 해주시기 바랍니다.)</Form.Label>
          <Row xs={2} md={3} className="g-2">
            {CERTS.map((c) => (
              <Col key={c}>
                <Form.Check type="checkbox" label={c} checked={answers.certs.includes(c)} onChange={() => toggleCert(c)} />
              </Col>
            ))}
          </Row>
          <Form.Control size="sm" className="mt-2" placeholder="기타 자격증 기재" value={answers.certOther}
            onChange={(e) => set("certOther", e.target.value)} />

          <Form.Label className="fw-semibold mt-4 d-block">
            3. 보건의료정보관리사 교육프로그램과 프로그램 최종성과(Program Output)가 홈페이지와 인터넷 포털에 공지되어 있다는 것을 알고 있다( YES / NO )
          </Form.Label>
          <div className="d-flex gap-4">
            {["YES","NO"].map((v) => (
              <Form.Check key={v} type="radio" label={v} name="s1_q3" value={v}
                checked={answers.q3 === v} onChange={(e) => set("q3", e.target.value)} />
            ))}
          </div>

          <Form.Label className="fw-semibold mt-4 d-block">
            4. 학기 초 이루어진 보건의료정보관리사 인증제도의 교육프로그램과 프로그램 최종성과(Program Output)에 대한 강의는 본인의 진로 설계에 도움이 되었습니까?(√ 표시를 해주시기 바랍니다.)
          </Form.Label>
          <div className="d-flex gap-3 flex-wrap">
            {["①전혀아니다","②아니다","③보통이다","④그렇다","⑤매우그렇다"].map((v,i) => (
              <Form.Check key={i} type="radio" label={v} name="s1_q4" value={i+1}
                checked={answers.q4 === i+1} onChange={() => set("q4", i+1)} />
            ))}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅲ. 학습 성취 및 요구도 측정</Badge>
          <Alert variant="info" className="py-2 px-3 mb-3" style={{fontSize:13, lineHeight:1.7}}>
            다음은 학생들이 한 학기를 마치면서 얻고자 하는 보건의료정보관리 교육프로그램의 '학습성취 및 학습 요구도 측정'입니다.<br/>
            ▪ <strong>학습성취</strong>: 현재까지 수강한 교과목 중 본인이 생각하기에 취약한 교과목에 √ 표시를 해주시기 바랍니다(하나 이상).<br/>
            ▪ <strong>학습 요구도</strong>: 교육의 적절성에 대한 질문입니다. 본인이 생각하는 각 교과목에 대한 적절성에 해당 되는 번호에 √ 표시를 해주시기 바랍니다.
          </Alert>
          <div className="table-responsive">
            <Table bordered hover size="sm" style={{ minWidth: 640, fontSize: 12 }}>
              <thead className="table-primary">
                <tr>
                  <th>학년<br/>학기</th>
                  <th>교과목</th>
                  <th className="text-center">학습<br/>성취</th>
                  {["교육내용범위","교육내용수준","교육방법","평가방식"].map(h=>(
                    <th key={h} className="text-center">{h}<br/>(①~⑤)</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map(([sem, subj], si) => (
                  <tr key={si}>
                    <td className="text-center text-muted">{sem}</td>
                    <td>{subj}</td>
                    <td className="text-center">
                      <Form.Check type="checkbox" checked={answers.weakSubs.includes(subj)} onChange={() => toggleWeak(subj)} />
                    </td>
                    {[0,1,2,3].map(ci => (
                      <td key={ci} className="text-center">
                        <Form.Select size="sm" style={{width:60,display:"inline-block"}}
                          value={answers.subRatings[`${si}_${ci}`] || ""}
                          onChange={(e) => set("subRatings",{...answers.subRatings,[`${si}_${ci}`]:e.target.value})}>
                          <option value="">-</option>
                          {[["①매우낮음",1],["②낮음",2],["③보통",3],["④높음",4],["⑤매우높음",5]].map(([l,v])=><option key={v} value={v}>{l}</option>)}
                        </Form.Select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary">초기화</Button>
      </div>
    </Form>
  );
}

function Results1({ responses }) {
  const parseObj = (v) => typeof v === "string" ? JSON.parse(v || "{}") : (v || {});
  const parseArr = (v) => typeof v === "string" ? JSON.parse(v || "[]") : (v || []);
  const n = responses.length;

  // 진로 희망 분야 (가중 점수: 1순위=5점, 2순위=4점, 3순위=3점, 4순위=2점, 5순위=1점)
  const careers = ["보건의료정보부서","보건교육","병원행정부서","공무원","보험회사"];
  const careerScores = careers.map(c =>
    responses.reduce((sum, r) => {
      const rank = Number(parseObj(r.career)[c]);
      if (rank >= 1 && rank <= 5) return sum + (6 - rank);
      return sum;
    }, 0)
  );

  // 취득 희망 자격증
  const CERTS_LIST = ["보건의료정보관리사","ADSp","SQLD","컴퓨터활용능력1급","사회조사분석사","토익 850점 이상","빅데이터분석기사","기타"];
  const certCounts = CERTS_LIST.map(c => responses.filter(r => parseArr(r.certs).includes(c)).length);

  // q3 홈페이지 인지 (YES/NO)
  const q3yes = responses.filter(r => r.q3 === "YES").length;
  const q3no = responses.filter(r => r.q3 === "NO").length;

  // q4 진로 설계 도움 (1~5)
  const q4labels = ["①전혀아니다","②아니다","③보통이다","④그렇다","⑤매우그렇다"];
  const q4counts = [1,2,3,4,5].map(v => responses.filter(r => Number(r.q4) === v).length);

  // 취약 과목
  const weakCount = {};
  responses.forEach(r => {
    parseArr(r.weakSubs).forEach(s => { weakCount[s] = (weakCount[s]||0)+1; });
  });
  const sortedWeak = Object.entries(weakCount).sort((a,b)=>b[1]-a[1]);

  // 학습 요구도 평균 (subRatings: {si_ci: "5", ...})
  const SUBJ_NAMES = SUBJECTS.map(([,s]) => s);
  const DIM_LABELS = ["교육내용범위","교육내용수준","교육방법","평가방식"];
  // 과목별 4개 항목 평균
  const subjAvgs = SUBJ_NAMES.map((_, si) => {
    const vals = responses.flatMap(r => {
      const sr = parseObj(r.subRatings);
      return [0,1,2,3].map(ci => Number(sr[`${si}_${ci}`])).filter(v => v > 0);
    });
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  });
  // 항목별 전 과목 평균
  const dimAvgs = DIM_LABELS.map((_, ci) => {
    const vals = responses.flatMap(r => {
      const sr = parseObj(r.subRatings);
      return SUBJ_NAMES.map((_, si) => Number(sr[`${si}_${ci}`])).filter(v => v > 0);
    });
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  });

  return (
    <>
      <h6 className="border-start border-primary border-4 ps-2 mb-2">진로 희망 분야 (가중 점수: 1순위=5점 ~ 5순위=1점)</h6>
      <BarChart id="c1-career" labels={careers} data={careerScores} color="rgba(13,110,253,0.7)" />

      <h6 className="border-start border-success border-4 ps-2 mt-4 mb-2">취득 희망 면허/자격증</h6>
      <BarChart id="c1-certs" labels={CERTS_LIST} data={certCounts} color="rgba(25,135,84,0.7)" />

      <h6 className="border-start border-warning border-4 ps-2 mt-4 mb-2">
        홈페이지 공지 인지 여부 (YES/NO) — 응답 {n}명
      </h6>
      <Table bordered size="sm" style={{ maxWidth: 260 }}>
        <thead className="table-warning"><tr><th>YES</th><th>NO</th></tr></thead>
        <tbody><tr>
          <td className="fw-bold text-success">{q3yes}명 ({n ? Math.round(q3yes/n*100) : 0}%)</td>
          <td className="fw-bold text-danger">{q3no}명 ({n ? Math.round(q3no/n*100) : 0}%)</td>
        </tr></tbody>
      </Table>

      <h6 className="border-start border-warning border-4 ps-2 mt-4 mb-2">진로 설계 도움 여부 분포</h6>
      <BarChart id="c1-q4" labels={q4labels} data={q4counts} color="rgba(255,193,7,0.8)" />

      {sortedWeak.length > 0 && (
        <>
          <h6 className="border-start border-danger border-4 ps-2 mt-4 mb-2">취약 과목 현황</h6>
          <Table striped bordered size="sm">
            <thead className="table-danger"><tr><th>교과목</th><th>응답 수</th></tr></thead>
            <tbody>
              {sortedWeak.map(([s,c]) => (
                <tr key={s}><td>{s}</td><td className="fw-bold text-danger">{c}명</td></tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      <h6 className="border-start border-info border-4 ps-2 mt-4 mb-2">학습 요구도 — 항목별 평균</h6>
      <BarChart id="c1-dim" labels={DIM_LABELS} data={dimAvgs} color="rgba(13,202,240,0.7)" />

      <h6 className="border-start border-info border-4 ps-2 mt-4 mb-2">학습 요구도 — 과목별 평균</h6>
      <BarChart id="c1-subj" labels={SUBJ_NAMES} data={subjAvgs} color="rgba(102,16,242,0.5)" />
    </>
  );
}

// ============================================================
//  ③ 산업체 설문
// ============================================================
function Survey2({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender:"", age:"", years:"", orgType:"", orgTypeOther:"", dept:"", rank:"",
    ...initLikert("s2q1", s23_q1.length),
    ...initLikert("s2q2", s2_q2.length),
    ...initLikert("s2q3", s23_q3.length),
  });
  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: checkLikert(answers, "s2q1"),  label: "Ⅰ. 교육과정 및 운영 (전 문항)" },
        { ok: checkLikert(answers, "s2q2"),  label: "Ⅱ. 산업체 만족도 (전 문항)" },
        { ok: checkLikert(answers, "s2q3"),  label: "Ⅲ. 학습성과 (전 문항)" },
        { ok: !!answers.gender,              label: "응답자 정보 — 성별" },
        { ok: !!answers.age.trim(),          label: "응답자 정보 — 연령" },
        { ok: !!answers.years,               label: "응답자 정보 — 근무년수" },
        { ok: !!answers.orgType,             label: "응답자 정보 — 산업체 종류" },
        { ok: !!answers.dept.trim(),         label: "응답자 정보 — 근무 부서" },
        { ok: !!answers.rank,                label: "응답자 정보 — 직급" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="③ 산업체 설문"
        subtitle="교육목표 및 교육과정 설정을 위한 요구도 조사"
        notice={`안녕하십니까? 본 설문조사의 목적은 교육수요자의 의견을 수렴하여 AI 시대 직무적합형 인재를 양성하기 위하여 ${UNIV} 미래캠퍼스 ${DEPT}의 2주기(2027~2031) 교육목표 및 교육과정을 설정하기 위함입니다. 바쁘시더라도 설문에 응답해 주실 것을 부탁드립니다. 응답 내용은 통계법 제33조에 의거 통계적 목적 외에는 절대 사용하지 않을 것이며 개인의 응답 내용의 비밀을 보장하겠습니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 교육과정 및 운영</Badge>
          <p style={{fontSize:13, color:"#555", marginBottom:12}}>다음은 {UNIV} {DEPT}의 교육목표 설정 및 교육운영에 대한 질문입니다. 아래 제시된 응답 예를 보시고 해당 되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s23_q1} prefix="s2q1" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 교육과정 및 운영에 대한 산업체의 만족도</Badge>
          <p style={{fontSize:13, color:"#555", marginBottom:12}}>다음은 {UNIV} {DEPT}의 교육과정에 대한 '산업체의 만족도'에 대한 문항입니다. 아래 제시된 응답 예를 보시고 해당되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s2_q2} prefix="s2q2" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅲ. 학습성과</Badge>
          <p style={{fontSize:13, color:"#555", marginBottom:12}}>다음은 {UNIV} {DEPT}의 교육목표에 따라 학생들이 졸업시 교육을 통하여 얻고자 하는 '학습성과(역량)'입니다. 아래 제시된 응답 예를 보시고 해당되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s23_q3} prefix="s2q3" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">응답자 인적사항</Badge>
          <Table bordered size="sm">
            <tbody>
              <tr><td className="fw-semibold bg-light w-25">성별</td>
                <td><InfoRadio name="gender" options={["남자","여자"]} value={answers.gender} onChange={set} /></td></tr>
              <tr><td className="fw-semibold bg-light">연령</td>
                <td><Form.Control size="sm" style={{maxWidth:120}} placeholder="만 __세" value={answers.age} onChange={e=>set("age",e.target.value)} /></td></tr>
              <tr><td className="fw-semibold bg-light">근무년수</td>
                <td><InfoRadio name="years" options={["5년 미만","5~10년 미만","10년 이상"]} value={answers.years} onChange={set} /></td></tr>
              <tr><td className="fw-semibold bg-light">산업체 종류</td>
                <td>
                  <InfoRadio name="orgType" options={["의료기관","공공기관","디지털헬스·의료기기 기업","기타"]} value={answers.orgType} onChange={set} />
                  {answers.orgType === "기타" && (
                    <Form.Control size="sm" className="mt-2" style={{maxWidth:280}} placeholder="기타 산업체를 직접 입력해 주세요" value={answers.orgTypeOther} onChange={e=>set("orgTypeOther",e.target.value)} />
                  )}
                </td></tr>
              <tr><td className="fw-semibold bg-light">근무 부서</td>
                <td><Form.Control size="sm" value={answers.dept} onChange={e=>set("dept",e.target.value)} /></td></tr>
              <tr><td className="fw-semibold bg-light">직급</td>
                <td><InfoRadio name="rank" options={["사원","계장(대리,파트장 등)","과장급 이상"]} value={answers.rank} onChange={set} /></td></tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center flex-wrap my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary">초기화</Button>
      </div>
    </Form>
  );
}

/** 응답자별 개별 결과 (③산업체 / ④졸업생 공용) */
function IndividualResults({ responses, sections }) {
  const SCORE = ["①","②","③","④","⑤"];

  if (responses.length === 0) return (
    <div className="text-center text-muted py-5">
      <div style={{ fontSize: 40 }}>📭</div>
      <p className="mt-2">아직 응답 데이터가 없습니다.</p>
    </div>
  );

  // 섹션별 평균 차트 색상 매핑
  const colorMap = { "#0d6efd": "rgba(13,110,253,0.7)", "#ffc107": "rgba(255,193,7,0.8)", "#6610f2": "rgba(102,16,242,0.7)" };

  return (
    <>
      <p className="text-muted mb-3" style={{ fontSize: 13 }}>총 {responses.length}명 응답</p>

      {/* 섹션별 집계 막대차트 */}
      {sections.map(({ label, prefix, questions, color }) => {
        const avgs = getAvg(responses, prefix, questions.length);
        return (
          <div key={prefix} className="mb-4">
            <h6 className="border-start border-4 ps-2 mb-3" style={{ borderColor: color }}>
              {label} 평균 점수
            </h6>
            <BarChart
              id={`agg-${prefix}`}
              labels={questions}
              data={avgs}
              color={colorMap[color] || "rgba(13,110,253,0.7)"}
            />
            <ResultsTable labels={questions} avgs={avgs} />
          </div>
        );
      })}

    </>
  );
}

/** ③④ 공통 집계 결과 */
function Results23({ responses, q2items, prefix2, prefix3, title }) {
  const a1 = getAvg(responses, `${title}q1`, s23_q1.length);
  const a2 = getAvg(responses, `${title}q2`, q2items.length);
  const a3 = getAvg(responses, `${title}q3`, s23_q3.length);
  return (
    <>
      <h6 className="border-start border-primary border-4 ps-2 mb-3">교육과정 및 운영 평균 점수</h6>
      <BarChart id={`${title}-c1`} labels={s23_q1} data={a1} color="rgba(13,110,253,0.7)" />
      <h6 className="border-start border-warning border-4 ps-2 mt-4 mb-3">만족도 평균 점수</h6>
      <BarChart id={`${title}-c2`} labels={q2items} data={a2} color="rgba(255,193,7,0.8)" />
      <h6 className="border-start border-purple border-4 ps-2 mt-4 mb-3">학습성과 평균 점수</h6>
      <BarChart id={`${title}-c3`} labels={s23_q3} data={a3} color="rgba(102,16,242,0.7)" />
      <ResultsTable labels={[...s23_q1,...q2items,...s23_q3]} avgs={[...a1,...a2,...a3]} />
    </>
  );
}

// ============================================================
//  ④ 졸업생 설문
// ============================================================
function Survey3({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender:"", age:"", years:"", orgType:"", orgTypeOther:"", dept:"", rank:"",
    ...initLikert("s3q1", s23_q1.length),
    ...initLikert("s3q2", s3_q2.length),
    ...initLikert("s3q3", s23_q3.length),
  });
  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: checkLikert(answers, "s3q1"),  label: "Ⅰ. 교육과정 및 운영 (전 문항)" },
        { ok: checkLikert(answers, "s3q2"),  label: "Ⅱ. 졸업생 만족도 (전 문항)" },
        { ok: checkLikert(answers, "s3q3"),  label: "Ⅲ. 학습성과 (전 문항)" },
        { ok: !!answers.gender,              label: "응답자 정보 — 성별" },
        { ok: !!answers.age.trim(),          label: "응답자 정보 — 연령" },
        { ok: !!answers.years,               label: "응답자 정보 — 근무년수" },
        { ok: !!answers.orgType,             label: "응답자 정보 — 산업체 종류" },
        { ok: !!answers.dept.trim(),         label: "응답자 정보 — 근무 부서" },
        { ok: !!answers.rank,                label: "응답자 정보 — 직급" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="④ 졸업생 설문"
        subtitle="교육목표 및 교육과정 설정을 위한 요구도 조사"
        notice={`안녕하십니까? 본 설문조사의 목적은 교육수요자(졸업생)의 의견을 수렴하여 AI 시대 직무적합형 인재를 양성하기 위하여 ${UNIV} 미래캠퍼스 ${DEPT}의 2주기(2027~2031) 교육목표 및 교육과정을 설정하기 위함입니다. 바쁘시더라도 설문에 응답해 주실 것을 부탁드립니다. 응답 내용은 통계법 제33조에 의거 통계적 목적 외에는 절대 사용하지 않을 것이며 개인의 응답 내용의 비밀을 보장하겠습니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 교육과정 및 운영</Badge>
          <p className="small text-muted mb-3">다음은 {UNIV} {DEPT}의 교육목표 설정 및 교육운영에 대한 질문입니다. 아래 제시된 응답 예를 보시고 해당 되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s23_q1} prefix="s3q1" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 교육과정 및 운영에 대한 졸업생의 만족도</Badge>
          <p className="small text-muted mb-3">다음은 {UNIV} {DEPT}의 교육과정에 대한 '졸업생의 만족도'에 대한 문항입니다. 아래 제시된 응답 예를 보시고 해당되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s3_q2} prefix="s3q2" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅲ. 학습성과</Badge>
          <p className="small text-muted mb-3">다음은 {UNIV} {DEPT}의 교육목표에 따라 학생들이 졸업시 교육을 통하여 얻고자 하는 '학습성과'입니다. 아래 제시된 응답 예를 보시고 해당되는 번호에 √ 표시를 해주시기 바랍니다.</p>
          <LikertTable questions={s23_q3} prefix="s3q3" answers={answers} onChange={set} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">응답자 인적사항</Badge>
          <Table bordered size="sm">
            <tbody>
              <tr><td className="fw-semibold bg-light w-25">성별</td>
                <td><InfoRadio name="gender" options={["남자","여자"]} value={answers.gender} onChange={set} /></td></tr>
              <tr><td className="fw-semibold bg-light">연령</td>
                <td><Form.Control size="sm" style={{maxWidth:120}} placeholder="만 __세" value={answers.age} onChange={e=>set("age",e.target.value)} /></td></tr>
              <tr><td className="fw-semibold bg-light">근무년수</td>
                <td><InfoRadio name="years" options={["5년 미만","5~10년 미만","10년 이상"]} value={answers.years} onChange={set} /></td></tr>
              <tr><td className="fw-semibold bg-light">산업체 종류</td>
                <td>
                  <InfoRadio name="orgType" options={["의료기관","공공기관","디지털헬스·의료기기 기업","기타"]} value={answers.orgType} onChange={set} />
                  {answers.orgType === "기타" && (
                    <Form.Control size="sm" className="mt-2" style={{maxWidth:280}} placeholder="기타 산업체를 직접 입력해 주세요" value={answers.orgTypeOther} onChange={e=>set("orgTypeOther",e.target.value)} />
                  )}
                </td></tr>
              <tr><td className="fw-semibold bg-light">근무 부서</td>
                <td><Form.Control size="sm" value={answers.dept} onChange={e=>set("dept",e.target.value)} /></td></tr>
              <tr><td className="fw-semibold bg-light">직급</td>
                <td><InfoRadio name="rank" options={["사원","계장(대리,파트장 등)","과장급 이상"]} value={answers.rank} onChange={set} /></td></tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center flex-wrap my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary">초기화</Button>
      </div>
    </Form>
  );
}

// ============================================================
//  ⑤ 교육목표 인지도
// ============================================================
const SUBJECTS_18 = [
  ["보건의료정보관리학",3,""], ["보건의료정보관리 실무",3,"실습"],
  ["보건의료조직 관리",3,""], ["건강정보보호",2,""],
  ["질병 및 의료행위분류",2,"실습"], ["의무기록정보 분석 실무",3,"실습"],
  ["의무기록정보 질향상 실무",2,"실습"], ["암등록",2,""],
  ["의료의 질관리",2,""], ["건강보험 이론 및 실무",3,"실습"],
  ["보건의료통계학",3,"실습"], ["보건의료데이터관리",3,"실습"],
  ["보건의료정보기술",3,""], ["의료관계법규",3,""],
  ["의학용어 Ⅰ,Ⅱ",6,""], ["병리학",3,""],
  ["인체해부생리학",3,""], ["병원현장 실습",3,"실습"],
];
// 선-후수 표 행 데이터: [이수구분, 선수교과목, 개설학기, 학점, 후수교과목, 개설학기, 학점]
// 이수구분/선수교과목은 rowspan용으로 첫 행에만 값, 나머지는 ""
const PREREQ_ROWS = [
  ["필수","의학용어","2-1",3,"질병 및 의료행위분류","3-1",2],
  ["","의학용어","2-2",3,"의무기록정보 분석 실무","3-1",3],
  ["","","","","의무기록정보 질향상 실무","4-2",3],
  ["","","","","암등록","3-2",2],
  ["","","","","건강보험 이론 및 실무","4-1",3],
  ["","병리학","2-2",3,"질병 및 의료행위분류","3-1",2],
  ["","","","","의무기록정보 분석 실무","3-1",3],
  ["","","","","의무기록정보 질향상 실무","4-2",3],
  ["","","","","암등록","3-2",2],
  ["","","","","건강보험 이론 및 실무","4-1",3],
  ["","인체해부생리학","1-2",3,"질병 및 의료행위분류","3-1",2],
  ["","","","","의무기록정보 분석 실무","3-1",3],
  ["","","","","의무기록정보 질향상 실무","4-2",3],
  ["","","","","암등록","3-2",2],
  ["","","","","건강보험 이론 및 실무","4-1",3],
  ["","질병 및 의료행위분류","3-1",2,"의무기록정보 질향상 실무","4-2",3],
  ["","보건의료정보관리학","2-1",3,"보건의료정보관리 실무","4-2",3],
];
const CAREERS_S4 = ["보건의료정보팀","병원행정부서","AI 산업체","공단등의 공기업(공무원)","대학원","기타"];
const CERTS_S4 = ["보건의료정보관리사","ADSp","SQLD","컴퓨터활용능력1급","사회조사분석사","토익 850점 이상","빅데이터분석기사","기타"];
const Q7_OPTIONS = ["신입생 OT","전과생 OT","학과 MT","학과 사무실 게시판","기타"];

function Survey4({ onSubmit }) {
  const [answers, setAnswers] = useState({
    enrollYear:"", q3:"", q4:"", q5:"", q6:"",
    q7:[], q7other:"", q8:"", q9:"",
    q10:"", q10other:"", q11:"",
    q12:[], q12other:"",
    q13: Object.fromEntries(CAREERS_S4.map(c=>[c,0])), q13other:"",
    q14:"",
  });
  const [errors, setErrors] = useState({});

  const set = (k,v) => setAnswers(p=>({...p,[k]:v}));
  const toggle = (key,v) => setAnswers(p=>({...p,[key]: p[key].includes(v)?p[key].filter(x=>x!==v):[...p[key],v]}));

  // 필수 문항 ref (미응답 시 스크롤 이동)
  const refEnrollYear = useRef(null);
  const refQ3  = useRef(null);
  const refQ5  = useRef(null);
  const refQ6  = useRef(null);
  const refQ7  = useRef(null);
  const refQ8  = useRef(null);
  const refQ9  = useRef(null);
  const refQ10 = useRef(null);
  const refQ11 = useRef(null);
  const refQ12 = useRef(null);
  const refQ13 = useRef(null);
  const refQ14 = useRef(null);

  const REQUIRED = [
    { key:"enrollYear", ref:refEnrollYear, check: a => a.enrollYear.trim() !== "" },
    { key:"q3",  ref:refQ3,  check: a => a.q3  !== "" },
    { key:"q5",  ref:refQ5,  check: a => a.q5  !== "" },
    { key:"q6",  ref:refQ6,  check: a => a.q6  !== "" },
    { key:"q7",  ref:refQ7,  check: a => a.q7.length > 0 },
    { key:"q8",  ref:refQ8,  check: a => a.q8  !== "" },
    { key:"q9",  ref:refQ9,  check: a => a.q9  !== "" },
    { key:"q10", ref:refQ10, check: a => a.q10 !== "" },
    { key:"q11", ref:refQ11, check: a => a.q11 !== "" },
    { key:"q12", ref:refQ12, check: a => a.q12.length > 0 },
    { key:"q13", ref:refQ13, check: a => CAREERS_S4.every(c => a.q13[c] !== 0) },
    { key:"q14", ref:refQ14, check: a => a.q14.trim() !== "" },
  ];

  const validate = () => {
    const newErrors = {};
    REQUIRED.forEach(({ key, check }) => { if (!check(answers)) newErrors[key] = true; });
    setErrors(newErrors);
    const first = REQUIRED.find(({ key }) => newErrors[key]);
    if (first) {
      first.ref.current?.scrollIntoView({ behavior:"smooth", block:"center" });
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSubmit(answers);
  };

  const handleSubmitClick = () => {
    const missing = REQUIRED.filter(({ check }) => !check(answers)).map(({ key }) => key);
    if (missing.length > 0) {
      alert(`미응답 항목: ${missing.join(", ")}\n\n총 ${missing.length}개 문항을 응답해주세요.`);
      validate();
      return;
    }
    onSubmit(answers);
  };

  const errStyle = key => errors[key]
    ? { border:"2px solid #dc3545", borderRadius:8, background:"#fff5f5", padding:"12px" }
    : {};
  const errMsg = key => errors[key]
    ? <div className="text-danger small mt-1">⚠ 필수 응답 항목입니다.</div>
    : null;

  const YN = ({name,val,onChange}) => (
    <div className="d-flex gap-4 mt-2">
      {["예","아니오"].map(v=>(
        <Form.Check key={v} type="radio" label={v} name={name} value={v}
          checked={val===v} onChange={e=>onChange(e.target.value)} />
      ))}
    </div>
  );

  return (
    <Form onSubmit={e => e.preventDefault()}>
      <SurveyHeader
        title="⑤ 교육목표 인지도 설문"
        subtitle="교육 목표 인지도 설문 조사"
        notice={`${UNIV} ${DEPT} 재학생 여러분께. 본 설문은 학과의 교육목표 및 교육과정에 대한 재학생의 인지도를 파악하여 교육의 질 향상을 위해 실시합니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Row className="mb-3">
            <Col md={6} ref={refEnrollYear}>
              <div style={errStyle("enrollYear")}>
                <Form.Label className="fw-semibold">1. 입학년도</Form.Label>
                <Form.Control size="sm" placeholder="예: 2021" value={answers.enrollYear}
                  onChange={e=>{ set("enrollYear",e.target.value); setErrors(p=>({...p,enrollYear:false})); }} />
                {errMsg("enrollYear")}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ3}>
        <Card.Body>
          <div style={errStyle("q3")}>
            <Form.Label className="fw-semibold">2. 입학 전에 보건의료정보관리사(구, 의무기록사)에 대하여 알고 있었습니까?</Form.Label>
            <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
            <YN name="s4q3" val={answers.q3} onChange={v=>{ set("q3",v); setErrors(p=>({...p,q3:false})); }} />
            {errMsg("q3")}
          </div>
          <div className="mt-3">
            <Form.Label className="fw-semibold">3. * 알고 있었다면 정보를 취득한 계기나 경로를 적어주시오.</Form.Label>
            <Form.Control as="textarea" rows={3} value={answers.q4} onChange={e=>set("q4",e.target.value)} />
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ5}>
        <Card.Body>
          <div style={errStyle("q5")}>
            <Form.Label className="fw-semibold">4. {UNIV}와 AI보건정보관리학과, 교육 목적과 보건의료정보관리교육 프로그램 목적이 있습니다. 보건의료정보관리교육 프로그램의 목적에 대해서 잘 알고 계십니까?</Form.Label>
            <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
            <YN name="s4q5" val={answers.q5} onChange={v=>{ set("q5",v); setErrors(p=>({...p,q5:false})); }} />
            {errMsg("q5")}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Form.Label className="fw-semibold">5. 아래 그림은 보건의료정보관리프로그램을 이수하면 달성하게 되는 최종 성과입니다. 이에 대해 알고 있습니까?</Form.Label>
          <div className="my-3 p-2 border rounded" style={{fontSize:11, background:"#f8f9fa"}}>
            <div className="text-center fw-bold mb-2" style={{fontSize:13}}>보건의료정보관리교육 인증 프로그램의 최종 성과(PO)</div>
            <Table bordered size="sm" style={{fontSize:10}}>
              <thead>
                <tr>
                  <th className="text-center" style={{background:"#d0e8f0", width:"20%"}}>프로그램 교육목표</th>
                  <th className="text-center" style={{background:"#c6e0b4", width:"40%"}}>AI보건정보관리학과 프로그램 최종성과</th>
                  <th className="text-center" style={{background:"#fce4d6", width:"40%"}}>정평원 프로그램 최종성과</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowSpan={3} style={{background:"#e2f0d9", verticalAlign:"middle"}}>
                    <div className="fw-bold mb-1">Ⅰ. 융합 중심 전문인</div>
                    <div style={{fontSize:9}}>가치 기반 보건의료정보 통계관리 및 데이터기술의 융합을 통한 보건의료정보 활용능력 배양</div>
                  </td>
                  <td><strong>PO1.</strong> 보건의료정보를 위한 기반 지식, 전공지식, 정보기술을 이해하고 실무에 적용할 수 있다.</td>
                  <td><strong>PO1.</strong> 보건의료정보관리 기초지식 및 정보기술을 이해하고, 데이터품질관리(DQM)을 위해 보건의료정보의 질을 개선하고 진단 및 의무행위를 분류한다.</td>
                </tr>
                <tr>
                  <td><strong>PO2.</strong> 데이터품질관리(DQM)을 위해 보건의료의 질을 개선하고 진단 및 의료행위를 정확히 분류하고 코딩할 수 있다.</td>
                  <td><strong>PO2.</strong> 데이터품질관리(DQM)을 위해 보건의료정보의 질을 개선하고 진단 및 의무행위를 분류하고 코딩한다.</td>
                </tr>
                <tr>
                  <td><strong>PO3.</strong> 보건의료정보의 다양한 요구에 맞춰 데이터를 변환하고 진단 분석 및 보건의료정보 시스템을 지원한다.</td>
                  <td><strong>PO3.</strong> 보건의료의 데이터 및 정보를 다양한 정보 이용 맞춰 변환 및 분석한다.</td>
                </tr>
                <tr>
                  <td rowSpan={3} style={{background:"#dce6f1", verticalAlign:"middle"}}>
                    <div className="fw-bold mb-1">Ⅱ. 실무 중심 지식인</div>
                    <div style={{fontSize:9}}>4차산업혁명에 따른 보건의료정보 관련 변화를 반영하는 창의적 실무능력 배양</div>
                  </td>
                  <td><strong>PO4.</strong> 보건의료정보에 영향을 미치는 요소를 이해하고 정책에 반영하여 관련 업무를 수행한다.</td>
                  <td><strong>PO4.</strong> 보건의료정보에 영향을 미치는 요소를 이해하고 관련 요소가 변화를 조직의 보건의료정보관리에 반영하고 변화 관리한다.</td>
                </tr>
                <tr>
                  <td><strong>PO5.</strong> 양질의 정보 성취를 위한 보건의료 표준과 정보기술을 정보시스템에 적용하고 관리한다.</td>
                  <td><strong>PO5.</strong> 양질의 정보 성취를 위한 보건의료 표준과 관련 정보기술을 정보시스템에 적용하는 방법을 이해한다.</td>
                </tr>
                <tr>
                  <td><strong>PO6.</strong> 보건의료정보의 질 향상을 위해 개선계획을 세우고, 관련 분야 전문가와 효과적으로 내·외 소통한다.</td>
                  <td><strong>PO6.</strong> 보건의료정보의 품질 향상을 위해 다양한 환경에서 효과적으로 내·외 소통을 하는 방법을 이해한다.</td>
                </tr>
                <tr>
                  <td rowSpan={4} style={{background:"#fce4d6", verticalAlign:"middle"}}>
                    <div className="fw-bold mb-1">Ⅲ. 가치 중심 소통인</div>
                    <div style={{fontSize:9}}>보건의료정보의 가치와 의식 마케팅 효과적인 의사소통을 통한 보건의료관리능력 배양</div>
                  </td>
                  <td><strong>PO7.</strong> 보건의료조직과 팀에서 보건의료정보관리자로서 역할을 수행한다.</td>
                  <td><strong>PO7.</strong> 조직 및 팀 내에서 보건의료정보관리자의 역할을 이해한다.</td>
                </tr>
                <tr>
                  <td><strong>PO8.</strong> 보건의료정보관리사의 임무와 윤리, 사회적 책임을 이해하고 실무에 적용할 수 있다.</td>
                  <td><strong>PO8.</strong> 보건의료정보관리사의 임무와 윤리, 사회적 책임을 이해한다.</td>
                </tr>
                <tr>
                  <td><strong>PO9.</strong> 보건의료정보관리에 영향을 미치는 국내·외 보건의료정책 변화를 이해하고 대처할 수 있다.</td>
                  <td><strong>PO9.</strong> 보건의료관리에 영향을 미치는 국·내 외 보건의료적 변화를 이해한다.</td>
                </tr>
                <tr>
                  <td><strong>PO10.</strong> 보건의료 및 정보기술 환경 변화에 따라 자기계발 및 경쟁력 함양을 위해 능동적으로 계획을 세울 수 있다.</td>
                  <td><strong>PO10.</strong> 보건의료 및 정보기술 환경 변화에 따른 진로 개발 및 자기계발에 참여한다.</td>
                </tr>
              </tbody>
            </Table>
          </div>
          <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
          <div ref={refQ6} style={errStyle("q6")}>
            <YN name="s4q6" val={answers.q6} onChange={v=>{ set("q6",v); setErrors(p=>({...p,q6:false})); }} />
            {errMsg("q6")}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ7}>
        <Card.Body>
          <div style={errStyle("q7")}>
            <Form.Label className="fw-semibold">6. 어떤 방법(학과 행사, 게시판 등)으로 교육 목표 및 인증교육과정을 알게 되었습니까?</Form.Label>
            <p className="text-muted small mb-1">해당 사항에 모두 표시하세요</p>
            <Row xs={2} md={3} className="g-2 mt-1">
              {Q7_OPTIONS.map(v=>(
                <Col key={v}>
                  <Form.Check type="checkbox" label={v} checked={answers.q7.includes(v)}
                    onChange={()=>{ toggle("q7",v); setErrors(p=>({...p,q7:false})); }} />
                </Col>
              ))}
            </Row>
            {errMsg("q7")}
          </div>
          {answers.q7.includes("기타") && (
            <Form.Control size="sm" className="mt-2" placeholder="기타 방법 기재" value={answers.q7other} onChange={e=>set("q7other",e.target.value)} />
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ8}>
        <Card.Body>
          <div style={errStyle("q8")}>
            <Form.Label className="fw-semibold">7. 현재 보건의료정보관리사 교육프로그램과 프로그램 최종성과(Program Output)가 홈페이지와 인터넷 포털에 공지되어 있다는 것을 알고 있습니까?</Form.Label>
            <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
            <YN name="s4q8" val={answers.q8} onChange={v=>{ set("q8",v); setErrors(p=>({...p,q8:false})); }} />
            {errMsg("q8")}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ9}>
        <Card.Body>
          <div style={errStyle("q9")}>
            <Form.Label className="fw-semibold">8. 학기 초 이루어진 보건의료정보관리사 인증제도의 교육프로그램의 프로그램 이수 교과과정과 최종성과(Program Output)에 대한 강의는 본인의 진로 설계에 도움이 되었습니까?</Form.Label>
            <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
            <div className="d-flex gap-3 flex-wrap mt-2">
              {["전혀 아니다","아니다","보통이다","그렇다","매우 그렇다"].map(v=>(
                <Form.Check key={v} type="radio" label={v} name="s4q9" value={v}
                  checked={answers.q9===v} onChange={e=>{ set("q9",e.target.value); setErrors(p=>({...p,q9:false})); }} />
              ))}
            </div>
            {errMsg("q9")}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Form.Label className="fw-semibold">9. 보건의료정보관리프로그램을 국가 고시를 응시하기 위해서는 프로그램에서 제공되는 아래 18개의 필수 과목을 반드시 이수해야 함을 알고 있습니까?</Form.Label>
          <div className="table-responsive my-3">
            <Table bordered size="sm" style={{fontSize:12}}>
              <thead className="table-primary"><tr><th>#</th><th>교과목</th><th>인정학점</th><th>비고</th></tr></thead>
              <tbody>
                {SUBJECTS_18.map(([name,credit,note],i)=>(
                  <tr key={i}><td>{i+1}</td><td>{name}</td><td>{credit}</td><td>{note}</td></tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
          <div ref={refQ10} style={errStyle("q10")}>
            <div className="d-flex gap-4 mt-1">
              {["예","아니오","기타"].map(v=>(
                <Form.Check key={v} type="radio" label={v} name="s4q10" value={v}
                  checked={answers.q10===v} onChange={e=>{ set("q10",e.target.value); setErrors(p=>({...p,q10:false})); }} />
              ))}
            </div>
            {errMsg("q10")}
          </div>
          {answers.q10==="기타" && (
            <Form.Control size="sm" className="mt-2" placeholder="기타 내용 기재" value={answers.q10other} onChange={e=>set("q10other",e.target.value)} />
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Form.Label className="fw-semibold">10. 보건의료정보관리프로그램에는 선, 후수 지정 교과목이 있습니다. 이는 선수과목 수강 후 후수과목을 수강해야 하는 것을 의미합니다. 이에 대하여 알고 있습니까?</Form.Label>
          <div className="table-responsive my-3">
            <Table bordered size="sm" style={{fontSize:11}}>
              <thead className="table-primary">
                <tr><th>이수구분</th><th>선수 교과목</th><th>개설학기</th><th>학점</th><th>후수 교과목</th><th>개설학기</th><th>학점</th></tr>
              </thead>
              <tbody>
                {PREREQ_ROWS.map((r,i)=>(
                  <tr key={i}>
                    <td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                    <td>{r[4]}</td><td>{r[5]}</td><td>{r[6]}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-muted small mb-1">한 개의 타원형만 표시합니다.</p>
          <div ref={refQ11} style={errStyle("q11")}>
            <YN name="s4q11" val={answers.q11} onChange={v=>{ set("q11",v); setErrors(p=>({...p,q11:false})); }} />
            {errMsg("q11")}
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ12}>
        <Card.Body>
          <div style={errStyle("q12")}>
            <Form.Label className="fw-semibold">11. 졸업 전·후 취득하고자 하는 국가면허 및 자격증은? (대상에 모두 체크해주시기 바랍니다.)</Form.Label>
            <p className="text-muted small mb-1">* 기타 : 본인이 취득하고자 하는 것을 기재하세요(예, 전산회계 등)</p>
            <Row xs={2} md={3} className="g-2 mt-1">
              {CERTS_S4.map(v=>(
                <Col key={v}>
                  <Form.Check type="checkbox" label={v} checked={answers.q12.includes(v)}
                    onChange={()=>{ toggle("q12",v); setErrors(p=>({...p,q12:false})); }} />
                </Col>
              ))}
            </Row>
            {errMsg("q12")}
          </div>
          {answers.q12.includes("기타") && (
            <Form.Control size="sm" className="mt-2" placeholder="기타 자격증 기재" value={answers.q12other} onChange={e=>set("q12other",e.target.value)} />
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ13}>
        <Card.Body>
          <div style={errStyle("q13")}>
            <Form.Label className="fw-semibold">12. 졸업 후 희망하는 진로는 무엇입니까? (1부터 6까지 순서로 적어주세요)</Form.Label>
            <p className="text-muted small mb-1">행당 한 개의 타원형만 표시합니다</p>
            <div className="table-responsive mt-2">
              <Table bordered size="sm" style={{fontSize:12}}>
                <thead className="table-primary">
                  <tr><th>진로</th>{[1,2,3,4,5,6].map(n=><th key={n} className="text-center">{n}</th>)}</tr>
                </thead>
                <tbody>
                  {CAREERS_S4.map(c=>(
                    <tr key={c}>
                      <td style={{minWidth:140}}>{c}</td>
                      {[1,2,3,4,5,6].map(n=>(
                        <td key={n} className="text-center">
                          <Form.Check type="radio" name={`s4q13_${c}`} value={n}
                            checked={answers.q13[c]===n}
                            onChange={()=>{ set("q13",{...answers.q13,[c]:n}); setErrors(p=>({...p,q13:false})); }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {errMsg("q13")}
          </div>
          <Form.Control size="sm" className="mt-2" placeholder="기타 진로 기재" value={answers.q13other} onChange={e=>set("q13other",e.target.value)} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0" ref={refQ14}>
        <Card.Body>
          <div style={errStyle("q14")}>
            <Form.Label className="fw-semibold">13. 취업 또는 학습 과목 관련하여 질문, 제안이 있으면 자유롭게 기술해주세요</Form.Label>
            <Form.Control as="textarea" rows={4} value={answers.q14}
              onChange={e=>{ set("q14",e.target.value); setErrors(p=>({...p,q14:false})); }} />
            {errMsg("q14")}
          </div>
        </Card.Body>
      </Card>

      {Object.values(errors).some(Boolean) && (
        <Alert variant="danger" className="text-center">
          ⚠ 응답하지 않은 필수 항목이 있습니다. 빨간 테두리 항목을 확인해주세요.
        </Alert>
      )}

      <div className="d-flex gap-2 justify-content-center my-4">
        <Button type="button" variant="primary" size="lg" className="px-5" onClick={handleSubmitClick}>설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary" onClick={()=>setErrors({})}>초기화</Button>
      </div>
    </Form>
  );
}

function Results4({ responses }) {
  const parseArr = (v) => typeof v === "string" ? JSON.parse(v || "[]") : (v || []);
  const parseObj = (v) => typeof v === "string" ? JSON.parse(v || "{}") : (v || {});
  const yesNo = (key) => {
    const yes = responses.filter(r=>r[key]==="예").length;
    const no = responses.filter(r=>r[key]==="아니오").length;
    return { yes, no };
  };
  const yn3 = (key) => {
    const yes = responses.filter(r=>r[key]==="예").length;
    const no = responses.filter(r=>r[key]==="아니오").length;
    const etc = responses.filter(r=>r[key]==="기타").length;
    return { yes, no, etc };
  };

  const q3 = yesNo("q3"); const q5 = yesNo("q5"); const q6 = yesNo("q6");
  const q8 = yesNo("q8"); const q11 = yesNo("q11"); const q10 = yn3("q10");
  const q9counts = ["전혀 아니다","아니다","보통이다","그렇다","매우 그렇다"].map(v=>responses.filter(r=>r.q9===v).length);
  const certCounts = CERTS_S4.map(c=>responses.filter(r=>parseArr(r.q12).includes(c)).length);
  const q7counts = Q7_OPTIONS.map(v=>responses.filter(r=>parseArr(r.q7).includes(v)).length);

  // 입학년도 분포
  const yearCounts = {};
  responses.forEach(r => { if (r.enrollYear) yearCounts[r.enrollYear] = (yearCounts[r.enrollYear]||0)+1; });
  const years = Object.keys(yearCounts).sort();

  // Q12. 진로 희망 순위 집계
  const careerRanks = {};
  CAREERS_S4.forEach(c => { careerRanks[c] = {1:0,2:0,3:0,4:0,5:0,6:0}; });
  responses.forEach(r => {
    const obj = parseObj(r.q13);
    CAREERS_S4.forEach(c => { const n = Number(obj[c]); if (n>=1 && n<=6) careerRanks[c][n]++; });
  });
  // 가중 점수 (1순위=6점, 2순위=5점, ..., 6순위=1점)
  const careerWeightedScores = CAREERS_S4.map(c =>
    [1,2,3,4,5,6].reduce((sum, rank) => sum + careerRanks[c][rank] * (7 - rank), 0)
  );

  // 주관식 텍스트 수집
  const q4texts = responses.filter(r=>r.q3==="예" && r.q4 && r.q4.trim()).map(r=>r.q4.trim());
  const q7others = responses.filter(r=>parseArr(r.q7).includes("기타") && r.q7other && r.q7other.trim()).map(r=>r.q7other.trim());
  const q10others = responses.filter(r=>r.q10==="기타" && r.q10other && r.q10other.trim()).map(r=>r.q10other.trim());
  const q12others = responses.filter(r=>parseArr(r.q12).includes("기타") && r.q12other && r.q12other.trim()).map(r=>r.q12other.trim());
  const q13others = responses.filter(r=>r.q13other && r.q13other.trim()).map(r=>r.q13other.trim());
  const q14texts = responses.filter(r=>r.q14 && r.q14.trim()).map(r=>r.q14.trim());

  return (
    <>
      {/* 입학년도 */}
      {years.length > 0 && <>
        <h6 className="border-start border-info border-4 ps-2 mb-3">입학년도 분포</h6>
        <Table bordered size="sm" className="mb-4">
          <thead className="table-info"><tr><th>입학년도</th>{years.map(y=><th key={y}>{y}</th>)}</tr></thead>
          <tbody><tr><td>응답 수</td>{years.map(y=><td key={y}>{yearCounts[y]}명</td>)}</tr></tbody>
        </Table>
      </>}

      {/* 인지도 예/아니오 */}
      <h6 className="border-start border-primary border-4 ps-2 mb-3">인지도 현황 (예/아니오)</h6>
      <Table bordered size="sm" className="mb-4">
        <thead className="table-primary"><tr><th>문항</th><th>예</th><th>아니오</th></tr></thead>
        <tbody>
          {[
            ["Q2. 입학 전 보건의료정보관리사 인지", q3],
            ["Q4. 교육프로그램 목적 인지", q5],
            ["Q5. 최종 성과(PO) 인지", q6],
            ["Q7. 홈페이지 공지 인지", q8],
            ["Q10. 선후수 교과목 인지", q11],
          ].map(([label,d])=>(
            <tr key={label}><td>{label}</td><td>{d.yes}명</td><td>{d.no}명</td></tr>
          ))}
        </tbody>
      </Table>

      {/* Q3. 정보 취득 계기/경로 (자유응답) */}
      {q4texts.length > 0 && <>
        <h6 className="border-start border-secondary border-4 ps-2 mb-3">Q3. 정보 취득 계기/경로 (자유응답)</h6>
        <ul className="list-group mb-4">
          {q4texts.map((t,i)=><li key={i} className="list-group-item py-1 small">{i+1}. {t}</li>)}
        </ul>
      </>}

      {/* Q6. 교육목표 인지 방법 */}
      <h6 className="border-start border-warning border-4 ps-2 mb-3">Q6. 교육목표 인지 방법</h6>
      <Table bordered size="sm" className="mb-2">
        <thead className="table-warning"><tr><th>방법</th><th>선택 수</th></tr></thead>
        <tbody>
          {Q7_OPTIONS.map((v,i)=>(
            <tr key={v}><td>{v}</td><td>{q7counts[i]}명</td></tr>
          ))}
        </tbody>
      </Table>
      {q7others.length > 0 && <p className="small text-muted mb-4">기타 내용: {q7others.join(" / ")}</p>}

      {/* Q8. 강의의 진로 설계 도움도 */}
      <h6 className="border-start border-success border-4 ps-2 mt-2 mb-3">Q8. 강의의 진로 설계 도움도</h6>
      <Table bordered size="sm" className="mb-4">
        <thead className="table-success"><tr>{["전혀 아니다","아니다","보통이다","그렇다","매우 그렇다"].map(v=><th key={v}>{v}</th>)}</tr></thead>
        <tbody><tr>{q9counts.map((n,i)=><td key={i}>{n}명</td>)}</tr></tbody>
      </Table>

      {/* Q9. 18필수과목 이수 인지 */}
      <h6 className="border-start border-danger border-4 ps-2 mb-3">Q9. 18필수과목 이수 인지</h6>
      <Table bordered size="sm" className="mb-2">
        <thead className="table-danger"><tr><th>예</th><th>아니오</th><th>기타</th></tr></thead>
        <tbody><tr><td>{q10.yes}명</td><td>{q10.no}명</td><td>{q10.etc}명</td></tr></tbody>
      </Table>
      {q10others.length > 0 && <p className="small text-muted mb-4">기타 내용: {q10others.join(" / ")}</p>}

      {/* Q11. 취득 희망 자격증 */}
      <h6 className="border-start border-info border-4 ps-2 mt-2 mb-3">Q11. 취득 희망 자격증</h6>
      <Table bordered size="sm" className="mb-2">
        <thead className="table-info"><tr><th>자격증</th><th>선택 수</th></tr></thead>
        <tbody>
          {CERTS_S4.map((c,i)=><tr key={c}><td>{c}</td><td>{certCounts[i]}명</td></tr>)}
        </tbody>
      </Table>
      {q12others.length > 0 && <p className="small text-muted mb-4">기타 내용: {q12others.join(" / ")}</p>}

      {/* Q12. 졸업 후 희망 진로 순위 */}
      <h6 className="border-start border-primary border-4 ps-2 mt-2 mb-3">Q12. 졸업 후 희망 진로 순위</h6>
      <Table bordered size="sm" className="mb-2" responsive>
        <thead className="table-primary">
          <tr><th>진로</th><th>1순위</th><th>2순위</th><th>3순위</th><th>4순위</th><th>5순위</th><th>6순위</th><th className="table-warning">가중점수</th></tr>
        </thead>
        <tbody>
          {CAREERS_S4.map((c, i)=>(
            <tr key={c}>
              <td>{c}</td>
              {[1,2,3,4,5,6].map(n=><td key={n}>{careerRanks[c][n] > 0 ? `${careerRanks[c][n]}명` : "-"}</td>)}
              <td className="fw-bold table-warning">{careerWeightedScores[i]}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="text-muted small mb-3">※ 가중점수: 1순위=6점, 2순위=5점, 3순위=4점, 4순위=3점, 5순위=2점, 6순위=1점 합산</p>
      {q13others.length > 0 && <p className="small text-muted mb-2">기타 진로 내용: {q13others.join(" / ")}</p>}
      <BarChart id="c3-career-weighted" labels={CAREERS_S4} data={careerWeightedScores} color="rgba(13,110,253,0.7)" />

      {/* Q13. 자유 기술 의견 */}
      {q14texts.length > 0 && <>
        <h6 className="border-start border-secondary border-4 ps-2 mb-3">Q13. 자유 기술 의견</h6>
        <ul className="list-group">
          {q14texts.map((t,i)=><li key={i} className="list-group-item py-1 small">{i+1}. {t}</li>)}
        </ul>
      </>}
    </>
  );
}

// ============================================================
//  ⑥ 국시 요구도
// ============================================================
function Survey5({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender:"", grade:"", weakSubs:[], weakOther:"", comment:"",
  });
  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));
  const toggleWeak = (v) =>
    setAnswers(p => ({ ...p, weakSubs: p.weakSubs.includes(v) ? p.weakSubs.filter(s=>s!==v) : [...p.weakSubs, v] }));

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: !!answers.gender,               label: "성별" },
        { ok: !!answers.grade,                label: "학년" },
        { ok: answers.weakSubs.length > 0,    label: "취약 과목 (1개 이상 선택)" },
        { ok: !!answers.comment.trim(),       label: "국가시험 대비 프로그램 건의사항" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="⑥ 국가시험 지원 프로그램 요구도 조사"
        subtitle="보건의료정보관리사 국가시험 응시 대상자 대상"
        notice={`${UNIV} ${DEPT} — 보건의료정보관리사 국가시험 응시대상자의 지원 프로그램 요구사항을 파악하여 국가고시 지원체계를 효과적으로 운영하기 위함입니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 응답자 일반사항</Badge>
          <Row className="mb-3">
            <Col md={6}><Form.Label className="fw-semibold">성별</Form.Label>
              <div className="d-flex gap-4">
                {["남","여"].map((v,i)=>(
                  <Form.Check key={v} type="radio" label={`${i===0?"①":"②"} ${v}`}
                    name="s5_gender" value={v} checked={answers.gender===v}
                    onChange={e=>set("gender",e.target.value)} required />
                ))}
              </div>
            </Col>
            <Col md={6}><Form.Label className="fw-semibold">학년</Form.Label>
              <div className="d-flex gap-3">
                {["1학년","2학년","3학년","4학년"].map(v=>(
                  <Form.Check key={v} type="radio" label={v} name="s5_grade" value={v}
                    checked={answers.grade===v} onChange={e=>set("grade",e.target.value)} />
                ))}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 국시 특강 요구도</Badge>
          <Form.Label className="fw-semibold">국시 과목 중 가장 취약한 과목 3개를 선택해 주세요.</Form.Label>
          <Row xs={2} md={3} className="g-2 mt-1">
            {EXAM_SUBJECTS.map(s=>(
              <Col key={s}>
                <Form.Check type="checkbox" label={s} checked={answers.weakSubs.includes(s)} onChange={()=>toggleWeak(s)} />
              </Col>
            ))}
          </Row>
          <Form.Control size="sm" className="mt-3" placeholder="기타 과목명 기재"
            value={answers.weakOther} onChange={e=>set("weakOther",e.target.value)} />

          <Form.Label className="fw-semibold mt-4 d-block">국가 시험 대비 프로그램 건의사항</Form.Label>
          <Form.Control as="textarea" rows={4} value={answers.comment} onChange={e=>set("comment",e.target.value)} />
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary">초기화</Button>
      </div>
    </Form>
  );
}

function Results5({ responses }) {
  const parseArr = (v) => typeof v === "string" ? JSON.parse(v || "[]") : (v || []);
  const counts = EXAM_SUBJECTS.map(s => responses.filter(r => parseArr(r.weakSubs).includes(s)).length);
  const comments = responses.filter(r => r.comment && r.comment.trim()).map(r => r.comment.trim());
  const weakOthers = responses.filter(r => r.weakOther && r.weakOther.trim()).map(r => r.weakOther.trim());
  return (
    <>
      <h6 className="border-start border-danger border-4 ps-2 mb-3">취약 과목 선택 분포</h6>
      <BarChart id="c5-1" labels={EXAM_SUBJECTS} data={counts} color="rgba(220,53,69,0.7)" />
      <Table striped bordered size="sm" className="mt-3 mb-4">
        <thead className="table-danger"><tr><th>교과목</th><th>선택 수</th></tr></thead>
        <tbody>
          {EXAM_SUBJECTS.map((s,i)=>counts[i]>0&&(
            <tr key={s}><td>{s}</td><td className="fw-bold text-danger">{counts[i]}명</td></tr>
          ))}
          {weakOthers.length > 0 && <tr><td colSpan={2}><small className="text-muted">기타: {weakOthers.join(" / ")}</small></td></tr>}
        </tbody>
      </Table>
      {comments.length > 0 && <>
        <h6 className="border-start border-secondary border-4 ps-2 mb-3">건의사항</h6>
        <ul className="list-group">
          {comments.map((t,i)=><li key={i} className="list-group-item py-1 small">{i+1}. {t}</li>)}
        </ul>
      </>}
    </>
  );
}

// ============================================================
//  ⑦ 국시 만족도
// ============================================================
function Survey6({ onSubmit }) {
  const [answers, setAnswers] = useState({
    gender:"", grade:"", comment:"",
    ...initLikert("s6q1", s6_q1.length),
  });
  const set = (k, v) => setAnswers((p) => ({ ...p, [k]: v }));

  return (
    <Form onSubmit={(e) => guardSubmit(e, [
        { ok: !!answers.gender,              label: "성별" },
        { ok: !!answers.grade,               label: "학년" },
        { ok: checkLikert(answers, "s6q1"),  label: "Ⅱ. 국시 특강 및 모의고사 만족도 (전 문항)" },
        { ok: !!answers.comment.trim(),      label: "국가시험 대비 프로그램 건의사항" },
      ], () => onSubmit(answers))}>
      <SurveyHeader
        title="⑦ 국가시험 지원 프로그램 만족도 조사"
        subtitle="보건의료정보관리사 국가시험 응시 대상자 대상"
        notice={`${UNIV} ${DEPT} — 보건의료정보관리사 국가시험 응시대상자의 지원 프로그램 만족도와 요구사항을 파악하여 국가고시 지원체계를 효과적으로 운영하기 위함입니다.`}
      />

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅰ. 응답자 일반사항</Badge>
          <Row className="mb-3">
            <Col md={6}><Form.Label className="fw-semibold">성별</Form.Label>
              <div className="d-flex gap-4">
                {["남","여"].map((v,i)=>(
                  <Form.Check key={v} type="radio" label={`${i===0?"①":"②"} ${v}`}
                    name="s6_gender" value={v} checked={answers.gender===v}
                    onChange={e=>set("gender",e.target.value)} required />
                ))}
              </div>
            </Col>
            <Col md={6}><Form.Label className="fw-semibold">학년</Form.Label>
              <div className="d-flex gap-3">
                {["1학년","2학년","3학년","4학년"].map(v=>(
                  <Form.Check key={v} type="radio" label={v} name="s6_grade" value={v}
                    checked={answers.grade===v} onChange={e=>set("grade",e.target.value)} />
                ))}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Badge bg="secondary" className="mb-3">Ⅱ. 국시 특강 및 모의고사 만족도</Badge>
          <LikertTable questions={s6_q1} prefix="s6q1" answers={answers} onChange={set} labels={LIKERT_LABELS_SATIS} />
        </Card.Body>
      </Card>

      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Form.Label className="fw-semibold">국가 시험 대비 프로그램 건의사항</Form.Label>
          <Form.Control as="textarea" rows={4} value={answers.comment} onChange={e=>set("comment",e.target.value)} />
        </Card.Body>
      </Card>

      <div className="d-flex gap-2 justify-content-center flex-wrap my-4">
        <Button type="submit" variant="primary" size="lg" className="px-5">설문 제출하기</Button>
        <Button type="reset" variant="outline-secondary">초기화</Button>
      </div>
    </Form>
  );
}

function Results6({ responses }) {
  const a1 = getAvg(responses, "s6q1", s6_q1.length);
  const comments = responses.filter(r => r.comment && r.comment.trim()).map(r => r.comment.trim());
  return (
    <>
      <h6 className="border-start border-primary border-4 ps-2 mb-3">국시 지원 프로그램 만족도 평균 점수</h6>
      <BarChart id="c6-1" labels={s6_q1} data={a1} color="rgba(13,110,253,0.7)" />
      <ResultsTable labels={s6_q1} avgs={a1} />
      {comments.length > 0 && <>
        <h6 className="border-start border-secondary border-4 ps-2 mt-4 mb-3">건의사항</h6>
        <ul className="list-group">
          {comments.map((t,i)=><li key={i} className="list-group-item py-1 small">{i+1}. {t}</li>)}
        </ul>
      </>}
    </>
  );
}

// ============================================================
//  결과 컴포넌트 렌더러
// ============================================================
function SurveyResults({ idx, responses }) {
  if (idx === 0) return <Results0 responses={responses} />;
  if (idx === 1) return <Results1 responses={responses} />;
  if (idx === 2) return <IndividualResults responses={responses} sections={[
    { label: "Ⅰ. 교육과정 및 운영", prefix: "s2q1", questions: s23_q1, color: "#0d6efd" },
    { label: "Ⅱ. 산업체 만족도",    prefix: "s2q2", questions: s2_q2,  color: "#ffc107" },
    { label: "Ⅲ. 학습성과",         prefix: "s2q3", questions: s23_q3, color: "#6610f2" },
  ]} />;
  if (idx === 3) return <IndividualResults responses={responses} sections={[
    { label: "Ⅰ. 교육과정 및 운영", prefix: "s3q1", questions: s23_q1, color: "#0d6efd" },
    { label: "Ⅱ. 졸업생 만족도",    prefix: "s3q2", questions: s3_q2,  color: "#ffc107" },
    { label: "Ⅲ. 학습성과",         prefix: "s3q3", questions: s23_q3, color: "#6610f2" },
  ]} />;
  if (idx === 4) return <Results4 responses={responses} />;
  if (idx === 5) return <Results5 responses={responses} />;
  if (idx === 6) return <Results6 responses={responses} />;
  return null;
}

// ============================================================
//  메인 페이지 컴포넌트
//  surveyType: "student" | "industry" | "graduate" | "awareness" | "exam-need" | "exam-satisfaction" | undefined(전체)
// ============================================================
// 배열로 변경 — student는 s0, s1 둘 다 포함
const SURVEY_TYPE_TABS = {
  "student":           ["s0", "s1"],
  "industry":          ["s2"],
  "graduate":          ["s3"],
  "awareness":         ["s4"],
  "exam-need":         ["s5"],
  "exam-satisfaction": ["s6"],
};

const SurveyPage = ({ surveyType } = {}) => {
  const allowedTabs = surveyType ? (SURVEY_TYPE_TABS[surveyType] || ["s0"]) : null;
  const defaultTab = allowedTabs ? allowedTabs[0] : "s0";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [activeMode, setActiveMode] = useState({});
  const [submitted, setSubmitted] = useState(() => {
    try { return JSON.parse(localStorage.getItem("survey_submitted") || "{}"); } catch { return {}; }
  });
  const [localResponses, setLocalResponses] = useState({});
  const [apiData, setApiData] = useState({});
  const [apiLoading, setApiLoading] = useState({});
  const [apiError, setApiError] = useState({});

  // ── 관리자 인증 ────────────────────────────────────────────────────────────
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const checkPassword = () => {
    if (pwInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setPwError(false);
      setPwInput("");
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  const resetResults = async (tabKey) => {
    if (!window.confirm(`[${tabKey}] 설문의 서버 데이터를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch(GS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "clear", survey_key: tabKey }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "알 수 없는 오류");
      setLocalResponses(p => ({ ...p, [tabKey]: [] }));
      setApiData(p => ({ ...p, [tabKey]: [] }));
      alert("✅ 서버 데이터가 초기화되었습니다.");
    } catch (e) {
      alert(`❌ 초기화 실패: ${e.message}`);
    }
  };

  const SURVEY_FORMS = [Survey0, Survey1, Survey2, Survey3, Survey4, Survey5, Survey6];

  const fetchResults = useCallback(async (tabKey) => {
    setApiLoading(p => ({ ...p, [tabKey]: true }));
    setApiError(p => ({ ...p, [tabKey]: null }));
    try {
      const res = await fetch(`${GS_URL}?key=${tabKey}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      setApiData(p => ({ ...p, [tabKey]: data.responses ?? data }));
    } catch (e) {
      setApiError(p => ({ ...p, [tabKey]: e.message }));
    } finally {
      setApiLoading(p => ({ ...p, [tabKey]: false }));
    }
  }, []);

  const handleSubmit = async (tabKey, answers) => {
    // 로컬 저장
    setLocalResponses(prev => ({
      ...prev,
      [tabKey]: [...(prev[tabKey] || []), answers],
    }));
    setSubmitted(prev => {
      const next = { ...prev, [tabKey]: true };
      try { localStorage.setItem("survey_submitted", JSON.stringify(next)); } catch {}
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 백엔드 저장 (실패해도 로컬은 유지)
    try {
      await fetch(GS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ survey_key: tabKey, ...answers }),
      });
    } catch (_) { /* 서버 미연결 시 무시 */ }
  };

  const switchMode = (tabKey, mode) => {
    setActiveMode(p => ({ ...p, [tabKey]: mode }));
    if (mode === "results") fetchResults(tabKey);
  };

  return (
    <div style={{ background: "#f0f4f9", minHeight: "100vh" }}>
      <div style={{
        background: "linear-gradient(135deg, #00205b 0%, #003087 60%, #1a73e8 100%)",
        color: "white", padding: "20px 24px", textAlign: "center",
      }}>
        <h4 className="fw-bold mb-1">{UNIV} {DEPT} 설문조사 시스템</h4>
        <p className="mb-0 opacity-75" style={{ fontSize: 13 }}>
          2주기(2027~2031) 프로그램 인증 및 교육과정 개선을 위한 설문 | 응답 내용은 통계적 목적으로만 활용됩니다
        </p>
      </div>

      {/* surveyType이 없거나 허용 탭이 2개 이상인 경우에만 내비게이션 표시 */}
      {(!surveyType || (allowedTabs && allowedTabs.length > 1)) && (
        <div style={{ background: "white", borderBottom: "1px solid #dee2e6", overflowX: "auto" }}>
          <Nav variant="tabs" className="border-0 flex-nowrap px-2" style={{ minWidth: "max-content" }}
            activeKey={activeTab} onSelect={setActiveTab}>
            {SURVEY_TABS.filter(t => !allowedTabs || allowedTabs.includes(t.key)).map((t) => (
              <Nav.Item key={t.key}>
                <Nav.Link eventKey={t.key} className="text-nowrap px-3" style={{ fontSize: 13 }}>
                  {t.title}{" "}
                  <Badge bg={activeTab === t.key ? "primary" : "secondary"} style={{ fontSize: 10 }}>{t.badge}</Badge>
                  {(localResponses[t.key]?.length || 0) > 0 && (
                    <Badge bg="success" className="ms-1" style={{ fontSize: 10 }}>✓</Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </div>
      )}

      <Container style={{ maxWidth: 820, padding: "20px 16px 80px" }}>
        {SURVEY_TABS
          .filter(t => !allowedTabs || allowedTabs.includes(t.key))
          .map((t, i) => {
          const idx = SURVEY_TABS.findIndex(x => x.key === t.key);
          const SurveyForm = SURVEY_FORMS[idx];
          const mode = activeMode[t.key] || "form";
          const local = localResponses[t.key] || [];
          const apiResponses = apiData[t.key];
          const displayResponses = apiResponses ?? local;
          const loading = apiLoading[t.key];
          const error = apiError[t.key];

          return (
            <div key={t.key} style={{ display: activeTab === t.key ? "block" : "none" }}>
              <div className="d-flex mb-3" style={{ borderBottom: "2px solid #dee2e6" }}>
                <button
                  className={`btn btn-sm px-4 fw-semibold ${mode === "form" ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ borderRadius: "6px 0 0 0" }}
                  onClick={() => switchMode(t.key, "form")}
                >
                  ✏️ 설문 작성
                </button>
                {/* 개별 링크 접속 시 결과 보기 숨김 */}
                {!surveyType && (
                <button
                  className={`btn btn-sm px-4 fw-semibold ${mode === "results" ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ borderRadius: "0 6px 0 0" }}
                  onClick={() => switchMode(t.key, "results")}
                >
                  📊 결과 보기
                </button>
                )}
              </div>

              {mode === "form" && (
                !submitted[t.key] ? (
                  <SurveyForm onSubmit={(ans) => handleSubmit(t.key, ans)} />
                ) : (
                  <Card className="shadow-sm border-0 mb-3">
                    <Card.Body className="text-center py-5">
                      <div style={{ fontSize: 52 }}>✅</div>
                      <h5 className="text-success mt-3 mb-2">설문이 제출되었습니다!</h5>
                      <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                        {UNIV} {DEPT} 설문에 응해주셔서 감사합니다.
                      </p>
                      {adminUnlocked && (
                        <Button variant="outline-danger" size="sm"
                          onClick={() => {
                            setSubmitted(p => {
                              const next = { ...p, [t.key]: false };
                              try { localStorage.setItem("survey_submitted", JSON.stringify(next)); } catch {}
                              return next;
                            });
                          }}>
                          🔓 관리자 — 다시 제출하기
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                )
              )}

              {mode === "results" && !adminUnlocked && (
                <Card className="shadow-sm border-0">
                  <Card.Body className="text-center py-5">
                    <div style={{ fontSize: 48 }}>🔒</div>
                    <h5 className="mt-3 mb-1">관리자 전용</h5>
                    <p className="text-muted mb-4" style={{ fontSize: 13 }}>
                      설문 결과를 보려면 관리자 비밀번호를 입력하세요.
                    </p>
                    <div className="d-flex justify-content-center gap-2">
                      <Form.Control
                        type="password"
                        placeholder="비밀번호"
                        value={pwInput}
                        onChange={e => { setPwInput(e.target.value); setPwError(false); }}
                        onKeyDown={e => e.key === "Enter" && checkPassword()}
                        isInvalid={pwError}
                        style={{ maxWidth: 200 }}
                        autoFocus
                      />
                      <Button variant="primary" onClick={checkPassword}>확인</Button>
                    </div>
                    {pwError && (
                      <p className="text-danger mt-2 mb-0" style={{ fontSize: 13 }}>
                        비밀번호가 올바르지 않습니다.
                      </p>
                    )}
                  </Card.Body>
                </Card>
              )}

              {mode === "results" && adminUnlocked && (
                <Card className="shadow-sm border-0">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="mb-0">
                        📊 설문 결과{" "}
                        {!loading && displayResponses.length > 0 && (
                          <Badge bg="secondary">{displayResponses.length}명 응답</Badge>
                        )}
                      </h5>
                      <div className="d-flex gap-2">
                        <Button variant="outline-danger" size="sm"
                          onClick={() => resetResults(t.key)}>
                          🗑 초기화
                        </Button>
                        <Button variant="outline-primary" size="sm"
                          disabled={loading}
                          onClick={() => fetchResults(t.key)}>
                          {loading ? <Spinner size="sm" animation="border" /> : "🔄 새로고침"}
                        </Button>
                        <Button variant="outline-secondary" size="sm"
                          onClick={() => { setAdminUnlocked(false); switchMode(t.key, "form"); }}>
                          🔒 잠금
                        </Button>
                      </div>
                    </div>

                    {loading && (
                      <div className="text-center py-5 text-muted">
                        <Spinner animation="border" variant="primary" className="mb-3" />
                        <p>결과를 불러오는 중...</p>
                      </div>
                    )}

                    {!loading && error && (
                      <Alert variant="warning" className="py-2" style={{ fontSize: 13 }}>
                        <strong>API 연결 실패:</strong> {error}
                        {local.length > 0
                          ? " — 현재 세션의 로컬 데이터로 표시합니다."
                          : " — 백엔드 서버를 확인하거나 설문을 먼저 제출해 주세요."}
                      </Alert>
                    )}

                    {!loading && displayResponses.length === 0 && (
                      <div className="text-center text-muted py-5">
                        <div style={{ fontSize: 40 }}>📭</div>
                        <p className="mt-2">아직 응답 데이터가 없습니다.</p>
                        <p style={{ fontSize: 12 }}>설문을 제출하거나 백엔드 API를 확인해 주세요.</p>
                      </div>
                    )}

                    {!loading && displayResponses.length > 0 && (
                      <div id={`results-print-${i}`}>
                        <SurveyResults idx={i} responses={displayResponses} />
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}
            </div>
          );
        })}
      </Container>
    </div>
  );
};

export default SurveyPage;
