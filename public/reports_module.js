// reports_module.js - Pure Vanilla JS Report & Analytics Engine for TPS Web Portal
(function() {
  'use strict';

  let activeReportTab = 'school'; // 'school', 'class', 'student'
  let selectedClass = '';
  let selectedStudent = '';
  let selectedExam = 'All Exams';
  let activeCharts = {};

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Custom styling for Reports module
  if (!document.getElementById("reportsCustomStyles")) {
    const style = document.createElement("style");
    style.id = "reportsCustomStyles";
    style.innerHTML = `
      #reportsPanel { background: transparent; padding: 0; box-shadow: none; font-family: 'Outfit', sans-serif; }
      .report-card { background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); margin-bottom: 25px; border: 1px solid #e2e8f0; font-family: 'Outfit', sans-serif; }
      .report-header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
      .report-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 6px; border-radius: 12px; }
      .report-tab-btn { background: transparent; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 0.9rem; color: #64748b; cursor: pointer; transition: all 0.25s ease; font-family: 'Outfit', sans-serif; display: inline-flex; align-items: center; gap: 4px; }
      .report-tab-btn.active { background: var(--brand, #1e3a8a); color: #ffffff; box-shadow: 0 2px 8px rgba(30,58,138,0.25); }
      .report-tab-btn:hover:not(.active) { color: #0f172a; background: rgba(255,255,255,0.5); }

      .report-controls-bar { display: flex; gap: 12px; align-items: center; background: #f8fafc; padding: 14px 18px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; flex-wrap: wrap; font-family: 'Outfit', sans-serif; }
      .report-select { padding: 9px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; font-weight: 600; color: #0f172a; background: #ffffff; min-width: 180px; outline: none; transition: border-color 0.2s; font-family: 'Outfit', sans-serif; }
      .report-select:focus { border-color: var(--brand, #1e3a8a); box-shadow: 0 0 0 3px rgba(30,58,138,0.1); }
      
      .report-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
      @media (max-width: 992px) { .report-stats-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 520px) { .report-stats-grid { grid-template-columns: 1fr; } }
      .report-stat-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
      .report-stat-label { font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
      .report-stat-value { font-size: 1.7rem; font-weight: 800; color: #0f172a; }
      .report-stat-sub { font-size: 0.78rem; color: #94a3b8; font-weight: 500; margin-top: 4px; }

      .report-charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
      .report-chart-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
      .report-chart-title { font-size: 1.05rem; font-weight: 800; color: #1e293b; margin: 0 0 16px 0; display: flex; align-items: center; justify-content: space-between; }
      .report-canvas-wrap { position: relative; height: 280px; width: 100%; }

      .report-empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
      .report-empty-state i { font-size: 44px; display: block; margin-bottom: 12px; }
      .report-empty-state h4 { font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; }
      .report-empty-state p { font-size: 0.9rem; margin: 0; color: #64748b; }

      .report-student-banner { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 22px; border-radius: 14px; margin-bottom: 24px; box-shadow: 0 4px 15px rgba(15,23,42,0.15); }
      .report-student-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #3b82f6; background: #334155; }
      .report-student-meta { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 8px; font-size: 0.85rem; color: #94a3b8; }
      .report-student-meta span { background: rgba(255,255,255,0.1); padding: 3px 10px; border-radius: 6px; }
    `;
    document.head.appendChild(style);
  }

  function destroyCharts() {
    Object.keys(activeCharts).forEach(key => {
      if (activeCharts[key] && typeof activeCharts[key].destroy === 'function') {
        try { activeCharts[key].destroy(); } catch (e) {}
      }
    });
    activeCharts = {};
  }

  function getSafeStore() {
    try {
      const s = (typeof window.getStore === 'function') ? window.getStore() : {};
      return {
        students: Array.isArray(s.students) ? s.students : [],
        exams: Array.isArray(s.exams) ? s.exams : [],
        attendance: Array.isArray(s.attendance) ? s.attendance : [],
        fees: Array.isArray(s.fees) ? s.fees : [],
        classes: Array.isArray(s.classes) ? s.classes : []
      };
    } catch (e) {
      return { students: [], exams: [], attendance: [], fees: [], classes: [] };
    }
  }

  function getCanonicalClasses(store) {
    const rawList = [
      ...(store.classes || []).map(c => [c.className, c.section].filter(Boolean).join('-')),
      ...(store.students || []).map(s => s.className)
    ];
    const set = new Set();
    rawList.forEach(c => {
      if (c && typeof c === 'string' && c.trim()) {
        const norm = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass(c.trim()) : c.trim();
        if (norm) set.add(norm);
      }
    });
    const CANONICAL_ORDER = ['Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'];
    return Array.from(set).sort((a, b) => {
      const idxA = CANONICAL_ORDER.indexOf(a);
      const idxB = CANONICAL_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  window.renderReportsModule = function() {
    const panel = document.getElementById("reportsPanel");
    if (!panel) return;

    panel.classList.remove("hidden");
    panel.style.display = "block";

    panel.innerHTML = `
      <div class="report-card">
        <div class="report-header">
          <div class="report-tabs">
            <button id="rptTabSchool" class="report-tab-btn ${activeReportTab === 'school' ? 'active' : ''}"><span class="material-symbols-outlined" style="font-size:16px;">analytics</span> School Overview</button>
            <button id="rptTabClass" class="report-tab-btn ${activeReportTab === 'class' ? 'active' : ''}"><span class="material-symbols-outlined" style="font-size:16px;">class</span> Class Wise</button>
            <button id="rptTabStudent" class="report-tab-btn ${activeReportTab === 'student' ? 'active' : ''}"><span class="material-symbols-outlined" style="font-size:16px;">person</span> Single Student</button>
          </div>
        </div>
        <div id="reportControlsArea"></div>
        <div id="reportContentArea"></div>
      </div>
    `;

    document.getElementById("rptTabSchool").onclick = () => {
      activeReportTab = 'school';
      selectedClass = '';
      selectedStudent = '';
      selectedExam = 'All Exams';
      updateTabButtons();
      renderActiveTab();
    };

    document.getElementById("rptTabClass").onclick = () => {
      activeReportTab = 'class';
      selectedStudent = '';
      updateTabButtons();
      renderActiveTab();
    };

    document.getElementById("rptTabStudent").onclick = () => {
      activeReportTab = 'student';
      updateTabButtons();
      renderActiveTab();
    };

    renderActiveTab();
  };

  function updateTabButtons() {
    const bSchool = document.getElementById("rptTabSchool");
    const bClass = document.getElementById("rptTabClass");
    const bStudent = document.getElementById("rptTabStudent");
    if (bSchool) bSchool.classList.toggle("active", activeReportTab === 'school');
    if (bClass) bClass.classList.toggle("active", activeReportTab === 'class');
    if (bStudent) bStudent.classList.toggle("active", activeReportTab === 'student');
  }

  function renderActiveTab() {
    destroyCharts();
    const ctrl = document.getElementById("reportControlsArea");
    const body = document.getElementById("reportContentArea");
    if (!ctrl || !body) return;

    const store = getSafeStore();

    if (activeReportTab === 'school') {
      renderSchoolOverview(ctrl, body, store);
    } else if (activeReportTab === 'class') {
      renderClassWise(ctrl, body, store);
    } else if (activeReportTab === 'student') {
      renderSingleStudent(ctrl, body, store);
    }
  }

  // ----------------------------------------------------
  // TAB 1: SCHOOL OVERVIEW
  // ----------------------------------------------------
  function renderSchoolOverview(ctrl, body, store) {
    const examList = Array.from(new Set(store.exams.map(e => e.examName).filter(Boolean))).sort();
    const classes = getCanonicalClasses(store);

    ctrl.innerHTML = `
      <div class="report-controls-bar">
        <div style="flex:1; color:#475569; font-weight:600; font-size:0.9rem; display:flex; align-items:center; gap:6px;">
          <span class="material-symbols-outlined" style="font-size:18px; color:var(--brand, #1e3a8a);">insights</span> Displaying holistic growth analytics across all classes and student cohorts.
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.85rem; font-weight:700; color:#475569;">Exam Filter:</label>
          <select id="rptExamSelect" class="report-select">
            <option value="All Exams" ${selectedExam === 'All Exams' ? 'selected' : ''}>All Exams (Consolidated)</option>
            ${examList.map(name => `<option value="${name}" ${selectedExam === name ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    document.getElementById("rptExamSelect").onchange = (e) => {
      selectedExam = e.target.value;
      renderActiveTab();
    };

    // Metrics calculation
    const totalStudents = store.students.filter(s => s.status !== 'Left').length;
    let totalExamsRecorded = store.exams.length;
    let avgScore = 0;
    if (store.exams.length > 0) {
      const validPercentages = store.exams.map(e => parseFloat(e.percentage)).filter(p => !isNaN(p) && p > 0);
      if (validPercentages.length > 0) {
        avgScore = (validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length).toFixed(1);
      }
    }

    let totalCollected = 0, totalPending = 0;
    store.fees.forEach(f => {
      totalCollected += parseFloat(f.paidAmount) || 0;
      totalPending += parseFloat(f.balance) || 0;
    });

    let totalPresent = 0, totalAtt = store.attendance.length;
    store.attendance.forEach(a => {
      if (a.status === 'Present') totalPresent++;
    });
    const attPercent = totalAtt > 0 ? ((totalPresent / totalAtt) * 100).toFixed(1) : 100;

    body.innerHTML = `
      <div class="report-stats-grid">
        <div class="report-stat-box">
          <span class="report-stat-label">Active Students</span>
          <span class="report-stat-value" style="color: #2563eb;">${totalStudents}</span>
          <span class="report-stat-sub">Across ${classes.length} distinct classes</span>
        </div>
        <div class="report-stat-box">
          <span class="report-stat-label">Academic Average</span>
          <span class="report-stat-value" style="color: #10b981;">${avgScore}%</span>
          <span class="report-stat-sub">${totalExamsRecorded} marks records analyzed</span>
        </div>
        <div class="report-stat-box">
          <span class="report-stat-label">School Attendance</span>
          <span class="report-stat-value" style="color: #8b5cf6;">${attPercent}%</span>
          <span class="report-stat-sub">${totalPresent} of ${totalAtt} attendance marked</span>
        </div>
        <div class="report-stat-box">
          <span class="report-stat-label">Fees Collection</span>
          <span class="report-stat-value" style="color: #059669;">₹${Math.round(totalCollected).toLocaleString('en-IN')}</span>
          <span class="report-stat-sub">Pending: ₹${Math.round(totalPending).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div class="report-charts-grid">
        <div class="report-chart-card" style="grid-column: 1 / -1;">
          <div class="report-chart-title">
            <span>Academic Performance Comparison by Class (%)</span>
            <span style="font-size:0.8rem; font-weight:600; color:#64748b;">${selectedExam}</span>
          </div>
          <div class="report-canvas-wrap" style="height: 320px;">
            <canvas id="rptAcademicCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Attendance Overview</div>
          <div class="report-canvas-wrap">
            <canvas id="rptAttendanceCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Fee Collection Summary</div>
          <div class="report-canvas-wrap">
            <canvas id="rptFeesCanvas"></canvas>
          </div>
        </div>
      </div>
    `;

    // Render Charts
    setTimeout(() => {
      drawSchoolAcademicChart(document.getElementById("rptAcademicCanvas"), store, selectedExam);
      drawSchoolAttendanceChart(document.getElementById("rptAttendanceCanvas"), store);
      drawSchoolFeesChart(document.getElementById("rptFeesCanvas"), store);
    }, 50);
  }

  // ----------------------------------------------------
  // TAB 2: CLASS WISE
  // ----------------------------------------------------
  function renderClassWise(ctrl, body, store) {
    const classes = getCanonicalClasses(store);
    if (!selectedClass && classes.length > 0) {
      selectedClass = classes[0];
    }

    ctrl.innerHTML = `
      <div class="report-controls-bar">
        <label style="font-size:0.85rem; font-weight:700; color:#475569;">Select Class:</label>
        <select id="rptClassSelect" class="report-select">
          ${classes.map(c => `<option value="${c}" ${selectedClass === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <span style="color:#64748b; font-size:0.85rem; margin-left:auto;">
          Showing reports for <b>${selectedClass || 'None'}</b>
        </span>
      </div>
    `;

    document.getElementById("rptClassSelect").onchange = (e) => {
      selectedClass = e.target.value;
      renderActiveTab();
    };

    if (!selectedClass) {
      body.innerHTML = `<div class="report-empty-state"><span class="material-symbols-outlined" style="font-size:48px; color:#94a3b8; display:block; margin:0 auto 12px;">school</span><h4>Please select a class</h4><p>Choose a class from the dropdown above to inspect results.</p></div>`;
      return;
    }

    const normFunc = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass : (x => x);
    const studentsInClass = store.students.filter(s => (normFunc(s.className) === normFunc(selectedClass) || s.className === selectedClass) && s.status !== 'Left');
    const examsInClass = store.exams.filter(e => normFunc(e.className) === normFunc(selectedClass) || e.className === selectedClass);
    const attInClass = store.attendance.filter(a => normFunc(a.className) === normFunc(selectedClass) || a.className === selectedClass);

    let avgScore = 0;
    const percentages = examsInClass.map(e => parseFloat(e.percentage)).filter(p => !isNaN(p) && p > 0);
    if (percentages.length > 0) {
      avgScore = (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1);
    }

    let presentCount = 0;
    attInClass.forEach(a => { if (a.status === 'Present') presentCount++; });
    const classAttPercent = attInClass.length > 0 ? ((presentCount / attInClass.length) * 100).toFixed(1) : 100;

    body.innerHTML = `
      <div class="report-stats-grid">
        <div class="report-stat-box">
          <span class="report-stat-label">Enrolled Students</span>
          <span class="report-stat-value" style="color: #2563eb;">${studentsInClass.length}</span>
          <span class="report-stat-sub">Active in ${selectedClass}</span>
        </div>
        <div class="report-stat-box">
          <span class="report-stat-label">Class Average Score</span>
          <span class="report-stat-value" style="color: #10b981;">${avgScore}%</span>
          <span class="report-stat-sub">${examsInClass.length} total exam entries</span>
        </div>
        <div class="report-stat-box">
          <span class="report-stat-label">Class Attendance</span>
          <span class="report-stat-value" style="color: #8b5cf6;">${classAttPercent}%</span>
          <span class="report-stat-sub">${presentCount} present marks</span>
        </div>
      </div>

      <div class="report-charts-grid">
        <div class="report-chart-card" style="grid-column: 1 / -1;">
          <div class="report-chart-title">Exam Performance Progression in ${selectedClass}</div>
          <div class="report-canvas-wrap" style="height: 300px;">
            <canvas id="rptClassExamCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Class Attendance Distribution</div>
          <div class="report-canvas-wrap">
            <canvas id="rptClassAttendanceCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Top Students Ranking</div>
          <div style="max-height: 280px; overflow-y: auto;">
            ${studentsInClass.length === 0 ? '<div style="color:#94a3b8; padding:20px; text-align:center;">No students found</div>' : `
              <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
                <thead>
                  <tr style="border-bottom:2px solid #f1f5f9; text-align:left; color:#64748b;">
                    <th style="padding:8px 4px;">#</th>
                    <th style="padding:8px 4px;">Student</th>
                    <th style="padding:8px 4px;">Roll</th>
                    <th style="padding:8px 4px; text-align:right;">Adm No</th>
                  </tr>
                </thead>
                <tbody>
                  ${studentsInClass.slice(0, 15).map((s, idx) => `
                    <tr style="border-bottom:1px solid #f8fafc;">
                      <td style="padding:8px 4px; font-weight:700; color:#3b82f6;">${idx + 1}</td>
                      <td style="padding:8px 4px; font-weight:600; color:#0f172a;">${s.fullName || 'Unnamed'}</td>
                      <td style="padding:8px 4px; color:#64748b;">${s.rollNo || '-'}</td>
                      <td style="padding:8px 4px; text-align:right; font-weight:500; color:#64748b;">${s.admissionNo || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      drawClassExamChart(document.getElementById("rptClassExamCanvas"), examsInClass);
      drawAttendanceDoughnut(document.getElementById("rptClassAttendanceCanvas"), attInClass);
    }, 50);
  }

  // ----------------------------------------------------
  // TAB 3: SINGLE STUDENT
  // ----------------------------------------------------
  function renderSingleStudent(ctrl, body, store) {
    const classes = getCanonicalClasses(store);
    if (!selectedClass && classes.length > 0) {
      selectedClass = classes[0];
    }

    const normFunc = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass : (x => x);
    const studentsInClass = store.students.filter(s => (normFunc(s.className) === normFunc(selectedClass) || s.className === selectedClass) && s.status !== 'Left')
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

    if (!selectedStudent && studentsInClass.length > 0) {
      selectedStudent = studentsInClass[0].admissionNo || '';
    }

    ctrl.innerHTML = `
      <div class="report-controls-bar">
        <label style="font-size:0.85rem; font-weight:700; color:#475569;">Class:</label>
        <select id="rptStudentClassSelect" class="report-select" style="min-width:140px;">
          ${classes.map(c => `<option value="${c}" ${selectedClass === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>

        <label style="font-size:0.85rem; font-weight:700; color:#475569; margin-left:8px;">Student:</label>
        <select id="rptStudentSelect" class="report-select" style="min-width:240px;" ${studentsInClass.length === 0 ? 'disabled' : ''}>
          ${studentsInClass.length === 0 ? '<option value="">No students in class</option>' : 
            studentsInClass.map(s => `<option value="${s.admissionNo}" ${String(selectedStudent).trim().toLowerCase() === String(s.admissionNo || '').trim().toLowerCase() ? 'selected' : ''}>${s.fullName} (Roll: ${s.rollNo || '-'}, Adm: ${s.admissionNo || '-'})</option>`).join('')
          }
        </select>
      </div>
    `;

    document.getElementById("rptStudentClassSelect").onchange = (e) => {
      selectedClass = e.target.value;
      selectedStudent = '';
      renderActiveTab();
    };

    document.getElementById("rptStudentSelect").onchange = (e) => {
      selectedStudent = e.target.value;
      renderActiveTab();
    };

    const targetStudent = studentsInClass.find(s => String(s.admissionNo || '').trim().toLowerCase() === String(selectedStudent || '').trim().toLowerCase()) || studentsInClass[0];

    if (!targetStudent) {
      body.innerHTML = `<div class="report-empty-state"><span class="material-symbols-outlined" style="font-size:48px; color:#94a3b8; display:block; margin:0 auto 12px;">person_search</span><h4>No student selected</h4><p>Select a class and student to view their comprehensive academic report.</p></div>`;
      return;
    }

    const targetAdm = String(targetStudent.admissionNo || '').trim().toLowerCase();

    const studentExams = (store.exams || []).filter(e => {
      const eAdm = String(e.admissionNo || '').trim().toLowerCase();
      return targetAdm && eAdm && eAdm === targetAdm;
    });
    const studentAtt = (store.attendance || []).filter(a => {
      const aAdm = String(a.admissionNo || '').trim().toLowerCase();
      return targetAdm && aAdm && aAdm === targetAdm;
    });
    const studentFees = (store.fees || []).filter(f => {
      const fAdm = String(f.admissionNo || '').trim().toLowerCase();
      return targetAdm && fAdm && fAdm === targetAdm;
    });

    let paid = 0, balance = 0;
    studentFees.forEach(f => {
      paid += parseFloat(f.paidAmount) || 0;
      balance += parseFloat(f.balance) || 0;
    });

    const photoUrl = (typeof window.getImageUrl === 'function') 
      ? window.getImageUrl('students', targetStudent.id, 'photo', targetStudent.photoUrl || targetStudent.photo)
      : (targetStudent.photoUrl || 'assets/school_logo.png');

    body.innerHTML = `
      <div class="report-student-banner">
        <img src="${photoUrl}" class="report-student-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(targetStudent.fullName)}&background=random'" />
        <div style="flex:1;">
          <h2 style="margin:0 0 4px 0; font-size:1.5rem; font-weight:800;">${escapeHtml(targetStudent.fullName)}</h2>
          <div class="report-student-meta">
            <span>Roll No: <b>${escapeHtml(targetStudent.rollNo || '-')}</b></span>
            <span>Class: <b>${escapeHtml(targetStudent.className || selectedClass)}</b></span>
            <span>Adm No: <b>${escapeHtml(targetStudent.admissionNo || '-')}</b></span>
            <span>Father: <b>${escapeHtml(targetStudent.fatherName || '-')}</b></span>
            <span>Status: <b style="color:#4ade80;">${escapeHtml(targetStudent.status || 'Active')}</b></span>
          </div>
        </div>
      </div>

      <div class="report-charts-grid">
        <div class="report-chart-card" style="grid-column: 1 / -1;">
          <div class="report-chart-title">Exam Marks & Percentage History</div>
          <div class="report-canvas-wrap" style="height: 300px;">
            <canvas id="rptStudentExamCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Attendance Record</div>
          <div class="report-canvas-wrap">
            <canvas id="rptStudentAttCanvas"></canvas>
          </div>
        </div>

        <div class="report-chart-card">
          <div class="report-chart-title">Fee Ledger Overview</div>
          <div class="report-canvas-wrap">
            <canvas id="rptStudentFeeCanvas"></canvas>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      drawStudentExamChart(document.getElementById("rptStudentExamCanvas"), studentExams);
      drawAttendanceDoughnut(document.getElementById("rptStudentAttCanvas"), studentAtt);
      drawStudentFeeDoughnut(document.getElementById("rptStudentFeeCanvas"), paid, balance);
    }, 50);
  }

  // ----------------------------------------------------
  // CHART RENDERING HELPERS (Pure Chart.js)
  // ----------------------------------------------------
  function drawSchoolAcademicChart(canvas, store, examFilter) {
    if (!canvas || !window.Chart) return;
    let filtered = store.exams || [];
    if (examFilter && examFilter !== 'All Exams') {
      filtered = filtered.filter(e => e.examName === examFilter);
    }

    const classGroups = {};
    filtered.forEach(e => {
      if (!e.className) return;
      const norm = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass(e.className) : e.className;
      if (!classGroups[norm]) classGroups[norm] = [];
      const p = parseFloat(e.percentage);
      if (!isNaN(p) && p > 0) classGroups[norm].push(p);
    });

    const labels = Object.keys(classGroups).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const data = labels.map(cls => {
      const arr = classGroups[cls];
      if (!arr || arr.length === 0) return 0;
      return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    });

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    activeCharts['academic'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Class Average Percentage (%)',
          data: data.length > 0 ? data : [0],
          backgroundColor: gradient,
          borderColor: '#2563eb',
          borderWidth: 3,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#2563eb',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(ctx) { return ctx.parsed.y + '%'; }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function drawSchoolAttendanceChart(canvas, store) {
    drawAttendanceDoughnut(canvas, store.attendance || []);
  }

  function drawSchoolFeesChart(canvas, store) {
    if (!canvas || !window.Chart) return;
    let totalCollected = 0, totalPending = 0;
    (store.fees || []).forEach(f => {
      totalCollected += parseFloat(f.paidAmount) || 0;
      totalPending += parseFloat(f.balance) || 0;
    });

    drawStudentFeeDoughnut(canvas, totalCollected, totalPending);
  }

  function drawClassExamChart(canvas, exams) {
    if (!canvas || !window.Chart) return;
    const examGroups = {};
    exams.forEach(e => {
      const name = e.examName || 'Exam';
      if (!examGroups[name]) examGroups[name] = [];
      const p = parseFloat(e.percentage);
      if (!isNaN(p) && p > 0) examGroups[name].push(p);
    });

    const labels = Object.keys(examGroups);
    const data = labels.map(name => {
      const arr = examGroups[name];
      if (!arr || arr.length === 0) return 0;
      return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
    });

    const ctx = canvas.getContext('2d');
    activeCharts['classExams'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Exams Recorded'],
        datasets: [{
          label: 'Average Score (%)',
          data: data.length > 0 ? data : [0],
          backgroundColor: '#3b82f6',
          borderRadius: 8,
          barThickness: 32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function drawStudentExamChart(canvas, exams) {
    if (!canvas || !window.Chart) return;
    let labels = [];
    let data = [];

    if (exams.length === 1 && exams[0].subjectMarks) {
      let subs = [];
      try {
        subs = typeof exams[0].subjectMarks === 'string' ? JSON.parse(exams[0].subjectMarks) : exams[0].subjectMarks;
      } catch (e) { subs = []; }
      if (Array.isArray(subs) && subs.length > 0) {
        subs.forEach(s => {
          if (!s || !s.subject) return;
          const val = parseFloat(s.total !== undefined && !isNaN(parseFloat(s.total)) ? s.total : s.marks);
          const max = parseFloat(s.max) || 100;
          const pct = !isNaN(val) && max > 0 ? +((val / max) * 100).toFixed(1) : 0;
          labels.push(s.subject);
          data.push(pct);
        });
        labels.push(`Overall (${exams[0].examName || 'Exam'})`);
        data.push(parseFloat(exams[0].percentage) || 0);
      }
    }

    if (labels.length === 0) {
      labels = exams.map(e => e.examName || 'Exam');
      data = exams.map(e => parseFloat(e.percentage) || 0);
    }

    const ctx = canvas.getContext('2d');
    activeCharts['studentExams'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Exams Recorded'],
        datasets: [{
          label: 'Score Percentage (%)',
          data: data.length > 0 ? data : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 3,
          pointRadius: 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { callback: v => v + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function drawAttendanceDoughnut(canvas, attList) {
    if (!canvas || !window.Chart) return;
    let present = 0, absent = 0, late = 0, leave = 0;
    (attList || []).forEach(a => {
      const st = String(a.status || '').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else if (st === 'leave') leave++;
    });

    const total = present + absent + late + leave;
    const data = total > 0 ? [present, absent, late, leave] : [1, 0, 0, 0];
    const labels = total > 0 ? ['Present', 'Absent', 'Late', 'Leave'] : ['No Records', '', '', ''];

    const ctx = canvas.getContext('2d');
    activeCharts['attendance'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { weight: '600' } } }
        }
      }
    });
  }

  function drawStudentFeeDoughnut(canvas, paid, balance) {
    if (!canvas || !window.Chart) return;
    const total = paid + balance;
    const data = total > 0 ? [paid, balance] : [1, 0];
    const labels = total > 0 ? ['Paid Amount (₹)', 'Pending Balance (₹)'] : ['No Fee Records', ''];

    const ctx = canvas.getContext('2d');
    activeCharts['fees'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#10b981', '#f87171'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { weight: '600' } } }
        }
      }
    });
  }

})();
