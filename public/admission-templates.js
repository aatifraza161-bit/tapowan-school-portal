/**
 * Tapowan Public School - Enterprise Multi-Size Admission Form Studio & Templates Engine
 * 
 * Key Features:
 * 1. DYNAMIC ERP DATA FETCHING: School name, affiliation, address, phone, email, website,
 *    logo, and principal are fetched live from ERP Settings (`getStore().settings` / `serverStore.settings`)
 *    instead of being hardcoded.
 * 2. UNIVERSAL DOB & AGE CALCULATION: Parses any date format (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
 *    and dynamically computes candidate's exact age on 31st March of the academic session (e.g. "4 Yrs 9 Mos").
 *    Formats DOB in formal words (e.g. "First of June Two Thousand Twenty-One").
 * 3. 100% FULL-PAGE VERTICAL FIT: All 5 templates (A4, A5, A3) use a flexbox architecture with
 *    `justify-content: space-between` and explicit target heights (`1055px` on A4), eliminating empty bottom gaps.
 * 4. 5 Publication-Grade Institutional Themes:
 *    - 01. CBSE Modern Executive (Navy & Gold)
 *    - 02. Royal Heritage Classical (Burgundy & Bronze)
 *    - 03. Modern Minimalist Pro (Indigo & Slate)
 *    - 04. CBSE Official Box-Grid (Board Examination Standard)
 *    - 05. Dual Counter & Parent Copy (Perforated Split)
 */

