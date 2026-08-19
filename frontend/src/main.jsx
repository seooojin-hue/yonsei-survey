import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import SurveyPage from './SurveyPage.jsx'
import 'bootstrap/dist/css/bootstrap.min.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        {/* 전체 탭 관리자용 */}
        <Route path="/survey" element={<SurveyPage />} />
        {/* 설문 대상별 개별 링크 */}
        <Route path="/survey/student"           element={<SurveyPage surveyType="student" />} />
        <Route path="/survey/industry"          element={<SurveyPage surveyType="industry" />} />
        <Route path="/survey/graduate"          element={<SurveyPage surveyType="graduate" />} />
        <Route path="/survey/awareness"         element={<SurveyPage surveyType="awareness" />} />
        <Route path="/survey/exam-need"         element={<SurveyPage surveyType="exam-need" />} />
        <Route path="/survey/exam-satisfaction" element={<SurveyPage surveyType="exam-satisfaction" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)