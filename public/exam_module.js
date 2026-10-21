// Exam Management Module - Advanced UI and Logic
(function() {
  let activeExamTab = 'entry'; // 'entry', 'admit', 'result'
  const SCHOOL_NAME = "Tapowan Public School";

  // Modular Alert Interceptor: routes to showToast or appAlert, eliminating native alerts
  const alert = function(msg) {
    if (!msg) return;
    const str = String(msg);
    if (typeof window.showToast === 'function') {
      const isErr = /error|fail|cannot|denied|require|warning|please|select/i.test(str);
      const isSuccess = /success|saved|deleted|reverted/i.test(str);
      window.showToast(str, isErr ? 'warning' : isSuccess ? 'success' : 'info');
    } else if (typeof window.appAlert === 'function') {
      window.appAlert(str);
    }
  };

  const formatParentName = (name) => {
    if (!name) return '';
    const lower = String(name).trim().toLowerCase();
    if (lower === '0' || lower === '00' || lower === 'nil' || lower === 'na' || lower === 'n/a' || lower === 'none' || lower === '-') {
      return '';
    }
    return name;
  };

  /**
   * Unified Student Photo URL Resolver (matches mobile app getStudentPhotoUri)
   * Resolves photos from Turso streaming API, Cloudflare/Vercel edge, or Base64 data URIs.
   */
  const getStudentPhotoUri = (typeof window !== 'undefined' && typeof window.getStudentPhotoUri === 'function')
    ? window.getStudentPhotoUri
    : function(studentOrPhoto, fallbackId = null) {
        if (!studentOrPhoto) {
          if (fallbackId) {
            return `/api/photo/students/${encodeURIComponent(String(fallbackId).trim())}?_v=${Math.floor(Date.now() / 60000)}`;
          }
          return '';
        }
        let photoVal = null;
        let cacheKey = null;
        if (typeof studentOrPhoto === 'object') {
          if (studentOrPhoto.photo && String(studentOrPhoto.photo).startsWith('data:image')) {
            return studentOrPhoto.photo;
          }
          photoVal = studentOrPhoto.photoUrl || studentOrPhoto.photo || studentOrPhoto.avatar || studentOrPhoto.image || studentOrPhoto.student_photo || studentOrPhoto.studentPhoto;
          cacheKey = studentOrPhoto.photoLen || studentOrPhoto.updated_at || null;
          if (!photoVal) {
            const idToUse = studentOrPhoto.id || studentOrPhoto.admissionNo || fallbackId;
            if (idToUse) {
              return `/api/photo/students/${encodeURIComponent(String(idToUse).trim())}?_v=${Math.floor(Date.now() / 60000)}`;
            }
            return '';
          }
        } else if (typeof studentOrPhoto === 'string') {
          photoVal = studentOrPhoto;
        }
        if (photoVal) {
          const trimmed = String(photoVal).trim();
          if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '---' || trimmed === 'none' || trimmed === 'false' || trimmed === 'has_data') {
            const idToUse = (typeof studentOrPhoto === 'object' ? (studentOrPhoto.id || studentOrPhoto.admissionNo) : null) || fallbackId;
            if (idToUse) {
              return `/api/photo/students/${encodeURIComponent(String(idToUse).trim())}?_v=${Math.floor(Date.now() / 60000)}`;
            }
            return '';
          }
          if (trimmed.startsWith('data:image')) return trimmed;
          const cleanB64 = trimmed.replace(/\s+/g, '');
          if (cleanB64.length > 100) {
            if (cleanB64.startsWith('/9j/')) return `data:image/jpeg;base64,${cleanB64}`;
            if (cleanB64.startsWith('iVBOR')) return `data:image/png;base64,${cleanB64}`;
            if (cleanB64.startsWith('UklGR')) return `data:image/webp;base64,${cleanB64}`;
            if (cleanB64.startsWith('R0lGOD')) return `data:image/gif;base64,${cleanB64}`;
            if (cleanB64.startsWith('Qk')) return `data:image/bmp;base64,${cleanB64}`;
          }
          let url = trimmed;
          if (url.startsWith('http://tapowan-school.vercel.app')) url = url.replace('http://', 'https://');
          if (url.startsWith('/api/photo/') || url.startsWith('/api/image/')) {
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}_v=${Math.floor(Date.now() / 60000)}`;
          }
          return url;
        }
        if (fallbackId) {
          return `/api/photo/students/${encodeURIComponent(String(fallbackId).trim())}?_v=${Math.floor(Date.now() / 60000)}`;
        }
        return '';
      };

  // Inject Custom CSS for Exam Module
  if (!document.getElementById("examCustomStyles")) {
    const style = document.createElement("style");
    style.id = "examCustomStyles";
    style.innerHTML = `
      @media print {
        @page { margin: 0; }
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #admitPreviewContainer, #resultPreviewContainer { padding: 0 !important; gap: 0 !important; background: transparent !important; border-radius: 0 !important; min-height: auto !important; }
      }
      #examPanel { background: transparent; padding: 0; box-shadow: none; font-family: 'Outfit', sans-serif; }
      .exam-card { background: white; border-radius: 16px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); margin-bottom: 25px; border: 1px solid #e2e8f0; font-family: 'Outfit', sans-serif; }
      .exam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
      .exam-header h3 { font-size: 1.8rem; color: inherit; margin: 0; font-weight: 800; letter-spacing: -0.02em; }
      .exam-tabs { display: flex; gap: 8px; background: #f1f5f9; padding: 6px; border-radius: 12px; }
      .exam-tab-btn { background: transparent; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 0.95rem; color: inherit; cursor: pointer; transition: all 0.3s ease; font-family: 'Outfit', sans-serif; }
      .exam-tab-btn.active { background: var(--brand, #1e3a8a); color: #ffffff; box-shadow: 0 2px 8px rgba(30,58,138,0.25); }
      .exam-tab-btn:hover:not(.active) { color: inherit; }

      .exam-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; align-items: end; }
      .exam-field label { display: block; font-size: 0.8rem; font-weight: 700; color: inherit; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
      .exam-field select, .exam-field input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; background: transparent; transition: all 0.3s ease; font-weight: 500; color: inherit; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
      .exam-field select:focus, .exam-field input:focus { border-color: var(--brand, #1e3a8a); background: white; outline: none; box-shadow: 0 0 0 4px rgba(30,58,138,0.1); }
      
      .exam-btn { padding: 12px 24px; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 8px; justify-content: center; font-size: 0.95rem; font-family: 'Outfit', sans-serif; }
      .exam-btn-primary { background: var(--brand, #1e3a8a); color: white; box-shadow: 0 4px 12px rgba(30,58,138,0.25); }
      .exam-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(30,58,138,0.35); }
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

      .marks-subject-header { display: grid; grid-template-columns: 2fr 95px 72px 48px 1fr 1fr 1fr 36px; gap: 8px; padding: 0 15px 10px 15px; font-weight: 700; color: inherit; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .marks-subject-row { display: grid; grid-template-columns: 2fr 95px 72px 48px 1fr 1fr 1fr 36px; gap: 8px; align-items: center; padding: 15px; background: transparent; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0; transition: border-color 0.2s; }
    .marks-subject-header.cbse-mode { grid-template-columns: 2fr 90px 70px 48px 65px 80px 115px 80px 60px 36px; }
    .marks-subject-row.cbse-mode { grid-template-columns: 2fr 90px 70px 48px 65px 80px 115px 80px 60px 36px; }
      .marks-subject-row:hover { border-color: inherit; }
      .marks-subject-row input { width: 100%; padding: 10px 4px; border: 2px solid #e2e8f0; border-radius: 8px; font-weight: 700; text-align: center; color: inherit; font-size: 0.95rem; box-sizing: border-box; }
      .marks-subject-row input[type=number]::-webkit-inner-spin-button, .marks-subject-row input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .marks-subject-row input[type=number] { -moz-appearance: textfield; }
      .marks-subject-row input[type="text"] { text-align: left; }
      .marks-subject-row input:focus { border-color: inherit; outline: none; background: white; }
      .marks-subject-row .total-cell { font-weight: 800; text-align: center; color: inherit; font-size: 1.1rem; }
      .del-row-btn { background: #fee2e2; color: inherit; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
      .del-row-btn:hover { background: #ef4444; color: white; }

      .sub-role-toggle { padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid; transition: all 0.2s ease; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
      .sub-role-toggle.role-main { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; }
      .sub-role-toggle.role-main:hover { background: #dbeafe; transform: translateY(-1px); }
      .sub-role-toggle.role-additional { background: #fffbeb; border-color: #fde68a; color: #b45309; }
      .sub-role-toggle.role-additional:hover { background: #fef3c7; transform: translateY(-1px); }

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
  const CANONICAL_9_SUBJECTS = [
    'English', 'Hindi', 'Science', 'Social Science', 'Math',
    'GK & Me', 'Computer', 'Sanskrit', 'Drawing'
  ];

  function canonicalSubjectName(raw) {
    if (!raw) return '';
    const s = String(raw).trim().toLowerCase();

    if (s.includes('english')) return 'English';
    if (s === 'hindi' || s === 'course-b' || s.includes('hindi')) return 'Hindi';
    if (s.includes('social') || s.includes('sst') || s.includes('history') || s.includes('geography') || s.includes('civics')) return 'Social Science';
    if (s === 'evs' || s === 'e.v.s' || s.includes('e.v.s') || s.includes('environmental') || s.includes('environment')) return 'EVS';
    if (s === 'science' || (s.includes('science') && !s.includes('social') && !s.includes('computer') && !s.includes('moral') && !s.includes('home') && !s.includes('env'))) return 'Science';
    if (s === 'math' || s.includes('math')) return 'Math';
    if (s === 'computer' || s === 'cs' || s.includes('computer') || s.includes('infotech') || s.includes('information tech') || s === 'it') return 'Computer';
    if (s.includes('sanskrit')) return 'Sanskrit';
    if (s.includes('drawing') || s.includes('art') || s.includes('craft')) return 'Drawing';
    if (
      s === 'gk & me' ||
      s === 'me & gk' ||
      s === 'me/gk' ||
      s === 'gk' ||
      s === 'g.k' ||
      s === 'g.k.' ||
      s.includes('general knowledge') ||
      s.includes('moral') ||
      s.includes('m.sc') ||
      s.includes('m.s') ||
      s === 'gk and me' ||
      s === 'me and gk'
    ) {
      return 'GK & Me';
    }

    return raw.trim();
  }

  window.CANONICAL_9_SUBJECTS = CANONICAL_9_SUBJECTS;
  window.canonicalSubjectName = canonicalSubjectName;

  const defaultSubjects = {
    primary: CANONICAL_9_SUBJECTS,
    middle: CANONICAL_9_SUBJECTS,
    high: CANONICAL_9_SUBJECTS
  };

  function getSubjectsForClass(className) {
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
    const canonicalTarget = normFunc(className).toLowerCase();
    
    // Check custom subjects from database first
    if (typeof getStore !== 'undefined') {
        const store = getStore();
        if (store && store.subjects && store.subjects.length > 0) {
            // Match canonical class or 'all'
            const classSubjects = store.subjects.filter(s => {
                const sNorm = normFunc(s.className || '').toLowerCase();
                return sNorm === canonicalTarget || sNorm === "all";
            });
            
            if (classSubjects.length > 0) {
                const distinctList = Array.from(new Set(classSubjects.map(s => canonicalSubjectName(s.subjectName)).filter(Boolean)));
                if (distinctList.length > 0) {
                  distinctList.sort((a, b) => getSubjectDisplayOrder(a, className) - getSubjectDisplayOrder(b, className));
                  return distinctList;
                }
            }
        }
    }

    // Standard CBSE Curriculum Defaults by Class Level:
    // Nursery & LKG: English, Hindi, Math, Drawing (4 subjects)
    if (canonicalTarget.includes('nursery') || canonicalTarget.includes('lkg')) {
      return ['English', 'Hindi', 'Math', 'Drawing'];
    }
    // UKG: English, Hindi, Math, EVS, Drawing (5 subjects)
    if (canonicalTarget.includes('ukg')) {
      return ['English', 'Hindi', 'Math', 'EVS', 'Drawing'];
    }
    // Class 1 to 3: English, Hindi, Science, Social Science, Math, GK & Me, Computer, Drawing (8 subjects, NO Sanskrit)
    if (/^(i|ii|iii)(-a)?$/i.test(canonicalTarget) || /^(1|2|3)(-a)?$/i.test(canonicalTarget) || /^class\s*(1|2|3|i|ii|iii)(-a)?$/i.test(canonicalTarget)) {
      return ['English', 'Hindi', 'Science', 'Social Science', 'Math', 'GK & Me', 'Computer', 'Drawing'];
    }

    // Class 4 to 10: Includes Sanskrit (9 subjects)
    return [...CANONICAL_9_SUBJECTS];
  }

  // =========================================================================
  // MAIN VS ADDITIONAL SUBJECTS RULES & PASS/FAIL CALCULATION ENGINE
  // Only Main subjects decide Pass or Fail. Additional subjects NEVER fail a student!
  // =========================================================================

  const DEFAULT_SUBJECT_RULES = {
    mainKeywords: [
      'english', 'hindi', 'science', 'social science', 'math',
      'mathematics', 'maths', 'social studies', 'sst', 'evs', 'environmental',
      'physics', 'chemistry', 'biology', 'accountancy', 'business', 'economics',
      'history', 'geography', 'civics', 'political science'
    ],
    additionalKeywords: [
      'gk & me', 'computer', 'sanskrit', 'drawing',
      'gk', 'g.k', 'me/gk', 'me & gk', 'general knowledge', 'moral science', 'moral',
      'computer science', 'information tech', 'infotech', 'it (402)', 'it',
      'art', 'craft', 'urdu',
      'physical education', 'physical ed', 'phe', 'pe',
      'sports', 'yoga', 'music', 'dance', 'work education', 'life skills'
    ],
    passingPercentage: 33
  };

  function isSubjectMain(subjectName, className, subjectObj) {
    if (subjectObj) {
      if (typeof subjectObj.isMain === 'boolean') return subjectObj.isMain;
      if (subjectObj.isMain === 'true' || subjectObj.isMain === '1') return true;
      if (subjectObj.isMain === 'false' || subjectObj.isMain === '0') return false;
      if (subjectObj.subjectType === 'additional' || subjectObj.subjectType === 'optional') return false;
      if (subjectObj.subjectType === 'main' || subjectObj.subjectType === 'core') return true;
    }

    const sName = String(subjectName || '').trim().toLowerCase();
    if (!sName) return true;

    // Check custom rules saved in settings
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    let customRules = null;
    if (store && store.settings) {
      const s = store.settings.find(x => x.key === "exam_main_subjects_rules");
      if (s && s.value) {
        try { customRules = JSON.parse(s.value); } catch(e){}
      }
    }

    if (customRules) {
      const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
      const cNorm = normFunc(className || '').toLowerCase();

      // Check class-specific rules first
      if (cNorm && customRules.classRules && customRules.classRules[cNorm]) {
        const cr = customRules.classRules[cNorm];
        if (Array.isArray(cr.main) && cr.main.some(m => String(m).trim().toLowerCase() === sName)) return true;
        if (Array.isArray(cr.additional) && cr.additional.some(a => String(a).trim().toLowerCase() === sName)) return false;
      }

      // Check global rules
      if (Array.isArray(customRules.mainSubjects) && customRules.mainSubjects.some(m => String(m).trim().toLowerCase() === sName)) return true;
      if (Array.isArray(customRules.additionalSubjects) && customRules.additionalSubjects.some(a => String(a).trim().toLowerCase() === sName)) return false;
    }

    // Heuristic matching against additional keywords
    for (const kw of DEFAULT_SUBJECT_RULES.additionalKeywords) {
      if (sName === kw || sName.includes(kw)) {
        return false;
      }
    }

    return true;
  }

  // ─── CLASS 9 & 10 SOCIAL SCIENCE 4-PART CONSTANTS & HELPERS ───
  function isClass9or10(className) {
    if (!className) return false;
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
    const cl = normFunc(className).toLowerCase();
    return cl.includes('9') || cl.includes('10') || cl.includes('ix') || cl.includes('x');
  }

  function isSocialSciencePart(subName) {
    return false;
  }

  function isSocialScience(subName) {
    if (!subName) return false;
    const s = String(subName).trim().toLowerCase();
    return s.includes('social science') || s.includes('social studies') || s.includes('sst') || s.includes('087');
  }

  function normalizeSSTPartKey(subName) {
    return '';
  }

  function getDefaultMaxMarksForSubject(subjectName, className) {
    const sName = String(subjectName || '').trim().toLowerCase();
    if (!sName) return { max: 100, min: 33 };

    // 1. Check custom rules saved in settings
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    if (store && store.settings) {
      const s = store.settings.find(x => x.key === "exam_main_subjects_rules");
      if (s && s.value) {
        try {
          const rules = JSON.parse(s.value);
          const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
          const cNorm = normFunc(className || '').toLowerCase();

          // Check class-specific max rules
          if (cNorm && rules.classRules && rules.classRules[cNorm] && rules.classRules[cNorm].maxMarks) {
            const mm = rules.classRules[cNorm].maxMarks;
            for (const [k, v] of Object.entries(mm)) {
              if (k.toLowerCase() === sName || sName.includes(k.toLowerCase()) || k.toLowerCase().includes(sName)) {
                const max = parseInt(v, 10) || 100;
                return { max, min: Math.round(max * 0.33) };
              }
            }
          }

          // Check global max rules
          if (rules.maxMarks) {
            for (const [k, v] of Object.entries(rules.maxMarks)) {
              if (k.toLowerCase() === sName || sName.includes(k.toLowerCase()) || k.toLowerCase().includes(sName)) {
                const max = parseInt(v, 10) || 100;
                return { max, min: Math.round(max * 0.33) };
              }
            }
          }
        } catch(e){}
      }
    }

    // All subjects default to 100 Max, 33 Passing Marks
    return { max: 100, min: 33 };
  }

  function isSubjectAdditional(subjectName, className, subjectObj) {
    return !isSubjectMain(subjectName, className, subjectObj);
  }

  /**
   * Canonical Subject Display Ordering:
   * 1. English
   * 2. Hindi
   * 3. Math
   * 4. Science / EVS
   * 5. Social Science (SST)
   * 6. Other Main subjects
   * 7. Computer (Additional)
   * 8. GK & Me (Additional)
   * 9. Sanskrit / Urdu (Additional)
   * 10. Drawing / Art (Additional)
   * 11. Co-curricular / Physical Education (Additional)
   */
  function getSubjectDisplayOrder(subjectName, className, subjectObj) {
    const raw = String(subjectName || '').trim().toLowerCase();
    const canonical = (canonicalSubjectName(subjectName) || raw).toLowerCase();

    // 1. English
    if (canonical === 'english' || raw.includes('english') || raw === 'eng') return 10;
    // 2. Hindi
    if (canonical === 'hindi' || raw.includes('hindi') || raw === 'hin') return 20;
    // 3. Math
    if (canonical === 'math' || canonical === 'mathematics' || raw.includes('math')) return 30;
    // 5. Social Science / SST (checked before Science because "social science" contains "science")
    if (canonical === 'social science' || raw === 'sst' || raw.includes('social') || raw.includes('sst') || raw.includes('history') || raw.includes('geography') || raw.includes('civics') || raw.includes('pol') || raw.includes('econ')) return 50;
    // 4. Science / EVS
    if (canonical === 'science' || canonical === 'evs' || raw === 'sci' || raw.includes('science') || raw.includes('evs') || raw.includes('environmental') || raw.includes('physics') || raw.includes('chemistry') || raw.includes('biology')) return 40;

    // Other core academic subjects
    const isMain = isSubjectMain(subjectName, className, subjectObj);
    if (isMain) return 60;

    // --- ADDITIONAL SUBJECTS ---
    // 6. Computer / IT
    if (canonical === 'computer' || raw === 'comp' || raw.includes('comp') || raw.includes('it') || raw.includes('info')) return 70;
    // 7. GK & Me / Moral Science
    if (canonical === 'gk & me' || raw === 'gkme' || raw.includes('gk') || raw.includes('knowledge') || raw.includes('moral')) return 80;
    // 8. Sanskrit / Urdu / Regional Language
    if (canonical === 'sanskrit' || raw === 'sans' || raw.includes('sansk') || raw.includes('urdu')) return 90;
    // 9. Drawing / Art / Craft
    if (canonical === 'drawing' || raw === 'draw' || raw.includes('draw') || raw.includes('art') || raw.includes('craft')) return 100;
    // 10. Physical Education / Music / Dance / Other
    if (raw.includes('physical') || raw.includes('sport') || raw.includes('yoga') || raw.includes('pe') || raw.includes('phe') || raw.includes('music') || raw.includes('dance')) return 110;

    return 120;
  }
  window.getSubjectDisplayOrder = getSubjectDisplayOrder;

  function getTouchedSubjectsForClass(className, examName, existingSubjects) {
    const store = typeof getStore !== 'undefined' ? getStore() : (typeof window !== 'undefined' && window.store ? window.store : {});
    const exams = (store && store.exams) ? store.exams : [];
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
    const targetNormClass = normFunc(className || '').toLowerCase();
    const targetNormExam = (examName || '').trim().toLowerCase();

    const touchedSubs = new Set();

    const isTouchedEntry = (s) => {
      if (!s || !s.subject) return false;
      if (s.isAbsent === true) return true;
      const tot = String(s.total !== undefined ? s.total : '').trim();
      const th = String(s.theory !== undefined ? s.theory : (s.subjective !== undefined ? s.subjective : '')).trim();
      const pr = String(s.practical !== undefined ? s.practical : '').trim();
      const mk = String(s.marks !== undefined ? s.marks : '').trim();
      const gr = String(s.grade !== undefined ? s.grade : '').trim();
      if (tot.toUpperCase() === 'AB' || th.toUpperCase() === 'AB' || gr.toUpperCase() === 'AB') return true;
      if (tot !== '' && tot !== '-' && !isNaN(parseFloat(tot))) return true;
      if (th !== '' && th !== '-' && !isNaN(parseFloat(th))) return true;
      if (pr !== '' && pr !== '-' && !isNaN(parseFloat(pr))) return true;
      if (mk !== '' && mk !== '-' && !isNaN(parseFloat(mk))) return true;
      if (gr !== '' && gr !== '-' && gr !== 'Pending' && gr !== 'null' && gr !== 'undefined') return true;
      const pa = parseFloat(s.pa1 !== undefined ? s.pa1 : s.pa2);
      const nb = parseFloat(s.notebook);
      const enr = parseFloat(s.enrichment);
      if (!isNaN(pa) || !isNaN(nb) || !isNaN(enr)) return true;
      return false;
    };

    // 1. Check all classmate exam records in store.exams for this class (and examName if available)
    exams.forEach(e => {
      const eClass = normFunc(e.className || '').toLowerCase();
      if (eClass !== targetNormClass) return;
      if (targetNormExam && (e.examName || '').trim().toLowerCase() !== targetNormExam) return;

      try {
        const list = typeof e.subjectMarks === 'string' ? JSON.parse(e.subjectMarks) : e.subjectMarks;
        if (Array.isArray(list)) {
          list.forEach(s => {
            if (isTouchedEntry(s)) {
              const canonical = canonicalSubjectName(s.subject) || String(s.subject).trim();
              if (canonical) touchedSubs.add(canonical.toLowerCase());
            }
          });
        }
      } catch (err) {}
    });

    // 2. Also check existingSubjects passed in for the current student
    if (Array.isArray(existingSubjects)) {
      existingSubjects.forEach(s => {
        if (isTouchedEntry(s)) {
          const canonical = canonicalSubjectName(s.subject) || String(s.subject).trim();
          if (canonical) touchedSubs.add(canonical.toLowerCase());
        }
      });
    }

    return touchedSubs;
  }
  window.getTouchedSubjectsForClass = getTouchedSubjectsForClass;

  function getCurriculumSubjectsForClass(className, existingSubjects, examName) {
    const defaultSubs = typeof getSubjectsForClass === 'function' ? getSubjectsForClass(className) : [...CANONICAL_9_SUBJECTS];
    const touchedSubs = getTouchedSubjectsForClass(className, examName, existingSubjects);

    const resultSubs = [];
    const seen = new Set();

    // RULE: "IF ANY NOT EVEN TOUCH FOR ANY CLASSMATE DON'T SHOW ON RESULT"
    // If at least one subject was touched for this class/exam, ONLY include subjects that were touched
    // for at least one classmate (or this student)!
    const hasAnyClassmateTouched = touchedSubs.size > 0;

    (defaultSubs || []).forEach(subName => {
      const canonical = canonicalSubjectName(subName) || String(subName).trim();
      const normKey = canonical.toLowerCase();
      if (normKey && !seen.has(normKey)) {
        if (!hasAnyClassmateTouched || touchedSubs.has(normKey)) {
          seen.add(normKey);
          resultSubs.push(canonical);
        }
      }
    });

    if (Array.isArray(existingSubjects)) {
      existingSubjects.forEach(s => {
        if (!s || !s.subject) return;
        const canonical = canonicalSubjectName(s.subject) || String(s.subject).trim();
        const normKey = canonical.toLowerCase();
        if (normKey && !seen.has(normKey)) {
          if (!hasAnyClassmateTouched || touchedSubs.has(normKey)) {
            seen.add(normKey);
            resultSubs.push(canonical);
          }
        }
      });
    }

    // Sort curriculum subjects: English, Hindi, Math, Science, SST, then Additional
    resultSubs.sort((a, b) => getSubjectDisplayOrder(a, className) - getSubjectDisplayOrder(b, className));

    return resultSubs;
  }
  window.getCurriculumSubjectsForClass = getCurriculumSubjectsForClass;

  function isDrawingSubject(name) {
    if (!name) return false;
    const s = String(name).trim().toLowerCase();
    return s === 'drawing' || s.includes('drawing') || s === 'art' || s === 'craft' || s.includes('art & craft') || s.includes('art/craft') || s.includes('चित्रकला');
  }
  window.isDrawingSubject = isDrawingSubject;

  function resolveDrawingGrade(sub, isCBSE = true) {
    if (!sub) return '-';
    if (sub.isAbsent === true || String(sub.total).toUpperCase() === 'AB' || String(sub.theory).toUpperCase() === 'AB') {
      return 'AB';
    }
    if (sub.grade && sub.grade !== '-' && sub.grade !== '---' && sub.grade !== 'null' && sub.grade !== 'undefined') {
      return String(sub.grade).trim().toUpperCase();
    }
    const valStr = String(sub.total !== undefined && sub.total !== '' && sub.total !== '-' ? sub.total : (sub.theory !== undefined && sub.theory !== '' ? sub.theory : (sub.subjective || ''))).trim();
    if (/^[A-Ea-e][1-2\+\-]?$/.test(valStr)) {
      return valStr.toUpperCase();
    }
    const numVal = parseFloat(valStr);
    if (!isNaN(numVal)) {
      const max = parseFloat(sub.max) > 0 ? parseFloat(sub.max) : 100;
      const pct = (numVal / max) * 100;
      if (isCBSE) {
        if (pct >= 91) return 'A1';
        if (pct >= 81) return 'A2';
        if (pct >= 71) return 'B1';
        if (pct >= 61) return 'B2';
        if (pct >= 51) return 'C1';
        if (pct >= 41) return 'C2';
        if (pct >= 33) return 'D';
        return 'E';
      } else {
        if (pct >= 91) return 'A+';
        if (pct >= 81) return 'A';
        if (pct >= 71) return 'B+';
        if (pct >= 61) return 'B';
        if (pct >= 51) return 'C';
        if (pct >= 33) return 'D';
        return 'E';
      }
    }
    return sub.isPending ? 'Pending' : '-';
  }
  window.resolveDrawingGrade = resolveDrawingGrade;

  function evalStudentResultStatus(subjects, className, examName) {
    const classCurriculum = getCurriculumSubjectsForClass(className, subjects, examName);
    const expectedMainSubjects = classCurriculum.filter(sName => isSubjectMain(sName, className));
    const expectedMainCount = expectedMainSubjects.length;
    // Exclude Drawing / Graded subjects from academic curriculum denominator count
    const academicClassCurriculum = classCurriculum.filter(sName => !isDrawingSubject(sName));
    const totalClassSubjectsCount = Math.max(academicClassCurriculum.length, 1);

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return {
        resultStatus: "PENDING",
        isPending: true,
        pendingReason: "No subjects evaluated",
        failedMainSubjects: [],
        mainStats: { grandTotal: 0, maxTotal: expectedMainCount * 100, percentage: 0 },
        overallStats: { grandTotal: 0, maxTotal: totalClassSubjectsCount * 100, percentage: 0 }
      };
    }

    let evalSubs = subjects;

    let mainGrandTotal = 0;
    let mainMaxTotal = 0;
    let overallGrandTotal = 0;
    let overallMaxTotal = 0;
    const failedMainSubjects = [];
    let mainSubjectsCount = 0;

    evalSubs.forEach(sub => {
      if (!sub || !sub.subject) return;
      const subName = String(sub.subject).trim();
      if (!subName) return;

      // Graded subjects like Drawing do NOT contribute to scholastic Grand Total or Percentage
      if (isDrawingSubject(subName)) {
        return;
      }

      const isMain = isSubjectMain(subName, className, sub);
      const maxMarks = parseFloat(sub.max) > 0 ? parseFloat(sub.max) : 100;
      const minMarks = parseFloat(sub.min) > 0 ? parseFloat(sub.min) : Math.round(maxMarks * 0.33);

      let total = 0;
      let hasValidMarks = false;
      const isAbsentSub = sub.isAbsent === true || String(sub.total).toUpperCase() === 'AB' || String(sub.theory).toUpperCase() === 'AB' || String(sub.subjective).toUpperCase() === 'AB' || sub.grade === 'AB';
      if (isAbsentSub) {
        total = 0;
        hasValidMarks = true;
      } else if (sub.total !== undefined && sub.total !== '' && sub.total !== '-' && !isNaN(parseFloat(sub.total))) {
        total = parseFloat(sub.total);
        hasValidMarks = true;
      } else {
        const pa = parseFloat(sub.pa1 || sub.pa2);
        const nb = parseFloat(sub.notebook);
        const enr = parseFloat(sub.enrichment);
        const th = parseFloat(sub.theory !== undefined ? sub.theory : sub.subjective);
        const pr = parseFloat(sub.practical);
        if (!isNaN(pa) || !isNaN(nb) || !isNaN(enr) || !isNaN(th) || !isNaN(pr)) {
          total = Math.min(maxMarks, Math.round(((pa || 0) + (nb || 0) + (enr || 0) + (th || 0) + (pr || 0)) * 10) / 10);
          hasValidMarks = true;
        }
      }

      if (!hasValidMarks) {
        return; // Pending / unentered subject
      }

      overallGrandTotal += total;
      overallMaxTotal += maxMarks;

      if (isMain) {
        mainSubjectsCount++;
        mainGrandTotal += total;
        mainMaxTotal += maxMarks;

        // Failing mark in a Main subject
        if (total < minMarks) {
          failedMainSubjects.push({
            subject: subName,
            obtained: total,
            min: minMarks,
            max: maxMarks
          });
        }
      } else {
        // Additional Subject: marks are recorded in overall stats, but NEVER decide PASS/FAIL alone!
      }
    });

    // Check total number of curriculum subjects to calculate percentage properly:
    // When only 1 subject (e.g. Drawing) is entered out of 8, maxTotal is based on class curriculum
    const effectiveOverallMax = Math.max(overallMaxTotal, totalClassSubjectsCount * 100);
    const overallPercentage = effectiveOverallMax > 0 ? parseFloat(((overallGrandTotal / effectiveOverallMax) * 100).toFixed(1)) : 0;
    const mainPercentage = mainMaxTotal > 0 ? parseFloat(((mainGrandTotal / mainMaxTotal) * 100).toFixed(1)) : 0;

    // Check if main subjects are missing or incomplete:
    // Core main subjects are mandatory to decide Pass/Fail. Additional subjects alone CANNOT grant PASS!
    const hasZeroMain = (mainSubjectsCount === 0);
    const hasIncompleteMain = (expectedMainCount > 0 && mainSubjectsCount < expectedMainCount);

    let resultStatus = "PENDING";
    let isPending = false;
    let pendingReason = "";

    if (hasZeroMain) {
      resultStatus = "PENDING";
      isPending = true;
      pendingReason = "Awaiting Core Main Subjects (Additional subject only)";
    } else if (hasIncompleteMain) {
      resultStatus = "PENDING";
      isPending = true;
      pendingReason = `Incomplete Main Subjects (${mainSubjectsCount}/${expectedMainCount} evaluated)`;
    } else if (failedMainSubjects.length > 0) {
      resultStatus = "FAIL";
    } else if (mainPercentage >= 33) {
      resultStatus = "PASS";
    } else {
      resultStatus = "FAIL";
    }

    return {
      resultStatus,
      isPending,
      pendingReason,
      failedMainSubjects,
      expectedMainCount,
      mainSubjectsCount,
      totalClassSubjectsCount,
      mainStats: {
        grandTotal: mainGrandTotal,
        maxTotal: mainMaxTotal > 0 ? mainMaxTotal : expectedMainCount * 100,
        percentage: mainPercentage
      },
      overallStats: {
        grandTotal: overallGrandTotal,
        maxTotal: effectiveOverallMax,
        percentage: overallPercentage
      }
    };
  }

  function prepareCompleteMarksheetSubjects(rawSubs, className, isCBSE, isAnnual, examName) {
    let subs = [];
    if (typeof rawSubs === 'string') {
      try { subs = JSON.parse(rawSubs); } catch(e) { subs = []; }
    } else if (Array.isArray(rawSubs)) {
      subs = [...rawSubs];
    }
    if (!Array.isArray(subs)) subs = [];

    const classCurriculum = getCurriculumSubjectsForClass(className, subs, examName);
    const touchedSubs = getTouchedSubjectsForClass(className, examName, subs);
    const hasAnyClassmateTouched = touchedSubs.size > 0;

    const completeList = [];
    const usedIndices = new Set();

    classCurriculum.forEach(subName => {
      const canonical = canonicalSubjectName(subName) || String(subName).trim();
      const normName = canonical.toLowerCase();

      // Find in student's entered marks
      const foundIdx = subs.findIndex((s, idx) => {
        if (!s || !s.subject || usedIndices.has(idx)) return false;
        const sNorm = (canonicalSubjectName(s.subject) || String(s.subject).trim()).toLowerCase();
        return sNorm === normName;
      });

      const isMain = isSubjectMain(canonical, className);
      const defMaxMin = getDefaultMaxMarksForSubject(canonical, className);

      if (foundIdx !== -1) {
        usedIndices.add(foundIdx);
        const found = subs[foundIdx];
        completeList.push({
          ...found,
          subject: canonical,
          isMain,
          isPending: false,
          max: parseFloat(found.max) > 0 ? parseFloat(found.max) : defMaxMin.max,
          min: parseFloat(found.min) > 0 ? parseFloat(found.min) : defMaxMin.min
        });
      } else {
        // Pending subject for this student in this exam:
        // STRICT RULE: ONLY add as a pending subject if it was actually touched for at least one classmate!
        // If not even touched for ANY classmate, DO NOT SHOW ON RESULT!
        if (!hasAnyClassmateTouched || touchedSubs.has(normName)) {
          completeList.push({
            subject: canonical,
            isMain,
            isPending: true,
            max: defMaxMin.max,
            min: defMaxMin.min,
            pa1: '-',
            pa2: '-',
            notebook: '-',
            enrichment: '-',
            theory: '-',
            subjective: '-',
            practical: '-',
            total: '-'
          });
        }
      }
    });

    // Add any remaining subjects that the student had which were not in classCurriculum
    subs.forEach((s, idx) => {
      if (!usedIndices.has(idx) && s && s.subject) {
        const canonical = canonicalSubjectName(s.subject) || String(s.subject).trim();
        const normName = canonical.toLowerCase();
        const hasMarks = (s.total !== undefined && s.total !== '' && s.total !== '-') ||
                         (s.theory !== undefined && s.theory !== '' && s.theory !== '-') ||
                         s.isAbsent === true || String(s.total).toUpperCase() === 'AB';
        if (hasMarks || !hasAnyClassmateTouched || touchedSubs.has(normName)) {
          const isMain = isSubjectMain(canonical, className, s);
          completeList.push({
            ...s,
            subject: canonical,
            isMain,
          });
        }
      }
    });

    // Filter final completeList: Strictly purge any pending row whose subject was never touched for ANY classmate
    const finalFilteredList = completeList.filter(row => {
      if (!row || !row.subject) return false;
      const isPendingRow = row.isPending === true || row.total === '-' || row.total === '' || row.total === undefined;
      const normKey = (canonicalSubjectName(row.subject) || String(row.subject).trim()).toLowerCase();
      if (isPendingRow && hasAnyClassmateTouched && !touchedSubs.has(normKey)) {
        return false; // NOT TOUCHED FOR ANY CLASSMATE -> DO NOT SHOW ON RESULT!
      }
      return true;
    });

    // Strictly enforce canonical display order: English, Hindi, Math, Science, SST, then Additional
    finalFilteredList.sort((a, b) => {
      const orderA = getSubjectDisplayOrder(a.subject, className, a);
      const orderB = getSubjectDisplayOrder(b.subject, className, b);
      return orderA - orderB;
    });

    return finalFilteredList;
  }

  window.DEFAULT_SUBJECT_RULES = DEFAULT_SUBJECT_RULES;
  window.isSubjectMain = isSubjectMain;
  window.evalStudentResultStatus = evalStudentResultStatus;
  window.prepareCompleteMarksheetSubjects = prepareCompleteMarksheetSubjects;

  window.toggleSubjectRoleInRow = function(btn) {
    const currentIsMain = btn.getAttribute('data-is-main') === '1';
    const newIsMain = !currentIsMain;
    btn.setAttribute('data-is-main', newIsMain ? '1' : '0');
    const row = btn.closest('.marks-subject-row');

    if (newIsMain) {
      btn.className = 'sub-role-toggle role-main';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">star</span>Main';
      btn.title = 'Main Subject: CBSE Pattern with PA1 (10) + NB (5) + Enr (5) + Theory (80) = 100';
      if (row && row.classList.contains('cbse-mode')) {
        const paInp = row.querySelector('.sub-pa');
        const nbInp = row.querySelector('.sub-nb');
        const enrInp = row.querySelector('.sub-enr');
        const thInp = row.querySelector('.sub-th');
        if (paInp) { paInp.disabled = false; paInp.placeholder = '0-10'; paInp.style.background = ''; paInp.style.color = ''; paInp.style.cursor = ''; }
        if (nbInp) { nbInp.disabled = false; nbInp.placeholder = '0-5'; nbInp.style.background = ''; nbInp.style.color = ''; nbInp.style.cursor = ''; }
        if (enrInp) { enrInp.disabled = false; enrInp.placeholder = '0-5'; enrInp.style.background = ''; enrInp.style.color = ''; enrInp.style.cursor = ''; }
        if (thInp) {
          const maxVal = parseFloat(row.querySelector('.sub-max')?.value) || 100;
          const thMax = maxVal <= 50 ? maxVal : 80;
          thInp.placeholder = `0-${thMax}`;
          thInp.max = thMax;
          thInp.title = 'Exam Marks (0-80)';
          thInp.style.background = '';
          thInp.style.borderColor = '';
        }
      }
    } else {
      btn.className = 'sub-role-toggle role-additional';
      btn.innerHTML = '➕ Addl';
      btn.title = 'Additional Subject: In 100 only (No PA1, NB, Enr option needed in Half Yearly)';
      if (row && row.classList.contains('cbse-mode')) {
        const paInp = row.querySelector('.sub-pa');
        const nbInp = row.querySelector('.sub-nb');
        const enrInp = row.querySelector('.sub-enr');
        const thInp = row.querySelector('.sub-th');
        const maxInp = row.querySelector('.sub-max');
        if (maxInp && (maxInp.value === '80' || maxInp.value === '50')) {
          maxInp.value = 100;
          if (typeof window.handleRowMaxChange === 'function') window.handleRowMaxChange(maxInp);
        }
        if (paInp) { paInp.value = ''; paInp.disabled = true; paInp.placeholder = '-'; paInp.style.background = '#f1f5f9'; paInp.style.color = '#94a3b8'; paInp.style.cursor = 'not-allowed'; }
        if (nbInp) { nbInp.value = ''; nbInp.disabled = true; nbInp.placeholder = '-'; nbInp.style.background = '#f1f5f9'; nbInp.style.color = '#94a3b8'; nbInp.style.cursor = 'not-allowed'; }
        if (enrInp) { enrInp.value = ''; enrInp.disabled = true; enrInp.placeholder = '-'; enrInp.style.background = '#f1f5f9'; enrInp.style.color = '#94a3b8'; enrInp.style.cursor = 'not-allowed'; }
        if (thInp) {
          const maxVal = parseFloat(row.querySelector('.sub-max')?.value) || 100;
          thInp.placeholder = `0-${maxVal}`;
          thInp.max = maxVal;
          thInp.title = 'Direct Exam Marks in 100 only';
          thInp.style.background = '#eff6ff';
          thInp.style.borderColor = '#3b82f6';
        }
      }
    }
    if (typeof window.calcExamTotals === 'function') {
      window.calcExamTotals();
    }
  };

  window.setRuleSubjectType = function(btn, type) {
    const parent = btn.parentElement;
    parent.querySelectorAll(".rule-btn").forEach(b => {
      b.classList.remove("active");
      b.style.background = "transparent";
      b.style.color = "#64748b";
    });
    btn.classList.add("active");
    if (type === "main") {
      btn.style.background = "#2563eb";
      btn.style.color = "#ffffff";
    } else {
      btn.style.background = "#d97706";
      btn.style.color = "#ffffff";
    }
  };

  window.openSubjectRulesModal = function(initialClass) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    let customRules = {
      passingPercentage: 33,
      mainSubjects: ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'EVS'],
      additionalSubjects: ['Computer', 'Information Tech', 'Sanskrit', 'Urdu', 'Moral Science', 'Drawing', 'G.K', 'Physical Education'],
      maxMarks: { 'Moral Science': 50, 'G.K': 50, 'Drawing': 50 },
      classRules: {}
    };

    if (store && store.settings) {
      const s = store.settings.find(x => x.key === "exam_main_subjects_rules");
      if (s && s.value) {
        try {
          const parsed = JSON.parse(s.value);
          customRules = Object.assign(customRules, parsed);
        } catch(e){}
      }
    }

    const oldModal = document.getElementById("examSubjectRulesModal");
    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "exam-modal-overlay active";
    overlay.id = "examSubjectRulesModal";

    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());
    const allClasses = Array.from(new Set([
      'Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A',
      ...(store.classes || []).map(c => [c.className, c.section].filter(Boolean).join('-'))
    ]));

    let selectedClass = initialClass || "all";

    function renderModalBody() {
      let subjectsForSelection = [];
      if (selectedClass === "all") {
        subjectsForSelection = Array.from(new Set([
          ...CANONICAL_9_SUBJECTS,
          ...(store.subjects || []).map(s => canonicalSubjectName(s.subjectName)).filter(Boolean)
        ]));
      } else {
        subjectsForSelection = Array.from(new Set([
          ...getSubjectsForClass(selectedClass),
          ...(store.subjects || []).filter(s => normFunc(s.className).toLowerCase() === normFunc(selectedClass).toLowerCase() || s.className === 'all').map(s => canonicalSubjectName(s.subjectName)).filter(Boolean)
        ]));
      }

      const cNorm = normFunc(selectedClass).toLowerCase();
      if (selectedClass !== "all" && customRules.classRules && customRules.classRules[cNorm]) {
        const cr = customRules.classRules[cNorm];
        if (Array.isArray(cr.main)) cr.main.forEach(m => { if (!subjectsForSelection.includes(m)) subjectsForSelection.push(m); });
        if (Array.isArray(cr.additional)) cr.additional.forEach(a => { if (!subjectsForSelection.includes(a)) subjectsForSelection.push(a); });
      }

      let subjectRowsHtml = subjectsForSelection.map((subName) => {
        const isMain = isSubjectMain(subName, selectedClass === "all" ? "" : selectedClass);
        const defMax = getDefaultMaxMarksForSubject(subName, selectedClass === "all" ? "" : selectedClass).max;
        return `
          <div class="rules-subject-row" data-subject="${subName}" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:700; color:#0f172a; font-size:0.95rem;">${subName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:5px; background:#ffffff; padding:4px 8px; border:1px solid #cbd5e1; border-radius:8px;">
                <span style="font-size:0.75rem; font-weight:700; color:#64748b;">Max:</span>
                <select class="rule-sub-max" style="border:none; background:transparent; font-size:0.8rem; font-weight:700; color:#0f172a; cursor:pointer;">
                  <option value="100" ${defMax == 100 ? 'selected' : ''}>100 (Pass: 33)</option>
                  <option value="50" ${defMax == 50 ? 'selected' : ''}>50 (Pass: 17)</option>
                  <option value="80" ${defMax == 80 ? 'selected' : ''}>80 (Pass: 26)</option>
                  <option value="40" ${defMax == 40 ? 'selected' : ''}>40 (Pass: 13)</option>
                  <option value="25" ${defMax == 25 ? 'selected' : ''}>25 (Pass: 8)</option>
                </select>
              </div>
              <div style="display:flex; gap:6px; background:#e2e8f0; padding:3px; border-radius:8px;">
                <button type="button" class="rule-btn rule-btn-main ${isMain ? 'active' : ''}" onclick="window.setRuleSubjectType(this, 'main')" style="padding:6px 14px; border:none; border-radius:6px; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s; background:${isMain ? '#2563eb' : 'transparent'}; color:${isMain ? '#ffffff' : '#64748b'}; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">star</span>Main</button>
                <button type="button" class="rule-btn rule-btn-additional ${!isMain ? 'active' : ''}" onclick="window.setRuleSubjectType(this, 'additional')" style="padding:6px 14px; border:none; border-radius:6px; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s; background:${!isMain ? '#d97706' : 'transparent'}; color:${!isMain ? '#ffffff' : '#64748b'}; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">add_circle</span>Additional</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:0.8rem; font-weight:800; color:#475569; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Select Target Class</label>
          <select id="rulesClassDropdown" style="width:100%; padding:10px 14px; border:2px solid #cbd5e1; border-radius:10px; font-size:0.95rem; font-weight:700; background:#ffffff;">
            <option value="all" ${selectedClass === 'all' ? 'selected' : ''}>All Classes (Global Default Rules)</option>
            ${allClasses.map(c => `<option value="${c}" ${selectedClass === c ? 'selected' : ''}>Class: ${c}</option>`).join('')}
          </select>
        </div>

        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px 16px; margin-bottom:20px; font-size:0.85rem; color:#1e40af; line-height:1.45;">
          <div style="font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:18px;">info</span>
            Subject Configuration & Maximum Marks:
          </div>
          <div>• <strong>Main Subjects</strong>: Academic core subjects deciding Pass or Fail (score &ge; 33% required).</div>
          <div style="margin-top:2px;">• <strong>Additional Subjects</strong>: Non-failing subjects (e.g. Moral Science, Computer, Drawing). Low marks never fail a student!</div>
          <div style="margin-top:2px;">• <strong>Max Marks</strong>: Set standard scale (100, 50, etc.). 50-mark subjects auto-scale passing marks to 17.</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h5 style="margin:0; font-size:0.95rem; font-weight:800; color:#0f172a;">Subject Rules & Maximum Marks for ${selectedClass === 'all' ? 'All Classes' : selectedClass}:</h5>
          <span style="font-size:0.8rem; color:#64748b;">Set Max (100 or 50) and Role per subject</span>
        </div>

        <div id="rulesSubjectsList" style="max-height:340px; overflow-y:auto; padding-right:4px;">
          ${subjectRowsHtml}
        </div>

        <div style="margin-top:15px; padding:12px; background:#f1f5f9; border-radius:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input type="text" id="newRuleSubjectInput" placeholder="Add custom subject (e.g. Urdu, Art, Yoga)" style="flex:1; min-width:160px; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem;" />
          <select id="newRuleSubjectMax" style="padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; font-weight:700;">
            <option value="100">100 Marks (Pass: 33)</option>
            <option value="50">50 Marks (Pass: 17)</option>
            <option value="80">80 Marks (Pass: 26)</option>
            <option value="40">40 Marks (Pass: 13)</option>
            <option value="25">25 Marks (Pass: 8)</option>
          </select>
          <select id="newRuleSubjectType" style="padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.85rem; font-weight:700;">
            <option value="main">⭐ Main Subject</option>
            <option value="additional" selected>➕ Additional Subject</option>
          </select>
          <button type="button" id="btnAddSubjectToRulesBtn" style="padding:8px 16px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer;">+ Add</button>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="exam-modal" style="max-width:780px;">
        <div class="exam-modal-header">
          <h2 style="display:flex; align-items:center; gap:10px;">
            <span class="material-symbols-outlined" style="font-size:28px; color:#2563eb;">rule</span>
            <div>
              Configure Subject Rules & Maximum Marks
              <span style="font-size:0.85rem; color:#64748b; font-weight:500;">Set which subjects decide Pass/Fail and configure Default Max Marks (100 or 50)</span>
            </div>
          </h2>
          <button class="exam-close-btn" onclick="document.getElementById('examSubjectRulesModal').remove()">×</button>
        </div>

        <div id="subjectRulesModalBody">
          ${renderModalBody()}
        </div>

        <div style="margin-top:25px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px;">
          <button type="button" id="btnResetSubjectRules" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:9px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.85rem;">🔄 Reset to Standard Rules</button>
          <div style="display:flex; gap:10px;">
            <button class="exam-btn exam-btn-secondary" onclick="document.getElementById('examSubjectRulesModal').remove()">Cancel</button>
            <button id="btnSaveSubjectRules" class="exam-btn exam-btn-primary" style="padding:10px 24px; font-size:0.95rem;">💾 Save Subject Rules</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    function attachModalEvents() {
      const clsDropdown = document.getElementById("rulesClassDropdown");
      if (clsDropdown) {
        clsDropdown.onchange = (e) => {
          selectedClass = e.target.value;
          document.getElementById("subjectRulesModalBody").innerHTML = renderModalBody();
          attachModalEvents();
        };
      }

      const addBtn = document.getElementById("btnAddSubjectToRulesBtn");
      if (addBtn) {
        addBtn.onclick = () => {
          const inp = document.getElementById("newRuleSubjectInput");
          const typeSel = document.getElementById("newRuleSubjectType");
          const maxSel = document.getElementById("newRuleSubjectMax");
          const subName = (inp?.value || '').trim();
          if (!subName) return;

          const listEl = document.getElementById("rulesSubjectsList");
          const isMain = typeSel.value === "main";
          const chosenMax = parseInt(maxSel?.value, 10) || 100;
          const newRow = document.createElement("div");
          newRow.className = "rules-subject-row";
          newRow.setAttribute("data-subject", subName);
          newRow.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; flex-wrap:wrap; gap:8px;";
          newRow.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-weight:700; color:#0f172a; font-size:0.95rem;">${subName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:5px; background:#ffffff; padding:4px 8px; border:1px solid #cbd5e1; border-radius:8px;">
                <span style="font-size:0.75rem; font-weight:700; color:#64748b;">Max:</span>
                <select class="rule-sub-max" style="border:none; background:transparent; font-size:0.8rem; font-weight:700; color:#0f172a; cursor:pointer;">
                  <option value="100" ${chosenMax == 100 ? 'selected' : ''}>100 (Pass: 33)</option>
                  <option value="50" ${chosenMax == 50 ? 'selected' : ''}>50 (Pass: 17)</option>
                  <option value="80" ${chosenMax == 80 ? 'selected' : ''}>80 (Pass: 26)</option>
                  <option value="40" ${chosenMax == 40 ? 'selected' : ''}>40 (Pass: 13)</option>
                  <option value="25" ${chosenMax == 25 ? 'selected' : ''}>25 (Pass: 8)</option>
                </select>
              </div>
              <div style="display:flex; gap:6px; background:#e2e8f0; padding:3px; border-radius:8px;">
                <button type="button" class="rule-btn rule-btn-main ${isMain ? 'active' : ''}" onclick="window.setRuleSubjectType(this, 'main')" style="padding:6px 14px; border:none; border-radius:6px; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s; background:${isMain ? '#2563eb' : 'transparent'}; color:${isMain ? '#ffffff' : '#64748b'}; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">star</span>Main</button>
                <button type="button" class="rule-btn rule-btn-additional ${!isMain ? 'active' : ''}" onclick="window.setRuleSubjectType(this, 'additional')" style="padding:6px 14px; border:none; border-radius:6px; font-weight:800; font-size:0.8rem; cursor:pointer; transition:all 0.2s; background:${!isMain ? '#d97706' : 'transparent'}; color:${!isMain ? '#ffffff' : '#64748b'}; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">add_circle</span>Additional</button>
              </div>
            </div>
          `;
          listEl.appendChild(newRow);
          inp.value = "";
        };
      }

      const saveBtn = document.getElementById("btnSaveSubjectRules");
      if (saveBtn) {
        saveBtn.onclick = async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving Rules...";

          try {
            const rows = document.querySelectorAll("#rulesSubjectsList .rules-subject-row");
            const mainArr = [];
            const addlArr = [];
            const maxMap = {};

            rows.forEach(r => {
              const sName = r.getAttribute("data-subject");
              const isMain = r.querySelector(".rule-btn-main.active") !== null;
              const maxVal = parseInt(r.querySelector(".rule-sub-max")?.value, 10) || 100;
              maxMap[sName] = maxVal;
              if (isMain) mainArr.push(sName);
              else addlArr.push(sName);
            });

            if (selectedClass === "all") {
              customRules.mainSubjects = mainArr;
              customRules.additionalSubjects = addlArr;
              customRules.maxMarks = maxMap;
            } else {
              const cNorm = normFunc(selectedClass).toLowerCase();
              if (!customRules.classRules) customRules.classRules = {};
              customRules.classRules[cNorm] = {
                main: mainArr,
                additional: addlArr,
                maxMarks: maxMap
              };
            }

            const payload = {
              key: "exam_main_subjects_rules",
              value: JSON.stringify(customRules),
              category: "Academic",
              updatedBy: (store.user && store.user.fullName) || "Web Portal"
            };

            const existingSetting = (store.settings || []).find(s => s.key === "exam_main_subjects_rules");
            if (existingSetting && existingSetting.id) {
              if (typeof api === 'function') {
                await api(`/api/modules/settings/${existingSetting.id}`, { method: "PUT", body: JSON.stringify(payload) });
              } else {
                await fetch(`/api/modules/settings/${existingSetting.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("token") || "") },
                  body: JSON.stringify(payload)
                });
              }
              existingSetting.value = payload.value;
            } else {
              let res = null;
              if (typeof api === 'function') {
                res = await api("/api/modules/settings", { method: "POST", body: JSON.stringify(payload) });
              } else {
                const r = await fetch("/api/modules/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (localStorage.getItem("token") || "") },
                  body: JSON.stringify(payload)
                });
                res = await r.json();
              }
              if (!store.settings) store.settings = [];
              store.settings.push({ id: res?.id || Date.now(), ...payload });
            }

            if (typeof showToast !== 'undefined') showToast("Subject rules saved successfully! Results now strictly decided by Main subjects.", "success");
            document.getElementById("examSubjectRulesModal").remove();

            if (typeof window.calcExamTotals === 'function') {
              window.calcExamTotals();
            }
          } catch(err) {
            console.error("Save subject rules error:", err);
            alert("Error saving rules: " + (err.message || err));
            saveBtn.disabled = false;
            saveBtn.textContent = "💾 Save Subject Rules";
          }
        };
      }

      const resetBtn = document.getElementById("btnResetSubjectRules");
      if (resetBtn) {
        resetBtn.onclick = async () => {
          if (!await window.appConfirm("Reset to default CBSE rules? (Maths, Science, Hindi, English, SST as Main; Computer, Sanskrit, Drawing, GK as Additional)", { title: "Reset CBSE Rules?", confirmText: "Reset Rules", type: "danger" })) return;
          customRules = {
            passingPercentage: 33,
            mainSubjects: ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'EVS'],
            additionalSubjects: ['Computer', 'Information Tech', 'Sanskrit', 'Urdu', 'Moral Science', 'Drawing', 'G.K', 'Physical Education'],
            maxMarks: { 'Moral Science': 50, 'G.K': 50, 'Drawing': 50 },
            classRules: {}
          };
          document.getElementById("subjectRulesModalBody").innerHTML = renderModalBody();
          attachModalEvents();
        };
      }
    }

    attachModalEvents();
  };

  window.renderExamModule = function(options = {}) {
    const examPanel = document.getElementById("examPanel");
    if (!examPanel) return;

    examPanel.classList.remove("hidden");
    examPanel.style.display = "block";

    if (options.activeTab && ['entry', 'schedule', 'admit', 'result'].includes(options.activeTab)) {
      activeExamTab = options.activeTab;
    }

    const contentEl = document.getElementById("examPanelContent");
    const hasExamCard = examPanel.querySelector(".exam-card");
    const isPopulated = contentEl && contentEl.children.length > 0;

    if (hasExamCard && isPopulated && !options.forceRebuild) {
      updateExamTabs();
      if (options.activeTab) {
        renderExamContent();
      }
      return;
    }

    examPanel.innerHTML = `
      <div class="exam-card">
        <div class="exam-header">
          <h3>Exam Management</h3>
          <div class="exam-tabs">
            <button id="examTabEntryBtn" class="exam-tab-btn ${activeExamTab === 'entry' ? 'active' : ''}">Marks Entry</button>
            <button id="examTabScheduleBtn" class="exam-tab-btn ${activeExamTab === 'schedule' ? 'active' : ''}">Exam Schedule</button>
            <button id="examTabAdmitBtn" class="exam-tab-btn ${activeExamTab === 'admit' ? 'active' : ''}">Admit Cards</button>
            <button id="examTabResultBtn" class="exam-tab-btn ${activeExamTab === 'result' ? 'active' : ''}">Results</button>
          </div>
        </div>
        <div id="examPanelContent"></div>
      </div>
    `;

    const entryBtn = document.getElementById("examTabEntryBtn");
    const schedBtn = document.getElementById("examTabScheduleBtn");
    const admitBtn = document.getElementById("examTabAdmitBtn");
    const resultBtn = document.getElementById("examTabResultBtn");

    if (entryBtn) entryBtn.onclick = () => { activeExamTab = 'entry'; updateExamTabs(); renderExamContent(); };
    if (schedBtn) schedBtn.onclick = () => { activeExamTab = 'schedule'; updateExamTabs(); renderExamContent(); };
    if (admitBtn) admitBtn.onclick = () => { activeExamTab = 'admit'; updateExamTabs(); renderExamContent(); };
    if (resultBtn) resultBtn.onclick = () => { activeExamTab = 'result'; updateExamTabs(); renderExamContent(); };

    renderExamContent();
  };

  window.switchExamTab = function(tabName) {
    if (['entry', 'schedule', 'admit', 'result'].includes(tabName)) {
      activeExamTab = tabName;
      const examPanel = document.getElementById("examPanel");
      if (examPanel) {
        window.renderExamModule();
        updateExamTabs();
        renderExamContent();
      }
    }
  };

  function updateExamTabs() {
    const bEntry = document.getElementById("examTabEntryBtn");
    const bSched = document.getElementById("examTabScheduleBtn");
    const bAdmit = document.getElementById("examTabAdmitBtn");
    const bResult = document.getElementById("examTabResultBtn");
    if (bEntry) bEntry.classList.toggle("active", activeExamTab === 'entry');
    if (bSched) bSched.classList.toggle("active", activeExamTab === 'schedule');
    if (bAdmit) bAdmit.classList.toggle("active", activeExamTab === 'admit');
    if (bResult) bResult.classList.toggle("active", activeExamTab === 'result');
  }

  function renderExamContent() {
    const content = document.getElementById("examPanelContent");
    if (!content) return;
    if (activeExamTab === 'entry') renderMarksEntry(content);
    else if (activeExamTab === 'schedule') renderExamSchedule(content);
    else if (activeExamTab === 'admit') renderAdmitCards(content);
    else if (activeExamTab === 'result') renderResults(content);
  }

  // ==========================================
  // ADMIN: DELETE EXAM MARKS (CLASS & SUBJECT WISE)
  // ==========================================
  window.openDeleteClassSubjectMarksModal = function(prefillClass, prefillExam) {
    const isAllowed = (typeof userIsAdmin === 'function' && userIsAdmin()) || 
                      (typeof currentUser !== 'undefined' && currentUser && String(currentUser.role).toLowerCase() === 'administrator') ||
                      (typeof window !== 'undefined' && window.currentUser && String(window.currentUser.role).toLowerCase() === 'administrator');
    if (!isAllowed) {
      if (typeof showToast !== 'undefined') showToast("Only administrators can delete class and subject marks.", "error");
      else alert("Only administrators can delete class and subject marks.");
      return;
    }

    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => (x || '').trim());

    // Gather unique classes
    const classList = Array.from(new Set([
      'Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A',
      ...(store.classes || []).map(c => [c.className, c.section].filter(Boolean).join('-')),
      ...(store.students || []).map(s => s.className).filter(Boolean)
    ])).filter(Boolean);

    // Gather unique exam names
    const distinctExams = Array.from(new Set([
      ...(store.exams || []).map(e => e.examName).filter(Boolean),
      'Mid Term Exam', 'Half Yearly Examination', 'Half Yearly Examination 2026-27', 'Annual Exam', 'Pre-Board Exam'
    ])).filter(Boolean);

    let selClass = prefillClass || (document.getElementById("examEntryClassSelect")?.value) || classList[0] || 'I-A';
    let selExam = prefillExam || (document.getElementById("examEntryName")?.value) || distinctExams[0] || 'Half Yearly Examination 2026-27';
    let selSession = (document.getElementById("examEntrySession")?.value) || '2026-27';

    const oldModal = document.getElementById("examDeleteClassSubjectMarksModal");
    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "exam-modal-overlay active";
    overlay.id = "examDeleteClassSubjectMarksModal";

    overlay.innerHTML = `
      <div class="exam-modal" style="max-width: 650px; border-radius: 20px; border: 1.5px solid #fecaca; box-shadow: 0 25px 50px -12px rgba(220, 38, 38, 0.25);">
        <div class="exam-modal-header" style="border-bottom: 2px solid #fee2e2; padding-bottom: 16px; margin-bottom: 20px;">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; background:#fee2e2; color:#b91c1c; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:800; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">
              <span class="material-symbols-outlined" style="font-size:16px;">admin_panel_settings</span>
              Administrator Exclusive
            </div>
            <h2 style="color: #991b1b; font-size: 1.4rem; font-weight: 800; margin:0;">
              Delete Marks (Class & Subject Wise)
            </h2>
            <span style="color:#64748b; font-size:0.85rem; font-weight:500;">
              Permanently delete entered marks for a specific class and subject across all students.
            </span>
          </div>
          <button type="button" class="exam-close-btn" id="closeDelMarksModalBtn" style="color:#dc2626;">&times;</button>
        </div>

        <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:12px; padding:14px 16px; margin-bottom:20px; display:flex; gap:12px; align-items:flex-start;">
          <span class="material-symbols-outlined" style="color:#e11d48; font-size:24px; flex-shrink:0; margin-top:2px;">warning</span>
          <div style="font-size:0.85rem; color:#881337; line-height:1.45;">
            <strong>High-Impact Operation:</strong> This action will permanently erase subject mark records from both Web and Mobile databases for every student in the selected class and exam. Affected report card totals and percentages will be automatically recomputed.
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- Class Select -->
          <div class="exam-field">
            <label style="color:#334155; font-size:0.8rem; font-weight:700;">1. Select Class</label>
            <select id="delMarksClassSelect" style="width:100%; border:1.5px solid #cbd5e1; border-radius:8px; padding:10px 12px; font-weight:600;">
              ${classList.map(c => `<option value="${c}" ${c === selClass ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>

          <!-- Exam Name Select -->
          <div class="exam-field">
            <label style="color:#334155; font-size:0.8rem; font-weight:700;">2. Select Exam Name</label>
            <div style="display:flex; gap:8px;">
              <select id="delMarksExamSelect" style="flex:1; border:1.5px solid #cbd5e1; border-radius:8px; padding:10px 12px; font-weight:600;">
                ${distinctExams.map(e => `<option value="${e}" ${e === selExam ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Subject Select -->
          <div class="exam-field">
            <label style="color:#334155; font-size:0.8rem; font-weight:700;">3. Select Subject to Delete</label>
            <select id="delMarksSubjectSelect" style="width:100%; border:1.5px solid #cbd5e1; border-radius:8px; padding:10px 12px; font-weight:700; color:#b91c1c;">
              <option value="">Loading subjects...</option>
            </select>
          </div>

          <!-- Live Record Count Preview -->
          <div id="delMarksLivePreview" style="background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:10px; padding:14px 16px; text-align:center;">
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; color:#64748b; font-size:0.85rem; font-weight:600;">
              <span class="material-symbols-outlined" style="font-size:18px;">hourglass_empty</span>
              Checking marks recorded in database...
            </div>
          </div>

          <!-- Confirmation Checkbox -->
          <div style="margin-top:4px; padding:12px 14px; background:#fff; border:1px solid #e2e8f0; border-radius:10px;">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:0.85rem; color:#334155; font-weight:600; margin:0;">
              <input type="checkbox" id="delMarksConfirmCheckbox" style="width:18px; height:18px; accent-color:#dc2626; cursor:pointer;" />
              <span>I confirm that I want to permanently delete all marks for this subject.</span>
            </label>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:25px; border-top:1px solid #e2e8f0; padding-top:18px;">
          <button type="button" class="exam-btn exam-btn-secondary" id="cancelDelMarksBtn" style="padding:10px 20px;">
            Cancel
          </button>
          <button type="button" class="exam-btn" id="executeDelMarksBtn" style="background:#dc2626; color:white; padding:10px 24px; font-weight:700; display:inline-flex; align-items:center; gap:8px; opacity:0.5; cursor:not-allowed;" disabled>
            <span class="material-symbols-outlined" style="font-size:18px;">delete_forever</span>
            Permanently Delete Marks
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const classEl = overlay.querySelector("#delMarksClassSelect");
    const examEl = overlay.querySelector("#delMarksExamSelect");
    const subjectEl = overlay.querySelector("#delMarksSubjectSelect");
    const previewEl = overlay.querySelector("#delMarksLivePreview");
    const checkEl = overlay.querySelector("#delMarksConfirmCheckbox");
    const delBtn = overlay.querySelector("#executeDelMarksBtn");
    const closeBtn = overlay.querySelector("#closeDelMarksModalBtn");
    const cancelBtn = overlay.querySelector("#cancelDelMarksBtn");

    const closeModal = () => { overlay.remove(); };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    function updateSubjectsDropdown() {
      const cls = classEl.value;
      const ex = examEl.value;
      
      const classSubjects = getSubjectsForClass(cls);

      const enteredSubs = new Set();
      (store.exams || []).forEach(e => {
        if ((normFunc(e.className || '')).toLowerCase() === (normFunc(cls || '')).toLowerCase() &&
            (e.examName || '').trim().toLowerCase() === (ex || '').trim().toLowerCase()) {
          try {
            const list = typeof e.subjectMarks === 'string' ? JSON.parse(e.subjectMarks) : e.subjectMarks;
            if (Array.isArray(list)) {
              list.forEach(s => { if (s && s.subject) enteredSubs.add(s.subject.trim()); });
            }
          } catch(err) {}
        }
      });

      const extraParts = isClass9or10(cls) ? ['Geography', 'Economics', 'Civics', 'History', 'Social Science'] : [];
      const combined = Array.from(new Set([...classSubjects, ...enteredSubs, ...extraParts])).filter(Boolean);
      combined.sort((a,b) => a.localeCompare(b));

      subjectEl.innerHTML = combined.map(s => {
        const hasMarks = enteredSubs.has(s);
        return `<option value="${s}">${s}${hasMarks ? ' (Has Entered Marks)' : ''}</option>`;
      }).join('');

      fetchMarksCount();
    }

    let countAbortCtrl = null;
    async function fetchMarksCount() {
      const cls = classEl.value;
      const ex = examEl.value;
      const sub = subjectEl.value;

      if (!cls || !ex || !sub) {
        previewEl.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Select a class, exam, and subject.</span>`;
        updateBtnState();
        return;
      }

      previewEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; color:#64748b; font-size:0.85rem;">
          <span class="material-symbols-outlined" style="font-size:18px;">hourglass_empty</span>
          Checking database for <strong>${sub}</strong> in <strong>${cls}</strong>...
        </div>
      `;

      try {
        if (countAbortCtrl) countAbortCtrl.abort();
        countAbortCtrl = new AbortController();

        const token = localStorage.getItem('token') || '';
        const url = `/api/exams/count-subject-marks?className=${encodeURIComponent(cls)}&examName=${encodeURIComponent(ex)}&subject=${encodeURIComponent(sub)}`;
        
        let count = 0;
        if (typeof api === 'function') {
          const res = await api(url, { signal: countAbortCtrl.signal });
          count = res?.count || 0;
        } else {
          const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token },
            signal: countAbortCtrl.signal
          });
          const data = await res.json();
          count = data?.count || 0;
        }

        if (count > 0) {
          previewEl.innerHTML = `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; color:#b91c1c;">
              <div style="font-weight:700; font-size:0.95rem; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:20px;">delete</span>
                Found ${count} student mark records for "${sub}"
              </div>
              <div style="font-size:0.8rem; color:#991b1b; margin-top:3px;">
                Class: <strong>${cls}</strong> &bull; Exam: <strong>${ex}</strong>
              </div>
            </div>
          `;
        } else {
          previewEl.innerHTML = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 14px; color:#15803d;">
              <div style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span>
                0 records found in app_exam_marks (Subject may already be clear or in exams table only)
              </div>
            </div>
          `;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        previewEl.innerHTML = `<span style="color:#64748b; font-size:0.85rem;">Ready to delete ${sub} for ${cls}.</span>`;
      }

      updateBtnState();
    }

    function updateBtnState() {
      const isReady = checkEl.checked && subjectEl.value;
      delBtn.disabled = !isReady;
      delBtn.style.opacity = isReady ? '1' : '0.5';
      delBtn.style.cursor = isReady ? 'pointer' : 'not-allowed';
    }

    classEl.onchange = () => { updateSubjectsDropdown(); };
    examEl.onchange = () => { updateSubjectsDropdown(); };
    subjectEl.onchange = () => { fetchMarksCount(); };
    checkEl.onchange = () => { updateBtnState(); };

    updateSubjectsDropdown();

    delBtn.onclick = async () => {
      const cls = classEl.value;
      const ex = examEl.value;
      const sub = subjectEl.value;
      const sessionVal = (document.getElementById("examEntrySession")?.value) || '2026-27';

      if (!cls || !ex || !sub) return;

      const confirmMsg = `⚠️ CRITICAL CONFIRMATION ⚠️\n\nAre you ABSOLUTELY sure you want to permanently delete all marks for:\n\n• Subject: ${sub}\n• Class: ${cls}\n• Exam: ${ex}\n\nThis will remove marks for ALL students in this class and update their report card totals. This cannot be undone!`;
      if (!await window.appConfirm(confirmMsg, { title: "Permanent Delete Warning", confirmText: "Permanently Delete", type: "danger" })) return;

      delBtn.disabled = true;
      delBtn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size:18px;">hourglass_empty</span>
        Deleting Marks from Database...
      `;

      try {
        const payload = { className: cls, examName: ex, subject: sub, session: sessionVal };
        const token = localStorage.getItem('token') || '';
        let resData = null;

        if (typeof api === 'function') {
          resData = await api('/api/exams/delete-subject-marks', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        } else {
          const resp = await fetch('/api/exams/delete-subject-marks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
          });
          resData = await resp.json();
          if (!resp.ok) throw new Error(resData.error || 'Deletion failed');
        }

        if (typeof showToast !== 'undefined') {
          showToast(`Marks for ${sub} in Class ${cls} deleted successfully!`, "success");
        } else {
          alert(`Marks for ${sub} in Class ${cls} deleted successfully!`);
        }

        closeModal();

        if (typeof loadStore === 'function') {
          await loadStore();
        }

        const currentSelectedClass = document.getElementById("examEntryClassSelect")?.value;
        const currentExamName = document.getElementById("examEntryName")?.value;
        if (currentSelectedClass === cls && currentExamName === ex) {
          loadStudentsForMarksEntry(cls, ex, sessionVal);
        } else {
          loadPreviousExams(document.getElementById("examEntryTableContainer"));
        }
      } catch (err) {
        console.error("Delete marks error:", err);
        alert("Failed to delete marks: " + (err.message || "Network error"));
        delBtn.disabled = false;
        delBtn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:18px;">delete_forever</span>
          Permanently Delete Marks
        `;
      }
    };
  };

  // ==========================================
  // TAB 1: MARKS ENTRY
  // ==========================================
  function renderMarksEntry(container) {
    const isAllowedAdmin = (typeof userIsAdmin === 'function' && userIsAdmin()) || 
                           (typeof currentUser !== 'undefined' && currentUser && String(currentUser.role).toLowerCase() === 'administrator') ||
                           (typeof window !== 'undefined' && window.currentUser && String(window.currentUser.role).toLowerCase() === 'administrator');

    const adminDeleteButtonHtml = isAllowedAdmin ? `
      <button type="button" class="exam-btn" onclick="window.openDeleteClassSubjectMarksModal()" style="padding: 9px 16px; font-size: 0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:#fef2f2; color:#dc2626; border:1.5px solid #fecaca; font-weight:700;" title="Delete all marks for a specific class and subject (Admin Only)">
        <span class="material-symbols-outlined" style="font-size:18px;">delete_sweep</span>
        Delete Marks (Class & Subject Wise)
      </button>
    ` : '';

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Enter Student Marks</h4>
          <p style="margin:0; color: inherit; font-size:0.9rem;">Record subject-wise marks for examinations.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${adminDeleteButtonHtml}
          <button type="button" class="exam-btn" onclick="window.openSubjectRulesModal()" style="padding: 9px 16px; font-size: 0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:#eff6ff; color:#2563eb; border:1.5px solid #bfdbfe; font-weight:700;" title="Configure Subject Max Marks (100 or 50) and select which subjects decide Pass/Fail">
            <span class="material-symbols-outlined" style="font-size:18px;">tune</span>
            Configure Subject Rules & Max Marks (100 / 50)
          </button>
          <button type="button" class="exam-btn exam-btn-secondary" onclick="if(window.navigateToModule){window.navigateToModule('subjects');}else{location.hash='#subjects';}" style="padding: 9px 16px; font-size: 0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="View, edit, or delete class subjects">
            <span class="material-symbols-outlined" style="font-size:18px;">menu_book</span>
            Manage Subjects (Edit / Delete)
          </button>
        </div>
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

    loadPreviousExams(document.getElementById("examEntryTableContainer"));
  }

  function loadPreviousExams(container) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const exams = store.exams || [];
    
    if(exams.length === 0) {
      container.innerHTML = `
         <div class="empty-state">
           <span class="material-symbols-outlined" style="font-size:44px;color:#94a3b8;display:block;margin:0 auto 12px;">assignment</span>
           <h4>Ready to enter marks</h4>
           <p>Select a class and click "Load Students" to begin.</p>
         </div>
      `;
      return;
    }

    // Group by className, examName, session (only active students)
    const grouped = {};
    const activeExams = (store.exams || []).filter(e => isExamForActiveStudent(e, store.students || []));
    activeExams.forEach(e => {
        const key = `${e.className}|${e.examName}|${e.session}`;
        if (!grouped[key]) {
            grouped[key] = { className: e.className, examName: e.examName, session: e.session, count: 0, ids: [] };
        }
        grouped[key].count++;
        grouped[key].ids.push(e.id);
    });

    const groups = Object.values(grouped);

    let html = `
      <div style="margin-top: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">
            <h4 style="margin:0; color: inherit; font-size:1.1rem;">Previous Marks Entries</h4>
        </div>
        <div class="table-wrap exam-table-wrap" style="overflow-x:auto; width:100%;">
          <table style="width:100%; min-width:880px; border-collapse: collapse; text-align: left; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-family:'Outfit',sans-serif;">
            <thead style="background: #f1f5f9; color: #475569; font-size: 0.9rem;">
              <tr>
                <th style="padding: 12px 15px; font-weight: 600;">Class</th>
                <th style="padding: 12px 15px; font-weight: 600;">Exam Name</th>
                <th style="padding: 12px 15px; font-weight: 600;">Session</th>
                <th style="padding: 12px 15px; font-weight: 600;">Students Graded</th>
                <th style="padding: 12px 15px; font-weight: 600; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
    `;

    const isAllowedAdmin = (typeof userIsAdmin === 'function' && userIsAdmin()) || 
                           (typeof currentUser !== 'undefined' && currentUser && String(currentUser.role).toLowerCase() === 'administrator') ||
                           (typeof window !== 'undefined' && window.currentUser && String(window.currentUser.role).toLowerCase() === 'administrator');

    groups.forEach((g) => {
        const idsJson = JSON.stringify(g.ids).replace(/"/g, '&quot;');
        html += `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                <td style="padding: 12px 15px; font-weight: 500;">${g.className}</td>
                <td style="padding: 12px 15px;">${g.examName}</td>
                <td style="padding: 12px 15px;">${g.session}</td>
                <td style="padding: 12px 15px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">${g.count} Students</span></td>
                <td style="padding: 12px 15px; text-align:right;">
                    <button class="exam-btn exam-btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; margin-right: 5px;" onclick="window.loadPreviousExamStudents('${g.className}', '${g.examName}', '${g.session}')">Edit Marks</button>
                    ${isAllowedAdmin ? `<button class="exam-btn" style="padding: 6px 10px; background: #fff1f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight:600; margin-right: 5px;" onclick="window.openDeleteClassSubjectMarksModal('${g.className}', '${g.examName}')" title="Delete a specific subject marks for this class (Admin Only)">Delete Subject</button>` : ''}
                    ${isAllowedAdmin ? `<button class="exam-btn" style="padding: 6px 12px; background: #ef4444; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" onclick="window.deleteEntireExam(this)" data-ids="${idsJson}">Delete All</button>` : ''}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  window.loadPreviousExamStudents = function(cls, examName, session) {
      document.getElementById("examEntryClassSelect").value = cls;
      document.getElementById("examEntryName").value = examName;
      document.getElementById("examEntrySession").value = session;
      document.getElementById("examEntryLoadBtn").click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.deleteEntireExam = async function(btn) {
      if (!await window.appConfirm("Are you sure you want to delete ALL marks for this exam? This cannot be undone.", { title: "Delete All Marks?", confirmText: "Delete All Marks", type: "danger" })) return;
      const idsStr = btn.getAttribute("data-ids");
      const ids = JSON.parse(idsStr);
      
      btn.textContent = "Deleting...";
      btn.disabled = true;

      try {
          for (const id of ids) {
              if (typeof api === 'function') {
                  await api('/api/modules/exams/' + id, { method: 'DELETE' });
              } else {
                  await fetch('/api/modules/exams/' + id, { 
                      method: 'DELETE',
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                      }
                  });
              }
          }
          
          if (typeof loadStore === 'function') {
              await loadStore();
          }
          
          if (typeof showToast !== 'undefined') showToast("Entire exam deleted successfully", "info");
          loadPreviousExams(document.getElementById("examEntryTableContainer"));
      } catch (e) {
          console.error("Error deleting exam:", e);
          alert("Error deleting exam: " + (e.message || "Network error"));
          btn.textContent = "Delete";
          btn.disabled = false;
      }
  };

  function isStudentActive(student) {
    if (!student) return false;
    const st = String(student.status || '').trim().toLowerCase();
    if (st === 'inactive' || st === 'left' || st === 'archived' || st === 'dropped' || st === 'tc issued') {
      return false;
    }
    return true;
  }
  window.isStudentActive = isStudentActive;

  function isExamForActiveStudent(exam, studentList) {
    if (!exam) return false;
    const s = findStudentFromStore(studentList || [], exam);
    if (s && s.id) {
      return isStudentActive(s);
    }
    return true;
  }
  window.isExamForActiveStudent = isExamForActiveStudent;

  function findStudentFromStore(studentList, criteria) {
    if (!studentList || !Array.isArray(studentList) || !criteria) return {};

    // 0. Match by Student Primary Key ID when explicitly provided
    const targetId = criteria.studentId || criteria.student_id;
    if (targetId && String(targetId) !== '0' && String(targetId) !== '-1') {
      const byId = studentList.find(s => String(s.id) === String(targetId));
      if (byId) return byId;
    }
    
    const targetAdm = String(criteria.admissionNo || criteria.admNo || '').trim().toLowerCase();

    // 1. Strict Match by Unique Admission Number Only
    if (targetAdm && targetAdm !== '-' && targetAdm !== 'null' && targetAdm !== 'undefined') {
      const matchingAdms = studentList.filter(s => {
        const sAdm = String(s.admissionNo || s.admNo || '').trim().toLowerCase();
        return sAdm === targetAdm;
      });
      if (matchingAdms.length > 0) {
        const activeMatches = matchingAdms.filter(s => isStudentActive(s));
        const pool = activeMatches.length > 0 ? activeMatches : matchingAdms;
        const withPhoto = pool.find(s => (s.photo && String(s.photo).length > 20) || (s.photoUrl && String(s.photoUrl).length > 5));
        return withPhoto || pool[0];
      }
    }

    return {};
  }

  function loadStudentsForMarksEntry(className, examName, session) {
    const container = document.getElementById("examEntryTableContainer");
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
    const students = (store.students || []).filter(s => (normFunc(s.className) === normFunc(className) || s.className === className) && isStudentActive(s));
    
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

    const isAllowedAdmin = (typeof userIsAdmin === 'function' && userIsAdmin()) || 
                           (typeof currentUser !== 'undefined' && currentUser && String(currentUser.role).toLowerCase() === 'administrator') ||
                           (typeof window !== 'undefined' && window.currentUser && String(window.currentUser.role).toLowerCase() === 'administrator');

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 18px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="material-symbols-outlined" style="color:#2563eb; font-size:22px;">assignment</span>
          <span style="font-weight:700; font-size:0.95rem; color:#1e293b;">${className} &bull; ${examName} (${session || '2026-27'})</span>
          <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">${students.length} Students</span>
        </div>
        ${isAllowedAdmin ? `
          <button type="button" class="exam-btn" onclick="window.openDeleteClassSubjectMarksModal('${className}', '${examName}')" style="padding: 7px 14px; font-size: 0.8rem; display:inline-flex; align-items:center; gap:5px; cursor:pointer; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-weight:700; border-radius:8px;" title="Delete all marks for a subject in ${className} (Admin Only)">
            <span class="material-symbols-outlined" style="font-size:16px;">delete_sweep</span>
            Delete Subject Marks
          </button>
        ` : ''}
      </div>
      <div class="table-wrap exam-table-wrap" style="width:100%; overflow-x:auto;">
        <table class="exam-data-table" style="min-width:680px; width:100%;">
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
      const existingExam = (store.exams || []).find(e => {
        const matchExam = (e.examName || '').trim().toLowerCase() === (examName || '').trim().toLowerCase();
        const matchSession = !session || (e.session || '').trim().toLowerCase() === (session || '').trim().toLowerCase();
        if (!matchExam || !matchSession) return false;

        const admA = (e.admissionNo || '').trim().toLowerCase();
        const admB = (s.admissionNo || '').trim().toLowerCase();
        return !!(admA && admB && admA === admB);
      });
      const isEntered = !!existingExam;
      const statusHtml = isEntered ? '<span class="status-badge status-entered">Entered</span>' : '<span class="status-badge status-pending">Pending</span>';
      const btnText = isEntered ? 'Edit Marks' : 'Enter Marks';
      let actionButtons = `<button class="exam-btn exam-btn-secondary" onclick="window.openMarksModal('${s.id}', '${examName}', '${session}', '${className}')">${btnText}</button>`;
      
      if (isEntered && existingExam && existingExam.id) {
          actionButtons += ` <button class="exam-btn" style="background:#ef4444; color:#fff; border:none; padding:8px 12px; margin-left:5px; border-radius:4px; font-weight:600; cursor:pointer;" onclick="window.deleteMarksEntry('${existingExam.id}', '${className}', '${examName}', '${session}')">Delete</button>`;
      }

      const sPhotoUri = getStudentPhotoUri(s, s.id || s.admissionNo);
      html += `
        <tr>
          <td><strong>${s.rollNo || '-'}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              ${sPhotoUri ? `<img src="${sPhotoUri}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid #cbd5e1; background:#f8fafc; flex-shrink:0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : ''}
              <div style="${sPhotoUri ? 'display:none;' : 'display:flex;'} width:34px; height:34px; border-radius:50%; background:#e2e8f0; color:#475569; align-items:center; justify-content:center; font-size:12px; font-weight:800; flex-shrink:0;">${(s.fullName || 'S')[0]}</div>
              <div>
                <div style="font-weight:700; color: inherit; font-size:0.92rem;">${s.fullName}</div>
                <div style="font-size:0.75rem; color: #64748b;">Adm: <strong>${s.admissionNo || '-'}</strong> ${s.fatherName ? '• S/D of ' + formatParentName(s.fatherName) : ''}</div>
              </div>
            </div>
          </td>
          <td>${statusHtml}</td>
          <td style="text-align:right;">
             ${actionButtons}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  window.deleteMarksEntry = async function(id, className, examName, session) {
    if (!await window.appConfirm("Are you sure you want to delete this marks entry?", { title: "Delete Marks Entry?", confirmText: "Delete Entry", type: "danger" })) return;
    try {
        if (typeof api === 'function') {
            await api('/api/modules/exams/' + id, { method: 'DELETE' });
        } else {
            await fetch('/api/modules/exams/' + id, { 
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                }
            });
        }
        if (typeof loadStore === 'function') {
            await loadStore();
        }
        if (typeof showToast !== 'undefined') showToast("Marks entry deleted", "info");
        loadStudentsForMarksEntry(className, examName, session);
    } catch (e) {
        console.error("Error deleting marks entry:", e);
        alert("Error deleting marks entry: " + (e.message || "Network error"));
    }
  };

  window.calcSSTTheoryRow = function() {};

  window.openMarksModal = function(studentId, examName, session, className) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const student = (store.students || []).find(s => String(s.id) === String(studentId));
    if(!student) return;

    const isHalfYearly = /half|mid|term-1|term 1|pa1/i.test(examName);
    const isAnnual = !isHalfYearly && /annual|term-2|term 2|\byearly\b|final|session ending|pa2/i.test(examName);
    const isCBSE = isHalfYearly || isAnnual;
    const paLabel = isAnnual ? 'PA2 (10)' : 'PA1 (10)';
    const examLabel = isAnnual ? 'Annual Exam (80)' : 'Half Yearly (80)';

    let existingExam = (store.exams || []).find(e => {
      const matchExam = (e.examName || '').trim().toLowerCase() === (examName || '').trim().toLowerCase();
      const matchSession = !session || (e.session || '').trim().toLowerCase() === (session || '').trim().toLowerCase();
      if (!matchExam || !matchSession) return false;

      const admA = (e.admissionNo || '').trim().toLowerCase();
      const admB = (student.admissionNo || '').trim().toLowerCase();
      return !!(admA && admB && admA === admB);
    });
    
    let existingSubjects = [];
    if (existingExam && existingExam.subjectMarks) {
      try {
        existingSubjects = typeof existingExam.subjectMarks === 'string'
          ? JSON.parse(existingExam.subjectMarks)
          : existingExam.subjectMarks;
        if (!Array.isArray(existingSubjects)) existingSubjects = [];
      } catch(e) {
        console.error("Parse error", e);
        existingSubjects = [];
      }
    }

    const defaults = getSubjectsForClass(className);
    const allSubjectNames = [];
    defaults.forEach(sub => {
      const c = canonicalSubjectName(sub);
      if (c && !allSubjectNames.includes(c)) {
        allSubjectNames.push(c);
      }
    });
    existingSubjects.forEach(s => {
      const c = canonicalSubjectName(s && s.subject);
      if (c && !allSubjectNames.includes(c)) {
        allSubjectNames.push(c);
      }
    });

    let subjectData = allSubjectNames.map(subName => {
      const found = existingSubjects.find(s => s && s.subject && canonicalSubjectName(s.subject) === subName);
      const isMain = isSubjectMain(subName, className, found);
      const defMaxMin = getDefaultMaxMarksForSubject(subName, className);
      if (found) {
        const foundMax = found.max !== undefined && found.max !== '' ? parseFloat(found.max) : defMaxMin.max;
        const foundMin = found.min !== undefined && found.min !== '' ? parseFloat(found.min) : defMaxMin.min;
        return {
          subject: subName,
          isMain: isMain,
          max: foundMax,
          min: foundMin,
          pa1: found.pa1 !== undefined && found.pa1 !== '' ? found.pa1 : (found.pa2 !== undefined && found.pa2 !== '' ? found.pa2 : ''),
          pa2: found.pa2 !== undefined && found.pa2 !== '' ? found.pa2 : (found.pa1 !== undefined && found.pa1 !== '' ? found.pa1 : ''),
          notebook: found.notebook !== undefined && found.notebook !== '' ? found.notebook : '',
          enrichment: found.enrichment !== undefined && found.enrichment !== '' ? found.enrichment : '',
          theory: found.theory !== undefined && found.theory !== '' ? found.theory : (found.subjective !== undefined && found.subjective !== '' ? found.subjective : ''),
          practical: found.practical !== undefined ? found.practical : '',
          total: found.total !== undefined ? found.total : 0,
          components: found.components || null
        };
      }
      return {
        subject: subName,
        isMain: isMain,
        max: defMaxMin.max,
        min: defMaxMin.min,
        pa1: '',
        pa2: '',
        notebook: '',
        enrichment: '',
        theory: '',
        practical: '',
        total: 0,
        components: null
      };
    });

    const overlay = document.createElement("div");
    overlay.className = "exam-modal-overlay active";
    overlay.id = "examMarksModal";

    let rowsHtml = '';
    subjectData.forEach((sd, idx) => {
      const isDrawing = isDrawingSubject(sd.subject);
      const isAddl = isDrawing ? true : !sd.isMain;
      const paVal = isAnnual ? (sd.pa2 !== undefined && sd.pa2 !== '' ? sd.pa2 : (sd.pa1 || '')) : (sd.pa1 !== undefined && sd.pa1 !== '' ? sd.pa1 : '');
      const nbVal = sd.notebook !== undefined ? sd.notebook : '';
      const enrVal = sd.enrichment !== undefined ? sd.enrichment : '';
      const thVal = sd.theory !== undefined ? sd.theory : (sd.subjective || '');

      const maxVal = sd.max !== undefined && parseFloat(sd.max) > 0 ? parseFloat(sd.max) : 100;
      const minVal = sd.min !== undefined && parseFloat(sd.min) > 0 ? parseFloat(sd.min) : Math.round(maxVal * 0.33);
      const thMax = isAddl ? maxVal : (maxVal <= 50 ? maxVal : 80);
      const thPlaceholder = isDrawing ? "Grade (A-E) or Marks" : (isAddl ? `0-${maxVal}` : (maxVal <= 50 ? `0-${maxVal}` : "0-80"));

      if (isCBSE) {
        const drawGrade = isDrawing ? resolveDrawingGrade(sd, true) : '';
        const cellContent = (sd.isAbsent || String(sd.total).toUpperCase() === 'AB')
          ? '<span style="color:#dc2626; font-weight:900;">AB</span>'
          : (isDrawing ? `<span style="color:#2563eb; font-weight:900; background:#eff6ff; padding:2px 8px; border-radius:4px; border:1px solid #bfdbfe;">${drawGrade}</span>` : (sd.total || 0));

        rowsHtml += `
          <div class="marks-subject-row cbse-mode" data-idx="${idx}">
            <input type="text" class="sub-name" value="${sd.subject}" placeholder="Subject Name" />
            <button type="button" class="sub-role-toggle ${isDrawing ? 'role-additional' : (sd.isMain ? 'role-main' : 'role-additional')}" data-is-main="${isDrawing ? '0' : (sd.isMain ? '1' : '0')}" onclick="window.toggleSubjectRoleInRow(this)" title="${isDrawing ? 'Graded Subject: Graded only, excluded from Grand Total' : (sd.isMain ? 'Main Subject: CBSE Pattern with PA1 (10) + NB (5) + Enr (5) + Theory (80) = 100' : 'Additional Subject: In 100 only (No PA1, NB, Enr option needed in Half Yearly)')}">${isDrawing ? '🎨 Graded' : (sd.isMain ? '⭐ Main' : '➕ Addl')}</button>
            <div class="sub-max-box" style="display:flex; flex-direction:column; align-items:center; gap:2px;">
              <input type="number" class="sub-max" value="${maxVal}" placeholder="${maxVal}" min="1" oninput="window.handleRowMaxChange(this)" style="padding:6px 2px; text-align:center; font-weight:800; font-size:0.9rem;" />
              <div style="display:flex; gap:2px;">
                <button type="button" class="preset-btn ${maxVal == 100 ? 'active' : ''}" onclick="window.setRowMax(this, 100)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:${maxVal == 100 ? '#2563eb' : '#ffffff'}; color:${maxVal == 100 ? '#ffffff' : '#475569'}; font-weight:800; cursor:pointer;" title="Set 100 Max">100</button>
                <button type="button" class="preset-btn ${maxVal == 50 ? 'active' : ''}" onclick="window.setRowMax(this, 50)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:${maxVal == 50 ? '#16a34a' : '#ffffff'}; color:${maxVal == 50 ? '#ffffff' : '#475569'}; font-weight:800; cursor:pointer;" title="Set 50 Max">50</button>
              </div>
            </div>
            <input type="number" class="sub-min" value="${minVal}" placeholder="${minVal}" min="0" />
            <input type="number" class="sub-pa" value="${isAddl ? '' : paVal}" placeholder="${isAddl ? '-' : '0-10'}" min="0" max="10" ${isAddl ? 'disabled style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed; text-align:center;" title="N/A for Additional Subject (100 Max)"' : ''} />
            <input type="number" class="sub-nb" value="${isAddl ? '' : nbVal}" placeholder="${isAddl ? '-' : '0-5'}" min="0" max="5" ${isAddl ? 'disabled style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed; text-align:center;" title="N/A for Additional Subject (100 Max)"' : ''} />
            <input type="number" class="sub-enr" value="${isAddl ? '' : enrVal}" placeholder="${isAddl ? '-' : '0-5'}" min="0" max="5" ${isAddl ? 'disabled style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed; text-align:center;" title="N/A for Additional Subject (100 Max)"' : ''} />
            <input type="text" class="sub-th" value="${thVal}" placeholder="${thPlaceholder}" title="${isDrawing ? 'Enter Grade (e.g. A, B, C2) or Marks (0-100)' : (isAddl ? 'Direct Exam Marks in 100 only or AB' : 'Exam Marks (0-80 or AB)')}" style="${isAddl ? 'border-color:#3b82f6; background:#eff6ff; font-weight:800;' : ''}" />
            <div class="total-cell" id="sub-tot-${idx}">${cellContent}</div>
            <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
          </div>
        `;
      } else {
        const standardMax = sd.max !== undefined && parseFloat(sd.max) > 0 ? parseFloat(sd.max) : 100;
        const standardMin = sd.min !== undefined && parseFloat(sd.min) > 0 ? parseFloat(sd.min) : Math.round(standardMax * 0.33);
        const drawGrade = isDrawing ? resolveDrawingGrade(sd, false) : '';
        const cellContent = (sd.isAbsent || String(sd.total).toUpperCase() === 'AB')
          ? '<span style="color:#dc2626; font-weight:900;">AB</span>'
          : (isDrawing ? `<span style="color:#2563eb; font-weight:900; background:#eff6ff; padding:2px 8px; border-radius:4px; border:1px solid #bfdbfe;">${drawGrade}</span>` : (sd.total || 0));

        rowsHtml += `
          <div class="marks-subject-row" data-idx="${idx}">
            <input type="text" class="sub-name" value="${sd.subject}" placeholder="Subject Name" />
            <button type="button" class="sub-role-toggle ${isDrawing ? 'role-additional' : (sd.isMain ? 'role-main' : 'role-additional')}" data-is-main="${isDrawing ? '0' : (sd.isMain ? '1' : '0')}" onclick="window.toggleSubjectRoleInRow(this)" title="${isDrawing ? 'Graded Subject: Graded only, excluded from Grand Total' : (sd.isMain ? 'Main Subject: Marks strictly decide Pass or Fail' : 'Additional Subject: Never fails student')}">${isDrawing ? '🎨 Graded' : (sd.isMain ? '⭐ Main' : '➕ Addl')}</button>
            <div class="sub-max-box" style="display:flex; flex-direction:column; align-items:center; gap:2px;">
              <input type="number" class="sub-max" value="${standardMax}" placeholder="${standardMax}" min="1" oninput="window.handleRowMaxChange(this)" style="padding:6px 2px; text-align:center; font-weight:800; font-size:0.9rem;" />
              <div style="display:flex; gap:2px;">
                <button type="button" class="preset-btn ${standardMax == 100 ? 'active' : ''}" onclick="window.setRowMax(this, 100)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:${standardMax == 100 ? '#2563eb' : '#ffffff'}; color:${standardMax == 100 ? '#ffffff' : '#475569'}; font-weight:800; cursor:pointer;" title="Set 100 Max">100</button>
                <button type="button" class="preset-btn ${standardMax == 50 ? 'active' : ''}" onclick="window.setRowMax(this, 50)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:${standardMax == 50 ? '#16a34a' : '#ffffff'}; color:${standardMax == 50 ? '#ffffff' : '#475569'}; font-weight:800; cursor:pointer;" title="Set 50 Max">50</button>
              </div>
            </div>
            <input type="number" class="sub-min" value="${standardMin}" placeholder="${standardMin}" min="0" />
            <input type="text" class="sub-th" value="${sd.theory}" placeholder="${isDrawing ? 'Grade or Marks' : '0 or AB'}" />
            <input type="number" class="sub-pr" value="${isDrawing ? '' : sd.practical}" placeholder="${isDrawing ? '-' : '0'}" min="0" ${isDrawing ? 'disabled style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed;"' : ''} />
            <div class="total-cell" id="sub-tot-${idx}">${cellContent}</div>
            <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
          </div>
        `;
      }
    });

    const headerHtml = isCBSE ? `
      <div class="marks-subject-header cbse-mode">
        <div>Subject Name</div>
        <div style="text-align:center;">Role</div>
        <div>Max</div>
        <div>Min</div>
        <div>${paLabel}</div>
        <div>Notebook (5)</div>
        <div>Subject Enrichment (5)</div>
        <div>${examLabel}<br><small style="font-size:0.65rem; opacity:0.85;">(Core 80 / Addl 100)</small></div>
        <div style="text-align:center;">Total</div>
        <div></div>
      </div>
    ` : `
      <div class="marks-subject-header">
        <div>Subject Name</div>
        <div style="text-align:center;">Role</div>
        <div>Max</div>
        <div>Min</div>
        <div>Theory</div>
        <div>Prac/Int</div>
        <div style="text-align:center;">Total</div>
        <div></div>
      </div>
    `;

    overlay.innerHTML = `
      <div class="exam-modal" style="max-width: ${isCBSE ? '1020px' : '900px'};">
        <div class="exam-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${(function() {
              const pUri = getStudentPhotoUri(student, student.id || student.admissionNo);
              return pUri ? `<img src="${pUri}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid #3b82f6; background:#fff; flex-shrink:0;" onerror="this.style.display='none'" />` : '';
            })()}
            <div>
              <h2 style="margin:0;">${student.fullName} <span style="display:block; font-size:0.85rem; font-weight:600; color:#64748b; margin-top:3px;">Class: ${className} | Roll: ${student.rollNo} | Adm: ${student.admissionNo || '-'} | Exam: ${examName} ${isCBSE ? '• (CBSE ' + (isAnnual ? 'Term-2' : 'Term-1') + ' Format)' : ''}</span></h2>
            </div>
          </div>
          <button class="exam-close-btn" onclick="document.getElementById('examMarksModal').remove()">×</button>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:8px 14px; margin-bottom:14px; font-size:0.8rem; color:#1e40af;">
          <div>
            <span style="font-weight:800;">⚡ Pass/Fail Rule:</span> Only <strong>⭐ Main Subjects</strong> decide Pass or Fail. <strong>➕ Additional Subjects</strong> never fail a student!
          </div>
          <button type="button" onclick="window.openSubjectRulesModal('${className}')" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:4px 10px; font-size:0.75rem; font-weight:700; cursor:pointer;">Configure Rules</button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px 14px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:800; font-size:0.82rem; color:#334155;">⚡ Subject Max Marks:</span>
            <span style="font-size:0.75rem; color:#64748b;">Click <strong>[100]</strong> or <strong>[50]</strong> on any row, or batch set:</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="exam-btn" onclick="window.applyQuickMaxToAllSubjects(100)" style="padding:4px 10px; font-size:0.75rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; cursor:pointer;" title="Set all subjects to 100 Max">All 100</button>
            <button type="button" class="exam-btn" onclick="window.applyQuickMaxToAllSubjects(50)" style="padding:4px 10px; font-size:0.75rem; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; cursor:pointer;" title="Set all subjects to 50 Max">All 50</button>
            <button type="button" class="exam-btn" onclick="window.applyStandardCbseMaxScale()" style="padding:4px 10px; font-size:0.75rem; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:6px; font-weight:700; cursor:pointer;" title="Core Academic = 100, Moral Science & GK = 50">Auto Scale (Core 100 / Moral & GK 50)</button>
          </div>
        </div>

        ${headerHtml}
        
        <div id="marksSubjectContainer">
          ${rowsHtml}
        </div>
        
        <div style="margin-top:15px; display:flex; justify-content:space-between; align-items:center;">
          <button id="addSubjectBtn" class="exam-btn exam-btn-secondary" style="font-size:0.8rem; padding:8px 15px;">+ Add Subject</button>
          ${isCBSE ? '<span style="font-size:0.8rem; color:#64748b; font-weight:600;">CBSE 8-Point Grading: A1 (91-100), A2 (81-90), B1 (71-80), B2 (61-70), C1 (51-60), C2 (41-50), D (33-40), E (&le;32)</span>' : ''}
        </div>

        <div class="marks-summary-box" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; text-align:center; padding:18px 20px;">
          <div class="marks-summary-item">
            <p style="margin:0 0 4px 0; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Main Subjects Total</p>
            <h4 id="marksGrandTotal" style="margin:0; font-size:1.5rem; font-weight:900; color:#ffffff;">0</h4>
            <div id="marksOverallSubtext" style="font-size:0.7rem; color:#94a3b8; margin-top:3px;">All Subjects: 0</div>
          </div>
          <div class="marks-summary-item">
            <p style="margin:0 0 4px 0; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Percentage (Main)</p>
            <h4 id="marksPercentage" style="margin:0; font-size:1.5rem; font-weight:900; color:#ffffff;">0%</h4>
          </div>
          <div class="marks-summary-item">
            <p style="margin:0 0 4px 0; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Grade (Main)</p>
            <h4 id="marksGrade" style="margin:0; font-size:1.5rem; font-weight:900; color:#ffffff;">-</h4>
          </div>
          <div class="marks-summary-item" style="border-left:1px solid #334155; padding-left:12px;">
            <p style="margin:0 0 4px 0; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Result Status</p>
            <h4 id="marksResultStatus" style="margin:0; font-size:1.35rem; font-weight:900; color:#4ade80;">PASS</h4>
            <div id="marksStatusReason" style="font-size:0.7rem; color:#86efac; margin-top:3px;">All Main Subjects Passed</div>
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

    window.setRowMax = function(btn, newMax) {
      const row = btn.closest('.marks-subject-row');
      if (!row) return;
      const maxInput = row.querySelector('.sub-max');
      if (maxInput) {
        maxInput.value = newMax;
        window.handleRowMaxChange(maxInput);
      }
    };

    window.handleRowMaxChange = function(maxInput) {
      const row = maxInput.closest('.marks-subject-row');
      if (!row) return;
      const val = parseFloat(maxInput.value) || 100;
      
      // Update min to 33%
      const minInput = row.querySelector('.sub-min');
      if (minInput) {
        minInput.value = Math.round(val * 0.33);
      }

      // Update preset pills active state
      row.querySelectorAll('.preset-btn').forEach(btn => {
        const bVal = parseInt(btn.textContent, 10);
        const isMatch = bVal === val;
        btn.style.background = isMatch ? (bVal === 50 ? '#16a34a' : '#2563eb') : '#ffffff';
        btn.style.color = isMatch ? '#ffffff' : '#475569';
      });

      // If CBSE mode, adapt theory input
      const thInput = row.querySelector('.sub-th');
      if (thInput) {
        if (val <= 50) {
          thInput.max = val;
          thInput.placeholder = `0-${val}`;
        } else {
          const thMax = Math.round(val * 0.8);
          thInput.max = thMax;
          thInput.placeholder = `0-${thMax}`;
        }
      }

      window.calcExamTotals();
    };

    window.applyQuickMaxToAllSubjects = function(newMax) {
      const container = document.getElementById("marksSubjectContainer");
      if (!container) return;
      const rows = container.querySelectorAll(".marks-subject-row");
      rows.forEach(r => {
        const maxInput = r.querySelector('.sub-max');
        if (maxInput) {
          maxInput.value = newMax;
          window.handleRowMaxChange(maxInput);
        }
      });
    };

    window.applyStandardCbseMaxScale = function() {
      const container = document.getElementById("marksSubjectContainer");
      if (!container) return;
      const rows = container.querySelectorAll(".marks-subject-row");
      rows.forEach(r => {
        const subName = r.querySelector('.sub-name')?.value || '';
        const defMax = getDefaultMaxMarksForSubject(subName, className).max;
        const maxInput = r.querySelector('.sub-max');
        if (maxInput) {
          maxInput.value = defMax;
          window.handleRowMaxChange(maxInput);
        }
      });
    };
    
    window.calcExamTotals = function() {
      const rows = container.querySelectorAll(".marks-subject-row");
      const evaluatedForStatus = [];

      rows.forEach((row, i) => {
        let total = 0;
        let isRowAbsent = false;
        const maxMarks = parseFloat(row.querySelector(".sub-max")?.value) || 100;
        const minMarks = parseFloat(row.querySelector(".sub-min")?.value) || 33;
        const subName = row.querySelector(".sub-name")?.value || `Subject ${i+1}`;
        const isMain = row.querySelector(".sub-role-toggle")?.getAttribute("data-is-main") === "1";
        let hasAnyInput = false;

        if (isCBSE) {
          const isAddl = !isMain;
          const paRaw = row.querySelector(".sub-pa")?.value;
          const nbRaw = row.querySelector(".sub-nb")?.value;
          const enrRaw = row.querySelector(".sub-enr")?.value;
          const thRaw = row.querySelector(".sub-th")?.value?.trim();
          const isExplicitAB = thRaw && thRaw.toUpperCase() === 'AB';

          if (isExplicitAB) {
            hasAnyInput = true;
            isRowAbsent = true;
            total = 'AB';
          } else if (isAddl) {
            // Additional subjects (Sanskrit, Moral Science, GK, Computer): Direct in 100 only, no PA1, NB, Enr needed
            if (thRaw !== '' && thRaw !== undefined) {
              hasAnyInput = true;
              const th = parseFloat(thRaw) || 0;
              total = Math.min(maxMarks, Math.round(th * 10) / 10);
            }
          } else {
            // Main / Core subjects: PA1 (10) + NB (5) + Enr (5) + Half Yearly (80) = 100
            if ((paRaw !== '' && paRaw !== undefined) ||
                (nbRaw !== '' && nbRaw !== undefined) ||
                (enrRaw !== '' && enrRaw !== undefined) ||
                (thRaw !== '' && thRaw !== undefined)) {
              hasAnyInput = true;
              const pa = parseFloat(paRaw) || 0;
              const nb = parseFloat(nbRaw) || 0;
              const enr = parseFloat(enrRaw) || 0;
              const th = parseFloat(thRaw) || 0;
              total = Math.min(maxMarks, Math.round((pa + nb + enr + th) * 10) / 10);
            }
          }
        } else {
          const thRaw = row.querySelector(".sub-th")?.value?.trim();
          const prRaw = row.querySelector(".sub-pr")?.value?.trim();
          const isExplicitAB = (thRaw && thRaw.toUpperCase() === 'AB') || (prRaw && prRaw.toUpperCase() === 'AB');
          if (isExplicitAB) {
            hasAnyInput = true;
            isRowAbsent = true;
            total = 'AB';
          } else if ((thRaw !== '' && thRaw !== undefined) || (prRaw !== '' && prRaw !== undefined)) {
            hasAnyInput = true;
            const th = parseFloat(thRaw) || 0;
            const pr = parseFloat(prRaw) || 0;
            total = th + pr;
          }
        }

        if (isDrawingSubject(subName)) {
          const thInputVal = row.querySelector(".sub-th")?.value?.trim();
          const drawGrade = resolveDrawingGrade({
            theory: thInputVal,
            total: thInputVal,
            max: maxMarks
          }, isCBSE);
          row.querySelector(".total-cell").innerHTML = (isRowAbsent || total === 'AB')
            ? '<span style="color:#dc2626; font-weight:900;">AB</span>'
            : (hasAnyInput ? `<span style="color:#2563eb; font-weight:900; background:#eff6ff; padding:2px 8px; border-radius:4px; border:1px solid #bfdbfe;">${drawGrade}</span>` : '<span style="color:#94a3b8; font-weight:700;">-</span>');
        } else {
          row.querySelector(".total-cell").innerHTML = (isRowAbsent || total === 'AB')
            ? '<span style="color:#dc2626; font-weight:900;">AB</span>'
            : (hasAnyInput ? total : '0');
        }
        
        evaluatedForStatus.push({
          subject: subName,
          isMain: isMain,
          max: maxMarks,
          min: minMarks,
          total: total,
          theory: isRowAbsent ? 'AB' : total,
          isAbsent: isRowAbsent || total === 'AB',
          hasInput: hasAnyInput
        });
      });

      const activeEvals = evaluatedForStatus.filter(e => e.hasInput);
      const evalTarget = activeEvals.length > 0 ? activeEvals : evaluatedForStatus;
      const evalRes = evalStudentResultStatus(evalTarget, className, examName);

      const mainStats = evalRes.mainStats;
      const overallStats = evalRes.overallStats;
      const resultStatus = evalRes.resultStatus;

      // Grade calculation based on main percentage (or overall if no main subjects)
      const targetPct = mainStats.maxTotal > 0 ? mainStats.percentage : overallStats.percentage;
      let grade = 'E';
      if (isCBSE) {
        if (targetPct >= 91) grade = 'A1';
        else if (targetPct >= 81) grade = 'A2';
        else if (targetPct >= 71) grade = 'B1';
        else if (targetPct >= 61) grade = 'B2';
        else if (targetPct >= 51) grade = 'C1';
        else if (targetPct >= 41) grade = 'C2';
        else if (targetPct >= 33) grade = 'D';
        else grade = 'E';
      } else {
        const defaultScale = [
          { min: 91, max: 100, grade: 'A+' }, { min: 81, max: 90, grade: 'A' },
          { min: 71, max: 80, grade: 'B+' }, { min: 61, max: 70, grade: 'B' },
          { min: 51, max: 60, grade: 'C' }, { min: 33, max: 50, grade: 'D' }, { min: 0, max: 32, grade: 'E' }
        ];
        let scale = defaultScale;
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        if (store.settings) {
            const customScale = store.settings.find(s => s.key === "customGradingScale");
            if (customScale && customScale.value) {
                try { scale = JSON.parse(customScale.value); } catch(e){}
            }
        }
        scale.sort((a, b) => b.min - a.min);
        const matched = scale.find(g => targetPct >= g.min);
        if (matched) grade = matched.grade;
      }

      const grandTotalEl = document.getElementById("marksGrandTotal");
      const percentageEl = document.getElementById("marksPercentage");
      const gradeEl = document.getElementById("marksGrade");
      const resultStatusEl = document.getElementById("marksResultStatus");
      const statusReasonEl = document.getElementById("marksStatusReason");
      const overallSubtextEl = document.getElementById("marksOverallSubtext");

      const isPending = evalRes.isPending || resultStatus === "PENDING";
      const displayGrade = isPending ? "---" : grade;

      if (grandTotalEl) grandTotalEl.textContent = mainStats.grandTotal + " / " + mainStats.maxTotal;
      if (overallSubtextEl) overallSubtextEl.textContent = "All Subjects: " + overallStats.grandTotal + " / " + overallStats.maxTotal;
      if (percentageEl) percentageEl.textContent = targetPct + "%";
      if (gradeEl) gradeEl.textContent = displayGrade;
      if (resultStatusEl) {
        resultStatusEl.textContent = resultStatus;
        if (resultStatus === "PASS") {
          resultStatusEl.style.color = "#4ade80";
        } else if (resultStatus === "PENDING") {
          resultStatusEl.style.color = "#f59e0b";
        } else {
          resultStatusEl.style.color = "#f87171";
        }
      }
      if (statusReasonEl) {
        if (resultStatus === "PASS") {
          statusReasonEl.textContent = "★ All Main Subjects Passed (Additional subjects exempt)";
          statusReasonEl.style.color = "#86efac";
        } else if (resultStatus === "PENDING") {
          statusReasonEl.textContent = "⏱ " + (evalRes.pendingReason || "Awaiting complete subject evaluation");
          statusReasonEl.style.color = "#fcd34d";
        } else {
          const failedNames = evalRes.failedMainSubjects.map(f => f.subject).join(", ");
          statusReasonEl.textContent = failedNames ? `Failed in Main: ${failedNames}` : `Main Aggregate < 33%`;
          statusReasonEl.style.color = "#fca5a5";
        }
      }

      return {
        grandTotal: overallStats.grandTotal > 0 ? overallStats.grandTotal : mainStats.grandTotal,
        maxTotal: overallStats.maxTotal > 0 ? overallStats.maxTotal : mainStats.maxTotal,
        percentage: targetPct,
        grade: displayGrade,
        resultStatus,
        overallGrandTotal: overallStats.grandTotal,
        overallMaxTotal: overallStats.maxTotal
      };
    };

    container.addEventListener("input", function(e) {
      window.calcExamTotals();
    });

    document.getElementById("addSubjectBtn").onclick = () => {
      const idx = container.children.length;
      const row = document.createElement("div");
      if (isCBSE) {
        row.className = "marks-subject-row cbse-mode";
        row.innerHTML = `
          <input type="text" class="sub-name" placeholder="Subject Name" />
          <button type="button" class="sub-role-toggle role-main" data-is-main="1" onclick="window.toggleSubjectRoleInRow(this)" title="Main Subject: Marks strictly decide Pass or Fail">⭐ Main</button>
          <div class="sub-max-box" style="display:flex; flex-direction:column; align-items:center; gap:2px;">
            <input type="number" class="sub-max" value="100" placeholder="100" min="1" oninput="window.handleRowMaxChange(this)" style="padding:6px 2px; text-align:center; font-weight:800; font-size:0.9rem;" />
            <div style="display:flex; gap:2px;">
              <button type="button" class="preset-btn active" onclick="window.setRowMax(this, 100)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:#2563eb; color:#ffffff; font-weight:800; cursor:pointer;" title="Set 100 Max">100</button>
              <button type="button" class="preset-btn" onclick="window.setRowMax(this, 50)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:#ffffff; color:#475569; font-weight:800; cursor:pointer;" title="Set 50 Max">50</button>
            </div>
          </div>
          <input type="number" class="sub-min" value="33" placeholder="33" min="0" />
          <input type="number" class="sub-pa" placeholder="0-10" min="0" max="10" />
          <input type="number" class="sub-nb" placeholder="0-5" min="0" max="5" />
          <input type="number" class="sub-enr" placeholder="0-5" min="0" max="5" />
          <input type="text" class="sub-th" placeholder="0-80 or AB" />
          <div class="total-cell">0</div>
          <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
        `;
      } else {
        row.className = "marks-subject-row";
        row.innerHTML = `
          <input type="text" class="sub-name" placeholder="Subject Name" />
          <button type="button" class="sub-role-toggle role-main" data-is-main="1" onclick="window.toggleSubjectRoleInRow(this)" title="Main Subject: Marks strictly decide Pass or Fail">⭐ Main</button>
          <div class="sub-max-box" style="display:flex; flex-direction:column; align-items:center; gap:2px;">
            <input type="number" class="sub-max" value="100" placeholder="100" min="1" oninput="window.handleRowMaxChange(this)" style="padding:6px 2px; text-align:center; font-weight:800; font-size:0.9rem;" />
            <div style="display:flex; gap:2px;">
              <button type="button" class="preset-btn active" onclick="window.setRowMax(this, 100)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:#2563eb; color:#ffffff; font-weight:800; cursor:pointer;" title="Set 100 Max">100</button>
              <button type="button" class="preset-btn" onclick="window.setRowMax(this, 50)" style="font-size:9px; padding:1px 4px; border-radius:3px; border:1px solid #cbd5e1; background:#ffffff; color:#475569; font-weight:800; cursor:pointer;" title="Set 50 Max">50</button>
            </div>
          </div>
          <input type="number" class="sub-min" value="33" placeholder="33" min="0" />
          <input type="text" class="sub-th" placeholder="0 or AB" />
          <input type="number" class="sub-pr" placeholder="0" min="0" />
          <div class="total-cell">0</div>
          <button class="del-row-btn" onclick="this.parentElement.remove(); window.calcExamTotals();">×</button>
        `;
      }
      container.appendChild(row);
    };

    window.calcExamTotals(); // Init

    document.getElementById("saveMarksBtn").onclick = async () => {
      const rows = container.querySelectorAll(".marks-subject-row");
      const finalSubjects = [];
      rows.forEach(row => {
        const rawSub = row.querySelector(".sub-name").value.trim();
        if(!rawSub) return;
        const sub = canonicalSubjectName(rawSub);
        const isMain = row.querySelector(".sub-role-toggle")?.getAttribute("data-is-main") === "1";

        if (isCBSE) {
          const isAddl = !isMain;
          const paRaw = row.querySelector(".sub-pa")?.value;
          const nbRaw = row.querySelector(".sub-nb")?.value;
          const enrRaw = row.querySelector(".sub-enr")?.value;
          const thRaw = row.querySelector(".sub-th")?.value?.trim();
          const isExplicitAB = thRaw && thRaw.toUpperCase() === 'AB';

          const hasAny = isAddl
            ? (thRaw !== '' && thRaw !== undefined)
            : ((paRaw !== '' && paRaw !== undefined) ||
               (nbRaw !== '' && nbRaw !== undefined) ||
               (enrRaw !== '' && enrRaw !== undefined) ||
               (thRaw !== '' && thRaw !== undefined));

          const maxMarks = parseFloat(row.querySelector(".sub-max")?.value) || 100;
          const minMarks = parseFloat(row.querySelector(".sub-min")?.value) || Math.round(maxMarks * 0.33);

          if (!hasAny || isExplicitAB) {
            // Student left blank or marked AB => Save as AB (Absent)!
            finalSubjects.push({
              subject: sub,
              isMain: isMain,
              isAdditional: isAddl,
              max: maxMarks,
              min: minMarks,
              pa1: 0,
              pa2: 0,
              notebook: 0,
              enrichment: 0,
              theory: 'AB',
              subjective: 'AB',
              practical: 0,
              total: 'AB',
              grade: 'AB',
              isAbsent: true
            });
          } else {
            const th = parseFloat(thRaw) || 0;
            if (isDrawingSubject(sub)) {
              const drawGrade = resolveDrawingGrade({ theory: thRaw, total: thRaw, max: maxMarks }, isCBSE);
              finalSubjects.push({
                subject: sub,
                isMain: false,
                isAdditional: true,
                isGraded: true,
                max: maxMarks,
                min: minMarks,
                pa1: 0,
                pa2: 0,
                notebook: 0,
                enrichment: 0,
                theory: '-',
                subjective: '-',
                marks: th,
                practical: 0,
                total: drawGrade,
                grade: drawGrade,
                isAbsent: false
              });
            } else if (isAddl) {
              // Additional subject: evaluated in 100 only, zero PA1 / NB / Enr
              const tot = Math.min(maxMarks, Math.round(th * 10) / 10);
              finalSubjects.push({
                subject: sub,
                isMain: false,
                isAdditional: true,
                max: maxMarks,
                min: minMarks,
                pa1: 0,
                pa2: 0,
                notebook: 0,
                enrichment: 0,
                theory: th,
                subjective: th,
                practical: 0,
                total: tot,
                isAbsent: false
              });
            } else {
              const pa = parseFloat(paRaw) || 0;
              const nb = parseFloat(nbRaw) || 0;
              const enr = parseFloat(enrRaw) || 0;
              const tot = Math.min(maxMarks, Math.round((pa + nb + enr + th) * 10) / 10);
              finalSubjects.push({
                subject: sub,
                isMain: true,
                isAdditional: false,
                max: maxMarks,
                min: minMarks,
                pa1: pa,
                pa2: isAnnual ? pa : 0,
                notebook: nb,
                enrichment: enr,
                theory: th,
                subjective: th,
                practical: pa + nb + enr,
                total: tot,
                isAbsent: false
              });
            }
          }
        } else {
          const thRaw = row.querySelector(".sub-th")?.value?.trim();
          const prRaw = row.querySelector(".sub-pr")?.value?.trim();
          const isExplicitAB = (thRaw && thRaw.toUpperCase() === 'AB') || (prRaw && prRaw.toUpperCase() === 'AB');
          const hasAny = (thRaw !== '' && thRaw !== undefined) || (prRaw !== '' && prRaw !== undefined);
          const maxMarks = parseFloat(row.querySelector(".sub-max")?.value) || 100;
          const minMarks = parseFloat(row.querySelector(".sub-min")?.value) || 33;

          if (!hasAny || isExplicitAB) {
            // Student left blank or marked AB => Save as AB (Absent)!
            finalSubjects.push({
              subject: sub,
              isMain: isMain,
              max: maxMarks,
              min: minMarks,
              theory: 'AB',
              practical: 0,
              total: 'AB',
              grade: 'AB',
              isAbsent: true
            });
          } else {
            if (isDrawingSubject(sub)) {
              const drawGrade = resolveDrawingGrade({ theory: thRaw, total: thRaw, max: maxMarks }, false);
              finalSubjects.push({
                subject: sub,
                isMain: false,
                isAdditional: true,
                isGraded: true,
                max: maxMarks,
                min: minMarks,
                theory: '-',
                marks: parseFloat(thRaw) || 0,
                practical: 0,
                total: drawGrade,
                grade: drawGrade,
                isAbsent: false
              });
            } else {
              finalSubjects.push({
                subject: sub,
                isMain: isMain,
                max: maxMarks,
                min: minMarks,
                theory: parseFloat(thRaw) || 0,
                practical: parseFloat(prRaw) || 0,
                total: (parseFloat(thRaw) || 0) + (parseFloat(prRaw) || 0),
                isAbsent: false
              });
            }
          }
        }
      });

      const consolidatedSubjects = finalSubjects;

      const stats = window.calcExamTotals();
      
      const payload = {
        examName,
        className,
        session,
        studentName: student.fullName,
        rollNo: student.rollNo,
        admissionNo: student.admissionNo || (existingExam && existingExam.admissionNo) || '',
        studentPhoto: getStudentPhotoUri(student, student.id || student.admissionNo) || (existingExam && existingExam.studentPhoto) || '',
        subjectMarks: JSON.stringify(consolidatedSubjects),
        totalMarks: stats.grandTotal.toString(),
        percentage: stats.percentage.toString(),
        grade: stats.grade,
        resultStatus: stats.resultStatus
      };

      try {
        const url = existingExam ? '/api/modules/exams/' + existingExam.id : '/api/modules/exams';
        const method = existingExam ? 'PUT' : 'POST';
        
        if (typeof api === 'function') {
          await api(url, { method, body: JSON.stringify(payload) });
        } else {
          await fetch(url, {
            method,
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
            },
            body: JSON.stringify(payload)
          });
        }
        
        if (typeof showToast !== 'undefined') showToast("Marks saved successfully", "success");
        document.getElementById('examMarksModal').remove();
        if (typeof loadStore === 'function') {
          await loadStore();
        }
        loadStudentsForMarksEntry(className, examName, session);
      } catch(err) {
        console.error("Error saving marks:", err);
        alert("Error saving marks: " + (err.message || "Network error"));
      }
    };
  };

  // ==========================================
  // TAB EXAM SCHEDULE
  // ==========================================
  function renderExamSchedule(container) {
    container.innerHTML = `
      <div style="margin-bottom: 25px;">
        <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Exam Schedule Setup</h4>
        <p style="margin:0; color: inherit; font-size:0.9rem;">Set subject exam dates for admit cards class-wise.</p>
      </div>
      <div class="exam-form-grid" style="margin-bottom: 30px;">
        <div class="exam-field">
          <label>Select Class</label>
          <select id="scheduleClassSelect"></select>
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <input id="scheduleExamName" value="Annual Examination 2026-27" />
        </div>
        <div class="exam-field" style="grid-column: 1 / -1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;" id="scheduleDateSetupContainer">
            <label style="color: #0f172a; font-size: 1rem; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 15px;">Exam Schedule (Subject Dates)</label>
            <div id="scheduleDateInputs" style="display:flex; flex-wrap:wrap; gap:15px;">
            </div>
        </div>
        <div class="exam-field">
          <button id="scheduleSaveBtn" class="exam-btn exam-btn-primary" style="width:100%;">Save Schedule</button>
        </div>
      </div>
      
      <div style="margin-top: 40px;">
        <h4 style="margin:0 0 15px 0; color: inherit; font-size:1.1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Saved Schedules</h4>
        <div class="table-wrap exam-table-wrap" style="overflow-x:auto; width:100%;">
          <table style="width:100%; min-width:880px; border-collapse: collapse; text-align: left; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-family:'Outfit',sans-serif;">
            <thead style="background: #f1f5f9; color: #475569; font-size: 0.9rem;">
              <tr>
                <th style="padding: 12px 15px; font-weight: 600;">Class</th>
                <th style="padding: 12px 15px; font-weight: 600;">Exam Name</th>
                <th style="padding: 12px 15px; font-weight: 600;">Subjects Scheduled</th>
                <th style="padding: 12px 15px; font-weight: 600; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="savedSchedulesTableBody">
            </tbody>
          </table>
        </div>
      </div>
    `;

    populateClassSelect("scheduleClassSelect");

    const refreshScheduleDates = () => {
        const cls = document.getElementById("scheduleClassSelect").value;
        const examName = document.getElementById("scheduleExamName").value;
        const inputsDiv = document.getElementById("scheduleDateInputs");
        
        if (cls) {
            const subjects = getSubjectsForClass(cls);
            const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
            const existingSchedule = (store.examSchedules || []).find(s => (normFunc(s.className) === normFunc(cls) || s.className === cls) && s.examName === examName) || {};
            let existingDates = {};
            try { existingDates = typeof existingSchedule.dates === 'string' ? JSON.parse(existingSchedule.dates) : (existingSchedule.dates || {}); } catch(e) {}

            inputsDiv.innerHTML = subjects.map(sub => `
                <div style="flex: 1 1 200px; display:flex; flex-direction:column; gap:5px;">
                    <label style="font-size:0.8rem; font-weight:700;">${sub}</label>
                    <input type="date" class="sched-subj-date-input" data-subject="${sub}" value="${existingDates[sub] || ''}" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit;">
                </div>
            `).join('');
        }
    };

    document.getElementById("scheduleClassSelect").addEventListener("change", refreshScheduleDates);
    document.getElementById("scheduleExamName").addEventListener("input", refreshScheduleDates);
    refreshScheduleDates();

    const refreshSavedSchedulesTable = () => {
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const schedules = store.examSchedules || [];
        const tbody = document.getElementById("savedSchedulesTableBody");
        if (!tbody) return;
        
        if (schedules.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8;">No schedules saved yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = schedules.map(s => {
            let parsedDates = {};
            try { parsedDates = typeof s.dates === 'string' ? JSON.parse(s.dates) : (s.dates || {}); } catch(e) {}
            const numSubjects = Object.keys(parsedDates).length;
            return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                <td style="padding: 12px 15px; font-weight: 500;">${s.className}</td>
                <td style="padding: 12px 15px;">${s.examName}</td>
                <td style="padding: 12px 15px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">${numSubjects} Subjects</span></td>
                <td style="padding: 12px 15px; text-align:right;">
                    <button class="sched-edit-btn" data-id="${s.id}" style="padding: 6px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; margin-right: 5px;">Edit</button>
                    <button class="sched-del-btn" data-id="${s.id}" style="padding: 6px 12px; background: #ef4444; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
                </td>
            </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.sched-edit-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const schedule = (typeof getStore !== 'undefined' ? getStore().examSchedules || [] : []).find(s => String(s.id) === String(id));
                if (schedule) {
                    document.getElementById("scheduleClassSelect").value = schedule.className;
                    document.getElementById("scheduleExamName").value = schedule.examName;
                    refreshScheduleDates();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };
        });

        tbody.querySelectorAll('.sched-del-btn').forEach(btn => {
            btn.onclick = async () => {
                if (!await window.appConfirm("Are you sure you want to delete this schedule?", { title: "Delete Exam Schedule?", confirmText: "Delete Schedule", type: "danger" })) return;
                const id = btn.dataset.id;
                try {
                    if (typeof api === 'function') {
                        await api('/api/modules/examSchedules/' + id, { method: 'DELETE' });
                    } else {
                        await fetch('/api/modules/examSchedules/' + id, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                            }
                        });
                    }
                    if (typeof loadStore === 'function') {
                        await loadStore();
                    }
                    if (window.showToast) showToast("Schedule deleted", "info");
                    refreshSavedSchedulesTable();
                } catch(e) {
                    console.error("Error deleting schedule:", e);
                    alert("Error deleting schedule: " + (e.message || "Network error"));
                }
            };
        });
    };
    
    // Initial load
    setTimeout(refreshSavedSchedulesTable, 100);

    document.getElementById("scheduleSaveBtn").onclick = async () => {
        const cls = document.getElementById("scheduleClassSelect").value;
        const examName = document.getElementById("scheduleExamName").value;
        if (!cls) return alert("Select Class");
        
        const dates = {};
        document.querySelectorAll('.sched-subj-date-input').forEach(input => {
            if (input.value) dates[input.dataset.subject] = input.value;
        });

        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
        const existingSchedule = (store.examSchedules || []).find(s => (normFunc(s.className) === normFunc(cls) || s.className === cls) && s.examName === examName);
        
        const payload = {
            className: normFunc(cls) || cls,
            examName: examName,
            dates: JSON.stringify(dates)
        };

        const url = existingSchedule ? '/api/modules/examSchedules/' + existingSchedule.id : '/api/modules/examSchedules';
        const method = existingSchedule ? 'PUT' : 'POST';

        try {
            if (typeof api === 'function') {
                await api(url, { method, body: JSON.stringify(payload) });
            } else {
                await fetch(url, {
                    method,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                    },
                    body: JSON.stringify(payload)
                });
            }
            if (window.showToast) showToast("Schedule saved successfully", "success");
            else alert("Saved successfully!");
            if (typeof loadStore === 'function') {
                await loadStore();
            }
            refreshSavedSchedulesTable();
        } catch(err) {
            console.error("Error saving schedule:", err);
            alert("Error saving schedule: " + (err.message || "Network error"));
        }
    };
  }

  // ==========================================
  // TAB 2: ADMIT CARDS
  // ==========================================
  function renderAdmitCards(container) {
    const existingPreview = document.getElementById("admitPreviewContainer");
    const existingPrintActions = document.getElementById("admitPrintActions");
    const savedPreviewHtml = (existingPreview && !existingPreview.querySelector(".empty-state") && existingPreview.children.length > 0)
      ? existingPreview.innerHTML
      : null;
    const savedPrintDisplay = existingPrintActions ? existingPrintActions.style.display : "none";
    const savedClass = document.getElementById("admitClassSelect") ? document.getElementById("admitClassSelect").value : null;

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
        <div class="exam-field" style="grid-column: span 2;">
          <label>Select Specific Students</label>
          <div id="admitStudentCheckboxes" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; background: #fff; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
              <div style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">Select a class first...</div>
          </div>
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <select id="admitExamName"></select>
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
    
    const refreshAdmitStudents = () => {
        const cls = document.getElementById("admitClassSelect").value;
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
        const studentsInClass = (store.students || []).filter(s => {
          return (normFunc(s.className) === normFunc(cls) || s.className === cls) && isStudentActive(s);
        });
        
        const container = document.getElementById("admitStudentCheckboxes");
        if (container) {
            if (studentsInClass.length === 0) {
                container.innerHTML = `<div style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No active students found in this class.</div>`;
                return;
            }
            container.innerHTML = `
                <div style="grid-column: 1 / -1; display:flex; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <button id="btnCheckAllStudents" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight:bold;">Select All</button>
                    <button id="btnUncheckAllStudents" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight:bold;">Unselect All</button>
                </div>
            ` + studentsInClass.map(s => `
                <label style="display:flex; align-items:center; gap: 8px; font-size: 0.9rem; cursor: pointer; text-transform:none; font-weight:500;">
                    <input type="checkbox" class="admit-student-cb" value="${s.admissionNo}" checked style="width:16px; height:16px; margin:0;" />
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.fullName}">${s.fullName}</span> 
                    <span style="color:#64748b; font-size:0.8rem;">(${s.rollNo || '-'})</span>
                </label>
            `).join('');

            const btnCheckAll = document.getElementById("btnCheckAllStudents");
            const btnUncheckAll = document.getElementById("btnUncheckAllStudents");
            if(btnCheckAll) btnCheckAll.onclick = (e) => { e.preventDefault(); container.querySelectorAll('.admit-student-cb').forEach(cb => cb.checked = true); };
            if(btnUncheckAll) btnUncheckAll.onclick = (e) => { e.preventDefault(); container.querySelectorAll('.admit-student-cb').forEach(cb => cb.checked = false); };
        }
    };

    const refreshAdmitExamNames = () => {
        const cls = document.getElementById("admitClassSelect").value;
        const examNameSelect = document.getElementById("admitExamName");
        if (!examNameSelect) return;
        
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
        const schedules = (store.examSchedules || []).filter(s => normFunc(s.className) === normFunc(cls) || s.className === cls);
        
        let uniqueExamNames = Array.from(new Set(schedules.map(s => s.examName).filter(Boolean)));
        if (uniqueExamNames.length === 0) {
            uniqueExamNames = ["Annual Examination 2026-27"]; // fallback if no schedules exist
        }
        
        const currentValue = examNameSelect.value;
        examNameSelect.innerHTML = uniqueExamNames.map(name => `<option value="${name}">${name}</option>`).join('');
        
        if (uniqueExamNames.includes(currentValue)) {
            examNameSelect.value = currentValue;
        }
    };

    document.getElementById("admitClassSelect").addEventListener("change", () => {
        refreshAdmitStudents();
        refreshAdmitExamNames();
    });

    // Initialize exam names
    setTimeout(refreshAdmitExamNames, 50);

    if (savedClass) {
      const clsEl = document.getElementById("admitClassSelect");
      if (clsEl) {
        clsEl.value = savedClass;
        refreshAdmitStudents();
        refreshAdmitExamNames();
      }
    }

    if (savedPreviewHtml) {
      const newPreview = document.getElementById("admitPreviewContainer");
      const newPrintActions = document.getElementById("admitPrintActions");
      if (newPreview) newPreview.innerHTML = savedPreviewHtml;
      if (newPrintActions) newPrintActions.style.display = savedPrintDisplay;
    }

    
    document.getElementById("admitGenerateBtn").onclick = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const cls = document.getElementById("admitClassSelect").value;
      const examName = document.getElementById("admitExamName").value;
      const style = document.getElementById("admitTemplateStyle").value;
      
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
      const existingSchedule = (store.examSchedules || []).find(s => (normFunc(s.className) === normFunc(cls) || s.className === cls) && s.examName === examName) || {};

      const config = {
          color: document.getElementById("admitColor").value,
          font: document.getElementById("admitFont").value,
          border: document.getElementById("admitBorder").value,
          bgColor: document.getElementById("admitBgColor").value,
          bgColor2: document.getElementById("admitBgColor2").value,
          bgType: document.getElementById("admitBgType").value,
          fontColor: document.getElementById("admitFontColor").value,
          bgOpacity: document.getElementById("admitBgOpacity").value,
          bgImage: document.getElementById("admitBgImage").value,
          subjectDates: (function() {
              try { return typeof existingSchedule.dates === 'string' ? JSON.parse(existingSchedule.dates) : (existingSchedule.dates || {}); }
              catch(e) { return {}; }
          })()
        };

      if(!cls) return window.showToast ? showToast("Please select a class", "warning") : alert("Select Class");
      const selectedStudentIds = Array.from(document.querySelectorAll('.admit-student-cb:checked')).map(cb => cb.value);
      generateAdmitCards(cls, examName, style, config, selectedStudentIds);
      const printActions = document.getElementById("admitPrintActions");
      if (printActions) printActions.style.display = "flex";
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

  function generateAdmitCards(className, examName, requestedStyle, config, selectedStudentIds) {
    const container = document.getElementById("admitPreviewContainer");
    if (!container) return;
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
    let students = (store.students || []).filter(s => {
      return (normFunc(s.className) === normFunc(className) || s.className === className) && isStudentActive(s);
    });
    
    if (selectedStudentIds && selectedStudentIds.length > 0) {
        students = students.filter(s => selectedStudentIds.includes(String(s.admissionNo)));
    }
    
    // Sort students by Roll Number ascending (1, 2, 3 ... 38)
    students.sort((a, b) => {
      const parseRoll = (r) => {
        if (!r && r !== 0) return 999999;
        const num = parseInt(String(r).replace(/\D/g, ''), 10);
        return isNaN(num) ? 999999 : num;
      };
      const rA = parseRoll(a.rollNo);
      const rB = parseRoll(b.rollNo);
      if (rA !== rB) return rA - rB;
      return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '');
    });

    if(students.length === 0) {
      container.innerHTML = `<div class="empty-state"><h4>No active students found in ${className}.</h4></div>`;
      document.getElementById("admitPrintActions").style.display = "none";
      return;
    }

    let style = requestedStyle;

    let html = ``;
      for (let i = 0; i < students.length; i += 2) {
          html += `<div style="width: 210mm; height: 297mm; page-break-after: always; display: flex; flex-direction: column; padding: 0; box-sizing: border-box; background: white; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.1);">`;
          for (let j = 0; j < 2; j++) {
              if (i + j < students.length) {
                  const student = students[i + j];
                  let cardHtml = '';
                  if (style === 'tps_official_2026' || !style) cardHtml = getTpsOfficialAdmitCardHtml(student, examName, config);
                  else if (style === 'jac_board_tps') cardHtml = getJac10AdmitCardHtml(student, examName, config);
                  else if (style === 'custom_blank') cardHtml = getCustomAdmitCardHtml(student, examName, config);
                  else if (style === 'jac12') cardHtml = getJac12AdmitCardHtml(student, examName, config);
                  else if (style.startsWith('dyn_')) cardHtml = generateDynamicAdmitCard(student, examName, style, config);
                  else if (style === 'primary') cardHtml = getPrimaryAdmitCardHtml(student, examName, config);
                  else if (style === 'state') cardHtml = getMiddleAdmitCardHtml(student, examName, config);
                  else cardHtml = getHighSchoolAdmitCardHtml(student, examName, config);
                  
                  const bgStyle = config.bgImage !== 'none' ? `background-image: url('${config.bgImage}'); background-size: cover; background-position: center;` : (config.bgType === 'gradient' ? `background: linear-gradient(135deg, ${config.bgColor}, ${config.bgColor2});` : `background-color: ${config.bgColor};`);
                  const fontColorStyle = config.fontColor ? `color: ${config.fontColor} !important;` : '';
                    
                  // Inject bg into the card itself to prevent bleeding
                  cardHtml = cardHtml.replace('background: transparent;', bgStyle);
                  const overlayHtml = `<div style="position: absolute; inset: 0; background: rgba(255,255,255,${1 - config.bgOpacity}); pointer-events: none; z-index: 0; border-radius: inherit;"></div><div style="position: relative; z-index: 1; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: space-between;">`;
                  cardHtml = cardHtml.replace('">', `">${overlayHtml}`) + '</div>';

                  const isFirst = (j === 0);
                  const borderBottom = isFirst ? 'border-bottom: 1px dashed #94a3b8;' : '';
                  html += `<div style="width: 100%; height: 50%; position: relative; display: flex; align-items: stretch; justify-content: stretch; box-sizing: border-box; padding: 3mm; ${borderBottom} overflow: hidden;">
                               <div style="flex: 1; position: relative;">${cardHtml}</div>
                           </div>`;
              } else {
                  html += `<div style="width: 100%; height: 50%;"></div>`; 
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
      let opts = '<option value="tps_official_2026" selected>⭐ TPS Official Admit Card 2026-27 (Official Design)</option><option value="jac_board_tps">🏛️ JAC Board Class 10 Style (Security Micro-Text)</option><option value="jac12">JAC 11th/12th Admit Card</option><option value="consolidated_cbse">2-Page Annual Consolidated (Multiple Exams)</option><option value="custom_blank">Blank A4 (Design Your Own)</option><option value="detailed_graph">Detailed Graph (Watermark & Chart)</option><option value="primary">Primary Format (Colorful)</option><option value="cbse">CBSE Format Layout</option><option value="state">State Board Layout</option><option value="tho">Talent Hunt Olympiad (THO)</option>';
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

  
  // =========================================================================
  // ⭐ TPS OFFICIAL ADMIT CARD 2026-27 TEMPLATE (EXACT MASTER DESIGN)
  // =========================================================================
  const TPS_OFFICIAL_SCHEDULES = {
    "Nursery": [
      { date: "07/09/2026", day: "Monday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "08/09/2026", day: "Tuesday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "10/09/2026", day: "Thursday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "12/09/2026", day: "Saturday", subject: "Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "15/09/2026", day: "Tuesday", subject: "Hindi (Oral)", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "English (Oral)", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Maths (Oral)", time: "08:30 AM - 11:30 AM" }
    ],
    "LKG": [
      { date: "07/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "08/09/2026", day: "Tuesday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "10/09/2026", day: "Thursday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "12/09/2026", day: "Saturday", subject: "Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "15/09/2026", day: "Tuesday", subject: "Hindi (Oral)", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "English (Oral)", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Maths (Oral)", time: "08:30 AM - 11:30 AM" }
    ],
    "UKG": [
      { date: "07/09/2026", day: "Monday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "08/09/2026", day: "Tuesday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "10/09/2026", day: "Thursday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "12/09/2026", day: "Saturday", subject: "Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "15/09/2026", day: "Tuesday", subject: "EVS", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "Hindi (Oral) / English (Oral)", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Maths (Oral)", time: "08:30 AM - 11:30 AM" }
    ],
    "Class I": [
      { date: "07/09/2026", day: "Monday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "08/09/2026", day: "Tuesday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "10/09/2026", day: "Thursday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "12/09/2026", day: "Saturday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "15/09/2026", day: "Tuesday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "Computer / Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" }
    ],
    "Class II": [
      { date: "07/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "08/09/2026", day: "Tuesday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "10/09/2026", day: "Thursday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "12/09/2026", day: "Saturday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "15/09/2026", day: "Tuesday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Computer / Drawing", time: "08:30 AM - 11:30 AM" }
    ],
    "Class III": [
      { date: "07/09/2026", day: "Monday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "19/09/2026", day: "Saturday", subject: "Computer", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" }
    ],
    "Class IV": [
      { date: "07/09/2026", day: "Monday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" },
      { date: "19/09/2026", day: "Saturday", subject: "Sanskrit & Drawing", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Computer", time: "08:30 AM - 11:30 AM" }
    ],
    "Class V": [
      { date: "07/09/2026", day: "Monday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "Computer", time: "08:30 AM - 11:30 AM" },
      { date: "19/09/2026", day: "Saturday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Sanskrit & Drawing", time: "08:30 AM - 11:30 AM" }
    ],
    "Class VI": [
      { date: "07/09/2026", day: "Monday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "SST", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" },
      { date: "19/09/2026", day: "Saturday", subject: "Computer", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Sanskrit", time: "08:30 AM - 11:30 AM" }
    ],
    "Class VII": [
      { date: "07/09/2026", day: "Monday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "18/09/2026", day: "Friday", subject: "Sanskrit", time: "08:30 AM - 11:30 AM" },
      { date: "19/09/2026", day: "Saturday", subject: "ME / GK", time: "08:30 AM - 11:30 AM" },
      { date: "21/09/2026", day: "Monday", subject: "Computer", time: "08:30 AM - 11:30 AM" }
    ],
    "Class IX": [
      { date: "07/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "Science", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "S.St", time: "08:30 AM - 11:30 AM" }
    ],
    "Class X": [
      { date: "07/09/2026", day: "Monday", subject: "Hindi", time: "08:30 AM - 11:30 AM" },
      { date: "09/09/2026", day: "Wednesday", subject: "S.St", time: "08:30 AM - 11:30 AM" },
      { date: "11/09/2026", day: "Friday", subject: "Maths", time: "08:30 AM - 11:30 AM" },
      { date: "14/09/2026", day: "Monday", subject: "English", time: "08:30 AM - 11:30 AM" },
      { date: "16/09/2026", day: "Wednesday", subject: "Science", time: "08:30 AM - 11:30 AM" }
    ]
  };

  function normalizeClassNameForTps(raw) {
    if (!raw) return 'Class I';
    const c = raw.trim().toUpperCase();
    if (c.includes('NUR')) return 'Nursery';
    if (c.includes('LKG')) return 'LKG';
    if (c.includes('UKG')) return 'UKG';
    if (c.startsWith('X-') || c === 'X' || c === '10' || c === '10-A' || c.includes('CLASS 10') || c.includes('CLASS X')) return 'Class X';
    if (c.startsWith('IX-') || c === 'IX' || c === '9' || c === '9-A' || c.includes('CLASS 9') || c.includes('CLASS IX')) return 'Class IX';
    if (c.startsWith('VII-') || c === 'VII' || c === '7' || c === '7-A' || c.includes('CLASS 7') || c.includes('CLASS VII')) return 'Class VII';
    if (c.startsWith('VI-') || c === 'VI' || c === '6' || c === '6-A' || c.includes('CLASS 6') || c.includes('CLASS VI')) return 'Class VI';
    if (c.startsWith('V-') || c === 'V' || c === '5' || c === '5-A' || c.includes('CLASS 5') || c.includes('CLASS V')) return 'Class V';
    if (c.startsWith('IV-') || c === 'IV' || c === '4' || c === '4-A' || c.includes('CLASS 4') || c.includes('CLASS IV')) return 'Class IV';
    if (c.startsWith('III-') || c === 'III' || c === '3' || c === '3-A' || c.includes('CLASS 3') || c.includes('CLASS III')) return 'Class III';
    if (c.startsWith('II-') || c === 'II' || c === '2' || c === '2-A' || c.includes('CLASS 2') || c.includes('CLASS II')) return 'Class II';
    if (c.startsWith('I-') || c === 'I' || c === '1' || c === '1-A' || c.includes('CLASS 1') || c.includes('CLASS I')) return 'Class I';
    return raw;
  }

    function getAutoDayName(dateStr) {
    if (!dateStr || dateStr === '---') return '---';
    try {
      const s = String(dateStr).trim();
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      // Match DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        if (!isNaN(d.getTime())) return days[d.getDay()];
      }
      
      // Match YYYY-MM-DD or YYYY/MM/DD
      const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) {
        const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        if (!isNaN(d.getTime())) return days[d.getDay()];
      }
      
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) return days[parsed.getDay()];
    } catch (e) {}
    return '---';
  }

  function formatExamDate(dateStr) {
    if (!dateStr || dateStr === '---') return '---';
    const s = String(dateStr).trim();
    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
    }
    return s;
  }

  function getTpsOfficialAdmitCardHtml(student, examName, config) {
    const normClass = normalizeClassNameForTps(student.className);
    const defaultSched = TPS_OFFICIAL_SCHEDULES[normClass] || TPS_OFFICIAL_SCHEDULES['Class I'];
    
    // Check if custom dates were supplied in config
    let schedule = defaultSched;
    if (config && config.subjectDates && Object.keys(config.subjectDates).length > 0) {
      const customItems = [];
      Object.entries(config.subjectDates).forEach(([sub, dt]) => {
        if (dt) {
          let dateStr = dt;
          let dayStr = "";
          let timeStr = "08:30 AM - 11:30 AM";
          if (typeof dt === 'object') {
            dateStr = dt.date || '';
            dayStr = dt.day || '';
            timeStr = dt.time || '08:30 AM - 11:30 AM';
          }
          if (!dayStr || dayStr === '---') {
            dayStr = getAutoDayName(dateStr);
          }
          const formattedDate = formatExamDate(dateStr);
          customItems.push({ subject: sub, date: formattedDate, day: dayStr, time: timeStr });
        }
      });
      if (customItems.length > 0) schedule = customItems;
    }

    // Auto-calculate day and format date for all items
    schedule = schedule.map(item => ({
      ...item,
      date: formatExamDate(item.date),
      day: (!item.day || item.day === '---') ? getAutoDayName(item.date) : item.day
    }));

    const rollPadded = (student.rollNo || '00').toString().padStart(2, '0');
    const admNo = (student.admissionNo || '---').toString().trim();
    const candidateName = (student.fullName || 'STUDENT NAME').toUpperCase();
    const fatherName = formatParentName(student.fatherName) || '---';
    const motherName = formatParentName(student.motherName) || '---';
    const phoneNo = (student.phone || student.phone1 || student.whatsapp || '---').toString().trim();
    const gender = (student.gender || 'Regular').toUpperCase();
    const dobFormatted = (function(d) {
      if (!d || d === '0001-01-01' || d === '0000-00-00' || d === '0' || d === '00') return '---';
      try {
        const parts = d.split('-');
        if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      } catch(e) {}
      return d;
    })(student.dob);

    const logoSrc = 'tps_logo_new.png';
    const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo);

    const photoHtml = photoUrl 
      ? `<div style="width:100%; height:100%; position:relative; display:flex; align-items:center; justify-content:center;">
           <img src="${photoUrl}" style="width:100%; height:100%; object-fit:contain; background:#ffffff; display:block;" alt="Photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
           <div style="display:none; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:4.8pt; font-weight:700; color:#64748b; line-height:1.15; padding:1px;">
             <svg style="width:21px; height:21px; margin-bottom:1px;" viewBox="0 0 24 24" fill="#94a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
             <span>AFFIX PASSPORT<br>SIZE PHOTO<br><small style="font-size:4.5pt;">(स्वप्रमाणित)</small></span>
           </div>
         </div>`
      : `<div style="display:flex; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:4.8pt; font-weight:700; color:#64748b; line-height:1.15; padding:1px;">
           <svg style="width:21px; height:21px; margin-bottom:1px;" viewBox="0 0 24 24" fill="#94a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
           <span>AFFIX PASSPORT<br>SIZE PHOTO<br><small style="font-size:4.5pt;">(स्वप्रमाणित)</small></span>
         </div>`;

    const isCompact = schedule.length <= 5;
    const rowPad = isCompact ? '3.5px 4px' : '2px 3px';
    const signCellH = isCompact ? '5.5mm' : '3.8mm';
    const rowsHtml = schedule.map((item, rIdx) => `
      <tr style="background: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="border: 1px solid #94a3b8; padding: ${rowPad}; text-align: center; font-family: monospace; font-weight: bold; font-size:7pt;">${rIdx + 1}</td>
        <td contenteditable="true" style="border: 1px solid #94a3b8; padding: ${rowPad}; font-weight: bold; color: #1e3a8a; text-align: left; padding-left: 6px; font-size:7pt; cursor: text;">${item.subject}</td>
        <td contenteditable="true" style="border: 1px solid #94a3b8; padding: ${rowPad}; text-align: center; font-family: monospace; font-weight: bold; font-size:7pt; cursor: text;">${item.date}</td>
        <td contenteditable="true" style="border: 1px solid #94a3b8; padding: ${rowPad}; text-align: center; font-weight: bold; font-size:7pt; cursor: text;">${item.day}</td>
        <td contenteditable="true" style="border: 1px solid #94a3b8; padding: ${rowPad}; text-align: center; font-weight: 600; font-size:7pt; cursor: text;">${item.time}</td>
        <td style="border: 1px solid #94a3b8; padding: ${rowPad}; height: ${signCellH};"></td>
      </tr>
    `).join('');

    const displayExamTitle = examName ? examName.toUpperCase() : "HALF YEARLY EXAMINATION 2026-27";

    return `
      <div style="width:100%; height:100%; box-sizing:border-box; border:2px solid #1e3a8a; outline:1px solid #1e3a8a; outline-offset:-2.5px; padding:2.5mm 3.5mm; display:flex; flex-direction:column; justify-content:space-between; background:#ffffff; border-radius:3px; font-family:'Montserrat', Arial, sans-serif; color:#0f172a; font-size:8.5pt;">
        
        <!-- Top Section (Header + Info + Details + Schedule + Instructions) -->
        <div style="display:flex; flex-direction:column; flex:1; justify-content:space-between;">
          
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid #1e3a8a; padding-bottom:1.5px; margin-bottom:1.5px;">
            <div style="width:22mm; display:flex; align-items:center; justify-content:center;">
              <img src="${logoSrc}" style="max-width:21mm; max-height:19.5mm; object-fit:contain;" alt="Logo" onerror="this.src='school_logo.png'" />
            </div>
            <div style="flex:1; text-align:center; padding:0 3px;">
              <div style="font-family:'Cinzel', serif, 'Times New Roman'; font-size:15.2pt; font-weight:900; color:#1e3a8a; letter-spacing:0.8px; line-height:1.05; margin:1px 0;">TAPOWAN PUBLIC SCHOOL</div>
              <div style="font-size:6pt; font-weight:700; color:#334155; margin-bottom:1.5px;">Prem Nagar, Banjee, Tapin, Ramgarh, Jharkhand - 825314 | Helpline: 87577 44973, 62991 22869</div>
              <div style="margin:1px 0;">
                <span contenteditable="true" style="background:#1e3a8a; color:#ffffff; font-size:7.2pt; font-weight:800; padding:1px 12px; border-radius:2.5px; letter-spacing:0.6px; display:inline-block; cursor:text;">${displayExamTitle}</span>
              </div>
              <div style="font-size:9.8pt; font-weight:900; color:#b91c1c; letter-spacing:1.8px; margin-top:1px;">ADMIT CARD / प्रवेश-पत्र</div>
            </div>
            <div style="width:32mm; text-align:right;">
              <div style="border:1px solid #cbd5e1; background:#f8fafc; padding:2px 3px; border-radius:2px; font-size:5.6pt; text-align:center; line-height:1.25;">
                <div style="font-weight:700; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:1px; margin-bottom:1px;">U-DISE: 20241202412</div>
                <div style="font-weight:700; color:#1e3a8a;">SESSION: 2026-2027</div>
                <div style="font-weight:700; color:#047857;">SITTING: 1ST (MORNING)</div>
              </div>
            </div>
          </div>

          <!-- School & Center Bar -->
          <div style="display:flex; justify-content:space-between; background:#f1f5f9; border:1px solid #cbd5e1; padding:1.5px 5px; font-size:6.8pt; margin-bottom:2px;">
            <div><strong>School Code & Name:</strong> 825314 - TAPOWAN PUBLIC SCHOOL, RAMGARH</div>
            <div style="text-align:right;"><strong>Exam Centre:</strong> TPS MAIN CAMPUS (RAMGARH)</div>
          </div>

          <!-- Details Grid & Photo -->
          <div style="display:flex; gap:3.5px; margin-bottom:2px;">
            <table style="flex:1; border-collapse:collapse; font-size:7.4pt;">
              <tbody>
                <tr>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700; width:14%;">Roll No:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; color:#b91c1c; font-family:monospace; font-weight:bold; font-size:9pt; text-align:center; width:20%; cursor:text;">${rollPadded}</td>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700; width:14%;">Adm / Reg No:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; color:#0f172a; font-family:monospace; font-weight:bold; font-size:8pt; width:20%; cursor:text;">${admNo}</td>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700; width:14%;">Class & Sec:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; color:#1e3a8a; font-weight:bold; font-size:8.2pt; width:18%; cursor:text;">${normClass} (${student.section || 'A'})</td>
                </tr>
                <tr>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Candidate's Name:</td>
                  <td colspan="3" contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-size:8.8pt; font-weight:bold; color:#1e3a8a; letter-spacing:0.3px; cursor:text;">${candidateName}</td>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Date of Birth:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-family:monospace; font-weight:bold; color:#0f172a; cursor:text;">${dobFormatted}</td>
                </tr>
                <tr>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Father's Name:</td>
                  <td colspan="3" contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-weight:bold; color:#0f172a; cursor:text;">${fatherName.toUpperCase()}</td>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Mother's Name:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-weight:bold; color:#0f172a; cursor:text;">${motherName.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Contact / Mobile:</td>
                  <td colspan="3" contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-family:monospace; font-weight:bold; color:#0f172a; cursor:text;">${phoneNo}</td>
                  <td style="border:1px solid #94a3b8; padding:2px 4px; background:#f8fafc; color:#334155; font-weight:700;">Gender / Type:</td>
                  <td contenteditable="true" style="border:1px solid #94a3b8; padding:2px 4px; font-weight:bold; color:#0f172a; cursor:text;">${gender} / REGULAR</td>
                </tr>
              </tbody>
            </table>

            <!-- Photo & Sign -->
            <div style="width:24.5mm; display:flex; flex-direction:column; align-items:center; justify-content:flex-start;">
              <div style="width:24.5mm; height:28mm; border:1.5px solid #1e3a8a; background:#f8fafc; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:2px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                ${photoHtml}
              </div>
              <div style="width:100%; border:1px dashed #94a3b8; background:#fafafa; margin-top:1.5px; height:7.5mm; display:flex; align-items:flex-end; justify-content:center; padding-bottom:1px;">
                <div style="font-size:4.6pt; color:#64748b; text-align:center; line-height:1; font-weight:600;">परीक्षार्थी का हस्ताक्षर<br><span>Candidate's Signature</span></div>
              </div>
            </div>
          </div>

          <!-- Schedule Table -->
          <div style="margin-bottom:2px;">
            <table style="width:100%; border-collapse:collapse; font-size:6.8pt;">
              <thead>
                <tr style="background:#1e3a8a; color:#ffffff;">
                  <th style="width:6%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">क्र.सं.<br>Sl.No</th>
                  <th style="width:32%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">विषय / SUBJECT</th>
                  <th style="width:17%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">परीक्षा तिथि / DATE</th>
                  <th style="width:14%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">दिन / DAY</th>
                  <th style="width:19%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">समय / TIME</th>
                  <th style="width:12%; border:1px solid #1e3a8a; padding:2px 3px; text-align:center; font-size:6.2pt; line-height:1.1;">वीक्षक हस्ताक्षर<br>INVIGILATOR</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Instructions -->
          <div style="border:1px solid #cbd5e1; background:#fffbeb; padding:2px 5px; border-radius:2px; margin-bottom:2px;">
            <div style="font-size:5.6pt; font-weight:800; color:#92400e; margin-bottom:0.5px;">परीक्षार्थियों के लिए महत्वपूर्ण निर्देश (Important Instructions for Candidates):</div>
            <ol style="margin:0; padding-left:12px; font-size:5.2pt; color:#78350f; line-height:1.2; font-weight:600;">
              <li>यह प्रवेश पत्र (Admit Card) परीक्षा कक्ष में लाना अनिवार्य है। इसके बिना परीक्षा में बैठने की अनुमति नहीं दी जाएगी।</li>
              <li>परीक्षार्थी परीक्षा प्रारंभ होने से 15 मिनट पूर्व परीक्षा केंद्र पर आवश्यक रूप से उपस्थित हों।</li>
              <li>परीक्षा भवन में मोबाइल फोन, स्मार्ट वॉच, कैलकुलेटर या अन्य कोई अनुचित इलेक्ट्रॉनिक सामग्री लाना पूर्णतः वर्जित है।</li>
              <li>परीक्षार्थी अपनी लेखन सामग्री (पेन, पेंसिल, रबर, स्केल, आदि) स्वयं लाएं। किसी भी प्रकार का आदान-प्रदान वर्जित है।</li>
            </ol>
          </div>

        </div>

        <!-- Footer Signatures (Pinned to the Very Bottom) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:auto; padding-top:2px; padding-bottom:1px;">
          <div style="text-align:center; width:30%;">
            <div style="border-top:1px solid #475569; margin-bottom:2px; width:80%; margin-left:auto; margin-right:auto;"></div>
            <div style="font-size:5.6pt; font-weight:600; color:#334155; line-height:1.15;"><strong>कक्षा शिक्षक के हस्ताक्षर</strong><br>Class Teacher's Signature</div>
          </div>
          <div style="text-align:center; width:30%;">
            <div style="border-top:1px solid #475569; margin-bottom:2px; width:80%; margin-left:auto; margin-right:auto;"></div>
            <div style="font-size:5.6pt; font-weight:600; color:#334155; line-height:1.15;"><strong>परीक्षा नियंत्रक</strong><br>Controller of Examination</div>
          </div>
          <div style="text-align:center; width:30%; position:relative;">
            <div style="position:absolute; top:-12px; left:20%; border:1px dashed #b91c1c; color:#b91c1c; font-size:5pt; font-weight:800; padding:1px 4px; border-radius:50%; transform:rotate(-12deg); opacity:0.7;">SEAL</div>
            <div style="border-top:1px solid #475569; margin-bottom:2px; width:80%; margin-left:auto; margin-right:auto;"></div>
            <div style="font-size:5.6pt; font-weight:600; color:#334155; line-height:1.15;"><strong>प्रधानाचार्य / Principal</strong><br>Tapowan Public School</div>
          </div>
        </div>

      </div>
    `;
  }

  function generateDynamicAdmitCard(student, examName, themeId, config) {
      const c = config || { color: '#3b82f6', font: "'Inter', sans-serif", border: 'solid' };
      const t = parseDynamicTheme(themeId);
      const s = getDynamicStyles(t, c);
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
      
      const borderCss = c.border === 'none' ? 'none' : `${c.border === 'double' ? 6 : 2}px ${c.border} ${c.color}`;
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || DEFAULT_SCHOOL_LOGO;
      const admNo = student.admissionNo || '-';
      
      let headerHtml = '';
      if(t.headerAlign === 'center') {
          headerHtml = `<div style="text-align:center; padding-bottom: 15px; border-bottom: 2px solid ${c.color};">
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px;" />
              <h1 style="margin:0; font-size:28px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
              <div style="background: ${c.color}; color: ${c.fontColor || '#fff'}; display:inline-block; padding:3px 15px; border-radius:20px; font-weight:bold; margin-top:8px; font-size: 18px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
          </div>`;
      } else if (t.headerAlign === 'left') {
          headerHtml = `<div style="display:flex; align-items:center; gap: 15px; padding-bottom: 15px; border-bottom: 2px solid ${c.color};">
              <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 70px; height: 70px;" />
              <div>
                  <h1 style="margin:0; font-size:26px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
                  <div style="font-weight:bold; color: inherit; margin-top:4px; font-size: 16px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
              </div>
          </div>`;
      } else {
          headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; padding-bottom: 15px; border-bottom: 2px solid ${c.color}; background:${c.color}11; padding: 15px; border-radius: 8px;">
              <div>
                  <h1 style="margin:0; font-size:24px; color:${c.color}; text-transform:uppercase;">Tapowan Public School</h1>
                  <div style="font-weight:bold; margin-top:4px; font-size: 16px;">ADMIT CARD - <span contenteditable="true">${examName}</span></div>
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
      <div style="width: 100%; max-width: 750px; margin: 0 auto; background: ${s.cardBg}; border: ${borderCss}; border-radius: ${s.radius}; padding: 25px; box-shadow: ${s.shadow}; font-family: ${c.font}; ${fontColorStyle} box-sizing: border-box;">
          ${headerHtml}
          
          <div style="display:flex; justify-content:space-between; margin-top: 25px; gap: 20px; align-items:center;">
              <div style="flex:1; font-size: 15px; line-height: 1.8;">
                  <div><strong>Student Name:</strong> <span contenteditable="true">${student.fullName || student.name || student.studentName || ""}</span></div>
                  <div><strong>Father's Name:</strong> <span contenteditable="true">${student.fatherName || "-"}</span></div>
                  <div><strong>Class & Section:</strong> <span contenteditable="true">${student.className || ""}</span></div>
                  <div><strong>Roll Number:</strong> <span contenteditable="true">${student.rollNo || "-"}</span></div>
                  <div><strong>Admission No:</strong> <span contenteditable="true">${admNo}</span></div>
              </div>
              <div style="width: 110px; height: 130px; border: 2px solid ${c.color}; border-radius: 6px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#fafafa;">
                  <img src="${photoUrl}" style="max-width:100%; max-height:100%; object-fit:cover;" />
              </div>
          </div>
          
          <div style="margin-top: 25px; border-top: 1px dashed #ccc; padding-top: 15px; font-size: 12px; color: #666;">
              <strong>Instructions:</strong>
              <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                  <li>Please bring this admit card to the examination hall every day.</li>
                  <li>Reach the examination center at least 15 minutes before the exam starts.</li>
                  <li>Electronic devices including smartwatches and mobile phones are strictly prohibited.</li>
              </ul>
          </div>
          
          ${footerHtml}
      </div>
      `;
  }

  function getTpsOfficialResultHtml(exam, config) {
    const store = typeof getStore !== "undefined" ? getStore() : (typeof window !== "undefined" && window.store ? window.store : {});
    const studentList = (store && store.students) || [];
    
    // Look up matching student from store to ensure phone, dob, father/mother name, photo etc. are available
    const matchedStudent = findStudentFromStore(studentList, exam);
    
    const admNo = matchedStudent.admissionNo || exam.admissionNo || exam.admNo || "-";

    const candidateName = exam.studentName || matchedStudent.fullName || matchedStudent.name || "";
    const fatherName = exam.fatherName || matchedStudent.fatherName || "---";
    const motherName = exam.motherName || matchedStudent.motherName || "---";

    // Format DOB
    const rawDob = exam.dob || matchedStudent.dob || "";
    let dobFormatted = "---";
    if (rawDob && String(rawDob).trim() !== "" && String(rawDob) !== "null" && String(rawDob) !== "undefined") {
      try {
        const d = new Date(rawDob);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const year = d.getFullYear();
          dobFormatted = `${day}/${month}/${year}`;
        } else {
          dobFormatted = String(rawDob);
        }
      } catch (e) {
        dobFormatted = String(rawDob);
      }
    }

    // Format Contact No / Phone
    const rawPhone = exam.phone || exam.mobile || exam.phoneNo || exam.contactNo || 
                     matchedStudent.phone || matchedStudent.phone1 || matchedStudent.mobile || 
                     matchedStudent.whatsapp || matchedStudent.contact || "";
    const phoneNo = rawPhone && String(rawPhone).trim() !== "" && String(rawPhone) !== "null" && String(rawPhone) !== "undefined"
      ? String(rawPhone).trim() 
      : "---";

    const classRank = exam.classRank || "";
    const schoolRank = exam.schoolRank || "";
    const totalClassStudents = exam.totalClassStudents || "";
    const totalSchoolStudents = exam.totalSchoolStudents || "";

    const formatRank = (r) => {
      if (!r || r === "null" || r === "undefined" || r === "-") return "---";
      const num = parseInt(r, 10);
      if (isNaN(num) || num <= 0) return r;
      const lastDigit = num % 10;
      const lastTwoDigits = num % 100;
      let suffix = "th";
      if (lastTwoDigits < 11 || lastTwoDigits > 13) {
        if (lastDigit === 1) suffix = "st";
        else if (lastDigit === 2) suffix = "nd";
        else if (lastDigit === 3) suffix = "rd";
      }
      return `${num}${suffix}`;
    };

    const autoRemarks = (function() {
      const p = parseFloat(exam.percentage) || 0;
      if (p >= 90) return "Outstanding performance! Exemplary academic dedication & excellence.";
      if (p >= 75) return "Very good performance. Shows strong conceptual grasp and aptitude.";
      if (p >= 60) return "Good overall effort. Consistent revision will bring further growth.";
      if (p >= 50) return "Satisfactory performance. Encouraged to focus more on core concepts.";
      if (p >= 33) return "Passed. Regular revision and extra guidance recommended for improvement.";
      return "Needs substantial improvement and dedicated remedial support.";
    })();

    const isHalfYearly = /half|mid|term-1|term 1|pa1/i.test(exam.examName || '');
    const isAnnual = !isHalfYearly && /annual|term-2|term 2|yearly|final|session ending|pa2/i.test(exam.examName || '');
    const isCBSE = isHalfYearly || isAnnual;
    const paLabel = isAnnual ? 'PA2<br>(10)' : 'PA1<br>(10)';
    const examLabel = isAnnual ? 'Annual Exam<br>(80)' : 'Half Yearly<br>(80)';

    const getGrade = (percentage) => {
      const p = parseFloat(percentage);
      if (isNaN(p)) return '-';
      if (isCBSE) {
        if (p >= 91) return 'A1';
        if (p >= 81) return 'A2';
        if (p >= 71) return 'B1';
        if (p >= 61) return 'B2';
        if (p >= 51) return 'C1';
        if (p >= 41) return 'C2';
        if (p >= 33) return 'D';
        return 'E';
      } else {
        if (p >= 91) return 'A+';
        if (p >= 81) return 'A';
        if (p >= 71) return 'B+';
        if (p >= 61) return 'B';
        if (p >= 51) return 'C';
        if (p >= 33) return 'D';
        return 'E';
      }
    };
    let subs = [];
    try { subs = typeof exam.subjectMarks === 'string' ? JSON.parse(exam.subjectMarks) : (exam.subjectMarks || []); } catch(e) {}
    if (!Array.isArray(subs)) subs = [];

    const evalStatus = evalStudentResultStatus(subs, exam.className, exam.examName);
    const hasExplicitPassOrFail = (exam.resultStatus === 'PASS' || exam.resultStatus === 'FAIL');
    const isPending = !hasExplicitPassOrFail && (evalStatus.isPending || (evalStatus.resultStatus === 'PENDING') || (exam.resultStatus === 'PENDING'));
    const safeResultStatus = hasExplicitPassOrFail ? exam.resultStatus : (isPending ? 'PENDING' : evalStatus.resultStatus);
    const displayOverallPct = (evalStatus.overallStats && evalStatus.overallStats.percentage > 0) ? evalStatus.overallStats.percentage : (parseFloat(exam.percentage) || 0);
    const safeGrade = (exam.grade && exam.grade !== 'null' && exam.grade !== 'undefined' && exam.grade !== '---' && exam.grade !== '-')
      ? ((evalStatus.overallStats.grandTotal > 0 && exam.totalMarks != evalStatus.overallStats.grandTotal) ? getGrade(displayOverallPct) : exam.grade)
      : getGrade(displayOverallPct);

    // Prepare complete class curriculum subjects so all subjects for the class are displayed
    const completeSubs = prepareCompleteMarksheetSubjects(subs, exam.className, isCBSE, isAnnual, exam.examName);
    const tableSubs = completeSubs.length > 0 ? completeSubs : subs;

    const logoSrc = 'tps_logo_new.png';
    const photoUrl = getStudentPhotoUri(matchedStudent, matchedStudent.admissionNo || matchedStudent.id || exam.admissionNo || exam.admNo) || getStudentPhotoUri(exam.studentPhoto, matchedStudent.admissionNo || exam.admissionNo || exam.admNo) || '';

    const photoHtml = photoUrl 
      ? `<div style="width:100%; height:100%; position:relative; display:flex; align-items:center; justify-content:center;">
           <img src="${photoUrl}" style="width:100%; height:100%; object-fit:contain; background:#ffffff; display:block;" alt="Photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
           <div style="display:none; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:6pt; font-weight:700; color:#64748b; line-height:1.15; padding:2px;">
             <svg style="width:24px; height:24px; margin-bottom:2px;" viewBox="0 0 24 24" fill="#94a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
             <span>PHOTO<br>UNAVAILABLE</span>
           </div>
         </div>`
      : `<div style="display:flex; width:100%; height:100%; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-size:6pt; font-weight:700; color:#64748b; line-height:1.2; padding:2px;">
           <svg style="width:24px; height:24px; margin-bottom:2px;" viewBox="0 0 24 24" fill="#94a3b8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
             <span>AFFIX PASSPORT<br>SIZE PHOTO<br><small style="font-size:5pt;">(पासपोर्ट साइज फोटो)</small></span>
         </div>`;

    // Extract valid evaluated subjects for the Performance Graph (exclude pending and graded subjects)
    const evaluatedSubjects = tableSubs.filter(s => s && s.subject && !isDrawingSubject(s.subject) && !s.isPending && s.total !== '' && s.total !== '-' && !isNaN(parseFloat(s.total)));

    // Ensure table has at least 5 rows for a balanced single-page layout
    const minRows = 5;
    while(tableSubs.length < minRows) {
        tableSubs.push({ subject: '', max: '', min: '', theory: '', practical: '', total: '', pa1: '', pa2: '', notebook: '', enrichment: '' });
    }
    
    const rowPad = '2.5px 4px';
    
    let tableHeadHtml = '';
    if (isCBSE) {
      tableHeadHtml = `
        <th style="width:5%; border:1px solid #cbd5e1; padding:3.5px 2px; text-align:center; font-size:8pt; font-weight:800; line-height:1.15; letter-spacing:0.2px; background:#f8fafc; color:#0f2b5c;">क्र.सं.<br>Sl.No</th>
        <th style="width:26%; border:1px solid #cbd5e1; padding:3.5px 4px; text-align:center; font-size:9.5pt; font-weight:800; line-height:1.15; letter-spacing:0.4px; background:#f8fafc; color:#0f2b5c;">विषय / SUBJECT</th>
        <th style="width:11%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8pt; font-weight:800; line-height:1.15; letter-spacing:0.2px; background:#f8fafc; color:#0f2b5c;">${paLabel}</th>
        <th style="width:14%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8pt; font-weight:800; line-height:1.15; letter-spacing:0.2px; background:#f8fafc; color:#0f2b5c;">Notebook<br>(5)</th>
        <th style="width:18%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8pt; font-weight:800; line-height:1.1; letter-spacing:0.2px; background:#f8fafc; color:#0f2b5c;">Subject Enrichment<br>(5)</th>
        <th style="width:14%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8pt; font-weight:800; line-height:1.15; letter-spacing:0.2px; background:#f8fafc; color:#0f2b5c;">${examLabel}</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:9pt; font-weight:900; line-height:1.15; letter-spacing:0.4px; background:#f1f5f9; color:#0f2b5c;">TOTAL / GRADE<br>(100)</th>
      `;
    } else {
      tableHeadHtml = `
        <th style="width:6%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8pt; font-weight:800; line-height:1.15; letter-spacing:0.3px; background:#f8fafc; color:#0f2b5c;">क्र.सं.<br>Sl.No</th>
        <th style="width:34%; border:1px solid #cbd5e1; padding:3.5px 4px; text-align:center; font-size:9.5pt; font-weight:800; line-height:1.15; letter-spacing:0.4px; background:#f8fafc; color:#0f2b5c;">विषय / SUBJECT</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8.5pt; font-weight:800; line-height:1.15; letter-spacing:0.3px; background:#f8fafc; color:#0f2b5c;">MAX</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8.5pt; font-weight:800; line-height:1.15; letter-spacing:0.3px; background:#f8fafc; color:#0f2b5c;">MIN</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8.5pt; font-weight:800; line-height:1.15; letter-spacing:0.3px; background:#f8fafc; color:#0f2b5c;">TH.</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:8.5pt; font-weight:800; line-height:1.15; letter-spacing:0.3px; background:#f8fafc; color:#0f2b5c;">PR.</th>
        <th style="width:12%; border:1px solid #cbd5e1; padding:3.5px 3px; text-align:center; font-size:9pt; font-weight:900; line-height:1.15; letter-spacing:0.3px; background:#f1f5f9; color:#0f2b5c;">TOTAL / GRADE</th>
      `;
    }

    const rowsHtml = tableSubs.map((sub, rIdx) => {
      const isEmpty = !sub.subject;
      const isDrawing = !isEmpty && isDrawingSubject(sub.subject);
      const isMain = isEmpty ? true : (isDrawing ? false : (sub.isMain !== undefined ? sub.isMain : isSubjectMain(sub.subject, exam.className, sub)));
      const addlBadge = (!isEmpty && !isMain) 
        ? (isDrawing 
            ? `<span style="font-size:5.5pt; font-weight:800; color:#2563eb; background:#eff6ff; border:1px solid #bfdbfe; border-radius:2.5px; padding:0.5px 3px; margin-left:4px; vertical-align:middle; display:inline-block; letter-spacing:0.2px;">GRADED</span>`
            : `<span style="font-size:5.5pt; font-weight:800; color:#b45309; background:#fef3c7; border:1px solid #fde68a; border-radius:2.5px; padding:0.5px 3px; margin-left:4px; vertical-align:middle; display:inline-block; letter-spacing:0.2px;">ADDITIONAL</span>`)
        : '';
      const isPendingRow = sub.isPending === true;
      const pendingText = `<span style="font-size:8.5pt; font-weight:700; color:#94a3b8; font-style:italic;">Pending</span>`;

      if (isCBSE) {
        const isAddl = !isMain;
        const isSubAbsent = sub.isAbsent === true || String(sub.total).toUpperCase() === 'AB' || String(sub.theory).toUpperCase() === 'AB' || String(sub.subjective).toUpperCase() === 'AB';
        let paVal = isPendingRow ? '-' : (isAddl ? '-' : (isAnnual ? (sub.pa2 !== undefined && sub.pa2 !== '' ? sub.pa2 : (sub.pa1 || '')) : (sub.pa1 !== undefined && sub.pa1 !== '' ? sub.pa1 : '')));
        let nbVal = isPendingRow ? '-' : (isAddl ? '-' : (sub.notebook !== undefined && sub.notebook !== '' ? sub.notebook : ''));
        let enrVal = isPendingRow ? '-' : (isAddl ? '-' : (sub.enrichment !== undefined && sub.enrichment !== '' ? sub.enrichment : ''));
        let thVal = isPendingRow ? '-' : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.theory !== undefined && sub.theory !== '' ? sub.theory : (sub.subjective !== undefined && sub.subjective !== '' ? sub.subjective : '')));
        let totVal = isPendingRow ? pendingText : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.total !== undefined && sub.total !== '' ? sub.total : (isEmpty ? '' : 0)));

        if (isDrawing) {
          const drawGrade = resolveDrawingGrade(sub, true);
          paVal = '-';
          nbVal = '-';
          enrVal = '-';
          thVal = '-';
          totVal = isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : `<span style="display:inline-block; font-size:10.5pt; font-weight:900; color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; padding:1.5px 8px; letter-spacing:0.5px;">${drawGrade}</span>`;
        }

        return `
        <tr style="background: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'}; height: 21px;">
          <td style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 800; font-size:9pt; color:#64748b;">${isEmpty ? '' : rIdx + 1}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; font-weight: 800; color: #0f2b5c; text-align: left; padding-left: 8px; font-size:10.5pt;">${sub.subject || ''}${addlBadge}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${(isAddl || isPendingRow) ? '#94a3b8' : '#334155'};">${isEmpty ? '' : paVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${(isAddl || isPendingRow) ? '#94a3b8' : '#334155'};">${isEmpty ? '' : nbVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${(isAddl || isPendingRow) ? '#94a3b8' : '#334155'};">${isEmpty ? '' : enrVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${isPendingRow ? '#94a3b8' : '#334155'};">${isEmpty ? '' : thVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 900; color:${isPendingRow ? '#94a3b8' : (isSubAbsent ? '#dc2626' : '#0f2b5c')}; font-size:${isPendingRow ? '8.5pt' : '11.5pt'}; background: ${isEmpty ? 'transparent' : 'rgba(30, 58, 138, 0.05)'};">${isEmpty ? '' : totVal}</td>
        </tr>`;
      } else {
        const isSubAbsent = sub.isAbsent === true || String(sub.total).toUpperCase() === 'AB' || String(sub.theory).toUpperCase() === 'AB';
        let maxVal = sub.max || 100;
        let minVal = sub.min !== undefined ? sub.min : 33;
        let thVal = isPendingRow ? '-' : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.theory || 0));
        let prVal = isPendingRow ? '-' : (sub.practical || 0);
        let totVal = isPendingRow ? pendingText : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.total !== undefined && sub.total !== '' ? sub.total : (isEmpty ? '' : 0)));

        if (isDrawing) {
          const drawGrade = resolveDrawingGrade(sub, false);
          maxVal = '-';
          minVal = '-';
          thVal = '-';
          prVal = '-';
          totVal = isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : `<span style="display:inline-block; font-size:10.5pt; font-weight:900; color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; padding:1.5px 8px; letter-spacing:0.5px;">${drawGrade}</span>`;
        }

        return `
        <tr style="background: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'}; height: 21px;">
          <td style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 800; font-size:9pt; color:#64748b;">${isEmpty ? '' : rIdx + 1}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; font-weight: 800; color: #0f2b5c; text-align: left; padding-left: 8px; font-size:10.5pt;">${sub.subject || ''}${addlBadge}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${isDrawing ? '#94a3b8' : '#334155'};">${isEmpty ? '' : maxVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${isDrawing ? '#94a3b8' : '#334155'};">${isEmpty ? '' : minVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${isPendingRow ? '#94a3b8' : '#334155'};">${isEmpty ? '' : thVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 700; font-size:10pt; color:${isPendingRow ? '#94a3b8' : '#334155'};">${isEmpty ? '' : prVal}</td>
          <td contenteditable="true" style="border: 1px solid #e2e8f0; padding: ${rowPad}; text-align: center; font-weight: 900; color:${isPendingRow ? '#94a3b8' : (isSubAbsent ? '#dc2626' : '#0f2b5c')}; font-size:${isPendingRow ? '8.5pt' : '11.5pt'}; background: ${isEmpty ? 'transparent' : 'rgba(30, 58, 138, 0.05)'};">${isEmpty ? '' : totVal}</td>
        </tr>`;
      }
    }).join('');

    // Generate Subject Performance Bar Graph
    let subjectBarsHtml = '';
    if (evaluatedSubjects.length > 0) {
      subjectBarsHtml = evaluatedSubjects.map(s => {
        const maxMarks = parseFloat(s.max) > 0 ? parseFloat(s.max) : 100;
        let obtained = 0;
        if (s.total !== undefined && s.total !== '' && !isNaN(parseFloat(s.total))) {
          obtained = parseFloat(s.total);
        } else {
          const p1 = parseFloat(s.pa1) || 0;
          const nb = parseFloat(s.notebook) || 0;
          const enr = parseFloat(s.enrichment) || 0;
          const th = parseFloat(s.theory !== undefined ? s.theory : s.subjective) || 0;
          const pr = parseFloat(s.practical) || 0;
          obtained = p1 + nb + enr + th + pr;
        }
        const pct = maxMarks > 0 ? Math.min(100, Math.max(0, Math.round((obtained / maxMarks) * 100))) : 0;

        let gradient = 'linear-gradient(180deg, #10b981 0%, #059669 100%)';
        let textColor = '#047857';
        let borderColor = '#34d399';
        let bgBadge = '#ecfdf5';

        if (pct < 33) {
          gradient = 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)';
          textColor = '#b91c1c';
          borderColor = '#f87171';
          bgBadge = '#fef2f2';
        } else if (pct < 60) {
          gradient = 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)';
          textColor = '#b45309';
          borderColor = '#fcd34d';
          bgBadge = '#fffdf5';
        } else if (pct < 80) {
          gradient = 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)';
          textColor = '#1d4ed8';
          borderColor = '#60a5fa';
          bgBadge = '#eff6ff';
        }

        return `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; flex:1; min-width:28px; max-width:62px; padding:0 1px;">
            <!-- Score % Pill -->
            <span style="font-size:6.5pt; font-weight:800; color:${textColor}; background:${bgBadge}; border:1px solid ${borderColor}; padding:1px 3px; border-radius:3px; margin-bottom:2px; line-height:1; box-shadow:0 1px 2px rgba(0,0,0,0.04); min-width:22px; text-align:center;">${pct}%</span>
            <!-- Bar Container (62px slot) -->
            <div style="width:100%; height:62px; display:flex; align-items:flex-end; justify-content:center; position:relative;">
              <div style="width:16px; max-width:70%; height:${Math.max(6, pct)}%; background:${gradient}; border-radius:3px 3px 0 0; border:1px solid ${borderColor}; border-bottom:none; box-shadow:0 1.5px 3px rgba(0,0,0,0.12); position:relative;"></div>
            </div>
            <!-- Baseline -->
            <div style="width:100%; height:1.5px; background:#94a3b8;"></div>
            <!-- Subject Name (No ellipsis cutoff, clean wrapping) -->
            <div title="${s.subject}" style="font-size:6.8pt; font-weight:800; color:#0f2b5c; text-align:center; margin-top:2px; width:100%; line-height:1.1; word-break:break-word; max-height:20px; overflow:hidden; text-transform:capitalize;">${s.subject}</div>
            <!-- Marks Obtained / Max -->
            <div style="font-size:5.8pt; font-weight:700; color:#64748b; text-align:center; line-height:1; margin-top:1px;">${obtained}/${maxMarks}</div>
          </div>
        `;
      }).join('');
    } else {
      subjectBarsHtml = `<div style="width:100%; text-align:center; font-size:7pt; color:#94a3b8; font-weight:700; padding:8px 0;">No evaluated subjects available to generate performance graph.</div>`;
    }

    const subjectGraphSectionHtml = `
      <!-- Subject Performance Graph / विषयवार प्रदर्शन आलेख -->
      <div style="border:1.5px solid #cbd5e1; border-radius:6px; background:#ffffff; padding:4px 6px 3px 6px; margin-bottom:5px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
        <!-- Graph Header & Legend -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px; padding-bottom:1.5px; border-bottom:1px solid #f1f5f9;">
          <div style="display:flex; align-items:center; gap:3px;">
            <span style="font-size:7pt; line-height:1;">📊</span>
            <span style="font-size:6.8pt; font-weight:900; color:#0f2b5c; text-transform:uppercase; letter-spacing:0.4px;">SUBJECT PERFORMANCE GRAPH / विषयवार प्रदर्शन आलेख</span>
          </div>
          <!-- Legend Indicators -->
          <div style="display:flex; align-items:center; gap:5px; font-size:5.5pt; font-weight:800;">
            <span style="display:flex; align-items:center; gap:2px; color:#047857;">
              <span style="width:5.5px; height:5.5px; border-radius:1.5px; background:#10b981; display:inline-block;"></span> ≥80% Distinction
            </span>
            <span style="display:flex; align-items:center; gap:2px; color:#1d4ed8;">
              <span style="width:5.5px; height:5.5px; border-radius:1.5px; background:#3b82f6; display:inline-block;"></span> 60-79% Good
            </span>
            <span style="display:flex; align-items:center; gap:2px; color:#b45309;">
              <span style="width:5.5px; height:5.5px; border-radius:1.5px; background:#f59e0b; display:inline-block;"></span> 33-59% Pass
            </span>
            <span style="display:flex; align-items:center; gap:2px; color:#dc2626;">
              <span style="width:5.5px; height:5.5px; border-radius:1.5px; background:#ef4444; display:inline-block;"></span> &lt;33% Needs Help
            </span>
          </div>
        </div>

        <!-- Graph Chart Area -->
        <div style="position:relative; width:100%;">
          <!-- 33% Pass Benchmark Guideline -->
          <div style="position:absolute; top:14px; left:0; right:0; height:62px; pointer-events:none; z-index:0;">
            <div style="position:absolute; bottom:33%; left:0; right:0; border-top:1px dashed #cbd5e1;"></div>
            <span style="position:absolute; bottom:calc(33% + 1px); right:2px; font-size:5pt; font-weight:800; color:#94a3b8;">33% PASS</span>
          </div>

          <!-- Bars Container -->
          <div style="display:flex; justify-content:space-around; align-items:flex-end; width:100%; position:relative; z-index:1;">
            ${subjectBarsHtml}
          </div>
        </div>
      </div>
    `;

    const displayExamTitle = exam.examName ? exam.examName.toUpperCase() : "HALF YEARLY EXAMINATION 2026-27";

    return `
      <!-- FULL A4 SIZED WRAPPER WITH PRESTIGE CERTIFICATE BORDER -->
      <div style="width:100%; height:277mm; min-height:277mm; max-height:277mm; box-sizing:border-box; border:3px solid #0f2b5c; outline:1.5px solid #d97706; outline-offset:-4px; padding:4.5mm 8mm 3.5mm 8mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; display:flex; flex-direction:column; justify-content:space-between; background:#ffffff; font-family:'Plus Jakarta Sans', Arial, sans-serif; color:#0f172a; font-size:9pt; position:relative; overflow:hidden; box-shadow: inset 0 0 0 7px #ffffff;">
        
        <!-- Corner Ornaments (Gold & Navy) -->
        <div style="position:absolute; top:6px; left:6px; width:18px; height:18px; border-top:2.5px solid #d97706; border-left:2.5px solid #d97706; pointer-events:none; z-index:2;"></div>
        <div style="position:absolute; top:6px; right:6px; width:18px; height:18px; border-top:2.5px solid #d97706; border-right:2.5px solid #d97706; pointer-events:none; z-index:2;"></div>
        <div style="position:absolute; bottom:6px; left:6px; width:18px; height:18px; border-bottom:2.5px solid #d97706; border-left:2.5px solid #d97706; pointer-events:none; z-index:2;"></div>
        <div style="position:absolute; bottom:6px; right:6px; width:18px; height:18px; border-bottom:2.5px solid #d97706; border-right:2.5px solid #d97706; pointer-events:none; z-index:2;"></div>

        <!-- Subtle Watermark -->
        <img src="${logoSrc}" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:300px; max-height:300px; object-fit:contain; opacity:0.04; pointer-events:none; z-index:0;" alt="" onerror="this.style.display='none'" />

        <!-- Main Content -->
        <div style="display:flex; flex-direction:column; justify-content:flex-start; position:relative; z-index:1;">
          
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #0f2b5c; padding-bottom:5px; margin-bottom:5px;">
            <div style="width:24mm; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="width:20mm; height:20mm; border-radius:50%; border:2px solid #d97706; padding:1.5px; box-shadow:0 2px 5px rgba(0,0,0,0.08); background:#ffffff; display:flex; align-items:center; justify-content:center;">
                <img src="${logoSrc}" style="max-width:18mm; max-height:18mm; object-fit:contain;" alt="Logo" onerror="this.src='school_logo.png'" />
              </div>
            </div>
            <div style="flex:1; text-align:center; padding:0 6px;">
              <div style="font-size:7.2pt; font-weight:800; letter-spacing:1.2px; color:#b45309; text-transform:uppercase; margin-bottom:1px;">
                CBSE AFFILIATED PATTERN • AN ENGLISH MEDIUM CO-ED INSTITUTION
              </div>
              <div style="font-family:'Cinzel', 'Times New Roman', serif; font-size:17.5pt; font-weight:900; color:#0f2b5c; letter-spacing:1.2px; line-height:1.1; margin-bottom:1px; text-shadow: 0 1px 2px rgba(15,43,92,0.1);">
                TAPOWAN PUBLIC SCHOOL
              </div>
              <div style="font-size:7pt; font-weight:700; color:#475569; margin-bottom:3px;">
                Prem Nagar, Banjee, Tapin, Ramgarh, Jharkhand - 825314 | Helpline: +91 87577 44973, 62991 22869
              </div>
              <div style="margin:1px 0;">
                <span contenteditable="true" style="background:linear-gradient(180deg, #0f2b5c 0%, #1e3a8a 100%); color:#ffffff; font-size:8.5pt; font-weight:900; padding:2px 14px; border-radius:3.5px; letter-spacing:0.6px; display:inline-block; border:1px solid #d97706; box-shadow:0 1.5px 3px rgba(15,43,92,0.15);">
                  ${displayExamTitle}
                </span>
              </div>
              <div style="font-size:11.5pt; font-weight:900; color:#047857; letter-spacing:1.5px; margin-top:2px; text-transform:uppercase;">
                ❖ PROGRESS REPORT / प्रगति-पत्र ❖
              </div>
            </div>
            <div style="width:30mm; text-align:right;">
              <div style="border:1.5px solid #d97706; background:linear-gradient(180deg, #fffdf5 0%, #fef3c7 100%); padding:3.5px 4px; border-radius:5px; font-size:7pt; text-align:center; box-shadow:0 1.5px 4px rgba(217,119,6,0.08); line-height:1.25;">
                <div style="font-weight:800; color:#0f172a; border-bottom:1px dashed #d97706; padding-bottom:2px; margin-bottom:2px; font-size:7pt;">
                  U-DISE: 20241202412
                </div>
                <div style="font-weight:900; color:#0f2b5c; font-size:8.5pt;">
                  SESSION: ${exam.session || '2026-2027'}
                </div>
                <div style="font-size:6.8pt; font-weight:800; color:#b45309; margin-top:1px;">
                  SCH. NO: 825314
                </div>
              </div>
            </div>
          </div>

          <!-- School & Center Bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #cbd5e1; border-left:3.5px solid #0f2b5c; padding:2.5px 8px; font-size:7.8pt; margin-bottom:5px; border-radius:4px;">
            <div><strong style="color:#0f2b5c;">School Code & Name:</strong> 825314 • TAPOWAN PUBLIC SCHOOL, RAMGARH</div>
            <div style="text-align:right;"><strong style="color:#0f2b5c;">Exam Centre:</strong> TPS MAIN CAMPUS (RAMGARH)</div>
          </div>

          <!-- Student Profile Dossier & Photo -->
          <div style="display:flex; gap:8px; margin-bottom:5px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:5px; padding:4px 8px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <table style="flex:1; border-collapse:collapse; font-size:8.5pt;">
              <tbody>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; width:16%; font-size:7.8pt; text-transform:uppercase;">Student Name:</td>
                  <td colspan="3" contenteditable="true" style="padding:2.5px 4px; font-weight:900; color:#0f2b5c; font-size:12pt; letter-spacing:0.2px;">${candidateName}</td>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; width:14%; font-size:7.8pt; text-transform:uppercase;">Class & Sec:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; width:18%;">
                    <span style="background:#eff6ff; color:#1d4ed8; font-weight:900; padding:1.5px 7px; border-radius:3px; border:1px solid #bfdbfe; font-size:10pt;">${exam.className}</span>
                  </td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Roll No:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; width:16%;">
                    <span style="background:#fef2f2; color:#dc2626; font-weight:900; padding:1.5px 7px; border-radius:3px; border:1px solid #fecaca; font-size:11pt;">${exam.rollNo}</span>
                  </td>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; width:16%; font-size:7.8pt; text-transform:uppercase;">Adm / Reg No:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; width:18%;">
                    <span style="background:#f8fafc; color:#0f172a; font-weight:900; padding:1.5px 7px; border-radius:3px; border:1px solid #cbd5e1; font-size:10pt;">${admNo}</span>
                  </td>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Date of Birth:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; font-weight:800; color:#0f172a; font-size:9.5pt;">${dobFormatted}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Father's Name:</td>
                  <td colspan="3" contenteditable="true" style="padding:2.5px 4px; font-weight:800; color:#0f172a; text-transform:uppercase; font-size:9.5pt;">${fatherName}</td>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Mother's Name:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; font-weight:800; color:#0f172a; text-transform:uppercase; font-size:9.5pt;">${motherName}</td>
                </tr>
                <tr>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Contact No:</td>
                  <td colspan="3" contenteditable="true" style="padding:2.5px 4px; font-weight:800; color:#0f172a; font-family:monospace; font-size:9.5pt;">${phoneNo}</td>
                  <td style="padding:2.5px 4px; font-weight:800; color:#64748b; font-size:7.8pt; text-transform:uppercase;">Attendance:</td>
                  <td contenteditable="true" style="padding:2.5px 4px; font-weight:800; color:#0f172a; font-size:9pt;">___ / ___ Days</td>
                </tr>
              </tbody>
            </table>
            
            <!-- Photo Box -->
            <div style="width:22mm; height:27mm; border:1.5px solid #0f2b5c; outline:1px solid #d97706; outline-offset:1px; border-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.1); overflow:hidden; background:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0;">
              ${photoHtml}
            </div>
          </div>

          <!-- Scholastic Performance Table -->
          <div style="margin-bottom:5px;">
            <table style="width:100%; border-collapse:collapse; font-size:8pt; border:1px solid #cbd5e1; border-radius:4px; overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc; color:#0f2b5c; border-bottom:2px solid #0f2b5c;">
                  ${tableHeadHtml}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Total Metrics Ribbon -->
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:5px;">
            <!-- Grand Total -->
            <div style="border:1.5px solid #93c5fd; background:linear-gradient(180deg, #f0f7ff 0%, #e0f2fe 100%); border-radius:5px; padding:3.5px 3px 4px 3px; text-align:center; box-shadow:0 1px 3px rgba(37,99,235,0.06); display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
              <div style="font-size:7.8pt; font-weight:900; color:#1e40af; text-transform:uppercase; letter-spacing:0.5px; line-height:1.1; white-space:nowrap;">GRAND TOTAL</div>
              <div contenteditable="true" style="font-size:16.5pt; font-weight:900; color:#0f2b5c; line-height:1.05; margin:1.5px 0; white-space:nowrap;">${isPending ? `${evalStatus.overallStats.grandTotal} / ${evalStatus.overallStats.maxTotal}` : (evalStatus.overallStats.grandTotal > 0 ? evalStatus.overallStats.grandTotal : (exam.totalMarks || 0))}</div>
              <div style="font-size:6.8pt; font-weight:800; color:#475569; text-transform:uppercase; line-height:1.15; letter-spacing:0.3px; white-space:nowrap;">TOTAL OBTAINED</div>
            </div>

            <!-- Percentage -->
            <div style="border:1.5px solid #c4b5fd; background:linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%); border-radius:5px; padding:3.5px 3px 4px 3px; text-align:center; box-shadow:0 1px 3px rgba(109,40,217,0.06); display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
              <div style="font-size:7.8pt; font-weight:900; color:#6d28d9; text-transform:uppercase; letter-spacing:0.5px; line-height:1.1; white-space:nowrap;">PERCENTAGE</div>
              <div contenteditable="true" style="font-size:17pt; font-weight:900; color:#5b21b6; line-height:1.05; margin:1.5px 0; white-space:nowrap;">${isPending ? `${evalStatus.overallStats.percentage}%` : `${evalStatus.overallStats.percentage > 0 ? evalStatus.overallStats.percentage : (exam.percentage || 0)}%`}</div>
              <div style="font-size:6.8pt; font-weight:800; color:#475569; text-transform:uppercase; line-height:1.15; letter-spacing:0.3px; white-space:nowrap;">${isPending ? 'AGGREGATE (PENDING)' : 'AGGREGATE SCORE'}</div>
            </div>

            <!-- Grade -->
            <div style="border:1.5px solid #fde68a; background:linear-gradient(180deg, #fffdf5 0%, #fef3c7 100%); border-radius:5px; padding:3.5px 3px 4px 3px; text-align:center; box-shadow:0 1px 3px rgba(217,119,6,0.06); display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
              <div style="font-size:7.8pt; font-weight:900; color:#b45309; text-transform:uppercase; letter-spacing:0.5px; line-height:1.1; white-space:nowrap;">OVERALL GRADE</div>
              <div contenteditable="true" style="font-size:17pt; font-weight:900; color:#92400e; line-height:1.05; margin:1.5px 0; white-space:nowrap;">${safeGrade}</div>
              <div style="font-size:6.8pt; font-weight:800; color:#475569; text-transform:uppercase; line-height:1.15; letter-spacing:0.3px; white-space:nowrap;">SCHOLASTIC EVALUATION</div>
            </div>

            <!-- Result -->
            <div style="border:1.5px solid ${isPending ? '#fcd34d' : (safeResultStatus === 'PASS' ? '#86efac' : '#fca5a5')}; background:${isPending ? 'linear-gradient(180deg, #fffdf5 0%, #fef3c7 100%)' : (safeResultStatus === 'PASS' ? 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)')}; border-radius:5px; padding:3.5px 3px 4px 3px; text-align:center; box-shadow:0 1px 3px ${isPending ? 'rgba(217,119,6,0.08)' : (safeResultStatus === 'PASS' ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)')}; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden;">
              <div style="font-size:7.8pt; font-weight:900; color:${isPending ? '#b45309' : (safeResultStatus === 'PASS' ? '#15803d' : '#b91c1c')}; text-transform:uppercase; letter-spacing:0.5px; line-height:1.1; white-space:nowrap;">RESULT STATUS</div>
              <div contenteditable="true" style="font-size:${isPending ? '12.5pt' : (safeResultStatus === 'PASS' ? '15.5pt' : '15pt')}; font-weight:900; color:${isPending ? '#d97706' : (safeResultStatus === 'PASS' ? '#16a34a' : '#dc2626')}; line-height:1.1; margin:1.5px 0; letter-spacing:0.5px; white-space:nowrap; display:flex; align-items:center; justify-content:center; gap:4px; width:100%; box-sizing:border-box;">
                <span style="font-size:0.85em; opacity:0.9;">★</span>
                <span>${safeResultStatus}</span>
                <span style="font-size:0.85em; opacity:0.9;">★</span>
              </div>
              <div style="font-size:6.8pt; font-weight:800; color:${isPending ? '#b45309' : (safeResultStatus === 'PASS' ? '#15803d' : '#b91c1c')}; line-height:1.15; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap;">${isPending ? 'INCOMPLETE / अपूर्ण' : (safeResultStatus === 'PASS' ? 'PASSED / उत्तीर्ण' : 'NEEDS IMPROVEMENT')}</div>
            </div>
          </div>

          <!-- Rank & Remarks Row -->
          <div style="display:flex; gap:8px; margin-bottom:5px;">
            <!-- Sleek Class Rank & School Rank Slots -->
            <div style="flex:1; border:1.5px solid #cbd5e1; border-radius:5px; background:linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding:3px 8px; display:flex; align-items:center; justify-content:space-around; gap:8px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
              
              <!-- Class Rank Slot -->
              <div style="display:flex; align-items:center; gap:5px;">
                <div style="display:flex; flex-direction:column; align-items:flex-start;">
                  <span style="font-size:6.8pt; font-weight:900; color:#1e40af; text-transform:uppercase; letter-spacing:0.4px; line-height:1;">CLASS RANK</span>
                  <span style="font-size:5.5pt; font-weight:700; color:#64748b; line-height:1; margin-top:1px;">कक्षा स्थान</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2px;">
                  <span contenteditable="true" style="display:inline-block; min-width:34px; padding:1px 4px; font-size:11.5pt; font-weight:900; color:#1e40af; background:#ffffff; border:1.5px solid #93c5fd; border-radius:3.5px; text-align:center; box-shadow:inset 0 1px 2px rgba(30,64,175,0.08); outline:none;">${formatRank(classRank)}</span>
                  ${totalClassStudents ? `<span style="font-size:7.5pt; font-weight:800; color:#64748b;">/${totalClassStudents}</span>` : ''}
                </div>
              </div>

              <div style="width:1px; height:18px; background:#cbd5e1;"></div>

              <!-- School Rank Slot -->
              <div style="display:flex; align-items:center; gap:5px;">
                <div style="display:flex; flex-direction:column; align-items:flex-start;">
                  <span style="font-size:6.8pt; font-weight:900; color:#b45309; text-transform:uppercase; letter-spacing:0.4px; line-height:1;">SCHOOL RANK</span>
                  <span style="font-size:5.5pt; font-weight:700; color:#64748b; line-height:1; margin-top:1px;">विद्यालय स्थान</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:2px;">
                  <span contenteditable="true" style="display:inline-block; min-width:34px; padding:1px 4px; font-size:11.5pt; font-weight:900; color:#b45309; background:#ffffff; border:1.5px solid #fde68a; border-radius:3.5px; text-align:center; box-shadow:inset 0 1px 2px rgba(180,83,9,0.08); outline:none;">${formatRank(schoolRank)}</span>
                  ${totalSchoolStudents ? `<span style="font-size:7.5pt; font-weight:800; color:#64748b;">/${totalSchoolStudents}</span>` : ''}
                </div>
              </div>

            </div>

            <!-- Sleek Remarks Slot -->
            <div style="flex:1.2; border:1.5px solid #cbd5e1; border-radius:5px; background:linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding:3px 8px; display:flex; align-items:center; gap:6px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
              <div style="display:flex; flex-direction:column; align-items:flex-start; flex-shrink:0;">
                <span style="font-size:6.8pt; font-weight:900; color:#0f2b5c; text-transform:uppercase; letter-spacing:0.4px; line-height:1;">REMARKS</span>
                <span style="font-size:5.5pt; font-weight:700; color:#64748b; line-height:1; margin-top:1px;">शिक्षक टिप्पणी</span>
              </div>
              <span contenteditable="true" style="font-size:8.5pt; font-weight:700; color:#0f172a; flex:1; background:#ffffff; border:1px solid #cbd5e1; border-radius:3.5px; padding:1.5px 6px; min-height:15px; outline:none; box-shadow:inset 0 1px 2px rgba(0,0,0,0.03);">${autoRemarks}</span>
            </div>
          </div>

          ${subjectGraphSectionHtml}

          <!-- Grading Scale Strip -->
          <div style="border:1px solid #fde68a; background:linear-gradient(90deg, #fffdf5 0%, #fef3c7 50%, #fffdf5 100%); padding:2px 6px; border-radius:4px; margin-bottom:4px;">
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:7pt;">
              <span style="font-weight:900; color:#92400e; text-transform:uppercase;">${isCBSE ? 'CBSE 8-Point Scale (ग्रेडिंग प्रणाली)' : 'Grading Scale (ग्रेडिंग प्रणाली)'}:</span>
              <div style="display:flex; gap:3px; font-weight:800; color:#78350f;">
                ${isCBSE ? `
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">A1 (91-100)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">A2 (81-90)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">B1 (71-80)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">B2 (61-70)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">C1 (51-60)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">C2 (41-50)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">D (33-40)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a; color:#b91c1c;">E (Needs Help)</span>
                ` : `
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">A+ (91-100%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">A (81-90%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">B+ (71-80%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">B (61-70%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">C (51-60%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a;">D (33-50%)</span>
                  <span style="background:rgba(255,255,255,0.85); padding:0.5px 3px; border-radius:2px; border:1px solid #fde68a; color:#b91c1c;">E (0-32%)</span>
                `}
              </div>
            </div>
          </div>

        </div>

        <!-- Footer Signatures & Official Stamp (Spacious Signing Zone) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:auto; padding:3px 10px 2px 10px; position:relative; z-index:1;">
          
          <!-- Class Teacher Signature -->
          <div style="text-align:center; width:28%; display:flex; flex-direction:column; align-items:center;">
            <div style="height:24px; width:100%; display:flex; align-items:flex-end; justify-content:center; margin-bottom:2px;">
              <!-- Dedicated Signing Space for Class Teacher -->
            </div>
            <div style="border-top:1.5px solid #0f2b5c; width:85%; margin-bottom:3px;"></div>
            <div style="font-size:7.5pt; font-weight:800; color:#0f2b5c; line-height:1.15;">
              <strong>कक्षा शिक्षक के हस्ताक्षर</strong><br>
              <span style="font-size:6.5pt; color:#64748b;">Class Teacher's Signature</span>
            </div>
          </div>

          <!-- Parent Signature -->
          <div style="text-align:center; width:28%; display:flex; flex-direction:column; align-items:center;">
            <div style="height:24px; width:100%; display:flex; align-items:flex-end; justify-content:center; margin-bottom:2px;">
              <!-- Dedicated Signing Space for Parent -->
            </div>
            <div style="border-top:1.5px solid #0f2b5c; width:85%; margin-bottom:3px;"></div>
            <div style="font-size:7.5pt; font-weight:800; color:#0f2b5c; line-height:1.15;">
              <strong>अभिभावक के हस्ताक्षर</strong><br>
              <span style="font-size:6.5pt; color:#64748b;">Parent's Signature</span>
            </div>
          </div>

          <!-- Principal Signature & Official Seal -->
          <div style="text-align:center; width:34%; display:flex; flex-direction:column; align-items:center;">
            <div style="height:24px; width:100%; display:flex; align-items:center; justify-content:center; margin-bottom:2px;">
              <!-- Dedicated Signing & Stamping Space for Principal -->
            </div>
            <div style="border-top:1.5px solid #0f2b5c; width:85%; margin-bottom:3px;"></div>
            <div style="font-size:7.5pt; font-weight:800; color:#0f2b5c; line-height:1.15;">
              <strong>प्रधानाचार्य के हस्ताक्षर व मुहर</strong><br>
              <span style="font-size:6.5pt; color:#64748b;">Principal & Official Seal</span>
            </div>
          </div>

        </div>

      </div>
    `;
}

function generateDynamicMarksheet(exam, themeId, config) {
      const c = config || { color: '#0f172a', font: "'Inter', sans-serif", border: 'solid' };
      const t = parseDynamicTheme(themeId);
      const s = getDynamicStyles(t, c);
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
      
      const borderCss = c.border === 'none' ? 'none' : `${c.border === 'double' ? 8 : 3}px ${c.border} ${c.color}`;
      const photoUrl = getStudentPhotoUri(exam, exam.admissionNo || exam.admNo) || DEFAULT_SCHOOL_LOGO;
      const admNo = exam.admissionNo || '-';
      
      let subjectRows = '';
      
    const getGrade = (percentage) => {
      const p = parseFloat(percentage);
      if (isNaN(p)) return '-';
      if (isCBSE) {
        if (p >= 91) return 'A1';
        if (p >= 81) return 'A2';
        if (p >= 71) return 'B1';
        if (p >= 61) return 'B2';
        if (p >= 51) return 'C1';
        if (p >= 41) return 'C2';
        if (p >= 33) return 'D';
        return 'E';
      } else {
        if (p >= 91) return 'A+';
        if (p >= 81) return 'A';
        if (p >= 71) return 'B+';
        if (p >= 61) return 'B';
        if (p >= 51) return 'C';
        if (p >= 33) return 'D';
        return 'E';
      }
    };
    let subs = [];
    try { subs = typeof exam.subjectMarks === 'string' ? JSON.parse(exam.subjectMarks) : (exam.subjectMarks || []); } catch(e) {}
    if (!Array.isArray(subs)) subs = [];

    const evalStatus = evalStudentResultStatus(subs, exam.className, exam.examName);
    const completeSubs = prepareCompleteMarksheetSubjects(subs, exam.className, isCBSE, false, exam.examName);
    const tableSubs = completeSubs.length > 0 ? completeSubs : subs;
    const safeGrade = (exam.grade && exam.grade !== 'null' && exam.grade !== 'undefined') ? exam.grade : getGrade(exam.percentage);
    const safeResultStatus = (exam.resultStatus && exam.resultStatus !== 'null' && exam.resultStatus !== 'undefined' && exam.resultStatus !== '') ? exam.resultStatus : evalStatus.resultStatus;

    tableSubs.forEach((sub, i) => {
        const isDrawing = isDrawingSubject(sub.subject);
        const isMain = isDrawing ? false : isSubjectMain(sub.subject, exam.className, sub);
        const addlBadge = !isMain ? `<span style="font-size:7pt; font-weight:800; color:${isDrawing ? '#2563eb' : '#b45309'}; background:${isDrawing ? '#eff6ff' : '#fef3c7'}; border:1px solid ${isDrawing ? '#bfdbfe' : '#fde68a'}; border-radius:3px; padding:1px 4px; margin-left:5px; vertical-align:middle; display:inline-block;">${isDrawing ? 'GRADED' : 'ADDITIONAL'}</span>` : '';
        const rowBg = (t.tableStyle === 'striped' && i%2!==0) ? `${c.color}11` : 'transparent';
        
        let maxVal = sub.max || 100;
        let minVal = sub.min !== undefined ? sub.min : 33;
        let thVal = sub.theory || 0;
        let prVal = sub.practical || 0;
        let totVal = sub.total || 0;

        if (isDrawing) {
          const drawGrade = resolveDrawingGrade(sub, false);
          maxVal = '-';
          minVal = '-';
          thVal = '-';
          prVal = '-';
          totVal = `<span style="font-weight:900; color:#2563eb; background:#eff6ff; border:1px solid #bfdbfe; border-radius:3px; padding:2px 6px;">${drawGrade}</span>`;
        }

        subjectRows += `<tr style="background:${rowBg};">
            <td style="padding:12px; border:${s.tableBorder}; font-weight:bold;" contenteditable="true">${sub.subject}${addlBadge}</td>
            <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${maxVal}</td>
            <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${minVal}</td>
            <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${thVal}</td>
            <td style="padding:12px; border:${s.tableBorder}; text-align:center;" contenteditable="true">${prVal}</td>
            <td style="padding:12px; border:${s.tableBorder}; text-align:center; font-weight:bold; color:${c.color};" contenteditable="true">${totVal}</td>
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

      const displayDynGrandTotal = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.grandTotal > 0) ? evalStatus.overallStats.grandTotal : (exam.totalMarks || 0);
      const displayDynPercentage = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.percentage > 0) ? evalStatus.overallStats.percentage : (exam.percentage || 0);
      const displayDynGrade = (exam.grade && exam.grade !== 'null' && exam.grade !== 'undefined') ? ((evalStatus.overallStats.grandTotal > 0 && exam.totalMarks != evalStatus.overallStats.grandTotal) ? getGrade(displayDynPercentage) : exam.grade) : getGrade(displayDynPercentage);

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
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${displayDynGrandTotal}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: transparent;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${displayDynPercentage}%</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px; background: transparent;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 24px; font-weight:900; color: ${c.color};" contenteditable="true">${displayDynGrade}</div>
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
  
  function numberToWordsEnglish(n) {
    const num = parseInt(n, 10);
    if (isNaN(num) || num === 0) return 'ZERO';
    const a = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    function inWords(val) {
      if (val < 20) return a[val];
      if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
      if (val < 1000) return a[Math.floor(val / 100)] + ' HUNDRED' + (val % 100 !== 0 ? ' ' + inWords(val % 100) : '');
      return String(val);
    }
    return inWords(num).trim();
  }

  // =========================================================================
  // 🏛️ JAC BOARD CLASS 10 STYLE ADMIT CARD TEMPLATE (MICRO-TEXT WATERMARK)
  // =========================================================================
  function getJac10AdmitCardHtml(student, examName, config) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const schoolName = store.schoolProfile && store.schoolProfile.schoolName ? store.schoolProfile.schoolName : "TAPOWAN PUBLIC SCHOOL, RAMGARH";
    const logoSrc = DEFAULT_SCHOOL_LOGO;
    const qrSrc = 'qr.png';
    const rollCode = '27019';
    const rollNo = (student.rollNo || '0001').toString().padStart(5, '0');
    const regNo = student.admissionNo || '27019-RA-0050-22';
    const candidateName = (student.fullName || student.studentName || 'STUDENT NAME').toUpperCase();
    const fatherName = formatParentName(student.fatherName || '---').toUpperCase();
    const motherName = formatParentName(student.motherName || '---').toUpperCase();
    const className = student.className || 'X-A';

    const normClass = typeof normalizeClassNameForTps === 'function' ? normalizeClassNameForTps(student.className) : (student.className || 'X-A');
    const defaultSched = (typeof TPS_OFFICIAL_SCHEDULES !== 'undefined' && TPS_OFFICIAL_SCHEDULES[normClass]) ? TPS_OFFICIAL_SCHEDULES[normClass] : null;

    let schedule = [];
    if (config && config.subjectDates && Object.keys(config.subjectDates).length > 0) {
      Object.entries(config.subjectDates).forEach(([sub, dt], idx) => {
        if (dt) {
          let dateStr = typeof dt === 'object' ? (dt.date || '') : dt;
          let dayStr = typeof dt === 'object' ? (dt.day || '') : '';
          let timeStr = typeof dt === 'object' ? (dt.time || '09:45 AM - 01:00 PM') : '09:45 AM - 01:00 PM';
          if (!dayStr && typeof getAutoDayName === 'function') dayStr = getAutoDayName(dateStr);
          let formattedDate = typeof formatExamDate === 'function' ? formatExamDate(dateStr) : dateStr;
          schedule.push({ code: String(idx + 1).padStart(2, '0'), subject: sub, date: formattedDate, day: (dayStr || '').toUpperCase(), time: timeStr });
        }
      });
    }

    if (schedule.length === 0 && defaultSched) {
      schedule = defaultSched.map((item, idx) => ({
        code: String(idx + 1).padStart(2, '0'),
        subject: item.subject,
        date: typeof formatExamDate === 'function' ? formatExamDate(item.date) : item.date,
        day: ((!item.day || item.day === '---') && typeof getAutoDayName === 'function') ? getAutoDayName(item.date).toUpperCase() : (item.day || '').toUpperCase(),
        time: item.time || '09:45 AM - 01:00 PM'
      }));
    }

    if (schedule.length === 0) {
      const classSubjects = typeof getSubjectsForClass === 'function' ? getSubjectsForClass(student.className) : ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Computer Science'];
      schedule = classSubjects.map((sub, idx) => ({
        code: String(idx + 1).padStart(2, '0'),
        subject: sub,
        date: '---',
        day: '---',
        time: '09:45 AM - 01:00 PM'
      }));
    }

    let schedRows = schedule.map(sub => `
      <tr style="height:19px; font-size:7.5pt;">
        <td contenteditable="true" style="border:1px solid #991b1b; text-align:center; font-weight:800; color:#991b1b;">${sub.code}</td>
        <td contenteditable="true" style="border:1px solid #991b1b; padding:2px 5px; font-weight:800; color:#0f172a; text-transform:uppercase;">${sub.subject}</td>
        <td contenteditable="true" style="border:1px solid #991b1b; text-align:center; font-weight:700; color:#1e293b;">${sub.date}</td>
        <td contenteditable="true" style="border:1px solid #991b1b; text-align:center; font-weight:700; color:#1e293b;">${sub.day}</td>
        <td contenteditable="true" style="border:1px solid #991b1b; text-align:center; font-weight:700; color:#1e293b;">${sub.time}</td>
        <td contenteditable="true" style="border:1px solid #991b1b; text-align:center;"></td>
      </tr>
    `).join('');

    return `
      <!-- JAC 10TH INSPIRED ADMIT CARD WITH SECURITY MICRO-TEXT PATTERN -->
      <div style="width:100%; height:100%; box-sizing:border-box; border:2.5px double #991b1b; padding:4mm 5mm 3mm 5mm; display:flex; flex-direction:column; justify-content:space-between; background-color:#ffffff; background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='36' viewBox='0 0 180 36'><text x='0' y='12' font-family='sans-serif' font-size='5' font-weight='800' fill='rgba(153,27,27,0.045)' letter-spacing='0.5'>TAPOWAN PUBLIC SCHOOL</text><text x='20' y='28' font-family='sans-serif' font-size='5' font-weight='800' fill='rgba(153,27,27,0.045)' letter-spacing='0.5'>TAPOWAN PUBLIC SCHOOL</text></svg>&quot;); background-repeat:repeat; font-family:'Times New Roman', Times, serif; color:#000000; position:relative; overflow:hidden;">
        
        <!-- Center Emblem Watermark -->
        <img src="${logoSrc}" style="position:absolute; top:52%; left:50%; transform:translate(-50%,-50%); width:180px; height:180px; object-fit:contain; opacity:0.06; pointer-events:none; z-index:0;" alt="" onerror="this.style.display='none';" />

        <div style="position:relative; z-index:1;">
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2px;">
            <!-- Emblem -->
            <div style="width:20mm; display:flex; flex-direction:column; align-items:flex-start;">
              <div style="width:17mm; height:17mm; border-radius:50%; border:1.2px solid #991b1b; padding:1px; background:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(153,27,27,0.15);">
                <img src="${logoSrc}" style="max-width:15mm; max-height:15mm; object-fit:contain;" alt="Logo" onerror="this.src='school_logo.png'" />
              </div>
              <div style="font-size:6.5pt; font-weight:800; color:#991b1b; margin-top:3px; font-family:sans-serif;">
                CODE : <span contenteditable="true" style="color:#000; font-weight:900;">${rollCode}</span>
              </div>
            </div>

            <!-- Titles -->
            <div style="flex:1; text-align:center; padding:0 4px;">
              <div style="font-size:15pt; font-weight:900; color:#991b1b; letter-spacing:0.5px; line-height:1;">
                TAPOWAN PUBLIC SCHOOL
              </div>
              <div style="font-size:9.5pt; font-weight:900; color:#991b1b; letter-spacing:1px; margin-top:1px;">
                RAMGARH, JHARKHAND
              </div>
              <div style="font-size:8.5pt; font-weight:900; color:#991b1b; letter-spacing:0.5px; margin-top:2px; text-transform:uppercase;">
                ${examName || 'ANNUAL SECONDARY EXAMINATION - 2026'}
              </div>
              <div style="font-size:9.5pt; font-weight:900; color:#000000; letter-spacing:1px; margin-top:1px; text-transform:uppercase;">
                ADMISSION CARD / ADMIT CARD
              </div>
            </div>

            <!-- Photo Box -->
            <div style="width:20mm; height:24mm; border:1.2px solid #991b1b; background:#ffffff; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;">
              ${student.photo ? `<img src="${student.photo}" style="width:100%; height:100%; object-fit:contain;" />` : `
                <div style="text-align:center; font-size:5.5pt; font-weight:800; color:#991b1b; padding:2px; line-height:1.2; font-family:sans-serif;">
                  AFFIX<br>PASSPORT<br>PHOTO
                </div>
              `}
            </div>
          </div>

          <!-- Student Details Grid -->
          <table style="width:100%; border-collapse:collapse; border:1.2px solid #991b1b; font-size:8pt; margin:3px 0 4px 0; background:rgba(255,255,255,0.8);">
            <tr>
              <td style="border:1px solid #fca5a5; padding:2px 4px; width:18%; font-weight:800; color:#991b1b; font-size:7pt;">CANDIDATE NAME</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:900; color:#000; text-transform:uppercase;" colspan="3">${candidateName}</td>
              <td style="border:1px solid #fca5a5; padding:2px 4px; width:15%; font-weight:800; color:#991b1b; font-size:7pt;">ROLL NO.</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; width:15%; font-weight:900; color:#991b1b; font-size:9pt; font-family:sans-serif;">${rollNo}</td>
            </tr>
            <tr>
              <td style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#991b1b; font-size:7pt;">FATHER'S NAME</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#000; text-transform:uppercase;">${fatherName}</td>
              <td style="border:1px solid #fca5a5; padding:2px 4px; width:15%; font-weight:800; color:#991b1b; font-size:7pt;">MOTHER'S NAME</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#000; text-transform:uppercase;">${motherName}</td>
              <td style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#991b1b; font-size:7pt;">CLASS & SEC</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:900; color:#991b1b;">${className}</td>
            </tr>
            <tr>
              <td style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#991b1b; font-size:7pt;">SCHOOL / INST.</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#000;" colspan="3">${schoolName}</td>
              <td style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#991b1b; font-size:7pt;">REGN. NO.</td>
              <td contenteditable="true" style="border:1px solid #fca5a5; padding:2px 4px; font-weight:800; color:#000; font-size:7pt;">${regNo}</td>
            </tr>
          </table>

          <!-- Examination Schedule Table -->
          <table style="width:100%; border-collapse:collapse; border:1.2px solid #991b1b; background:#ffffff;">
            <thead>
              <tr style="background:linear-gradient(180deg, #fee2e2 0%, #fecaca 100%); color:#991b1b; font-size:7.5pt; font-weight:900;">
                <th style="width:8%; border:1px solid #991b1b; padding:2px; text-align:center;">CODE</th>
                <th style="width:36%; border:1px solid #991b1b; padding:2px 4px; text-align:left;">SUBJECT NAME</th>
                <th style="width:16%; border:1px solid #991b1b; padding:2px; text-align:center;">EXAM DATE</th>
                <th style="width:14%; border:1px solid #991b1b; padding:2px; text-align:center;">DAY</th>
                <th style="width:18%; border:1px solid #991b1b; padding:2px; text-align:center;">TIMING</th>
                <th style="width:8%; border:1px solid #991b1b; padding:2px; text-align:center;">INV. SIGN</th>
              </tr>
            </thead>
            <tbody>
              ${schedRows}
            </tbody>
          </table>
        </div>

        <!-- Footer Signatures -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:4px 6px 1px 6px; border-top:1px solid #991b1b; margin-top:3px; position:relative; z-index:1;">
          <div style="text-align:center; width:28mm;">
            <div style="border-top:1px solid #000; width:100%; margin-bottom:1px;"></div>
            <div style="font-size:6.5pt; font-weight:800; color:#000;">Candidate Signature</div>
          </div>
          <div style="text-align:center; width:28mm;">
            <div style="border-top:1px solid #000; width:100%; margin-bottom:1px;"></div>
            <div style="font-size:6.5pt; font-weight:800; color:#000;">Centre Supdt.</div>
          </div>
          <div style="text-align:center; width:30mm;">
            <div style="font-family:'Brush Script MT', cursive; font-size:12pt; color:#991b1b; line-height:1; transform:rotate(-4deg);">Aatif Raza</div>
            <div style="border-top:1px solid #991b1b; width:100%; margin-bottom:1px;"></div>
            <div style="font-size:6.5pt; font-weight:900; color:#991b1b;">Secretary / Principal</div>
          </div>
        </div>

      </div>
    `;
  }

  // =========================================================================
  // 🏛️ JAC BOARD CLASS 10 STYLE MARKS STATEMENT (AUTHENTIC RESULT TEMPLATE)
  // =========================================================================
  function getJacBoardResultHtml(exam, config) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const schoolName = store.schoolProfile && store.schoolProfile.schoolName ? store.schoolProfile.schoolName : "TAPOWAN PUBLIC SCHOOL, RAMGARH";
    const logoSrc = DEFAULT_SCHOOL_LOGO;
    const qrSrc = 'qr.png';
    const msNo = (exam.rollNo ? String(190000 + parseInt(exam.rollNo, 10)) : '191864');
    const rollCode = '27019';
    const rollNo = (exam.rollNo || '0001').toString().padStart(5, '0');
    const regNo = exam.admissionNo || '27019-RA-0050-22';
    const candidateName = (exam.studentName || 'STUDENT NAME').toUpperCase();
    const fatherName = formatParentName(exam.fatherName || '---').toUpperCase();
    const motherName = formatParentName(exam.motherName || '---').toUpperCase();
    
    let rawSubs = [];
    if (typeof exam.subjectMarks === 'string') {
      try { rawSubs = JSON.parse(exam.subjectMarks); } catch(e) {}
    } else if (Array.isArray(exam.subjectMarks)) {
      rawSubs = exam.subjectMarks;
    }
    if (!Array.isArray(rawSubs)) rawSubs = [];

    const evalStatus = evalStudentResultStatus(rawSubs, exam.className, exam.examName);
    const hasExplicitPassOrFail = (exam.resultStatus === 'PASS' || exam.resultStatus === 'FAIL');
    const isPending = !hasExplicitPassOrFail && (evalStatus.isPending || (evalStatus.resultStatus === 'PENDING') || (exam.resultStatus === 'PENDING'));
    const completeSubs = prepareCompleteMarksheetSubjects(rawSubs, exam.className, false, false, exam.examName);
    const subs = completeSubs.length > 0 ? completeSubs : rawSubs;

    let grandTotal = 0;
    let maxAggregate = 0;

    // Group into JAC categories
    const rowsHtml = subs.map((sub, idx) => {
      const max = parseFloat(sub.max) || 100;
      const pass = parseFloat(sub.min) || 33;
      const isPendingRow = sub.isPending === true;
      const th = isPendingRow ? '-' : (sub.theory !== undefined && sub.theory !== '' ? sub.theory : (sub.subjective || ''));
      const pr = isPendingRow ? '-' : (sub.practical !== undefined && sub.practical !== '' ? sub.practical : '');
      const cce = isPendingRow ? '-' : (sub.cce || sub.notebook || sub.pa1 || '');
      const tot = isPendingRow ? '<span style="color:#94a3b8; font-style:italic;">Pending</span>' : (sub.total !== undefined && sub.total !== '' ? parseFloat(sub.total) : ((parseFloat(th)||0) + (parseFloat(pr)||0)));
      if (!isPendingRow) {
        grandTotal += (parseFloat(sub.total) || 0);
      }
      maxAggregate += max;

      let catLabel = '';
      if (idx === 0) catLabel = '<div style="font-size:7.5pt; font-weight:800; color:#991b1b; padding:2px 0 1px 0; letter-spacing:0.5px;">01. COMPULSORY CORE LANGUAGE :</div>';
      else if (idx === 1) catLabel = '<div style="font-size:7.5pt; font-weight:800; color:#991b1b; padding:3px 0 1px 0; letter-spacing:0.5px;">02. COMPULSORY / ELECTIVE :</div>';
      else if (idx === 2) catLabel = '<div style="font-size:7.5pt; font-weight:800; color:#991b1b; padding:3px 0 1px 0; letter-spacing:0.5px;">03. OPTIONAL :</div>';
      else if (idx === 5) catLabel = '<div style="font-size:7.5pt; font-weight:800; color:#991b1b; padding:3px 0 1px 0; letter-spacing:0.5px;">04. ADDITIONAL :</div>';

      return `
        ${catLabel ? `<tr><td colspan="7" style="border-left:1px solid #b91c1c; border-right:1px solid #b91c1c; border-bottom:none; border-top:1px dashed #fca5a5; padding:2px 6px; background:rgba(254,242,242,0.4);">${catLabel}</td></tr>` : ''}
        <tr style="height:23px; font-size:8.5pt;">
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; padding:3px 8px; font-weight:800; color:#0f2b5c; text-transform:uppercase; letter-spacing:0.5px;">${sub.subject}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:700; color:#334155;">${max}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:700; color:#334155;">${String(pass).padStart(3, '0')}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:800; color:#0f172a;">${th ? (isPendingRow ? '-' : String(th).padStart(3, '0')) : ''}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:800; color:#0f172a;">${pr ? (isPendingRow ? '-' : String(pr).padStart(3, '0')) : ''}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:800; color:#0f172a;">${cce ? (isPendingRow ? '-' : String(cce).padStart(3, '0')) : ''}</td>
          <td contenteditable="true" style="border:1px solid #b91c1c; border-top:none; border-bottom:1px solid #fecaca; text-align:center; font-weight:900; color:#991b1b; background:rgba(254,242,242,0.3); font-size:9pt;">${tot ? (isPendingRow ? tot : String(tot).padStart(3, '0')) : ''}</td>
        </tr>
      `;
    }).join('');

    const effectiveMaxAggregate = Math.max(maxAggregate, evalStatus.overallStats.maxTotal || 800);
    const pct = isPending ? `${evalStatus.overallStats.percentage}` : (effectiveMaxAggregate > 0 ? ((grandTotal / effectiveMaxAggregate) * 100).toFixed(2) : (exam.percentage || '0.00'));
    const division = isPending ? 'PENDING (INCOMPLETE / अपूर्ण)' : (parseFloat(pct) >= 60 ? '1ST DIVISION' : (parseFloat(pct) >= 45 ? '2ND DIVISION' : (parseFloat(pct) >= 33 ? '3RD DIVISION' : 'FAILED / NEEDS IMPROVEMENT')));
    const marksInWords = numberToWordsEnglish(grandTotal);

    return `
      <!-- JAC BOARD AUTHENTIC CERTIFICATE WITH MICRO-TEXT SECURITY PATTERN -->
      <div style="width:100%; height:277mm; min-height:277mm; max-height:277mm; box-sizing:border-box; border:3px double #991b1b; padding:6mm 8mm 6mm 8mm; display:flex; flex-direction:column; justify-content:space-between; background-color:#ffffff; background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='36' viewBox='0 0 180 36'><text x='0' y='12' font-family='sans-serif' font-size='5' font-weight='800' fill='rgba(153,27,27,0.045)' letter-spacing='0.5'>TAPOWAN PUBLIC SCHOOL</text><text x='20' y='28' font-family='sans-serif' font-size='5' font-weight='800' fill='rgba(153,27,27,0.045)' letter-spacing='0.5'>TAPOWAN PUBLIC SCHOOL</text></svg>&quot;); background-repeat:repeat; font-family:'Times New Roman', Times, serif; color:#000000; position:relative; overflow:hidden;">
        
        <!-- Central Giant Emblem Watermark -->
        <img src="${logoSrc}" style="position:absolute; top:52%; left:50%; transform:translate(-50%,-50%); width:320px; height:320px; object-fit:contain; opacity:0.06; pointer-events:none; z-index:0;" alt="" onerror="this.style.display='none';" />

        <!-- Top Header Container -->
        <div style="position:relative; z-index:1;">
          
          <!-- Header Row with Logo, Titles & Photo -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <!-- Council / School Crest Emblem -->
            <div style="width:28mm; display:flex; flex-direction:column; align-items:flex-start;">
              <div style="width:23mm; height:23mm; border-radius:50%; border:1.5px solid #991b1b; padding:2px; background:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(153,27,27,0.15);">
                <img src="${logoSrc}" style="max-width:20mm; max-height:20mm; object-fit:contain;" alt="Logo" onerror="this.src='school_logo.png'" />
              </div>
              <div style="font-size:7.5pt; font-weight:800; color:#991b1b; margin-top:5px; font-family:sans-serif;">
                M. S. No. : <span contenteditable="true" style="color:#000000; font-weight:900;">${msNo}</span>
              </div>
            </div>

            <!-- Main Council Titles -->
            <div style="flex:1; text-align:center; padding:0 8px;">
              <div style="font-size:20pt; font-weight:900; color:#991b1b; letter-spacing:1px; line-height:1; text-shadow:0 1px 1px rgba(153,27,27,0.1);">
                TAPOWAN PUBLIC SCHOOL
              </div>
              <div style="font-size:13pt; font-weight:900; color:#991b1b; letter-spacing:2px; margin-top:2px;">
                RAMGARH, JHARKHAND
              </div>
              <div style="font-size:10.5pt; font-weight:900; color:#991b1b; letter-spacing:1px; margin-top:3px; text-transform:uppercase;">
                ${exam.examName || 'ANNUAL SECONDARY EXAMINATION - 2026'}
              </div>
              <div style="font-size:12pt; font-weight:900; color:#000000; letter-spacing:1.5px; margin-top:3px; text-transform:uppercase; text-decoration:none;">
                MARKS STATEMENT
              </div>
            </div>

            <!-- Candidate Photo Box -->
            <div style="width:26mm; height:32mm; border:1.5px solid #991b1b; background:#ffffff; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
              ${exam.studentPhoto ? `<img src="${exam.studentPhoto}" style="width:100%; height:100%; object-fit:contain;" />` : `
                <div style="text-align:center; font-size:6pt; font-weight:800; color:#991b1b; padding:4px; line-height:1.2; font-family:sans-serif;">
                  AFFIX<br>PASSPORT<br>PHOTO
                </div>
              `}
            </div>
          </div>

          <!-- Student Dossier Narrative -->
          <div style="border-top:1.5px solid #991b1b; border-bottom:1.5px solid #991b1b; padding:5px 6px; margin-bottom:8px; font-size:9.5pt; line-height:1.45; background:rgba(255,255,255,0.75);">
            <div>
              The following are the marks obtained by <strong contenteditable="true" style="font-size:11pt; color:#000000; letter-spacing:0.5px; text-decoration:underline;">${candidateName}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:2px;">
              <div>School / Institution : <strong contenteditable="true" style="color:#000000;">${schoolName}</strong></div>
              <div>Class & Sec : <strong contenteditable="true" style="color:#991b1b;">${exam.className || 'X-A'}</strong></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:3px; font-size:9pt; border-top:1px dashed #fca5a5; padding-top:3px;">
              <div>Roll Code : <strong contenteditable="true" style="font-family:sans-serif; color:#000000;">${rollCode}</strong></div>
              <div>Roll No. : <strong contenteditable="true" style="font-family:sans-serif; color:#991b1b; font-size:10.5pt;">${rollNo}</strong></div>
              <div>Registration No. : <strong contenteditable="true" style="font-family:sans-serif; color:#000000;">${regNo}</strong></div>
              <div>Session : <strong contenteditable="true" style="font-family:sans-serif; color:#000000;">${exam.session || '2025-2026'}</strong></div>
            </div>
          </div>

          <!-- JAC Style Main Marks Table & QR/Result Split Layout -->
          <div style="display:flex; gap:0; border:2px solid #991b1b; background:#ffffff; box-shadow:0 2px 6px rgba(153,27,27,0.08);">
            
            <!-- Left Table (Subjects & Marks) -->
            <table style="flex:1; border-collapse:collapse; font-size:8.5pt;">
              <thead>
                <tr style="background:linear-gradient(180deg, #fff1f2 0%, #fee2e2 100%); color:#991b1b; border-bottom:1.5px solid #991b1b;">
                  <th rowspan="2" style="width:34%; border:1px solid #b91c1c; padding:4px 6px; text-align:center; font-size:8pt; font-weight:900; letter-spacing:0.5px;">SUBJECT NAME</th>
                  <th rowspan="2" style="width:9%; border:1px solid #b91c1c; padding:4px 2px; text-align:center; font-size:7.5pt; font-weight:900;">Full<br>Marks</th>
                  <th rowspan="2" style="width:9%; border:1px solid #b91c1c; padding:4px 2px; text-align:center; font-size:7.5pt; font-weight:900;">Pass<br>Marks</th>
                  <th colspan="4" style="border:1px solid #b91c1c; padding:3px 2px; text-align:center; font-size:8pt; font-weight:900; letter-spacing:0.5px;">MARKS OBTAINED</th>
                </tr>
                <tr style="background:linear-gradient(180deg, #fee2e2 0%, #fecaca 100%); color:#991b1b; border-bottom:1.5px solid #991b1b;">
                  <th style="width:11%; border:1px solid #b91c1c; padding:2px; text-align:center; font-size:7pt; font-weight:900;">Theory</th>
                  <th style="width:11%; border:1px solid #b91c1c; padding:2px; text-align:center; font-size:7pt; font-weight:900;">Practical</th>
                  <th style="width:11%; border:1px solid #b91c1c; padding:2px; text-align:center; font-size:7pt; font-weight:900;">CCE / Int</th>
                  <th style="width:15%; border:1px solid #b91c1c; padding:2px; text-align:center; font-size:7.5pt; font-weight:900; background:rgba(153,27,27,0.15);">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <!-- Right Column Box: QR Code & Official Result Box -->
            <div style="width:34mm; border-left:2px solid #991b1b; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:8px 6px; background:linear-gradient(180deg, #fffdf5 0%, #fff1f2 100%); box-sizing:border-box;">
              
              <div style="text-align:center; width:100%;">
                <div style="font-size:8pt; font-weight:900; color:#991b1b; border-bottom:1px solid #fca5a5; padding-bottom:3px; margin-bottom:6px; letter-spacing:0.5px;">
                  RESULT / परिणाम
                </div>
                <div style="width:24mm; height:24mm; border:1px solid #b91c1c; padding:2px; background:#ffffff; margin:0 auto; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                  <img src="${qrSrc}" style="width:100%; height:100%; object-fit:contain;" alt="QR Code" onerror="this.style.display='none';" />
                </div>
              </div>

              <div style="text-align:center; width:100%; border-top:1px solid #fca5a5; padding-top:6px;">
                <div style="font-size:6.5pt; font-weight:800; color:#64748b; text-transform:uppercase; font-family:sans-serif;">FINAL DIVISION</div>
                <div contenteditable="true" style="font-size:11pt; font-weight:900; color:#991b1b; letter-spacing:0.5px; margin-top:2px;">
                  ${division}
                </div>
                <div contenteditable="true" style="font-size:8pt; font-weight:800; color:#15803d; margin-top:1px;">
                  ★ ${exam.resultStatus || 'PASSED'} ★
                </div>
              </div>

            </div>

          </div>

          <!-- Aggregate Summary Bar (Exact JAC Style) -->
          <div style="border:2px solid #991b1b; border-top:none; display:flex; align-items:stretch; background:linear-gradient(180deg, #fff1f2 0%, #fee2e2 100%); font-size:8.5pt;">
            <div style="padding:5px 8px; font-weight:900; color:#991b1b; width:22%; border-right:1px solid #b91c1c; font-family:sans-serif; font-size:7.5pt;">
              Aggregate Marks ${maxAggregate}:
            </div>
            <div contenteditable="true" style="padding:5px 8px; font-weight:900; color:#000000; flex:1; text-transform:uppercase; letter-spacing:0.5px; font-size:8pt; border-right:1px solid #b91c1c;">
              ${marksInWords}
            </div>
            <div contenteditable="true" style="padding:5px 8px; font-weight:900; color:#991b1b; width:14%; text-align:center; font-size:11pt; font-family:sans-serif; border-right:2px solid #991b1b; background:#ffffff;">
              ${grandTotal}
            </div>
            <div contenteditable="true" style="padding:5px 8px; font-weight:900; color:#991b1b; width:34mm; text-align:center; font-size:9pt;">
              ${division}
            </div>
          </div>

        </div>

        <!-- Bottom Signatures & Seal (Spacious Signing Zone) -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:12px 10px 4px 10px; position:relative; z-index:1; border-top:1.5px solid #991b1b; margin-top:auto;">
          
          <!-- Issue Date & Location -->
          <div style="font-size:9pt; font-weight:800; color:#000000;">
            Ramgarh, Dated : <strong contenteditable="true" style="color:#991b1b;">April 30, 2026</strong>
          </div>

          <!-- Verification Seal Space -->
          <div style="width:40px; height:40px;"></div>

          <!-- Secretary / Principal Signature -->
          <div style="text-align:center; width:38mm; display:flex; flex-direction:column; align-items:center;">
            <div style="height:32px; width:100%; display:flex; align-items:center; justify-content:center; font-family:'Brush Script MT', cursive, sans-serif; font-size:16pt; color:#991b1b; transform:rotate(-4deg);">
              Aatif Raza
            </div>
            <div style="border-top:1.5px solid #991b1b; width:100%; margin-bottom:3px;"></div>
            <div style="font-size:8pt; font-weight:900; color:#991b1b;">
              Secretary / Principal
            </div>
          </div>

        </div>

      </div>
    `;
  }
  
  // --- JAC 12th Admit Card Template ---
  function getJac12AdmitCardHtml(student, examName, config) {
      const store = typeof getStore !== 'undefined' ? getStore() : {};
      const schoolName = store.schoolProfile ? store.schoolProfile.schoolName : "JHARKHAND ACADEMIC COUNCIL, RANCHI"; 
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || DEFAULT_SCHOOL_LOGO;
      
      const c = config || { color: '#000000', font: "'Times New Roman', serif", border: 'solid', bgOpacity: 1 };
      const fontColorStyle = c.fontColor ? `color: ${c.fontColor};` : 'color: #000;';
      
      let groupedDates = {};
      const subjects = getSubjectsForClass(student.className);
      subjects.forEach(sub => {
          // Format date input if present. e.g. "2026-05-02" to "02.05.2026"
          let rawDate = (config.subjectDates && config.subjectDates[sub]) ? config.subjectDates[sub] : "";
          let dt = rawDate;
          if (rawDate && rawDate.includes('-')) {
              const parts = rawDate.split('-');
              if (parts.length === 3) dt = `${parts[2]}.${parts[1]}.${parts[0]}`;
          }
          const key = dt || 'TBD';
          if (!groupedDates[key]) groupedDates[key] = [];
          
          let shortName = sub.split(' ')[0].toUpperCase();
          if (shortName.length > 5) shortName = shortName.substring(0, 5);
          groupedDates[key].push(shortName);
      });
      
      let dateKeys = Object.keys(groupedDates);
      let subjectColsHtml = '';
      dateKeys.forEach((dt, idx) => {
          let subs = groupedDates[dt];
          let subString = subs.join('/');
          
          subjectColsHtml += `
          <td style="border: 1px solid #000; text-align: center; padding: 4px; vertical-align: top; width: ${100/(dateKeys.length+2)}%;">
              <div style="font-size: 9px; font-weight: bold;">PAPER ${idx + 1}</div>
              <div style="font-size: 11px; font-weight: bold; margin: 8px 0;">${subString}</div>
              <div style="font-size: 9px; font-weight: bold;">${dt}</div>
          </td>`;
      });
      
      const admCardNo = 'A' + new Date().getFullYear() + String(student.id || Math.floor(Math.random()*10000)).padStart(4, '0');
      
      return `
      <div style="width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; color: #000; ${fontColorStyle} font-family: ${c.font}; background: transparent; padding: 10px;">
          
          <div style="display: flex; align-items: center; justify-content: center; text-align: center; margin-bottom: 5px; position: relative;">
              <div style="width: 60px; height: 60px; position: absolute; left: 0;">
                  <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
              <div>
                  <h2 style="margin: 0; font-size: 18px; font-weight: 900;">${schoolName.toUpperCase()}</h2>
                  <h3 style="margin: 2px 0 0 0; font-size: 13px; font-weight: 600;">${examName.toUpperCase()}</h3>
                  <h4 style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold;">ADMISSION CARD</h4>
                  <div style="margin-top: 2px; font-size: 12px; font-weight: bold;">Class ${student.className}</div>
              </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 11px; margin-bottom: 0;">
              <tr>
                  <td style="border: 1px solid #000; padding: 4px; vertical-align: top; width: 25%;">
                      <div style="font-size: 8px;">ADM NO.</div>
                      <div style="font-weight: bold; margin-top: 4px; text-align: center;">${student.admissionNo || '-'}</div>
                  </td>
                  <td style="border: 1px solid #000; padding: 4px; vertical-align: top; width: 25%;">
                      <div style="font-size: 8px;">ROLL NO</div>
                      <div style="font-weight: bold; margin-top: 4px; text-align: center;">${student.rollNo || '-'}</div>
                  </td>
                  <td style="border: 1px solid #000; padding: 4px; vertical-align: top; width: 30%;">
                      <div style="font-size: 8px;">ADMISSION CARD NO</div>
                      <div style="font-weight: bold; margin-top: 4px; text-align: center;">${admCardNo}</div>
                  </td>
                  <td rowspan="5" style="border: 1px solid #000; padding: 5px; width: 20%; text-align: center; vertical-align: middle;">
                      <img src="${photoUrl}" style="width: 80px; height: 100px; border: 1px solid #000; object-fit: contain; background: #ffffff;" />
                  </td>
              </tr>
              <tr>
                  <td colspan="3" style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">NAME OF THE COLLEGE/SCHOOL</div>
                      <div style="font-weight: bold; margin-top: 2px;">${schoolName.toUpperCase()}</div>
                  </td>
              </tr>
              <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">NAME OF CANDIDATE</div>
                      <div style="font-weight: bold; margin-top: 2px;">${(student.fullName || '-').toUpperCase()}</div>
                  </td>
                  <td style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">CATEGORY</div>
                      <div style="font-weight: bold; margin-top: 2px;">REGULAR</div>
                  </td>
              </tr>
              <tr>
                  <td colspan="2" style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">NAME OF MOTHER</div>
                      <div style="font-weight: bold; margin-top: 2px;">${(student.motherName || '-').toUpperCase()}</div>
                  </td>
                  <td style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">UID NO OF CANDIDATE</div>
                      <div style="font-weight: bold; margin-top: 2px;">${student.phone || student.admissionNo || '-'}</div>
                  </td>
              </tr>
              <tr>
                  <td colspan="3" style="border: 1px solid #000; padding: 4px; vertical-align: top;">
                      <div style="font-size: 8px;">NAME OF FATHER / HUSBAND</div>
                      <div style="font-weight: bold; margin-top: 2px;">${(formatParentName(student.fatherName)).toUpperCase()}</div>
                  </td>
              </tr>
          </table>
          
          <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; font-size: 11px;">
              <tr>
                  <td style="border: 1px solid #000; padding: 4px; width: 15%; vertical-align: middle;">
                      <div style="font-size: 8px; text-align: center; margin-bottom: 10px;">SUBJECTS<br>OFFERED</div>
                      <div style="font-size: 8px; text-align: center;">DATE OF<br>EXAMINATION</div>
                  </td>
                  ${subjectColsHtml}
                  <td style="border: 1px solid #000; width: 15%; text-align: center; vertical-align: middle; padding: 5px;">
                      <img src="qr.png" style="width: 50px; height: 50px; opacity: 0.8;" />
                  </td>
              </tr>
          </table>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding: 0 10px;">
              <div style="text-align: center;">
                  <div style="border-top: 1px solid #000; width: 150px; padding-top: 5px; font-weight: bold; font-size: 11px;">Signature of the Principal</div>
              </div>
              <div style="text-align: center;">
                  <div style="border-top: 1px solid #000; width: 150px; padding-top: 5px; font-weight: bold; font-size: 11px;">Controller of Examinations</div>
              </div>
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
      template = template.replace(/{fatherName}/g, formatParentName(student.fatherName));
      template = template.replace(/{motherName}/g, student.motherName || '-');
      template = template.replace(/{examName}/g, examName || '-');
      
      const schoolName = store.schoolProfile ? store.schoolProfile.schoolName : "Tapowan Public School";
      template = template.replace(/{schoolName}/g, schoolName);
      
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || DEFAULT_SCHOOL_LOGO;
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
  function buildScheduleTableHtml(student, config, tableColor, borderCss) {
      if (!config || !config.subjectDates || Object.keys(config.subjectDates).length === 0) return '';
      const subjects = getSubjectsForClass(student.className);
      let groupedDates = {};
      let hasDates = false;

      subjects.forEach(sub => {
          let rawDate = config.subjectDates[sub];
          if (rawDate) {
              hasDates = true;
              let dt = rawDate;
              if (rawDate.includes('-')) {
                  const parts = rawDate.split('-');
                  if (parts.length === 3) dt = `${parts[2]}.${parts[1]}.${parts[0]}`;
              }
              if (!groupedDates[dt]) groupedDates[dt] = [];
              let shortName = sub.split(' ')[0].toUpperCase();
              if (shortName.length > 5) shortName = shortName.substring(0, 5);
              groupedDates[dt].push(shortName);
          }
      });

      if (!hasDates) return '';

      let dateKeys = Object.keys(groupedDates);
      let subjectColsHtml = '';
      dateKeys.forEach((dt, idx) => {
          let subs = groupedDates[dt];
          let subString = subs.join('/');
          subjectColsHtml += `
          <td style="border: ${borderCss}; text-align: center; padding: 4px; vertical-align: top; width: ${100/(dateKeys.length+1)}%;">
              <div style="font-size: 11px; font-weight: bold; color: inherit;">PAPER ${idx + 1}</div>
              <div style="font-size: 13px; font-weight: 900; margin: 8px 0; color: ${tableColor};">${subString}</div>
              <div style="font-size: 12px; font-weight: bold; color: inherit;">${dt}</div>
          </td>`;
      });

      return `
        <div style="margin-top: 15px;">
            <div style="text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 5px; color: ${tableColor}; text-decoration: underline;">EXAM SCHEDULE</div>
            <table style="width: 100%; border-collapse: collapse; border: ${borderCss}; color: inherit;">
              <tr>
                  <td style="border: ${borderCss}; padding: 4px; width: 15%; vertical-align: middle; background: ${tableColor}11;">
                      <div style="font-size: 11px; text-align: center; margin-bottom: 10px; font-weight: bold; color: inherit;">SUBJECTS<br>OFFERED</div>
                      <div style="font-size: 11px; text-align: center; font-weight: bold; color: inherit;">DATE OF<br>EXAMINATION</div>
                  </td>
                  ${subjectColsHtml}
              </tr>
            </table>
        </div>
      `;
  }

  function getPrimaryAdmitCardHtml(student, examName, config) {
      const c = config || { color: '#3b82f6', font: "'Inter', sans-serif", border: 'solid' };
      const borderCss = c.border === 'none' ? 'none' : `4px ${c.border} ${c.color}`;
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; background: transparent; border: ${borderCss}; font-family: ${c.font}; border-radius: 20px; padding: 20px; position: relative; overflow: hidden; page-break-inside: avoid; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
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
                       <tr><td style="padding: 8px;">Father's Name:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${formatParentName(student.fatherName)}</td></tr>
                       <tr><td style="padding: 8px;">Class & Sec:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${student.className}</td></tr>
                       <tr><td style="padding: 8px;">Roll No:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1; color: inherit; font-size: 18px; font-weight: 800;" contenteditable="true">${student.rollNo || '-'}</td></tr>
                       <tr><td style="padding: 8px;">Admission No:</td><td style="padding: 8px; border-bottom: 2px solid #cbd5e1;" contenteditable="true">${admNo}</td></tr>
                   </table>
               </div>
               <div style="width: 120px; text-align:center;">
                   <img src="${photoUrl}" style="width: 110px; height: 130px; object-fit: contain; background: #ffffff; border: 3px solid ${c.color}; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />
               </div>
           </div>
           
           ${buildScheduleTableHtml(student, config, c.color, `1px solid ${c.color}`)}

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
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: ${borderCss}; font-family: ${c.font}; padding: 20px; background: transparent; page-break-inside: avoid; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <div style="text-align:center; border-bottom: 2px solid ${c.color}; padding-bottom: 15px; margin-bottom: 20px;">
                <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 60px; height: 60px; margin-bottom: 5px; display:inline-block;" /><br/>\n                 <h2 style="margin:0; color: ${c.color}; font-size: 24px; font-family: serif; text-transform: uppercase; display:inline-block;">Tapowan Public School</h2>
                <h3 style="margin:10px 0 0 0; color: inherit; font-size: 18px; text-decoration: underline;">ADMIT CARD - <span contenteditable="true">${examName}</span></h3>
            </div>
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <table style="width:100%; border-collapse:collapse; font-size: 15px; color: inherit; ">
                        <tr><td style="padding: 10px; font-weight:700; width: 150px;">Candidate Name:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b; font-weight: bold; text-transform: uppercase;" contenteditable="true">${student.fullName}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Father's Name:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${formatParentName(student.fatherName)}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Class / Section:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${student.className}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Roll Number:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b; font-weight: bold;" contenteditable="true">${student.rollNo || '-'}</td></tr>
                        <tr><td style="padding: 10px; font-weight:700;">Admission No:</td><td style="padding: 10px; border-bottom: 1px dotted #64748b;" contenteditable="true">${admNo}</td></tr>
                    </table>
                </div>
                <div style="width: 120px; text-align:center;">
                    <img src="${photoUrl}" style="width: 110px; height: 135px; object-fit: contain; background: #ffffff; border: 1px solid #1e293b;" />
                </div>
            </div>
            
            ${buildScheduleTableHtml(student, config, '#333333', '1px solid #cbd5e1')}

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
      const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
      const admNo = student.admissionNo || '-';
      
      return `
        <div style="width: 100%; height: 100%; box-sizing: border-box; border: ${borderCss}; font-family: ${c.font}; padding: 15px; background: transparent; page-break-inside: avoid; font-family: 'Times New Roman', Times, serif; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
            <div style="padding: 10px; position: relative; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="text-align:center; padding-bottom: 5px; margin-bottom: 10px;">
                    <img src="${DEFAULT_SCHOOL_LOGO}" style="width: 50px; height: 50px; margin-bottom: 3px; display:inline-block;" /><br/>
                     <h1 style="margin:0; color: inherit; font-size: 20px; text-transform: uppercase; display:inline-block;">Tapowan Public School</h1>
                    <div style="margin-top:10px; display:block; width:100%; box-sizing:border-box; background: ${c.color}; color: ${c.fontColor || '#fff'}; padding:5px 15px; font-weight:bold; font-size:14px; text-align:center;">
                        ADMIT CARD - ${examName.toUpperCase()}
                    </div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <div style="flex: 1;">
                        <table style="width:100%; border-collapse:collapse; font-size: 13px; color: inherit; ">
                            <tr><td style="padding: 4px; font-weight:bold; width: 140px;">Roll No.</td><td style="padding: 4px;">: <span style="font-weight:bold; font-size:15px;">${student.rollNo || '-'}</span></td></tr>
                            <tr><td style="padding: 4px; font-weight:bold;">Admission No.</td><td style="padding: 4px;">: ${admNo}</td></tr>
                            <tr><td style="padding: 4px; font-weight:bold;">Candidate's Name</td><td style="padding: 4px;">: <span style="text-transform:uppercase; font-weight:bold;">${student.fullName}</span></td></tr>
                            <tr><td style="padding: 4px; font-weight:bold;">Father's Name</td><td style="padding: 4px;">: ${formatParentName(student.fatherName)}</td></tr>
                            <tr><td style="padding: 4px; font-weight:bold;">Class</td><td style="padding: 4px;">: ${student.className}</td></tr>
                        </table>
                    </div>
                    <div style="width: 90px; text-align:center;">
                        <img src="${photoUrl}" style="width: 80px; height: 100px; object-fit: contain; background: #ffffff; border: 1px solid ${c.color};" />
                    </div>
                </div>
                
                ${buildScheduleTableHtml(student, config, c.color, `1px solid ${c.color}`)}

                <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align:center; width: 140px;">
                        <div style="border-bottom: 1px solid ${c.color}; height: 30px;"></div>
                        <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold;">Signature of Class Teacher</p>
                    </div>
                    <div style="text-align:center; width: 140px;">
                        <div style="border-bottom: 1px solid ${c.color}; height: 30px;"></div>
                        <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold;">Signature of Principal</p>
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
      
      let customSubs = [];
      try {
        customSubs = typeof exam.subjectMarks === 'string' ? JSON.parse(exam.subjectMarks) : (exam.subjectMarks || []);
      } catch(e) {}
      if (!Array.isArray(customSubs)) customSubs = [];
      const touchedSubs = getTouchedSubjectsForClass(exam.className, exam.examName, customSubs);
      const hasAnyClassmateTouched = touchedSubs.size > 0;
      const displayCustomSubs = customSubs.filter(m => {
        if (!m || !m.subject) return false;
        const normKey = (canonicalSubjectName(m.subject) || String(m.subject).trim()).toLowerCase();
        const hasMarks = (m.total !== undefined && m.total !== '' && m.total !== '-') ||
                         (m.theory !== undefined && m.theory !== '' && m.theory !== '-') ||
                         m.isAbsent === true || String(m.total).toUpperCase() === 'AB';
        if (hasMarks) return true;
        return !hasAnyClassmateTouched || touchedSubs.has(normKey);
      });

      // Smart Row Duplication for customized standard templates
      // If the user loaded a standard template into the designer, it will have a row with {subject}
      const rowMatch = template.match(/<tr[^>]*>[\s\S]*?{subject}[\s\S]*?<\/tr>/i);
      if (rowMatch) {
          const rowTemplate = rowMatch[0];
          let generatedRows = '';
          displayCustomSubs.forEach(m => {
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
          displayCustomSubs.forEach(m => {
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
      
      const photoUrl = getStudentPhotoUri(exam, exam.admissionNo || exam.admNo) || DEFAULT_SCHOOL_LOGO;
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
    const c = config || { color: '#0f172a', font: "'Times New Roman', serif", border: 'solid', bgColor: '#ffffff', bgType: 'solid', bgImage: 'none' };
    const fontColorStyle = c.fontColor ? `color: ${c.fontColor} !important;` : '';
    const bgStyle = c.bgImage && c.bgImage !== 'none' ? `background-image: url('${c.bgImage}'); background-size: cover; background-position: center;` : (c.bgType === 'gradient' ? `background: linear-gradient(135deg, ${c.bgColor}, ${c.bgColor2});` : `background-color: ${c.bgColor};`);

    const watermarkText = encodeURIComponent(schoolName);
    const watermarkSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><text x='50%' y='50%' transform='rotate(-35 150 150)' text-anchor='middle' font-family='Arial' font-size='20' font-weight='bold' fill='%23000'>${watermarkText}</text></svg>`;

    let marksRows = '';
    let rawTableData = [];
    if (typeof exam.subjectMarks === 'string') {
        try { rawTableData = JSON.parse(exam.subjectMarks); } catch(e){}
    } else if (Array.isArray(exam.subjectMarks)) {
        rawTableData = exam.subjectMarks;
    }
    const marksTableData = typeof prepareCompleteMarksheetSubjects === 'function'
        ? prepareCompleteMarksheetSubjects(rawTableData, exam.className, false, false, exam.examName)
        : rawTableData;

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

      const evalStatus = evalStudentResultStatus(marksTableData, exam.className, exam.examName);
      const displayGrandTotal = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.grandTotal > 0) ? evalStatus.overallStats.grandTotal : (exam.totalMarks || '-');
      const displayPercentage = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.percentage > 0) ? evalStatus.overallStats.percentage : (exam.percentage || '-');

      marksTableData.forEach((m, idx) => {
          const isDrawing = isDrawingSubject(m.subject);
          const bg = (idx % 2 === 0) ? '#f8f9fa' : '#ffffff';
          let full = m.max !== undefined ? m.max : 100;
          let pass = m.min !== undefined ? m.min : 33;
          const isPending = m.isPending === true;
          const isSubAbsent = m.isAbsent === true || String(m.total).toUpperCase() === 'AB' || String(m.theory).toUpperCase() === 'AB';
          let obtained = isPending ? '<span style="color:#94a3b8; font-style:italic;">Pending</span>' : (isSubAbsent ? '<strong style="color:#dc2626;">AB</strong>' : (m.total !== undefined ? m.total : 0));
          const p = (!isPending && !isSubAbsent && full > 0) ? ((parseFloat(m.total) || 0) / full) * 100 : 0;
          const matched = scale.find(g => p >= g.min);
          let grade = isPending ? '-' : (isSubAbsent ? '<strong style="color:#dc2626;">AB</strong>' : (matched ? matched.grade : 'F'));

          if (isDrawing) {
            const drawGrade = resolveDrawingGrade(m, false);
            full = '-';
            pass = '-';
            obtained = isSubAbsent ? '<strong style="color:#dc2626;">AB</strong>' : `<span style="font-weight:900; color:#2563eb;">${drawGrade}</span>`;
            grade = drawGrade;
          }
          
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
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .perfect-print-wrapper {
          width: 188mm !important;
          height: 275mm !important;
          max-height: 275mm !important;
          margin: 10mm auto !important;
          page-break-inside: avoid !important;
          page-break-after: avoid !important;
          overflow: hidden !important;
        }
      }
    </style>
    <div class="perfect-print-wrapper" style="width: 100%; height: 285mm; overflow: hidden; box-sizing: border-box; page-break-inside: avoid; color: #000; border: 3px double ${c.color}; padding: 15px; padding-bottom: 25px; font-family: 'Times New Roman', serif; position: relative; ${bgStyle} -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; flex-direction: column;">
        
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
                    <div style="font-size: 10px; font-style: italic; margin-bottom: 2px;">${store.schoolAddress || 'Prem Nagar, Tapin North, Ramgarh Jharkhand.'}</div>
                    <div style="font-size: 10px;">
                        <span style="margin-right: 15px;">E-mail: ${store.schoolEmail || 'thetapowanpublicschool@gmail.com'}</span>
                        <span>Contact: ${store.schoolPhone || '+91 62011 67306'}</span>
                    </div>
                </div>

                <!-- Photo Right -->
                <div style="position: absolute; right: 0; top: 0; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      <img src="${getStudentPhotoUri(exam, exam.admissionNo || exam.admNo) || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' fill=\'%23cbd5e1\' viewBox=\'0 0 24 24\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'}" style="width: 100%; height: 100%; object-fit: contain;">
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
                    <td style="border: 1px solid #000; padding: 4px 8px;" colspan="3" contenteditable="true">${formatParentName(exam.fatherName)}</td>
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
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">${displayGrandTotal}</div>
                </div>
                <div style="border-left: 1px solid #ccc;"></div>
                <div style="text-align: center;">
                    <div style="color: #666; margin-bottom: 2px;">Percentage</div>
                    <div style="font-size: 12px; font-weight: bold;" contenteditable="true">${displayPercentage}%</div>
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
                    <button class="ai-remark-btn" contenteditable="false" onclick="generateAIRemark(this)" data-student="${exam.studentName}" data-grade="${exam.grade}" data-perc="${exam.percentage}" style="margin-right: 10px; cursor:pointer; background:#1e3a8a; color:white; border:none; border-radius:4px; padding:3px 8px; font-size:10px; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:12px;">smart_toy</span> AI Remark</button>
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
      const photoUrl = getStudentPhotoUri(exam, exam.admissionNo || exam.admNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

      let subjectRows = '';
      
    const getGrade = (percentage) => {
      const p = parseFloat(percentage);
      if (isNaN(p)) return '-';
      if (isCBSE) {
        if (p >= 91) return 'A1';
        if (p >= 81) return 'A2';
        if (p >= 71) return 'B1';
        if (p >= 61) return 'B2';
        if (p >= 51) return 'C1';
        if (p >= 41) return 'C2';
        if (p >= 33) return 'D';
        return 'E';
      } else {
        if (p >= 91) return 'A+';
        if (p >= 81) return 'A';
        if (p >= 71) return 'B+';
        if (p >= 61) return 'B';
        if (p >= 51) return 'C';
        if (p >= 33) return 'D';
        return 'E';
      }
    };
    let subs = [];
    try { subs = typeof exam.subjectMarks === 'string' ? JSON.parse(exam.subjectMarks) : (exam.subjectMarks || []); } catch(e) {}
    if (!Array.isArray(subs)) subs = [];

    const evalStatus = evalStudentResultStatus(subs, exam.className, exam.examName);
    const hasExplicitPassOrFail = (exam.resultStatus === 'PASS' || exam.resultStatus === 'FAIL');
    const isPending = !hasExplicitPassOrFail && (evalStatus.isPending || (evalStatus.resultStatus === 'PENDING') || (exam.resultStatus === 'PENDING'));
    const safeResultStatus = hasExplicitPassOrFail ? exam.resultStatus : (isPending ? 'PENDING' : evalStatus.resultStatus);
    const safeGrade = (exam.grade && exam.grade !== 'null' && exam.grade !== 'undefined' && exam.grade !== '---' && exam.grade !== '-') ? exam.grade : getGrade(exam.percentage || evalStatus.overallStats.percentage);

    const completeSubs = prepareCompleteMarksheetSubjects(subs, exam.className, isCBSE, isAnnual, exam.examName);
    const tableSubs = completeSubs.length > 0 ? completeSubs : subs;

    tableSubs.forEach(sub => {
        const isDrawing = isDrawingSubject(sub.subject);
        const isMain = isDrawing ? false : (sub.isMain !== undefined ? sub.isMain : isSubjectMain(sub.subject, exam.className, sub));
        const addlBadge = !isMain ? `<span style="font-size:7pt; font-weight:800; color:${isDrawing ? '#2563eb' : '#b45309'}; background:${isDrawing ? '#eff6ff' : '#fef3c7'}; border:1px solid ${isDrawing ? '#bfdbfe' : '#fde68a'}; border-radius:3px; padding:1px 4px; margin-left:5px; vertical-align:middle; display:inline-block;">${isDrawing ? 'GRADED' : 'ADDITIONAL'}</span>` : '';
        const isPendingRow = sub.isPending === true;
        const isSubAbsent = sub.isAbsent === true || String(sub.total).toUpperCase() === 'AB' || String(sub.theory).toUpperCase() === 'AB';
        let maxVal = sub.max || 100;
        let minVal = sub.min !== undefined ? sub.min : 33;
        let totVal = isPendingRow ? `<span style="color:#94a3b8; font-style:italic;">Pending</span>` : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.total !== undefined ? sub.total : 0));
        let thVal = isPendingRow ? '-' : (isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : (sub.theory || 0));
        let prVal = isPendingRow ? '-' : (sub.practical || 0);

        if (isDrawing) {
          const drawGrade = resolveDrawingGrade(sub, false);
          maxVal = '-';
          minVal = '-';
          thVal = '-';
          prVal = '-';
          totVal = isSubAbsent ? `<strong style="color:#dc2626;">AB</strong>` : `<span style="font-weight:900; color:#2563eb;">${drawGrade}</span>`;
        }

        subjectRows += `
        <tr>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); font-weight:bold;" contenteditable="true">${sub.subject}${addlBadge}</td>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${maxVal}</td>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${minVal}</td>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${thVal}</td>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center;" contenteditable="true">${prVal}</td>
            <td style="padding:12px; border:1px solid rgba(0,0,0,0.15); text-align:center; font-weight:bold;" contenteditable="true">${totVal}</td>
        </tr>`;
    });

      const displayThemeGrandTotal = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.grandTotal > 0) ? evalStatus.overallStats.grandTotal : (exam.totalMarks || 0);
      const displayThemePercentage = (evalStatus && evalStatus.overallStats && evalStatus.overallStats.percentage > 0) ? evalStatus.overallStats.percentage : (exam.percentage || 0);
      const displayThemeGrade = (exam.grade && exam.grade !== 'null' && exam.grade !== 'undefined') ? ((evalStatus.overallStats.grandTotal > 0 && exam.totalMarks != evalStatus.overallStats.grandTotal) ? getGrade(displayThemePercentage) : exam.grade) : getGrade(displayThemePercentage);

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
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${displayThemeGrandTotal}</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${displayThemePercentage}%</div>
                  </div>
                  <div style="flex:1; border: 1px solid ${c.color}; padding: 15px; border-radius: 8px;">
                      <div style="font-size: 12px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 24px; font-weight:bold; color: ${c.color};" contenteditable="true">${displayThemeGrade}</div>
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
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${displayThemeGrandTotal}</div>
                  </div>
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: transparent;">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">PERCENTAGE</div>
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${displayThemePercentage}%</div>
                  </div>
                  <div style="flex:1; border: 2px dashed ${c.color}; padding: 15px; border-radius: 12px; background: transparent;">
                      <div style="font-size: 13px; font-weight:bold; color: inherit;">GRADE</div>
                      <div style="font-size: 26px; font-weight:900; color: ${c.color};" contenteditable="true">${displayThemeGrade}</div>
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
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">GRAND TOTAL</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${displayThemeGrandTotal}</h2></div>
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">PERCENTAGE</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${displayThemePercentage}%</h2></div>
                      <div><p style="margin:0 0 5px 0; color: inherit; font-size: 12px; font-weight:bold;">OVERALL GRADE</p><h2 style="margin:0; color:${c.color};" contenteditable="true">${displayThemeGrade}</h2></div>
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
    const existingPreview = document.getElementById("resultPreviewContainer");
    const existingPrintActions = document.getElementById("resultPrintActions");
    const savedPreviewHtml = (existingPreview && !existingPreview.querySelector(".empty-state") && existingPreview.children.length > 0)
      ? existingPreview.innerHTML
      : null;
    const savedPrintDisplay = existingPrintActions ? existingPrintActions.style.display : "none";
    const savedClass = document.getElementById("resultClassSelect") ? document.getElementById("resultClassSelect").value : null;

    container.innerHTML = `
      <div class="exam-print-hide" style="margin-bottom: 25px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h4 style="margin:0 0 5px 0; color: inherit; font-size:1.2rem;">Marksheet Generator</h4>
          <p style="margin:0; color: inherit; font-size:0.9rem;">Generate beautiful report cards and results.</p>
        </div>
        <button type="button" class="exam-btn" onclick="window.openSubjectRulesModal()" style="padding: 9px 16px; font-size: 0.85rem; display:inline-flex; align-items:center; gap:6px; cursor:pointer; background:#eff6ff; color:#2563eb; border:1.5px solid #bfdbfe; font-weight:700;" title="Configure which subjects decide Pass or Fail">
          <span class="material-symbols-outlined" style="font-size:18px;">rule</span>
          Main Subject Rules (Pass/Fail)
        </button>
      </div>
      <div class="exam-form-grid" style="margin-bottom: 30px;">
        <div class="exam-field">
          <label>Select Class</label>
          <select id="resultClassSelect"></select>
        </div>
        <div class="exam-field">
          <label>Select Student</label>
          <select id="resultStudentPreSelect">
            <option value="">-- All Students in Class --</option>
          </select>
        </div>
        <div class="exam-field">
          <label>Session</label>
          <input id="resultSession" value="2026-27" />
        </div>
        <div class="exam-field">
          <label>Exam Name</label>
          <select id="resultExamName"></select>
        </div>
        <div class="exam-field" style="grid-column: 1 / -1;">
          <details style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
            <summary style="cursor: pointer; font-weight: bold; outline: none; display: flex; align-items: center; justify-content: space-between;">
              <span>Select Specific Students (Checkboxes)</span>
              <span id="resultSelectedStudentsCountBadge" style="font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 2px 10px; border-radius: 12px;">All Selected</span>
            </summary>
            <div style="display:flex; gap: 10px; margin: 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <button id="btnCheckAllResultStudents" type="button" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight:bold;">Select All</button>
              <button id="btnUncheckAllResultStudents" type="button" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight:bold;">Unselect All</button>
            </div>
            <div id="resultStudentCheckboxes" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">Select a class first...</div>
            </div>
          </details>
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
      <div id="resultPrintActions" class="exam-print-hide" style="margin-bottom: 20px; display:none; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; background:#fff; padding:12px 18px; border-radius:12px; border:1px solid #cbd5e1; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:12px; flex:1; min-width:320px;">
          <div style="position:relative; flex:1; min-width:220px; max-width:380px;">
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:15px; color:#64748b; pointer-events:none;">🔍</span>
            <input type="text" id="resultStudentSearch" placeholder="Search student name, roll, adm..." style="width:100%; height:40px; padding:8px 34px 8px 36px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; outline:none; background:#f8fafc; box-sizing:border-box;" />
            <button id="resultClearSearchBtn" type="button" title="Clear Search" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px; display:none; padding:4px;">✕</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="resultStudentFilterSelect" style="font-size:13px; font-weight:700; color:#334155; white-space:nowrap; display:flex; align-items:center; gap:4px;">
              <span>👤</span> Select Student:
            </label>
            <select id="resultStudentFilterSelect" style="height:40px; padding:0 12px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:13px; outline:none; background:#f8fafc; font-weight:600; cursor:pointer; max-width:290px;">
              <option value="">-- All Students --</option>
            </select>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span id="resultStudentCountBadge" style="font-size:13px; font-weight:600; color:#334155; background:#f1f5f9; padding:6px 14px; border-radius:20px; border:1px solid #e2e8f0; white-space:nowrap;">
            Showing all students
          </span>
          <button id="resultPrintBtn" class="exam-btn exam-btn-secondary" style="height:40px; display:inline-flex; align-items:center; gap:6px; font-weight:700; white-space:nowrap; padding:0 16px;">
            <span class="material-symbols-outlined" style="font-size:18px;">print</span> Print Results
          </button>
        </div>
      </div>
      <div id="resultPreviewContainer" contenteditable="true" style="outline:none; background:#e2e8f0; padding:40px 20px; border-radius:12px; min-height:300px; display:flex; flex-direction:column; align-items:center; gap:40px;">
         <div class="empty-state">
           <span class="material-symbols-outlined" style="font-size:44px;color:#94a3b8;display:block;margin:0 auto 12px;">bar_chart</span>
           <h4>Ready to generate</h4>
           <p>Select criteria and click Generate to view marksheets.</p>
         </div>
      </div>
    `;

    populateClassSelect("resultClassSelect");
    
    const refreshResultStudents = () => {
        const cls = document.getElementById("resultClassSelect") ? document.getElementById("resultClassSelect").value : '';
        const studentPreSelect = document.getElementById("resultStudentPreSelect");
        const checkboxContainer = document.getElementById("resultStudentCheckboxes");
        const badge = document.getElementById("resultSelectedStudentsCountBadge");
        
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
        const classStudents = (store.students || []).filter(s => (normFunc(s.className) === normFunc(cls) || s.className === cls) && isStudentActive(s));
        
        classStudents.sort((a, b) => {
          const rA = parseInt(String(a.rollNo || '').replace(/\D/g, ''), 10) || 9999;
          const rB = parseInt(String(b.rollNo || '').replace(/\D/g, ''), 10) || 9999;
          if (rA !== rB) return rA - rB;
          return (a.fullName || '').localeCompare(b.fullName || '');
        });
        
        if (studentPreSelect) {
          studentPreSelect.innerHTML = `<option value="">-- All Students in Class (${classStudents.length}) --</option>` +
            classStudents.map(s => `<option value="${s.admissionNo || s.fullName}">Roll ${s.rollNo || '-'} - ${s.fullName || s.studentName} (${s.admissionNo || ''})</option>`).join('');
        }

        if (checkboxContainer) {
          if (classStudents.length === 0) {
            checkboxContainer.innerHTML = `<div style="grid-column: 1 / -1; font-size: 0.9rem; color: #64748b;">No active students found in this class.</div>`;
            if (badge) badge.textContent = '0 Selected';
          } else {
            checkboxContainer.innerHTML = classStudents.map(s => `
              <label style="display:flex; align-items:center; gap: 8px; font-size: 0.88rem; cursor: pointer; text-transform:none; font-weight:500;">
                <input type="checkbox" class="result-student-cb" value="${s.admissionNo || s.fullName}" checked style="width:16px; height:16px; margin:0;" />
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.fullName}">Roll ${s.rollNo || '-'}: ${s.fullName}</span>
              </label>
            `).join('');
            if (badge) badge.textContent = `All (${classStudents.length}) Selected`;

            checkboxContainer.querySelectorAll('.result-student-cb').forEach(cb => {
              cb.onchange = () => {
                const total = checkboxContainer.querySelectorAll('.result-student-cb').length;
                const checked = checkboxContainer.querySelectorAll('.result-student-cb:checked').length;
                if (badge) {
                  badge.textContent = checked === total ? `All (${total}) Selected` : `${checked} of ${total} Selected`;
                }
              };
            });
          }
        }
    };

    const btnCheckAllResult = document.getElementById("btnCheckAllResultStudents");
    const btnUncheckAllResult = document.getElementById("btnUncheckAllResultStudents");
    if (btnCheckAllResult) {
      btnCheckAllResult.onclick = (e) => {
        e.preventDefault();
        const container = document.getElementById("resultStudentCheckboxes");
        if (container) {
          container.querySelectorAll('.result-student-cb').forEach(cb => cb.checked = true);
          const badge = document.getElementById("resultSelectedStudentsCountBadge");
          const total = container.querySelectorAll('.result-student-cb').length;
          if (badge) badge.textContent = `All (${total}) Selected`;
        }
      };
    }
    if (btnUncheckAllResult) {
      btnUncheckAllResult.onclick = (e) => {
        e.preventDefault();
        const container = document.getElementById("resultStudentCheckboxes");
        if (container) {
          container.querySelectorAll('.result-student-cb').forEach(cb => cb.checked = false);
          const badge = document.getElementById("resultSelectedStudentsCountBadge");
          if (badge) badge.textContent = `0 Selected`;
        }
      };
    }

    const preSelectEl = document.getElementById("resultStudentPreSelect");
    if (preSelectEl) {
      preSelectEl.onchange = () => {
        const selVal = preSelectEl.value;
        const container = document.getElementById("resultStudentCheckboxes");
        if (!container) return;
        const checkboxes = container.querySelectorAll('.result-student-cb');
        const badge = document.getElementById("resultSelectedStudentsCountBadge");
        if (!selVal) {
          checkboxes.forEach(cb => cb.checked = true);
          if (badge) badge.textContent = `All (${checkboxes.length}) Selected`;
        } else {
          checkboxes.forEach(cb => cb.checked = (cb.value === selVal));
          if (badge) badge.textContent = `1 of ${checkboxes.length} Selected`;
        }
      };
    }

    const refreshResultExamNames = () => {
        const cls = document.getElementById("resultClassSelect").value;
        const examNameSelect = document.getElementById("resultExamName");
        if (!examNameSelect) return;
        
        const store = typeof getStore !== 'undefined' ? getStore() : {};
        const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
        const marksEntries = (store.exams || []).filter(e => normFunc(e.className) === normFunc(cls) || e.className === cls);
        let uniqueExamNames = Array.from(new Set(marksEntries.map(e => e.examName).filter(Boolean)));
        
        const schedules = (store.examSchedules || []).filter(s => normFunc(s.className) === normFunc(cls) || s.className === cls);
        schedules.forEach(s => {
            if (s.examName && !uniqueExamNames.includes(s.examName)) {
                uniqueExamNames.push(s.examName);
            }
        });
        
        if (uniqueExamNames.length === 0) {
            uniqueExamNames = ["Annual Examination 2026-27", "Mid Term Exam"];
        }
        
        const currentValue = examNameSelect.value;
        examNameSelect.innerHTML = uniqueExamNames.map(name => `<option value="${name}">${name}</option>`).join('');
        
        if (uniqueExamNames.includes(currentValue)) {
            examNameSelect.value = currentValue;
        }
    };

    document.getElementById("resultClassSelect").addEventListener("change", () => {
      refreshResultExamNames();
      refreshResultStudents();
    });
    setTimeout(() => {
      refreshResultExamNames();
      refreshResultStudents();
    }, 60);
    setTimeout(refreshResultExamNames, 50);

    if (savedClass) {
      const clsEl = document.getElementById("resultClassSelect");
      if (clsEl) {
        clsEl.value = savedClass;
        refreshResultExamNames();
        refreshResultStudents();
      }
    }

    if (savedPreviewHtml) {
      const newPreview = document.getElementById("resultPreviewContainer");
      const newPrintActions = document.getElementById("resultPrintActions");
      if (newPreview) newPreview.innerHTML = savedPreviewHtml;
      if (newPrintActions) newPrintActions.style.display = savedPrintDisplay;
    }
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
      const preSelectedStudent = document.getElementById("resultStudentPreSelect") ? document.getElementById("resultStudentPreSelect").value : '';
      
      const allCheckboxes = Array.from(document.querySelectorAll('.result-student-cb'));
      const checkedBoxes = allCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
      
      let selectedStudentIds = null;
      if (preSelectedStudent) {
        selectedStudentIds = [preSelectedStudent];
      } else if (allCheckboxes.length > 0 && checkedBoxes.length < allCheckboxes.length) {
        selectedStudentIds = checkedBoxes;
      }

      const config = {
          color: document.getElementById("resultColor").value,
          font: document.getElementById("resultFont").value,
          border: document.getElementById("resultBorder").value,
          bgColor: document.getElementById("resultBgColor").value,
          bgColor2: document.getElementById("resultBgColor2").value,
          bgType: document.getElementById("resultBgType").value,
          fontColor: document.getElementById("resultFontColor").value,
          bgOpacity: document.getElementById("resultBgOpacity").value,
          bgImage: document.getElementById("resultBgImage").value,
          filterStudent: preSelectedStudent,
          selectedStudentIds: selectedStudentIds
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

    function setupResultStudentSearch(students, defaultFilter) {
      const searchInput = document.getElementById("resultStudentSearch");
      const filterSelect = document.getElementById("resultStudentFilterSelect");
      const clearBtn = document.getElementById("resultClearSearchBtn");
      const countBadge = document.getElementById("resultStudentCountBadge");
      const printBtn = document.getElementById("resultPrintBtn");
      const container = document.getElementById("resultPreviewContainer");

      if (!container) return;

      const studentList = students || [];
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="">-- All Students (${studentList.length}) --</option>` +
          studentList.map(s => `<option value="${s.key}">Roll ${s.rollNo} - ${s.name}${s.admNo ? ` (${s.admNo})` : ''}</option>`).join('');
      }

      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      if (countBadge) {
        countBadge.textContent = `Showing all ${studentList.length} students`;
        countBadge.style.color = '#334155';
        countBadge.style.background = '#f1f5f9';
      }
      if (printBtn) printBtn.innerHTML = `🖨️ Print Results (${studentList.length})`;

      function doFilter(query, exactKey) {
        const q = (query || '').trim().toLowerCase();
        const cards = container.querySelectorAll(".marksheet-card-wrapper");
        let visibleCount = 0;

        cards.forEach(card => {
          const name = (card.getAttribute("data-student-name") || '').toLowerCase();
          const roll = (card.getAttribute("data-roll-no") || '').toLowerCase();
          const adm = (card.getAttribute("data-admission-no") || '').toLowerCase();
          const key = card.getAttribute("data-student-key") || '';

          let match = false;
          if (exactKey) {
            match = key === exactKey;
          } else if (!q) {
            match = true;
          } else {
            const cleanRoll = roll.replace(/^0+/, '');
            const cleanQ = q.replace(/^0+/, '');
            const normFuzzy = (s) => (s || '')
              .toLowerCase()
              .replace(/[\s\-_.]+/g, '')
              .replace(/dhaya/g, 'dhya')
              .replace(/dhiya/g, 'dhya')
              .replace(/aa/g, 'a')
              .replace(/ee/g, 'i')
              .replace(/oo/g, 'u');
            const fName = normFuzzy(name);
            const fQ = normFuzzy(q);
            match = name.includes(q) || (fQ.length >= 3 && fName.includes(fQ)) || roll === q || (cleanQ.length > 0 && cleanRoll === cleanQ) || adm.includes(q);
          }

          if (match) {
            card.style.display = '';
            card.classList.remove('marksheet-card-hidden');
            visibleCount++;
          } else {
            card.style.display = 'none';
            card.classList.add('marksheet-card-hidden');
          }
        });

        if (clearBtn) clearBtn.style.display = (q || exactKey) ? 'block' : 'none';
        if (countBadge) {
          if (visibleCount === cards.length) {
            countBadge.textContent = `Showing all ${visibleCount} students`;
            countBadge.style.color = '#334155';
            countBadge.style.background = '#f1f5f9';
          } else if (visibleCount > 0) {
            countBadge.textContent = `Showing ${visibleCount} of ${cards.length} students`;
            countBadge.style.color = '#1e40af';
            countBadge.style.background = '#dbeafe';
          } else {
            countBadge.textContent = `No student matches "${query || ''}"`;
            countBadge.style.color = '#b91c1c';
            countBadge.style.background = '#fee2e2';
          }
        }

        if (printBtn) {
          if (visibleCount === 1) {
            printBtn.innerHTML = `🖨️ Print Result (1 Student)`;
          } else if (visibleCount > 0) {
            printBtn.innerHTML = `🖨️ Print Results (${visibleCount} Students)`;
          } else {
            printBtn.innerHTML = `🖨️ Print Results`;
          }
        }
      }

      if (searchInput) {
        searchInput.oninput = (e) => {
          if (filterSelect) filterSelect.value = '';
          doFilter(e.target.value, null);
        };
      }

      if (filterSelect) {
        filterSelect.onchange = (e) => {
          const val = e.target.value;
          if (!val) {
            if (searchInput) searchInput.value = '';
            doFilter('', null);
          } else {
            const s = studentList.find(x => x.key === val);
            if (searchInput) searchInput.value = s ? s.name : '';
            doFilter(s ? s.name : '', val);
            const matchedCard = container.querySelector(`.marksheet-card-wrapper[data-student-key="${val}"]`);
            if (matchedCard) {
              matchedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        };
      }

      if (clearBtn) {
        clearBtn.onclick = () => {
          if (searchInput) searchInput.value = '';
          if (filterSelect) filterSelect.value = '';
          doFilter('', null);
          if (searchInput) searchInput.focus();
        };
      }

      if (defaultFilter) {
        const dfStr = String(defaultFilter).trim().toLowerCase();
        const matched = studentList.find(s => 
          (s.admNo && s.admNo.toLowerCase() === dfStr) ||
          (s.name && s.name.toLowerCase() === dfStr) ||
          (s.key && s.key.toLowerCase() === dfStr) ||
          (s.rollNo && String(s.rollNo).toLowerCase() === dfStr)
        );
        if (matched) {
          if (filterSelect) filterSelect.value = matched.key;
          if (searchInput) searchInput.value = matched.name;
          doFilter(matched.name, matched.key);
        } else {
          if (searchInput) searchInput.value = defaultFilter;
          doFilter(defaultFilter, null);
        }
      }
    }
    window.setupResultStudentSearch = setupResultStudentSearch;
  }

  function generateMarksheets(className, session, examName, theme, config) {
    const container = document.getElementById("resultPreviewContainer");
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
    
    if (theme === 'consolidated_cbse') {
        const reqExams = examName.split(',').map(e => e.trim()).filter(Boolean);
        const allExams = (store.exams || []).filter(e => (normFunc(e.className) === normFunc(className) || e.className === className) && e.session === session && reqExams.includes(e.examName) && isExamForActiveStudent(e, store.students || []));
        
        if(allExams.length === 0) {
          container.innerHTML = `<div class="empty-state"><h4>No marks data found for these combined exams.</h4><p>Ensure the exam names are spelled correctly.</p></div>`;
          document.getElementById("resultPrintActions").style.display = "none";
          return;
        }

        const studentMap = {};
        allExams.forEach(ex => {
            const student = findStudentFromStore(store.students || [], ex);
            const adm = (student?.admissionNo || ex.admissionNo || '').trim();
            const roll = String(ex.rollNo || student?.rollNo || '').trim();
            const key = adm ? `adm_${adm}` : (roll ? `roll_${roll}_${(ex.studentName || '').trim()}` : (ex.studentName || '').trim());
            if(!studentMap[key]) {
                studentMap[key] = { exams: [], studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: adm, className: ex.className, session: ex.session };
            }
            studentMap[key].exams.push(ex);
        });

        const sortedStudents = Object.values(studentMap).sort((a, b) => {
          const parseRoll = (r) => {
            if (!r && r !== 0) return 999999;
            const num = parseInt(String(r).replace(/\D/g, ''), 10);
            return isNaN(num) ? 999999 : num;
          };
          const rA = parseRoll(a.rollNo);
          const rB = parseRoll(b.rollNo);
          if (rA !== rB) return rA - rB;
          return (a.studentName || '').localeCompare(b.studentName || '');
        });

        let targetStudents = sortedStudents;
        if (config?.selectedStudentIds && config.selectedStudentIds.length > 0) {
            targetStudents = sortedStudents.filter(stdGroup => {
              const student = findStudentFromStore(store.students || [], stdGroup);
              const adm = String(student?.admissionNo || stdGroup.admissionNo || '').trim().toLowerCase();
              const name = String(stdGroup.studentName || '').trim().toLowerCase();
              return config.selectedStudentIds.some(id => {
                const cleanId = String(id).trim().toLowerCase();
                return cleanId === adm || cleanId === name;
              });
            });
        }

        let html = '';
        targetStudents.forEach(stdGroup => {
            const student = findStudentFromStore(store.students || [], stdGroup);
            const stdKey = `std_${stdGroup.rollNo || ''}_${(student?.admissionNo || stdGroup.admissionNo || '').trim()}_${(stdGroup.studentName || '').trim().replace(/\s+/g, '_')}`;
            const admNo = student?.admissionNo || '';
            html += `<div class="marksheet-card-wrapper" data-student-name="${(stdGroup.studentName || '').toLowerCase()}" data-roll-no="${String(stdGroup.rollNo || '').toLowerCase()}" data-admission-no="${admNo.toLowerCase()}" data-student-key="${stdKey}" style="width: 100%; display: flex; flex-direction: column; align-items: center;">
              ${getConsolidatedResultHtml(stdGroup, reqExams, student, config)}
            </div>`;
        });
        
        container.innerHTML = html;
        document.getElementById("resultPrintActions").style.display = "flex";

        const studentList = targetStudents.map(stdGroup => {
          const student = findStudentFromStore(store.students || [], stdGroup);
          return {
            key: `std_${stdGroup.rollNo || ''}_${(stdGroup.studentName || '').trim().replace(/\s+/g, '_')}`,
            rollNo: stdGroup.rollNo || '-',
            name: stdGroup.studentName || '',
            admNo: student?.admissionNo || ''
          };
        });
        setupResultStudentSearch(studentList, config?.filterStudent);
        
        // Render Charts after DOM injection
        setTimeout(() => {
            targetStudents.forEach(stdGroup => {
                const canvas = document.getElementById(`consolidatedChart_${stdGroup.rollNo}`);
                if (canvas) renderConsolidatedChart(canvas, stdGroup, reqExams);
            });
        }, 100);
        return;
    }
    
    // Find all exams matching (only active students)
    const matchingExams = (store.exams || []).filter(e => (normFunc(e.className) === normFunc(className) || e.className === className) && e.session === session && e.examName === examName && isExamForActiveStudent(e, store.students || []));
    
    if(matchingExams.length === 0) {
      container.innerHTML = `<div class="empty-state"><h4>No marks data found for this class and exam.</h4><p>Please enter marks first.</p></div>`;
      document.getElementById("resultPrintActions").style.display = "none";
      return;
    }

    // Auto-calculate Class Ranks (Drawing strictly excluded for all classes)
    const getExamScholasticStats = (ex) => {
      if (ex && ex.subjectMarks) {
        try {
          const sm = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : ex.subjectMarks;
          if (Array.isArray(sm) && sm.length > 0) {
            const ev = evalStudentResultStatus(sm, ex.className, ex.examName);
            if (ev && ev.overallStats && ev.overallStats.maxTotal > 0) {
              return {
                totalMarks: ev.overallStats.grandTotal,
                percentage: ev.overallStats.percentage
              };
            }
          }
        } catch (e) {}
      }
      return {
        totalMarks: parseFloat(ex.totalMarks) || 0,
        percentage: parseFloat(ex.percentage) || 0
      };
    };

    const sortedClassExams = [...matchingExams].sort((a, b) => {
      const sA = getExamScholasticStats(a);
      const sB = getExamScholasticStats(b);
      if (sB.percentage !== sA.percentage) return sB.percentage - sA.percentage;
      return sB.totalMarks - sA.totalMarks;
    });

    const classRankMap = new Map();
    let curClassRank = 1;
    for (let i = 0; i < sortedClassExams.length; i++) {
      const cur = sortedClassExams[i];
      if (i > 0) {
        const prev = sortedClassExams[i - 1];
        const sPrev = getExamScholasticStats(prev);
        const sCur = getExamScholasticStats(cur);
        if (sCur.percentage < sPrev.percentage || (sCur.percentage === sPrev.percentage && sCur.totalMarks < sPrev.totalMarks)) {
          curClassRank = i + 1;
        }
      }
      const sName = (cur.studentName || '').trim().toLowerCase();
      const sRoll = String(cur.rollNo || '').trim().replace(/^0+/, '');
      classRankMap.set(`${sName}_${sRoll}`, curClassRank);
      classRankMap.set(sName, curClassRank);
      if (sRoll) classRankMap.set(`roll_${sRoll}`, curClassRank);
    }

    // Auto-calculate School Ranks across all classes for this session & examName (only active students)
    const allSchoolExams = (store.exams || []).filter(e => {
      const matchSession = (e.session || '').trim().toLowerCase() === (session || '').trim().toLowerCase();
      const matchExam = (e.examName || '').trim().toLowerCase() === (examName || '').trim().toLowerCase();
      return matchSession && matchExam && isExamForActiveStudent(e, store.students || []);
    });
    const effectiveSchoolExams = allSchoolExams.length > 0 ? allSchoolExams : matchingExams;

    const sortedSchoolExams = [...effectiveSchoolExams].sort((a, b) => {
      const sA = getExamScholasticStats(a);
      const sB = getExamScholasticStats(b);
      if (sB.percentage !== sA.percentage) return sB.percentage - sA.percentage;
      return sB.totalMarks - sA.totalMarks;
    });

    const schoolRankMap = new Map();
    let curSchoolRank = 1;
    for (let i = 0; i < sortedSchoolExams.length; i++) {
      const cur = sortedSchoolExams[i];
      if (i > 0) {
        const prev = sortedSchoolExams[i - 1];
        const sPrev = getExamScholasticStats(prev);
        const sCur = getExamScholasticStats(cur);
        if (sCur.percentage < sPrev.percentage || (sCur.percentage === sPrev.percentage && sCur.totalMarks < sPrev.totalMarks)) {
          curSchoolRank = i + 1;
        }
      }
      const sClass = (cur.className || '').trim().toLowerCase();
      const sName = (cur.studentName || '').trim().toLowerCase();
      const sRoll = String(cur.rollNo || '').trim().replace(/^0+/, '');
      schoolRankMap.set(`${sClass}_${sName}_${sRoll}`, curSchoolRank);
      schoolRankMap.set(`${sName}_${sRoll}`, curSchoolRank);
      schoolRankMap.set(sName, curSchoolRank);
    }

    // Sort all exam records strictly by Roll Number ascending (1, 2, 3 ... 38)
    const resolveRollNumber = (e) => {
      let r = e.rollNo;
      if (!r || r === '' || r === '-' || r === '0' || r === '---') {
        const std = findStudentFromStore(store.students || [], e);
        if (std && std.rollNo) r = std.rollNo;
      }
      if (!r && r !== 0) return 999999;
      const num = parseInt(String(r).replace(/\D/g, ''), 10);
      return isNaN(num) ? 999999 : num;
    };

    matchingExams.sort((a, b) => {
      const rA = resolveRollNumber(a);
      const rB = resolveRollNumber(b);
      if (rA !== rB) return rA - rB;
      return (a.studentName || '').localeCompare(b.studentName || '');
    });

    let targetExams = matchingExams;
    if (config?.selectedStudentIds && config.selectedStudentIds.length > 0) {
        targetExams = matchingExams.filter(ex => {
          const student = findStudentFromStore(store.students || [], ex);
          const adm = String(student?.admissionNo || ex.admissionNo || '').trim().toLowerCase();
          const name = String(ex.studentName || '').trim().toLowerCase();
          return config.selectedStudentIds.some(id => {
            const cleanId = String(id).trim().toLowerCase();
            return cleanId === adm || cleanId === name;
          });
        });
    }

    let html = '';
    targetExams.forEach(ex => {
          const sName = (ex.studentName || '').trim().toLowerCase();
          const sRoll = String(ex.rollNo || '').trim().replace(/^0+/, '');
          const sClass = (ex.className || '').trim().toLowerCase();
          const cRank = classRankMap.get(`${sName}_${sRoll}`) || classRankMap.get(sName) || (sRoll ? classRankMap.get(`roll_${sRoll}`) : '') || '';
          const sRank = schoolRankMap.get(`${sClass}_${sName}_${sRoll}`) || schoolRankMap.get(`${sName}_${sRoll}`) || schoolRankMap.get(sName) || '';

          const student = findStudentFromStore(store.students || [], ex);
          const studentPhotoUri = getStudentPhotoUri(student, student?.id || student?.admissionNo || ex?.admissionNo || ex?.admNo) || getStudentPhotoUri(ex.studentPhoto, student?.admissionNo || ex?.admissionNo || ex?.admNo) || '';
          const bgStyle = config.bgImage !== 'none' ? `background-image: url('${config.bgImage}'); background-size: cover; background-position: center;` : (config.bgType === 'gradient' ? `background: linear-gradient(135deg, ${config.bgColor}, ${config.bgColor2});` : `background-color: ${config.bgColor};`);
          const fontColorStyle = config.fontColor ? `color: ${config.fontColor} !important;` : '';
          
          let cardHtml = '';
          if (theme === 'custom_blank') {
              cardHtml = getCustomResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: formatParentName(student.fatherName), motherName: student.motherName || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus,
                classRank: cRank, schoolRank: sRank, totalClassStudents: matchingExams.length, totalSchoolStudents: effectiveSchoolExams.length
              }, theme, config);
          } else if (theme === 'detailed_graph') {
              cardHtml = getDetailedGraphResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: formatParentName(student.fatherName), motherName: student.motherName || '',
                dob: student.dob || '', address: student.address || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus,
                classRank: cRank, schoolRank: sRank, totalClassStudents: matchingExams.length, totalSchoolStudents: effectiveSchoolExams.length
              }, theme, config);
          } else if (theme === 'jac_board_tps') {
              cardHtml = getJacBoardResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: formatParentName(student.fatherName), motherName: student.motherName || '',
                dob: student.dob || '', address: student.address || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus,
                classRank: cRank, schoolRank: sRank, totalClassStudents: matchingExams.length, totalSchoolStudents: effectiveSchoolExams.length
              }, config);
          } else if (theme === 'tps_official_2026') {
              cardHtml = getTpsOfficialResultHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                fatherName: formatParentName(student.fatherName), motherName: student.motherName || '',
                dob: student.dob || '', address: student.address || '',
                phone: student.phone || student.phone1 || student.mobile || student.whatsapp || student.contact || student.phoneNo || ex.phone || ex.mobile || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus,
                classRank: cRank,
                schoolRank: sRank,
                totalClassStudents: matchingExams.length,
                totalSchoolStudents: effectiveSchoolExams.length
              }, config);
          } else if (theme.startsWith('dyn_')) {
              cardHtml = generateDynamicMarksheet({
                examName: ex.examName, session: ex.session, studentName: ex.studentName,
                className: ex.className, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          } else {
              cardHtml = getMarksheetHtml({
                examName: ex.examName, session: ex.session, className: ex.className,
                studentName: ex.studentName, rollNo: ex.rollNo, admissionNo: student.admissionNo || ex.admissionNo || '',
                studentPhoto: studentPhotoUri, subjectMarks: ex.subjectMarks,
                totalMarks: ex.totalMarks, percentage: ex.percentage, grade: ex.grade, resultStatus: ex.resultStatus
              }, theme, config);
          }

          const admStr = (student?.admissionNo || ex.admissionNo || '').trim();
          const stdKey = `ex_${ex.rollNo || ''}_${admStr ? admStr + '_' : ''}${(ex.studentName || '').trim().replace(/\s+/g, '_')}`;
          const admNo = (student?.admissionNo || ex.admissionNo || '').toLowerCase();
          const sNameLower = (ex.studentName || '').toLowerCase();
          const sRollLower = String(ex.rollNo || '').toLowerCase();

          if (theme === 'tps_official_2026' || theme === 'jac_board_tps') {
              // Wrap in full A4 container with exact stretch
              html += `<div class="marksheet-card-wrapper" data-student-name="${sNameLower}" data-roll-no="${sRollLower}" data-admission-no="${admNo}" data-student-key="${stdKey}" style="width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm; page-break-after: always; padding: 10mm; box-sizing: border-box; position: relative; overflow: hidden; background: #fff; margin: 0 auto; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                         <div style="display: flex; align-items: stretch; justify-content: center; width: 100%; height: 100%;">
                           ${cardHtml}
                         </div>
                       </div>`;
          } else {
              // Inject bg into other cards
              cardHtml = cardHtml.replace(/position:\s*relative;(?:\s*background:\s*transparent;)?/, `position: relative; ${bgStyle}`);
              const overlayHtml = `<div style="position: absolute; inset: 0; background: rgba(255,255,255,${1 - config.bgOpacity}); pointer-events: none; z-index: 0; border-radius: inherit;"></div><div style="position: relative; z-index: 1; height: 100%;">`;
              cardHtml = cardHtml.replace('">', `">${overlayHtml}`) + '</div>';

              // Wrap it in a clean A4 container (white background)
              html += `<div class="marksheet-card-wrapper" data-student-name="${sNameLower}" data-roll-no="${sRollLower}" data-admission-no="${admNo}" data-student-key="${stdKey}" style="width: 210mm; min-height: 297mm; page-break-after: always; padding: 10mm; box-sizing: border-box; position: relative; overflow: hidden; background: #fff; margin: 0 auto; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                         <div style="display: flex; align-items: center; justify-content: center;">
                           ${cardHtml}
                         </div>
                       </div>`;
          }
    });

    container.innerHTML = html;
    document.getElementById("resultPrintActions").style.display = "flex";

    const studentList = targetExams.map((ex, idx) => {
      const student = findStudentFromStore(store.students || [], ex);
      const admStr = (student?.admissionNo || ex.admissionNo || '').trim();
      return {
        key: `ex_${ex.rollNo || ''}_${admStr ? admStr + '_' : ''}${(ex.studentName || '').trim().replace(/\s+/g, '_')}`,
        rollNo: ex.rollNo || '-',
        name: ex.studentName || '',
        admNo: admStr
      };
    });
    setupResultStudentSearch(studentList, config?.filterStudent);
      
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

  window.getTpsOfficialResultHtml = getTpsOfficialResultHtml;
  window.getJacBoardResultHtml = getJacBoardResultHtml;
  window.getMarksheetHtml = getMarksheetHtml;
  window.getDetailedGraphResultHtml = getDetailedGraphResultHtml;
  window.generateMarksheets = generateMarksheets;

  // Utils
  function populateClassSelect(elementId) {
    const store = typeof getStore !== 'undefined' ? getStore() : {};
    const classSelect = document.getElementById(elementId);
    if (!classSelect) return;
    const currentVal = classSelect.value;
    classSelect.innerHTML = '<option value="">Select Class</option>';
    const allClassNames = [
      ...(store.classes || []).map((x) => [x.className, x.section].filter(Boolean).join("-")),
      ...(store.students || []).map((s) => s.className)
    ];
    const normFunc = typeof normalizeCanonicalClass === 'function' ? normalizeCanonicalClass : (x => x);
    const classOptions = Array.from(new Set(allClassNames.map(c => normFunc(c)).filter(Boolean)));
    const CANONICAL_ORDER = ['Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'];
    classOptions.sort((a, b) => {
      const idxA = CANONICAL_ORDER.indexOf(a);
      const idxB = CANONICAL_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    classOptions.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      classSelect.appendChild(option);
    });
    if (currentVal && (classOptions.includes(currentVal) || classOptions.includes(normFunc(currentVal)))) {
      classSelect.value = normFunc(currentVal) || currentVal;
    }
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
    if (!await window.appConfirm("Are you sure you want to delete your custom template? This will revert to the default.", { title: "Delete Custom Template?", confirmText: "Delete Template", type: "danger" })) return;
    
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
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;margin-right:2px;">hourglass_top</span> Generating...';
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
    const photoUrl = getStudentPhotoUri(student, student.id || student.admissionNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    
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
                    <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; display: ${student.photo ? 'block' : 'none'};" />
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


function getConsolidatedResultHtml(stdGroup, reqExams, student, config) {
    const c = config || { color: '#0f172a', font: "'Times New Roman', serif", border: 'solid' };
    const borderVal = c.border === 'none' ? 'none' : `4px ${c.border} ${c.color}`;
    const photoUrl = getStudentPhotoUri(student, student?.id || student?.admissionNo) || getStudentPhotoUri(stdGroup.exams[0]?.studentPhoto, stdGroup.exams[0]?.admissionNo) || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23e2e8f0' viewBox='0 0 24 24'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
    const schoolName = "Tapowan Public School";
    const bgStyle = config.bgImage !== 'none' ? `background-image: url('${config.bgImage}'); background-size: cover; background-position: center;` : (config.bgType === 'gradient' ? `background: linear-gradient(135deg, ${config.bgColor}, ${config.bgColor2});` : `background-color: ${config.bgColor};`);
    const fontColorStyle = config.fontColor ? `color: ${config.fontColor} !important;` : '';
    
    // Split exams into Term 1 (first half of requested exams) and Term 2 (remaining)
    const term1Exams = reqExams.slice(0, Math.ceil(reqExams.length / 2));
    const term2Exams = reqExams.slice(Math.ceil(reqExams.length / 2));

    function renderExamTable(examName) {
        const ex = stdGroup.exams.find(e => e.examName === examName);
        if (!ex) return `<div style="text-align:center; padding: 20px; border: 1px dashed #ccc; margin-bottom: 20px;">${examName} marks not entered</div>`;
        
        let subs = [];
        try { subs = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : (ex.subjectMarks || []); } catch(e) {}
        
        let rows = '';
        subs.forEach(sub => {
            const isMain = isSubjectMain(sub.subject, stdGroup.className, sub);
            const addlBadge = !isMain ? `<span style="font-size:7pt; font-weight:800; color:#b45309; background:#fef3c7; border:1px solid #fde68a; border-radius:3px; padding:1px 4px; margin-left:5px;">ADDITIONAL</span>` : '';
            rows += `<tr>
                <td style="padding:8px; border:1px solid rgba(0,0,0,0.15); font-weight:bold;">${sub.subject}${addlBadge}</td>
                <td style="padding:8px; border:1px solid rgba(0,0,0,0.15); text-align:center;">${sub.max || 100}</td>
                <td style="padding:8px; border:1px solid rgba(0,0,0,0.15); text-align:center;">${sub.total || 0}</td>
            </tr>`;
        });
        
        return `<div style="margin-bottom: 25px;">
            <div style="background: ${c.color}; color: #fff; padding: 8px 15px; font-weight: bold; border-radius: 6px 6px 0 0; text-align:center;">${examName.toUpperCase()}</div>
            <table style="width:100%; border-collapse: collapse; font-size: 14px; background: transparent;">
                <tr style="background: rgba(0,0,0,0.05);">
                    <th style="padding:8px; border:1px solid rgba(0,0,0,0.15); text-align:left;">Subject</th>
                    <th style="padding:8px; border:1px solid rgba(0,0,0,0.15); text-align:center; width:80px;">Max</th>
                    <th style="padding:8px; border:1px solid rgba(0,0,0,0.15); text-align:center; width:80px;">Obtained</th>
                </tr>
                ${rows}
            </table>
            <div style="display:flex; justify-content:flex-end; padding: 8px; border:1px solid rgba(0,0,0,0.15); border-top:none; font-weight:bold; font-size: 14px;">
                Total: ${ex.totalMarks} | Grade: ${ex.grade}
            </div>
        </div>`;
    }

    // Generate Final Grand Total Table
    let allSubjectsMap = {};
    stdGroup.exams.forEach(ex => {
        let subs = [];
        try { subs = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : (ex.subjectMarks || []); } catch(e) {}
        subs.forEach(sub => {
            if (!allSubjectsMap[sub.subject]) allSubjectsMap[sub.subject] = { max: 0, obtained: 0, subRef: sub };
            allSubjectsMap[sub.subject].max += parseFloat(sub.max) || 100;
            allSubjectsMap[sub.subject].obtained += parseFloat(sub.total) || 0;
        });
    });

    let grandTableRows = '';
    let superMax = 0;
    let superObtained = 0;
    
    Object.keys(allSubjectsMap).forEach(subName => {
        const sData = allSubjectsMap[subName];
        superMax += sData.max;
        superObtained += sData.obtained;
        const subPerc = sData.max > 0 ? ((sData.obtained / sData.max) * 100).toFixed(1) : 0;
        const isMain = isSubjectMain(subName, stdGroup.className, sData.subRef);
        const addlBadge = !isMain ? `<span style="font-size:7pt; font-weight:800; color:#b45309; background:#fef3c7; border:1px solid #fde68a; border-radius:3px; padding:1px 4px; margin-left:5px;">ADDITIONAL</span>` : '';
        grandTableRows += `<tr>
            <td style="padding:10px; border:1px solid rgba(0,0,0,0.15); font-weight:bold; font-size: 15px;">${subName}${addlBadge}</td>
            <td style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center; font-size: 15px;">${sData.max}</td>
            <td style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center; font-size: 15px; font-weight:bold; color:${c.color};">${sData.obtained}</td>
            <td style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center; font-size: 15px;">${subPerc}%</td>
        </tr>`;
    });

    const superPercentage = superMax > 0 ? ((superObtained / superMax) * 100).toFixed(1) : 0;
    let superGrade = 'E';
    if(superPercentage >= 91) superGrade = 'A+';
    else if(superPercentage >= 81) superGrade = 'A';
    else if(superPercentage >= 71) superGrade = 'B+';
    else if(superPercentage >= 61) superGrade = 'B';
    else if(superPercentage >= 51) superGrade = 'C';
    else if(superPercentage >= 33) superGrade = 'D';

    const overlayHtml = `<div style="position: absolute; inset: 0; background: rgba(255,255,255,${1 - config.bgOpacity}); pointer-events: none; z-index: 0;"></div>`;

    // ── PAGE 1 (FRONT) ──
    const page1 = `
    <div style="width: 210mm; min-height: 297mm; page-break-after: always; padding: 15mm; box-sizing: border-box; position: relative; overflow: hidden; margin: 0 auto; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border: ${borderVal}; font-family: ${c.font}; ${fontColorStyle} ${bgStyle}">
        ${overlayHtml}
        <div style="position: relative; z-index: 1;">
            <div style="text-align:center; border-bottom: 3px double ${c.color}; padding-bottom: 15px; margin-bottom: 25px;">
                <h1 style="margin:0; font-size: 32px; text-transform: uppercase; color: ${c.color}; font-weight: 900;">${schoolName}</h1>
                <p style="margin:8px 0; font-size: 16px; font-weight: bold; letter-spacing: 1px;">CONSOLIDATED ANNUAL REPORT CARD</p>
                <div style="background: ${c.color}; color: ${config.fontColor || '#fff'}; display:inline-block; padding: 6px 25px; font-weight:bold; margin-top:5px; border-radius: 20px; font-size: 14px;">ACADEMIC SESSION: ${stdGroup.session}</div>
            </div>
            
            <div style="display:flex; justify-content: space-between; margin-bottom: 30px; background: rgba(255,255,255,0.7); padding: 15px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1);">
                <table style="width:75%; font-size: 16px; line-height:1.8;">
                    <tr><td style="font-weight:bold; width: 150px;">Student Name:</td><td contenteditable="true" style="font-weight:900; font-size: 18px; color: ${c.color};">${stdGroup.studentName}</td></tr>
                    <tr><td style="font-weight:bold;">Class & Section:</td><td contenteditable="true">${stdGroup.className}</td></tr>
                    <tr><td style="font-weight:bold;">Roll No:</td><td contenteditable="true">${stdGroup.rollNo}</td></tr>
                    <tr><td style="font-weight:bold;">Admission No:</td><td contenteditable="true">${student.admissionNo || '-'}</td></tr>
                    <tr><td style="font-weight:bold;">Father's Name:</td><td contenteditable="true">${formatParentName(student.fatherName)}</td></tr>
                </table>
                <div style="width: 110px; height: 130px; border: 3px solid ${c.color}; border-radius: 8px; overflow: hidden; background: #fff; display:flex; justify-content:center; align-items:center;">
                    <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff;" />
                </div>
            </div>

            <div style="text-align:center; font-weight:bold; font-size: 18px; margin-bottom: 15px; color: ${c.color}; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 5px;">TERM 1 EVALUATIONS</div>
            ${term1Exams.map(renderExamTable).join('')}
        </div>
    </div>`;

    // ── PAGE 2 (BACK) ──
    const page2 = `
    <div style="width: 210mm; min-height: 297mm; page-break-after: always; padding: 15mm; box-sizing: border-box; position: relative; overflow: hidden; margin: 0 auto; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); border: ${borderVal}; font-family: ${c.font}; ${fontColorStyle} ${bgStyle}">
        ${overlayHtml}
        <div style="position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column;">
            
            <div style="text-align:center; font-weight:bold; font-size: 18px; margin-bottom: 15px; color: ${c.color}; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 5px;">TERM 2 & FINAL EVALUATIONS</div>
            ${term2Exams.map(renderExamTable).join('')}

            <div style="margin-top: 20px; margin-bottom: 20px;">
                <div style="background: ${c.color}; color: #fff; padding: 10px; font-weight: bold; border-radius: 8px 8px 0 0; text-align:center; font-size: 18px; text-transform: uppercase;">Final Grand Aggregate (All Exams)</div>
                <table style="width:100%; border-collapse: collapse; font-size: 15px; background: rgba(255,255,255,0.8);">
                    <tr style="background: rgba(0,0,0,0.05);">
                        <th style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:left;">Subject</th>
                        <th style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Total Max</th>
                        <th style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Total Obtained</th>
                        <th style="padding:10px; border:1px solid rgba(0,0,0,0.15); text-align:center;">Subject %</th>
                    </tr>
                    ${grandTableRows}
                </table>
                <div style="display:flex; justify-content:space-around; align-items:center; padding: 15px; border:1px solid rgba(0,0,0,0.15); border-top:none; background: rgba(255,255,255,0.9);">
                    <div style="text-align:center;"><div style="font-size:12px; font-weight:bold; color:#666;">GRAND TOTAL</div><div style="font-size:24px; font-weight:900; color:${c.color};" contenteditable="true">${superObtained} / ${superMax}</div></div>
                    <div style="text-align:center;"><div style="font-size:12px; font-weight:bold; color:#666;">FINAL PERCENTAGE</div><div style="font-size:24px; font-weight:900; color:${c.color};" contenteditable="true">${superPercentage}%</div></div>
                    <div style="text-align:center;"><div style="font-size:12px; font-weight:bold; color:#666;">OVERALL GRADE</div><div style="font-size:24px; font-weight:900; color:${c.color};" contenteditable="true">${superGrade}</div></div>
                </div>
            </div>

            <div style="width: 100%; border: 1px solid rgba(0,0,0,0.15); padding: 10px; background: rgba(255,255,255,0.8); border-radius: 8px; margin-bottom: 20px;">
                <div style="font-weight: bold; font-size: 12px; text-align:center; margin-bottom: 10px; color:${c.color};">Performance Graph</div>
                <div style="width: 100%; height: 160px; position: relative;">
                    <canvas id="consolidatedChart_${stdGroup.rollNo}" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>

            <div style="margin-top: auto; display:flex; justify-content: space-between; align-items: flex-end; padding-top: 30px;">
                <div style="text-align: center; width: 180px;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 14px;">Class Teacher</div>
                </div>
                <div style="text-align: center; width: 180px;">
                    <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 14px;">Principal</div>
                </div>
            </div>
        </div>
    </div>`;

    return page1 + page2;
}

function renderConsolidatedChart(canvas, stdGroup, reqExams) {
    if (!window.Chart) return;
    
    // Calculate final subject percentages
    let allSubjectsMap = {};
    stdGroup.exams.forEach(ex => {
        let subs = [];
        try { subs = typeof ex.subjectMarks === 'string' ? JSON.parse(ex.subjectMarks) : (ex.subjectMarks || []); } catch(e) {}
        subs.forEach(sub => {
            if (!allSubjectsMap[sub.subject]) allSubjectsMap[sub.subject] = { max: 0, obtained: 0 };
            allSubjectsMap[sub.subject].max += parseFloat(sub.max) || 100;
            allSubjectsMap[sub.subject].obtained += parseFloat(sub.total) || 0;
        });
    });

    const labels = Object.keys(allSubjectsMap);
    const dataPoints = labels.map(sub => {
        const d = allSubjectsMap[sub];
        return d.max > 0 ? ((d.obtained / d.max) * 100).toFixed(1) : 0;
    });

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Final Subject Percentage',
                data: dataPoints,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { callback: function(value) { return value + "%" } } },
                x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}