(function (window, document) {
  "use strict";

  // --- PAPER SIZES SPECIFICATION WITH EXACT FULL-PAGE DIMENSIONS ---
  const ADMISSION_SIZES = {
    a4: {
      id: "a4",
      name: "A4 Standard (210 × 297 mm)",
      sub: "Official Student Dossier & School Archive Standard",
      widthMm: 210,
      heightMm: 297,
      orientation: "portrait",
      pageRule: "@page { size: A4 portrait; margin: 0; }",
      previewWidth: "794px",
      previewMinHeight: "1123px",
      targetDocHeight: "1123px"
    },
    a5: {
      id: "a5",
      name: "A5 Compact (148 × 210 mm)",
      sub: "Quick Admission Slip / Counter Acknowledgment",
      widthMm: 148,
      heightMm: 210,
      orientation: "portrait",
      pageRule: "@page { size: A5 portrait; margin: 0; }",
      previewWidth: "560px",
      previewMinHeight: "794px",
      targetDocHeight: "794px"
    },
    a3: {
      id: "a3",
      name: "A3 Double Spread (420 × 297 mm)",
      sub: "2-Page Prospectus Dossier & Legal Annexure Folio",
      widthMm: 420,
      heightMm: 297,
      orientation: "landscape",
      pageRule: "@page { size: A3 landscape; margin: 0; }",
      previewWidth: "1588px",
      previewMinHeight: "1123px",
      targetDocHeight: "1123px"
    }
  };

  // --- DYNAMIC ERP SCHOOL DATA RESOLVER ---
  function getSchoolMeta(customMeta = null) {
    if (customMeta && typeof customMeta === "object") return customMeta;

    let store = {};
    try {
      if (typeof getStore === "function") store = getStore() || {};
      else if (typeof serverStore !== "undefined") store = serverStore || {};
    } catch (_) {}

    const settingsList = Array.isArray(store.settings) ? store.settings : [];
    const getSettingVal = (k) => {
      const row = settingsList.find(s => String(s.key || s.KEY || '').toLowerCase() === k.toLowerCase());
      return row && row.value ? String(row.value).trim() : null;
    };

    // Check ai_school_knowledge for parsed fallback address & principal
    let aiPrincipal = null;
    let aiAddress = null;
    const aiKnowledge = getSettingVal('ai_school_knowledge');
    if (aiKnowledge) {
      const pMatch = aiKnowledge.match(/Principal\s+(?:Name\s+)?is\s+([^\n\r]+)/i);
      if (pMatch) aiPrincipal = pMatch[1].trim();
      const aMatch = aiKnowledge.match(/School\s+address\s+is\s+([^\n\r]+)/i);
      if (aMatch) aiAddress = aMatch[1].trim();
    }

    const name = getSettingVal('school_name') || (window.currentSchool && window.currentSchool.name) || "TAPOWAN PUBLIC SCHOOL";
    const tagline = getSettingVal('school_tagline') || "Quality Education for a Brighter Future";
    const affiliation = getSettingVal('school_affiliation') || (window.currentSchool && window.currentSchool.affiliation) || "";
    const campus = getSettingVal('school_address') || aiAddress || "Prem Nagar Tapin North, Ramgarh, Jharkhand - 825314";
    const phone = getSettingVal('school_phone') || "+91 74880 61954, +91 95256 40237";
    const email = getSettingVal('school_email') || "info@tapowanschool.edu.in";
    const website = getSettingVal('school_website') || "tapowan-school.pages.dev";
    const udise = getSettingVal('school_udise') || "UDISE Code: 20040506702";
    const logo = getSettingVal('school_logo') || "logo.png";
    const principal = getSettingVal('school_principal') || aiPrincipal || "Triveni Singh";
    const estd = getSettingVal('school_estd') || "Estd. 2012";

    return {
      name,
      tagline,
      affiliation,
      campus,
      phone,
      email,
      website,
      contact: `Phone: ${phone} | Email: ${email} | Web: ${website}`,
      udise,
      logo,
      principal,
      estd
    };
  }

  // --- NUMBER TO WORDS HELPER ---
  function numberToWords(num) {
    if (!num || isNaN(num)) return "";
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";
    let str = "";
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + " Crore " : "";
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + " Lakh " : "";
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + " Thousand " : "";
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + " Hundred " : "";
    str += (n[5] != 0) ? ((str != "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]]) : "";
    return str.trim();
  }

  // --- UNIVERSAL DATE PARSER ---
  function parseUniversalDate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    const trimmed = dateStr.trim();

    // 1. Matches DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
    let m = trimmed.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const y = parseInt(m[3], 10);
      const dt = new Date(y, mo, d);
      if (!isNaN(dt.getTime())) return { date: dt, day: d, month: mo, year: y };
    }

    // 2. Matches YYYY.MM.DD or YYYY/MM/DD or YYYY-MM-DD
    m = trimmed.match(/^(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})$/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const d = parseInt(m[3], 10);
      const dt = new Date(y, mo, d);
      if (!isNaN(dt.getTime())) return { date: dt, day: d, month: mo, year: y };
    }

    // 3. Fallback to native Date
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      return { date: dt, day: dt.getDate(), month: dt.getMonth(), year: dt.getFullYear() };
    }
    return null;
  }

  // --- DYNAMIC AGE CALCULATION AS ON 31ST MARCH OF THE SESSION ---
  function calculateAgeFromDob(dateStr, sessionStr = "2026-2027") {
    const parsed = parseUniversalDate(dateStr);
    if (!parsed) return "-";

    // Extract admission session reference year (e.g. "2026-2027" -> 2026)
    let refYear = 2026;
    const sessMatch = (sessionStr || "").match(/(\d{4})/);
    if (sessMatch) {
      refYear = parseInt(sessMatch[1], 10);
    }

    let years = refYear - parsed.year;
    let months = 2 - parsed.month; // 2 = March (0-indexed: 0=Jan, 1=Feb, 2=Mar)
    let days = 31 - parsed.day;

    if (days < 0) {
      months -= 1;
      days += 31;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0) return "Under 1 Yr";
    if (months > 0) return `${years} Yrs ${months} Mos`;
    return `${years} Yrs`;
  }

  // --- DATE IN FORMAL WORDS ---
  function dateToWords(dateStr) {
    if (!dateStr) return "";
    const parsed = parseUniversalDate(dateStr);
    if (!parsed) return dateStr;

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const ordinals = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
      "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
      "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"];

    const dayWord = ordinals[parsed.day] || parsed.day;
    const monthWord = months[parsed.month] || "";
    const yearWord = numberToWords(parsed.year);
    return `${dayWord} of ${monthWord} ${yearWord}`.trim();
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "-";
    const parsed = parseUniversalDate(dateStr);
    if (parsed) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${String(parsed.day).padStart(2, "0")} ${months[parsed.month]} ${parsed.year}`;
    }
    return dateStr;
  }

  // --- DATA NORMALIZATION ENGINE ---
  function normalizeAdmissionStudentData(raw) {
    if (!raw) return {};
    const d = typeof raw === "object" ? { ...raw } : {};

    // Basic Data
    const fullName = (d.fullName || d.studentName || d.name || "Student Name").trim();
    const admissionNo = (d.admissionNo || d.admission_no || d.admNo || "TPS-" + (d.id || "TEMP")).trim();
    const rollNo = (d.rollNo || d.roll_no || d.roll || "1").toString().trim();
    const className = (d.classApplyingFor || d.className || d.class || "General").trim();
    const section = (d.section || "A").trim();
    const session = (d.session || "2026-2027").trim();

    // Universal DOB & Dynamic Age Calculation
    const dob = (d.dob || d.dateOfBirth || "2015-01-01").trim();
    const dobWords = dateToWords(dob);
    const age = calculateAgeFromDob(dob, session);

    const gender = (d.gender || "Male").trim();
    const category = (d.category || "General").trim();
    const religion = (d.religion || "Hindu").trim();
    const motherTongue = (d.motherTongue || "Hindi").trim();
    const nationality = (d.nationality || "Indian").trim();
    const bloodGroup = (d.bloodGroup || d.blood_group || "B+").trim();
    const formatAadharNumber = (raw) => {
      if (!raw || (typeof raw !== "string" && typeof raw !== "number")) return "N/A";
      const str = String(raw).trim().replace(/[^0-9]/g, "");
      if (!str || str === "0" || str.length < 4) return "N/A";
      if (str.length === 12) {
        return str.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
      }
      return str;
    };

    const rawAadhar = (d.studentAadharNo || d.aadharNo || d.studentAadhar || d.aadhar || "").trim();
    const aadharFormatted = formatAadharNumber(rawAadhar);

    const rawFatherAadhar = (d.fatherAadharNo || d.fatherAadhar || d.father_aadhar || d.fatherAadharNumber || "").trim();
    const fatherAadharFormatted = formatAadharNumber(rawFatherAadhar);

    const rawMotherAadhar = (d.motherAadharNo || d.motherAadhar || d.mother_aadhar || d.motherAadharNumber || "").trim();
    const motherAadharFormatted = formatAadharNumber(rawMotherAadhar);

    // Parents & Guardians
    const fatherName = (d.fatherName || d.father_name || "Father Name").trim();
    const motherName = (d.motherName || d.mother_name || "Mother Name").trim();
    const guardianName = (d.guardianName || d.guardian_name || fatherName || "-").trim();
    const relation = (d.relation || (guardianName === fatherName ? "Father" : "Guardian")).trim();
    const fatherOccupation = (d.fatherOccupation || d.occupation || "Business / Private").trim();
    const motherOccupation = (d.motherOccupation || "Homemaker").trim();
    const fatherQualification = (d.fatherQualification || "Graduate").trim();
    const motherQualification = (d.motherQualification || "Intermediate / Graduate").trim();
    const incomeRange = (d.incomeRange || "1 - 3 Lakhs").trim();

    // Contact & Address
    const phone1 = (d.phone1 || d.phone || d.mobile || "7488061954").trim();
    const phone2 = (d.phone2 || "-").trim();
    const whatsapp = (d.whatsapp || phone1 || "-").trim();
    const email = (d.email || (fullName.toLowerCase().replace(/\s+/g, "") + "@gmail.com")).trim();
    const emergencyContact = (d.emergencyContact || phone1 || "-").trim();
    const village = (d.village || d.address || "Prem Nagar").trim();
    const post = (d.post || "Prem Nagar").trim();
    const district = (d.district || "Hazaribagh").trim();
    const state = (d.state || "Jharkhand").trim();
    const pin = (d.pin || d.pincode || "825301").trim();
    const fullAddress = d.address ? d.address.trim() : `${village}, P.O: ${post}, Dist: ${district}, ${state} - ${pin}`;

    // Academic & Commute
    const prevSchool = (d.prevSchool || d.previousSchool || "N/A").trim();
    const lastClassPassed = (d.lastClassPassed || "N/A").trim();
    const tcReceived = (d.tcReceived || (d.tcDoc ? "Yes" : "No")).trim();
    const siblingDetails = (d.siblingDetails || "None").trim();
    const transportRoute = (d.transportFee > 0 || d.transportRoute) ? "School Bus (Route-04, Prem Nagar)" : "Private / Self Arrangement";

    // Financials
    const admissionFee = parseFloat(d.admissionFee) || 1600;
    const monthlyFee = parseFloat(d.monthlyFee) || 599;
    const transportFee = parseFloat(d.transportFee) || 0;
    const discount = parseFloat(d.discount) || 0;
    const totalPayable = Math.max(0, admissionFee + monthlyFee + transportFee - discount);

    // Photos & Documents
    const photoUrl = d.photo || d.photoUrl || d.avatar || "";
    const hasBirthCert = Boolean(d.birthCert || d.birth_cert || true);
    const hasAadharDoc = Boolean(d.aadharDoc || d.aadhar_doc || (rawAadhar && rawAadhar !== "N/A"));
    const hasTcDoc = Boolean(d.tcDoc || d.tc_doc || tcReceived === "Yes");
    const hasParentId = Boolean(d.parentIdDoc || d.parent_id_doc || true);

    // Form Meta
    const formNo = "ADM-2026-" + String(d.id || admissionNo).replace(/\D/g, "").padStart(4, "0");
    const admissionDate = formatDisplayDate(d.admissionDate || d.created_at || new Date().toISOString());

    return {
      fullName, admissionNo, rollNo, className, section, session,
      dob, dobWords, age, gender, category, religion, motherTongue, nationality, bloodGroup,
      aadhar: aadharFormatted, rawAadhar,
      fatherAadhar: fatherAadharFormatted, motherAadhar: motherAadharFormatted,
      rawFatherAadhar, rawMotherAadhar,
      fatherName, motherName, guardianName, relation,
      fatherOccupation, motherOccupation, fatherQualification, motherQualification, incomeRange,
      phone1, phone2, whatsapp, email, emergencyContact,
      village, post, district, state, pin, fullAddress,
      prevSchool, lastClassPassed, tcReceived, siblingDetails, transportRoute,
      admissionFee, monthlyFee, transportFee, discount, totalPayable,
      photoUrl, hasBirthCert, hasAadharDoc, hasTcDoc, hasParentId,
      formNo, admissionDate,
      status: d.status || "Approved"
    };
  }

  // --- CHARACTER BOX GENERATOR ---
  function renderCharBoxes(text, boxCount) {
    const clean = (text || "").toUpperCase().replace(/[^A-Z0-9\s]/g, "");
    let html = '<div class="tps-char-boxes" style="display:flex;gap:3px;flex-wrap:nowrap;">';
    for (let i = 0; i < boxCount; i++) {
      const char = clean[i] || "";
      html += `<div style="width:17px;height:22px;border:1px solid #334155;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#0f172a;text-transform:uppercase;">${char}</div>`;
    }
    html += "</div>";
    return html;
  }

  // --- PHOTO BOX COMPONENT WITH PERFECT TEXT WRAPPING ---
  function renderPhotoFrame(photoUrl, label = "STUDENT PHOTO", sizeId = "a4") {
    const isA5 = sizeId === "a5";
    const w = isA5 ? "95px" : "115px";
    const h = isA5 ? "115px" : "140px";

    if (photoUrl && photoUrl.length > 20) {
      return `
        <div style="width:${w};height:${h};border:1.5px solid #1e3a8a;border-radius:4px;overflow:hidden;background:#f8fafc;position:relative;flex-shrink:0;box-sizing:border-box;">
          <img src="${photoUrl}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;" alt="${label}" onerror="this.src='student_avatar.png'" />
          <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(30,58,138,0.85);color:#ffffff;font-size:7px;font-weight:700;text-align:center;padding:1.5px 0;letter-spacing:0.5px;">${label}</div>
        </div>`;
    }
    return `
      <div style="width:${w};height:${h};border:1.5px dashed #94a3b8;border-radius:4px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4px;box-sizing:border-box;flex-shrink:0;">
        <span class="material-symbols-outlined" style="font-size:${isA5 ? '22px' : '28px'};color:#94a3b8;margin-bottom:2px;">add_a_photo</span>
        <div style="font-size:7.5px;font-weight:700;color:#475569;line-height:1.2;text-transform:uppercase;">
          AFFIX RECENT<br>PASSPORT PHOTO<br><span style="font-size:6.5px;color:#94a3b8;">(3.5 × 4.5 cm)</span>
        </div>
      </div>`;
  }

  // =========================================================================
  // TEMPLATE 1: CBSE MODERN EXECUTIVE (Navy Blue & Royal Gold)
  // FULL PAGE VERTICAL DISTRIBUTION GUARANTEE
  // =========================================================================
  function renderCbseModern(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8.5px" : "10px";
    const fHead = isA5 ? "9px" : "10.5px";
    const pCell = isA5 ? "3.5px 6px" : "5.5px 9px";
    const school = getSchoolMeta();

    return `
    <div class="tps-adm-doc tps-cbse-modern" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;position:relative;line-height:1.3;font-size:${fBase};display:flex;flex-direction:column;justify-content:space-between;height:100%;border:2px solid #1e3a8a;border-radius:6px;padding:${isA5 ? '8px 10px' : '10px 14px'};">
      
      <!-- Faint Background Watermark -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.04;pointer-events:none;z-index:0;width:380px;height:380px;">
        <img src="${school.logo}" style="width:100%;height:100%;object-fit:contain;" alt="Watermark" />
      </div>

      <div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:${isA5 ? '6px' : '8px'};">
        
        <!-- INSTITUTIONAL BRANDING HEADER (DYNAMIC ERP DATA) -->
        <div style="border-bottom:2px solid #1e3a8a;padding-bottom:5px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
            <img src="${school.logo}" crossorigin="anonymous" style="width:${isA5 ? '44px' : '58px'};height:${isA5 ? '44px' : '58px'};object-fit:contain;flex-shrink:0;" alt="Crest" onerror="this.src='logo.png'" />
            <div style="min-width:0;">
              <div style="font-size:${isA5 ? '14px' : '19px'};font-weight:900;color:#1e3a8a;letter-spacing:0.5px;line-height:1.1;text-transform:uppercase;">${school.name}</div>
              <div style="font-size:${isA5 ? '8px' : '9.5px'};font-weight:700;color:#d97706;letter-spacing:0.3px;margin-top:1px;">${school.tagline}</div>
              ${school.affiliation ? `<div style="font-size:${isA5 ? '7px' : '8px'};color:#475569;margin-top:1px;font-weight:600;">${school.affiliation}</div>` : ''}
              <div style="font-size:${isA5 ? '6.5px' : '7.5px'};color:#64748b;margin-top:1px;">${school.campus}${school.udise ? ` • ${school.udise}` : ''}${school.phone ? ` • Tel: ${school.phone}` : ''}</div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="display:inline-block;background:#1e3a8a;color:#ffffff;font-size:${isA5 ? '8px' : '10px'};font-weight:800;padding:2.5px 8px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap;">ADMISSION APPLICATION</div>
            <div style="font-size:${isA5 ? '7.5px' : '9px'};font-weight:700;color:#0f172a;margin-top:2px;white-space:nowrap;">Session: <span style="color:#d97706;">${s.session}</span></div>
            <div style="font-size:${isA5 ? '7px' : '7.5px'};color:#475569;white-space:nowrap;">Sl. No: <strong>${s.formNo}</strong> | Date: <strong>${s.admissionDate}</strong></div>
            <div style="font-size:${isA5 ? '7px' : '7.5px'};color:#16a34a;font-weight:700;white-space:nowrap;">Status: Verified &amp; Approved</div>
          </div>
        </div>

        <!-- SECTION 1: SCHOLAR BIOGRAPHICAL RECORD -->
        <div>
          <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${fHead};padding:3.5px 8px;border-radius:4px 4px 0 0;letter-spacing:0.4px;display:flex;justify-content:space-between;align-items:center;">
            <span>1. SCHOLAR'S GENERAL &amp; BIOGRAPHICAL PARTICULARS</span>
            <span style="font-size:8px;color:#fde047;white-space:nowrap;margin-left:8px;">Reg. No: ${s.admissionNo}</span>
          </div>
          <div style="display:flex;gap:10px;align-items:stretch;">
            <table style="flex:1;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};">
              <tr style="background:#f8fafc;">
                <td style="width:23%;padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Full Name of Scholar</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;" colspan="3">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:${isA5 ? '9.5px' : '12px'};">${s.fullName}</span>
                    <span style="font-size:8px;color:#1e3a8a;font-weight:800;border:1px solid #bfdbfe;padding:1px 6px;border-radius:3px;background:#eff6ff;">Class: ${s.className} (${s.section}) • Roll: ${s.rollNo}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Date of Birth (DOB)</td>
                <td style="width:27%;padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${s.dob}</td>
                <td style="width:23%;padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Age (on 31st March)</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#2563eb;">${s.age}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">DOB in Words</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-style:italic;color:#1e3a8a;font-weight:700;" colspan="3">${s.dobWords}</td>
              </tr>
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Gender / Blood Group</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.gender} / <strong style="color:#dc2626;">${s.bloodGroup}</strong></td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Nationality / Religion</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.nationality} / ${s.religion}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Category / Caste</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#059669;">${s.category}</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Mother Tongue</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.motherTongue}</td>
              </tr>
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Aadhaar Number</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;letter-spacing:1px;color:#0f172a;" colspan="3">${s.aadhar}</td>
              </tr>
            </table>
            ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO", sizeId)}
          </div>
        </div>

        <!-- SECTION 2: PARENT & GUARDIAN DIRECTORY -->
        <div>
          <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${fHead};padding:3.5px 8px;border-radius:4px 4px 0 0;letter-spacing:0.4px;">
            2. PARENTAL &amp; GUARDIAN PARTICULAR DIRECTORY
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};">
            <tr style="background:#f1f5f9;font-weight:800;color:#1e3a8a;text-align:center;">
              <td style="width:20%;padding:${pCell};border:1px solid #cbd5e1;text-align:left;">Particulars</td>
              <td style="width:28%;padding:${pCell};border:1px solid #cbd5e1;">Father's Details</td>
              <td style="width:28%;padding:${pCell};border:1px solid #cbd5e1;">Mother's Details</td>
              <td style="width:24%;padding:${pCell};border:1px solid #cbd5e1;">Guardian (if any)</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Full Legal Name</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;">${s.fatherName}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;">${s.motherName}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.guardianName} (${s.relation})</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Aadhaar Number</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;letter-spacing:0.5px;">${s.fatherAadhar}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;letter-spacing:0.5px;">${s.motherAadhar}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;color:#64748b;">-</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Qualification &amp; Occ.</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.fatherQualification} • ${s.fatherOccupation}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.motherQualification} • ${s.motherOccupation}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">Private / Service</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Mobile Numbers</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#2563eb;">${s.phone1}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#2563eb;">${s.phone2 !== '-' ? s.phone2 : s.whatsapp}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#2563eb;">${s.emergencyContact}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">WhatsApp &amp; Income</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;">WA: ${s.whatsapp}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;">Income: ${s.incomeRange}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;">Email: ${s.email}</td>
            </tr>
          </table>
        </div>

        <!-- SECTION 3: ADDRESS & TRANSPORT FACILITY -->
        <div>
          <div style="display:flex;gap:10px;">
            <div style="flex:1;">
              <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${fHead};padding:3.5px 8px;border-radius:4px 4px 0 0;letter-spacing:0.4px;">
                3. POSTAL ADDRESS &amp; EMERGENCY NOTIFICATION
              </div>
              <div style="border:1px solid #cbd5e1;padding:${pCell};background:#ffffff;height:calc(100% - 24px);box-sizing:border-box;">
                <div><strong>Present &amp; Permanent Residence:</strong> ${s.fullAddress}</div>
                <div style="margin-top:2px;"><strong>Village/Town:</strong> ${s.village} | <strong>District:</strong> ${s.district} | <strong>PIN:</strong> ${s.pin}</div>
                <div style="margin-top:2px;color:#dc2626;font-weight:700;"><strong>Emergency Notification Contact:</strong> ${s.emergencyContact} (${s.relation})</div>
              </div>
            </div>
            <div style="width:36%;">
              <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${fHead};padding:3.5px 8px;border-radius:4px 4px 0 0;letter-spacing:0.4px;">
                4. TRANSPORT &amp; COMMUTE
              </div>
              <div style="border:1px solid #cbd5e1;padding:${pCell};background:#ffffff;height:calc(100% - 24px);box-sizing:border-box;">
                <div><strong>Transport Facility:</strong> ${s.transportRoute}</div>
                <div style="margin-top:2px;"><strong>Pickup / Drop Point:</strong> Prem Nagar Bypass</div>
                <div style="margin-top:2px;"><strong>Siblings in TPS:</strong> ${s.siblingDetails}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 5: PREVIOUS ACADEMIC RECORD & FEES -->
        <div>
          <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${fHead};padding:3.5px 8px;border-radius:4px 4px 0 0;letter-spacing:0.4px;">
            5. PREVIOUS INSTITUTIONAL RECORD &amp; ADMISSION FEE CLEARANCE
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};">
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;width:24%;">Previous School Attended</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;" colspan="2">${s.prevSchool}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;width:20%;">Last Class Passed / TC</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">Class ${s.lastClassPassed} (TC: ${s.tcReceived})</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#166534;">Admission Fee</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">₹${s.admissionFee.toLocaleString("en-IN")}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#166534;">Monthly Tuition</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">₹${s.monthlyFee.toLocaleString("en-IN")}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:900;color:#166534;font-size:${isA5 ? '9.5px' : '11px'};">Total Paid: ₹${s.totalPayable.toLocaleString("en-IN")}</td>
            </tr>
          </table>
        </div>

        <!-- SECTION 6: MANDATORY DOCUMENT VERIFICATION MATRIX -->
        <div style="border:1px solid #cbd5e1;padding:5px 8px;background:#f8fafc;border-radius:4px;">
          <div style="font-weight:800;color:#1e3a8a;font-size:9px;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px;">
            6. MANDATORY ENCLOSURES &amp; STATUTORY DOCUMENT VERIFICATION MATRIX
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font-size:8px;color:#334155;">
            <div>${s.hasBirthCert ? '[✔]' : '[  ]'} Birth Certificate (Original)</div>
            <div>${s.hasAadharDoc ? '[✔]' : '[  ]'} Student Aadhaar Copy</div>
            <div>${s.hasTcDoc ? '[✔]' : '[  ]'} Transfer Certificate (TC)</div>
            <div>[✔] Previous Year Marksheet</div>
            <div>${s.hasParentId ? '[✔]' : '[  ]'} Parent ID Proof (Aadhaar)</div>
            <div>[✔] 4 Passport Photographs</div>
            <div>[✔] Medical Fitness / Blood Grp</div>
            <div>[✔] Category Certificate (${s.category})</div>
          </div>
        </div>

        <!-- SECTION 7: STATUTORY PARENTAL DECLARATION & UNDERTAKING -->
        <div style="border:1px solid #1e3a8a;border-radius:4px;padding:6px 10px;background:#ffffff;">
          <div style="font-size:7.5px;color:#475569;text-align:justify;line-height:1.25;">
            <strong style="color:#1e3a8a;">STATUTORY PARENTAL DECLARATION &amp; UNDERTAKING:</strong> I hereby solemnly declare that all particulars stated in this application are true, complete, and authentic to the best of my knowledge and belief. I agree to abide by all the academic, administrative, disciplinary, uniform, and fee regulations of ${school.name}. I understand that admission may be cancelled at any time if any document or representation is found inaccurate.
          </div>
          
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;">
            <div style="text-align:center;width:28%;">
              <div style="border-top:1px solid #475569;padding-top:2px;font-weight:700;font-size:8px;color:#334155;">Signature of Father / Guardian</div>
            </div>
            <div style="text-align:center;width:28%;">
              <div style="border-top:1px solid #475569;padding-top:2px;font-weight:700;font-size:8px;color:#334155;">Signature of Mother</div>
            </div>
            <div style="text-align:center;width:34%;">
              <div style="border-top:1.5px solid #1e3a8a;padding-top:2px;font-weight:800;font-size:8.5px;color:#1e3a8a;">Admission Scrutiny In-Charge</div>
            </div>
          </div>
        </div>

        <!-- SECTION 8: FOR OFFICE USE ONLY (INSTITUTIONAL APPROVAL DOCKET) -->
        <div style="border:1.5px solid #1e3a8a;border-radius:4px;padding:6px 10px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:8px;color:#334155;line-height:1.35;flex:1;">
            <span style="font-weight:900;color:#1e3a8a;text-transform:uppercase;font-size:8.5px;">FOR OFFICE USE ONLY • REGISTRATION REGISTRY:</span><br />
            Enrolment Approved to Class: <strong>${s.className}</strong> | Section: <strong>${s.section}</strong> | Assigned Roll No: <strong>${s.rollNo}</strong> | Reg No: <strong>${s.admissionNo}</strong><br />
            Fee Clearance Voucher: <strong>PAID ₹${s.totalPayable.toLocaleString("en-IN")}</strong> | Receipt No: <strong>TPS-REC-${s.formNo}</strong> | Accounts Clearance: <span style="color:#16a34a;font-weight:800;">VERIFIED</span>
          </div>
          <div style="text-align:center;border-left:1px dashed #cbd5e1;padding-left:10px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;min-width:110px;">
            <div style="width:80px;height:32px;border:1px dashed #1e3a8a;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:6.5px;font-weight:700;color:#1e3a8a;background:#ffffff;margin-bottom:2px;">
              OFFICIAL SEAL
            </div>
            <div style="font-size:7.5px;font-weight:800;color:#1e3a8a;white-space:nowrap;">${school.principal ? `${school.principal} (Principal)` : "Principal's Signature"}</div>
          </div>
        </div>

        <!-- FOOTER BAR -->
        <div style="display:flex;justify-content:space-between;font-size:7px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:2px;">
          <span>Form Code: TPS-ADM-2026-V3.6 • Generated on ${new Date().toLocaleDateString("en-IN")}</span>
          <span>Official Portal: https://${school.website} • Page 1 of 1</span>
        </div>

      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 2: ROYAL HERITAGE CLASSICAL (Burgundy & Bronze)
  // FULL PAGE VERTICAL DISTRIBUTION GUARANTEE WITH DYNAMIC ERP DATA
  // =========================================================================
  function renderRoyalHeritage(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8px" : "10px";
    const fHead = isA5 ? "8.5px" : "10.5px";
    const pCell = isA5 ? "3.5px 6px" : "5.5px 9px";
    const school = getSchoolMeta();

    return `
    <div class="tps-adm-doc tps-royal-heritage" style="font-family:'Cinzel','Georgia',serif;color:#3b1e1e;background:#fffdfa;border:3px double #881337;padding:${isA5 ? '8px 10px' : '10px 14px'};box-sizing:border-box;position:relative;line-height:1.3;font-size:${fBase};display:flex;flex-direction:column;justify-content:space-between;height:100%;">
      
      <!-- Ornate Corner Accents -->
      <div style="position:absolute;top:4px;left:4px;width:20px;height:20px;border-top:2px solid #b45309;border-left:2px solid #b45309;"></div>
      <div style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-top:2px solid #b45309;border-right:2px solid #b45309;"></div>
      <div style="position:absolute;bottom:4px;left:4px;width:20px;height:20px;border-bottom:2px solid #b45309;border-left:2px solid #b45309;"></div>
      <div style="position:absolute;bottom:4px;right:4px;width:20px;height:20px;border-bottom:2px solid #b45309;border-right:2px solid #b45309;"></div>

      <div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:${isA5 ? '5px' : '7px'};">
        <!-- HEADER (DYNAMIC ERP DATA) -->
        <div style="text-align:center;border-bottom:2px solid #881337;padding-bottom:5px;">
          <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:2px;">
            <img src="${school.logo}" style="width:${isA5 ? '44px' : '58px'};height:${isA5 ? '44px' : '58px'};object-fit:contain;" alt="Crest" />
            <div>
              <div style="font-size:${isA5 ? '16px' : '22px'};font-weight:900;color:#881337;letter-spacing:1px;text-transform:uppercase;">${school.name}</div>
              <div style="font-size:${isA5 ? '8px' : '10px'};font-weight:700;color:#78350f;letter-spacing:0.5px;font-style:italic;">${school.estd} • ${school.tagline}</div>
            </div>
          </div>
          <div style="font-size:7.5px;color:#78350f;letter-spacing:0.3px;">${school.affiliation ? `${school.affiliation} • ` : ''}${school.campus}${school.udise ? ` • ${school.udise}` : ''}${school.phone ? ` • Tel: ${school.phone}` : ''}</div>
          <div style="margin-top:4px;display:flex;justify-content:space-between;align-items:center;background:#fef2f2;border:1px solid #fecaca;padding:2px 8px;border-radius:3px;">
            <span style="font-size:8px;font-weight:700;color:#881337;">FORM NO: ${s.formNo}</span>
            <span style="font-size:${isA5 ? '9.5px' : '11.5px'};font-weight:900;color:#881337;letter-spacing:1px;text-transform:uppercase;">APPLICATION FOR ADMISSION • SESSION ${s.session}</span>
            <span style="font-size:8px;font-weight:700;color:#881337;">REG NO: ${s.admissionNo}</span>
          </div>
        </div>

        <!-- PART I: SCHOLAR BIOGRAPHICAL RECORD -->
        <div>
          <div style="background:#881337;color:#fffdfa;font-weight:700;font-size:${fHead};padding:3px 8px;letter-spacing:0.4px;">PART I : PARTICULARS OF THE SCHOLAR</div>
          <div style="display:flex;gap:10px;align-items:stretch;">
            <table style="flex:1;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};font-family:Arial,sans-serif;">
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;width:24%;color:#581c87;">Name of Scholar</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#881337;text-transform:uppercase;" colspan="3">${s.fullName}</td>
              </tr>
              <tr style="background:#fff7ed;">
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Class Admitted To</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;">${s.className} (Sec: ${s.section})</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;width:22%;">Assigned Roll No.</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;">${s.rollNo}</td>
              </tr>
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Date of Birth</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">${s.dob}</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Age (on 31st March)</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#881337;">${s.age}</td>
              </tr>
              <tr style="background:#fff7ed;">
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">DOB in Words</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-style:italic;color:#78350f;font-weight:700;" colspan="3">${s.dobWords}</td>
              </tr>
              <tr>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Gender / Blood Group</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.gender} / <strong style="color:#b91c1c;">${s.bloodGroup}</strong></td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Category / Religion</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:600;">${s.category} / ${s.religion}</td>
              </tr>
              <tr style="background:#fff7ed;">
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Aadhaar Card No.</td>
                <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;letter-spacing:1px;" colspan="3">${s.aadhar}</td>
              </tr>
            </table>
            ${renderPhotoFrame(s.photoUrl, "CANDIDATE PHOTO", sizeId)}
          </div>
        </div>

        <!-- PART II: PARENTAL & GUARDIAN RECORD -->
        <div>
          <div style="background:#881337;color:#fffdfa;font-weight:700;font-size:${fHead};padding:3px 8px;letter-spacing:0.4px;">PART II : PARENTAL &amp; GUARDIAN RECORD</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};font-family:Arial,sans-serif;">
            <tr style="background:#fdf2f8;font-weight:700;color:#881337;">
              <td style="width:22%;padding:${pCell};border:1px solid #cbd5e1;">Particulars</td>
              <td style="width:39%;padding:${pCell};border:1px solid #cbd5e1;">Father's Record</td>
              <td style="width:39%;padding:${pCell};border:1px solid #cbd5e1;">Mother's Record</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Legal Name</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;text-transform:uppercase;">${s.fatherName}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;text-transform:uppercase;">${s.motherName}</td>
            </tr>
            <tr style="background:#fff7ed;">
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Aadhaar Card No.</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;letter-spacing:0.5px;">${s.fatherAadhar}</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;letter-spacing:0.5px;">${s.motherAadhar}</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Occupation &amp; Qual.</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;">${s.fatherOccupation} (${s.fatherQualification})</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;">${s.motherOccupation} (${s.motherQualification})</td>
            </tr>
            <tr>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Phone / WhatsApp</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#881337;">${s.phone1} (WA: ${s.whatsapp})</td>
              <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#881337;">${s.phone2 !== '-' ? s.phone2 : s.phone1}</td>
            </tr>
          </table>
        </div>

        <!-- PART III: ADDRESS & ACADEMIC -->
        <div style="border:1px solid #cbd5e1;padding:${pCell};background:#ffffff;font-family:Arial,sans-serif;font-size:${fBase};">
          <div><strong>Permanent Residence Address:</strong> ${s.fullAddress}</div>
          <div style="margin-top:2px;"><strong>Previous Academic Institution:</strong> ${s.prevSchool} | <strong>Class Passed:</strong> ${s.lastClassPassed} | <strong>Transfer Cert:</strong> ${s.tcReceived}</div>
          <div style="margin-top:2px;color:#881337;font-weight:700;"><strong>Emergency Notification:</strong> ${s.emergencyContact} (${s.relation}) | <strong>Commute:</strong> ${s.transportRoute}</div>
        </div>

        <!-- PART IV: FEE CLEARANCE & CHECKLIST -->
        <div style="border:1px solid #881337;background:#fffdfa;padding:${pCell};font-family:Arial,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fecaca;padding-bottom:3px;margin-bottom:3px;">
            <div>
              <span style="font-weight:800;color:#881337;">ADMISSION FEE CLEARANCE VOUCHER:</span> Adm Fee: <strong>₹${s.admissionFee}</strong> | Tuition Fee: <strong>₹${s.monthlyFee}</strong>
            </div>
            <div style="font-size:${isA5 ? '9.5px' : '11px'};font-weight:900;color:#166534;">
              TOTAL PAID: ₹${s.totalPayable.toLocaleString("en-IN")} (Receipt: TPS-${s.formNo})
            </div>
          </div>
          <div style="font-size:7.5px;color:#581c87;">
            <strong>ENCLOSURES:</strong> [${s.hasBirthCert ? '✔' : ' '}] Birth Certificate &nbsp; [${s.hasAadharDoc ? '✔' : ' '}] Aadhaar Card &nbsp; [${s.hasTcDoc ? '✔' : ' '}] TC &nbsp; [✔] Photos &nbsp; [✔] Parent ID &nbsp; [✔] Medical Fitness
          </div>
        </div>

        <!-- STATUTORY UNDERTAKING & SIGNATURES -->
        <div style="border:1px solid #881337;padding:6px 10px;background:#fffdfa;font-family:Arial,sans-serif;">
          <div style="font-size:7px;color:#581c87;text-align:justify;line-height:1.2;">
            <strong>STATUTORY PARENTAL UNDERTAKING:</strong> I hereby declare that all entries in this form are correct and true. I promise to abide by all the regulations and guidelines of ${school.name} regarding studies, discipline, uniform, and fee revisions.
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:18px;text-align:center;">
            <div style="border-top:1px solid #881337;width:28%;padding-top:2px;font-size:7.5px;font-weight:700;color:#881337;">Father / Guardian Signature</div>
            <div style="border-top:1px solid #881337;width:28%;padding-top:2px;font-size:7.5px;font-weight:700;color:#881337;">Mother's Signature</div>
            <div style="border-top:1.5px solid #881337;width:32%;padding-top:2px;font-size:8px;font-weight:800;color:#881337;">${school.principal} (Principal &amp; Seal)</div>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="display:flex;justify-content:space-between;font-size:7px;color:#78350f;border-top:1px solid #fecaca;padding-top:2px;">
          <span>Form: TPS-ROYAL-V3.6 • ${new Date().toLocaleDateString("en-IN")}</span>
          <span>Official School Portal: https://${school.website} • Page 1 of 1</span>
        </div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 3: MODERN MINIMALIST PRO (Indigo & Slate)
  // FULL PAGE VERTICAL DISTRIBUTION GUARANTEE WITH DYNAMIC ERP DATA
  // =========================================================================
  function renderMinimalistPro(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8.5px" : "10px";
    const pCell = isA5 ? "3.5px 6px" : "5.5px 9px";
    const school = getSchoolMeta();

    return `
    <div class="tps-adm-doc tps-minimalist-pro" style="font-family:'Inter',system-ui,sans-serif;color:#0f172a;background:#ffffff;padding:${isA5 ? '8px 10px' : '10px 14px'};box-sizing:border-box;line-height:1.3;font-size:${fBase};display:flex;flex-direction:column;justify-content:space-between;height:100%;border:2px solid #e2e8f0;border-radius:8px;">
      
      <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:${isA5 ? '5px' : '8px'};">
        <!-- TOP BAR (DYNAMIC ERP DATA) -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #e2e8f0;padding-bottom:6px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${school.logo}" style="width:48px;height:48px;object-fit:contain;" alt="Logo" />
            <div>
              <div style="font-size:${isA5 ? '15px' : '20px'};font-weight:900;color:#0f172a;letter-spacing:-0.5px;">${school.name}</div>
              <div style="font-size:8px;color:#64748b;">${school.affiliation ? `${school.affiliation} • ` : ''}${school.campus}${school.udise ? ` • ${school.udise}` : ''}${school.phone ? ` • Tel: ${school.phone}` : ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:9px;padding:3px 10px;border-radius:20px;text-transform:uppercase;">Admission Dossier</span>
            <div style="font-size:8px;color:#64748b;margin-top:3px;">No: <strong>${s.formNo}</strong> | Session: <strong>${s.session}</strong></div>
          </div>
        </div>

        <!-- QUICK METRICS 4-BOX GRID -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">
            <div style="font-size:7px;color:#64748b;font-weight:700;text-transform:uppercase;">Student Name</div>
            <div style="font-size:11px;font-weight:900;color:#0f172a;margin-top:2px;">${s.fullName}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">
            <div style="font-size:7px;color:#64748b;font-weight:700;text-transform:uppercase;">Class &amp; Roll</div>
            <div style="font-size:11px;font-weight:900;color:#4f46e5;margin-top:2px;">${s.className} (${s.section}) • Roll ${s.rollNo}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">
            <div style="font-size:7px;color:#64748b;font-weight:700;text-transform:uppercase;">Admission Reg.</div>
            <div style="font-size:11px;font-weight:900;color:#059669;margin-top:2px;">${s.admissionNo}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">
            <div style="font-size:7px;color:#64748b;font-weight:700;text-transform:uppercase;">Aadhaar Number</div>
            <div style="font-size:11px;font-weight:900;color:#0f172a;margin-top:2px;">${s.aadhar}</div>
          </div>
        </div>

        <!-- STUDENT PARTICULARS & PHOTO -->
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <div style="font-weight:800;font-size:9px;color:#4f46e5;margin-bottom:3px;text-transform:uppercase;">Student Particulars</div>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};">
              <tr><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;width:30%;">Date of Birth</td><td style="padding:${pCell};border:1px solid #e2e8f0;font-weight:700;">${s.dob} (Age: <strong>${s.age}</strong>) • ${s.dobWords}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Gender &amp; Blood Grp</td><td style="padding:${pCell};border:1px solid #e2e8f0;font-weight:700;">${s.gender} • <span style="color:#dc2626;">${s.bloodGroup}</span></td></tr>
              <tr><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Category &amp; Religion</td><td style="padding:${pCell};border:1px solid #e2e8f0;">${s.category} • ${s.religion} (${s.motherTongue})</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Previous School</td><td style="padding:${pCell};border:1px solid #e2e8f0;">${s.prevSchool} (Class: ${s.lastClassPassed})</td></tr>
            </table>

            <div style="font-weight:800;font-size:9px;color:#4f46e5;margin:6px 0 3px;text-transform:uppercase;">Parental Record</div>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};">
              <tr><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;width:30%;">Father's Details</td><td style="padding:${pCell};border:1px solid #e2e8f0;font-weight:700;">${s.fatherName} (${s.fatherOccupation}) • Aadhaar: ${s.fatherAadhar}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Mother's Details</td><td style="padding:${pCell};border:1px solid #e2e8f0;font-weight:700;">${s.motherName} (${s.motherOccupation}) • Aadhaar: ${s.motherAadhar}</td></tr>
              <tr><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Contact Phones</td><td style="padding:${pCell};border:1px solid #e2e8f0;font-weight:700;color:#4f46e5;">${s.phone1} / ${s.whatsapp}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:${pCell};border:1px solid #e2e8f0;color:#64748b;">Address</td><td style="padding:${pCell};border:1px solid #e2e8f0;">${s.fullAddress}</td></tr>
            </table>
          </div>

          <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;">
            ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO", sizeId)}
            <div style="margin-top:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;width:${isA5 ? '105px' : '130px'};box-sizing:border-box;text-align:center;">
              <div style="font-size:7px;color:#64748b;font-weight:800;">ENCLOSURES</div>
              <div style="font-size:7.5px;color:#059669;margin-top:2px;">[✔] Birth Certificate<br />[✔] Aadhaar Card<br />[✔] Transfer Cert<br />[✔] 4 Photos</div>
            </div>
          </div>
        </div>

        <!-- FEE & SIGNATURES -->
        <div style="border-top:1.5px solid #e2e8f0;padding-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:5px 8px;border-radius:6px;margin-bottom:12px;">
            <span style="font-size:8px;font-weight:700;">FEES: Adm Fee: ₹${s.admissionFee} | Monthly: ₹${s.monthlyFee}</span>
            <span style="font-size:9.5px;font-weight:900;color:#059669;">Total Paid: ₹${s.totalPayable.toLocaleString("en-IN")} (Receipt: TPS-${s.formNo})</span>
          </div>

          <div style="display:flex;justify-content:space-between;text-align:center;">
            <div style="width:30%;border-top:1px solid #cbd5e1;padding-top:2px;font-size:8px;font-weight:700;color:#64748b;">Parent / Guardian Signature</div>
            <div style="width:30%;border-top:1px solid #cbd5e1;padding-top:2px;font-size:8px;font-weight:700;color:#64748b;">Admission Officer</div>
            <div style="width:30%;border-top:1.5px solid #4f46e5;padding-top:2px;font-size:8.5px;font-weight:900;color:#4f46e5;">${school.principal} (Principal)</div>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="display:flex;justify-content:space-between;font-size:7px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:2px;">
          <span>Form Code: TPS-MIN-V3.6 • ${new Date().toLocaleDateString("en-IN")}</span>
          <span>https://${school.website} • Page 1 of 1</span>
        </div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 4: CBSE OFFICIAL BOX-GRID FORMAT (Board Standard)
  // FULL PAGE VERTICAL DISTRIBUTION GUARANTEE WITH DYNAMIC ERP DATA
  // =========================================================================
  function renderCbseBoxGrid(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8px" : "9.5px";
    const pCell = isA5 ? "3px 5px" : "5px 7px";
    const school = getSchoolMeta();

    return `
    <div class="tps-adm-doc tps-cbse-box-grid" style="font-family:Arial,sans-serif;color:#000000;background:#ffffff;border:2px solid #000000;padding:${isA5 ? '8px 10px' : '10px 14px'};box-sizing:border-box;line-height:1.25;font-size:${fBase};display:flex;flex-direction:column;justify-content:space-between;height:100%;">
      
      <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:${isA5 ? '5px' : '7px'};">
        <!-- HEADER (DYNAMIC ERP DATA) -->
        <div style="border-bottom:2px solid #000000;padding-bottom:5px;display:flex;justify-content:space-between;align-items:center;">
          <img src="${school.logo}" style="width:50px;height:50px;object-fit:contain;" alt="Logo" />
          <div style="text-align:center;flex:1;">
            <div style="font-size:${isA5 ? '15px' : '20px'};font-weight:900;letter-spacing:0.5px;text-transform:uppercase;">${school.name}</div>
            ${school.affiliation ? `<div style="font-size:8px;font-weight:700;">${school.affiliation}</div>` : ''}
            <div style="font-size:7.5px;">${school.campus} • ${school.contact}</div>
            <div style="display:inline-block;border:1.5px solid #000000;padding:2px 12px;font-weight:900;font-size:${isA5 ? '8.5px' : '10.5px'};margin-top:2px;text-transform:uppercase;">
              APPLICATION FOR ADMISSION • ACADEMIC SESSION ${s.session}
            </div>
          </div>
          <div style="text-align:right;font-size:8px;font-weight:700;">
            <div>SL NO: ${s.formNo}</div>
            <div>ADM NO: ${s.admissionNo}</div>
          </div>
        </div>

        <!-- CHARACTER BOXES: PUPIL NAME -->
        <div>
          <div style="font-size:8px;font-weight:700;margin-bottom:2px;">1. NAME OF PUPIL (IN CAPITAL LETTERS AS PER BIRTH CERTIFICATE):</div>
          ${renderCharBoxes(s.fullName, 28)}
        </div>

        <!-- AADHAAR & DOB -->
        <div style="display:flex;gap:10px;align-items:stretch;">
          <div style="flex:1;">
            <div style="font-size:8px;font-weight:700;margin-bottom:2px;">2. AADHAAR CARD NUMBER OF PUPIL:</div>
            ${renderCharBoxes(s.rawAadhar.replace(/\D/g, ""), 12)}

            <div style="display:flex;gap:8px;margin-top:5px;">
              <div style="flex:1;">
                <div style="font-size:7.5px;font-weight:700;">3. DATE OF BIRTH:</div>
                <div style="font-size:9px;font-weight:800;border:1px solid #000;padding:2px 6px;background:#f8fafc;">${s.dob} (Age: ${s.age})</div>
              </div>
              <div style="flex:1;">
                <div style="font-size:7.5px;font-weight:700;">4. CLASS SOUGHT:</div>
                <div style="border:1px solid #000;padding:2px 6px;font-weight:800;background:#f8fafc;font-size:9.5px;">${s.className} (Sec: ${s.section}) • Roll: ${s.rollNo}</div>
              </div>
            </div>
            <div style="font-size:7.5px;margin-top:3px;">
              <strong>DOB in Words:</strong> <span style="font-style:italic;">${s.dobWords}</span>
            </div>
          </div>
          ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO", sizeId)}
        </div>

        <!-- GRID TABLE -->
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #000000;font-size:${fBase};">
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;width:24%;">Father's Full Name</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">${s.fatherName} (Occ: ${s.fatherOccupation})</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;width:18%;">Father's Aadhaar</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:800;">${s.fatherAadhar}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Mother's Full Name</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">${s.motherName} (Occ: ${s.motherOccupation})</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Mother's Aadhaar</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:800;">${s.motherAadhar}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Category (Tick)</td>
            <td style="padding:${pCell};border:1px solid #000;">
              [ ${s.category === 'General' ? '✔' : ' '} ] GEN &nbsp; [ ${s.category === 'OBC' ? '✔' : ' '} ] OBC &nbsp; [ ${s.category === 'SC' ? '✔' : ' '} ] SC &nbsp; [ ${s.category === 'ST' ? '✔' : ' '} ] ST
            </td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Blood Group / Gender</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">${s.bloodGroup} / ${s.gender}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Permanent Address</td>
            <td style="padding:${pCell};border:1px solid #000;" colspan="3">${s.fullAddress}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Contact Phone Numbers</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Primary: ${s.phone1}</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">WhatsApp / Alt</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">${s.whatsapp}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">Previous School &amp; TC</td>
            <td style="padding:${pCell};border:1px solid #000;">${s.prevSchool} (Class ${s.lastClassPassed})</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">TC Received / Fee</td>
            <td style="padding:${pCell};border:1px solid #000;font-weight:700;">${s.tcReceived} | Paid: ₹${s.totalPayable}</td>
          </tr>
        </table>

        <!-- UNDERTAKING -->
        <div style="border:1px solid #000;padding:4px 6px;font-size:7px;line-height:1.25;">
          <strong>VERIFICATION CHECKLIST:</strong> [${s.hasBirthCert ? '✔' : ' '}] Birth Certificate &nbsp; [${s.hasAadharDoc ? '✔' : ' '}] Aadhaar Copy &nbsp; [${s.hasTcDoc ? '✔' : ' '}] Transfer Certificate &nbsp; [✔] 4 Passport Photos &nbsp; [✔] Parent ID<br />
          <strong>DECLARATION:</strong> I hereby declare that the date of birth and all particulars entered in this form are correct and I shall not apply for any alteration in date of birth or name in the future. I agree to abide by the school rules.
        </div>

        <!-- SIGNATURES -->
        <div style="display:flex;justify-content:space-between;text-align:center;font-size:8px;font-weight:700;">
          <div style="border-top:1px solid #000;width:28%;padding-top:2px;">Signature of Parent/Guardian</div>
          <div style="border-top:1px solid #000;width:28%;padding-top:2px;">Admission Clerk (Verified)</div>
          <div style="border-top:1px solid #000;width:28%;padding-top:2px;">${school.principal} (Principal &amp; Seal)</div>
        </div>

        <!-- FOOTER -->
        <div style="display:flex;justify-content:space-between;font-size:7px;border-top:1px solid #000;padding-top:2px;">
          <span>Form Code: TPS-BOX-V3.6 • ${new Date().toLocaleDateString("en-IN")}</span>
          <span>Official Portal: https://${school.website} • Page 1 of 1</span>
        </div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 5: DUAL COUNTER & PARENT COPY (Perforated Split)
  // FULL PAGE VERTICAL DISTRIBUTION GUARANTEE WITH DYNAMIC ERP DATA
  // =========================================================================
  function renderDualCounterSlip(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "7.5px" : "9.5px";
    const pCell = isA5 ? "2.5px 5px" : "4.5px 8px";
    const school = getSchoolMeta();

    function renderHalf(isParentCopy = false) {
      return `
      <div style="border:1.5px solid #1e3a8a;border-radius:6px;padding:${isA5 ? '6px 8px' : '8px 12px'};background:#ffffff;display:flex;flex-direction:column;justify-content:space-between;height:48%;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #1e3a8a;padding-bottom:3px;margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${school.logo}" style="width:34px;height:34px;object-fit:contain;" alt="Logo" />
            <div>
              <div style="font-size:${isA5 ? '12px' : '15px'};font-weight:900;color:#1e3a8a;line-height:1.1;">${school.name}</div>
              <div style="font-size:7px;color:#64748b;">${school.campus} • Ph: ${school.phone}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="background:${isParentCopy ? '#059669' : '#1e3a8a'};color:#ffffff;font-size:7.5px;font-weight:800;padding:2px 8px;border-radius:3px;text-transform:uppercase;">
              ${isParentCopy ? 'STUDENT / PARENT ACKNOWLEDGMENT COPY' : 'OFFICE ARCHIVE COPY'}
            </span>
            <div style="font-size:7.5px;font-weight:700;color:#0f172a;margin-top:2px;">Form: <strong>${s.formNo}</strong> | Adm No: <strong>${s.admissionNo}</strong></div>
          </div>
        </div>

        <!-- Table Data -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};line-height:1.25;">
          <tr>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;width:22%;color:#334155;">Student Name</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;" colspan="2">${s.fullName}</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:800;color:#2563eb;">Class: ${s.className} (${s.section}) • Roll: ${s.rollNo}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Father's Name &amp; UID</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">${s.fatherName} (UID: ${s.fatherAadhar})</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Mother's Name &amp; UID</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;">${s.motherName} (UID: ${s.motherAadhar})</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">DOB / Blood Grp</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;">${s.dob} (Age: <strong>${s.age}</strong>) • <strong style="color:#dc2626;">${s.bloodGroup}</strong></td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Contact Phone</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#1e3a8a;">${s.phone1}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Residential Address</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;" colspan="3">${s.fullAddress}</td>
          </tr>
          <tr>
            <td style="padding:${pCell};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Fee Clearance</td>
            <td style="padding:${pCell};border:1px solid #cbd5e1;color:#16a34a;font-weight:800;" colspan="3">
              Adm Fee: ₹${s.admissionFee} | Monthly: ₹${s.monthlyFee} | <strong>Total Paid: ₹${s.totalPayable.toLocaleString("en-IN")} (Receipt TPS-${s.formNo})</strong>
            </td>
          </tr>
        </table>

        <!-- Signatures Strip -->
        <div style="display:flex;justify-content:space-between;margin-top:10px;text-align:center;font-size:7.5px;font-weight:700;color:#475569;">
          <div style="border-top:1px solid #64748b;width:30%;padding-top:2px;">Parent / Guardian Signature</div>
          <div style="border-top:1px solid #64748b;width:30%;padding-top:2px;">Cashier / In-Charge</div>
          <div style="border-top:1.5px solid #1e3a8a;width:30%;padding-top:2px;color:#1e3a8a;font-weight:800;">${school.principal} (Principal &amp; Seal)</div>
        </div>
      </div>`;
    }

    return `
    <div class="tps-adm-doc tps-dual-counter-slip" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;height:100%;border:2px solid #1e3a8a;border-radius:6px;padding:${isA5 ? '8px 10px' : '10px 14px'};">
      <!-- TOP: OFFICE ARCHIVE COPY -->
      ${renderHalf(false)}

      <!-- PERFORATION SCISSORS LINE -->
      <div style="text-align:center;margin:6px 0;position:relative;">
        <div style="border-top:1.5px dashed #94a3b8;position:absolute;top:50%;left:0;right:0;z-index:0;"></div>
        <span style="position:relative;z-index:1;background:#ffffff;padding:0 12px;font-size:7.5px;font-weight:700;color:#64748b;letter-spacing:1px;">
          ✂ - - - - - - - - - - - - CUT ALONG DOTTED LINE FOR PARENT COPY - - - - - - - - - - - - ✂
        </span>
      </div>

      <!-- BOTTOM: STUDENT / PARENT COPY -->
      ${renderHalf(true)}
    </div>`;
  }

  // =========================================================================
  // A3 DELUXE DOUBLE-SPREAD PROSPECTUS DOSSIER
  // =========================================================================
  function renderA3DoubleSpread(s, templateRenderer) {
    const school = getSchoolMeta();
    return `
    <div class="tps-adm-doc tps-a3-double-spread" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;gap:24px;border:3px solid #1e3a8a;padding:16px;height:100%;">
      
      <!-- LEFT SPREAD: PROSPECTUS & SCHOLAR PROFILE -->
      <div style="border-right:2px dashed #cbd5e1;padding-right:20px;height:100%;">
        <div style="background:#1e3a8a;color:#ffffff;font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:4px;margin-bottom:8px;text-align:center;letter-spacing:1px;">
          DOSSIER PANEL A : SCHOLAR ENROLMENT &amp; BIOGRAPHICAL RECORD
        </div>
        ${templateRenderer(s, "a4")}
      </div>

      <!-- RIGHT SPREAD: LEGAL UNDERTAKING, MEDICAL & OFFICE REGISTRY -->
      <div style="padding-left:4px;display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <div>
          <div style="background:#d97706;color:#ffffff;font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:4px;margin-bottom:8px;text-align:center;letter-spacing:1px;">
            DOSSIER PANEL B : STATUTORY UNDERTAKINGS, RULES &amp; REGISTRATION DOCKET
          </div>

          <!-- School Rules & Code of Conduct -->
          <div style="border:1.5px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:10px;background:#f8fafc;font-size:9.5px;line-height:1.4;">
            <div style="font-weight:800;color:#1e3a8a;font-size:10.5px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">
              INSTITUTIONAL CODE OF CONDUCT &amp; ACADEMIC REGULATIONS
            </div>
            <ol style="margin:0;padding-left:18px;color:#334155;">
              <li><strong>Attendance Requirement:</strong> A minimum of 75% attendance is compulsory for eligibility in annual examinations and promotions.</li>
              <li><strong>Fee Schedule:</strong> Monthly tuition fees must be cleared on or before the 10th of every calendar month. Defaulting accounts attract late fee charges.</li>
              <li><strong>Uniform &amp; Discipline:</strong> Students must strictly attend school in full prescribed uniform with ID badge. Mobile phones and contraband are strictly prohibited.</li>
              <li><strong>Campus Safety:</strong> School transport arrangements are subject to route safety and geofence tracking policies.</li>
            </ol>
          </div>

          <!-- Medical & Health Record -->
          <div style="border:1.5px solid #cbd5e1;border-radius:6px;padding:10px;margin-bottom:10px;background:#ffffff;font-size:9.5px;line-height:1.4;">
            <div style="font-weight:800;color:#1e3a8a;font-size:10.5px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">
              STUDENT HEALTH &amp; MEDICAL RECORD
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
              <tr>
                <td style="padding:4px;font-weight:700;color:#64748b;width:30%;">Blood Group:</td>
                <td style="padding:4px;font-weight:800;color:#dc2626;">${s.bloodGroup}</td>
                <td style="padding:4px;font-weight:700;color:#64748b;width:30%;">Physical Identification:</td>
                <td style="padding:4px;">Mole / Birthmark on right hand</td>
              </tr>
              <tr>
                <td style="padding:4px;font-weight:700;color:#64748b;">Allergies / Ailments:</td>
                <td style="padding:4px;" colspan="3">None Reported • Medically Fit for School Athletics</td>
              </tr>
            </table>
          </div>

          <!-- Official Approval Docket -->
          <div style="border:2px solid #1e3a8a;border-radius:6px;padding:10px;background:#f0fdf4;margin-bottom:10px;">
            <div style="font-weight:800;color:#166534;font-size:10.5px;margin-bottom:6px;text-transform:uppercase;">
              OFFICIAL ADMISSION COMMITTEE RESOLUTION
            </div>
            <div style="font-size:9px;color:#166534;line-height:1.4;">
              The application for admission of <strong>${s.fullName}</strong> to Class <strong>${s.className} (Section ${s.section})</strong> for Session <strong>${s.session}</strong> has been scrutinized and found compliant with institutional admission norms and regulatory bye-laws. All original transfer certificates and birth records have been authenticated.
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:24px;text-align:center;font-size:8.5px;font-weight:700;">
              <div style="border-top:1px solid #166534;width:30%;padding-top:4px;">Admission Scrutiny Officer</div>
              <div style="border-top:1px solid #166534;width:30%;padding-top:4px;">Accounts Department</div>
              <div style="border-top:1.5px solid #166534;width:30%;padding-top:4px;color:#166534;font-weight:800;">${school.principal} (Principal &amp; Seal)</div>
            </div>
          </div>
        </div>

        <!-- Legal Disclaimer -->
        <div style="font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:4px;">
          ${school.name} Comprehensive Academic Folio • Document Authentication Code: TPS-CBSE-A3-${s.formNo}
        </div>
      </div>
    </div>`;
  }

  // --- TEMPLATE REGISTRY ---
  const ADMISSION_TEMPLATES = [
    {
      id: "cbse_modern",
      name: "01. CBSE Modern Executive (Navy & Gold)",
      sub: "CBSE Standard • Dual Crest • Full Tabular Dossier",
      render: renderCbseModern
    },
    {
      id: "royal_heritage",
      name: "02. Royal Heritage Classical (Burgundy & Bronze)",
      sub: "Ornate Border • Traditional Formal Certificate Layout",
      render: renderRoyalHeritage
    },
    {
      id: "minimalist_pro",
      name: "03. Modern Minimalist Pro (Indigo & Slate)",
      sub: "Contemporary Card Aesthetic • Metric Badges",
      render: renderMinimalistPro
    },
    {
      id: "cbse_box_grid",
      name: "04. CBSE Official Box-Grid (Board Standard)",
      sub: "Discrete Character Boxes • Strict Government Format",
      render: renderCbseBoxGrid
    },
    {
      id: "dual_counter_slip",
      name: "05. Dual Counter & Parent Copy (Split Slip)",
      sub: "Perforated Divider • Office Copy + Parent Copy",
      render: renderDualCounterSlip
    }
  ];

  // --- RENDER MASTER HTML WITH 100% FULL-PAGE FRAME CSS ---
  function renderAdmissionFormHtml(studentData, templateId = "cbse_modern", sizeId = "a4") {
    const s = normalizeAdmissionStudentData(studentData);
    const tmpl = ADMISSION_TEMPLATES.find(t => t.id === templateId) || ADMISSION_TEMPLATES[0];
    const size = ADMISSION_SIZES[sizeId] || ADMISSION_SIZES.a4;

    let contentHtml = "";
    if (sizeId === "a3") {
      contentHtml = renderA3DoubleSpread(s, tmpl.render);
    } else {
      contentHtml = tmpl.render(s, sizeId);
    }

    const padRoot = sizeId === "a5" ? "10px 12px" : (sizeId === "a3" ? "18px 24px" : "14px 18px");

    return `
    <div id="tpsAdmissionPrintRoot" class="tps-print-container ${size.id}" style="width:${size.previewWidth};height:${size.targetDocHeight};max-height:${size.targetDocHeight};margin:0 auto;box-sizing:border-box;display:flex;flex-direction:column;padding:${padRoot};background:#ffffff;">
      <style>
        ${size.pageRule}
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #tpsAdmissionPrintRoot, #tpsAdmissionPrintRoot * {
            visibility: visible !important;
          }
          #tpsAdmissionPrintRoot {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: ${padRoot} !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
          .tps-adm-doc {
            height: 100% !important;
            max-height: 100% !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
        }
      </style>
      ${contentHtml}
    </div>`;
  }

  // =========================================================================
  // INTERACTIVE ADMISSION FORM STUDIO MODAL
  // =========================================================================
  function openAdmissionFormStudio(studentOrAdmissionOrId) {
    let student = null;
    const store = (typeof getStore === "function") ? getStore() : {};

    if (typeof studentOrAdmissionOrId === "object" && studentOrAdmissionOrId !== null) {
      student = studentOrAdmissionOrId;
    } else if (studentOrAdmissionOrId) {
      const targetId = Number(studentOrAdmissionOrId);
      const targetAdm = String(studentOrAdmissionOrId).trim().toLowerCase();
      student = (store.admissions || []).find(a => Number(a.id) === targetId || String(a.admissionNo || "").toLowerCase() === targetAdm)
        || (store.students || []).find(s => Number(s.id) === targetId || String(s.admissionNo || "").toLowerCase() === targetAdm);
    }

    if (!student) {
      if (typeof showToast === "function") showToast("Student / Admission record not found", "error");
      else alert("Record not found");
      return;
    }

    // Retrieve saved user preferences
    let curTemplate = localStorage.getItem("tps_preferred_admission_template") || "cbse_modern";
    let curSize = localStorage.getItem("tps_preferred_admission_size") || "a4";
    let curZoom = 1.0;

    // Check if modal already exists
    let modal = document.getElementById("tpsAdmissionStudioModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tpsAdmissionStudioModal";
      modal.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#ffffff;border-radius:16px;width:100%;max-width:1380px;height:96vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);overflow:hidden;border:1px solid #cbd5e1;">
        
        <!-- Studio Top Toolbar -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 18px;background:#0f172a;color:#ffffff;border-bottom:1px solid #334155;flex-wrap:wrap;gap:10px;">
          <!-- Left: Title & Student Badge -->
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:#1e293b;display:grid;place-items:center;border:1px solid #334155;">
              <span class="material-symbols-outlined" style="font-size:22px;color:#60a5fa;">history_edu</span>
            </div>
            <div>
              <div style="font-weight:800;font-size:1.02rem;color:#f8fafc;display:flex;align-items:center;gap:8px;">
                <span>Admission Form Studio</span>
                <span style="background:#2563eb;color:#ffffff;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;">Full-Page Fit</span>
              </div>
              <div style="font-size:0.75rem;color:#94a3b8;">
                ${escapeHtml(student.fullName || student.studentName || "Student")} • Class: <strong>${escapeHtml(student.className || student.classApplyingFor || "-")}</strong> • Form: <strong>${escapeHtml(student.admissionNo || "New")}</strong>
              </div>
            </div>
          </div>

          <!-- Middle: Switchers -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            
            <!-- Paper Size Selector -->
            <div style="display:flex;align-items:center;gap:6px;background:#1e293b;padding:4px 8px;border-radius:8px;border:1px solid #334155;">
              <span class="material-symbols-outlined" style="font-size:16px;color:#94a3b8;">aspect_ratio</span>
              <label style="font-size:0.75rem;font-weight:700;color:#cbd5e1;">Size:</label>
              <select id="tpsAdmSizeSelect" style="background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:0.8rem;font-weight:700;cursor:pointer;">
                <option value="a4" ${curSize === "a4" ? "selected" : ""}>A4 Standard (210×297mm)</option>
                <option value="a5" ${curSize === "a5" ? "selected" : ""}>A5 Compact (148×210mm)</option>
                <option value="a3" ${curSize === "a3" ? "selected" : ""}>A3 Double Spread (420×297mm)</option>
              </select>
            </div>

            <!-- Design Template Selector -->
            <div style="display:flex;align-items:center;gap:6px;background:#1e293b;padding:4px 8px;border-radius:8px;border:1px solid #334155;">
              <span class="material-symbols-outlined" style="font-size:16px;color:#94a3b8;">palette</span>
              <label style="font-size:0.75rem;font-weight:700;color:#cbd5e1;">Template:</label>
              <select id="tpsAdmTemplateSelect" style="background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:0.8rem;font-weight:700;cursor:pointer;max-width:240px;">
                ${ADMISSION_TEMPLATES.map(t => `<option value="${t.id}" ${curTemplate === t.id ? "selected" : ""}>${t.name}</option>`).join("")}
              </select>
            </div>

            <!-- Zoom Control -->
            <div style="display:flex;align-items:center;gap:4px;background:#1e293b;padding:4px 8px;border-radius:8px;border:1px solid #334155;">
              <button id="tpsAdmZoomOut" type="button" style="background:transparent;border:none;color:#cbd5e1;cursor:pointer;display:grid;place-items:center;padding:2px;" title="Zoom Out">
                <span class="material-symbols-outlined" style="font-size:18px;">zoom_out</span>
              </button>
              <span id="tpsAdmZoomVal" style="font-size:0.75rem;font-weight:700;color:#f8fafc;min-width:38px;text-align:center;">100%</span>
              <button id="tpsAdmZoomIn" type="button" style="background:transparent;border:none;color:#cbd5e1;cursor:pointer;display:grid;place-items:center;padding:2px;" title="Zoom In">
                <span class="material-symbols-outlined" style="font-size:18px;">zoom_in</span>
              </button>
            </div>

          </div>

          <!-- Right: Actions -->
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="tpsAdmDirectPrintBtn" type="button" style="background:#2563eb;color:#ffffff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(37,99,235,0.3);">
              <span class="material-symbols-outlined" style="font-size:18px;">print</span>
              <span>Print Form</span>
            </button>
            <button id="tpsAdmDownloadPdfBtn" type="button" style="background:#059669;color:#ffffff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(5,150,105,0.3);">
              <span class="material-symbols-outlined" style="font-size:18px;">download</span>
              <span>PDF</span>
            </button>
            <button id="tpsAdmCloseBtn" type="button" style="background:rgba(255,255,255,0.1);color:#ffffff;border:none;width:32px;height:32px;border-radius:50%;font-size:1.2rem;cursor:pointer;display:grid;place-items:center;" title="Close Studio">
              &times;
            </button>
          </div>
        </div>

        <!-- Studio Main Preview Canvas -->
        <div id="tpsAdmCanvasWrap" style="flex:1;background:#334155;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:24px;box-sizing:border-box;">
          <div id="tpsAdmRenderContainer" style="background:#ffffff;box-shadow:0 10px 30px rgba(0,0,0,0.35);border-radius:4px;transition:transform 0.2s ease;transform-origin:top center;">
            <!-- Admission form rendered here -->
          </div>
        </div>

      </div>
    `;

    const renderContainer = document.getElementById("tpsAdmRenderContainer");
    const sizeSelect = document.getElementById("tpsAdmSizeSelect");
    const templateSelect = document.getElementById("tpsAdmTemplateSelect");
    const zoomVal = document.getElementById("tpsAdmZoomVal");
    const zoomInBtn = document.getElementById("tpsAdmZoomIn");
    const zoomOutBtn = document.getElementById("tpsAdmZoomOut");
    const printBtn = document.getElementById("tpsAdmDirectPrintBtn");
    const downloadPdfBtn = document.getElementById("tpsAdmDownloadPdfBtn");
    const closeBtn = document.getElementById("tpsAdmCloseBtn");

    function updatePreview() {
      const curSizeObj = ADMISSION_SIZES[curSize] || ADMISSION_SIZES.a4;
      renderContainer.style.width = curSizeObj.previewWidth;
      renderContainer.style.height = curSizeObj.targetDocHeight;
      renderContainer.style.minHeight = curSizeObj.targetDocHeight;
      renderContainer.style.transform = `scale(${curZoom})`;

      const html = renderAdmissionFormHtml(student, curTemplate, curSize);
      renderContainer.innerHTML = html;

      // Persist preferences
      localStorage.setItem("tps_preferred_admission_template", curTemplate);
      localStorage.setItem("tps_preferred_admission_size", curSize);
    }

    // Attach listeners
    sizeSelect.addEventListener("change", (e) => {
      curSize = e.target.value;
      if (curSize === "a3") curZoom = 0.75;
      else if (curSize === "a5") curZoom = 1.1;
      else curZoom = 1.0;
      zoomVal.textContent = Math.round(curZoom * 100) + "%";
      updatePreview();
    });

    templateSelect.addEventListener("change", (e) => {
      curTemplate = e.target.value;
      updatePreview();
    });

    zoomInBtn.addEventListener("click", () => {
      if (curZoom < 1.6) {
        curZoom = parseFloat((curZoom + 0.1).toFixed(1));
        zoomVal.textContent = Math.round(curZoom * 100) + "%";
        renderContainer.style.transform = `scale(${curZoom})`;
      }
    });

    zoomOutBtn.addEventListener("click", () => {
      if (curZoom > 0.4) {
        curZoom = parseFloat((curZoom - 0.1).toFixed(1));
        zoomVal.textContent = Math.round(curZoom * 100) + "%";
        renderContainer.style.transform = `scale(${curZoom})`;
      }
    });

    printBtn.addEventListener("click", () => {
      window.printAdmissionForm(student, curTemplate, curSize);
    });

    downloadPdfBtn.addEventListener("click", () => {
      window.downloadAdmissionPDF(student, curTemplate, curSize);
    });

    closeBtn.addEventListener("click", () => {
      modal.remove();
    });

    // Initial render
    updatePreview();
  }

  // =========================================================================
  // PRINT EXECUTION PIPELINE
  // =========================================================================
  function printAdmissionForm(studentData, templateId = "cbse_modern", sizeId = "a4") {
    const html = renderAdmissionFormHtml(studentData, templateId, sizeId);
    const size = ADMISSION_SIZES[sizeId] || ADMISSION_SIZES.a4;
    const school = getSchoolMeta();
    const padRoot = sizeId === "a5" ? "10px 12px" : (sizeId === "a3" ? "18px 24px" : "14px 18px");

    try {
      let iframe = document.getElementById("__tps_adm_print_iframe__");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "__tps_adm_print_iframe__";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        iframe.style.zIndex = "-9999";
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Admission Form - ${school.name}</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Cinzel:wght@700;900&family=Inter:wght@400;600;700;800&display=swap">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
            <style>
              @page {
                size: ${sizeId === "a3" ? "A3 landscape" : (sizeId === "a5" ? "A5 portrait" : "A4 portrait")};
                margin: 0;
              }
              * { box-sizing: border-box; }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: #ffffff !important;
                font-family: 'Poppins', Arial, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #tpsAdmissionPrintRoot {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: ${padRoot} !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                overflow: hidden !important;
              }
              .tps-adm-doc {
                width: 100% !important;
                height: 100% !important;
                box-sizing: border-box !important;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                overflow: hidden !important;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Iframe print failed:", e);
          window.print();
        }
      }, 500);
    } catch (err) {
      console.warn("Direct iframe print failed, falling back to window.print():", err);
      window.print();
    }
  }

  // =========================================================================
  // DOWNLOAD PDF PIPELINE (html2pdf vector converter)
  // =========================================================================
  function downloadAdmissionPDF(studentData, templateId = "cbse_modern", sizeId = "a4") {
    if (typeof html2pdf === "undefined") {
      if (typeof showToast === "function") showToast("PDF Converter library loading...", "info");
      window.printAdmissionForm(studentData, templateId, sizeId);
      return;
    }

    const s = normalizeAdmissionStudentData(studentData);
    const size = ADMISSION_SIZES[sizeId] || ADMISSION_SIZES.a4;
    
    // Exact dimensions
    const targetWidth = parseInt(size.previewWidth, 10);
    const targetHeight = parseInt(size.targetDocHeight, 10);

    const tempWrapper = document.createElement("div");
    tempWrapper.style.position = "fixed";
    tempWrapper.style.left = "-9999px";
    tempWrapper.style.top = "0";
    tempWrapper.style.width = targetWidth + "px";
    tempWrapper.style.height = targetHeight + "px";
    tempWrapper.style.overflow = "hidden";
    tempWrapper.style.background = "#ffffff";
    tempWrapper.style.zIndex = "-9999";
    tempWrapper.innerHTML = renderAdmissionFormHtml(studentData, templateId, sizeId);
    document.body.appendChild(tempWrapper);

    const pdfFormat = sizeId === "a3" ? [420, 297] : (sizeId === "a5" ? [148, 210] : [210, 297]);

    const opt = {
      margin: 0, // CRITICAL: 0 margin ensures canvas fills the exact page size without horizontal clipping or bottom gap!
      filename: `Admission_Form_${s.admissionNo}_${s.className}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: {
        unit: "mm",
        format: pdfFormat,
        orientation: size.orientation
      }
    };

    if (typeof showToast === "function") showToast("Generating high-resolution PDF...", "info");

    html2pdf().set(opt).from(tempWrapper).save().then(() => {
      tempWrapper.remove();
      if (typeof showToast === "function") showToast("Admission Form PDF Downloaded!", "success");
    }).catch(err => {
      tempWrapper.remove();
      console.error("PDF download error:", err);
      if (typeof showToast === "function") showToast("PDF generation failed, opening print dialog...", "warning");
      window.printAdmissionForm(studentData, templateId, sizeId);
    });
  }

  // --- EXPORT TO GLOBAL WINDOW OBJECT ---
  window.admissionFormSizes = ADMISSION_SIZES;
  window.admissionTemplates = ADMISSION_TEMPLATES;
  window.getSchoolMeta = getSchoolMeta;
  window.parseUniversalDate = parseUniversalDate;
  window.calculateAgeFromDob = calculateAgeFromDob;
  window.normalizeAdmissionStudentData = normalizeAdmissionStudentData;
  window.renderAdmissionFormHtml = renderAdmissionFormHtml;
  window.openAdmissionFormStudio = openAdmissionFormStudio;
  window.printAdmissionForm = printAdmissionForm;
  window.downloadAdmissionPDF = downloadAdmissionPDF;

})(window, document);
