/**
 * online_payments_module.js — Online Fee Payment Requests & Admin Approval Engine
 * Tapowan Public School Web Portal
 */

(function () {
  'use strict';

  let currentPayments = [];
  let pendingFilterText = '';
  let pendingClassFilter = 'All';

  /**
   * Main workspace renderer invoked when currentModule === 'onlinePayments'
   */
  window.renderOnlinePaymentsWorkspace = async function () {
    const container = document.getElementById('onlinePaymentsPanel');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 20px 24px; max-width: 1400px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="material-symbols-outlined" style="font-size: 32px; color: #2563eb; background: #eff6ff; padding: 8px; border-radius: 12px;">payments</span>
              <div>
                <h1 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0;">Online Fee Requests</h1>
                <p style="font-size: 0.88rem; color: #64748b; margin: 4px 0 0 0;">Review & approve UPI fee submissions from students (PhonePe, Google Pay, Paytm).</p>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="window.refreshOnlinePaymentsList()" style="background: #ffffff; color: #334155; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s;">
              <span class="material-symbols-outlined" style="font-size: 18px;">refresh</span> Refresh Requests
            </button>
          </div>
        </div>

        <!-- 3 Quick Stats Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background: #ffffff; border: 1.5px solid #fde68a; border-radius: 16px; padding: 18px 20px; box-shadow: 0 4px 12px rgba(217,119,6,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">Pending Verification</span>
              <span class="material-symbols-outlined" style="color: #d97706; font-size: 22px;">hourglass_top</span>
            </div>
            <div id="statPendingCount" style="font-size: 1.85rem; font-weight: 900; color: #92400e;">0 Requests</div>
            <div style="font-size: 0.78rem; color: #b45309; margin-top: 4px;">Awaiting school bank confirmation</div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 16px; padding: 18px 20px; box-shadow: 0 4px 12px rgba(22,163,74,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Pending Total Amount</span>
              <span class="material-symbols-outlined" style="color: #16a34a; font-size: 22px;">currency_rupee</span>
            </div>
            <div id="statPendingAmount" style="font-size: 1.85rem; font-weight: 900; color: #14532d;">₹0</div>
            <div style="font-size: 0.78rem; color: #15803d; margin-top: 4px;">Sum of unapproved transactions</div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 16px; padding: 18px 20px; box-shadow: 0 4px 12px rgba(37,99,235,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">School Receiving VPA</span>
              <span class="material-symbols-outlined" style="color: #2563eb; font-size: 22px;">verified</span>
            </div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #1e3a8a; font-family: monospace;">6201167306@ucobank</div>
            <div style="font-size: 0.78rem; color: #3b82f6; margin-top: 4px;">Tapowan Public School • UCO Bank</div>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 16px 20px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
            <div style="position: relative; flex: 1;">
              <span class="material-symbols-outlined" style="position: absolute; left: 12px; top: 10px; color: #94a3b8; font-size: 20px;">search</span>
              <input type="text" id="opSearchInput" placeholder="Search by student name, admission no, or 12-digit UTR..." 
                oninput="window.handleOnlinePaymentsSearch(this.value)"
                style="width: 100%; padding: 10px 14px 10px 40px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 0.88rem; outline: none; transition: border-color 0.2s;" />
            </div>
            <select id="opClassFilter" onchange="window.handleOnlinePaymentsClassFilter(this.value)"
              style="padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; font-size: 0.88rem; background: #fff; color: #334155; font-weight: 600; cursor: pointer;">
              <option value="All">All Classes</option>
            </select>
          </div>
        </div>

        <!-- Table Container -->
        <div id="opTableContainer" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
          <div style="padding: 40px; text-align: center; color: #64748b;">
            <span class="material-symbols-outlined" style="font-size: 36px; animation: spin 1s infinite linear; color: #3b82f6;">progress_activity</span>
            <div style="margin-top: 10px; font-weight: 600;">Loading pending payments...</div>
          </div>
        </div>
      </div>
    `;

    // Populate class filter dropdown from store
    const store = (typeof window.getStore === 'function') ? window.getStore() : {};
    const classes = Array.from(new Set((store.classes || []).map(c => c.className || c.name).filter(Boolean)));
    const classSelect = document.getElementById('opClassFilter');
    if (classSelect && classes.length) {
      classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `Class ${c}`;
        classSelect.appendChild(opt);
      });
    }

    // Load actual payments
    await window.refreshOnlinePaymentsList();
  };

  /**
   * Fetch and render pending online payments list
   */
  window.refreshOnlinePaymentsList = async function () {
    const tableContainer = document.getElementById('opTableContainer');
    if (!tableContainer) return;

    try {
      const res = await fetch('/api/online-payments/pending');
      const data = await res.json();

      if (!data.ok) {
        tableContainer.innerHTML = `<div style="padding:30px; text-align:center; color:#ef4444; font-weight:600;">Error: ${data.error || 'Failed to load requests'}</div>`;
        return;
      }

      currentPayments = data.payments || [];

      // Update stat cards
      const countEl = document.getElementById('statPendingCount');
      const amtEl = document.getElementById('statPendingAmount');
      if (countEl) countEl.textContent = `${currentPayments.length} Requests`;

      const totalAmt = currentPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      if (amtEl) amtEl.textContent = `₹${totalAmt.toLocaleString('en-IN')}`;

      // Render Table
      window.filterAndRenderOnlinePayments();
    } catch (err) {
      tableContainer.innerHTML = `<div style="padding:30px; text-align:center; color:#ef4444; font-weight:600;">Network Error: ${err.message}</div>`;
    }
  };

  /**
   * Filter and render payments table based on search & class
   */
  window.filterAndRenderOnlinePayments = function () {
    const tableContainer = document.getElementById('opTableContainer');
    if (!tableContainer) return;

    let filtered = currentPayments;

    if (pendingClassFilter && pendingClassFilter !== 'All') {
      filtered = filtered.filter(p => String(p.class_name || '').toLowerCase().includes(pendingClassFilter.toLowerCase()));
    }

    if (pendingFilterText) {
      const term = pendingFilterText.toLowerCase().trim();
      filtered = filtered.filter(p => 
        String(p.student_name || '').toLowerCase().includes(term) ||
        String(p.admission_no || '').toLowerCase().includes(term) ||
        String(p.utr_number || '').toLowerCase().includes(term) ||
        String(p.payId || '').toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      tableContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5; color: #10b981; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <span class="material-symbols-outlined" style="font-size: 32px;">check_circle</span>
          </div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">All Caught Up! Zero Pending Requests</h3>
          <p style="font-size: 0.88rem; color: #64748b; margin: 0; max-width: 420px; margin: 0 auto;">There are no online fee payments waiting for approval right now. New submissions will appear here automatically.</p>
        </div>
      `;
      return;
    }

    let rowsHtml = filtered.map((p, index) => {
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : 'Recent';

      const method = p.payment_method || 'Online UPI';
      let methodIcon = 'account_balance_wallet';
      let methodBadgeColor = '#eff6ff';
      let methodTextColor = '#2563eb';

      if (/phonepe/i.test(method)) {
        methodIcon = 'smartphone';
        methodBadgeColor = '#f3e8ff';
        methodTextColor = '#7e22ce';
      } else if (/gpay|google/i.test(method)) {
        methodIcon = 'payments';
        methodBadgeColor = '#eff6ff';
        methodTextColor = '#1d4ed8';
      } else if (/paytm/i.test(method)) {
        methodIcon = 'account_balance';
        methodBadgeColor = '#e0f2fe';
        methodTextColor = '#0284c7';
      }

      const utr = p.utr_number || 'N/A';
      const cleanAmt = parseFloat(p.amount) || 0;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
          <td style="padding: 14px 16px; font-size: 0.82rem; color: #94a3b8; font-weight: 600;">${index + 1}</td>
          <td style="padding: 14px 16px; font-size: 0.84rem; color: #475569; white-space: nowrap;">
            <div style="font-weight: 700; color: #1e293b;">${dateStr}</div>
            ${p.payId ? `<div style="font-size:0.75rem; color:#64748b; font-family:monospace;">ID: ${p.payId}</div>` : ''}
          </td>
          <td style="padding: 14px 16px;">
            <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">${p.student_name || 'Student'}</div>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
              <span style="font-weight: 700; color: #3b82f6;">Class ${p.class_name || 'N/A'}</span>
              ${p.roll_no ? ` • Roll: <strong>${p.roll_no}</strong>` : ''}
              ${p.admission_no ? ` • Adm: <strong>${p.admission_no}</strong>` : ''}
            </div>
          </td>
          <td style="padding: 14px 16px;">
            <div style="font-size: 1.1rem; font-weight: 900; color: #15803d; background: #ecfdf5; padding: 4px 10px; border-radius: 8px; display: inline-block; border: 1px solid #bbf7d0;">
              ₹${cleanAmt.toLocaleString('en-IN')}
            </div>
          </td>
          <td style="padding: 14px 16px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 0.75rem; font-weight: 800; background: ${methodBadgeColor}; color: ${methodTextColor}; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                ${method}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <code style="font-family: monospace; font-size: 0.85rem; font-weight: 700; color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 6px;">${utr}</code>
              ${utr !== 'N/A' ? `
                <button type="button" title="Copy UTR" onclick="navigator.clipboard.writeText('${utr}'); alert('UTR Copied: ${utr}');" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 2px;">
                  <span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>
                </button>
              ` : ''}
            </div>
          </td>
          <td style="padding: 14px 16px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; color: #92400e; font-size: 0.76rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; border: 1px solid #fde68a;">
              <span class="material-symbols-outlined" style="font-size: 14px;">hourglass_top</span> Pending
            </span>
          </td>
          <td style="padding: 14px 16px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 8px;">
              <button type="button" onclick="window.approveOnlinePayment(${p.id}, '${escapeHtml(p.student_name || 'Student')}', '${cleanAmt}', '${escapeHtml(utr)}')" 
                style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(16,185,129,0.25); transition: transform 0.15s;">
                <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> Approve
              </button>
              <button type="button" onclick="window.rejectOnlinePayment(${p.id}, '${escapeHtml(p.student_name || 'Student')}')" 
                style="background: #ffffff; color: #ef4444; border: 1.5px solid #fecaca; border-radius: 8px; padding: 7px 12px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s;">
                <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span> Reject
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tableContainer.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">#</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Time & ID</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Student Details</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Mode & UTR</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
              <th style="padding: 12px 16px; font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  };

  /**
   * Approve a pending online payment
   */
  window.approveOnlinePayment = async function (paymentId, studentName, amount, utr) {
    const confirmed = confirm(`Are you sure you want to APPROVE the fee payment of ₹${amount} for ${studentName}?\n\nUTR: ${utr}\n\nThis will instantly clear the student's due, generate an official fee receipt, and notify the student.`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/online-payments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      });
      const data = await res.json();

      if (!data.ok) {
        alert(`Approval Failed: ${data.error || 'Server error'}`);
        return;
      }

      alert(`✅ Success: Payment of ₹${amount} approved for ${studentName}!\nDue balance cleared and official receipt generated.`);
      
      // Refresh current list and reload store if available
      window.refreshOnlinePaymentsList();
      if (typeof window.loadAllData === 'function') {
        window.loadAllData().catch(() => {});
      }
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    }
  };

  /**
   * Reject a pending online payment
   */
  window.rejectOnlinePayment = async function (paymentId, studentName) {
    const reason = prompt(`Enter reason for rejecting payment of ${studentName}:`, "Payment not received in school bank account");
    if (reason === null) return; // user cancelled

    try {
      const res = await fetch('/api/online-payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, remarks: reason })
      });
      const data = await res.json();

      if (!data.ok) {
        alert(`Rejection Failed: ${data.error || 'Server error'}`);
        return;
      }

      alert(`Payment marked as Rejected.`);
      window.refreshOnlinePaymentsList();
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    }
  };

  /**
   * Search handler
   */
  window.handleOnlinePaymentsSearch = function (text) {
    pendingFilterText = text || '';
    window.filterAndRenderOnlinePayments();
  };

  /**
   * Class filter handler
   */
  window.handleOnlinePaymentsClassFilter = function (className) {
    pendingClassFilter = className || 'All';
    window.filterAndRenderOnlinePayments();
  };

  function escapeHtml(str) {
    return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

})();
