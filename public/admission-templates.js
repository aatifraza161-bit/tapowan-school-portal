/**
 * Tapowan Public School - Professional Admission Form Studio & Multi-Size Templates Engine
 * Supports A4 (Standard), A5 (Compact), and A3 (Double-Spread Prospectus)
 * 5 High-Fidelity Enterprise Grade Themes:
 *   1. CBSE Modern Executive (Navy & Gold)
 *   2. Royal Heritage Classical (Burgundy & Bronze)
 *   3. Modern Minimalist Pro (Indigo & Slate)
 *   4. CBSE Official Box-Grid (Board Examination Standard)
 *   5. Dual Counter & Parent Copy (Perforated Split)
 */

(function (window, document) {
  "use strict";

  // --- PAPER SIZES SPECIFICATION ---
  const ADMISSION_SIZES = {
    a4: {
      id: "a4",
      name: "A4 Standard (210 × 297 mm)",
      sub: "Official Student Dossier & School Archive Standard",
      widthMm: 210,
      heightMm: 297,
      orientation: "portrait",
      pageRule: "@page { size: A4 portrait; margin: 6mm 6mm; }",
      previewWidth: "794px",
      previewMinHeight: "1120px"
    },
    a5: {
      id: "a5",
      name: "A5 Compact (148 × 210 mm)",
      sub: "Quick Admission Slip / Counter Acknowledgment",
      widthMm: 148,
      heightMm: 210,
      orientation: "portrait",
      pageRule: "@page { size: A5 portrait; margin: 4mm 4mm; }",
      previewWidth: "560px",
      previewMinHeight: "790px"
    },
    a3: {
      id: "a3",
      name: "A3 Double Spread (420 × 297 mm)",
      sub: "2-Page Prospectus Dossier & Legal Annexure Folio",
      widthMm: 420,
      heightMm: 297,
      orientation: "landscape",
      pageRule: "@page { size: A3 landscape; margin: 8mm 8mm; }",
      previewWidth: "1480px",
      previewMinHeight: "1050px"
    }
  };

  // --- SCHOOL MASTER BRANDING CONSTANTS ---
  const SCHOOL_META = {
    name: "TAPOWAN PUBLIC SCHOOL",
    tagline: "Quality Education for a Brighter Future",
    affiliation: "Affiliated to CBSE, New Delhi • Affiliation No. CBSE/TPS/2026",
    campus: "Prem Nagar Campus, Near Bypass Road, Jharkhand - 825301",
    contact: "Phone: +91 74880 61954 | Email: info@tapowanschool.edu.in | Web: tapowan-school.pages.dev",
    udise: "UDISE Code: 20040506702 • School Code: 65219",
    logo: "logo.png"
  };

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

  function dateToWords(dateStr) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const ordinals = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
          "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
          "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth", "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth", "Twenty-Ninth", "Thirtieth", "Thirty-First"];
        return `${ordinals[d] || d} of ${months[m] || ""} ${numberToWords(y)}`;
      }
    } catch (_) {}
    return dateStr;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      }
    } catch (_) {}
    return dateStr;
  }

  // --- DATA NORMALIZATION ENGINE ---
  function normalizeAdmissionStudentData(raw) {
    if (!raw) return {};
    const d = typeof raw === "object" ? { ...raw } : {};

    // Basic Data
    const fullName = (d.fullName || d.studentName || d.name || "Student Name").trim();
    const admissionNo = (d.admissionNo || d.admission_no || d.admNo || "TPS-" + (d.id || "TEMP")).trim();
    const rollNo = (d.rollNo || d.roll_no || d.roll || "-").toString().trim();
    const className = (d.classApplyingFor || d.className || d.class || "General").trim();
    const section = (d.section || "A").trim();
    const session = (d.session || "2026-2027").trim();
    const dob = (d.dob || d.dateOfBirth || "2015-01-01").trim();
    const dobWords = dateToWords(dob);
    const age = (d.age || "-").toString().trim();
    const gender = (d.gender || "Male").trim();
    const category = (d.category || "General").trim();
    const religion = (d.religion || "Hindu").trim();
    const motherTongue = (d.motherTongue || "Hindi").trim();
    const nationality = (d.nationality || "Indian").trim();
    const bloodGroup = (d.bloodGroup || d.blood_group || "B+").trim();
    const aadhar = (d.aadhar || d.aadharNo || d.studentAadharNo || "N/A").trim();

    // Parents & Guardians
    const fatherName = (d.fatherName || d.father_name || "Father Name").trim();
    const motherName = (d.motherName || d.mother_name || "Mother Name").trim();
    const guardianName = (d.guardianName || d.guardian_name || fatherName || "-").trim();
    const relation = (d.relation || (guardianName === fatherName ? "Father" : "Guardian")).trim();
    const fatherOccupation = (d.fatherOccupation || d.occupation || "Business / Private").trim();
    const motherOccupation = (d.motherOccupation || "Homemaker").trim();
    const incomeRange = (d.incomeRange || "1 - 3 Lakhs").trim();

    // Contact & Address
    const phone1 = (d.phone1 || d.phone || d.mobile || "-").trim();
    const phone2 = (d.phone2 || "-").trim();
    const whatsapp = (d.whatsapp || phone1 || "-").trim();
    const email = (d.email || "N/A").trim();
    const emergencyContact = (d.emergencyContact || phone1 || "-").trim();
    const village = (d.village || d.address || "Prem Nagar").trim();
    const post = (d.post || "Prem Nagar").trim();
    const district = (d.district || "Hazaribagh").trim();
    const state = (d.state || "Jharkhand").trim();
    const pin = (d.pin || d.pincode || "825301").trim();
    const fullAddress = d.address ? d.address.trim() : `${village}, P.O: ${post}, Dist: ${district}, ${state} - ${pin}`;

    // Academic & Previous School
    const prevSchool = (d.prevSchool || d.previousSchool || "N/A").trim();
    const lastClassPassed = (d.lastClassPassed || "N/A").trim();
    const tcReceived = (d.tcReceived || (d.tcDoc ? "Yes" : "No")).trim();

    // Financials
    const admissionFee = parseFloat(d.admissionFee) || 1600;
    const monthlyFee = parseFloat(d.monthlyFee) || 599;
    const transportFee = parseFloat(d.transportFee) || 0;
    const discount = parseFloat(d.discount) || 0;
    const totalPayable = Math.max(0, admissionFee + monthlyFee + transportFee - discount);

    // Photos & Documents
    const photoUrl = d.photo || d.photoUrl || d.avatar || "";
    const hasBirthCert = Boolean(d.birthCert || d.birth_cert);
    const hasAadharDoc = Boolean(d.aadharDoc || d.aadhar_doc || (aadhar && aadhar !== "N/A"));
    const hasTcDoc = Boolean(d.tcDoc || d.tc_doc || tcReceived === "Yes");
    const hasParentId = Boolean(d.parentIdDoc || d.parent_id_doc);

    // Form Meta
    const formNo = "ADM-2026-" + String(d.id || admissionNo).replace(/\D/g, "").padStart(4, "0");
    const admissionDate = formatDisplayDate(d.admissionDate || d.created_at || new Date().toISOString());

    return {
      fullName, admissionNo, rollNo, className, section, session,
      dob, dobWords, age, gender, category, religion, motherTongue, nationality, bloodGroup, aadhar,
      fatherName, motherName, guardianName, relation, fatherOccupation, motherOccupation, incomeRange,
      phone1, phone2, whatsapp, email, emergencyContact,
      village, post, district, state, pin, fullAddress,
      prevSchool, lastClassPassed, tcReceived,
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
      html += `<div style="width:16px;height:20px;border:1px solid #334155;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;">${char}</div>`;
    }
    html += "</div>";
    return html;
  }

  // --- PHOTO BOX COMPONENT ---
  function renderPhotoFrame(photoUrl, label = "STUDENT PHOTOGRAPH") {
    if (photoUrl && photoUrl.length > 20) {
      return `
        <div style="width:125px;height:150px;border:2px solid #1e3a8a;border-radius:6px;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,0.12);background:#f8fafc;position:relative;">
          <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${label}" />
          <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(30,58,138,0.85);color:#fff;font-size:8px;font-weight:700;text-align:center;padding:2px 0;letter-spacing:0.5px;">${label}</div>
        </div>`;
    }
    return `
      <div style="width:125px;height:150px;border:2px dashed #94a3b8;border-radius:6px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6px;box-sizing:border-box;">
        <span class="material-symbols-outlined" style="font-size:32px;color:#94a3b8;margin-bottom:4px;">add_a_photo</span>
        <span style="font-size:9px;font-weight:700;color:#475569;line-height:1.2;text-transform:uppercase;">Affix Recent Passport Size Photograph</span>
        <span style="font-size:7.5px;color:#94a3b8;margin-top:4px;">(3.5 cm × 4.5 cm)</span>
      </div>`;
  }

  // =========================================================================
  // TEMPLATE 1: CBSE MODERN EXECUTIVE (Navy Blue & Royal Gold)
  // =========================================================================
  function renderCbseModern(s, sizeId) {
    const isA5 = sizeId === "a5";
    const isA3 = sizeId === "a3";
    const fBase = isA5 ? "9px" : "11px";
    const pPad = isA5 ? "4px 8px" : "6px 12px";

    return `
    <div class="tps-adm-doc tps-cbse-modern" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;position:relative;line-height:1.35;font-size:${fBase};">
      
      <!-- Watermark Seal -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.045;pointer-events:none;z-index:0;width:340px;height:340px;">
        <img src="${SCHOOL_META.logo}" style="width:100%;height:100%;object-fit:contain;" alt="Watermark" />
      </div>

      <div style="position:relative;z-index:1;">
        <!-- Institutional Header -->
        <div style="border-bottom:2.5px solid #1e3a8a;padding-bottom:8px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${SCHOOL_META.logo}" style="width:${isA5 ? '50px' : '68px'};height:${isA5 ? '50px' : '68px'};object-fit:contain;" alt="School Crest" />
            <div>
              <div style="font-size:${isA5 ? '15px' : '22px'};font-weight:900;color:#1e3a8a;letter-spacing:0.5px;line-height:1.1;text-transform:uppercase;">${SCHOOL_META.name}</div>
              <div style="font-size:${isA5 ? '8.5px' : '10.5px'};font-weight:700;color:#d97706;letter-spacing:0.3px;margin-top:2px;">${SCHOOL_META.tagline}</div>
              <div style="font-size:${isA5 ? '7.5px' : '9px'};color:#475569;margin-top:2px;">${SCHOOL_META.affiliation}</div>
              <div style="font-size:${isA5 ? '7.5px' : '8.5px'};color:#64748b;">${SCHOOL_META.campus}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block;background:#1e3a8a;color:#ffffff;font-size:${isA5 ? '9px' : '12px'};font-weight:800;padding:4px 12px;border-radius:4px;letter-spacing:0.5px;text-transform:uppercase;">ADMISSION FORM</div>
            <div style="font-size:9px;font-weight:700;color:#0f172a;margin-top:4px;">Session: <span style="color:#d97706;">${s.session}</span></div>
            <div style="font-size:8.5px;color:#475569;">Form No: <strong>${s.formNo}</strong></div>
            <div style="font-size:8px;color:#64748b;">Date: ${s.admissionDate}</div>
          </div>
        </div>

        <!-- Upper Profile Grid -->
        <div style="display:flex;gap:12px;margin-bottom:8px;align-items:stretch;">
          <!-- Left Table (Student Particulars) -->
          <div style="flex:1;">
            <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${isA5 ? '9px' : '10.5px'};padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px;display:flex;justify-content:space-between;align-items:center;">
              <span>1. CANDIDATE'S GENERAL PARTICULARS</span>
              <span style="font-size:8.5px;color:#fde047;">Reg. No: ${s.admissionNo}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};">
              <tr style="background:#f8fafc;">
                <td style="width:24%;padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Full Name of Student</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;" colspan="3">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span>${s.fullName}</span>
                    <span style="font-size:8px;color:#2563eb;font-weight:700;border:1px solid #bfdbfe;padding:1px 6px;border-radius:3px;background:#eff6ff;">Class: ${s.className} (${s.section})</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Date of Birth (DOB)</td>
                <td style="width:26%;padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${s.dob}</td>
                <td style="width:20%;padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Age (on 31st March)</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${s.age} Yrs</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">DOB in Words</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-style:italic;color:#1e3a8a;font-weight:600;" colspan="3">${s.dobWords}</td>
              </tr>
              <tr>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Gender</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">${s.gender}</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Blood Group</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:800;color:#dc2626;">${s.bloodGroup}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Category / Caste</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#059669;">${s.category}</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Religion / Mother Tongue</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">${s.religion} / ${s.motherTongue}</td>
              </tr>
              <tr>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Aadhaar Number</td>
                <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;letter-spacing:1px;" colspan="3">${s.aadhar}</td>
              </tr>
            </table>
          </div>

          <!-- Right Photo Frame -->
          <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO")}
          </div>
        </div>

        <!-- Section 2: Parent & Guardian Details -->
        <div style="margin-bottom:8px;">
          <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${isA5 ? '9px' : '10.5px'};padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">2. PARENT &amp; GUARDIAN PARTICULAR DIRECTORY</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};">
            <tr style="background:#f1f5f9;font-weight:800;color:#1e3a8a;text-align:center;">
              <td style="width:25%;padding:${pPad};border:1px solid #cbd5e1;text-align:left;">Particulars</td>
              <td style="width:37.5%;padding:${pPad};border:1px solid #cbd5e1;">Father's Details</td>
              <td style="width:37.5%;padding:${pPad};border:1px solid #cbd5e1;">Mother's Details</td>
            </tr>
            <tr>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Full Name</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#0f172a;text-transform:uppercase;">${s.fatherName}</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#0f172a;text-transform:uppercase;">${s.motherName}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Occupation</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">${s.fatherOccupation}</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">${s.motherOccupation}</td>
            </tr>
            <tr>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">Contact / Mobile</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#2563eb;">${s.phone1}</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#2563eb;">${s.phone2 !== '-' ? s.phone2 : s.whatsapp}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:700;color:#334155;">WhatsApp &amp; Email</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">WA: ${s.whatsapp}</td>
              <td style="padding:${pPad};border:1px solid #cbd5e1;font-weight:600;">Email: ${s.email}</td>
            </tr>
          </table>
        </div>

        <!-- Section 3: Address & Academic Background -->
        <div style="display:flex;gap:12px;margin-bottom:8px;">
          <!-- Residential Address -->
          <div style="flex:1;">
            <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${isA5 ? '9px' : '10px'};padding:3px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">3. RESIDENTIAL ADDRESS &amp; EMERGENCY CONTACT</div>
            <div style="border:1px solid #cbd5e1;padding:${pPad};font-size:${fBase};background:#ffffff;height:calc(100% - 24px);box-sizing:border-box;">
              <div><strong>Present Address:</strong> ${s.fullAddress}</div>
              <div style="margin-top:4px;"><strong>Village/Town:</strong> ${s.village} | <strong>District:</strong> ${s.district} | <strong>PIN:</strong> ${s.pin}</div>
              <div style="margin-top:4px;color:#dc2626;font-weight:700;"><strong>Emergency Contact:</strong> ${s.emergencyContact} (${s.relation})</div>
            </div>
          </div>
          <!-- Academic History -->
          <div style="flex:1;">
            <div style="background:#1e3a8a;color:#ffffff;font-weight:800;font-size:${isA5 ? '9px' : '10px'};padding:3px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px;">4. PREVIOUS ACADEMIC RECORD &amp; FEES</div>
            <div style="border:1px solid #cbd5e1;padding:${pPad};font-size:${fBase};background:#ffffff;height:calc(100% - 24px);box-sizing:border-box;">
              <div><strong>Previous School:</strong> ${s.prevSchool}</div>
              <div style="margin-top:3px;"><strong>Last Class Passed:</strong> ${s.lastClassPassed} | <strong>T.C. Received:</strong> ${s.tcReceived}</div>
              <div style="margin-top:4px;display:flex;justify-content:space-between;border-top:1px dashed #cbd5e1;padding-top:4px;">
                <span>Admission Fee: <strong>₹${s.admissionFee}</strong></span>
                <span>Monthly: <strong>₹${s.monthlyFee}</strong></span>
                <span style="color:#16a34a;font-weight:800;">Total: ₹${s.totalPayable}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 5: Documents Checklist & Declaration -->
        <div style="border:1px solid #cbd5e1;padding:6px 10px;margin-bottom:8px;background:#f8fafc;border-radius:4px;">
          <div style="font-weight:800;color:#1e3a8a;font-size:9.5px;margin-bottom:4px;text-transform:uppercase;">5. Document Verification Checklist &amp; Enclosures</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:8.5px;color:#334155;">
            <span>${s.hasBirthCert ? '[✔]' : '[  ]'} Birth Certificate</span>
            <span>${s.hasAadharDoc ? '[✔]' : '[  ]'} Aadhaar Card Photocopy</span>
            <span>${s.hasTcDoc ? '[✔]' : '[  ]'} Transfer Certificate (Original)</span>
            <span>${s.hasParentId ? '[✔]' : '[  ]'} Parent ID Proof</span>
            <span>[✔] Recent Passport Photos (4 Nos)</span>
            <span>[✔] Character Certificate</span>
          </div>
          <div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:4px;font-size:8px;color:#475569;text-align:justify;line-height:1.25;">
            <strong>PARENT'S DECLARATION &amp; UNDERTAKING:</strong> I hereby solemnly declare that the particulars furnished above are true and correct to the best of my knowledge and belief. I agree to abide by all the rules, disciplinary codes, and fee structures of the school as in force from time to time. I understand that admission may be rescinded if any statement is found incorrect.
          </div>
        </div>

        <!-- Signatures & Office Approval Block -->
        <div style="border:1.5px solid #1e3a8a;border-radius:4px;padding:8px;background:#ffffff;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;">
            <div style="text-align:center;width:28%;">
              <div style="border-top:1px solid #475569;margin-top:28px;padding-top:4px;font-weight:700;font-size:8.5px;color:#334155;">Signature of Father / Guardian</div>
            </div>
            <div style="text-align:center;width:28%;">
              <div style="border-top:1px solid #475569;margin-top:28px;padding-top:4px;font-weight:700;font-size:8.5px;color:#334155;">Signature of Mother</div>
            </div>
            <div style="text-align:center;width:34%;">
              <div style="border-top:1.5px solid #1e3a8a;margin-top:28px;padding-top:4px;font-weight:800;font-size:9px;color:#1e3a8a;">Admission In-Charge / Clerk</div>
            </div>
          </div>

          <!-- For Office Use Only Row -->
          <div style="border-top:1px solid #cbd5e1;padding-top:6px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:6px;border-radius:4px;">
            <div style="font-size:8.5px;color:#334155;line-height:1.3;">
              <span style="font-weight:800;color:#1e3a8a;text-transform:uppercase;">FOR OFFICE USE ONLY:</span> Admitted to Class: <strong>${s.className}</strong> | Section: <strong>${s.section}</strong> | Assigned Roll No: <strong>${s.rollNo}</strong><br />
              Fee Clearance Voucher: <strong>PAID ₹${s.totalPayable}</strong> | Receipt No: <strong>TPS-REC-${s.formNo}</strong> | Status: <span style="color:#16a34a;font-weight:700;">Verified</span>
            </div>
            <div style="text-align:center;border-left:1px dashed #cbd5e1;padding-left:14px;">
              <div style="width:75px;height:38px;border:1px dashed #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:7px;color:#94a3b8;margin-bottom:2px;">OFFICIAL SEAL</div>
              <div style="font-size:8px;font-weight:800;color:#1e3a8a;">Principal's Signature</div>
            </div>
          </div>
        </div>

        <!-- Footer Strip -->
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:7.5px;color:#94a3b8;">
          <span>Form Code: TPS-ADM-V3.4 • Generated: ${new Date().toLocaleDateString("en-IN")}</span>
          <span>Official Portal: https://tapowan-school.pages.dev • Page 1 of 1</span>
        </div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 2: ROYAL HERITAGE CLASSICAL (Burgundy & Antique Bronze)
  // =========================================================================
  function renderRoyalHeritage(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8.5px" : "10.5px";

    return `
    <div class="tps-adm-doc tps-royal-heritage" style="font-family:'Cinzel','Georgia',serif;color:#3b1e1e;background:#fffdfa;border:3px double #881337;padding:${isA5 ? '10px' : '16px'};box-sizing:border-box;position:relative;line-height:1.38;font-size:${fBase};">
      
      <!-- Ornate Corner Accents -->
      <div style="position:absolute;top:4px;left:4px;width:24px;height:24px;border-top:2px solid #b45309;border-left:2px solid #b45309;"></div>
      <div style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-top:2px solid #b45309;border-right:2px solid #b45309;"></div>
      <div style="position:absolute;bottom:4px;left:4px;width:24px;height:24px;border-bottom:2px solid #b45309;border-left:2px solid #b45309;"></div>
      <div style="position:absolute;bottom:4px;right:4px;width:24px;height:24px;border-bottom:2px solid #b45309;border-right:2px solid #b45309;"></div>

      <!-- Header -->
      <div style="text-align:center;border-bottom:2px solid #881337;padding-bottom:8px;margin-bottom:10px;">
        <div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-bottom:4px;">
          <img src="${SCHOOL_META.logo}" style="width:${isA5 ? '44px' : '60px'};height:${isA5 ? '44px' : '60px'};object-fit:contain;" alt="Crest" />
          <div>
            <div style="font-size:${isA5 ? '16px' : '23px'};font-weight:900;color:#881337;letter-spacing:1px;text-transform:uppercase;">${SCHOOL_META.name}</div>
            <div style="font-size:${isA5 ? '8.5px' : '11px'};font-weight:600;color:#78350f;letter-spacing:0.5px;font-style:italic;">Estd. 2012 • Quality Education for a Brighter Future</div>
          </div>
        </div>
        <div style="font-size:8px;color:#78350f;letter-spacing:0.4px;">${SCHOOL_META.affiliation} • ${SCHOOL_META.campus}</div>
        
        <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center;background:#fef2f2;border:1px solid #fecaca;padding:3px 10px;border-radius:3px;">
          <span style="font-size:8.5px;font-weight:700;color:#881337;">FORM NO: ${s.formNo}</span>
          <span style="font-size:${isA5 ? '10px' : '12px'};font-weight:900;color:#881337;letter-spacing:1px;text-transform:uppercase;">APPLICATION FOR ADMISSION (${s.session})</span>
          <span style="font-size:8.5px;font-weight:700;color:#881337;">REG. NO: ${s.admissionNo}</span>
        </div>
      </div>

      <!-- Main Profile Section -->
      <div style="display:flex;gap:12px;margin-bottom:8px;">
        <div style="flex:1;">
          <div style="background:#881337;color:#fffdfa;font-weight:700;font-size:9px;padding:3px 8px;letter-spacing:0.5px;">PART I : PARTICULARS OF THE SCHOLAR</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};font-family:Arial,sans-serif;">
            <tr>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;width:25%;color:#581c87;">Name of Scholar</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:800;color:#881337;text-transform:uppercase;" colspan="3">${s.fullName}</td>
            </tr>
            <tr style="background:#fff7ed;">
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Class Admitted To</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:800;color:#0f172a;">${s.className} (Sec: ${s.section})</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Assigned Roll No.</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:800;">${s.rollNo}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Date of Birth</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;">${s.dob}</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Age on 31st March</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;">${s.age} Years</td>
            </tr>
            <tr style="background:#fff7ed;">
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">DOB in Words</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-style:italic;color:#78350f;" colspan="3">${s.dobWords}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Gender / Blood Group</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:600;">${s.gender} / <strong style="color:#b91c1c;">${s.bloodGroup}</strong></td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Category / Religion</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:600;">${s.category} / ${s.religion}</td>
            </tr>
            <tr style="background:#fff7ed;">
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Aadhaar Number</td>
              <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;letter-spacing:1px;" colspan="3">${s.aadhar}</td>
            </tr>
          </table>
        </div>
        <div style="flex:0 0 auto;">
          ${renderPhotoFrame(s.photoUrl, "CANDIDATE PHOTO")}
        </div>
      </div>

      <!-- Part II: Parental Directory -->
      <div style="margin-bottom:8px;">
        <div style="background:#881337;color:#fffdfa;font-weight:700;font-size:9px;padding:3px 8px;letter-spacing:0.5px;">PART II : PARENTAL &amp; GUARDIAN RECORD</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};font-family:Arial,sans-serif;">
          <tr style="background:#fdf2f8;font-weight:700;color:#881337;">
            <td style="width:25%;padding:4px 6px;border:1px solid #cbd5e1;">Particulars</td>
            <td style="width:37.5%;padding:4px 6px;border:1px solid #cbd5e1;">Father</td>
            <td style="width:37.5%;padding:4px 6px;border:1px solid #cbd5e1;">Mother</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Full Legal Name</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;text-transform:uppercase;">${s.fatherName}</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;text-transform:uppercase;">${s.motherName}</td>
          </tr>
          <tr style="background:#fff7ed;">
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Occupation</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;">${s.fatherOccupation}</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;">${s.motherOccupation}</td>
          </tr>
          <tr>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#581c87;">Primary Phone</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#881337;">${s.phone1}</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;color:#881337;">${s.phone2 !== '-' ? s.phone2 : s.whatsapp}</td>
          </tr>
        </table>
      </div>

      <!-- Part III: Address & Academic -->
      <div style="border:1px solid #cbd5e1;padding:6px;background:#ffffff;margin-bottom:8px;font-family:Arial,sans-serif;font-size:${fBase};">
        <div><strong>Postal &amp; Permanent Residence:</strong> ${s.fullAddress}</div>
        <div style="margin-top:3px;"><strong>Previous Academic Institution:</strong> ${s.prevSchool} | <strong>Class Passed:</strong> ${s.lastClassPassed} | <strong>T.C. Attached:</strong> ${s.tcReceived}</div>
        <div style="margin-top:3px;color:#881337;font-weight:700;"><strong>Emergency Notification Contact:</strong> ${s.emergencyContact} (${s.relation})</div>
      </div>

      <!-- Undertaking & Signatures -->
      <div style="border:1px solid #881337;padding:6px 10px;background:#fffdfa;font-family:Arial,sans-serif;">
        <div style="font-size:7.5px;color:#581c87;text-align:justify;line-height:1.2;">
          <strong>STATUTORY PARENTAL UNDERTAKING:</strong> I hereby declare that all entries in this form are correct and true. I promise to abide by all the school regulations and guidelines regarding studies, discipline, and fee revisions.
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:24px;text-align:center;">
          <div style="border-top:1px solid #881337;width:30%;padding-top:2px;font-size:8px;font-weight:700;color:#881337;">Father / Guardian's Signature</div>
          <div style="border-top:1px solid #881337;width:30%;padding-top:2px;font-size:8px;font-weight:700;color:#881337;">Mother's Signature</div>
          <div style="border-top:1px solid #881337;width:30%;padding-top:2px;font-size:8px;font-weight:700;color:#881337;">Principal &amp; Official Seal</div>
        </div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 3: MODERN MINIMALIST PRO (Indigo & Slate)
  // =========================================================================
  function renderMinimalistPro(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "9px" : "11px";

    return `
    <div class="tps-adm-doc tps-minimalist-pro" style="font-family:'Inter',system-ui,sans-serif;color:#0f172a;background:#ffffff;padding:${isA5 ? '10px' : '16px'};box-sizing:border-box;line-height:1.35;font-size:${fBase};">
      <!-- Clean Top Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${SCHOOL_META.logo}" style="width:48px;height:48px;object-fit:contain;" alt="Logo" />
          <div>
            <div style="font-size:${isA5 ? '15px' : '20px'};font-weight:800;color:#0f172a;letter-spacing:-0.5px;">${SCHOOL_META.name}</div>
            <div style="font-size:8.5px;color:#64748b;">${SCHOOL_META.affiliation} • Prem Nagar Campus</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="background:#e0e7ff;color:#4338ca;font-weight:700;font-size:9.5px;padding:3px 10px;border-radius:20px;text-transform:uppercase;">Admission Dossier</span>
          <div style="font-size:8.5px;color:#64748b;margin-top:4px;">No: <strong>${s.formNo}</strong> | Session: <strong>${s.session}</strong></div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
          <div style="font-size:7.5px;color:#64748b;font-weight:700;text-transform:uppercase;">Student Name</div>
          <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;">${s.fullName}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
          <div style="font-size:7.5px;color:#64748b;font-weight:700;text-transform:uppercase;">Class &amp; Roll</div>
          <div style="font-size:11px;font-weight:800;color:#4f46e5;margin-top:2px;">${s.className} (${s.section}) • Roll ${s.rollNo}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
          <div style="font-size:7.5px;color:#64748b;font-weight:700;text-transform:uppercase;">Admission No.</div>
          <div style="font-size:11px;font-weight:800;color:#059669;margin-top:2px;">${s.admissionNo}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">
          <div style="font-size:7.5px;color:#64748b;font-weight:700;text-transform:uppercase;">Aadhaar Number</div>
          <div style="font-size:11px;font-weight:800;color:#0f172a;margin-top:2px;">${s.aadhar}</div>
        </div>
      </div>

      <!-- Two-Column Main Body -->
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div style="flex:1;">
          <div style="font-weight:800;font-size:9.5px;color:#4f46e5;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Student Particulars</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};">
            <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;width:35%;">Date of Birth</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:700;">${s.dob} (${s.age} Yrs)</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">DOB in Words</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-style:italic;">${s.dobWords}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Gender &amp; Blood Group</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:700;">${s.gender} • <span style="color:#dc2626;">${s.bloodGroup}</span></td></tr>
            <tr style="background:#f8fafc;"><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Category &amp; Religion</td><td style="padding:4px 8px;border:1px solid #e2e8f0;">${s.category} • ${s.religion}</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Previous School</td><td style="padding:4px 8px;border:1px solid #e2e8f0;">${s.prevSchool} (Class: ${s.lastClassPassed})</td></tr>
          </table>

          <div style="font-weight:800;font-size:9.5px;color:#4f46e5;margin:8px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Parental Information</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:${fBase};">
            <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;width:35%;">Father's Name</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:700;">${s.fatherName} (${s.fatherOccupation})</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Mother's Name</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:700;">${s.motherName} (${s.motherOccupation})</td></tr>
            <tr><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Contact Phones</td><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:700;color:#4f46e5;">${s.phone1} / ${s.whatsapp}</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:4px 8px;border:1px solid #e2e8f0;color:#64748b;">Full Address</td><td style="padding:4px 8px;border:1px solid #e2e8f0;">${s.fullAddress}</td></tr>
          </table>
        </div>

        <div style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;">
          ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO")}
          <div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;width:125px;box-sizing:border-box;text-align:center;">
            <div style="font-size:7.5px;color:#64748b;font-weight:700;">ENCLOSURES</div>
            <div style="font-size:8px;color:#059669;margin-top:2px;">[✔] Birth Certificate<br />[✔] Aadhaar Card<br />[✔] Transfer Cert<br />[✔] Photos (4)</div>
          </div>
        </div>
      </div>

      <!-- Modern Footer Signatures -->
      <div style="border-top:1.5px solid #e2e8f0;padding-top:12px;margin-top:8px;display:flex;justify-content:space-between;text-align:center;">
        <div style="width:30%;border-top:1px solid #cbd5e1;padding-top:4px;font-size:8px;font-weight:700;color:#64748b;">Parent / Guardian Signature</div>
        <div style="width:30%;border-top:1px solid #cbd5e1;padding-top:4px;font-size:8px;font-weight:700;color:#64748b;">Admission Officer</div>
        <div style="width:30%;border-top:1.5px solid #4f46e5;padding-top:4px;font-size:8.5px;font-weight:800;color:#4f46e5;">Principal's Seal &amp; Sign</div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 4: CBSE OFFICIAL BOX-GRID FORMAT (Board Examination Standard)
  // =========================================================================
  function renderCbseBoxGrid(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8.5px" : "10px";

    return `
    <div class="tps-adm-doc tps-cbse-box-grid" style="font-family:Arial,sans-serif;color:#000000;background:#ffffff;border:2px solid #000000;padding:${isA5 ? '8px' : '14px'};box-sizing:border-box;line-height:1.3;font-size:${fBase};">
      <!-- Formal Government Header -->
      <div style="border-bottom:2px solid #000000;padding-bottom:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <img src="${SCHOOL_META.logo}" style="width:52px;height:52px;object-fit:contain;" alt="Logo" />
        <div style="text-align:center;flex:1;">
          <div style="font-size:${isA5 ? '15px' : '20px'};font-weight:900;letter-spacing:0.5px;text-transform:uppercase;">${SCHOOL_META.name}</div>
          <div style="font-size:8.5px;font-weight:700;">${SCHOOL_META.affiliation}</div>
          <div style="font-size:8px;">${SCHOOL_META.campus} • Contact: ${SCHOOL_META.contact}</div>
          <div style="display:inline-block;border:1.5px solid #000000;padding:2px 14px;font-weight:900;font-size:${isA5 ? '9px' : '11px'};margin-top:3px;text-transform:uppercase;">
            APPLICATION FOR ADMISSION • ACADEMIC SESSION ${s.session}
          </div>
        </div>
        <div style="text-align:right;font-size:8.5px;font-weight:700;">
          <div>SL NO: ${s.formNo}</div>
          <div>ADM NO: ${s.admissionNo}</div>
        </div>
      </div>

      <!-- Character Boxes for Student Name -->
      <div style="margin-bottom:6px;">
        <div style="font-size:8.5px;font-weight:700;margin-bottom:2px;">1. NAME OF PUPIL (IN CAPITAL LETTERS AS PER BIRTH CERTIFICATE):</div>
        ${renderCharBoxes(s.fullName, 28)}
      </div>

      <!-- Date of Birth & Aadhaar Grid -->
      <div style="display:flex;gap:12px;margin-bottom:8px;align-items:stretch;">
        <div style="flex:1;">
          <div style="font-size:8.5px;font-weight:700;margin-bottom:2px;">2. AADHAAR CARD NUMBER OF PUPIL:</div>
          ${renderCharBoxes(s.aadhar.replace(/\D/g, ""), 12)}

          <div style="display:flex;gap:8px;margin-top:6px;">
            <div style="flex:1;">
              <div style="font-size:8px;font-weight:700;">3. DATE OF BIRTH (DD/MM/YYYY):</div>
              ${renderCharBoxes(s.dob.replace(/-/g, ""), 8)}
            </div>
            <div style="flex:1;">
              <div style="font-size:8px;font-weight:700;">4. CLASS SOUGHT:</div>
              <div style="border:1px solid #000;padding:2px 6px;font-weight:800;background:#f8fafc;font-size:10px;">${s.className} (Sec: ${s.section})</div>
            </div>
          </div>

          <div style="font-size:8px;margin-top:4px;">
            <strong>DOB in Words:</strong> <span style="font-style:italic;">${s.dobWords}</span>
          </div>
        </div>

        <div style="flex:0 0 auto;">
          ${renderPhotoFrame(s.photoUrl, "STUDENT PHOTO")}
        </div>
      </div>

      <!-- Structured Grid Table -->
      <table style="width:100%;border-collapse:collapse;border:1.5px solid #000000;font-size:${fBase};margin-bottom:8px;">
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;width:25%;">Father's Full Name</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;" colspan="3">${s.fatherName} (Occ: ${s.fatherOccupation})</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Mother's Full Name</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;" colspan="3">${s.motherName} (Occ: ${s.motherOccupation})</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Category (Tick)</td>
          <td style="padding:4px 6px;border:1px solid #000;">
            [ ${s.category === 'General' ? '✔' : ' '} ] GEN &nbsp; [ ${s.category === 'OBC' ? '✔' : ' '} ] OBC &nbsp; [ ${s.category === 'SC' ? '✔' : ' '} ] SC &nbsp; [ ${s.category === 'ST' ? '✔' : ' '} ] ST
          </td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Blood Group / Gender</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">${s.bloodGroup} / ${s.gender}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Permanent Address</td>
          <td style="padding:4px 6px;border:1px solid #000;" colspan="3">${s.fullAddress}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Mobile Phone Numbers</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Primary: ${s.phone1}</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">WhatsApp / Alt</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">${s.whatsapp}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Previous School &amp; Class</td>
          <td style="padding:4px 6px;border:1px solid #000;">${s.prevSchool} (Class ${s.lastClassPassed})</td>
          <td style="padding:4px 6px;border:1px solid #000;font-weight:700;">Transfer Cert (TC)</td>
          <td style="padding:4px 6px;border:1px solid #000;">${s.tcReceived}</td>
        </tr>
      </table>

      <!-- Enclosures & Formal Undertaking -->
      <div style="border:1px solid #000;padding:4px 6px;margin-bottom:8px;font-size:7.5px;line-height:1.25;">
        <strong>VERIFICATION CHECKLIST:</strong> &nbsp;
        [${s.hasBirthCert ? '✔' : ' '}] Birth Certificate &nbsp; [${s.hasAadharDoc ? '✔' : ' '}] Aadhaar Copy &nbsp; [${s.hasTcDoc ? '✔' : ' '}] Transfer Certificate &nbsp; [✔] 4 Passport Photos &nbsp; [✔] Parent ID<br />
        <strong>PARENTAL DECLARATION:</strong> I hereby declare that the date of birth and all particulars entered in this form are correct and I shall not apply for any alteration in date of birth or name in the future. I agree to abide by the school rules.
      </div>

      <!-- Formal Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:20px;text-align:center;font-size:8px;font-weight:700;">
        <div style="border-top:1px solid #000;width:28%;padding-top:2px;">Signature of Parent/Guardian</div>
        <div style="border-top:1px solid #000;width:28%;padding-top:2px;">Admission Clerk (Verified)</div>
        <div style="border-top:1px solid #000;width:28%;padding-top:2px;">Principal (Approved) &amp; Seal</div>
      </div>
    </div>`;
  }

  // =========================================================================
  // TEMPLATE 5: DUAL COUNTER & PARENT COPY (Perforated Split)
  // =========================================================================
  function renderDualCounterSlip(s, sizeId) {
    const isA5 = sizeId === "a5";
    const fBase = isA5 ? "8px" : "10px";

    function renderHalf(isParentCopy = false) {
      return `
      <div style="border:1.5px solid #1e3a8a;border-radius:4px;padding:${isA5 ? '6px' : '10px'};background:#ffffff;position:relative;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #1e3a8a;padding-bottom:4px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${SCHOOL_META.logo}" style="width:36px;height:36px;object-fit:contain;" alt="Logo" />
            <div>
              <div style="font-size:${isA5 ? '13px' : '16px'};font-weight:900;color:#1e3a8a;line-height:1.1;">${SCHOOL_META.name}</div>
              <div style="font-size:7.5px;color:#64748b;">${SCHOOL_META.campus} • Ph: 7488061954</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="background:${isParentCopy ? '#059669' : '#1e3a8a'};color:#ffffff;font-size:8px;font-weight:800;padding:2px 8px;border-radius:3px;text-transform:uppercase;">
              ${isParentCopy ? 'STUDENT / PARENT ACKNOWLEDGMENT COPY' : 'OFFICE ARCHIVE COPY'}
            </span>
            <div style="font-size:8px;font-weight:700;color:#0f172a;margin-top:2px;">Form: <strong>${s.formNo}</strong> | Adm No: <strong>${s.admissionNo}</strong></div>
          </div>
        </div>

        <!-- Table Data -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:${fBase};line-height:1.25;">
          <tr>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;width:22%;color:#334155;">Student Name</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:800;color:#0f172a;text-transform:uppercase;" colspan="2">${s.fullName}</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#2563eb;" colspan="1">Class: ${s.className} (${s.section}) • Roll: ${s.rollNo}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">Father's Name</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;">${s.fatherName}</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">Mother's Name</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;">${s.motherName}</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">DOB / Blood Grp</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;">${s.dob} • <strong style="color:#dc2626;">${s.bloodGroup}</strong></td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">Contact Phone</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#1e3a8a;">${s.phone1}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">Residential Address</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;" colspan="3">${s.fullAddress}</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;font-weight:700;color:#334155;">Fee Clearance</td>
            <td style="padding:3px 6px;border:1px solid #cbd5e1;color:#16a34a;font-weight:800;" colspan="3">
              Adm Fee: ₹${s.admissionFee} | Monthly: ₹${s.monthlyFee} | <strong>Total Paid: ₹${s.totalPayable} (Receipt TPS-${s.formNo})</strong>
            </td>
          </tr>
        </table>

        <!-- Signatures Strip -->
        <div style="display:flex;justify-content:space-between;margin-top:14px;text-align:center;font-size:7.5px;font-weight:700;color:#475569;">
          <div style="border-top:1px solid #64748b;width:30%;padding-top:2px;">Parent / Guardian Signature</div>
          <div style="border-top:1px solid #64748b;width:30%;padding-top:2px;">Cashier / In-Charge</div>
          <div style="border-top:1.5px solid #1e3a8a;width:30%;padding-top:2px;color:#1e3a8a;font-weight:800;">Principal's Seal &amp; Signature</div>
        </div>
      </div>`;
    }

    return `
    <div class="tps-adm-doc tps-dual-counter-slip" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;">
      <!-- TOP: OFFICE ARCHIVE COPY -->
      ${renderHalf(false)}

      <!-- PERFORATION SCISSORS LINE -->
      <div style="text-align:center;margin:${isA5 ? '6px 0' : '10px 0'};position:relative;">
        <div style="border-top:1.5px dashed #94a3b8;position:absolute;top:50%;left:0;right:0;z-index:0;"></div>
        <span style="position:relative;z-index:1;background:#ffffff;padding:0 12px;font-size:8px;font-weight:700;color:#64748b;letter-spacing:1px;">
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
    return `
    <div class="tps-adm-doc tps-a3-double-spread" style="font-family:'Poppins',Arial,sans-serif;color:#1e293b;background:#ffffff;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;gap:24px;border:3px solid #1e3a8a;padding:20px;">
      
      <!-- LEFT SPREAD: PROSPECTUS & SCHOLAR PROFILE -->
      <div style="border-right:2px dashed #cbd5e1;padding-right:24px;">
        <div style="background:#1e3a8a;color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px;margin-bottom:12px;text-align:center;letter-spacing:1px;">
          DOSSIER PANEL A : SCHOLAR ENROLMENT &amp; BIOGRAPHICAL RECORD
        </div>
        ${templateRenderer(s, "a4")}
      </div>

      <!-- RIGHT SPREAD: LEGAL UNDERTAKING, MEDICAL & OFFICE REGISTRY -->
      <div style="padding-left:6px;">
        <div style="background:#d97706;color:#ffffff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px;margin-bottom:12px;text-align:center;letter-spacing:1px;">
          DOSSIER PANEL B : STATUTORY UNDERTAKINGS, RULES &amp; REGISTRATION DOCKET
        </div>

        <!-- School Rules & Code of Conduct -->
        <div style="border:1.5px solid #cbd5e1;border-radius:6px;padding:12px;margin-bottom:12px;background:#f8fafc;font-size:9.5px;line-height:1.4;">
          <div style="font-weight:800;color:#1e3a8a;font-size:10.5px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">
            INSTITUTIONAL CODE OF CONDUCT &amp; ACADEMIC REGULATIONS
          </div>
          <ol style="margin:0;padding-left:18px;color:#334155;">
            <li><strong>Attendance Requirement:</strong> A minimum of 75% attendance is compulsory for eligibility in CBSE Board Examinations and annual promotions.</li>
            <li><strong>Fee Schedule:</strong> Monthly tuition fees must be cleared on or before the 10th of every calendar month. Defaulting accounts attract late fee charges.</li>
            <li><strong>Uniform &amp; Discipline:</strong> Students must strictly attend school in full prescribed uniform with ID badge. Mobile phones and contraband are strictly prohibited.</li>
            <li><strong>Campus Safety:</strong> School transport arrangements are subject to route safety and geofence tracking policies.</li>
          </ol>
        </div>

        <!-- Medical & Health Record -->
        <div style="border:1.5px solid #cbd5e1;border-radius:6px;padding:12px;margin-bottom:12px;background:#ffffff;font-size:9.5px;line-height:1.4;">
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
        <div style="border:2px solid #1e3a8a;border-radius:6px;padding:12px;background:#f0fdf4;margin-bottom:12px;">
          <div style="font-weight:800;color:#166534;font-size:11px;margin-bottom:6px;text-transform:uppercase;">
            OFFICIAL ADMISSION COMMITTEE RESOLUTION
          </div>
          <div style="font-size:9px;color:#166534;line-height:1.4;">
            The application for admission of <strong>${s.fullName}</strong> to Class <strong>${s.className} (Section ${s.section})</strong> for Session <strong>${s.session}</strong> has been scrutinized and found compliant with CBSE affiliation bye-laws. All original transfer certificates and birth records have been authenticated.
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:30px;text-align:center;font-size:8.5px;font-weight:700;">
            <div style="border-top:1px solid #166534;width:30%;padding-top:4px;">Admission Scrutiny Officer</div>
            <div style="border-top:1px solid #166534;width:30%;padding-top:4px;">Accounts Department</div>
            <div style="border-top:1.5px solid #166534;width:30%;padding-top:4px;color:#166534;font-weight:800;">Principal's Seal &amp; Signature</div>
          </div>
        </div>

        <!-- Legal Disclaimer -->
        <div style="font-size:8px;color:#94a3b8;text-align:center;margin-top:16px;">
          Tapowan Public School Comprehensive Academic Folio • Document Authentication Code: TPS-CBSE-A3-${s.formNo}
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

  // --- RENDER MASTER HTML ---
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

    return `
    <div id="tpsAdmissionPrintRoot" class="tps-print-container ${size.id}" style="width:100%;margin:0 auto;box-sizing:border-box;">
      <style>
        ${size.pageRule}
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
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
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
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
                <span style="background:#2563eb;color:#ffffff;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;">Multi-Size</span>
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
      renderContainer.style.minHeight = curSizeObj.previewMinHeight;
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
            <title>Admission Form - ${SCHOOL_META.name}</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800;900&family=Cinzel:wght@700;900&family=Inter:wght@400;600;700;800&display=swap">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
            <style>
              ${size.pageRule}
              * { box-sizing: border-box; }
              body { margin: 0; padding: 0; background: #fff; font-family: 'Poppins', Arial, sans-serif; }
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
    const tempEl = document.createElement("div");
    tempEl.style.width = size.previewWidth;
    tempEl.style.background = "#ffffff";
    tempEl.innerHTML = renderAdmissionFormHtml(studentData, templateId, sizeId);
    document.body.appendChild(tempEl);

    const opt = {
      margin: sizeId === "a5" ? 4 : 8,
      filename: `Admission_Form_${s.admissionNo}_${s.className}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: {
        unit: "mm",
        format: sizeId === "a3" ? "a3" : (sizeId === "a5" ? "a5" : "a4"),
        orientation: size.orientation
      }
    };

    if (typeof showToast === "function") showToast("Generating PDF file...", "info");

    html2pdf().set(opt).from(tempEl).save().then(() => {
      tempEl.remove();
      if (typeof showToast === "function") showToast("Admission Form PDF Downloaded!", "success");
    }).catch(err => {
      tempEl.remove();
      console.error("PDF download error:", err);
      if (typeof showToast === "function") showToast("PDF generation failed, opening print dialog...", "warning");
      window.printAdmissionForm(studentData, templateId, sizeId);
    });
  }

  // --- EXPORT TO GLOBAL WINDOW OBJECT ---
  window.admissionFormSizes = ADMISSION_SIZES;
  window.admissionTemplates = ADMISSION_TEMPLATES;
  window.normalizeAdmissionStudentData = normalizeAdmissionStudentData;
  window.renderAdmissionFormHtml = renderAdmissionFormHtml;
  window.openAdmissionFormStudio = openAdmissionFormStudio;
  window.printAdmissionForm = printAdmissionForm;
  window.downloadAdmissionPDF = downloadAdmissionPDF;

})(window, document);
