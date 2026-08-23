// reports_module.js

const { useState, useEffect, useRef } = window.React;
const el = window.React.createElement;

function AnalyticsApp() {
  const [tab, setTab] = useState('school');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedExam, setSelectedExam] = useState('All Exams');

  const academicRef = useRef(null);
  const attendanceRef = useRef(null);
  const feesRef = useRef(null);
  const chartsRef = useRef({});

  const store = window.getStore ? window.getStore() : { students: [], exams: [], attendance: [], fees: [] };
  const classes = Array.from(new Set((store.students || []).map(s => s.className).filter(Boolean))).sort();
  const studentsInClass = (store.students || []).filter(s => s.className === selectedClass).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const examList = Array.from(new Set((store.exams || []).map(e => e.examName).filter(Boolean))).sort();

  // Handle Tab Switching
  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSelectedClass('');
    setSelectedStudent('');
    setSelectedExam('All Exams');
  };

  useEffect(() => {
    // Destroy previous charts
    Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());
    chartsRef.current = {};

    let filterClass = null;
    let filterStudent = null;

    if (tab === 'class') {
      filterClass = selectedClass;
      if (!filterClass) return; // Wait for selection
    } else if (tab === 'student') {
      filterClass = selectedClass;
      filterStudent = selectedStudent;
      if (!filterClass || !filterStudent) return; // Wait for selection
    }

    if (academicRef.current) drawAcademicChart(academicRef.current, store, filterClass, filterStudent, tab, chartsRef, selectedExam);
    if (attendanceRef.current) drawAttendanceChart(attendanceRef.current, store, filterClass, filterStudent, chartsRef);
    if (feesRef.current) drawFeesChart(feesRef.current, store, filterClass, filterStudent, chartsRef);

    // Cleanup on unmount
    return () => {
      Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());
    };
  }, [tab, selectedClass, selectedStudent, selectedExam]);

  return el('div', { style: { padding: '10px' } },
    el('div', { className: 'panel-head', style: { marginBottom: '15px' } },
      el('h3', null, 'Report & Analytics (React)'),
      el('div', { className: 'panel-actions' },
        el('button', { className: `dark ${tab === 'school' ? 'active' : ''}`, onClick: () => handleTabChange('school') }, 'School Overview'),
        el('button', { className: `dark ${tab === 'class' ? 'active' : ''}`, onClick: () => handleTabChange('class') }, 'Class Wise'),
        el('button', { className: `dark ${tab === 'student' ? 'active' : ''}`, onClick: () => handleTabChange('student') }, 'Single Student')
      )
    ),

    el('div', { style: { marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' } },
      tab === 'school' && el('div', { style: { display: 'flex', alignItems: 'center', gap: '15px', width: '100%', flexWrap: 'wrap' } },
        el('span', { style: { color: '#475569', fontWeight: 500, marginRight: 'auto' } }, 'Showing overall analytics for the entire school.'),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('label', { htmlFor: 'exam-filter', style: { color: '#475569', fontSize: '0.9rem', fontWeight: 500 } }, 'Exam Type:'),
          el('select', {
            id: 'exam-filter',
            value: selectedExam,
            onChange: (e) => setSelectedExam(e.target.value),
            style: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', minWidth: '160px' }
          },
            el('option', { value: 'All Exams' }, 'All Exams'),
            examList.map(name => el('option', { key: name, value: name }, name))
          )
        )
      ),
      
      (tab === 'class' || tab === 'student') && el('select', {
        value: selectedClass,
        onChange: (e) => {
          setSelectedClass(e.target.value);
          setSelectedStudent(''); // Reset student when class changes
        },
        style: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }
      },
        el('option', { value: '' }, '-- Select Class --'),
        classes.map(c => el('option', { key: c, value: c }, c))
      ),

      tab === 'student' && el('select', {
        value: selectedStudent,
        onChange: (e) => setSelectedStudent(e.target.value),
        disabled: !selectedClass,
        style: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', minWidth: '200px' }
      },
        el('option', { value: '' }, '-- Select Student --'),
        studentsInClass.map(s => el('option', { key: s.fullName, value: s.fullName }, `${s.fullName} (${s.admissionNo})`))
      )
    ),

    el('div', { 
      style: { 
        marginTop: '20px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '20px',
        alignItems: 'start'
      }
    },
      /* Academic Chart Container */
      el('div', { style: { background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', height: '100%' } },
        el('h4', { style: { margin: '0 0 15px 0', color: '#1e293b' } }, tab === 'school' ? 'Academic Growth (Classes)' : 'Academic Growth (Exams)'),
        el('div', { style: { height: '280px', width: '100%', position: 'relative' } },
          el('canvas', { ref: academicRef })
        )
      ),

      /* Attendance Chart Container */
      el('div', { style: { background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', height: '100%' } },
        el('h4', { style: { margin: '0 0 15px 0', color: '#1e293b' } }, 'Attendance Overview'),
        el('div', { style: { height: '280px', width: '100%', position: 'relative', display: 'flex', justifyContent: 'center' } },
          el('canvas', { ref: attendanceRef })
        )
      ),

      /* Fees Chart Container */
      el('div', { style: { background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', height: '100%' } },
        el('h4', { style: { margin: '0 0 15px 0', color: '#1e293b' } }, 'Fee Collection Status'),
        el('div', { style: { height: '280px', width: '100%', position: 'relative', display: 'flex', justifyContent: 'center' } },
          el('canvas', { ref: feesRef })
        )
      )
    )
  );
}

// Chart Rendering Logic (Pure JS)
function drawAcademicChart(canvasElement, store, filterClass, filterStudent, tab, chartsRef, selectedExam) {
  const exams = store.exams || [];
  let filtered = exams;
  let labels = [];
  let data = [];

  if (tab === 'school') {
    if (selectedExam && selectedExam !== 'All Exams') {
      filtered = filtered.filter(e => e.examName === selectedExam);
    }
    const classGroups = {};
    filtered.forEach(e => {
      if (!e.className) return;
      if (!classGroups[e.className]) classGroups[e.className] = [];
      const p = parseFloat(e.percentage);
      if (!isNaN(p)) classGroups[e.className].push(p);
    });

    labels = Object.keys(classGroups).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    data = labels.map(cls => {
      const arr = classGroups[cls];
      if (arr.length === 0) return 0;
      const sum = arr.reduce((a, b) => a + b, 0);
      return (sum / arr.length).toFixed(2);
    });
  } else {
    if (filterStudent) {
      filtered = filtered.filter(e => e.studentName === filterStudent && e.className === filterClass);
    } else if (filterClass) {
      filtered = filtered.filter(e => e.className === filterClass);
    }

    const examGroups = {};
    filtered.forEach(e => {
      if (!examGroups[e.examName]) examGroups[e.examName] = [];
      const p = parseFloat(e.percentage);
      if (!isNaN(p)) examGroups[e.examName].push(p);
    });

    labels = Object.keys(examGroups);
    data = labels.map(exam => {
      const arr = examGroups[exam];
      if (arr.length === 0) return 0;
      const sum = arr.reduce((a, b) => a + b, 0);
      return (sum / arr.length).toFixed(2);
    });
  }

  const ctx = canvasElement.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  chartsRef.current['academic'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: tab === 'school' ? 'Class Average (%)' : 'Average Percentage (%)',
        data: data,
        backgroundColor: gradient,
        borderColor: '#3b82f6',
        borderWidth: 3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) { return context.parsed.y + '%'; }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9', drawBorder: false } },
        x: { grid: { display: false, drawBorder: false } }
      }
    }
  });
}

function drawAttendanceChart(canvasElement, store, filterClass, filterStudent, chartsRef) {
  const att = store.attendance || [];
  let filtered = att;
  
  if (filterStudent) {
    filtered = filtered.filter(a => a.studentName === filterStudent && a.className === filterClass);
  } else if (filterClass) {
    filtered = filtered.filter(a => a.className === filterClass);
  }

  let present = 0, absent = 0, late = 0, leave = 0;
  filtered.forEach(a => {
    if (a.status === 'Present') present++;
    else if (a.status === 'Absent') absent++;
    else if (a.status === 'Late') late++;
    else if (a.status === 'Leave') leave++;
  });

  const ctx = canvasElement.getContext('2d');
  chartsRef.current['attendance'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent', 'Late', 'Leave'],
      datasets: [{
        data: [present, absent, late, leave],
        backgroundColor: ['#2c5282', '#e53e3e', '#ecc94b', '#63b3ed'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { backgroundColor: '#1e293b', cornerRadius: 8, padding: 10 }
      }
    }
  });
}

function drawFeesChart(canvasElement, store, filterClass, filterStudent, chartsRef) {
  const fees = store.fees || [];
  let filtered = fees;
  
  if (filterStudent) {
    filtered = filtered.filter(f => f.studentName === filterStudent && f.className === filterClass);
  } else if (filterClass) {
    filtered = filtered.filter(f => f.className === filterClass);
  }

  let totalCollected = 0, totalPending = 0;
  filtered.forEach(f => {
    totalCollected += parseFloat(f.paidAmount) || 0;
    totalPending += parseFloat(f.balance) || 0;
  });

  const ctx = canvasElement.getContext('2d');
  chartsRef.current['fees'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Collected Amount (₹)', 'Pending Balance (₹)'],
      datasets: [{
        data: [totalCollected, totalPending],
        backgroundColor: ['#2b6cb0', '#90cdf4'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { backgroundColor: '#1e293b', cornerRadius: 8, padding: 10 }
      }
    }
  });
}

// ----------------------------------------------------
// Mounting Logic
// ----------------------------------------------------
let reactRoot = null;

window.renderReportsModule = function() {
  const reportsPanel = document.getElementById("reportsPanel");
  if (!reportsPanel) return;

  reportsPanel.classList.remove("hidden");
  reportsPanel.style.display = "block";

  // If React root doesn't exist yet, create it inside the reportsPanel
  if (!reactRoot) {
    // Clear out the static HTML that was in index.html
    reportsPanel.innerHTML = "";
    reactRoot = window.ReactDOM.createRoot(reportsPanel);
  }

  // Render the React app
  reactRoot.render(window.React.createElement(AnalyticsApp));
};
