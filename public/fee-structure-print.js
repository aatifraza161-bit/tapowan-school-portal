/**
 * EduCore Multi-Tenant ERP - Official Fee Structure Print Engine
 * Provides pixel-perfect landscape document rendering, interactive preview modal,
 * browser printing pipeline, and PDF export matching the site's modern UI design system.
 */
(function (global) {
  "use strict";

  // Master baseline fee structure rows and class definitions
  const MASTER_FEE_STRUCTURE_TEMPLATE = {
    classes: ["N/C", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    rows: [
      {
        id: "adm_form",
        title: "Admission Form",
        sub: "(One Time)",
        type: "standard",
        values: ["500", "500", "500", "500", "500", "500", "500", "500", "500", "500", "500", "500", "500"]
      },
      {
        id: "reg_fee",
        title: "Registration Fee",
        sub: "(One Time)",
        type: "standard",
        values: ["Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil"]
      },
      {
        id: "adm_fee",
        title: "Admission Fee",
        sub: "(One Time)",
        type: "standard",
        values: ["1000", "1000", "1000", "1200", "1200", "1200", "1200", "1200", "1200", "1500", "1500", "1500", "1500"]
      },
      {
        id: "dev_fund",
        title: "Development Fund",
        sub: "(Yearly)",
        type: "standard",
        values: ["500", "500", "500", "500", "500", "500", "500", "500", "800", "800", "800", "800", "800"]
      },
      {
        id: "stationery",
        title: "Basic Stationery Fee",
        sub: "(Yearly)",
        type: "standard",
        values: ["500", "500", "500", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil"]
      },
      {
        id: "computer",
        title: "Computer Fee",
        sub: "(Monthly)",
        type: "standard",
        values: ["Nil", "Nil", "Nil", "50", "50", "100", "100", "100", "100", "100", "100", "100", "100"]
      },
      {
        id: "karate",
        title: "Karate Fee",
        sub: "(Monthly)",
        type: "standard",
        values: ["Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil"]
      },
      {
        id: "transport_bus",
        title: "Transportation Fee",
        sub: "(Bus)",
        type: "standard",
        values: ["Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil", "Nil"]
      },
      {
        id: "tuition",
        title: "Tuition Fee",
        sub: "(Monthly)",
        type: "merged_end",
        values: ["400", "400", "400", "480", "480", "500", "500", "500", "500", "700", "700"],
        mergedColspan: 2,
        mergedHtml: '<span style="font-weight:700; color:#1e3a8a;">JAC: 700</span> &nbsp;|&nbsp; <span style="font-weight:700; color:#2563eb;">CBSE: 800</span>'
      },
      {
        id: "exam",
        title: "Examination Fee",
        sub: "(Aug & Dec)",
        type: "merged_end",
        values: ["150/150", "150/150", "150/150", "200/200", "200/200", "200/200", "250/250", "250/250", "250/250", "250/250", "250/250"],
        mergedColspan: 2,
        mergedHtml: '<div style="line-height:1.2; font-weight:700; color:#475569; font-size:11px;">As per Board<br>Instruction</div>'
      },
      {
        id: "transport_van",
        title: "Transportation Fee",
        sub: "(Van)",
        type: "merged_distance",
        values: ["-", "-", "-", "-", "-", "-", "-", "-", "-"],
        mergedColspan: 4,
        mergedHtml: '<span style="font-weight:600; color:#64748b; font-size:11.5px;">Calculated as per distance</span>'
      }
    ],
    footer: {
      examsBadge: "EXAMS",
      examsText: "Two Periodic Tests & Two Term Exams per academic session.",
      noteBadge: "IMPORTANT",
      noteText: 'Monthly tuition fees are payable by the 10th of each month. Yearly charges payable before April.'
    }
  };

  /**
   * Helper to retrieve current school branding dynamically from store or settings
   */
  function resolveSchoolBranding(overrides = {}) {
    let sm = {};
    try {
      if (typeof global.getSchoolMeta === "function") {
        sm = global.getSchoolMeta() || {};
      }
    } catch (_) {}

    const schoolProfile = (global.store && global.store.schoolProfile) || {};

    // Detect school name dynamically
    let sName = "";
    if (sm.name && sm.name.trim()) {
      sName = sm.name.trim();
    } else if (schoolProfile.schoolName && schoolProfile.schoolName.trim()) {
      sName = schoolProfile.schoolName.trim();
    } else if (typeof document !== "undefined" && document.title) {
      const parts = document.title.split("—")[0].trim();
      if (parts && !parts.toLowerCase().includes("educore")) sName = parts;
    }

    if (!sName) {
      if (typeof window !== "undefined" && window.location && window.location.hostname.includes("dav")) {
        sName = "DAV Public School";
      } else {
        sName = "Tapowan Public School";
      }
    }

    // Detect location / campus
    let sLoc = "";
    if (sm.campus || sm.address) {
      sLoc = (sm.campus || sm.address).trim();
    } else if (schoolProfile.schoolAddress) {
      sLoc = schoolProfile.schoolAddress.trim();
    }
    if (!sLoc) {
      sLoc = sName.toLowerCase().includes("dav") ? "DAV Public School Campus" : "Prem Nagar Tapin North, Ramgarh, Jharkhand";
    }

    // Logo
    let sLogo = sm.logo || schoolProfile.logo || "logo.png";
    if (sLogo.startsWith("http://")) sLogo = sLogo.replace("http://", "https://");

    // Contact & Affiliation
    const sPhone = sm.phone || schoolProfile.schoolPhone || "+91 87577 44973, +91 62991 22869";
    const sEmail = sm.email || schoolProfile.schoolEmail || "info@school.edu";
    const sAffiliation = sm.affiliation || "CBSE AFFILIATED PATTERN • AN ENGLISH MEDIUM CO-ED INSTITUTION";
    const sCode = sm.code || sm.schoolCode || "825314";
    const sAffNo = sm.affiliationNo || "";
    const sUdise = sm.udise || "U-DISE: 20241202412";

    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

    // Respect user custom overrides from DOM edit mode if provided
    return {
      schoolName: overrides.schoolName || sName.toUpperCase(),
      subtitle: overrides.subtitle || "OFFICIAL FEE STRUCTURE",
      date: overrides.date || formattedDate,
      location: overrides.location || sLoc,
      logo: sLogo,
      phone: sPhone,
      email: sEmail,
      affiliation: sAffiliation,
      schoolCode: sCode,
      affiliationNo: sAffNo,
      udise: sUdise,
      session: "2026–2027",
      classes: overrides.classes || MASTER_FEE_STRUCTURE_TEMPLATE.classes,
      rows: overrides.rows || MASTER_FEE_STRUCTURE_TEMPLATE.rows,
      footer: overrides.footer || MASTER_FEE_STRUCTURE_TEMPLATE.footer
    };
  }

  /**
   * Match helper to link DB class strings (e.g. 'Nursery-A', 'I-A', 'Class 5') to table column keys
   */
  function matchClass(dbCls, targetCol) {
    if (!dbCls) return false;
    const c = String(dbCls).toLowerCase().replace(/class/i, '').replace(/[\s\-_]/g, '');
    const t = String(targetCol).toLowerCase().replace(/[\s\-_]/g, '');
    if (t === 'n/c' || t === 'nc') return c.includes('nur') || c.includes('nc');
    if (t === 'lkg') return c.includes('lkg');
    if (t === 'ukg') return c.includes('ukg');
    const romanMap = { '1': 'i', '2': 'ii', '3': 'iii', '4': 'iv', '5': 'v', '6': 'vi', '7': 'vii', '8': 'viii', '9': 'ix', '10': 'x' };
    const r = romanMap[t];
    return c.startsWith(t) || (r && (c.startsWith(r) || c === r));
  }

  /**
   * Sync amounts from DB fee structures into a copy of data
   */
  function syncWithDbFeeStructures(baseData) {
    const data = JSON.parse(JSON.stringify(baseData));
    let fsList = [];
    try {
      if (typeof global.getStore === "function") {
        fsList = global.getStore().feeStructures || [];
      }
      if (!fsList.length && Array.isArray(global.feeStructures)) {
        fsList = global.feeStructures;
      }
    } catch (_) {}

    if (!fsList.length) return data;

    data.classes.forEach((col, colIdx) => {
      const classRows = fsList.filter(f => matchClass(f.className, col));
      if (!classRows.length) return;

      // 1. Tuition Fee
      const tuition = classRows.find(f => (f.feeType || "").toLowerCase().includes("tuition"));
      if (tuition && tuition.amount) {
        const tuitionRow = data.rows.find(r => r.id === "tuition");
        if (tuitionRow && colIdx < tuitionRow.values.length) {
          tuitionRow.values[colIdx] = String(tuition.amount);
        }
      }

      // 2. Admission Fee
      const adm = classRows.find(f => (f.feeType || "").toLowerCase().includes("admission") && !(f.feeType || "").toLowerCase().includes("form"));
      if (adm && adm.amount) {
        const admRow = data.rows.find(r => r.id === "adm_fee");
        if (admRow && colIdx < admRow.values.length) {
          admRow.values[colIdx] = String(adm.amount);
        }
      }

      // 3. Computer Fee
      const comp = classRows.find(f => (f.feeType || "").toLowerCase().includes("computer"));
      if (comp && comp.amount) {
        const compRow = data.rows.find(r => r.id === "computer");
        if (compRow && colIdx < compRow.values.length) {
          compRow.values[colIdx] = String(comp.amount);
        }
      }

      // 4. Development Fund
      const dev = classRows.find(f => (f.feeType || "").toLowerCase().includes("development"));
      if (dev && dev.amount) {
        const devRow = data.rows.find(r => r.id === "dev_fund");
        if (devRow && colIdx < devRow.values.length) {
          devRow.values[colIdx] = String(dev.amount);
        }
      }
    });

    return data;
  }

  /**
   * Renders the complete HTML markup for the fee structure document.
   * Matches the visual quality and branding of EduCore Admit Cards & Report Cards.
   */
  function renderFeeStructureHtml(customData = {}, options = {}) {
    const data = resolveSchoolBranding(customData);
    const isEditable = !!options.editable;
    const editAttr = isEditable ? 'contenteditable="true" spellcheck="false"' : '';

    const theadCols = data.classes.map(c => `
      <th style="padding:9px 3px; text-align:center; color:#ffffff; font-size:11.5px; font-weight:800; border-right:1px solid rgba(255,255,255,0.2); letter-spacing:0.4px;">
        ${c}
      </th>
    `).join("");

    const tbodyRows = data.rows.map((row, rIdx) => {
      let cellsHtml = "";
      const isOdd = rIdx % 2 === 1;
      const rowBg = isOdd ? "#f8fafc" : "#ffffff";
      const isTuition = row.id === "tuition";

      if (row.type === "standard") {
        cellsHtml = row.values.map((val, cIdx) => {
          const isNil = String(val).trim().toLowerCase() === "nil";
          const isDash = String(val).trim() === "-";
          const color = (isNil || isDash) ? "#94a3b8" : (isTuition ? "#1e3a8a" : "#1e293b");
          const weight = (isNil || isDash) ? "500" : "700";
          return `
            <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:7px 3px; text-align:center; border:1px solid #e2e8f0; font-size:12px; font-weight:${weight}; color:${color};" ${editAttr}>
              ${val}
            </td>
          `;
        }).join("");
      } else if (row.type === "merged_end") {
        const stdCells = row.values.map((val, cIdx) => {
          const isNil = String(val).trim().toLowerCase() === "nil";
          const isDash = String(val).trim() === "-";
          const color = (isNil || isDash) ? "#94a3b8" : (isTuition ? "#1e3a8a" : "#1e293b");
          const weight = (isNil || isDash) ? "500" : "700";
          return `
            <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:7px 3px; text-align:center; border:1px solid #e2e8f0; font-size:12px; font-weight:${weight}; color:${color};" ${editAttr}>
              ${val}
            </td>
          `;
        }).join("");

        const mergedCell = `
          <td data-row-idx="${rIdx}" data-merged="end" colspan="${row.mergedColspan}" style="padding:7px 4px; text-align:center; border:1px solid #e2e8f0; vertical-align:middle;" ${editAttr}>
            ${row.mergedHtml}
          </td>
        `;
        cellsHtml = stdCells + mergedCell;
      } else if (row.type === "merged_distance") {
        const stdCells = row.values.map((val, cIdx) => `
          <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:7px 3px; text-align:center; border:1px solid #e2e8f0; font-size:12px; font-weight:500; color:#94a3b8;" ${editAttr}>
            ${val}
          </td>
        `).join("");

        const mergedCell = `
          <td data-row-idx="${rIdx}" data-merged="distance" colspan="${row.mergedColspan}" style="padding:7px 6px; text-align:center; border:1px solid #e2e8f0; vertical-align:middle;" ${editAttr}>
            ${row.mergedHtml}
          </td>
        `;
        cellsHtml = stdCells + mergedCell;
      }

      const rowHighlightStyle = isTuition ? 'background:#f0f7ff;' : `background:${rowBg};`;

      return `
        <tr style="${rowHighlightStyle}">
          <td style="padding:7px 12px; text-align:left; border:1px solid #e2e8f0; vertical-align:middle;">
            <div data-row-title="${rIdx}" style="font-weight:800; color:#0f172a; font-size:12px; line-height:1.2;" ${editAttr}>${row.title}</div>
            <div data-row-sub="${rIdx}" style="font-size:10px; color:#64748b; font-weight:600; margin-top:1px;" ${editAttr}>${row.sub}</div>
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join("");

    return `
      <div id="tpsFeeStructureDocument" style="width:100%; max-width:1120px; margin:0 auto; background:#ffffff; box-sizing:border-box; font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1e293b; padding:18px 24px; border:1.5px solid #e2e8f0; border-radius:12px; box-shadow:0 4px 20px -2px rgba(0,0,0,0.06);">
        
        <!-- OFFICIAL HEADER BLOCK WITH LOGO & ACCREDITATION -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:12px; margin-bottom:12px; gap:16px;">
          
          <!-- School Logo / Crest -->
          <div style="width:72px; height:72px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:4px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <img src="${data.logo}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="Logo" onerror="this.src='logo.png';" />
          </div>

          <!-- School Branding Center -->
          <div style="flex:1; text-align:center;">
            <div style="font-size:8pt; font-weight:800; letter-spacing:1px; color:#b45309; text-transform:uppercase; margin-bottom:1px;">
              ${data.affiliation}
            </div>
            <h1 id="tps-fs-doc-schoolname" style="margin:0; font-size:22pt; font-weight:900; color:#1e3a8a; letter-spacing:0.8px; line-height:1.1; font-family:'Poppins','Cinzel',serif;" ${editAttr}>
              ${data.schoolName}
            </h1>
            <div style="font-size:7.8pt; font-weight:700; color:#475569; margin-top:2px;">
              <span id="tps-fs-doc-location" ${editAttr}>${data.location}</span> &bull; Helpline: <span>${data.phone}</span>
            </div>
            <div style="margin-top:4px;">
              <span style="display:inline-block; background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color:#ffffff; font-size:8.5pt; font-weight:900; padding:2px 14px; border-radius:4px; letter-spacing:1.5px; text-transform:uppercase; box-shadow:0 2px 4px rgba(30,58,138,0.2);">
                ${data.subtitle} &bull; SESSION ${data.session}
              </span>
            </div>
          </div>

          <!-- Right Official Verification Badge -->
          <div style="width:160px; flex-shrink:0; text-align:right;">
            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:8px; padding:6px 10px; font-size:7.5pt; text-align:left; line-height:1.45; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
              <div style="font-weight:800; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:3px; margin-bottom:3px;">
                ${data.udise}
              </div>
              <div style="font-weight:700; color:#1e3a8a;">
                SCH. CODE: ${data.schoolCode}
              </div>
              <div style="font-weight:700; color:#047857;">
                DATE: <span id="tps-fs-doc-date" ${editAttr}>${data.date}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- MAIN FEE STRUCTURE TABLE -->
        <table style="width:100%; border-collapse:collapse; margin-top:6px; border:1.5px solid #cbd5e1; border-radius:8px; overflow:hidden; table-layout:fixed;">
          <colgroup>
            <col style="width:19%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
            <col style="width:6.23%;">
          </colgroup>
          <thead>
            <tr style="background:linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);">
              <th style="padding:9px 12px; text-align:left; color:#ffffff; font-size:11.5px; font-weight:800; border-right:1px solid rgba(255,255,255,0.2); letter-spacing:0.5px;">
                PARTICULARS
              </th>
              ${theadCols}
            </tr>
          </thead>
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>

        <!-- FOOTER BADGES & POLICY NOTES -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:0 2px; flex-wrap:wrap; gap:8px;">
          <div style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; border:1px solid #bfdbfe; padding:4px 10px; border-radius:6px;">
            <span style="background:#2563eb; color:#ffffff; font-weight:800; font-size:9.5px; padding:2px 6px; border-radius:3px; letter-spacing:0.5px;" ${editAttr}>${data.footer.examsBadge}</span>
            <span style="font-size:11px; font-weight:700; color:#1e40af;" ${editAttr}>${data.footer.examsText}</span>
          </div>
          <div style="display:inline-flex; align-items:center; gap:6px; background:#fff7ed; border:1px solid #fed7aa; padding:4px 10px; border-radius:6px;">
            <span style="background:#ea580c; color:#ffffff; font-weight:800; font-size:9.5px; padding:2px 6px; border-radius:3px; letter-spacing:0.5px;" ${editAttr}>${data.footer.noteBadge}</span>
            <span style="font-size:11px; font-weight:700; color:#9a3412;" ${editAttr}>${data.footer.noteText}</span>
          </div>
        </div>

        <!-- OFFICIAL SIGNATURE SEALS -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:28px; padding:0 16px 4px 16px;">
          <div style="text-align:center; min-width:140px;">
            <div style="border-top:1.5px dashed #94a3b8; width:100%; margin-bottom:4px;"></div>
            <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Parent / Guardian</div>
          </div>
          <div style="text-align:center; min-width:140px;">
            <div style="border-top:1.5px dashed #94a3b8; width:100%; margin-bottom:4px;"></div>
            <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Accounts / Cashier</div>
          </div>
          <div style="text-align:center; min-width:160px;">
            <div style="border-top:1.5px solid #1e3a8a; width:100%; margin-bottom:4px;"></div>
            <div style="font-size:10.5px; font-weight:900; color:#1e3a8a; text-transform:uppercase; letter-spacing:0.5px;">Principal &bull; Official Seal</div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Scrapes DOM modifications back into the data object to preserve user in-browser edits
   */
  function syncDataFromDOM(rootEl, curData) {
    if (!rootEl) return curData;
    try {
      const sName = rootEl.querySelector("#tps-fs-doc-schoolname");
      if (sName) curData.schoolName = sName.innerText.trim();

      const dt = rootEl.querySelector("#tps-fs-doc-date");
      if (dt) curData.date = dt.innerText.trim();

      const loc = rootEl.querySelector("#tps-fs-doc-location");
      if (loc) curData.location = loc.innerText.trim();

      // Scrape cells
      rootEl.querySelectorAll("td[data-row-idx][data-col-idx]").forEach(td => {
        const rIdx = Number(td.dataset.rowIdx);
        const cIdx = Number(td.dataset.colIdx);
        if (curData.rows[rIdx] && curData.rows[rIdx].values[cIdx] !== undefined) {
          curData.rows[rIdx].values[cIdx] = td.innerText.trim();
        }
      });

      rootEl.querySelectorAll("td[data-merged='end']").forEach(td => {
        const rIdx = Number(td.dataset.rowIdx);
        if (curData.rows[rIdx]) {
          curData.rows[rIdx].mergedHtml = td.innerHTML;
        }
      });

      rootEl.querySelectorAll("td[data-merged='distance']").forEach(td => {
        const rIdx = Number(td.dataset.rowIdx);
        if (curData.rows[rIdx]) {
          curData.rows[rIdx].mergedHtml = td.innerHTML;
        }
      });
    } catch (e) {
      console.warn("[FeeStructurePrint] syncDataFromDOM error:", e);
    }
    return curData;
  }

  /**
   * Executes high-quality browser print for the fee structure using an isolated hidden iframe.
   */
  function printFeeStructure(customData = {}, paperSize = "a4") {
    const html = renderFeeStructureHtml(customData, { editable: false });
    const data = resolveSchoolBranding(customData);
    const title = data.schoolName || "School";

    try {
      let iframe = document.getElementById("__tps_fs_print_iframe__");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "__tps_fs_print_iframe__";
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
            <title>${title} - Official Fee Structure</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap">
            <style>
              @page {
                size: ${paperSize === "a3" ? "A3 landscape" : "A4 landscape"};
                margin: 6mm 8mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                font-family: 'Poppins', Arial, sans-serif;
                width: 100% !important;
              }
              #tpsFeeStructureDocument {
                border: none !important;
                box-shadow: none !important;
                padding: 4mm 6mm !important;
                max-width: 100% !important;
                page-break-inside: avoid !important;
              }
              table {
                page-break-inside: avoid !important;
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
          console.warn("[FeeStructurePrint] Iframe print fallback:", e);
          window.print();
        }
      }, 350);
    } catch (err) {
      console.error("[FeeStructurePrint] Print initiation error:", err);
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html><html><head><title>${title} - Official Fee Structure</title>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap">
          <style>@page { size: landscape; margin: 8mm; } body { font-family: 'Poppins', sans-serif; }</style>
          </head><body>${html}</body></html>
        `);
        printWin.document.close();
        printWin.print();
      }
    }
  }

  /**
   * PDF Download using html2pdf or fallback printing
   */
  async function downloadFeeStructurePDF(customData = {}, paperSize = "a4") {
    const data = resolveSchoolBranding(customData);
    const filename = `${data.schoolName.replace(/[^a-zA-Z0-9]/g, "_")}_Official_Fee_Structure.pdf`;

    if (typeof global.html2pdf === "function") {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.width = paperSize === "a3" ? "1580px" : "1120px";
      container.innerHTML = renderFeeStructureHtml(customData, { editable: false });
      document.body.appendChild(container);

      const opt = {
        margin: [6, 8, 6, 8],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: paperSize === "a3" ? "a3" : "a4", orientation: "landscape" }
      };

      try {
        await global.html2pdf().set(opt).from(container.firstElementChild).save();
      } finally {
        container.remove();
      }
    } else {
      printFeeStructure(customData, paperSize);
    }
  }

  /**
   * Opens the interactive Fee Structure Modal with modern EduCore design language.
   */
  function openFeeStructurePrintModal(initialOverrides = {}) {
    const existing = document.getElementById("tps-fee-structure-modal");
    if (existing) existing.remove();

    let curData = resolveSchoolBranding(initialOverrides);
    let curPaperSize = "a4";
    let isEditing = false;

    const modal = document.createElement("div");
    modal.id = "tps-fee-structure-modal";
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      font-family: 'Poppins', 'Outfit', system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background:#ffffff; border-radius:20px; width:min(1240px, 98vw); height:min(92vh, 880px); display:flex; flex-direction:column; box-shadow:0 25px 70px -10px rgba(15,23,42,0.35); overflow:hidden; border:1px solid #e2e8f0; animation:modalSlideUp 0.25s ease-out;">
        
        <!-- MODERN EDUCORE TOP TOOLBAR -->
        <div style="background:#ffffff; padding:14px 22px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; border-bottom:1.5px solid #e2e8f0; box-shadow:0 2px 10px rgba(0,0,0,0.03);">
          
          <!-- Title & Icon -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
              <span class="material-symbols-outlined" style="font-size:22px; color:#ffffff;">payments</span>
            </div>
            <div>
              <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:8px;">
                Official Fee Structure
                <span style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; letter-spacing:0.5px;">CBSE / STATE</span>
              </h3>
              <p style="margin:2px 0 0; font-size:0.75rem; color:#64748b; font-weight:500;">High-definition print &amp; PDF document • Matches official school prospectus chart</p>
            </div>
          </div>

          <!-- ACTION CONTROLS MATCHING SITE UI -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            
            <!-- Quick Date Input -->
            <div style="display:inline-flex; align-items:center; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:5px 10px; gap:6px;">
              <span class="material-symbols-outlined" style="font-size:16px; color:#64748b;">calendar_today</span>
              <span style="font-size:11px; color:#64748b; font-weight:700;">Date:</span>
              <input type="text" id="tps-fs-modal-date" value="${curData.date}" style="background:transparent; border:none; color:#0f172a; font-size:12px; font-weight:700; width:100px; outline:none;" title="Click to edit date">
            </div>

            <!-- Paper Format -->
            <div style="display:inline-flex; align-items:center; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:10px; padding:5px 10px; gap:6px;">
              <span class="material-symbols-outlined" style="font-size:16px; color:#64748b;">description</span>
              <span style="font-size:11px; color:#64748b; font-weight:700;">Paper:</span>
              <select id="tps-fs-modal-paper" style="background:transparent; border:none; color:#0f172a; font-size:12px; font-weight:700; outline:none; cursor:pointer;">
                <option value="a4" selected>A4 Landscape</option>
                <option value="a3">A3 Landscape</option>
              </select>
            </div>

            <!-- Sync with DB Records -->
            <button id="tps-fs-modal-sync-db" style="background:#ffffff; border:1.5px solid #cbd5e1; color:#1e3a8a; border-radius:10px; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s ease; box-shadow:0 1px 2px rgba(0,0,0,0.04);" title="Pull live amounts from Fees Structure DB">
              <span class="material-symbols-outlined" style="font-size:16px; color:#2563eb;">sync</span>
              <span>Sync DB</span>
            </button>

            <!-- Reset -->
            <button id="tps-fs-modal-reset" style="background:#ffffff; border:1.5px solid #cbd5e1; color:#64748b; border-radius:10px; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s ease; box-shadow:0 1px 2px rgba(0,0,0,0.04);" title="Reset to official baseline chart">
              <span class="material-symbols-outlined" style="font-size:16px; color:#64748b;">restart_alt</span>
              <span>Reset</span>
            </button>

            <!-- Edit Cells Toggle -->
            <button id="tps-fs-modal-edit-toggle" style="background:#f8fafc; border:1.5px solid #cbd5e1; color:#0f172a; border-radius:10px; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.2s ease;" title="Edit cells directly on sheet">
              <span class="material-symbols-outlined" style="font-size:16px; color:#2563eb;">edit_note</span>
              <span>Edit Cells</span>
            </button>

            <!-- Download PDF -->
            <button id="tps-fs-modal-pdf" style="background:linear-gradient(135deg, #059669 0%, #047857 100%); color:#ffffff; border:none; border-radius:10px; padding:7px 16px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 10px rgba(5,150,105,0.3); transition:all 0.2s ease;" title="Export Landscape PDF">
              <span class="material-symbols-outlined" style="font-size:16px;">download</span>
              <span>Download PDF</span>
            </button>

            <!-- Print Now -->
            <button id="tps-fs-modal-print" style="background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color:#ffffff; border:none; border-radius:10px; padding:7px 18px; font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 10px rgba(37,99,235,0.3); transition:all 0.2s ease;" title="Direct Print">
              <span class="material-symbols-outlined" style="font-size:16px;">print</span>
              <span>Print Now</span>
            </button>

            <!-- Close Modal -->
            <button id="tps-fs-modal-close" style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:50%; width:34px; height:34px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; margin-left:4px; transition:all 0.2s ease;" title="Close">
              <span class="material-symbols-outlined" style="font-size:18px; color:#64748b;">close</span>
            </button>

          </div>
        </div>

        <!-- DOCUMENT PREVIEW CONTAINER (SCROLLABLE & ZOOMABLE) -->
        <div style="flex:1; background:#f1f5f9; padding:24px; overflow:auto; display:flex; align-items:flex-start; justify-content:center;">
          <div id="tps-fs-preview-wrapper" style="box-shadow:0 12px 35px rgba(0,0,0,0.08); border-radius:12px; background:#ffffff; transition:all 0.2s ease;">
            <!-- Document HTML renders here -->
          </div>
        </div>

        <!-- BOTTOM STATUS BAR -->
        <div style="background:#ffffff; border-top:1.5px solid #e2e8f0; padding:10px 24px; font-size:0.78rem; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:16px; color:#2563eb;">info</span>
            <span>Click <strong>"Edit Cells"</strong> to modify amounts, dates or remarks directly on paper before printing.</span>
          </div>
          <div style="font-weight:700; color:#1e3a8a; display:flex; align-items:center; gap:6px;">
            <span class="material-symbols-outlined" style="font-size:15px; color:#059669;">verified</span>
            <span>Standard A4 Landscape (297 &times; 210 mm) &bull; Zero-Distortion Print</span>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const previewWrapper = modal.querySelector("#tps-fs-preview-wrapper");
    const dateInput = modal.querySelector("#tps-fs-modal-date");
    const paperSelect = modal.querySelector("#tps-fs-modal-paper");
    const syncDbBtn = modal.querySelector("#tps-fs-modal-sync-db");
    const resetBtn = modal.querySelector("#tps-fs-modal-reset");
    const editToggleBtn = modal.querySelector("#tps-fs-modal-edit-toggle");
    const pdfBtn = modal.querySelector("#tps-fs-modal-pdf");
    const printBtn = modal.querySelector("#tps-fs-modal-print");
    const closeBtn = modal.querySelector("#tps-fs-modal-close");

    function updatePreview() {
      previewWrapper.innerHTML = renderFeeStructureHtml(curData, { editable: isEditing });
    }

    updatePreview();

    dateInput.addEventListener("input", (e) => {
      curData.date = e.target.value;
      updatePreview();
    });

    paperSelect.addEventListener("change", (e) => {
      curPaperSize = e.target.value;
    });

    syncDbBtn.addEventListener("click", () => {
      curData = syncWithDbFeeStructures(curData);
      updatePreview();
      if (typeof global.showToast === "function") {
        global.showToast("Fee amounts synced with database records", "success");
      }
    });

    resetBtn.addEventListener("click", () => {
      curData = resolveSchoolBranding({});
      dateInput.value = curData.date;
      updatePreview();
      if (typeof global.showToast === "function") {
        global.showToast("Reset to official master fee chart", "info");
      }
    });

    editToggleBtn.addEventListener("click", () => {
      if (isEditing) {
        curData = syncDataFromDOM(previewWrapper, curData);
        isEditing = false;
        editToggleBtn.style.background = "#f8fafc";
        editToggleBtn.style.color = "#0f172a";
        editToggleBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:#2563eb;">edit_note</span><span>Edit Cells</span>`;
      } else {
        isEditing = true;
        editToggleBtn.style.background = "#eff6ff";
        editToggleBtn.style.color = "#1e40af";
        editToggleBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:#16a34a;">check</span><span>Done Editing</span>`;
      }
      updatePreview();
    });

    printBtn.addEventListener("click", () => {
      curData = syncDataFromDOM(previewWrapper, curData);
      printFeeStructure(curData, curPaperSize);
    });

    pdfBtn.addEventListener("click", () => {
      curData = syncDataFromDOM(previewWrapper, curData);
      pdfBtn.disabled = true;
      pdfBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">hourglass_top</span><span>Generating PDF...</span>`;
      downloadFeeStructurePDF(curData, curPaperSize).finally(() => {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">download</span><span>Download PDF</span>`;
      });
    });

    closeBtn.addEventListener("click", () => {
      modal.remove();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Expose global methods
  global.MASTER_FEE_STRUCTURE_TEMPLATE = MASTER_FEE_STRUCTURE_TEMPLATE;
  global.DEFAULT_FEE_DATA = MASTER_FEE_STRUCTURE_TEMPLATE;
  global.renderFeeStructureHtml = renderFeeStructureHtml;
  global.printFeeStructure = printFeeStructure;
  global.downloadFeeStructurePDF = downloadFeeStructurePDF;
  global.openFeeStructurePrintModal = openFeeStructurePrintModal;

})(typeof window !== "undefined" ? window : this);
