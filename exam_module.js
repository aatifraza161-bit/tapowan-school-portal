// Exam Management Module - Advanced UI and Logic
(function() {
  let activeExamTab = 'entry'; // 'entry', 'admit', 'result'
  const SCHOOL_NAME = "Tapowan Public School";

  // Inject Custom CSS for Exam Module
  if (!document.getElementById("examCustomStyles")) {
    const style = document.createElement("style");
    style.id = "examCustomStyles";
    style.innerHTML = `
      #examPanel { background: transparent; padding: 0; box-shadow: none; }
      .exam-card { background: white; border-radius: 16px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); margin-bottom: 25px; border: 1px solid #e2e8f0; }
      .exam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
      .exam-header h3 { font-size: 1.8rem; color: inherit; margin: 0; font-weight: 800; letter-spacing: -0.02em; }
      .exam-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 6px; border-radius: 12px; }
      .exam-tab-btn { background: transparent; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; color: inherit; cursor: pointer; transition: all 0.3s ease; }
      .exam-tab-btn.active { background: white; color: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .exam-tab-btn:hover:not(.active) { color: inherit; }

      .exam-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; align-items: end; }
      .exam-field label { display: block; font-size: 0.8rem; font-weight: 700; color: inherit; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
      .exam-field select, .exam-field input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; background: transparent; transition: all 0.3s ease; font-weight: 500; color: inherit; box-sizing: border-box; }
      .exam-field select:focus, .exam-field input:focus { border-color: inherit; background: white; outline: none; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
      
      .exam-btn { padding: 12px 24px; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 8px; justify-content: center; font-size: 0.95rem; }
      .exam-btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; box-shadow: 0 4px 12px rgba(37,99,235,0.2); }
      .exam-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(37,99,235,0.3); }
      .exam-btn-secondary { background: #f1f5f9; color: inherit; }
      .exam-btn-secondary:hover { background: #e2e8f0; color: inherit; }

      .exam-data-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-top: 20px; }
      .exam-data-table th { text-align: left; padding: 12px 20px; color: inherit; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
      .exam-data-table td { background: white; padding: 16px 20px; font-weight: 500; color: inherit; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
      .exam-data-table tr td:first-child { border-radius: 12px 0 0 12px; border-left: 1px solid #e2e8f0; font-weight: 700; }
      .exam-data-table tr td:last-child { border-radius: 0 12px 12px 0; border-right: 1px solid #e2e8f0; }
      .exam-data-table tbody tr { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: default; }
      .exam-data-table tbody tr:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.04); z-index: 10; position: relative; }
      .exam-data-table tbody tr:hover td { border-color: transparent; }
      .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
      .status-entered { background: #dcfce7; color: inherit; }
      .status-pending { background: #fee2e2; color: inherit; }

      /* Modal */
      .exam-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
      .exam-modal-overlay.active { opacity: 1; pointer-events: auto; }
      .exam-modal { background: white; border-radius: 24px; width: 90%; max-width: 850px; max-height: 90vh; overflow-y: auto; padding: 35px; transform: translateY(20px); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
      .exam-modal-overlay.active .exam-modal { transform: translateY(0); }
      .exam-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 25px; }
      .exam-modal-header h2 { margin: 0; color: inherit; font-size: 1.6rem; font-weight: 800; display: flex; flex-direction: column; }
      .exam-modal-header h2 span { font-size: 0.9rem; color: inherit; font-weight: 600; margin-top: 5px; }
      .exam-close-btn { background: #f1f5f9; color: inherit; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 1.2rem; }
      .exam-close-btn:hover { background: #fee2e2; color: inherit; }

      .marks-subject-header { display: grid; grid-template-columns: 2fr 60px 60px 1fr 1fr 1fr 40px; gap: 8px; padding: 0 15px 10px 15px; font-weight: 700; color: inherit; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .marks-subject-row { display: grid; grid-template-columns: 2fr 60px 60px 1fr 1fr 1fr 40px; gap: 8px; align-items: center; padding: 15px; background: transparent; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0; transition: border-color 0.2s; }
      .marks-subject-row:hover { border-color: inherit; }
      .marks-subject-row input { width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-weight: 700; text-align: center; color: inherit; font-size: 1rem; box-sizing: border-box; }
      .marks-subject-row input[type="text"] { text-align: left; }
      .marks-subject-row input:focus { border-color: inherit; outline: none; background: white; }
      .marks-subject-row .total-cell { font-weight: 800; text-align: center; color: inherit; font-size: 1.1rem; }
      .del-row-btn { background: #fee2e2; color: inherit; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
      .del-row-btn:hover { background: #ef4444; color: white; }

      /* Summary Box */
      .marks-summary-box { background: linear-gradient(135deg, #0f172a, #1e293b); color: white; padding: 20px; border-radius: 16px; margin-top: 25px; display: flex; justify-content: space-around; text-align: center; box-shadow: 0 10px 25px rgba(15,23,42,0.2); }
      .marks-summary-item p { margin: 0 0 5px 0; color: inherit; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
      .marks-summary-item h4 { margin: 0; font-size: 1.8rem; font-weight: 800; color: inherit; }
      
      .empty-state { text-align: center; padding: 50px 20px; color: inherit; }
      .empty-state i { font-size: 48px; color: inherit; margin-bottom: 15px; }
      .empty-state h4 { margin: 0 0 10px 0; color: inherit; font-size: 1.2rem; font-weight: 700; }

      /* Themes for Results */
      .result-board { border: 4px solid #0f172a; padding: 30px; background: transparent; font-family: 'Times New Roman', Times, serif; }
      .result-blue { border-radius: 20px; padding: 30px; background: linear-gradient(to bottom right, #ffffff, #eff6ff); border: 1px solid #bfdbfe; box-shadow: 0 10px 30px rgba(37,99,235,0.1); }
      .result-green { border-radius: 20px; padding: 30px; background: linear-gradient(to bottom right, #ffffff, #f0fdf4); border: 2px solid #22c55e; box-shadow: 0 10px 30px rgba(34,197,94,0.1); }
      .result-dark { border-radius: 20px; padding: 30px; background: #0f172a; color: inherit; border: 2px solid #fbbf24; }
      .result-dark table th { background: #1e293b !important; color: inherit4 !important; border-color: inherit5 !important; }
      .result-dark table td { border-color: inherit5 !important; color: inherit0 !important; }
      .result-minimal { padding: 40px; background: transparent; border-top: 8px solid #0f172a; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    `;
    document.head.appendChild(style);
  }

  // Define subjects by class level
  const defaultSubjects = {
    primary: ['English', 'Hindi', 'Mathematics', 'EVS', 'Computer', 'G.K'],
    middle: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer'],
    high: ['English (184)', 'Hindi Course-B (085)', 'Mathematics (041)', 'Science (086)', 'Social Science (087)', 'Information Tech (402)']
  };

  function getSubjectsForClass(className) {
    const cl = (className || "").toLowerCase();
    if (cl.includes('9') || cl.includes('10') || cl.includes('ix') || cl.includes('x')) return defaultSubjects.high;
    if (cl.includes('6') || cl.includes('7') || cl.includes('8') || cl.includes('vi') || cl.includes('vii') || cl.includes('viii')) return defaultSubjects.middle;
    return defaultSubjects.primary;
  }

  window.renderExamModule = function() {
    const examPanel = document.getElementById("examPanel");
    if (!examPanel) return;

    examPanel.classList.remove("hidden");
    examPanel.style.display = "block";

    examPanel.innerHTML = `
      <div class="exam-card">
        <div class="exam-header">
          <h3>Exam Management</h3>
          <div class="exam-tabs">
            <button id="examTabEntryBtn" class="exam-tab-btn active">Marks Entry</button>
            <button id="examTabAdmitBtn" class="exam-tab-btn">Admit Cards</button>
            <button id="examTabResultBtn" class="exam-tab-btn">Results</button>
          </div>
        </div>
        <div id="examPanelContent"></div>
      </div>
    `;

    document.getElementById("examTabEntryBtn").onclick = () => { activeExamTab = 'entry'; updateExamTabs(); renderExamContent(); };
    document.getElementById("examTabAdmitBtn").onclick = () => { activeExamTab = 'admit'; updateExamTabs(); renderExamContent(); };
    document.getElementById("examTabResultBtn").onclick = () => { activeExamTab = 'result'; updateExamTabs(); renderExamContent(); };

    renderExamContent();
  };

  function updateExamTabs() {
    document.getElementById("examTabEntryBtn").classList.toggle("active", activeExamTab === 'entry');
    document.getElementById("examTabAdmitBtn").classList.toggle("active", activeExamTab === 'admit');
    document.getElementById("examTabResultBtn").classList.toggle("active", activeExamTab === 'result');
  }

  function renderExamContent() {
    const container = document.getElementById("examPanelContent");
    if (activeExamTab === 'entry') renderMarksEntry(container);
    else if (activeExamTab === 'admit') renderAdmitCards(container);
    else if (activeExamTab === 'result') renderResults(container);
  }

  // ==========================================
  // TAB 1: MARKS ENTRY
  // ==========================================
  function renderMarksEntry(container) {
    container.innerHTML = `
      <div style="margin-bottom: 25px;">
        <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Enter Student Marks</h4>
        <p style="margin:0; color: inherit; font-size:0.9rem;">Record subject-wise marks for examinations.</p>
      </div>
      <div class="exam-form-grid" style="margin-bottom: 30px;">
        <div class="exam-field">
          <label>Select Class</label>
          <select id="examEntryClassSelect"></select>
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <input id="examEntryName" placeholder="e.g. Mid Term Exam" value="Mid Term Exam" />
        </div>
        <div class="exam-field">
          <label>Session</label>
          <input id="examEntrySession" value="2026-27" />
        </div>
        <div class="exam-field">
          <button id="examEntryLoadBtn" class="exam-btn exam-btn-primary" style="width:100%;">
            Load Students
          </button>
        </div>
      </div>
      <div id="examEntryTableContainer">
         <div class="empty-state">
           <i>📋</i>
           <h4>Ready to enter marks</h4>
           <p>Select a class and click "Load Students" to begin.</p>
         </div>
      </div>
    `;

    populateClassSelect("examEntryClassSelect");

    document.getElementById("examEntryLoadBtn").onclick = () => {
      const cls = document.getElementById("examEntryClassSelect").value;
      const examName = document.getElementById("examEntryName").value;
      const session = document.getElementById("examEntrySession").value;
      if(!cls || !examName) return window.showToast ? showToast("Please fill all fields", "warning") : alert("Fill all fields");
      loadStudentsForMarksEntry(cls, examName, session);
    };
  }

  function loadStudentsForMarksEntry(className, examName, session) {
    const container = document.getElementById("examEntryTableContainer");
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const students = (store.students || []).filter(s => s.className === className && s.status !== "Left");
    
    if(students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
           <h4>No Students Found</h4>
           <p>There are no active students in ${className}.</p>
         </div>
      `;
      return;
    }

    // Sort students by roll no
    students.sort((a,b) => parseInt(a.rollNo||0) - parseInt(b.rollNo||0));

    let html = `
      <table class="exam-data-table">
        <thead>
          <tr>
            <th style="width:80px;">Roll No</th>
            <th>Student Name</th>
            <th>Status</th>
            <th style="text-align:right;">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    students.forEach(s => {
      // Check if marks already entered
      const existingExam = (store.exams || []).find(e => e.studentName === s.fullName && e.className === className && e.examName === examName && e.session === session);
      const isEntered = !!existingExam;
      const statusHtml = isEntered ? '<span class="status-badge status-entered">Entered</span>' : '<span class="status-badge status-pending">Pending</span>';
      const btnText = isEntered ? 'Edit Marks' : 'Enter Marks';

      html += `
        <tr>
          <td>${s.rollNo || '-'}</td>
          <td>
            <div style="font-weight:700; color: inherit; ">${s.fullName}</div>
            <div style="font-size:0.8rem; color: inherit;">${s.fatherName || ''}</div>
          </td>
          <td>${statusHtml}</td>
          <td style="text-align:right;">
             <button class="exam-btn exam-btn-secondary" onclick="window.openMarksModal('${s.id}', '${examName}', '${session}', '${className}')">${btnText}</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  window.openMarksModal = function(studentId, examName, session, className) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const student = (store.students || []).find(s => String(s.id) === String(studentId));
    if(!student) return;

    let existingExam = (store.exams || []).find(e => e.studentName === student.fullName && e.className === className && e.examName === examName && e.session === session);
    
    let subjectData = [];
    if (existingExam && existingExam.subjectMarks) {
      try {
        subjectData = JSON.parse(existingExam.subjectMarks);
      } catch(e) { console.error("Parse error", e); }
    } else {
      // Initialize with default subjects
      const defaults = getSubjectsForClass(className);
      subjectData = defaults.map(sub => ({ subject: sub, max: 100, min: 33, theory: '', practical: '', total: 0 }));
    }

    const overlay = document.createElement("div");
    overlay.className = "exam-modal-overlay active";
    overlay.id = "examMarksModal";

    let rowsHtml = '';
    subjectData.forEach((sd, idx) => {
      rowsHtml += `
        <div class="marks-subject-row" data-idx="${idx}">
          <input type="text" class="sub-name" value="${sd.subject}" placeholder="Subject Name" />
          <input type="number" class="sub-max" value="${sd.max !== undefined ? sd.max : 100}" placeholder="100" min="1" />
          <input type="number" class="sub-min" value="${sd.min !== undefined ? sd.min : 33}" placeholder="33" min="0" />
          <input type="number" class="sub-th" value="${sd.theory}" placeholder="0" min="0" />
          <input type="number" class="sub-pr" value="${sd.practical}" placeholder="0" min="0" />
          <div class="total-cell" id="sub-tot-${idx}">${sd.total || 0}</div>
          <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
        </div>
      `;
    });

    overlay.innerHTML = `
      <div class="exam-modal">
        <div class="exam-modal-header">
          <h2>${student.fullName} <span>Class: ${className} | Roll: ${student.rollNo} | Exam: ${examName}</span></h2>
          <button class="exam-close-btn" onclick="document.getElementById('examMarksModal').remove()">×</button>
        </div>
        
        <div class="marks-subject-header">
          <div>Subject Name</div>
          <div>Max</div>
          <div>Min</div>
          <div>Theory</div>
          <div>Prac/Int</div>
          <div style="text-align:center;">Total</div>
          <div></div>
        </div>
        
        <div id="marksSubjectContainer">
          ${rowsHtml}
        </div>
        
        <div style="margin-top:15px;">
          <button id="addSubjectBtn" class="exam-btn exam-btn-secondary" style="font-size:0.8rem; padding:8px 15px;">+ Add Subject</button>
        </div>

        <div class="marks-summary-box">
          <div class="marks-summary-item">
            <p>Total Marks</p>
            <h4 id="marksGrandTotal">0</h4>
          </div>
          <div class="marks-summary-item">
            <p>Percentage</p>
            <h4 id="marksPercentage">0%</h4>
          </div>
          <div class="marks-summary-item">
            <p>Grade</p>
            <h4 id="marksGrade">-</h4>
          </div>
        </div>

        <div style="margin-top:30px; display:flex; justify-content:flex-end; gap:15px;">
          <button class="exam-btn exam-btn-secondary" onclick="document.getElementById('examMarksModal').remove()">Cancel</button>
          <button id="saveMarksBtn" class="exam-btn exam-btn-primary">Save Marks</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Attach row events
    const container = document.getElementById("marksSubjectContainer");
    
    window.calcExamTotals = function() {
      let grandTotal = 0;
      let maxTotal = 0;
      const rows = container.querySelectorAll(".marks-subject-row");
      rows.forEach((row, i) => {
        const th = parseFloat(row.querySelector(".sub-th").value) || 0;
        const pr = parseFloat(row.querySelector(".sub-pr").value) || 0;
        const maxMarks = parseFloat(row.querySelector(".sub-max")?.value) || 100;
        const total = th + pr;
        row.querySelector(".total-cell").textContent = total;
        grandTotal += total;
        maxTotal += maxMarks;
      });

      const percentage = maxTotal > 0 ? parseFloat(((grandTotal / maxTotal) * 100).toFixed(1)) : 0;
      let grade = 'F';
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      const defaultScale = [
        { min: 91, max: 100, grade: 'A+' }, { min: 81, max: 90, grade: 'A' },
        { min: 71, max: 80, grade: 'B+' }, { min: 61, max: 70, grade: 'B' },
        { min: 51, max: 60, grade: 'C' }, { min: 33, max: 50, grade: 'D' }, { min: 0, max: 32, grade: 'E' }
      ];
      let scale = defaultScale;
      if (store.settings) {
          const customScale = store.settings.find(s => s.key === "customGradingScale");
          if (customScale && customScale.value) {
              try { scale = JSON.parse(customScale.value); } catch(e){}
          }
      }
      scale.sort((a, b) => b.min - a.min);
      const matched = scale.find(g => percentage >= g.min);
      if (matched) grade = matched.grade;

      document.getElementById("marksGrandTotal").textContent = grandTotal + " / " + maxTotal;
      document.getElementById("marksPercentage").textContent = percentage + "%";
      document.getElementById("marksGrade").textContent = grade;
      return { grandTotal, percentage, grade };
    };

    container.addEventListener("input", window.calcExamTotals);

    document.getElementById("addSubjectBtn").onclick = () => {
      const idx = container.children.length;
      const row = document.createElement("div");
      row.className = "marks-subject-row";
      row.innerHTML = `
          <input type="text" class="sub-name" placeholder="Subject Name" />
          <input type="number" class="sub-max" value="100" placeholder="100" min="1" />
          <input type="number" class="sub-min" value="33" placeholder="33" min="0" />
          <input type="number" class="sub-th" placeholder="0" min="0" />
          <input type="number" class="sub-pr" placeholder="0" min="0" />
          <div class="total-cell">0</div>
          <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
      `;
      container.appendChild(row);
    };

    window.calcExamTotals(); // Init

    document.getElementById("saveMarksBtn").onclick = async () => {
      const rows = container.querySelectorAll(".marks-subject-row");
      const finalSubjects = [];
      rows.forEach(row => {
        const sub = row.querySelector(".sub-name").value.trim();
        if(!sub) return;
        finalSubjects.push({
          subject: sub,
          max: parseFloat(row.querySelector(".sub-max")?.value) || 100,
          min: parseFloat(row.querySelector(".sub-min")?.value) || 33,
          theory: parseFloat(row.querySelector(".sub-th").value) || 0,
          practical: parseFloat(row.querySelector(".sub-pr").value) || 0,
          total: parseFloat(row.querySelector(".total-cell").textContent) || 0
        });
      });

      const stats = window.calcExamTotals();
      
      const payload = {
        examName,
        className,
        session,
        studentName: student.fullName,
        rollNo: student.rollNo,
        admissionNo: student.admissionNo || '',
        studentPhoto: student.photo || '',
        subjectMarks: JSON.stringify(finalSubjects),
        totalMarks: stats.grandTotal.toString(),
        percentage: stats.percentage.toString(),
        grade: stats.grade,
        resultStatus: parseFloat(stats.percentage) >= 33 ? "PASS" : "FAIL"
      };

      try {
        const baseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : 'http://localhost:3000';
        const url = existingExam ? baseUrl + '/api/modules/exams/' + existingExam.id : baseUrl + '/api/modules/exams';
        const method = existingExam ? 'PUT' : 'POST';
        
        const resp = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if(resp.ok) {
          if (typeof showToast !== 'undefined') showToast("Marks saved successfully", "success");
          document.getElementById('examMarksModal').remove();
          // Reload local store and refresh table
          const dbResp = await fetch('http://localhost:3000/api/db');
          const dbData = await dbResp.json();
          localStorage.setItem('tps_db', JSON.stringify(dbData));
          loadStudentsForMarksEntry(className, examName, session);
        } else {
          alert("Failed to save marks");
        }
      } catch(err) {
        console.error(err);
        alert("Error saving marks");
      }
    };
  };

  // ==========================================
  // TAB 2: ADMIT CARDS
  // ==========================================
  function renderAdmitCards(container) {
    container.innerHTML = `
      <div style="margin-bottom: 25px;">
        <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Admit Card Generator</h4>
        <p style="margin:0; color: inherit; font-size:0.9rem;">Generate professional admit cards for examination.</p>
      </div>
      <div class="exam-form-grid" style="margin-bottom: 30px;">
        <div class="exam-field">
          <label>Select Class</label>
          <select id="admitClassSelect"></select>
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <input id="admitExamName" value="Annual Examination 2026-27" />
        </div>
          <div class="exam-field">
            <label>Template Style</label>
            <div style="display:flex; gap:10px;">
              <select id="admitTemplateStyle" style="flex:1; height: 46px;">${getOptions500()}</select>
              <button id="btnOpenAdmitDesigner" style="display:block; padding:0 15px; background:#10b981; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Edit Template</button>
            </div>
          </div>
        <div class="exam-field">
          <label>Primary Color</label>
          <input type="color" id="admitColor" value="#3b82f6" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
        </div>
        
          <div class="exam-field">
            <label>Font Style (100+ Options)</label>
            <select id="admitFont"><option value="'Times New Roman', serif">Times New Roman (Font 1)</option><option value="'Inter', sans-serif">Inter (Font 2)</option><option value="'Courier New', monospace">Courier New (Font 3)</option><option value="'Arial', sans-serif">Arial (Font 4)</option><option value="'Georgia', serif">Georgia (Font 5)</option><option value="'Verdana', sans-serif">Verdana (Font 6)</option><option value="'Trebuchet MS', sans-serif">Trebuchet MS (Font 7)</option><option value="'Comic Sans MS', cursive">Comic Sans MS (Font 8)</option><option value="'Impact', sans-serif">Impact (Font 9)</option><option value="'Palatino Linotype', serif">Palatino Linotype (Font 10)</option><option value="'Tahoma', sans-serif">Tahoma (Font 11)</option><option value="'Lucida Console', monospace">Lucida Console (Font 12)</option><option value="'Garamond', serif">Garamond (Font 13)</option><option value="'Bookman Old Style', serif">Bookman Old Style (Font 14)</option><option value="'Arial Black', sans-serif">Arial Black (Font 15)</option><option value="'Arial Narrow', sans-serif">Arial Narrow (Font 16)</option><option value="'Century Gothic', sans-serif">Century Gothic (Font 17)</option><option value="'Copperplate', fantasy">Copperplate (Font 18)</option><option value="'Papyrus', fantasy">Papyrus (Font 19)</option><option value="'Brush Script MT', cursive">Brush Script MT (Font 20)</option><option value="'Baskerville', serif">Baskerville (Font 21)</option><option value="'Consolas', monospace">Consolas (Font 22)</option><option value="'Franklin Gothic Medium', sans-serif">Franklin Gothic Medium (Font 23)</option><option value="'Gill Sans', sans-serif">Gill Sans (Font 24)</option><option value="'Helvetica', sans-serif">Helvetica (Font 25)</option><option value="'Optima', sans-serif">Optima (Font 26)</option><option value="'Segoe UI', sans-serif">Segoe UI (Font 27)</option><option value="'Monaco', monospace">Monaco (Font 28)</option><option value="'Didot', serif">Didot (Font 29)</option><option value="'American Typewriter', serif">American Typewriter (Font 30)</option><option value="'Andale Mono', monospace">Andale Mono (Font 31)</option><option value="'Avant Garde', sans-serif">Avant Garde (Font 32)</option><option value="'Calibri', sans-serif">Calibri (Font 33)</option><option value="'Cambria', serif">Cambria (Font 34)</option><option value="'Candara', sans-serif">Candara (Font 35)</option><option value="'Constantia', serif">Constantia (Font 36)</option><option value="'Corbel', sans-serif">Corbel (Font 37)</option><option value="'Rockwell', serif">Rockwell (Font 38)</option><option value="'Futura', sans-serif">Futura (Font 39)</option><option value="'Geneva', sans-serif">Geneva (Font 40)</option><option value="'Hoefler Text', serif">Hoefler Text (Font 41)</option><option value="'Lucida Grande', sans-serif">Lucida Grande (Font 42)</option><option value="'Perpetua', serif">Perpetua (Font 43)</option><option value="system-ui">system-ui (Font 44)</option><option value="-apple-system">-apple-system (Font 45)</option><option value="BlinkMacSystemFont">BlinkMacSystemFont (Font 46)</option><option value="Roboto">Roboto (Font 47)</option><option value="Oxygen">Oxygen (Font 48)</option><option value="Ubuntu">Ubuntu (Font 49)</option><option value="Cantarell">Cantarell (Font 50)</option><option value="'Fira Sans'">Fira Sans (Font 51)</option><option value="'Droid Sans'">Droid Sans (Font 52)</option><option value="'Helvetica Neue'">Helvetica Neue (Font 53)</option><option value="sans-serif">sans-serif (Font 54)</option><option value="serif">serif (Font 55)</option><option value="monospace">monospace (Font 56)</option><option value="fantasy">fantasy (Font 57)</option><option value="cursive">cursive (Font 58)</option><option value="'Brush Script Std'">Brush Script Std (Font 59)</option><option value="'Luminari'">Luminari (Font 60)</option><option value="'Chalkduster'">Chalkduster (Font 61)</option><option value="'Jazz LET'">Jazz LET (Font 62)</option><option value="'Blippo'">Blippo (Font 63)</option><option value="'Stencil Std'">Stencil Std (Font 64)</option><option value="'Marker Felt'">Marker Felt (Font 65)</option><option value="'Trattatello'">Trattatello (Font 66)</option><option value="'Bodoni MT'">Bodoni MT (Font 67)</option><option value="'Calisto MT'">Calisto MT (Font 68)</option><option value="'Elephant'">Elephant (Font 69)</option><option value="'Goudy Old Style'">Goudy Old Style (Font 70)</option><option value="'Lucida Bright'">Lucida Bright (Font 71)</option><option value="'Perpetua Titling MT'">Perpetua Titling MT (Font 72)</option><option value="'Baskerville Old Face'">Baskerville Old Face (Font 73)</option><option value="'Century Schoolbook'">Century Schoolbook (Font 74)</option><option value="'Footlight MT Light'">Footlight MT Light (Font 75)</option><option value="'Harrington'">Harrington (Font 76)</option><option value="'High Tower Text'">High Tower Text (Font 77)</option><option value="'Jokerman'">Jokerman (Font 78)</option><option value="'Juice ITC'">Juice ITC (Font 79)</option><option value="'Kristen ITC'">Kristen ITC (Font 80)</option><option value="'Magneto'">Magneto (Font 81)</option><option value="'Matura MT Script Capitals'">Matura MT Script Capitals (Font 82)</option><option value="'Mistral'">Mistral (Font 83)</option><option value="'Niagara Engraved'">Niagara Engraved (Font 84)</option><option value="'Old English Text MT'">Old English Text MT (Font 85)</option><option value="'Onyx'">Onyx (Font 86)</option><option value="'Parchment'">Parchment (Font 87)</option><option value="'Playbill'">Playbill (Font 88)</option><option value="'Poor Richard'">Poor Richard (Font 89)</option><option value="'Ravie'">Ravie (Font 90)</option><option value="'Showcard Gothic'">Showcard Gothic (Font 91)</option><option value="'Snap ITC'">Snap ITC (Font 92)</option><option value="'Viner Hand ITC'">Viner Hand ITC (Font 93)</option><option value="'Vivaldi'">Vivaldi (Font 94)</option><option value="'Vladimir Script'">Vladimir Script (Font 95)</option><option value="'Wide Latin'">Wide Latin (Font 96)</option><option value="'Algerian'">Algerian (Font 97)</option><option value="'Bauhaus 93'">Bauhaus 93 (Font 98)</option><option value="'Bell MT'">Bell MT (Font 99)</option><option value="'Bernard MT Condensed'">Bernard MT Condensed (Font 100)</option></select>
          </div>
          <div class="exam-field">
            <label>Text Color</label>
            <input type="color" id="admitFontColor" value="#000000" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Bg Type</label>
            <select id="admitBgType">
              <option value="solid">Solid Color</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>
          <div class="exam-field">
            <label>Background / Gradient 1</label>
            <input type="color" id="admitBgColor" value="#ffffff" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Gradient 2</label>
            <input type="color" id="admitBgColor2" value="#f1f5f9" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Bg Opacity</label>
            <input type="range" id="admitBgOpacity" min="0" max="1" step="0.05" value="1" style="height: 46px;" />
          </div>
          <div class="exam-field">
            <label>Bg Image</label>
            <select id="admitBgImage">
              <option value="none">None</option>
              <option value="bg_1.png">1. Premium Gold Border</option>
              <option value="bg_2.png">2. Modern Geometric Watermark</option>
              <option value="bg_3.png">3. Vibrant Abstract Waves</option>
              <option value="bg_4.png">4. Academic University</option>
            </select>
          </div>
          <div class="exam-field">
            <label>Border Style</label>
          <select id="admitBorder">
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="double">Double</option>
            <option value="none">None</option>
          </select>
        </div>
        <div class="exam-field">
          <button id="admitGenerateBtn" class="exam-btn exam-btn-primary" style="width:100%;">Generate</button>
        </div>
      </div>
      <div id="admitPrintActions" style="margin-bottom: 20px; display:none; gap:15px; justify-content:flex-end;">
        <button id="admitPrintBtn" class="exam-btn exam-btn-secondary">🖨️ Print Admit Cards</button>
      </div>
      <div id="admitPreviewContainer" contenteditable="true" style="outline:none; background:#e2e8f0; padding:40px 20px; border-radius:12px; min-height:300px; display:flex; flex-direction:column; align-items:center; gap:30px;">
         <div class="empty-state">
           <i>📄</i>
           <h4>Ready to generate</h4>
           <p>Select a class and click Generate to view preview.</p>
         </div>
      </div>
    `;

    populateClassSelect("admitClassSelect");

    document.getElementById("admitGenerateBtn").onclick = () => {
      const cls = document.getElementById("admitClassSelect").value;
      const examName = document.getElementById("admitExamName").value;
      const style = document.getElementById("admitTemplateStyle").value;
      const config = {
          color: document.getElementById("admitColor").value,
          font: document.getElementById("admitFont").value,
          border: document.getElementById("admitBorder").value,
          bgColor: document.getElementById("admitBgColor").value,
          bgColor2: document.getElementById("admitBgColor2").value,
          bgType: document.getElementById("admitBgType").value,
          fontColor: document.getElementById("admitFontColor").value,
          bgOpacity: document.getElementById("admitBgOpacity").value,
          bgImage: document.getElementById("admitBgImage").value
        };
      if(!cls) return window.showToast ? showToast("Please select a class", "warning") : alert("Select Class");
      generateAdmitCards(cls, examName, style, config);
    };

    document.getElementById("admitPrintBtn").onclick = () => {
      const container = document.getElementById("admitPreviewContainer");
      const editables = container.querySelectorAll('[contenteditable="true"]');
      editables.forEach(el => el.setAttribute("contenteditable", "false"));
      const wasEditable = container.getAttribute("contenteditable") === "true";
      if (wasEditable) container.setAttribute("contenteditable", "false");
      
      const originalParent = container.parentNode;
      const originalNextSibling = container.nextSibling;
      const hiddenElements = [];
      Array.from(document.body.children).forEach(child => {
        if (child.style && child.style.display !== 'none') {
          hiddenElements.push({ el: child, display: child.style.display });
          child.style.display = 'none';
        }
      });
      
      document.body.appendChild(container);
      container.style.display = 'block';
      
      window.print();
      
      hiddenElements.forEach(item => item.el.style.display = item.display);
      if (originalNextSibling) originalParent.insertBefore(container, originalNextSibling);
      else originalParent.appendChild(container);
      
      if (wasEditable) container.setAttribute("contenteditable", "true");
      editables.forEach(el => el.setAttribute("contenteditable", "true"));
    };
  }

  function generateAdmitCards(className, examName, requestedStyle, config) {
    const container = document.getElementById("admitPreviewContainer");
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const students = (store.students || []).filter(s => s.className === className && s.status !== "Left");
    
    if(students.length === 0) {
      container.innerHTML = `<div class="empty-state"><h4>No active students found in ${className}.</h4></div>`;
      document.getElementById("admitPrintActions").style.display = "none";
      return;
    }

    let style = requestedStyle;

    let html = ``;
      for (let i = 0; i < students.length; i += 2) {
          html += `<div style="width: 210mm; height: 297mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; padding: 10mm; box-sizing: border-box; background: white; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.1);">`;
          for (let j = 0; j < 2; j++) {
              if (i + j < students.length) {
                  const student = students[i + j];
                  let cardHtml = '';
                  if (style === 'custom_blank') cardHtml = getCustomAdmitCardHtml(student, examName, config);
                  else if (style.startsWith('dyn_')) cardHtml = generateDynamicAdmitCard(student, examName, style, config);
                  else if (style === 'primary') cardHtml = getPrimaryAdmitCardHtml(student, examName, config);
                  else if (style === 'state') cardHtml = getMiddleAdmitCardHtml(student, examName, config);
                  else cardHtml = getHighSchoolAdmitCardHtml(student, examName, config);
                  
                  const bgStyle = config.bgImage !== 'none' ? `background-image: url('${config.bgImage}'); background-size: cover; background-position: center;` : (config.bgType === 'gradient' ? `background: linear-gradient(135deg, ${config.bgColor}, ${config.bgColor2});` : `background-color: ${config.bgColor};`);
                  const fontColorStyle = config.fontColor ? `color: ${config.fontColor} !important;` : '';
                    
                  // Inject bg into the card itself to prevent bleeding
                  cardHtml = cardHtml.replace('background: transparent;', bgStyle);
                  const overlayHtml = `<div style="position: absolute; inset: 0; background: rgba(255,255,255,${1 - config.bgOpacity}); pointer-events: none; z-index: 0; border-radius: inherit;"></div><div style="position: relative; z-index: 1;">`;
                  cardHtml = cardHtml.replace('">', `">${overlayHtml}`) + '</div>';

                  html += `<div style="height: 130mm; position: relative; display: flex; align-items: center; justify-content: center; padding: 10mm 0; box-sizing: border-box;">
                               <div style="transform: scale(0.95); transform-origin: center center;">${cardHtml}</div>
                           </div>`;
              } else {
                  html += `<div style="height: 130mm;"></div>`; 
              }
          }
          html += `</div>`;
      }

    container.innerHTML = html;
    document.getElementById("admitPrintActions").style.display = "flex";
  }


  // --- 500 DYNAMIC LAYOUTS ENGINE ---
  const DEFAULT_SCHOOL_LOGO = 'school_logo.png';
  
  function getOptions500(prefix) {
      let opts = '<option value="custom_blank">Blank A4 (Design Your Own)</option><option value="detailed_graph">Detailed Graph (Watermark & Chart)</option><option value="primary">Primary Format (Colorful)</option><option value="cbse">CBSE Format Layout</option><option value="state">State Board Layout</option><option value="tho">Talent Hunt Olympiad (THO)</option>';
      for(let i=1; i<=500; i++) {
          opts += `<option value="dyn_${i}">Premium Theme ${i}</option>`;
      }
      return opts;
  }

  function parseDynamicTheme(themeId) {
      const num = parseInt(themeId.replace('dyn_', '')) || 1;
      
      // Determine structural variations based on modulo math against the theme ID
      const headerAlign = ['center', 'left', 'right', 'split'][num % 4];
      const tableStyle = ['striped', 'minimal', 'bordered', 'boxed', 'rounded'][num % 5];
      const bgTexture = ['none', 'watermark', 'gradient', 'dots', 'lines'][num % 5];
      const footerStyle = ['side', 'stacked', 'boxed'][num % 3];
      
      return { num, headerAlign, tableStyle, bgTexture, footerStyle };
  }

  function getDynamicStyles(t, c) {
      let bgCss = '#fff';
      if(t.bgTexture === 'gradient') bgCss = `linear-gradient(135deg, #fff 0%, ${c.color}11 100%)`;
      else if(t.bgTexture === 'dots') bgCss = `#fff radial-gradient(${c.color}33 1px, transparent 1px) 0 0 / 20px 20px`;
      else if(t.bgTexture === 'lines') bgCss = `#fff repeating-linear-gradient(45deg, ${c.color}11, ${c.color}11 10px, transparent 10px, transparent 20px)`;
      
      let tableBorder = t.tableStyle === 'bordered' ? `1px solid ${c.color}` : '1px solid #e2e8f0';
      if(t.tableStyle === 'minimal') tableBorder = 'none';
      
      let tableHeaderBg = `${c.color}`;
      let tableHeaderColor = '#fff';
      if(t.tableStyle === 'boxed') {
          tableHeaderBg = '#f1f5f9';
          tableHeaderColor = `${c.color}`;
      }
      
      return { bgCss, tableBorder, tableHeaderBg, tableHeaderColor };
  }

  function generateDynamicAdmitCard(student, examName, themeId, config) {
      const c = config || { color: '#3b82f6', font: "'Inter', sans-serif", border: 'solid' };
      const t = parseDynamicTheme(themeId);
      const s = getDynamicStyles(t, c);
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
      
      const borderCss = c.border === 'none' ? 'none' : `${c.border === 'double' ? 6 : 2}px ${c.border} ${c.color}`;
      const photoUrl = student.photo || DEFAULT_SCHOOL_LOGO;
      const admNo = student.admissionNo || '-';
      
      let headerHtml = '';
      if(t.headerAlign === 'center') {
          headerHtml = `<div style="text-align:center; padding-bottom: 15px; border-bottom: 2px solid ${c.color};">
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px;" />
              <h1 style="margin:0; font-size:24px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
              <div style="background: ${c.color}; color: ${c.fontColor || '#fff'}; display:inline-block; padding:3px 15px; border-radius:20px; font-weight:bold; margin-top:8px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
          </div>`;
      } else if (t.headerAlign === 'left') {
          headerHtml = `<div style="display:flex; align-items:center; gap: 15px; padding-bottom: 15px; border-bottom: 2px solid ${c.color};">
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 70px; height: 70px;" />
              <div>
                  <h1 style="margin:0; font-size:22px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
                  <div style="font-weight:bold; color: inherit; margin-top:4px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
              </div>
          </div>`;
      } else {
          headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; padding-bottom: 15px; border-bottom: 2px solid ${c.color}; background:${c.color}11; padding: 15px; border-radius: 8px;">
              <div>
                  <h1 style="margin:0; font-size:20px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
                  <div style="font-weight:bold; margin-top:4px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
              </div>
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px;" />
          </div>`;
      }
      
      let footerHtml = '';
      if(t.footerStyle === 'side') {
          footerHtml = `<div style="margin-top: 30px; display:flex; justify-content:space-between; align-items:flex-end;">
              <div style="text-align:center; width:140px;"><div style="border-bottom:1px solid #000; height:30px;"></div><p style="margin:5px 0 0 0; font-size:12px; font-weight:bold;">Class Teacher</p></div>
              <div style="text-align:center; width:140px;"><div style="border-bottom:1px solid #000; height:30px;"></div><p style="margin:5px 0 0 0; font-size:12px; font-weight:bold;">Principal</p></div>
          </div>`;
      } else {
          footerHtml = `<div style="margin-top: 30px; display:flex; gap: 20px;">
              <div style="flex:1; border: 1px dashed ${c.color}; padding: 15px; text-align:center; border-radius: 8px;">
                  <div style="height:40px;"></div><p style="margin:0; font-size:12px; font-weight:bold;">Class Teacher</p>
              </div>
              <div style="flex:1; border: 1px dashed ${c.color}; padding: 15px; text-align:center; border-radius: 8px;">
                  <div style="height:40px;"></div><p style="margin:0; font-size:12px; font-weight:bold;">Principal</p>
              </div>
          </div>`;
      }

      return `
        <div style="width: 180mm; background: transparent; color: inherit; ${fontColorStyle} border: ${borderCss}; font-family: ${c.font}; border-radius: ${t.tableStyle==='rounded'?15:0}px; padding: 20px; position: relative; overflow: hidden; page-break-inside: avoid; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
           ${t.bgTexture === 'watermark' ? `<img src="${DEFAULT_SCHOOL_LOGO}" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.05; width:300px; height:300px; z-index:0;" />` : ''}
           <div style="position:relative; z-index:1;">
               ${headerHtml}
               <div style="display: flex; gap: 20px; margin-top:20px;">
                   <div style="flex: 1;">
                       <table style="width:100%; border-collapse:collapse; font-size: 15px; font-weight:600;">
                           <tr><td style="padding:10px; border-bottom:${s.tableBorder};">Student Name:</td><td style="padding:10px; border-bottom:${s.tableBorder}; color:${c.color}; font-weight:800;" contenteditable="true">${student.fullName}</td></tr>
                           <tr><td style="padding:10px; border-bottom:${s.tableBorder};">Father's Name:</td><td style="padding:10px; border-bottom:${s.tableBorder};" contenteditable="true">${student.fatherName || '-'}</td></tr>
                           <tr><td style="padding:10px; border-bottom:${s.tableBorder};">Class & Sec:</td><td style="padding:10px; border-bottom:${s.tableBorder};" contenteditable="true">${student.className}</td></tr>
                           <tr><td style="padding:10px; border-bottom:${s.tableBorder};">Roll No:</td><td style="padding:10px; border-bottom:${s.tableBorder}; font-size:18px; font-weight:800;" contenteditable="true">${student.rollNo || '-'}</td></tr>
                           <tr><td style="padding:10px; border-bottom:${s.tableBorder};">Admission No:</td><td style="padding:10px; border-bottom:${s.tableBorder};" contenteditable="true">${admNo}</td></tr>
                       </table>
                   </div>
                   <div style="width: 120px; text-align:center;">
                       <img src="${photoUrl}" style="width: 110px; height: 130px; object-fit: cover; border: 3px solid ${c.color}; border-radius: ${t.tableStyle==='rounded'?12:0}px;" />
                   </div>
               </div>
               ${footerHtml}
               <div style="margin-top: 15px; text-align:center; font-size: 10px; color: inherit;">Theme ID: ${t.num} • Tapowan Public School System</div>
           </div>
        </div>`;
  }

  function generateDynamicMarksheet(exam, themeId, config) {
      const c = config || { color: '#0f172a', font: "'Inter', sans-serif", border: 'solid' };
      const t = parseDynamicTheme(themeId);
      const s = getDynamicStyles(t, c);
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
      
      const borderCss = c.border === 'none' ? 'none' : `${c.border === 'double' ? 8 : 3}px ${c.border} ${c.color}`;
      const photoUrl = exam.studentPhoto || DEFAULT_SCHOOL_LOGO;
      const admNo = exam.admissionNo || '-';
      
      let subjectRows = '';
      let subs = [];
      try { subs = JSON.parse(exam.subjectMarks); } catch(e) {}
      
      subs.forEach((sub, i) => {
          const rowBg = (t.tableStyle === 'striped' && i%2!==0) ? `${c.color}11` : 'transparent';
          subjectRows += `<tr style="background:${rowBg};">
              <td style="padding:12px; border:${s.tableBorder}; font-weight:bold;" contenteditable="true">${sub.subject}</td>
              <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${sub.max || 100}</td>
              <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${sub.min !== undefined ? sub.min : 33}</td>
              <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${sub.theory || 0}</td>
              <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${sub.practical || 0}</td>
              <td style="padding:12px; border:${s.tableBorder}; text-align:center; font-weight:bold; color:${c.color};" contenteditable="true">${sub.total || 0}</td>
          </tr>`;
      });

      let headerHtml = '';
      if(t.headerAlign === 'center') {
          headerHtml = `<div style="text-align:center; padding-bottom: 20px; border-bottom: 3px solid ${c.color}; margin-bottom: 25px;">
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 80px; height: 80px; margin-bottom: 10px;" />
              <h1 style="margin:0; font-size:32px; font-weight:900; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
              <div style="background: ${c.color}; color: ${c.fontColor || '#fff'}; display:inline-block; padding:6px 20px; border-radius:4px; font-weight:bold; margin-top:12px; font-size:16px;">PROGRESS REPORT - <span contenteditable="true">${exam.examName}</span></div>
          </div>`;
      } else {
          headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; padding: 20px; border: 2px solid ${c.color}; border-radius: 12px; margin-bottom: 25px; background: ${c.color}05;">
              <div style="display:flex; align-items:center; gap:20px;">
                  <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 80px; height: 80px;" />
                  <div>
                      <h1 style="margin:0; font-size:28px; font-weight:900; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
                      <div style="font-size:18px; font-weight:bold; color: inherit; margin-top:5px;">PROGRESS REPORT - <span contenteditable="true">${exam.examName}</span></div>
                  </div>
              </div>
          </div>`;
      }

      return `
      <div style="width: 190mm; min-height: 250mm; box-sizing: border-box; page-break-inside: avoid; color: inherit; ${fontColorStyle} border: ${borderCss}; padding: 30px; font-family: ${c.font}; position: relative; background: transparent; border-radius: ${t.tableStyle==='rounded'?20:0}px;">
          ${t.bgTexture === 'watermark' ? `<img src="${DEFAULT_SCHOOL_LOGO}" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); opacity:0.05; width:400px; height:400px; z-index:0;" />` : ''}
          <div style="position:relative; z-index:1;">
              ${headerHtml}
              <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 25px; padding: 15px; border: 1px solid #cbd5e1; border-radius: 8px; background: transparent;">
                  <table style="width:65%; font-size: 15px; line-height:1.8; font-weight: 600;">
                      <tr><td style="width: 140px;">Student Name:</td><td contenteditable="true" style="color: ${c.color}; font-size: 18px; font-weight: 800; border-bottom: 1px dotted #ccc;">${exam.studentName}</td></tr>
                      <tr><td>Class & Section:</td><td contenteditable="true" style="border-bottom: 1px dotted #ccc;">${exam.className}</td></tr>
                      <tr><td>Roll No:</td><td contenteditable="true" style="border-bottom: 1px dotted #ccc;">${exam.rollNo}</td></tr>
                      <tr><td>Admission No:</td><td contenteditable="true" style="border-bottom: 1px dotted #ccc;">${admNo}</td></tr>
                  </table>
                  <div style="width: 120px; height: 140px; border: 3px solid ${c.color}; border-radius: 8px; overflow:hidden;">
                      <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" />
                  </div>
              </div>
              <table style="width:100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; background: transparent;">
                  <thead>
                      <tr style="background: ${s.tableHeaderBg}; color: ${s.tableHeaderColor};">
                          <th style="padding:12px; border:${s.tableBorder}; text-align:left;">SUBJECT</th>
                          <th style="padding:12px; border:${s.tableBorder}; text-align:center;">MAX</th>
                          <th style="padding:12px; border:${s.tableBorder}; text-align:center;">MIN</th>
                          <th style="padding:12px; border:${s.tableBorder}; text-align:center;">TH</th>
                          <th style="padding:12px; border:${s.tableBorder}; text-align:center;">PR</th>
                          <th style="padding:12px; border:${s.tableBorder}; text-align:center;">TOTAL</th>
                      </tr>
                  </thead>
                  <tbody>${subjectRows}</tbody>
              </table>
              <div style="display: flex; gap: 15px; text-align:center;">
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: transparent;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">GRAND TOTAL</div>
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.totalMarks}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: transparent;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.percentage}%</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: transparent;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.grade}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: ${exam.resultStatus === 'PASS' ? '#dcfce7' : '#fee2e2'};">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">RESULT</div>
                      <div style="font-size: 24px; font-weight:900; color: ${exam.resultStatus === 'PASS' ? '#16a34a' : '#dc2626'};" contenteditable="true">${exam.resultStatus}</div>
                  </div>
              </div>
              <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px;">
                  <div style="text-align:center; width: 150px;">
                      <div style="border-bottom: 1px solid #0f172a; height: 30px;"></div>
                      <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: bold;">Class Teacher</p>
                  </div>
                  <div style="text-align:center; width: 150px;">
                      <div style="border-bottom: 1px solid #0f172a; height: 30px;"></div>
                      <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: bold;">Principal</p>
                  </div>
              </div>
              <div style="margin-top: 20px; text-align:center; font-size: 10px; color: inherit;">Theme ID: ${t.num} • System Generated</div>
          </div>
      </div>`;
  }
  
  // --- Custom Admit Card Template Engine ---
  function getCustomAdmitCardHtml(student, examName, config) {
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      
      let template = "<div style='text-align:center;'><h1>{schoolName}</h1><h2>ADMIT CARD - {examName}</h2></div><p>Name: <b>{studentName}</b></p>";
      if (store.settings) {
          const setting = store.settings.find(s => s.key === "customAdmitTemplate");
          if (setting) template = setting.value;
      }
      if (store.customAdmitTemplate) template = store.customAdmitTemplate; // Session fallback
      
      // Parse Variables
      template = template.replace(/{studentName}/g, student.fullName || '-');
      template = template.replace(/{className}/g, student.className || '-');
      template = template.replace(/{rollNo}/g, student.rollNo || '-');
      template = template.replace(/{admissionNo}/g, student.admissionNo || '-');
      template = template.replace(/{fatherName}/g, student.fatherName || student.parentName || '-');
      template = template.replace(/{motherName}/g, student.motherName || '-');
      template = template.replace(/{examName}/g, examName || '-');
      
      const schoolName = store.schoolProfile ? store.schoolProfile.schoolName : "Tapowan Public School";
      template = template.replace(/{schoolName}/g, schoolName);
      
      const photoUrl = student.photo || DEFAULT_SCHOOL_LOGO;
      template = template.replace(/src="\{studentPhoto\}"/g, `src="${photoUrl}"`);
      template = template.replace(/\{studentPhoto\}/g, `<img src="${photoUrl}" style="width:100px; height:120px; object-fit:cover; border:1px solid #000;" />`);
      
      // Apply Global Configs on the Wrapper
      const c = config || { color: '#3b82f6', font: "'Inter', sans-serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `2px ${c.border} ${c.color}`;
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor};` : '';
      const bgStyle = c.bgImage !== 'none' ? `background-image: url('${c.bgImage}'); background-size: cover; background-position: center;` : (c.bgType === 'gradient' ? `background: linear-gradient(135deg, ${c.bgColor}, ${c.bgColor2});` : `background-color: ${c.bgColor};`);

      return `
      <div style="width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; font-family: ${c.font}; ${fontColorStyle} border: ${borderCss}; ${bgStyle} position: relative; overflow: hidden; page-break-inside: avoid;">
          ${template}
      </div>`;
  }

  // --- Admit Card Templates ---
  function getPrimaryAdmitCardHtml(student, examName, config) {
      const c = config || { color: '#3b82f6', font: "'Inter', sans-serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `4px ${c.border} ${c.color}`;
      const photoUrl = student.photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 180mm; background: transparent; border: ${borderCss}; font-family: ${c.font}; border-radius: 20px; padding: 20px; position: relative; overflow: hidden; page-break-inside: avoid; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
           <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: ${c.color}33; border-radius: 50%; opacity: 0.5;"></div>
           <div style="display:flex; align-items:center; justify-content:center; border-bottom: 2px dashed ${c.color}; padding-bottom: 15px; margin-bottom: 20px;">
               <div style="text-align:center;">
                   <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px; display:inline-block;" /><br/>\n                    <h2 style="margin:0; color: ${c.color}; font-size: 26px; font-weight: 800; text-transform: uppercase; display:inline-block;">Tapowan Public School</h2>
                   <div style="display:inline-block; background: #ef4444; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin-top: 10px; font-size: 14px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
               </div>
           </div>
           <div style="display: flex; gap: 20px;">
               <div style="flex: 1;">
                   <table style="width:100%; border-collapse:collapse; font-size: 16px; color: inherit; font-weight:600;">
                       <tr><td style="padding: 8px;">Student Name:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: ${c.color}; font-weight:800;" contenteditable="true">${student.fullName}</td></tr>
                       <tr><td style="padding: 8px;">Father's Name:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${student.fatherName || '-'}</td></tr>
                       <tr><td style="padding: 8px;">Class & Sec:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${student.className}</td></tr>
                       <tr><td style="padding: 8px;">Roll No:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: inherit; font-size: 18px; font-weight: 800;" contenteditable="true">${student.rollNo || '-'}</td></tr>
                       <tr><td style="padding: 8px;">Admission No:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${admNo}</td></tr>
                   </table>
               </div>
               <div style="width: 120px; text-align:center;">
                   <img src="${photoUrl}" style="width: 110px; height: 130px; object-fit: cover; border: 3px solid ${c.color}; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />
               </div>
           </div>
           <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px;">
               <div style="text-align:center; width: 150px;">
                   <div style="border-bottom: 2px solid #1e293b; height: 40px;"></div>
                   <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 700;">Class Teacher</p>
               </div>
               <div style="text-align:center; width: 150px;">
                   <div style="border-bottom: 2px solid #1e293b; height: 40px;"></div>
                   <p style="margin: 8px 0 0 0; font-size: 14px; font-weight: 700;">Principal</p>
               </div>
           </div>
        </div>`;
  }

  function getMiddleAdmitCardHtml(student, examName, config) {
      const c = config || { color: '#0f172a', font: "'Times New Roman', serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `2px ${c.border} ${c.color}`;
      const photoUrl = student.photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 180mm; border: ${borderCss}; font-family: ${c.font}; padding: 20px; background: transparent; page-break-inside: avoid; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <div style="text-align:center; border-bottom: 2px solid ${c.color}; padding-bottom: 15px; margin-bottom: 20px;">
                <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px; display:inline-block;" /><br/>\n                 <h2 style="margin:0; color: ${c.color}; font-size: 24px; font-family: serif; text-transform: uppercase; display:inline-block;">Tapowan Public School</h2>
                <h3 style="margin:10px 0 0 0; color: inherit; font-size: 18px; text-decoration: underline;">ADMIT CARD - <span contenteditable="true">${examName}</span></h3>
            </div>
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <table style="width:100%; border-collapse:collapse; font-size: 15px; color: inherit; ">
                        <tr><td style="padding: 10px; font-weight:700; width: 150px;">Candidate Name:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b; font-weight: bold; text-transform: uppercase;" contenteditable="true">${student.fullName}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Father's Name:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${student.fatherName || '-'}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Class / Section:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${student.className}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Roll Number:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b; font-weight: bold;" contenteditable="true">${student.rollNo || '-'}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Admission No:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${admNo}</td></tr>
                    </table>
                </div>
                <div style="width: 120px; text-align:center;">
                    <img src="${photoUrl}" style="width: 110px; height: 135px; object-fit: cover; border: 1px solid #1e293b;" />
                </div>
            </div>
            <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px;">
                <div style="text-align:center; width: 160px;">
                    <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">Exam Controller</p>
                </div>
                <div style="text-align:center; width: 160px;">
                    <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">Principal</p>
                </div>
            </div>
        </div>`;
  }

  function getHighSchoolAdmitCardHtml(student, examName, config) {
      const c = config || { color: '#000000', font: "'Times New Roman', serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `2px ${c.border} ${c.color}`;
      const photoUrl = student.photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 180mm; border: ${borderCss}; font-family: ${c.font}; padding: 15px; background: transparent; page-break-inside: avoid; font-family: 'Times New Roman', Times, serif; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <div style="border: 1px solid ${c.color}; padding: 15px; position: relative;">
                <div style="text-align:center; border-bottom: 2px solid ${c.color}; padding-bottom: 10px; margin-bottom: 15px;">
                    <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px; display:inline-block;" /><br/>\n                     <h1 style="margin:0; color: inherit; font-size: 26px; text-transform: uppercase; display:inline-block;">Tapowan Public School</h1>
                    <div style="margin-top:10px; display:inline-block; background: ${c.color}; color: ${c.fontColor || '#fff'}; padding:5px 20px; font-weight:bold; font-size:16px;">
                        ADMIT CARD - ${examName.toUpperCase()}
                    </div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <div style="flex: 1;">
                        <table style="width:100%; border-collapse:collapse; font-size: 15px; color: inherit; ">
                            <tr><td style="padding: 6px; font-weight:bold; width: 160px;">Roll No.</td><td style="padding: 6px;">: <span style="font-weight:bold; font-size:18px;">${student.rollNo || '-'}</span></td></tr>
                            <tr><td style="padding: 6px; font-weight:bold;">Admission No.</td><td style="padding: 6px;">: ${admNo}</td></tr>
                            <tr><td style="padding: 6px; font-weight:bold;">Candidate's Name</td><td style="padding: 6px;">: <span style="text-transform:uppercase; font-weight:bold;">${student.fullName}</span></td></tr>
                            <tr><td style="padding: 6px; font-weight:bold;">Father's Name</td><td style="padding: 6px;">: ${student.fatherName || '-'}</td></tr>
                            <tr><td style="padding: 6px; font-weight:bold;">Class</td><td style="padding: 6px;">: ${student.className}</td></tr>
                        </table>
                    </div>
                    <div style="width: 120px; text-align:center;">
                        <img src="${photoUrl}" style="width: 110px; height: 135px; object-fit: cover; border: 1px solid ${c.color};" />
                    </div>
                </div>
                <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align:center; width: 160px;">
                        <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: bold;">Signature of Class Teacher</p>
                    </div>
                    <div style="text-align:center; width: 160px;">
                        <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: bold;">Signature of Principal</p>
                    </div>
                </div>
            </div>
        </div>`;
  }
  
  function getCustomResultHtml(exam, theme, config) {
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      
      let template = "<div style='text-align:center;'><h1>{schoolName}</h1><h2>MARKSHEET - {examName}</h2></div><p>Name: <b>{studentName}</b></p><br>{marksTable}";
      if (store.settings) {
          const setting = store.settings.find(s => s.key === "customResultTemplate");
          if (setting) template = setting.value;
      }
      if (store.customResultTemplate) template = store.customResultTemplate; // Session fallback
      
      // Smart Row Duplication for customized standard templates
      // If the user loaded a standard template into the designer, it will have a row with {subject}
      const rowMatch = template.match(/<tr[^>]*>[\s\S]*?{subject}[\s\S]*?<\/tr>/i);
      if (rowMatch) {
          const rowTemplate = rowMatch[0];
          let generatedRows = '';
          (exam.subjectMarks || []).forEach(m => {
              let row = rowTemplate;
              row = row.replace(/{subject}/g, m.subject || '');
              row = row.replace(/{max}/g, m.max || '');
              row = row.replace(/{min}/g, m.min || '');
              row = row.replace(/{theory}/g, m.theory || '');
              row = row.replace(/{prac}/g, m.prac || '');
              row = row.replace(/{total}/g, m.total || '');
              generatedRows += row;
          });
          template = template.replace(rowMatch[0], generatedRows);
      } else {
          // Fallback: If no {subject} row found, use the standard {marksTable} replacement
          let marksRows = '';
          (exam.subjectMarks || []).forEach(m => {
              marksRows += `<tr>
                  <td style="border:1px solid #000; padding:5px;">${m.subject}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center;">${m.max}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center;">${m.min}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center;">${m.theory}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center;">${m.prac}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center; font-weight:bold;">${m.total}</td>
                  <td style="border:1px solid #000; padding:5px; text-align:center;">${m.grade}</td>
              </tr>`;
          });
          const marksTable = `
              <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                  <thead>
                      <tr style="background:#f1f5f9;">
                          <th style="border:1px solid #000; padding:8px; text-align:left;">SUBJECT</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">MAX</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">MIN</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">TH</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">PRAC</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">TOTAL</th>
                          <th style="border:1px solid #000; padding:8px; text-align:center;">GRADE</th>
                      </tr>
                  </thead>
                  <tbody>${marksRows}</tbody>
              </table>
          `;
          template = template.replace(/{marksTable}/g, marksTable);
      }
      
      // Parse Variables
      template = template.replace(/{studentName}/g, exam.studentName || '-');
      template = template.replace(/{className}/g, exam.className || '-');
      template = template.replace(/{rollNo}/g, exam.rollNo || '-');
      template = template.replace(/{admissionNo}/g, exam.admissionNo || '-');
      template = template.replace(/{fatherName}/g, exam.fatherName || '-');
      template = template.replace(/{motherName}/g, exam.motherName || '-');
      template = template.replace(/{examName}/g, exam.examName || '-');
      template = template.replace(/{totalMarks}/g, exam.totalMarks || '-');
      template = template.replace(/{percentage}/g, (exam.percentage || '0') + '%');
      template = template.replace(/{grade}/g, exam.grade || '-');
      template = template.replace(/{resultStatus}/g, exam.resultStatus || '-');
      
      const schoolName = store.schoolProfile ? store.schoolProfile.schoolName : "Tapowan Public School";
      template = template.replace(/{schoolName}/g, schoolName);
      
      const photoUrl = exam.studentPhoto || DEFAULT_SCHOOL_LOGO;
      template = template.replace(/src="\{studentPhoto\}"/g, `src="${photoUrl}"`);
      template = template.replace(/\{studentPhoto\}/g, `<img src="${photoUrl}" style="width:100px; height:120px; object-fit:cover; border:1px solid #000;" />`);
      
      // Apply Global Configs on the Wrapper
      const c = config || { color: '#0f172a', font: "'Inter', sans-serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `2px ${c.border} ${c.color}`;
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor};` : '';
      const bgStyle = c.bgImage !== 'none' ? `background-image: url('${c.bgImage}'); background-size: cover; background-position: center;` : (c.bgType === 'gradient' ? `background: linear-gradient(135deg, ${c.bgColor}, ${c.bgColor2});` : `background-color: ${c.bgColor};`);

      return `
      <div style="width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; font-family: ${c.font}; ${fontColorStyle} border: ${borderCss}; ${bgStyle} position: relative; overflow: hidden; page-break-inside: avoid;">
          ${template}
      </div>`;
  }

  function getDetailedGraphResultHtml(exam, theme, config) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const schoolName = store.schoolName || "TAPOWAN PUBLIC SCHOOL";
    const c = config || { color: '#0f172a', font: "'Times New Roman', serif", border: 'solid' };
    const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';

    const watermarkText = encodeURIComponent(schoolName);
    const watermarkSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><text x='50%' y='50%' transform='rotate(-35 150 150)' text-anchor='middle' font-family='Arial' font-size='20' font-weight='bold' fill='%23000'>${watermarkText}</text></svg>`;

    let marksRows = '';
    let marksTableData = [];
    if (typeof exam.subjectMarks === 'string') {
        try { marksTableData = JSON.parse(exam.subjectMarks); } catch(e){}
    } else if (Array.isArray(exam.subjectMarks)) {
        marksTableData = exam.subjectMarks;
    }

    let scale = [
        { min: 91, max: 100, grade: 'A+' }, { min: 81, max: 90, grade: 'A' },
        { min: 71, max: 80, grade: 'B+' }, { min: 61, max: 70, grade: 'B' },
        { min: 51, max: 60, grade: 'C' }, { min: 33, max: 50, grade: 'D' }, { min: 0, max: 32, grade: 'E' }
      ];
      if (store.settings) {
          const customScale = store.settings.find(s => s.key === "customGradingScale");
          if (customScale && customScale.value) {
              try { scale = JSON.parse(customScale.value); } catch(e){}
          }
      }
      scale.sort((a, b) => b.min - a.min);

      marksTableData.forEach((m, idx) => {
          const bg = (idx % 2 === 0) ? '#f8f9fa' : '#ffffff';
          const full = m.max !== undefined ? m.max : 100;
          const pass = m.min !== undefined ? m.min : 33;
          const obtained = m.total !== undefined ? m.total : 0;
          const p = full > 0 ? (obtained / full) * 100 : 0;
          const matched = scale.find(g => p >= g.min);
          const grade = matched ? matched.grade : 'F';
          
          marksRows += `
          <tr style="background: ${bg};">
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; text-align: left;" contenteditable="true">${m.subject || ''}</td>
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${full}</td>
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${pass}</td>
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${obtained}</td>
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${full}</td>
              <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center; font-weight: bold;" contenteditable="true">${grade}</td>
          </tr>`;
      });

      let workingDays = 0;
      try {
          let startYear = parseInt((exam.session || "").split('-')[0]);
          if (isNaN(startYear)) startYear = new Date().getFullYear();
          const startDate = new Date(startYear, 3, 1); // April 1st
          let endDate = new Date();
          const sessionEndDate = new Date(startYear + 1, 2, 31);
          if (endDate > sessionEndDate) endDate = sessionEndDate;
          
          if (endDate >= startDate) {
              const holidays = store.holidays || [];
              const holidayDates = new Set();
              holidays.forEach(h => { if (h.date) holidayDates.add(h.date); });
              
              let currDate = new Date(startDate);
              while (currDate <= endDate) {
                  const dayOfWeek = currDate.getDay();
                  const y = currDate.getFullYear();
                  const m = String(currDate.getMonth() + 1).padStart(2, '0');
                  const d = String(currDate.getDate()).padStart(2, '0');
                  const dateStr = `${y}-${m}-${d}`;
                  
                  if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
                      workingDays++;
                  }
                  currDate.setDate(currDate.getDate() + 1);
              }
          }
      } catch(e) {}

    return `
    <style>
      @media print {
        @page { size: A4 portrait !important; margin: 0 !important; }
        .perfect-print-wrapper {
          width: 188mm !important;
          height: 275mm !important;
          max-height: 275mm !important;
          margin: 10mm auto !important;
        }
      }
    </style>
    <div class="perfect-print-wrapper" style="width: 100%; height: 285mm; overflow: hidden; box-sizing: border-box; page-break-inside: avoid; color: #000; border: 3px double ${c.color}; padding: 15px; padding-bottom: 25px; font-family: 'Times New Roman', serif; position: relative; background: #fff; display: flex; flex-direction: column;">
        
        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
            
            <!-- Header -->
            <div style="position: relative; text-align: center; border-bottom: 2px solid ${c.color}; padding-bottom: 10px; margin-bottom: 15px;">
                <!-- Logo Left -->
                <div style="position: absolute; left: 0; top: 0; width: 80px; height: 80px;">
                    <img src="${store.schoolLogo || 'school_logo.png'}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                
                <!-- Center Text -->
                <div style="margin: 0 90px;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: ${c.color}; text-transform: uppercase;">${schoolName}</h1>
                    <div style="font-weight: bold; font-size: 12px; margin: 2px 0;">U-DISE NO. ${store.schoolDise || '20241202412'}</div>
                    <div style="font-size: 10px; font-style: italic; margin-bottom: 2px;">${store.schoolAddress || 'Address details here'}</div>
                    <div style="font-size: 10px;">
                        <span style="margin-right: 15px;">E-mail: ${store.schoolEmail || 'school@gmail.com'}</span>
                        <span>Contact: ${store.schoolPhone || '9999999999'}</span>
                    </div>
                </div>

                <!-- Photo Right -->
                <div style="position: absolute; right: 0; top: 0; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      <img src="${exam.studentPhoto || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' fill=\'%23cbd5e1\' viewBox=\'0 0 24 24\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
            </div>

            <h2 style="text-align: center; font-size: 14px; text-decoration: underline; margin: 0 0 10px 0; font-weight: bold;" contenteditable="true">REPORT CARD - ${exam.examName.toUpperCase()} (${exam.session})</h2>

            <!-- Student Info Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; width: 120px; font-weight: bold;">Name of Student:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.studentName}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Class/Sec:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" contenteditable="true">${exam.className}</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; width: 100px; font-weight: bold;">Admission No:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" contenteditable="true">${exam.admissionNo}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Roll No:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" contenteditable="true">${exam.rollNo}</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Date of Birth:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" contenteditable="true">${exam.dob || ''}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Father's Name:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.fatherName || ''}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Mother's Name:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.motherName || ''}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; font-weight: bold;">Address:</td>
                    <td style="border: 1px solid #000; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.address || ''}</td>
                </tr>
            </table>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: left; text-transform: uppercase;">Subject</th>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; text-transform: uppercase;">Full Marks</th>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; text-transform: uppercase;">Pass Marks</th>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; text-transform: uppercase;">Obtained Marks</th>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; text-transform: uppercase;">Total Marks</th>
                        <th style="border: 1px solid #000; padding: 4px 8px; text-align: center; text-transform: uppercase;">Grade</th>
                    </tr>
                </thead>
                <tbody style="border: 1px solid #000;">
                    ${marksRows.replace(/border: 1px solid #cbd5e1/g, 'border: 1px solid #000').replace(/border: 1px solid #94a3b8/g, 'border: 1px solid #000').replace(/padding: 6px/g, 'padding: 4px 8px')}
                </tbody>
            </table>

            <!-- Summary Blocks -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 0 20px; font-size: 10px;">
                <div style="text-align: center;">
                    <div style="color: #666; margin-bottom: 2px;">Total Obtained Marks</div>
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">${exam.totalMarks || '-'}</div>
                </div>
                <div style="border-left: 1px solid #ccc;"></div>
                <div style="text-align: center;">
                    <div style="color: #666; margin-bottom: 2px;">Percentage</div>
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">${exam.percentage || '-'}%</div>
                </div>
                <div style="border-left: 1px solid #ccc;"></div>
                <div style="text-align: center;">
                    <div style="color: #666; margin-bottom: 2px;">Rank</div>
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">-</div>
                </div>
                <div style="border-left: 1px solid #ccc;"></div>
                <div style="text-align: center;">
                    <div style="color: #666; margin-bottom: 2px;">Overall Grade</div>
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">${exam.grade || '-'}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
                <tr>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: center; font-weight: bold; width: 120px;">Attendance</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: center;">Total Working Days</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: center;" contenteditable="true">${workingDays}</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: center;">Total Present Days</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: center;" contenteditable="true"></td>
                </tr>
            </table>

            <!-- Grade Chart -->
            <div style="width: 100%; border: 1px solid #eee; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; margin-bottom: 15px;">
                <div style="font-weight: bold; font-size: 10px; margin-bottom: 5px;">Grade Distribution Chart</div>
                <div style="width: 100%; height: 180px; position: relative;">
                    <canvas id="gradeChart_${exam.rollNo}" class="grade-distribution-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>

            <!-- Editable Spacer for MS Word style Enter -->
            <p contenteditable="true" style="margin: 5px 0; min-height: 20px; outline: none; border: 1px dashed transparent;" onfocus="this.style.borderColor='#cbd5e1'" onblur="this.style.borderColor='transparent'"></p>

            <!-- Remarks -->
            <div style="margin-top: 10px; margin-bottom: 30px;">
                <style>@media print { .ai-remark-btn { display: none !important; } }</style>
                <div style="font-size: 12px; display: flex; align-items: flex-end;">
                    <span style="font-weight: bold; margin-right: 10px;">Remark:</span>
                    <button class="ai-remark-btn" contenteditable="false" onclick="generateAIRemark(this)" data-student="${exam.studentName}" data-grade="${exam.grade}" data-perc="${exam.percentage}" style="margin-right: 10px; cursor:pointer; background:#8b5cf6; color:white; border:none; border-radius:4px; padding:3px 8px; font-size:10px; display:inline-flex; align-items:center; gap:3px;">✨ AI Remark</button>
                    <span class="ai-remark-target" style="flex: 1; border-bottom: 1px solid #000; height: 18px; outline:none;" contenteditable="true"></span>
                </div>
            </div>

            <div contenteditable="false" style="margin-top: auto; width: 100%; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; background: white; padding: 0 10px; box-sizing: border-box;">
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; width: 140px;">Signature of Class Teacher</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; width: 140px;">Signature of HOD</div>
                </div>
                <div style="text-align: center;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; width: 140px;">Signature of Principal</div>
                </div>
            </div>
        </div>
    </div>`;
}


function getMarksheetHtml(exam, theme, config) {
      const c = config || { color: '#0f172a', font: "'Times New Roman', serif", border: 'solid' };
      const borderVal = c.border === 'none' ? 'none' : `4px ${c.border} ${c.color}`;
      const photoUrl = exam.studentPhoto || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

      let subjectRows = '';
      let subs = [];
      try { subs = JSON.parse(exam.subjectMarks); } catch(e) {}
      
      subs.forEach(sub => {
          subjectRows += `
          <tr>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); font-weight:bold;" contenteditable="true">${sub.subject}</td>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${sub.max || 100}</td>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${sub.min !== undefined ? sub.min : 33}</td>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${sub.theory || 0}</td>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${sub.practical || 0}</td>
              <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center; font-weight:bold;" contenteditable="true">${sub.total || 0}</td>
          </tr>`;
      });

      const schoolName = "Tapowan Public School";
      const admNo = exam.admissionNo || '-';

      if (theme === 'state') {
          const borderVal = c.border === 'none' ? 'none' : `2px ${c.border} ${c.color}`;
          const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
          return `
          <div style="width: 190mm; min-height: 250mm; box-sizing: border-box; page-break-inside: avoid; color: inherit; ${fontColorStyle} border: ${borderVal}; padding: 20px; font-family: ${c.font}; position: relative; background: transparent;">
              <div style="text-align:center; border-bottom: 2px solid ${c.color}; padding-bottom: 15px; margin-bottom: 20px;">
                  <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 70px; height: 70px; margin-bottom: 5px; display:inline-block;" /><br/>\n<h1 style="margin:0; font-size: 28px; text-transform: uppercase; color: ${c.color}; display:inline-block;">${schoolName}</h1>
                  <p style="margin:5px 0;">Affiliated to State Board</p>
                  <div style="background: ${c.color}; color: ${c.fontColor || '#fff'}; display:inline-block; padding: 5px 20px; font-weight:bold; margin-top:5px; border-radius: 4px;">STATEMENT OF MARKS - <span contenteditable="true">${exam.examName.toUpperCase()}</span></div>
              </div>
              <div style="display:flex; justify-content: space-between; margin-bottom: 20px;">
                  <table style="width:70%; font-size: 15px; line-height:1.6;">
                      <tr><td style="font-weight:bold; width: 140px;">Student Name:</td><td contenteditable="true">${exam.studentName}</td></tr>
                      <tr><td style="font-weight:bold;">Class & Section:</td><td contenteditable="true">${exam.className}</td></tr>
                      <tr><td style="font-weight:bold;">Roll No:</td><td contenteditable="true">${exam.rollNo}</td></tr>
                      <tr><td style="font-weight:bold;">Admission No:</td><td contenteditable="true">${admNo}</td></tr>
                  </table>
                  <div style="width: 100px; height: 120px; border: 1px solid ${c.color};">
                      <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" />
                  </div>
              </div>
              <table style="width:100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
                  <thead>
                      <tr style="background: ${c.color}22; color: ${c.color}; text-transform: uppercase;">
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:left;">Subject Name</th>
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Max Marks</th>
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Min Marks</th>
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Theory</th>
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Prac/Int</th>
                          <th style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Total Marks</th>
                      </tr>
                  </thead>
                  <tbody>${subjectRows}</tbody>
              </table>
              <div style="display: flex; gap: 20px; text-align:center;">
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">TOTAL MARKS</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${exam.totalMarks}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${exam.percentage}%</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${exam.grade}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: ${exam.resultStatus === 'PASS' ? '#dcfce7' : '#fee2e2'};">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">RESULT</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${exam.resultStatus === 'PASS' ? '#16a34a' : '#dc2626'};" contenteditable="true">${exam.resultStatus}</div>
                  </div>
              </div>
              <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 20px;">
                  <div style="text-align:center; width: 160px;">
                      <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                      <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Class Teacher</p>
                  </div>
                  <div style="text-align:center; width: 160px;">
                      <div style="border-bottom: 1px solid ${c.color}; height: 40px;"></div>
                      <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Principal</p>
                  </div>
              </div>
          </div>`;
      } 

      else if (theme === 'primary') {
          const borderVal = c.border === 'none' ? 'none' : `3px ${c.border} ${c.color}`;
          const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
          return `
          <div style="width: 190mm; min-height: 250mm; box-sizing: border-box; page-break-inside: avoid; color: inherit; ${fontColorStyle} border: ${borderVal}; padding: 30px; font-family: ${c.font}; position: relative; background: transparent; border-radius: 20px;">
              <div style="text-align:center; border-bottom: 3px dashed ${c.color}; padding-bottom: 15px; margin-bottom: 30px;">
                  <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 80px; height: 80px; margin-bottom: 5px; display:inline-block;" /><br/>\n                   <h1 style="margin:0; font-size: 32px; font-weight: 900; color: ${c.color}; display:inline-block;">${schoolName}</h1>
                  <div style="background: #fbbf24; color: #000; display:inline-block; padding: 5px 25px; font-weight:bold; margin-top:10px; border-radius: 30px; font-size:16px;">STUDENT PROGRESS REPORT</div>
              </div>
              <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 30px; background: ${c.color}11; padding: 20px; border-radius: 15px;">
                  <table style="width:65%; font-size: 16px; line-height:1.8; font-weight: 600;">
                      <tr><td style="width: 140px;">Student Name:</td><td contenteditable="true" style="color: ${c.color}; font-size: 18px; font-weight: 800; border-bottom: 1px solid #ccc;">${exam.studentName}</td></tr>
                      <tr><td>Class & Section:</td><td contenteditable="true" style="border-bottom: 1px solid #ccc;">${exam.className}</td></tr>
                      <tr><td>Roll No:</td><td contenteditable="true" style="border-bottom: 1px solid #ccc;">${exam.rollNo}</td></tr>
                      <tr><td>Admission No:</td><td contenteditable="true" style="border-bottom: 1px solid #ccc;">${admNo}</td></tr>
                  </table>
                  <div style="width: 120px; height: 140px; border: 4px solid ${c.color}; border-radius: 12px; overflow:hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                      <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" />
                  </div>
              </div>
              <table style="width:100%; border-collapse: collapse; margin-bottom: 30px; font-size: 15px; background: transparent; border-radius: 10px; overflow:hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                  <thead>
                      <tr style="background: ${c.color}; color: ${c.fontColor || '#fff'};">
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:left;">SUBJECT</th>
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:center;">MAX</th>
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:center;">MIN</th>
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:center;">TH</th>
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:center;">PR</th>
                          <th style="padding:15px; border:1px solid ${c.color}; text-align:center;">TOTAL</th>
                      </tr>
                  </thead>
                  <tbody>${subjectRows}</tbody>
              </table>
              <div style="display: flex; gap: 15px; text-align:center;">
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: transparent;">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">TOTAL</div>
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.totalMarks}</div>
                  </div>
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: transparent;">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.percentage}%</div>
                  </div>
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: transparent;">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${exam.grade}</div>
                  </div>
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: ${exam.resultStatus === 'PASS' ? '#dcfce7' : '#fee2e2'};">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">RESULT</div>
                      <div style="font-size: 26px; font-weight:900; color: ${exam.resultStatus === 'PASS' ? '#16a34a' : '#dc2626'};" contenteditable="true">${exam.resultStatus}</div>
                  </div>
              </div>
              <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px;">
                  <div style="text-align:center; width: 150px;">
                      <div style="border-bottom: 2px solid #0f172a; height: 40px;"></div>
                      <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: bold;">Teacher</p>
                  </div>
                  <div style="text-align:center; width: 150px;">
                      <div style="border-bottom: 2px solid #0f172a; height: 40px;"></div>
                      <p style="margin: 8px 0 0 0; font-size: 15px; font-weight: bold;">Principal</p>
                  </div>
              </div>
          </div>`;
      } 
      else {
          const borderVal = c.border === 'none' ? 'none' : `4px ${c.border} ${c.color}`;
          const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
          return `
          <div style="width: 190mm; min-height: 250mm; box-sizing: border-box; page-break-inside: avoid; color: inherit; ${fontColorStyle} border: ${borderVal}; padding: 30px; font-family: ${c.font}; position: relative; background: transparent;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; font-size: 120px; font-weight: bold; text-align: center; color: ${c.color}; z-index: 0;">${schoolName}</div>
              <div style="position: relative; z-index: 1;">
                  <div style="text-align:center; margin-bottom: 30px;">
                      <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 80px; height: 80px; margin-bottom: 5px; display:inline-block;" /><br/>\n<h1 style="margin:0; font-size: 32px; text-transform: uppercase; letter-spacing: 2px; color: ${c.color}; display:inline-block;">${schoolName}</h1>
                      <p style="margin:5px 0; font-size: 14px;">PERFORMANCE PROFILE - ${exam.examName}</p>
                      <hr style="border:none; border-top: 2px solid ${c.color}; margin-top: 15px;" />
                  </div>
                  <table style="width:100%; margin-bottom: 25px; font-size: 16px;">
                      <tr>
                          <td style="width: 120px; vertical-align: top;"><img src="${photoUrl}" style="width: 100px; height: 120px; object-fit:cover; border: 2px solid ${c.color}; border-radius: 8px;" /></td>
                          <td style="vertical-align: top; padding-left: 20px;">
                              <table style="width:100%; line-height: 2;">
                                  <tr><td style="font-weight:bold; width: 150px;">Name of Student:</td><td style="border-bottom: 1px dotted #ccc;">${exam.studentName}</td></tr>
                                  <tr><td style="font-weight:bold;">Class & Section:</td><td style="border-bottom: 1px dotted #ccc;">${exam.className}</td></tr>
                                  <tr><td style="font-weight:bold;">Roll Number:</td><td style="border-bottom: 1px dotted #ccc;">${exam.rollNo}</td></tr>
                                  <tr><td style="font-weight:bold;">Admission No:</td><td style="border-bottom: 1px dotted #ccc;">${admNo}</td></tr>
                              </table>
                          </td>
                      </tr>
                  </table>
                  <table style="width:100%; border-collapse: collapse; margin-bottom: 30px; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                      <thead>
                          <tr style="background: ${c.color}; color: ${c.fontColor || '#fff'};">
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:left;">SUBJECTS</th>
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:center;">MAX</th>
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:center;">MIN</th>
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:center;">TH</th>
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:center;">PR</th>
                              <th style="padding:12px; border:1px solid ${c.color}; text-align:center;">TOTAL</th>
                          </tr>
                      </thead>
                      <tbody>${subjectRows}</tbody>
                  </table>
                  <div style="background: transparent; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; align-items: center; text-align: center;">
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">GRAND TOTAL</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${exam.totalMarks}</h2></div>
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">PERCENTAGE</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${exam.percentage}%</h2></div>
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">OVERALL GRADE</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${exam.grade}</h2></div>
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">RESULT</p><h2 style="margin:0; color:${exam.resultStatus === 'PASS' ? '#16a34a' : '#dc2626'};" contenteditable="true">${exam.resultStatus}</h2></div>
                  </div>
                  <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end;">
                      <div style="text-align:center; width: 180px;">
                          <div style="border-bottom: 2px solid #000; height: 30px;"></div>
                          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Date of Issue</p>
                      </div>
                      <div style="text-align:center; width: 180px;">
                          <div style="border-bottom: 2px solid #000; height: 30px;"></div>
                          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Signature of Principal</p>
                      </div>
                  </div>
              </div>
          </div>`;
      }
  }


  // ==========================================
  // TAB 3: RESULTS / MARKSHEETS
  // ==========================================
  function renderResults(container) {
    container.innerHTML = `
      <div class="exam-print-hide" style="margin-bottom: 25px;">
        <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Marksheet Generator</h4>
        <p style="margin:0; color: inherit; font-size:0.9rem;">Generate beautiful report cards and results.</p>
      </div>
      <div class="exam-form-grid" style="margin-bottom: 30px;">
        <div class="exam-field">
          <label>Select Class</label>
          <select id="resultClassSelect"></select>
        </div>
        <div class="exam-field">
          <label>Session</label>
          <input id="resultSession" value="2026-27" />
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <input id="resultExamName" value="Mid Term Exam" />
        </div>
          <div class="exam-field">
            <label>Layout Theme</label>
            <div style="display:flex; gap:10px;">
              <select id="resultThemeSelect" style="flex:1; height: 46px;">${getOptions500()}</select>
              <button id="btnOpenResultDesigner" style="display:block; padding:0 15px; background:#10b981; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Edit Template</button>
            </div>
          </div>
        <div class="exam-field">
          <label>Primary Color</label>
          <input type="color" id="resultColor" value="#2563eb" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
        </div>
        
          <div class="exam-field">
            <label>Font Style (100+ Options)</label>
            <select id="resultFont"><option value="'Times New Roman', serif">Times New Roman (Font 1)</option><option value="'Inter', sans-serif">Inter (Font 2)</option><option value="'Courier New', monospace">Courier New (Font 3)</option><option value="'Arial', sans-serif">Arial (Font 4)</option><option value="'Georgia', serif">Georgia (Font 5)</option><option value="'Verdana', sans-serif">Verdana (Font 6)</option><option value="'Trebuchet MS', sans-serif">Trebuchet MS (Font 7)</option><option value="'Comic Sans MS', cursive">Comic Sans MS (Font 8)</option><option value="'Impact', sans-serif">Impact (Font 9)</option><option value="'Palatino Linotype', serif">Palatino Linotype (Font 10)</option><option value="'Tahoma', sans-serif">Tahoma (Font 11)</option><option value="'Lucida Console', monospace">Lucida Console (Font 12)</option><option value="'Garamond', serif">Garamond (Font 13)</option><option value="'Bookman Old Style', serif">Bookman Old Style (Font 14)</option><option value="'Arial Black', sans-serif">Arial Black (Font 15)</option><option value="'Arial Narrow', sans-serif">Arial Narrow (Font 16)</option><option value="'Century Gothic', sans-serif">Century Gothic (Font 17)</option><option value="'Copperplate', fantasy">Copperplate (Font 18)</option><option value="'Papyrus', fantasy">Papyrus (Font 19)</option><option value="'Brush Script MT', cursive">Brush Script MT (Font 20)</option><option value="'Baskerville', serif">Baskerville (Font 21)</option><option value="'Consolas', monospace">Consolas (Font 22)</option><option value="'Franklin Gothic Medium', sans-serif">Franklin Gothic Medium (Font 23)</option><option value="'Gill Sans', sans-serif">Gill Sans (Font 24)</option><option value="'Helvetica', sans-serif">Helvetica (Font 25)</option><option value="'Optima', sans-serif">Optima (Font 26)</option><option value="'Segoe UI', sans-serif">Segoe UI (Font 27)</option><option value="'Monaco', monospace">Monaco (Font 28)</option><option value="'Didot', serif">Didot (Font 29)</option><option value="'American Typewriter', serif">American Typewriter (Font 30)</option><option value="'Andale Mono', monospace">Andale Mono (Font 31)</option><option value="'Avant Garde', sans-serif">Avant Garde (Font 32)</option><option value="'Calibri', sans-serif">Calibri (Font 33)</option><option value="'Cambria', serif">Cambria (Font 34)</option><option value="'Candara', sans-serif">Candara (Font 35)</option><option value="'Constantia', serif">Constantia (Font 36)</option><option value="'Corbel', sans-serif">Corbel (Font 37)</option><option value="'Rockwell', serif">Rockwell (Font 38)</option><option value="'Futura', sans-serif">Futura (Font 39)</option><option value="'Geneva', sans-serif">Geneva (Font 40)</option><option value="'Hoefler Text', serif">Hoefler Text (Font 41)</option><option value="'Lucida Grande', sans-serif">Lucida Grande (Font 42)</option><option value="'Perpetua', serif">Perpetua (Font 43)</option><option value="system-ui">system-ui (Font 44)</option><option value="-apple-system">-apple-system (Font 45)</option><option value="BlinkMacSystemFont">BlinkMacSystemFont (Font 46)</option><option value="Roboto">Roboto (Font 47)</option><option value="Oxygen">Oxygen (Font 48)</option><option value="Ubuntu">Ubuntu (Font 49)</option><option value="Cantarell">Cantarell (Font 50)</option><option value="'Fira Sans'">Fira Sans (Font 51)</option><option value="'Droid Sans'">Droid Sans (Font 52)</option><option value="'Helvetica Neue'">Helvetica Neue (Font 53)</option><option value="sans-serif">sans-serif (Font 54)</option><option value="serif">serif (Font 55)</option><option value="monospace">monospace (Font 56)</option><option value="fantasy">fantasy (Font 57)</option><option value="cursive">cursive (Font 58)</option><option value="'Brush Script Std'">Brush Script Std (Font 59)</option><option value="'Luminari'">Luminari (Font 60)</option><option value="'Chalkduster'">Chalkduster (Font 61)</option><option value="'Jazz LET'">Jazz LET (Font 62)</option><option value="'Blippo'">Blippo (Font 63)</option><option value="'Stencil Std'">Stencil Std (Font 64)</option><option value="'Marker Felt'">Marker Felt (Font 65)</option><option value="'Trattatello'">Trattatello (Font 66)</option><option value="'Bodoni MT'">Bodoni MT (Font 67)</option><option value="'Calisto MT'">Calisto MT (Font 68)</option><option value="'Elephant'">Elephant (Font 69)</option><option value="'Goudy Old Style'">Goudy Old Style (Font 70)</option><option value="'Lucida Bright'">Lucida Bright (Font 71)</option><option value="'Perpetua Titling MT'">Perpetua Titling MT (Font 72)</option><option value="'Baskerville Old Face'">Baskerville Old Face (Font 73)</option><option value="'Century Schoolbook'">Century Schoolbook (Font 74)</option><option value="'Footlight MT Light'">Footlight MT Light (Font 75)</option><option value="'Harrington'">Harrington (Font 76)</option><option value="'High Tower Text'">High Tower Text (Font 77)</option><option value="'Jokerman'">Jokerman (Font 78)</option><option value="'Juice ITC'">Juice ITC (Font 79)</option><option value="'Kristen ITC'">Kristen ITC (Font 80)</option><option value="'Magneto'">Magneto (Font 81)</option><option value="'Matura MT Script Capitals'">Matura MT Script Capitals (Font 82)</option><option value="'Mistral'">Mistral (Font 83)</option><option value="'Niagara Engraved'">Niagara Engraved (Font 84)</option><option value="'Old English Text MT'">Old English Text MT (Font 85)</option><option value="'Onyx'">Onyx (Font 86)</option><option value="'Parchment'">Parchment (Font 87)</option><option value="'Playbill'">Playbill (Font 88)</option><option value="'Poor Richard'">Poor Richard (Font 89)</option><option value="'Ravie'">Ravie (Font 90)</option><option value="'Showcard Gothic'">Showcard Gothic (Font 91)</option><option value="'Snap ITC'">Snap ITC (Font 92)</option><option value="'Viner Hand ITC'">Viner Hand ITC (Font 93)</option><option value="'Vivaldi'">Vivaldi (Font 94)</option><option value="'Vladimir Script'">Vladimir Script (Font 95)</option><option value="'Wide Latin'">Wide Latin (Font 96)</option><option value="'Algerian'">Algerian (Font 97)</option><option value="'Bauhaus 93'">Bauhaus 93 (Font 98)</option><option value="'Bell MT'">Bell MT (Font 99)</option><option value="'Bernard MT Condensed'">Bernard MT Condensed (Font 100)</option></select>
          </div>
          <div class="exam-field">
            <label>Text Color</label>
            <input type="color" id="resultFontColor" value="#000000" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Bg Type</label>
            <select id="resultBgType">
              <option value="solid">Solid Color</option>
              <option value="gradient">Gradient</option>
            </select>
          </div>
          <div class="exam-field">
            <label>Background / Gradient 1</label>
            <input type="color" id="resultBgColor" value="#ffffff" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Gradient 2</label>
            <input type="color" id="resultBgColor2" value="#f1f5f9" style="height: 46px; padding: 5px; cursor: pointer; border-radius: 8px;" />
          </div>
          <div class="exam-field">
            <label>Bg Opacity</label>
            <input type="range" id="resultBgOpacity" min="0" max="1" step="0.05" value="1" style="height: 46px;" />
          </div>
          <div class="exam-field">
            <label>Bg Image</label>
            <select id="resultBgImage">
              <option value="none">None</option>
              <option value="bg_1.png">1. Premium Gold Border</option>
              <option value="bg_2.png">2. Modern Geometric Watermark</option>
              <option value="bg_3.png">3. Vibrant Abstract Waves</option>
              <option value="bg_4.png">4. Academic University</option>
            </select>
          </div>
          <div class="exam-field">
            <label>Border Style</label>
          <select id="resultBorder">
            <option value="solid">Solid</option>
            <option value="double">Double Line</option>
            <option value="none">None</option>
          </select>
        </div>
        <div class="exam-field" style="grid-column: 1 / -1;">
          <details style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
            <summary style="cursor: pointer; font-weight: bold; outline: none;">Configure Grading Scale (Graph & Results)</summary>
            <div id="gradingScaleConfigContainer" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
            </div>
            <button id="btnAddGradeRow" style="margin-top: 10px; padding: 5px 10px; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc;">+ Add Grade Range</button>
          </details>
        </div>
        <div class="exam-field" style="grid-column: 1 / -1;">
          <button id="resultGenerateBtn" class="exam-btn exam-btn-primary" style="width:100%;">Generate Marksheets</button>
        </div>
      </div>
      <div id="resultPrintActions" style="margin-bottom: 20px; display:none; gap:15px; justify-content:flex-end;">
        <button id="resultPrintBtn" class="exam-btn exam-btn-secondary">🖨️ Print Results</button>
      </div>
      <div id="resultPreviewContainer" contenteditable="true" style="outline:none; background:#e2e8f0; padding:40px 20px; border-radius:12px; min-height:300px; display:flex; flex-direction:column; align-items:center; gap:40px;">
         <div class="empty-state">
           <i>📊</i>
           <h4>Ready to generate</h4>
           <p>Select criteria and click Generate to view marksheets.</p>
         </div>
      </div>
    `;

    populateClassSelect("resultClassSelect");
    
    // Grading Scale Logic
    const defaultScale = [
      { min: 91, max: 100, grade: 'A+' },
      { min: 81, max: 90, grade: 'A' },
      { min: 71, max: 80, grade: 'B+' },
      { min: 61, max: 70, grade: 'B' },
      { min: 51, max: 60, grade: 'C' },
      { min: 33, max: 50, grade: 'D' },
      { min: 0, max: 32, grade: 'E' }
    ];
    let gradingScale = [...defaultScale];
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    if (store.settings) {
        const customScale = store.settings.find(s => s.key === "customGradingScale");
        if (customScale && customScale.value) {
            try { gradingScale = JSON.parse(customScale.value); } catch(e){}
        }
    }
    
    function renderGradingScaleUI() {
        const container = document.getElementById("gradingScaleConfigContainer");
        container.innerHTML = "";
        gradingScale.forEach((g, idx) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "5px";
            row.style.alignItems = "center";
            row.innerHTML = `
              <input type="number" class="gs-min" value="${g.min}" style="width:60px; padding:4px;" placeholder="Min %">
              <span>-</span>
              <input type="number" class="gs-max" value="${g.max}" style="width:60px; padding:4px;" placeholder="Max %">
              <span>:</span>
              <input type="text" class="gs-grade" value="${g.grade}" style="flex:1; padding:4px;" placeholder="Grade (e.g. A+)">
              <button class="gs-del" data-idx="${idx}" style="padding:4px 8px; background:#ef4444; color:#fff; border:none; border-radius:4px; cursor:pointer;">X</button>
            `;
            container.appendChild(row);
        });
        
        container.querySelectorAll(".gs-del").forEach(btn => {
            btn.onclick = (e) => {
                gradingScale.splice(parseInt(e.target.dataset.idx), 1);
                saveGradingScale();
                renderGradingScaleUI();
            };
        });
        
        container.querySelectorAll("input").forEach(inp => {
            inp.onchange = () => {
                saveGradingScale();
            };
        });
    }
    
    function saveGradingScale() {
        const container = document.getElementById("gradingScaleConfigContainer");
        const newScale = [];
        container.querySelectorAll("div").forEach(row => {
            const min = parseFloat(row.querySelector(".gs-min").value) || 0;
            const max = parseFloat(row.querySelector(".gs-max").value) || 0;
            const grade = row.querySelector(".gs-grade").value.trim() || '';
            if (grade) newScale.push({ min, max, grade });
        });
        gradingScale = newScale;
        if (typeof window.api === 'function') {
            window.api("/api/settings", { key: "customGradingScale", value: JSON.stringify(gradingScale) });
            // Update local store
            const store = getStore();
            if (!store.settings) store.settings = [];
            const idx = store.settings.findIndex(s => s.key === "customGradingScale");
            if (idx >= 0) store.settings[idx].value = JSON.stringify(gradingScale);
            else store.settings.push({ key: "customGradingScale", value: JSON.stringify(gradingScale) });
        }
    }
    
    document.getElementById("btnAddGradeRow").onclick = () => {
        gradingScale.push({ min: 0, max: 0, grade: 'New' });
        renderGradingScaleUI();
    };
    
    renderGradingScaleUI();

    document.getElementById("resultGenerateBtn").onclick = () => {
      const cls = document.getElementById("resultClassSelect").value;
      const session = document.getElementById("resultSession").value;
      const examName = document.getElementById("resultExamName").value;
      const theme = document.getElementById("resultThemeSelect").value;
      const config = {
          color: document.getElementById("resultColor").value,
          font: document.getElementById("resultFont").value,
          border: document.getElementById("resultBorder").value,
          bgColor: document.getElementById("resultBgColor").value,
          bgColor2: document.getElementById("resultBgColor2").value,
          bgType: document.getElementById("resultBgType").value,
          fontColor: document.getElementById("resultFontColor").value,
          bgOpacity: document.getElementById("resultBgOpacity").value,
          bgImage: document.getElementById("resultBgImage").value
        };
      if(!cls || !examName) return window.showToast ? showToast("Select class and exam", "warning") : alert("Select class and exam");
      generateMarksheets(cls, session, examName, theme, config);
    };

    document.getElementById("resultPrintBtn").onclick = () => {
      const container = document.getElementById("resultPreviewContainer");
      const editables = container.querySelectorAll('[contenteditable="true"]');
      editables.forEach(el => el.setAttribute("contenteditable", "false"));
      const wasEditable = container.getAttribute("contenteditable") === "true";
      if (wasEditable) container.setAttribute("contenteditable", "false");
      
      const originalParent = container.parentNode;
      const originalNextSibling = container.nextSibling;
      const hiddenElements = [];
      Array.from(document.body.children).forEach(child => {
        if (child.style && child.style.display !== 'none') {
          hiddenElements.push({ el: child, display: child.style.display });
          child.style.display = 'none';
        }
      });
      
      document.body.appendChild(container);
      container.style.display = 'block';
      
      window.print();
      
      hiddenElements.forEach(item => item.el.style.display = item.display);
      if (originalNextSibling) originalParent.insertBefore(container, originalNextSibling);
      else originalParent.appendChild(container);
      
      if (wasEditable) container.setAttribute("contenteditable", "true");
      editables.forEach(el => el.setAttribute("contenteditable", "true"));
    };
  }

  function generateMarksheets(className, session, examName, theme, config) {
    const container = document.getElementById("resultPreviewContainer");
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    
    // Find all exams matching
    const matchingExams = (store.exams || []).filter(e => e.className === className && e.session === session && e.examName === examName);
    
    if(matchingExams.length === 0) {
      container.innerHTML = `<div class="empty-state"><h4>No marks data found for this class and exam.</h4><p>Please enter marks first.</p></div>`;
      document.getElementById("resultPrintActions").style.display = "none";
      return;
    }

    let html = '';
    matchingExams.forEach(ex => {
          const student = (store.students || []).find(s => s.fullName === ex.studentName && s.className === ex.className) || {};
          const bgStyle = config.bgImage !== 'none' ? `background-image: url('${config.bgImage}'); background-size: cover; background-position: center;` : (config.bgType === 'gradient' ? `background: linear-gradient(135deg, ${config.bgColor}, ${config.bgColor2});` : `background-color: ${config.bgColor};`);
          const fontColorStyle = config.fontColor ? `color: ${config.fontColor} !important;` : '';
          
          let cardHtml = '';
          if (theme === 'custom_blank') {
              cardHtml = getCustomResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: student.fatherName || student.parentName || '', motherName: student.motherName || '',
                studentPhoto: student.photo || ex.studentPhoto || '', subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          } else if (theme === 'detailed_graph') {
              cardHtml = getDetailedGraphResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: student.fatherName || student.parentName || '', motherName: student.motherName || '',
                dob: student.dob || '', address: student.address || '',
                studentPhoto: student.photo || ex.studentPhoto || '', subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          } else if (theme.startsWith('dyn_')) {
              cardHtml = generateDynamicMarksheet({
                examName: ex.examName, session: ex.session, studentName: ex.studentName,
                className: ex.className, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                studentPhoto: student.photo || ex.studentPhoto || '', subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          } else {
              cardHtml = getMarksheetHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                studentPhoto: student.photo || ex.studentPhoto || '', subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          }

          // Inject bg into the card itself to prevent bleeding into A4 container
          cardHtml = cardHtml.replace(/position:\s*relative;(?:\s*background:\s*transparent;)?/, `position: relative; ${bgStyle}`);
          const overlayHtml = `<div style="position: absolute; inset: 0; background: rgba(255,255,255,${1 - config.bgOpacity}); pointer-events: none; z-index: 0; border-radius: inherit;"></div><div style="position: relative; z-index: 1; height: 100%;">`;
          cardHtml = cardHtml.replace('">', `">${overlayHtml}`) + '</div>';

          // Wrap it in a clean A4 container (white background)
          html += `<div style="width: 210mm; min-height: 297mm; page-break-after: always; padding: 10mm; box-sizing: border-box; position: relative; overflow: hidden; background: #fff; margin: 0 auto; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                     <div style="display: flex; align-items: center; justify-content: center;">
                       ${cardHtml}
                     </div>
                   </div>`;
    });

    container.innerHTML = html;
    document.getElementById("resultPrintActions").style.display = "flex";
      
    // Initialize Charts
    if (theme === 'detailed_graph') {
        matchingExams.forEach(ex => {
            const canvas = document.getElementById(`gradeChart_${ex.rollNo}`);
            if (!canvas) return;
            
            let marksData = [];
            if (typeof ex.subjectMarks === 'string') {
                try { marksData = JSON.parse(ex.subjectMarks); } catch(e){}
            } else if (Array.isArray(ex.subjectMarks)) {
                marksData = ex.subjectMarks;
            }
            
            const store = typeof getStore !== 'undefined' ? getStore() : {};
            const defaultScale = [
              { min: 91, max: 100, grade: 'A+' }, { min: 81, max: 90, grade: 'A' },
              { min: 71, max: 80, grade: 'B+' }, { min: 61, max: 70, grade: 'B' },
              { min: 51, max: 60, grade: 'C' }, { min: 33, max: 50, grade: 'D' }, { min: 0, max: 32, grade: 'E' }
            ];
            let scale = defaultScale;
            if (store.settings) {
                const customScale = store.settings.find(s => s.key === "customGradingScale");
                if (customScale && customScale.value) {
                    try { scale = JSON.parse(customScale.value); } catch(e){}
                }
            }
            scale.sort((a, b) => b.min - a.min);
            
            const gradeCounts = {};
            scale.forEach(g => gradeCounts[g.grade] = 0);
            
            marksData.forEach(m => {
                const full = m.max !== undefined ? m.max : 100;
                const obtained = m.total !== undefined ? m.total : 0;
                const p = full > 0 ? (obtained / full) * 100 : 0;
                const matched = scale.find(g => p >= g.min);
                if (matched) gradeCounts[matched.grade]++;
            });
            
            const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#38bdf8'];
            
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: Object.keys(gradeCounts),
                    datasets: [{
                        label: 'Subjects per Grade',
                        data: Object.values(gradeCounts),
                        backgroundColor: colors.slice(0, Object.keys(gradeCounts).length),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    },
                    plugins: {
                        legend: { display: false }
                    },
                    animation: { duration: 0 } // Disable animation for instant printing
                }
            });
        });
    }
  }

  // Utils
  function populateClassSelect(elementId) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const classSelect = document.getElementById(elementId);
    if (!classSelect) return;
    classSelect.innerHTML = '<option value="">Select Class</option>';
    (store.classes || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.className + (c.section ? `-${c.section}` : "");
      opt.textContent = opt.value;
      classSelect.appendChild(opt);
    });
  }

  // --- WYSIWYG Floating Toolbar for Selected Text Color ---
  const floatingToolbar = document.createElement("div");
  floatingToolbar.style.cssText = `
    position: absolute;
    display: none;
    background: #1e293b;
    padding: 8px 14px;
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    z-index: 10000;
    align-items: center;
    gap: 6px;
    transition: opacity 0.2s;
    flex-wrap: wrap;
  `;
  const btnStyle = `background:transparent; border:1px solid rgba(255,255,255,0.3); color:#fff; width:30px; height:30px; border-radius:6px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif;`;
  let sizeOpts = '';
  for (let s = 11; s <= 72; s++) sizeOpts += `<option value="${s}" ${s === 14 ? 'selected' : ''}>${s}px</option>`;

  floatingToolbar.innerHTML = `
    <button id="ftBold" style="${btnStyle} font-weight:900;" title="Bold">B</button>
    <button id="ftItalic" style="${btnStyle} font-style:italic;" title="Italic">I</button>
    <button id="ftUnderline" style="${btnStyle} text-decoration:underline;" title="Underline">U</button>
    <div style="width:1px; height:24px; background:rgba(255,255,255,0.2);"></div>
    <select id="ftFontSize" style="background:#334155; color:#fff; border:1px solid rgba(255,255,255,0.3); border-radius:6px; padding:4px 6px; cursor:pointer; font-size:12px; height:30px;" title="Font Size">${sizeOpts}</select>
    <div style="width:1px; height:24px; background:rgba(255,255,255,0.2);"></div>
    <span style="color:#94a3b8; font-size:11px; font-family:'Inter',sans-serif;">Text</span>
    <input type="color" id="floatingTextColor" value="#ff0000" style="width:28px; height:28px; padding:0; border:none; border-radius:4px; cursor:pointer;" title="Text Color" />
    <span style="color:#94a3b8; font-size:11px; font-family:'Inter',sans-serif;">BG</span>
    <input type="color" id="floatingBgColor" value="#3b82f6" style="width:28px; height:28px; padding:0; border:none; border-radius:4px; cursor:pointer;" title="Background / Highlight Color" />
  `;
  document.body.appendChild(floatingToolbar);

  const colorInput = floatingToolbar.querySelector("#floatingTextColor");

  // Bold / Italic / Underline
  floatingToolbar.querySelector("#ftBold").addEventListener("click", () => {
    if (savedRange) { const s = document.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    document.execCommand("bold", false, null);
  });
  floatingToolbar.querySelector("#ftItalic").addEventListener("click", () => {
    if (savedRange) { const s = document.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    document.execCommand("italic", false, null);
  });
  floatingToolbar.querySelector("#ftUnderline").addEventListener("click", () => {
    if (savedRange) { const s = document.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    document.execCommand("underline", false, null);
  });

  // Font Size
  floatingToolbar.querySelector("#ftFontSize").addEventListener("change", (e) => {
    if (savedRange) { const s = document.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    document.execCommand("fontSize", false, "7"); // execCommand uses 1-7
    // Now find the font elements just created and set exact pixel size
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0) {
        const container = sel.getRangeAt(0).commonAncestorContainer;
        const root = container.nodeType === 3 ? container.parentNode : container;
        root.querySelectorAll('font[size="7"]').forEach(el => {
            el.removeAttribute("size");
            el.style.fontSize = e.target.value + "px";
        });
        // Also check parent
        if (root.tagName === 'FONT' && root.getAttribute('size') === '7') {
            root.removeAttribute("size");
            root.style.fontSize = e.target.value + "px";
        }
    }
  });

  // Background / Highlight Color
  floatingToolbar.querySelector("#floatingBgColor").addEventListener("input", (e) => {
    if (savedRange) { const s = document.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    // Find the closest TD or TH to apply background
    let cell = node.nodeType === 3 ? node.parentNode : node;
    while (cell && cell.tagName !== 'TD' && cell.tagName !== 'TH' && cell.tagName !== 'DIV') {
        cell = cell.parentNode;
    }
    if (cell && (cell.tagName === 'TD' || cell.tagName === 'TH' || cell.tagName === 'DIV')) {
        cell.style.background = e.target.value;
        cell.style.color = '#fff';
    }
  });

  let savedRange = null;

  // Prevent losing selection when clicking the toolbar
  floatingToolbar.addEventListener("mousedown", (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return; // allow select dropdown to open
    e.preventDefault();
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0);
    }
  });

  colorInput.addEventListener("input", (e) => {
    const sel = document.getSelection();
    if (!sel || (!savedRange && sel.rangeCount === 0)) return;
    
    const range = savedRange ? savedRange : sel.getRangeAt(0);
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    const color = e.target.value;
    const originalStartNodeValue = startNode.nodeType === 3 ? startNode.nodeValue : null;

    const isPreviewMode = document.getElementById("examTemplateDesignerModal").style.display === "none";
    let containerId = null;
    let cardRoot = null;

    if (isPreviewMode) {
        let current = startNode;
        while (current && current !== document.body) {
            if (current.id === "admitPreviewContainer" || current.id === "resultPreviewContainer") {
                containerId = current.id;
                break;
            }
            current = current.parentNode;
        }

        if (containerId) {
            const container = document.getElementById(containerId);
            current = startNode;
            while (current && current !== container) {
                if (containerId === "admitPreviewContainer") {
                    if (current.parentNode && current.parentNode.parentNode === container) {
                        cardRoot = current; break;
                    }
                } else {
                    if (current.parentNode === container) {
                        cardRoot = current; break;
                    }
                }
                current = current.parentNode;
            }
        }
    }

    function getDomPath(element, root) {
        let path = [];
        let curr = element;
        while (curr && curr !== root) {
            let index = 0;
            let sibling = curr.previousSibling;
            while (sibling) {
                index++;
                sibling = sibling.previousSibling;
            }
            path.unshift(index);
            curr = curr.parentNode;
        }
        return path;
    }

    let startPath = null, endPath = null;
    if (cardRoot) {
        startPath = getDomPath(startNode, cardRoot);
        endPath = getDomPath(endNode, cardRoot);
    }

    if (savedRange && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    document.execCommand("foreColor", false, color);

    if (cardRoot && startPath && endPath) {
        const container = document.getElementById(containerId);
        const allCardRoots = [];
        if (containerId === "admitPreviewContainer") {
            Array.from(container.children).forEach(page => {
                if (!page.classList.contains('empty-state')) {
                   Array.from(page.children).forEach(card => allCardRoots.push(card));
                }
            });
        } else {
            Array.from(container.children).forEach(card => {
                if (!card.classList.contains('empty-state')) allCardRoots.push(card);
            });
        }

        function getNodeByPath(root, path) {
            let curr = root;
            for (let index of path) {
                if (!curr || !curr.childNodes || index >= curr.childNodes.length) return null;
                curr = curr.childNodes[index];
            }
            return curr;
        }

        // is full text selected?
        const isFullText = (startNode === endNode && startNode.nodeType === 3 && startOffset === 0 && endOffset === startNode.nodeValue.length);

        allCardRoots.forEach(otherRoot => {
            if (otherRoot === cardRoot) return;
            const targetStart = getNodeByPath(otherRoot, startPath);
            const targetEnd = getNodeByPath(otherRoot, endPath);
            
            if (targetStart && targetEnd) {
                let finalStartOffset = startOffset;
                let finalEndOffset = endOffset;

                if (isFullText) {
                    finalEndOffset = targetEnd.nodeValue ? targetEnd.nodeValue.length : 0;
                } else {
                    if (targetStart.nodeType === 3 && finalStartOffset > targetStart.nodeValue.length) finalStartOffset = targetStart.nodeValue.length;
                    if (targetEnd.nodeType === 3 && finalEndOffset > targetEnd.nodeValue.length) finalEndOffset = targetEnd.nodeValue.length;
                }

                try {
                    const newRange = document.createRange();
                    newRange.setStart(targetStart, finalStartOffset);
                    newRange.setEnd(targetEnd, finalEndOffset);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    document.execCommand("foreColor", false, color);
                } catch(err) {}
            }
        });
        sel.removeAllRanges();
    }
  });

  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) {
      floatingToolbar.style.display = "none";
      return;
    }

    // Check if selection is within admit card or result preview
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const node = container.nodeType === 3 ? container.parentNode : container;
    
    if (!node.closest || (!node.closest("#admitPreviewContainer") && !node.closest("#resultPreviewContainer"))) {
      floatingToolbar.style.display = "none";
      return;
    }

    const rect = range.getBoundingClientRect();
    floatingToolbar.style.display = "flex";
    floatingToolbar.style.top = (rect.top + window.scrollY - 45) + "px";
    floatingToolbar.style.left = (rect.left + window.scrollX + rect.width / 2 - floatingToolbar.offsetWidth / 2) + "px";
  });

  // ==========================================
  // EXAM TEMPLATE DESIGNER (WYSIWYG + Canva-style)
  // ==========================================

  const designerModal = document.createElement("div");
  designerModal.id = "examTemplateDesignerModal";
  designerModal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8);
    z-index: 100000; display: none; flex-direction: column; align-items: center; justify-content: center;
  `;

  designerModal.innerHTML = `
    <div style="width: 100%; height: 100%; background: #f8fafc; display: flex; flex-direction: column; overflow: hidden;">
      
      <!-- MS Word Style Ribbon -->
      <div style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; display: flex; flex-direction: column; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10;">
        
        <!-- Tabs -->
        <div style="display: flex; gap: 20px; padding: 5px 20px; background: #1e3a8a; color: white; font-size: 13px;">
          <span class="ribbon-tab active" data-target="tabHome" style="cursor: pointer; padding: 5px 10px; border-bottom: 2px solid white; font-weight: bold;">Home</span>
          <span class="ribbon-tab" data-target="tabInsert" style="cursor: pointer; padding: 5px 10px;">Insert</span>
          <span class="ribbon-tab" data-target="tabDesign" style="cursor: pointer; padding: 5px 10px;">Design</span>
          
          <div style="margin-left: auto; display: flex; gap: 10px;">
            <button id="tdDeleteBtn" style="padding: 4px 16px; background: #b91c1c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" title="Delete your custom template completely">Delete Template</button>
            <button id="tdCancelBtn" style="padding: 4px 16px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Close</button>
            <button id="tdSaveBtn" style="padding: 4px 16px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Save Template</button>
          </div>
        </div>
        
        <!-- Ribbon Content -->
        <div style="padding: 10px 20px; display: flex; gap: 20px; align-items: center; background: #f8fafc; min-height: 70px;">
          
          <!-- Home Tab -->
          <div id="tabHome" class="ribbon-pane" style="display: flex; gap: 15px; align-items: center; width: 100%;">
            <!-- Font Group -->
            <div style="display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #cbd5e1; padding-right: 15px;">
              <div style="display: flex; gap: 5px;">
                <select onchange="document.execCommand('fontName', false, this.value)" style="padding: 4px; width: 140px; border: 1px solid #cbd5e1; border-radius: 4px;">
                  <option value="Inter">Inter (Default)</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                </select>
                <select onchange="document.execCommand('fontSize', false, this.value)" style="padding: 4px; width: 60px; border: 1px solid #cbd5e1; border-radius: 4px;">
                  <option value="1">10px</option>
                  <option value="2">13px</option>
                  <option value="3" selected>16px</option>
                  <option value="4">18px</option>
                  <option value="5">24px</option>
                  <option value="6">32px</option>
                  <option value="7">48px</option>
                </select>
              </div>
              <div style="display: flex; gap: 5px; align-items: center;">
                <button onclick="document.execCommand('bold',false,null)" style="padding: 4px 10px; font-weight: bold; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">B</button>
                <button onclick="document.execCommand('italic',false,null)" style="padding: 4px 10px; font-style: italic; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">I</button>
                <button onclick="document.execCommand('underline',false,null)" style="padding: 4px 10px; text-decoration: underline; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">U</button>
                <div style="width: 1px; height: 20px; background: #cbd5e1; margin: 0 5px;"></div>
                <input type="color" id="tdColorPicker" title="Text Color" style="cursor: pointer; width: 28px; height: 28px; padding: 0; border: none; border-radius: 4px;">
                <input type="color" oninput="document.execCommand('hiliteColor', false, this.value)" title="Highlight Color" value="#ffff00" style="cursor: pointer; width: 28px; height: 28px; padding: 0; border: none; border-radius: 4px;">
              </div>
              <span style="font-size: 11px; color: #64748b; text-align: center; font-weight: 500;">Font</span>
            </div>
      
            <!-- Paragraph Group -->
            <div style="display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #cbd5e1; padding-right: 15px;">
              <div style="display: flex; gap: 5px;">
                <button onclick="document.execCommand('insertUnorderedList',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">• Bullet</button>
                <button onclick="document.execCommand('insertOrderedList',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">1. Number</button>
              </div>
              <div style="display: flex; gap: 5px;">
                <button onclick="document.execCommand('justifyLeft',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">Left</button>
                <button onclick="document.execCommand('justifyCenter',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">Center</button>
                <button onclick="document.execCommand('justifyRight',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">Right</button>
                <button onclick="document.execCommand('justifyFull',false,null)" style="padding: 4px 10px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px;">Justify</button>
              </div>
              <span style="font-size: 11px; color: #64748b; text-align: center; font-weight: 500;">Paragraph</span>
            </div>
          </div>
      
          <!-- Insert Tab -->
          <div id="tabInsert" class="ribbon-pane" style="display: none; gap: 15px; align-items: center; width: 100%;">
            <!-- Magic Data -->
            <div style="display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #cbd5e1; padding-right: 15px; align-items: center; justify-content: center; height: 100%;">
              <select id="tdVariableSelect" style="padding: 6px; width: 180px; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: bold;">
                <option value="">Insert Data Field...</option>
                <option value="{studentName}">Student Name</option>
                <option value="{className}">Class</option>
                <option value="{rollNo}">Roll No</option>
                <option value="{admissionNo}">Admission No</option>
                <option value="{fatherName}">Father Name</option>
                <option value="{motherName}">Mother Name</option>
                <option value="{examName}">Exam Name</option>
                <option value="{schoolName}">School Name</option>
                <option value="{studentPhoto}">Student Photo (Image)</option>
                <option value="{marksTable}">Marks Table (Result Only)</option>
                <option value="{totalMarks}">Total Marks</option>
                <option value="{percentage}">Percentage</option>
                <option value="{grade}">Grade</option>
                <option value="{resultStatus}">Result (Pass/Fail)</option>
              </select>
              <span style="font-size: 11px; color: #64748b; text-align: center; font-weight: 500;">Magic Data</span>
            </div>
            
            <!-- Objects -->
            <div style="display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #cbd5e1; padding-right: 15px; align-items: center; justify-content: center; height: 100%;">
              <div style="display: flex; gap: 5px;">
                <button id="tdAddBoxBtn" style="padding: 6px 12px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; display: flex; align-items: center; gap: 5px;">
                  <span style="font-size: 16px;">T</span> Text Box
                </button>
                <button id="tdAddPhotoBtn" style="padding: 6px 12px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; display: flex; align-items: center; gap: 5px;">
                  🖼️ Photo Frame
                </button>
                <label style="padding: 6px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                  📸 Local Image <input type="file" id="tdImageUpload" accept="image/*" style="display:none;">
                </label>
              </div>
              <div style="display: flex; gap: 5px;">
                <select id="tdShapeSelect" style="padding: 4px; width: 150px; border: 1px solid #cbd5e1; border-radius: 4px;">
                  <option value="">+ Insert Shape...</option>
                  <option value="square">⬛ Square / Rectangle</option>
                  <option value="circle">⏺ Circle / Oval</option>
                  <option value="line">➖ Horizontal Line</option>
                </select>
              </div>
              <span style="font-size: 11px; color: #64748b; text-align: center; font-weight: 500;">Illustrations & Objects</span>
            </div>
          </div>
      
          <!-- Design Tab -->
          <div id="tabDesign" class="ribbon-pane" style="display: none; gap: 15px; align-items: center; width: 100%;">
            <div style="display: flex; flex-direction: column; gap: 5px; border-right: 1px solid #cbd5e1; padding-right: 15px; align-items: center;">
              <div style="display: flex; gap: 10px; align-items: center; padding: 10px;">
                <span style="font-size: 14px; font-weight: 500;">Page Background Color:</span>
                <input type="color" oninput="document.getElementById('tdCanvas').style.backgroundColor = this.value" value="#ffffff" style="cursor: pointer; width: 32px; height: 32px; padding: 0; border: none; border-radius: 4px;">
              </div>
              <span style="font-size: 11px; color: #64748b; text-align: center; font-weight: 500;">Page Background</span>
            </div>
          </div>
          
        </div>
      </div>
      
      <!-- Canvas Area -->
      <div style="flex: 1; overflow: auto; background: #cbd5e1; padding: 40px; display: flex; justify-content: center; position: relative;">
        <!-- Canvas wrapper for absolute positioning bounds -->
        <div id="tdCanvasWrapper" style="width: 210mm; min-height: 297mm; background: transparent; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          <div id="tdCanvas" style="width: 100%; min-height: 100%; background: white; padding: 20mm; box-sizing: border-box; position: relative; font-family: 'Inter', sans-serif; color: #000; outline: none; line-height: 1.5; z-index: 1;" contenteditable="true">
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(designerModal);

  let currentDesignerMode = "admit"; // "admit" or "result"

  const tdCanvas = document.getElementById("tdCanvas");
  const tdColorPicker = document.getElementById("tdColorPicker");
  const tdVariableSelect = document.getElementById("tdVariableSelect");
  
  // Ribbon Tab Switching Logic
  const tabs = document.querySelectorAll(".ribbon-tab");
  const panes = document.querySelectorAll(".ribbon-pane");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => {
        t.style.borderBottom = "none";
        t.style.fontWeight = "normal";
      });
      tab.style.borderBottom = "2px solid white";
      tab.style.fontWeight = "bold";
      
      panes.forEach(p => p.style.display = "none");
      document.getElementById(tab.dataset.target).style.display = "flex";
    });
  });

  tdColorPicker.addEventListener("input", (e) => {
    document.execCommand("foreColor", false, e.target.value);
  });

  tdVariableSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      document.execCommand("insertText", false, e.target.value);
      e.target.value = "";
    }
  });

  // Helper to make shapes draggable and resizeable
  function makeDraggableAndResizeable(box) {
    box.contentEditable = "true";
    box.className = "td-floating-box";
    box.style.position = "absolute";
    box.style.cursor = "move";
    box.style.zIndex = "10";
    // Add resize styling
    box.style.resize = "both";
    box.style.overflow = "hidden";
    
    // Prevent drag when focused to allow text editing
    box.addEventListener("mousedown", (e) => {
      if (box === document.activeElement) {
        e.stopPropagation();
      }
    });
    return box;
  }

  // Floating Text Box Logic
  document.getElementById("tdAddBoxBtn").addEventListener("click", () => {
    const box = document.createElement("div");
    makeDraggableAndResizeable(box);
    box.style.top = "50px";
    box.style.left = "50px";
    box.style.width = "150px";
    box.style.minHeight = "50px";
    box.style.border = "2px dashed #94a3b8";
    box.style.padding = "10px";
    box.style.background = "rgba(255,255,255,0.8)";
    box.innerHTML = "Floating Box";
    
    tdCanvas.appendChild(box);
  });

  document.getElementById("tdAddPhotoBtn").addEventListener("click", () => {
    const box = document.createElement("div");
    makeDraggableAndResizeable(box);
    box.style.top = "50px";
    box.style.right = "50px";
    box.style.width = "100px";
    box.style.height = "120px";
    box.style.border = "2px solid #000";
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.justifyContent = "center";
    box.style.background = "#f8fafc";
    box.contentEditable = "false"; // Photo frames don't need text
    box.innerHTML = "<b>{studentPhoto}</b>";
    tdCanvas.appendChild(box);
  });

  // Image Upload Logic
  document.getElementById("tdImageUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const box = document.createElement("div");
      makeDraggableAndResizeable(box);
      box.style.top = "50px";
      box.style.left = "50px";
      box.style.width = "150px";
      box.style.height = "150px";
      box.contentEditable = "false";
      
      const img = document.createElement("img");
      img.src = event.target.result;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      
      box.appendChild(img);
      tdCanvas.appendChild(box);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset
  });

  // Shapes Logic
  document.getElementById("tdShapeSelect").addEventListener("change", (e) => {
    const shape = e.target.value;
    if (!shape) return;
    
    const box = document.createElement("div");
    makeDraggableAndResizeable(box);
    box.style.top = "100px";
    box.style.left = "100px";
    box.contentEditable = "false";
    
    if (shape === "square") {
      box.style.width = "100px";
      box.style.height = "100px";
      box.style.background = "#3b82f6";
      box.style.border = "2px solid #1d4ed8";
    } else if (shape === "circle") {
      box.style.width = "100px";
      box.style.height = "100px";
      box.style.background = "#ef4444";
      box.style.border = "2px solid #b91c1c";
      box.style.borderRadius = "50%";
    } else if (shape === "line") {
      box.style.width = "200px";
      box.style.height = "4px";
      box.style.background = "#0f172a";
      box.style.resize = "horizontal"; // Only width resize for line
    }
    
    tdCanvas.appendChild(box);
    e.target.value = "";
  });

  // Canva-style Drag and Drop Logic
  let draggedElement = null;
  let offsetX = 0, offsetY = 0;

  tdCanvas.addEventListener("mousedown", (e) => {
    if (e.target.classList.contains("td-floating-box") && e.target !== document.activeElement) {
      draggedElement = e.target;
      const rect = draggedElement.getBoundingClientRect();
      
      // Calculate offset relative to the element's top-left corner
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (draggedElement) {
      const canvasRect = tdCanvas.getBoundingClientRect();
      let left = e.clientX - canvasRect.left - offsetX;
      let top = e.clientY - canvasRect.top - offsetY;

      // Bound to canvas
      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left + draggedElement.offsetWidth > canvasRect.width) left = canvasRect.width - draggedElement.offsetWidth;
      if (top + draggedElement.offsetHeight > canvasRect.height) top = canvasRect.height - draggedElement.offsetHeight;

      draggedElement.style.left = left + "px";
      draggedElement.style.top = top + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    if (draggedElement) {
      draggedElement = null;
    }
  });

  // Removed the change listener that hides the buttons

  document.body.addEventListener("click", (e) => {
    if (e.target.id === "btnOpenAdmitDesigner" || e.target.id === "btnOpenResultDesigner") {
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      
      const mockConfig = { fontColor: "#000", bgColor: "#fff", bgOpacity: 0, bgType: "solid" };
      const mockData = {
        examName: "{examName}", session: "{session}", className: "{className}",
        studentName: "{studentName}", fullName: "{studentName}", rollNo: "{rollNo}", admissionNo: "{admissionNo}",
        fatherName: "{fatherName}", motherName: "{motherName}", studentPhoto: "{studentPhoto}", photo: "{studentPhoto}",
        totalMarks: "{totalMarks}", percentage: "{percentage}", grade: "{grade}", resultStatus: "{resultStatus}",
        subjectMarks: "[]"
      };

      if (e.target.id === "btnOpenAdmitDesigner") {
        currentDesignerMode = "admit";
        const theme = document.getElementById("admitTemplateStyle").value;
        let tpl = "";
        
        if (theme === "custom_blank") {
          tpl = "<div style='text-align:center;'><h1>{schoolName}</h1><h2>ADMIT CARD - {examName}</h2></div><p>Name: <b>{studentName}</b></p>";
          if (store.settings) {
              const setting = store.settings.find(s => s.key === "customAdmitTemplate");
              if (setting) tpl = setting.value;
          }
          if (store.customAdmitTemplate) tpl = store.customAdmitTemplate;
        } else {
          // Generate raw HTML for the selected theme using our mock placeholders
          let cardHtml = '';
          if (theme.startsWith('dyn_')) {
              cardHtml = typeof generateDynamicAdmitCard === 'function' ? generateDynamicAdmitCard(mockData, "{examName}", theme, mockConfig) : "";
          } else if (theme === 'primary') {
              cardHtml = typeof getPrimaryAdmitCardHtml === 'function' ? getPrimaryAdmitCardHtml(mockData, "{examName}", mockConfig) : "";
          } else if (theme === 'state') {
              cardHtml = typeof getMiddleAdmitCardHtml === 'function' ? getMiddleAdmitCardHtml(mockData, "{examName}", mockConfig) : "";
          } else {
              cardHtml = typeof getHighSchoolAdmitCardHtml === 'function' ? getHighSchoolAdmitCardHtml(mockData, "{examName}", mockConfig) : "";
          }
          tpl = cardHtml;
        }
        
        tdCanvas.innerHTML = tpl;
        designerModal.style.display = "flex";
      }
      
      if (e.target.id === "btnOpenResultDesigner") {
        currentDesignerMode = "result";
        const theme = document.getElementById("resultThemeSelect").value;
        let tpl = "";
        
        if (theme === "custom_blank") {
          tpl = "<div style='text-align:center;'><h1>{schoolName}</h1><h2>MARKSHEET - {examName}</h2></div><p>Name: <b>{studentName}</b></p><br>{marksTable}";
          if (store.settings) {
              const setting = store.settings.find(s => s.key === "customResultTemplate");
              if (setting) tpl = setting.value;
          }
          if (store.customResultTemplate) tpl = store.customResultTemplate;
        } else {
          // Add dummy subjects so a table is rendered, using placeholders for dynamic row generation later
          mockData.subjectMarks = JSON.stringify([{subject: "{subject}", max: "{max}", min: "{min}", theory: "{theory}", practical: "{prac}", total: "{total}"}]);
          tpl = typeof getMarksheetHtml === 'function' ? getMarksheetHtml(mockData, theme, mockConfig) : "";
        }
        
        tdCanvas.innerHTML = tpl;
        designerModal.style.display = "flex";
      }
    }
  });

  document.getElementById("tdCancelBtn").addEventListener("click", () => {
    designerModal.style.display = "none";
  });

  document.getElementById("tdDeleteBtn").addEventListener("click", async () => {
    if (!confirm("Are you sure you want to delete your custom template? This will revert to the default.")) return;
    
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const key = currentDesignerMode === "admit" ? "customAdmitTemplate" : "customResultTemplate";
    store[key] = ""; // clear from store

    const btn = document.getElementById("tdDeleteBtn");
    btn.textContent = "Deleting...";
    btn.disabled = true;

    try {
      await window.api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ key: key, value: "", category: "ExamTemplates" })
      });
      alert("Template deleted successfully! Reverted to default.");
      
      // Auto-switch dropdown back to default Premium Theme 1
      if (currentDesignerMode === "admit") {
        document.getElementById("admitTemplateStyle").value = "theme1";
      } else {
        document.getElementById("resultThemeSelect").value = "theme1";
      }
    } catch (err) {
      alert("Failed to delete template. Please try again.");
    }
    
    btn.textContent = "Delete Template";
    btn.disabled = false;
    designerModal.style.display = "none";
  });

  document.getElementById("tdSaveBtn").addEventListener("click", async () => {
    const btn = document.getElementById("tdSaveBtn");
    btn.textContent = "Saving...";
    btn.disabled = true;

    // Remove dashed borders from floating boxes before saving
    const clone = tdCanvas.cloneNode(true);
    clone.querySelectorAll(".td-floating-box").forEach(el => {
      if (el.style.border.includes("dashed")) {
        el.style.border = "none";
      }
    });

    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const key = currentDesignerMode === "admit" ? "customAdmitTemplate" : "customResultTemplate";
    store[key] = clone.innerHTML;

    try {
      await window.api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ key: key, value: clone.innerHTML, category: "ExamTemplates" })
      });
      
      // Auto-switch the dropdown so they use what they just built
      if (currentDesignerMode === "admit") {
        document.getElementById("admitTemplateStyle").value = "custom_blank";
      } else {
        document.getElementById("resultThemeSelect").value = "custom_blank";
      }

      alert("Custom template saved successfully! Click 'Generate' to see the preview.");
    } catch (err) {
      alert("Failed to save template. Please try again.");
    }

    btn.textContent = "Save Template";
    btn.disabled = false;
    designerModal.style.display = "none";
  });

  // Auto-sync text typing across all preview cards
  let isSyncingText = false;
  const textSyncObserver = new MutationObserver((mutations) => {
      if (isSyncingText) return;
      const modal = document.getElementById("examTemplateDesignerModal");
      const isPreviewMode = !modal || modal.style.display === "none";
      if (!isPreviewMode) return;

      let hasValidMutation = false;
      let targetNode = null;
      let newValue = null;
      let oldValue = null;

      for (let mutation of mutations) {
          if (mutation.type === 'characterData') {
              let current = mutation.target;
              let isValid = false;
              while (current && current !== document.body) {
                  if (current.id === "admitPreviewContainer" || current.id === "resultPreviewContainer") {
                      isValid = true; break;
                  }
                  current = current.parentNode;
              }
              if (isValid) {
                  targetNode = mutation.target;
                  newValue = targetNode.nodeValue;
                  oldValue = mutation.oldValue;
                  hasValidMutation = true; break;
              }
          }
      }

      if (hasValidMutation && targetNode) {
          let containerId = null;
          let current = targetNode;
          while (current && current !== document.body) {
              if (current.id === "admitPreviewContainer" || current.id === "resultPreviewContainer") {
                  containerId = current.id; break;
              }
              current = current.parentNode;
          }
          
          const container = document.getElementById(containerId);
          let cardRoot = null;
          current = targetNode;
          while (current && current !== container) {
              if (containerId === "admitPreviewContainer") {
                  if (current.parentNode && current.parentNode.parentNode === container) {
                      cardRoot = current; break;
                  }
              } else {
                  if (current.parentNode === container) {
                      cardRoot = current; break;
                  }
              }
              current = current.parentNode;
          }
          if (!cardRoot) return;

          function getDomPath(element, root) {
              let path = [];
              let curr = element;
              while (curr && curr !== root) {
                  let index = 0;
                  let sibling = curr.previousSibling;
                  while (sibling) {
                      index++; sibling = sibling.previousSibling;
                  }
                  path.unshift(index);
                  curr = curr.parentNode;
              }
              return path;
          }

          const path = getDomPath(targetNode, cardRoot);
          const allCardRoots = [];
          if (containerId === "admitPreviewContainer") {
              Array.from(container.children).forEach(page => {
                  if (!page.classList.contains('empty-state')) {
                     Array.from(page.children).forEach(card => allCardRoots.push(card));
                  }
              });
          } else {
              Array.from(container.children).forEach(card => {
                  if (!card.classList.contains('empty-state')) allCardRoots.push(card);
              });
          }

          function getNodeByPath(root, p) {
              let curr = root;
              for (let index of p) {
                  if (!curr || !curr.childNodes || index >= curr.childNodes.length) return null;
                  curr = curr.childNodes[index];
              }
              return curr;
          }

          isSyncingText = true;
          allCardRoots.forEach(otherRoot => {
              if (otherRoot === cardRoot) return;
              const tNode = getNodeByPath(otherRoot, path);
              if (tNode && tNode.nodeType === 3) {
                  if (tNode.nodeValue === oldValue) {
                      tNode.nodeValue = newValue;
                  }
              }
          });
          setTimeout(() => { isSyncingText = false; }, 10);
      }
  });
  textSyncObserver.observe(document.body, { characterData: true, subtree: true, characterDataOldValue: true });

})();

window.generateAIRemark = async function(btn) {
    const studentName = btn.getAttribute('data-student');
    const grade = btn.getAttribute('data-grade');
    const percentage = btn.getAttribute('data-perc');
    
    const targetSpan = btn.parentElement.querySelector('.ai-remark-target');
    if (!targetSpan) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...';
    btn.disabled = true;
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/ai/generate-remark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ studentName, grade, percentage })
        });
        const data = await res.json();
        if (data.remark) {
            targetSpan.innerText = data.remark;
        } else {
            targetSpan.innerText = "Error generating remark.";
        }
    } catch (err) {
        targetSpan.innerText = "Error connecting to AI.";
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
};


function getThoAdmitCardHtml(student, examName, config) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const schoolName = store.schoolName || "TALENT HUNT OLYMPIAD";
    const admNo = student.admissionNo || '-';
    const photoUrl = student.photo || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    
    // Exact layout from the screenshot (3 columns)
    return `
    <div style="width: 210mm; background: #fff; border: 2px solid #b32a22; padding: 3px; font-family: 'Arial', sans-serif; box-sizing: border-box; page-break-inside: avoid; margin-bottom: 20px;">
        <div style="border: 1px solid #b32a22; display: flex; width: 100%; height: auto; align-items: stretch;">
            
            <!-- Left Column: Branding -->
            <div style="width: 30%; background: #c5d886; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-right: 2px solid #fff;">
                <div style="padding: 10px;">
                    <h1 style="margin: 0; color: #000; font-size: 42px; font-weight: 900; letter-spacing: 5px;">T<span style="color:#d8bc3a">H</span>O</h1>
                    <div style="font-size: 10px; font-weight: bold; margin-top: -5px;">TALENT HUNT OLYMPIAD</div>
                </div>
                <div style="width: 100%; background: #92b742; color: #fff; font-weight: bold; font-size: 14px; padding: 8px 0; text-align: center; margin: 10px 0;">
                    ADMIT CARD
                </div>
                <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                    <div style="font-size: 9px; font-weight: bold; margin-bottom: 2px;">Head Office :</div>
                    <div style="font-size: 9px;">${store.schoolAddress || 'Plot No. 99, Sector 44, Gurgaon-122 003 (HR)'}</div>
                    <div style="font-size: 9px;">Tel : ${store.schoolPhone || '0124-4951200'}</div>
                    <div style="font-size: 9px;">e-mail : ${store.schoolEmail || 'info@sofworld.org'}</div>
                </div>
            </div>

            <!-- Middle Column: Details -->
            <div style="flex: 1; background: #fff; padding: 20px; font-size: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; width: 130px;">Date of Exam :</td>
                        <td style="padding: 8px 0; font-weight: bold;" contenteditable="true">SUNDAY, 16th FEBRUARY, 2026</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">Reporting Time :</td>
                        <td style="padding: 8px 0; font-weight: bold;" contenteditable="true">12:30 P.M</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">Time of Exam :</td>
                        <td style="padding: 8px 0; font-weight: bold;" contenteditable="true">1:00 - 2:00 P.M</td>
                    </tr>
                    <tr><td colspan="2" style="height: 15px;"></td></tr>
                    <tr>
                        <td style="padding: 8px 0;">Name of the Candidate :</td>
                        <td style="padding: 8px 0; font-weight: bold; text-transform: uppercase;" contenteditable="true">${student.fullName}</td>
                    </tr>
                </table>
                <div style="display: flex; margin-top: 15px;">
                    <div style="flex: 1;">Class : <span style="font-weight: bold;" contenteditable="true">${student.className}</span></div>
                    <div style="flex: 1;">Roll No. : <span style="font-weight: bold;" contenteditable="true">${student.rollNo || '-'}</span></div>
                </div>
                <div style="margin-top: 20px;">
                    <div style="margin-bottom: 5px;">Centre of Examination :</div>
                    <div style="font-weight: bold; text-transform: uppercase;" contenteditable="true">
                        ${store.schoolName || 'MAHARANA PRATAP PUBLIC SCHOOL'}<br/>
                        ${store.schoolAddress || 'OPP. SMALL RAILWAY STATION KURUKSHETRA UNIVERSITY ROAD (THANESAR)'}
                    </div>
                </div>
            </div>

            <!-- Right Column: Photo & Signatures -->
            <div style="width: 25%; background: #dae5b3; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 10px; border-left: 2px solid #fff;">
                <div style="width: 120px; height: 140px; background: #fff; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; color: #666; padding: 10px;">
                    <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover; display: ${student.photo ? 'block' : 'none'};" />
                    <span style="display: ${student.photo ? 'none' : 'block'};">PHOTO<br/>Candidate should paste his/her recent passport size photograph here attested by the School Principal.</span>
                </div>
                <div style="text-align: center; margin-top: 20px; width: 100%;">
                    <div style="height: 30px;"></div>
                    <div style="font-size: 10px;">Signature of the candidate</div>
                </div>
                <div style="text-align: center; margin-top: 20px; width: 100%;">
                    <div style="height: 40px; display:flex; align-items:flex-end; justify-content:center;">
                        <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='30' viewBox='0 0 100 30'><path d='M10,20 Q30,5 50,20 T90,10' fill='none' stroke='%23000' stroke-width='2'/></svg>" style="height: 30px; opacity: 0.7;"/>
                    </div>
                    <div style="font-size: 12px; font-weight: bold;">Chairman</div>
                </div>
            </div>

        </div>
    </div>
    `;
}
