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

    marksTableData.forEach((m, idx) => {
        const bg = (idx % 2 === 0) ? '#f8f9fa' : '#ffffff';
        marksRows += `
        <tr style="background: ${bg};">
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; text-align: left;" contenteditable="true">${m.subject}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${m.fullMarks}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${m.passMarks}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${m.obtainedMarks}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center;" contenteditable="true">${m.fullMarks}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px 8px; text-align: center; font-weight: bold;" contenteditable="true">${m.grade}</td>
        </tr>`;
    });

    return `
    <div style="width: 100%; height: 100%; box-sizing: border-box; page-break-inside: avoid; color: inherit; ${fontColorStyle} border: 3px ${c.border} ${c.color}; padding: 15px; font-family: ${c.font}; position: relative; background: transparent;">
        
        <!-- Watermark Background -->
        <div style="position: absolute; inset: 0; background-image: url('${watermarkSvg}'); background-repeat: repeat; opacity: 0.05; pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
            
            <!-- Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid ${c.color}; padding-bottom: 10px; margin-bottom: 15px;">
                <img src="${store.schoolLogo || 'school_logo.png'}" style="width: 80px; height: 80px; object-fit: contain;">
                <div style="flex: 1; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: ${c.color}; text-transform: uppercase;">${schoolName}</h1>
                    <div style="font-weight: bold; font-size: 14px; margin: 4px 0;">U-DISE NO. ${store.schoolDise || '20241202412'}</div>
                    <div style="font-size: 12px; font-style: italic;">${store.schoolAddress || 'Address details here'}</div>
                    <div style="display: flex; justify-content: center; gap: 20px; font-size: 11px; margin-top: 5px;">
                        <span>E-mail: ${store.schoolEmail || 'school@gmail.com'}</span>
                        <span>Contact: ${store.schoolPhone || '9999999999'}</span>
                    </div>
                </div>
                <div style="width: 80px; text-align: right; font-size: 11px;">
                    Date of Issue:<br>
                    <span style="border-bottom: 1px solid #000; display: inline-block; width: 60px; margin-top: 5px;" contenteditable="true"></span>
                </div>
            </div>

            <h2 style="text-align: center; font-size: 16px; text-decoration: underline; margin: 0 0 15px 0;" contenteditable="true">REPORT CARD - ${exam.examName.toUpperCase()} (${exam.session})</h2>

            <!-- Student Info Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; width: 120px; font-weight: bold; background: #e2e8f0;">Name of Student:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.studentName}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Class/Sec:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" contenteditable="true">${exam.className}</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; width: 100px; font-weight: bold; background: #e2e8f0;">Admission No:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" contenteditable="true">${exam.admissionNo}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Roll No:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" contenteditable="true">${exam.rollNo}</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Date of Birth:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" contenteditable="true"></td>
                </tr>
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Father's Name:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.fatherName || ''}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Mother's Name:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" colspan="3" contenteditable="true">${exam.motherName || ''}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px; font-weight: bold; background: #e2e8f0;">Address:</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px 8px;" colspan="3" contenteditable="true"></td>
                </tr>
            </table>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
                <thead>
                    <tr style="background: #000; color: #fff;">
                        <th style="border: 1px solid #000; padding: 6px; text-align: left;">Subject</th>
                        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Full Marks</th>
                        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Pass Marks</th>
                        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Obtained Marks</th>
                        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Total Marks</th>
                        <th style="border: 1px solid #000; padding: 6px; text-align: center;">Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${marksRows}
                </tbody>
            </table>

            <!-- Summary Blocks -->
            <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                <div style="flex: 1; text-align: center; border: 1px solid #94a3b8;">
                    <div style="background: #3b82f6; color: white; padding: 4px; font-size: 11px; font-weight: bold;">Total Obtained Marks</div>
                    <div style="padding: 4px; font-size: 13px; font-weight: bold;" contenteditable="true">${exam.totalMarks || '-'}</div>
                </div>
                <div style="flex: 1; text-align: center; border: 1px solid #94a3b8;">
                    <div style="background: #3b82f6; color: white; padding: 4px; font-size: 11px; font-weight: bold;">Percentage</div>
                    <div style="padding: 4px; font-size: 13px; font-weight: bold;" contenteditable="true">${exam.percentage || '-'}%</div>
                </div>
                <div style="flex: 1; text-align: center; border: 1px solid #94a3b8;">
                    <div style="background: #3b82f6; color: white; padding: 4px; font-size: 11px; font-weight: bold;">Rank</div>
                    <div style="padding: 4px; font-size: 13px; font-weight: bold;" contenteditable="true"></div>
                </div>
                <div style="flex: 1; text-align: center; border: 1px solid #94a3b8;">
                    <div style="background: #000; color: white; padding: 4px; font-size: 11px; font-weight: bold;">Overall Grade</div>
                    <div style="padding: 4px; font-size: 13px; font-weight: bold;" contenteditable="true">${exam.grade || '-'}</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center; font-weight: bold; background: #e2e8f0; width: 120px;">Attendance</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center; background: #e2e8f0;">Total Working Days</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center;" contenteditable="true"></td>
                    <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center; background: #e2e8f0;">Total Present Days</td>
                    <td style="border: 1px solid #94a3b8; padding: 4px; text-align: center;" contenteditable="true"></td>
                </tr>
            </table>

            <!-- Grade Chart -->
            <div style="width: 100%; flex: 1; border: 1px solid #cbd5e1; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.8);">
                <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">Grade Distribution Chart</div>
                <div style="width: 100%; height: 200px; position: relative;">
                    <canvas id="gradeChart_${exam.rollNo}" class="grade-distribution-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>

            <!-- Remarks and Signatures -->
            <div style="margin-top: 15px;">
                <div style="font-size: 12px; margin-bottom: 40px; display: flex; align-items: flex-end;">
                    <span style="font-weight: bold; margin-right: 10px;">Remark:</span>
                    <span style="flex: 1; border-bottom: 1px dotted #000; height: 16px;" contenteditable="true"></span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold;">
                    <div style="text-align: center;">
                        <div style="border-top: 1px solid #000; padding-top: 5px; width: 150px;">Signature of Class Teacher</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="border-top: 1px solid #000; padding-top: 5px; width: 150px;">Signature of HOD</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="border-top: 1px solid #000; padding-top: 5px; width: 150px;">Signature of Principal</div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}
