/**
 * Tapowan Public School (TPS) - Official Fee Structure Print Engine
 * Provides pixel-perfect landscape document rendering, interactive preview modal,
 * browser printing pipeline, and PDF export matching the official school fee chart.
 */
(function (global) {
  "use strict";

  // Authoritative default data matching the official Tapowan Public School Fee Chart
  const DEFAULT_FEE_DATA = {
    schoolName: "TAPOWAN PUBLIC SCHOOL",
    subtitle: "OFFICIAL FEE STRUCTURE",
    date: "16 Dec 2025",
    location: "Tapin, Jharkhand",
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
        mergedHtml: '<span style="font-weight:700; color:#153e75;">JAC: 700</span> &nbsp;|&nbsp; <span style="font-weight:700; color:#153e75;">CBSE: 800</span>'
      },
      {
        id: "exam",
        title: "Examination Fee",
        sub: "(Aug & Dec)",
        type: "merged_end",
        values: ["150/150", "150/150", "150/150", "200/200", "200/200", "200/200", "250/250", "250/250", "250/250", "250/250", "250/250"],
        mergedColspan: 2,
        mergedHtml: '<div style="line-height:1.2; font-weight:700; color:#1e293b; font-size:11px;">As per Board<br>Instruction</div>'
      },
      {
        id: "transport_van",
        title: "Transportation Fee",
        sub: "(Van)",
        type: "merged_distance",
        values: ["-", "-", "-", "-", "-", "-", "-", "-", "-"],
        mergedColspan: 4,
        mergedHtml: '<span style="font-weight:600; color:#1e293b; font-size:12px;">Calculated as per distance</span>'
      }
    ],
    footer: {
      examsBadge: "EXAMS",
      examsText: "Two Periodic Tests & Two Academic Exams per year.",
      noteBadge: "IMPORTANT NOTE",
      noteText: 'Must pay "Yearly Payment" before the month of April.'
    }
  };

  /**
   * Helper to retrieve current school branding from profile or fallback
   */
  function resolveSchoolBranding(overrides = {}) {
    let meta = JSON.parse(JSON.stringify(DEFAULT_FEE_DATA));
    try {
      if (typeof global.getSchoolMeta === "function") {
        const sm = global.getSchoolMeta();
        if (sm.name) meta.schoolName = sm.name.toUpperCase();
        if (sm.address || sm.campus) {
          const parts = (sm.address || sm.campus).split(",");
          meta.location = parts.slice(0, 2).join(",").trim() || sm.address;
        }
      }
    } catch (_) {}

    return {
      schoolName: overrides.schoolName || meta.schoolName,
      subtitle: overrides.subtitle || meta.subtitle,
      date: overrides.date || meta.date,
      location: overrides.location || meta.location,
      classes: overrides.classes || meta.classes,
      rows: overrides.rows || meta.rows,
      footer: overrides.footer || meta.footer
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
   */
  function renderFeeStructureHtml(customData = {}, options = {}) {
    const data = resolveSchoolBranding(customData);
    const isEditable = !!options.editable;

    const editAttr = isEditable ? 'contenteditable="true" spellcheck="false"' : '';

    const theadCols = data.classes.map(c => `
      <th style="padding:10px 4px; text-align:center; color:#ffffff; font-size:12px; font-weight:700; border-right:1px solid rgba(255,255,255,0.22); letter-spacing:0.3px;">
        ${c}
      </th>
    `).join("");

    const tbodyRows = data.rows.map((row, rIdx) => {
      let cellsHtml = "";

      if (row.type === "standard") {
        cellsHtml = row.values.map((val, cIdx) => {
          const isNil = String(val).trim().toLowerCase() === "nil";
          const isDash = String(val).trim() === "-";
          const color = (isNil || isDash) ? "#94a3b8" : "#1e293b";
          const weight = (isNil || isDash) ? "500" : "600";
          return `
            <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:8px 4px; text-align:center; border:1px solid #cbd5e1; font-size:12.5px; font-weight:${weight}; color:${color};" ${editAttr}>
              ${val}
            </td>
          `;
        }).join("");
      } else if (row.type === "merged_end") {
        const stdCells = row.values.map((val, cIdx) => {
          const isNil = String(val).trim().toLowerCase() === "nil";
          const isDash = String(val).trim() === "-";
          const color = (isNil || isDash) ? "#94a3b8" : "#1e293b";
          const weight = (isNil || isDash) ? "500" : "600";
          return `
            <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:8px 4px; text-align:center; border:1px solid #cbd5e1; font-size:12.5px; font-weight:${weight}; color:${color};" ${editAttr}>
              ${val}
            </td>
          `;
        }).join("");

        const mergedCell = `
          <td data-row-idx="${rIdx}" data-merged="end" colspan="${row.mergedColspan}" style="padding:8px 6px; text-align:center; border:1px solid #cbd5e1;" ${editAttr}>
            ${row.mergedHtml}
          </td>
        `;
        cellsHtml = stdCells + mergedCell;
      } else if (row.type === "merged_distance") {
        const stdCells = row.values.map((val, cIdx) => `
          <td data-row-idx="${rIdx}" data-col-idx="${cIdx}" style="padding:8px 4px; text-align:center; border:1px solid #cbd5e1; font-size:14px; font-weight:500; color:#94a3b8;" ${editAttr}>
            ${val}
          </td>
        `).join("");

        const mergedCell = `
          <td data-row-idx="${rIdx}" data-merged="distance" colspan="${row.mergedColspan}" style="padding:8px 8px; text-align:center; border:1px solid #cbd5e1;" ${editAttr}>
            ${row.mergedHtml}
          </td>
        `;
        cellsHtml = stdCells + mergedCell;
      }

      return `
        <tr style="background:#ffffff;">
          <td style="padding:8px 14px; text-align:left; border:1px solid #cbd5e1; vertical-align:middle;">
            <div data-row-title="${rIdx}" style="font-weight:700; color:#0f172a; font-size:12.5px; line-height:1.2;" ${editAttr}>${row.title}</div>
            <div data-row-sub="${rIdx}" style="font-size:10.5px; color:#64748b; font-weight:500; margin-top:2px;" ${editAttr}>${row.sub}</div>
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join("");

    return `
      <div id="tpsFeeStructureDocument" style="width:100%; max-width:1120px; margin:0 auto; background:#ffffff; box-sizing:border-box; font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1e293b; padding:22px 28px;">
        
        <!-- HEADER BLOCK -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <h1 id="tps-fs-doc-schoolname" style="margin:0; font-size:26px; font-weight:800; color:#153e75; letter-spacing:0.5px; line-height:1.15;" ${editAttr}>${data.schoolName}</h1>
            <div id="tps-fs-doc-subtitle" style="margin-top:4px; font-size:13.5px; font-weight:700; color:#df7e20; letter-spacing:2px; text-transform:uppercase;" ${editAttr}>${data.subtitle}</div>
          </div>
          <div style="text-align:right; font-size:13px; line-height:1.5;">
            <div><strong style="color:#0f172a;">Date:</strong> <span id="tps-fs-doc-date" style="color:#334155; font-weight:500;" ${editAttr}>${data.date}</span></div>
            <div><strong style="color:#0f172a;">Location:</strong> <span id="tps-fs-doc-location" style="color:#334155; font-weight:500;" ${editAttr}>${data.location}</span></div>
          </div>
        </div>

        <!-- MAIN FEE STRUCTURE TABLE -->
        <table style="width:100%; border-collapse:collapse; margin-top:8px; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden;">
          <thead>
            <tr style="background:#153e75;">
              <th style="padding:10px 14px; text-align:left; color:#ffffff; font-size:12px; font-weight:700; width:19%; border-right:1px solid rgba(255,255,255,0.22); letter-spacing:0.5px;">
                PARTICULARS
              </th>
              ${theadCols}
            </tr>
          </thead>
          <tbody>
            ${tbodyRows}
          </tbody>
        </table>

        <!-- FOOTER BADGES & NOTES -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding:0 2px; flex-wrap:wrap; gap:10px;">
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <span style="background:#153e75; color:#ffffff; font-weight:800; font-size:11px; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;" ${editAttr}>${data.footer.examsBadge}</span>
            <span style="font-size:12px; font-weight:600; color:#1e293b;" ${editAttr}>${data.footer.examsText}</span>
          </div>
          <div style="display:inline-flex; align-items:center; gap:8px;">
            <span style="background:#153e75; color:#ffffff; font-weight:800; font-size:11px; padding:3px 8px; border-radius:4px; letter-spacing:0.5px;" ${editAttr}>${data.footer.noteBadge}</span>
            <span style="font-size:12px; font-weight:600; color:#1e293b;" ${editAttr}>${data.footer.noteText}</span>
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

      const sub = rootEl.querySelector("#tps-fs-doc-subtitle");
      if (sub) curData.subtitle = sub.innerText.trim();

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
    const title = customData.schoolName || DEFAULT_FEE_DATA.schoolName;

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
                margin: 8mm 10mm;
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
                height: 100% !important;
              }
              #tpsFeeStructureDocument {
                padding: 8px 12px !important;
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
          <style>@page { size: landscape; margin: 10mm; } body { font-family: 'Poppins', sans-serif; }</style>
          </head><body>${html}</body></html>
        `);
        printWin.document.close();
        setTimeout(() => { printWin.print(); printWin.close(); }, 500);
      }
    }
  }

  /**
   * Generates and downloads the official Fee Structure PDF.
   */
  async function downloadFeeStructurePDF(customData = {}, paperSize = "a4") {
    const data = resolveSchoolBranding(customData);
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = paperSize === "a3" ? "1580px" : "1120px";
    container.style.background = "#ffffff";
    container.innerHTML = renderFeeStructureHtml(data, { editable: false });
    document.body.appendChild(container);

    const filename = `${data.schoolName.replace(/[^a-zA-Z0-9]/g, "_")}_Official_Fee_Structure.pdf`;

    try {
      if (typeof global.html2pdf === "function") {
        const opt = {
          margin: [8, 10, 8, 10],
          filename: filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2.5, useCORS: true, letterRendering: true },
          jsPDF: { unit: "mm", format: paperSize === "a3" ? "a3" : "a4", orientation: "landscape" }
        };
        await global.html2pdf().set(opt).from(container.firstElementChild).save();
      } else {
        printFeeStructure(customData, paperSize);
      }
    } catch (err) {
      console.error("[FeeStructurePrint] PDF export error, fallback to print:", err);
      printFeeStructure(customData, paperSize);
    } finally {
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  }

  /**
   * Opens the interactive Fee Structure Print & Preview Modal.
   */
  function openFeeStructurePrintModal(initialOverrides = {}) {
    // Remove existing modal if any
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
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background:#ffffff; border-radius:16px; width:min(1240px, 98vw); height:min(92vh, 880px); display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(0,0,0,0.35); overflow:hidden; border:1px solid #e2e8f0;">
        
        <!-- TOP TOOLBAR -->
        <div style="background:#0f172a; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; color:#ffffff; border-bottom:1px solid #334155;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background:#153e75; width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.25);">
              <span class="material-symbols-outlined" style="font-size:22px; color:#ffffff;">payments</span>
            </div>
            <div>
              <h3 style="margin:0; font-size:1rem; font-weight:700; color:#ffffff; display:flex; align-items:center; gap:8px;">
                Official Fee Structure
                <span style="background:#0f766e; color:#ccfbf1; font-size:10px; font-weight:700; padding:2px 7px; border-radius:12px; letter-spacing:0.5px;">CBSE / STATE</span>
              </h3>
              <p style="margin:2px 0 0; font-size:0.75rem; color:#94a3b8;">High-definition print &amp; PDF document. Exactly matches official school prospectus chart.</p>
            </div>
          </div>

          <!-- ACTION BUTTONS -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            
            <!-- Quick Date Input -->
            <div style="display:inline-flex; align-items:center; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:4px 8px; gap:6px;">
              <span style="font-size:11px; color:#94a3b8; font-weight:600;">Date:</span>
              <input type="text" id="tps-fs-modal-date" value="${curData.date}" style="background:transparent; border:none; color:#ffffff; font-size:11.5px; font-weight:600; width:95px; outline:none;" title="Click to edit date">
            </div>

            <!-- Paper Format -->
            <div style="display:inline-flex; align-items:center; background:#1e293b; border:1px solid #334155; border-radius:8px; padding:4px 8px; gap:6px;">
              <span style="font-size:11px; color:#94a3b8; font-weight:600;">Paper:</span>
              <select id="tps-fs-modal-paper" style="background:transparent; border:none; color:#ffffff; font-size:11.5px; font-weight:600; outline:none; cursor:pointer;">
                <option value="a4" style="background:#1e293b; color:#fff;" selected>A4 Landscape</option>
                <option value="a3" style="background:#1e293b; color:#fff;">A3 Landscape</option>
              </select>
            </div>

            <!-- Sync with DB Fees -->
            <button id="tps-fs-modal-sync-db" style="background:#1e293b; border:1px solid #475569; color:#e2e8f0; border-radius:8px; padding:7px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Sync class fee amounts from current database records">
              <span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">sync</span>
              <span>Sync DB</span>
            </button>

            <!-- Reset to Official Chart -->
            <button id="tps-fs-modal-reset" style="background:#1e293b; border:1px solid #475569; color:#e2e8f0; border-radius:8px; padding:7px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Reset back to official master fee chart">
              <span class="material-symbols-outlined" style="font-size:16px; color:#f59e0b;">restart_alt</span>
              <span>Reset</span>
            </button>

            <!-- Edit Toggle -->
            <button id="tps-fs-modal-edit-toggle" style="background:#334155; color:#ffffff; border:none; border-radius:8px; padding:7px 12px; font-size:0.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Toggle inline editing of cells before printing">
              <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span>
              <span>Edit Cells</span>
            </button>

            <!-- Download PDF Button -->
            <button id="tps-fs-modal-pdf" style="background:#059669; color:#ffffff; border:none; border-radius:8px; padding:7px 14px; font-size:0.82rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(5,150,105,0.3);">
              <span class="material-symbols-outlined" style="font-size:16px;">download</span>
              <span>Download PDF</span>
            </button>

            <!-- Print Button -->
            <button id="tps-fs-modal-print" style="background:#153e75; color:#ffffff; border:1px solid #2563eb; border-radius:8px; padding:7px 16px; font-size:0.82rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(21,62,117,0.35);">
              <span class="material-symbols-outlined" style="font-size:17px;">print</span>
              <span>Print Now</span>
            </button>

            <!-- Close Modal -->
            <button id="tps-fs-modal-close" style="background:transparent; border:none; color:#94a3b8; border-radius:8px; padding:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="Close">
              <span class="material-symbols-outlined" style="font-size:22px; color:#cbd5e1;">close</span>
            </button>

          </div>
        </div>

        <!-- DOCUMENT PREVIEW CONTAINER (SCROLLABLE & ZOOMABLE) -->
        <div style="flex:1; background:#f1f5f9; padding:24px; overflow:auto; display:flex; align-items:flex-start; justify-content:center;">
          <div id="tps-fs-preview-wrapper" style="box-shadow:0 12px 35px rgba(0,0,0,0.12); border-radius:6px; background:#ffffff; transition:all 0.2s ease;">
            <!-- Document HTML renders here -->
          </div>
        </div>

        <!-- BOTTOM STATUS BAR -->
        <div style="background:#ffffff; border-top:1px solid #e2e8f0; padding:8px 20px; font-size:0.75rem; color:#64748b; display:flex; justify-content:space-between; align-items:center;">
          <div><strong style="color:#0f172a;">Tip:</strong> Click <strong>"Edit Cells"</strong> to modify amounts, dates or remarks directly on paper before printing.</div>
          <div style="font-weight:600; color:#153e75;">Standard A4 Landscape (297 × 210 mm) • 100% Zero-Distortion Fit</div>
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
      curData = resolveSchoolBranding(DEFAULT_FEE_DATA);
      dateInput.value = curData.date;
      updatePreview();
      if (typeof global.showToast === "function") {
        global.showToast("Reset to official master fee chart", "info");
      }
    });

    editToggleBtn.addEventListener("click", () => {
      if (isEditing) {
        // Save edits
        curData = syncDataFromDOM(previewWrapper, curData);
        isEditing = false;
        editToggleBtn.style.background = "#334155";
        editToggleBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">edit_note</span><span>Edit Cells</span>`;
      } else {
        isEditing = true;
        editToggleBtn.style.background = "#0f766e";
        editToggleBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">check</span><span>Done Editing</span>`;
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
  global.DEFAULT_FEE_DATA = DEFAULT_FEE_DATA;
  global.renderFeeStructureHtml = renderFeeStructureHtml;
  global.printFeeStructure = printFeeStructure;
  global.downloadFeeStructurePDF = downloadFeeStructurePDF;
  global.openFeeStructurePrintModal = openFeeStructurePrintModal;

})(typeof window !== "undefined" ? window : this);
