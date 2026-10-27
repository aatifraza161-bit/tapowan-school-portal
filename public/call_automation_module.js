/**
 * public/call_automation_module.js
 * ── Tapowan Public School Automated WebRTC Fee Reminder & IVR Calling Engine ──
 * 
 * Features:
 * • Real-time WebRTC automated outgoing voice calls directly from Web browser to Student/Parent devices
 * • High-fidelity synthesized neural speech audio streaming over WebRTC (Hindi / English / Hinglish)
 * • Live Interactive Voice Response (IVR) keypress listener ("Press 1 for Payment Link or QR")
 * • Instant WhatsApp dispatch of official school payment links and dynamic UPI QR code
 * • In-call operator live speech mixing (operator can speak directly if needed)
 * • Auto-dialer campaign batch engine for sequential student fee reminders
 * • Detailed audit logging & analytics
 */

(function () {
  'use strict';

  // State
  let targetStudents = [];
  let filteredStudents = [];
  let currentCallStudent = null;
  let activePeerConnection = null;
  let activeAudioContext = null;
  let activeAudioElement = null;
  let activeDataChannel = null;
  let operatorMicStream = null;
  let callTimerInterval = null;
  let callStartTime = null;
  let isOperatorSpeaking = false;
  let isCampaignRunning = false;
  let campaignIndex = 0;
  let campaignQueue = [];
  let selectedLanguage = 'hi'; // 'hi' | 'en' | 'hinglish'
  let filterClass = 'All';
  let filterMinDue = 0;
  let searchFilter = '';

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: [
          'turn:global.relay.metered.ca:80',
          'turn:global.relay.metered.ca:80?transport=tcp',
          'turn:global.relay.metered.ca:443',
          'turn:global.relay.metered.ca:443?transport=tcp',
          'turns:global.relay.metered.ca:443?transport=tcp',
          'turn:172.237.33.131:80',
          'turn:172.237.33.131:80?transport=tcp',
          'turn:172.237.33.131:443',
          'turn:172.237.33.131:443?transport=tcp',
          'turn:45.79.127.179:80',
          'turn:45.79.127.179:80?transport=tcp',
          'turn:45.79.127.179:443',
          'turn:45.79.127.179:443?transport=tcp'
        ],
        username: 'df50426e5dfce9fa2ceb4146',
        credential: 'J8bvaMKOvira9QLL'
      }
    ],
    iceCandidatePoolSize: 6,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all'
  };

  async function fetchWithAuth(url, opts = {}) {
    if (typeof window.api === 'function') {
      return window.api(url, opts);
    }
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { credentials: 'include', ...opts, headers });
    return res.json();
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Main workspace renderer
   */
  window.renderCallAutomationWorkspace = async function () {
    const container = document.getElementById('callAutomationPanel');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 24px; max-width: 1440px; margin: 0 auto; font-family: 'Outfit', sans-serif; color: #1e293b;">
        <!-- Header & Control Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; background: #ffffff; padding: 20px 24px; border-radius: 16px; border: 1.5px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #1e3a8a, #3b82f6); display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 12px rgba(30,58,138,0.25);">
                <span class="material-symbols-outlined" style="font-size: 24px;">ring_volume</span>
              </div>
              <div>
                <h1 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                  Automated WebRTC Fee Reminder & IVR
                  <span style="font-size: 0.72rem; font-weight: 700; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em;">AI Voice Studio</span>
                </h1>
                <p style="font-size: 0.85rem; color: #64748b; margin: 2px 0 0 0;">
                  Automated WebRTC outgoing voice calls with interactive DTMF keypress actions ("Press 1 for Payment Link / QR").
                </p>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <button type="button" onclick="window.testSampleVoiceTts()" class="btn-action" style="background: #f8fafc; color: #334155; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 9px 15px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #0284c7;">volume_up</span> Preview Voice
            </button>
            <button type="button" onclick="window.openIvrLogsModal()" class="btn-action" style="background: #f8fafc; color: #334155; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 9px 15px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #6366f1;">history</span> Call Logs
            </button>
            <button type="button" id="btnCampaignToggle" onclick="window.toggleAutoDialerCampaign()" class="btn-action" style="background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: none; border-radius: 10px; padding: 9px 18px; font-weight: 700; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(16,185,129,0.3);">
              <span class="material-symbols-outlined" style="font-size: 18px;">rocket_launch</span> Start Auto-Dialer
            </button>
            <button type="button" onclick="window.refreshCallAutomationList()" class="btn-action" style="background: #ffffff; color: var(--brand, #1e3a8a); border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">refresh</span>
            </button>
          </div>
        </div>

        <!-- 4 Key Performance Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background: #ffffff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 24px;">pending_actions</span>
            </div>
            <div>
              <div id="statTotalDueStudents" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.1;">0</div>
              <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Pending Due Students</div>
            </div>
          </div>

          <div style="background: #ffffff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 24px;">call</span>
            </div>
            <div>
              <div id="statCallsPlaced" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.1;">0</div>
              <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Total Calls Placed</div>
            </div>
          </div>

          <div style="background: #ffffff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #dcfce7; color: #15803d; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 24px;">touch_app</span>
            </div>
            <div>
              <div id="statPressedOne" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.1;">0</div>
              <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Pressed 1 (Pay Request)</div>
            </div>
          </div>

          <div style="background: #ffffff; border-radius: 14px; padding: 18px 20px; border: 1.5px solid #e2e8f0; display: flex; align-items: center; gap: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center;">
              <span class="material-symbols-outlined" style="font-size: 24px;">qr_code_2</span>
            </div>
            <div>
              <div id="statLinksSent" style="font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.1;">0</div>
              <div style="font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">WhatsApp QRs Sent</div>
            </div>
          </div>
        </div>

        <!-- Real-Time Active Call Console HUD (Visible when call is running) -->
        <div id="ivrActiveCallHud" style="display: none; margin-bottom: 24px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 22px 26px; border-radius: 16px; box-shadow: 0 10px 25px rgba(15,23,42,0.3); border: 1.5px solid #334155;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div id="ivrPulseRing" style="width: 48px; height: 48px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(34,197,94,0.6); animation: ivrPulse 1.5s infinite;">
                <span class="material-symbols-outlined" style="font-size: 26px; color: #ffffff;">call</span>
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="ivrCallStudentName" style="font-size: 1.25rem; font-weight: 800; color: #ffffff;">Student Name</span>
                  <span id="ivrCallClassName" style="font-size: 0.75rem; font-weight: 700; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 6px;">Class</span>
                  <span id="ivrCallAdmNo" style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; font-family: monospace;">#000</span>
                </div>
                <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 4px; display: flex; align-items: center; gap: 12px;">
                  <span id="ivrCallStatusText" style="color: #4ade80; font-weight: 700;">Dialing WebRTC Peer...</span>
                  <span>•</span>
                  <span>Due: <b id="ivrCallDueAmt" style="color: #fcd34d;">₹0</b></span>
                  <span>•</span>
                  <span>Phone: <b id="ivrCallPhone" style="color: #93c5fd;">-</b></span>
                  <span>•</span>
                  <span id="ivrCallTimer" style="font-family: monospace; font-weight: 700; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">00:00</span>
                </div>
              </div>
            </div>

            <!-- In-Call Actions -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" id="btnOperatorMic" onclick="window.toggleOperatorMic()" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">mic</span>
                <span id="btnOperatorMicText">Talk to Parent</span>
              </button>
              <button type="button" onclick="window.manuallyTriggerKeyOne()" style="background: #0284c7; color: #ffffff; border: none; border-radius: 10px; padding: 9px 14px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">send</span>
                <span>Send QR & Link Now</span>
              </button>
              <button type="button" onclick="window.terminateActiveIvrCall()" style="background: #dc2626; color: #ffffff; border: none; border-radius: 10px; padding: 9px 16px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(220,38,38,0.4);">
                <span class="material-symbols-outlined" style="font-size: 18px;">call_end</span>
                <span>End Call</span>
              </button>
            </div>
          </div>

          <!-- Interactive Keypress Banner -->
          <div id="ivrKeypressAlert" style="display: none; margin-top: 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 10px 14px; border-radius: 8px; font-size: 0.88rem; color: #6ee7b7; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="font-size: 20px; color: #34d399;">check_circle</span>
            <span id="ivrKeypressAlertMsg">Key '1' Pressed! Payment Link and QR Code sent to WhatsApp!</span>
          </div>
        </div>

        <!-- Filter & Voice Configuration Bar -->
        <div style="background: #ffffff; padding: 16px 20px; border-radius: 14px; border: 1.5px solid #e2e8f0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1;">
            <div style="position: relative; min-width: 240px; flex: 1;">
              <span class="material-symbols-outlined" style="position: absolute; left: 10px; top: 10px; color: #94a3b8; font-size: 18px;">search</span>
              <input type="search" id="ivrSearchInput" placeholder="Search student name, adm no, or phone..." oninput="window.handleIvrSearch(this.value)" style="width: 100%; padding: 8px 12px 8px 34px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; outline: none; font-family: 'Outfit', sans-serif;">
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <label style="font-size: 0.78rem; font-weight: 700; color: #64748b;">Class:</label>
              <select id="ivrClassFilter" onchange="window.handleIvrClassFilter(this.value)" style="padding: 7px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-family: 'Outfit', sans-serif; outline: none;">
                <option value="All">All Classes</option>
                <option value="Nursery-A">Nursery-A</option>
                <option value="LKG-A">LKG-A</option>
                <option value="UKG-A">UKG-A</option>
                <option value="I-A">Class I-A</option>
                <option value="II-A">Class II-A</option>
                <option value="III-A">Class III-A</option>
                <option value="IV-A">Class IV-A</option>
                <option value="V-A">Class V-A</option>
                <option value="VI-A">Class VI-A</option>
                <option value="VII-A">Class VII-A</option>
                <option value="VIII-A">Class VIII-A</option>
                <option value="IX-A">Class IX-A</option>
                <option value="X-A">Class X-A</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <label style="font-size: 0.78rem; font-weight: 700; color: #64748b;">Min Due:</label>
              <select id="ivrMinDueFilter" onchange="window.handleIvrMinDueFilter(this.value)" style="padding: 7px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-family: 'Outfit', sans-serif; outline: none;">
                <option value="0">Any Balance (> ₹0)</option>
                <option value="500">₹500+</option>
                <option value="1000">₹1,000+</option>
                <option value="2000">₹2,000+</option>
                <option value="5000">₹5,000+</option>
              </select>
            </div>
          </div>

          <!-- Voice Script Language Switcher -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 0.78rem; font-weight: 700; color: #475569;">Voice Language:</label>
            <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <button type="button" class="btn-ivr-lang active" id="btnLangHi" onclick="window.setIvrLanguage('hi')" style="padding: 5px 12px; border-radius: 6px; border: none; font-size: 0.78rem; font-weight: 700; cursor: pointer; background: #1e3a8a; color: #ffffff;">Hindi (हिंदी)</button>
              <button type="button" class="btn-ivr-lang" id="btnLangEn" onclick="window.setIvrLanguage('en')" style="padding: 5px 12px; border-radius: 6px; border: none; font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: #64748b;">English</button>
              <button type="button" class="btn-ivr-lang" id="btnLangHinglish" onclick="window.setIvrLanguage('hinglish')" style="padding: 5px 12px; border-radius: 6px; border: none; font-size: 0.78rem; font-weight: 700; cursor: pointer; background: transparent; color: #64748b;">Hinglish</button>
            </div>
          </div>
        </div>

        <!-- Target Students Table Wrap -->
        <div class="table-wrap" style="background: #ffffff; border-radius: 14px; border: 1.5px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <table style="width: 100%; border-collapse: collapse; min-width: 900px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; text-align: left;">
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase;">Student & Adm No</th>
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase;">Class</th>
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase;">Phone & App Status</th>
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase;">Total Due Balance</th>
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase;">Due Summary</th>
                <th style="padding: 12px 16px; font-size: 0.76rem; font-weight: 800; color: #475569; text-transform: uppercase; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="ivrStudentsTableBody">
              <tr>
                <td colspan="6" style="padding: 40px; text-align: center; color: #64748b;">
                  <span class="material-symbols-outlined" style="font-size: 32px; animation: spin 1s infinite; color: #3b82f6;">sync</span>
                  <div style="margin-top: 8px; font-weight: 600;">Loading pending fee records...</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Inject pulse animation CSS if not present
    if (!document.getElementById('ivrPulseStyle')) {
      const style = document.createElement('style');
      style.id = 'ivrPulseStyle';
      style.innerHTML = `
        @keyframes ivrPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Initial data fetch
    await window.refreshCallAutomationList();
    await window.refreshIvrStats();
  };

  /**
   * Fetch target students and render table
   */
  window.refreshCallAutomationList = async function () {
    try {
      const data = await fetchWithAuth(`/api/calls/ivr/target-students?className=${encodeURIComponent(filterClass)}&minDue=${filterMinDue}`);
      if (data && data.ok) {
        targetStudents = data.students || [];
        window.filterAndRenderIvrTable();
      }
    } catch (err) {
      console.error('Failed to load target students:', err);
    }
  };

  /**
   * Refresh campaign statistics
   */
  window.refreshIvrStats = async function () {
    try {
      const data = await fetchWithAuth('/api/calls/ivr/stats');
      if (data && data.ok && data.stats) {
        const s = data.stats;
        const elCalls = document.getElementById('statCallsPlaced');
        const elPressed = document.getElementById('statPressedOne');
        const elLinks = document.getElementById('statLinksSent');
        if (elCalls) elCalls.textContent = s.totalCalls || 0;
        if (elPressed) elPressed.textContent = s.pressedOne || 0;
        if (elLinks) elLinks.textContent = s.linksSent || 0;
      }
    } catch (e) {}
  };

  /**
   * Filter and render table rows
   */
  window.filterAndRenderIvrTable = function () {
    const tbody = document.getElementById('ivrStudentsTableBody');
    if (!tbody) return;

    let filtered = targetStudents;
    if (searchFilter && searchFilter.trim()) {
      const term = searchFilter.trim().toLowerCase();
      filtered = filtered.filter(st =>
        String(st.studentName || '').toLowerCase().includes(term) ||
        String(st.admissionNo || '').toLowerCase().includes(term) ||
        String(st.phone || '').includes(term)
      );
    }

    filteredStudents = filtered;

    const countEl = document.getElementById('statTotalDueStudents');
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center; color: #64748b;">
            <span class="material-symbols-outlined" style="font-size: 36px; color: #cbd5e1;">task_alt</span>
            <div style="margin-top: 8px; font-weight: 600; font-size: 0.95rem;">No pending fee records match the selected filter.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(st => {
      const appBadge = st.hasAppInstalled
        ? `<span style="font-size: 0.72rem; font-weight: 700; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 3px;">
            <span class="material-symbols-outlined" style="font-size: 13px;">smartphone</span> TPS App Active
           </span>`
        : `<span style="font-size: 0.72rem; font-weight: 600; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 6px;">
            SMS / WA Only
           </span>`;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;">
          <td style="padding: 12px 16px;">
            <div style="font-weight: 800; color: #0f172a; font-size: 0.92rem;">${escapeHtml(st.studentName)}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">Adm: #${escapeHtml(st.admissionNo)} ${st.rollNo ? `• Roll: ${escapeHtml(st.rollNo)}` : ''}</div>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 0.78rem; font-weight: 700; background: #f8fafc; color: #334155; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${escapeHtml(st.className)}
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 700; font-size: 0.86rem; color: #1e293b;">${escapeHtml(st.phone || 'No Phone')}</div>
            <div style="margin-top: 3px;">${appBadge}</div>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 0.92rem; font-weight: 800; color: #dc2626; background: #fef2f2; padding: 4px 10px; border-radius: 8px; border: 1px solid #fecaca; display: inline-block;">
              ₹${Number(st.totalDue || 0).toLocaleString('en-IN')}
            </span>
          </td>
          <td style="padding: 12px 16px; max-width: 280px;">
            <div style="font-size: 0.76rem; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(st.particularsSummary)}">
              ${escapeHtml(st.particularsSummary || 'Pending fee balance')}
            </div>
          </td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; gap: 8px; align-items: center;">
              <button type="button" onclick="window.dialSingleStudentIvr('${escapeHtml(st.admissionNo)}')" class="btn-action" style="background: var(--brand, #1e3a8a); color: #ffffff; border: none; border-radius: 8px; padding: 7px 14px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(30,58,138,0.2);">
                <span class="material-symbols-outlined" style="font-size: 16px;">call</span>
                <span>Dial WebRTC Call</span>
              </button>
              <button type="button" onclick="window.sendDirectWhatsAppPayment('${escapeHtml(st.admissionNo)}')" title="Send WhatsApp Link & QR directly" class="btn-action" style="background: #25d366; color: #ffffff; border: none; border-radius: 8px; padding: 7px 10px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center;">
                <span class="material-symbols-outlined" style="font-size: 16px;">chat</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  };

  /**
   * Filter Handlers
   */
  window.handleIvrSearch = function (val) {
    searchFilter = val || '';
    window.filterAndRenderIvrTable();
  };

  window.handleIvrClassFilter = function (cls) {
    filterClass = cls || 'All';
    window.refreshCallAutomationList();
  };

  window.handleIvrMinDueFilter = function (min) {
    filterMinDue = Number(min || 0);
    window.refreshCallAutomationList();
  };

  window.setIvrLanguage = function (lang) {
    selectedLanguage = lang;
    ['btnLangHi', 'btnLangEn', 'btnLangHinglish'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
      }
    });

    const activeId = lang === 'en' ? 'btnLangEn' : (lang === 'hinglish' ? 'btnLangHinglish' : 'btnLangHi');
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) {
      activeBtn.style.background = '#1e3a8a';
      activeBtn.style.color = '#ffffff';
    }

    if (window.showToast) window.showToast(`Voice Language set to ${lang.toUpperCase()}`, 'info');
  };

  /**
   * Preview Sample TTS Audio in Browser
   */
  window.testSampleVoiceTts = function () {
    const sampleText = selectedLanguage === 'en'
      ? "Hello! This is an automated fee reminder from Tapowan Public School. Your pending fee is 1500 Rupees. Press 1 now for your payment link and Q-R code."
      : (selectedLanguage === 'hinglish'
        ? "Namaste! Yeh Tapowan Public School se automated fee reminder call hai. Aapki pending school fee 1500 rupaye hai. Instant payment link aur Q-R code paane ke liye 1 dabayein."
        : "नमस्ते! यह तपोवन पब्लिक स्कूल से एक ऑटोमेटेड फीस सूचना है। आपकी कुल बकाया फीस 1500 रुपये है। पेमेंट लिंक और क्यू-आर कोड के लिए अभी 1 दबाएं।");

    const ttsUrl = `/api/calls/ivr/tts-audio?text=${encodeURIComponent(sampleText)}&lang=${selectedLanguage}`;
    const audio = new Audio(ttsUrl);
    audio.play()
      .then(() => {
        if (window.showToast) window.showToast("Playing synthesized voice sample...", "success");
      })
      .catch(err => {
        if (window.showToast) window.showToast("Audio playback note: " + err.message, "warning");
      });
  };

  /**
   * 📞 Dial Single Student via WebRTC Automated Call
   */
  window.dialSingleStudentIvr = async function (admissionNo) {
    const student = targetStudents.find(st => st.admissionNo === admissionNo);
    if (!student) return;

    if (activePeerConnection) {
      if (window.showToast) window.showToast("A call is already active. End it first before dialing.", "warning");
      return;
    }

    currentCallStudent = student;
    showIvrCallHud(student);

    try {
      updateHudStatus("Synthesizing Voice & Initializing WebRTC...", "#38bdf8");

      // 1. Create Web Audio Context & Destination Stream for streaming synthesized voice
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      activeAudioContext = new AudioCtx();
      const audioDestination = activeAudioContext.createMediaStreamDestination();

      // 2. Prepare WebRTC Peer Connection
      const pc = new RTCPeerConnection(ICE_CONFIG);
      activePeerConnection = pc;

      // Add audio destination track to peer connection
      const streamTrack = audioDestination.stream.getAudioTracks()[0];
      if (streamTrack) {
        pc.addTrack(streamTrack, audioDestination.stream);
      }

      // 3. Create WebRTC DataChannel for interactive IVR keypress listening
      try {
        const dc = pc.createDataChannel('ivr-channel');
        activeDataChannel = dc;
        dc.onopen = () => console.log('[IVR DataChannel] Channel Open');
        dc.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'KEYPRESS' || data.key) {
              handleInCallKeypress(data.key, student);
            }
          } catch (e) {}
        };
      } catch (dcErr) {
        console.warn('DataChannel creation note:', dcErr.message);
      }

      // ICE Candidate Gathering
      pc.onicecandidate = (event) => {
        if (event.candidate && currentCallStudent?.callId) {
          fetchWithAuth('/api/calls/signal', {
            method: 'POST',
            body: JSON.stringify({
              callId: currentCallStudent.callId,
              isCaller: true,
              iceCandidate: event.candidate
            })
          }).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[IVR WebRTC] Connection State:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          updateHudStatus("Connected • Streaming Voice Reminder", "#4ade80");
          startCallTimer();
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          updateHudStatus("Call Disconnected", "#f87171");
          cleanupCall();
        }
      };

      // 4. Create WebRTC Offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      updateHudStatus("Signaling Push & Ringing Parent Mobile...", "#fbbf24");

      // 5. Initiate Call via Backend API
      const initRes = await fetchWithAuth('/api/calls/ivr/initiate', {
        method: 'POST',
        body: JSON.stringify({
          admissionNo: student.admissionNo,
          studentName: student.studentName,
          className: student.className,
          dueAmount: student.totalDue,
          phone: student.phone,
          lang: selectedLanguage,
          offerSdp: offer.sdp
        })
      });

      if (!initRes || !initRes.ok) {
        updateHudStatus(initRes?.error || "Recipient offline or unable to connect", "#f87171");
        setTimeout(cleanupCall, 4000);
        return;
      }

      currentCallStudent.callId = initRes.callId;
      currentCallStudent.speechText = initRes.speechText;
      currentCallStudent.ackText = initRes.ackText;

      // 6. Preload synthesized TTS speech into audio context
      const ttsUrl = `/api/calls/ivr/tts-audio?text=${encodeURIComponent(initRes.speechText)}&lang=${selectedLanguage}`;
      const audioEl = new Audio(ttsUrl);
      audioEl.crossOrigin = 'anonymous';
      activeAudioElement = audioEl;

      const mediaSource = activeAudioContext.createMediaElementSource(audioEl);
      mediaSource.connect(audioDestination);
      mediaSource.connect(activeAudioContext.destination); // Operator can monitor call audio locally

      // When audio finishes playing: line remains active until the recipient cuts the call
      audioEl.onended = () => {
        updateHudStatus("Reminder Completed • Line Active (Press 1 or Hang Up)", "#38bdf8");
      };

      // 7. Start polling for remote answer
      pollForAnswerAndIce(initRes.callId, pc, audioEl);

    } catch (err) {
      console.error('Dial error:', err);
      updateHudStatus("Error: " + err.message, "#f87171");
      setTimeout(cleanupCall, 3500);
    }
  };

  /**
   * Poll for WebRTC Answer and ICE Candidates
   */
  function pollForAnswerAndIce(callId, pc, audioEl) {
    let pollCount = 0;
    const maxPolls = 60; // 30s timeout

    const timer = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls || !activePeerConnection) {
        clearInterval(timer);
        if (pollCount > maxPolls && pc.connectionState !== 'connected') {
          updateHudStatus("No Answer / Call Timed Out (30s)", "#f87171");
          setTimeout(cleanupCall, 3000);
        }
        return;
      }

      try {
        const pollRes = await fetchWithAuth(`/api/calls/poll?callId=${encodeURIComponent(callId)}`);
        if (!pollRes || !pollRes.ok) return;

        const call = pollRes.call;
        if (!call) return;

        // If recipient answered and returned SDP answer
        if (call.status === 'connected' && call.answer_sdp && !pc.currentRemoteDescription) {
          updateHudStatus("Recipient Answered • Connecting WebRTC...", "#4ade80");
          const answerDesc = new RTCSessionDescription({ type: 'answer', sdp: call.answer_sdp });
          await pc.setRemoteDescription(answerDesc);

          // Start playing the automated speech into the audio stream
          if (activeAudioContext?.state === 'suspended') {
            await activeAudioContext.resume();
          }
          audioEl.play().catch(e => console.warn('Audio auto-play note:', e));
        }

        // Ingest receiver ICE candidates
        if (call.receiver_ice) {
          const cands = typeof call.receiver_ice === 'string' ? JSON.parse(call.receiver_ice) : call.receiver_ice;
          if (Array.isArray(cands)) {
            for (const c of cands) {
              if (c && c.candidate) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(c));
                } catch (_) {}
              }
            }
          }
        }

        // If call ended by remote peer
        if (call.status === 'ended' || call.status === 'declined') {
          clearInterval(timer);
          updateHudStatus(call.status === 'declined' ? "Call Declined by Recipient" : "Call Ended by Recipient", "#f87171");
          setTimeout(cleanupCall, 2000);
        }
      } catch (e) {}
    }, 500);
  }

  /**
   * Handle Keypress '1' (Payment Link & QR Code Trigger)
   */
  async function handleInCallKeypress(key, student) {
    if (String(key).trim() === '1') {
      if (student) student.keyOneReceived = true;

      // Show alert banner on HUD
      const alertEl = document.getElementById('ivrKeypressAlert');
      const alertMsg = document.getElementById('ivrKeypressAlertMsg');
      if (alertEl && alertMsg) {
        alertMsg.textContent = `⚡ Key '1' Pressed! Generating UPI Payment Link & QR Code...`;
        alertEl.style.display = 'flex';
      }

      // Play acknowledgment voice prompt over the call
      if (student?.ackText && activeAudioContext) {
        try {
          const ackUrl = `/api/calls/ivr/tts-audio?text=${encodeURIComponent(student.ackText)}&lang=${selectedLanguage}`;
          const ackAudio = new Audio(ackUrl);
          ackAudio.crossOrigin = 'anonymous';
          const ackSrc = activeAudioContext.createMediaElementSource(ackAudio);
          const dest = activeAudioContext.createMediaStreamDestination();
          ackSrc.connect(dest);
          ackSrc.connect(activeAudioContext.destination);
          ackAudio.play().catch(() => {});
        } catch (e) {}
      }

      // Call server endpoint to dispatch WhatsApp message and QR
      try {
        const res = await fetchWithAuth('/api/calls/ivr/keypress', {
          method: 'POST',
          body: JSON.stringify({
            callId: student?.callId,
            key: '1',
            admissionNo: student?.admissionNo,
            studentName: student?.studentName,
            className: student?.className,
            dueAmount: student?.totalDue,
            phone: student?.phone
          })
        });

        if (res && res.ok) {
          if (alertMsg) {
            alertMsg.textContent = `✅ Payment Link and Official UPI QR dispatched to WhatsApp (${student?.phone || 'Parent'})!`;
          }
          if (window.showToast) window.showToast(`Official Payment Link & QR Code sent to ${student?.studentName}!`, 'success');
          window.refreshIvrStats();
        }
      } catch (err) {
        console.warn('Keypress dispatch error:', err);
      }

      // Line remains active until the recipient cuts the call or operator ends call
      updateHudStatus("✅ Key 1 Confirmed • Payment Sent • Line Active", "#10b981");
    }
  }

  window.manuallyTriggerKeyOne = function () {
    if (currentCallStudent) {
      handleInCallKeypress('1', currentCallStudent);
    }
  };

  /**
   * Toggle Operator Microphone (Talk to Parent)
   */
  window.toggleOperatorMic = async function () {
    const btnText = document.getElementById('btnOperatorMicText');
    const btn = document.getElementById('btnOperatorMic');

    if (!isOperatorSpeaking) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        operatorMicStream = stream;
        if (activeAudioContext) {
          const micSource = activeAudioContext.createMediaStreamSource(stream);
          micSource.connect(activeAudioContext.destination);
        }
        isOperatorSpeaking = true;
        if (btnText) btnText.textContent = "Mute My Mic";
        if (btn) btn.style.background = "#059669";
        if (window.showToast) window.showToast("Your microphone is now live in the call!", "success");
      } catch (e) {
        if (window.showToast) window.showToast("Microphone error: " + e.message, "warning");
      }
    } else {
      if (operatorMicStream) {
        operatorMicStream.getTracks().forEach(t => t.stop());
        operatorMicStream = null;
      }
      isOperatorSpeaking = false;
      if (btnText) btnText.textContent = "Talk to Parent";
      if (btn) btn.style.background = "rgba(255,255,255,0.1)";
      if (window.showToast) window.showToast("Your microphone is muted.", "info");
    }
  };

  /**
   * Send WhatsApp Payment Link & QR Directly (Without Calling)
   */
  window.sendDirectWhatsAppPayment = async function (admissionNo) {
    const student = targetStudents.find(st => st.admissionNo === admissionNo);
    if (!student) return;

    if (!student.phone) {
      if (window.showToast) window.showToast("No phone number registered for this student.", "warning");
      return;
    }

    try {
      const res = await fetchWithAuth('/api/calls/ivr/keypress', {
        method: 'POST',
        body: JSON.stringify({
          key: '1',
          admissionNo: student.admissionNo,
          studentName: student.studentName,
          className: student.className,
          dueAmount: student.totalDue,
          phone: student.phone
        })
      });

      if (res && res.ok) {
        if (window.showToast) window.showToast(`Official Payment Link & QR Code sent to WhatsApp (${student.phone})!`, 'success');
        window.refreshIvrStats();
      } else {
        if (window.showToast) window.showToast("Failed to send WhatsApp message: " + (res?.error || 'Unknown error'), "error");
      }
    } catch (err) {
      if (window.showToast) window.showToast("Error sending message: " + err.message, "error");
    }
  };

  /**
   * Auto-Dialer Campaign Engine
   */
  window.toggleAutoDialerCampaign = function () {
    const btn = document.getElementById('btnCampaignToggle');
    if (!isCampaignRunning) {
      if (filteredStudents.length === 0) {
        if (window.showToast) window.showToast("No students in current filter queue.", "warning");
        return;
      }
      isCampaignRunning = true;
      campaignIndex = 0;
      campaignQueue = [...filteredStudents];

      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">pause</span> Pause Auto-Dialer (${campaignQueue.length})`;
        btn.style.background = "#dc2626";
      }

      if (window.showToast) window.showToast(`Auto-dialer campaign started for ${campaignQueue.length} students!`, "success");
      dialNextCampaignStudent();
    } else {
      isCampaignRunning = false;
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">rocket_launch</span> Resume Auto-Dialer`;
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      }
      if (window.showToast) window.showToast("Auto-dialer campaign paused.", "info");
    }
  };

  function dialNextCampaignStudent() {
    if (!isCampaignRunning) return;
    if (campaignIndex >= campaignQueue.length) {
      isCampaignRunning = false;
      const btn = document.getElementById('btnCampaignToggle');
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">rocket_launch</span> Start Auto-Dialer`;
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      }
      if (window.showToast) window.showToast("Auto-dialer campaign completed for all students in queue!", "success");
      return;
    }

    const nextStudent = campaignQueue[campaignIndex];
    campaignIndex++;
    window.dialSingleStudentIvr(nextStudent.admissionNo);
  }

  /**
   * HUD UI Helpers
   */
  function showIvrCallHud(student) {
    const hud = document.getElementById('ivrActiveCallHud');
    if (!hud) return;
    hud.style.display = 'block';

    const sName = document.getElementById('ivrCallStudentName');
    const cName = document.getElementById('ivrCallClassName');
    const admNo = document.getElementById('ivrCallAdmNo');
    const dueAmt = document.getElementById('ivrCallDueAmt');
    const phone = document.getElementById('ivrCallPhone');
    const alertEl = document.getElementById('ivrKeypressAlert');

    if (sName) sName.textContent = student.studentName || 'Student';
    if (cName) cName.textContent = student.className || 'Class';
    if (admNo) admNo.textContent = '#' + (student.admissionNo || '');
    if (dueAmt) dueAmt.textContent = '₹' + Number(student.totalDue || 0).toLocaleString('en-IN');
    if (phone) phone.textContent = student.phone || 'No Phone';
    if (alertEl) alertEl.style.display = 'none';

    window.scrollTo({ top: hud.offsetTop - 80, behavior: 'smooth' });
  }

  function updateHudStatus(text, color = '#ffffff') {
    const stEl = document.getElementById('ivrCallStatusText');
    if (stEl) {
      stEl.textContent = text;
      stEl.style.color = color;
    }
  }

  function startCallTimer() {
    callStartTime = Date.now();
    const timerEl = document.getElementById('ivrCallTimer');
    if (callTimerInterval) clearInterval(callTimerInterval);

    callTimerInterval = setInterval(() => {
      if (!callStartTime || !timerEl) return;
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  window.terminateActiveIvrCall = function () {
    if (currentCallStudent?.callId) {
      fetchWithAuth('/api/calls/end', {
        method: 'POST',
        body: JSON.stringify({
          callId: currentCallStudent.callId,
          userId: 'tps_fee_automation'
        })
      }).catch(() => {});
    }
    cleanupCall();
  };

  function cleanupCall() {
    // Notify server that call is ended so recipient phone terminates cleanly and DB is updated
    if (currentCallStudent?.callId) {
      const callIdToClose = currentCallStudent.callId;
      fetchWithAuth('/api/calls/end', {
        method: 'POST',
        body: JSON.stringify({
          callId: callIdToClose,
          userId: 'tps_fee_automation'
        })
      }).catch(() => {});
    }

    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }

    if (activeAudioElement) {
      try { activeAudioElement.pause(); activeAudioElement.src = ''; } catch (_) {}
      activeAudioElement = null;
    }

    if (operatorMicStream) {
      try { operatorMicStream.getTracks().forEach(t => t.stop()); } catch (_) {}
      operatorMicStream = null;
    }

    if (activePeerConnection) {
      try { activePeerConnection.close(); } catch (_) {}
      activePeerConnection = null;
    }

    if (activeAudioContext) {
      try { activeAudioContext.close(); } catch (_) {}
      activeAudioContext = null;
    }

    activeDataChannel = null;
    currentCallStudent = null;
    isOperatorSpeaking = false;

    const hud = document.getElementById('ivrActiveCallHud');
    if (hud) hud.style.display = 'none';

    // If campaign is active, wait 3 seconds and trigger next call
    if (isCampaignRunning) {
      setTimeout(() => {
        dialNextCampaignStudent();
      }, 3000);
    }
  }

  window.purgeIvrLogsNow = async function () {
    if (!confirm("Are you sure you want to clear call history? All call logs older than 24 hours are removed automatically.")) return;
    try {
      const res = await fetchWithAuth("/api/calls/ivr/purge", { method: "POST" });
      if (res && res.ok) {
        if (window.showToast) window.showToast("Call history cleared successfully", "success");
        window.openIvrLogsModal();
      } else {
        if (window.showToast) window.showToast(res?.error || "Failed to clear logs", "error");
      }
    } catch (err) {
      if (window.showToast) window.showToast("Error: " + err.message, "error");
    }
  };

  /**
   * Modal: Call Audit Logs
   */
  window.openIvrLogsModal = async function () {
    try {
      const data = await fetchWithAuth('/api/calls/ivr/logs?limit=50');
      const allLogs = (data && data.ok) ? data.logs || [] : [];
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const logs = allLogs.filter(l => {
        if (!l.created_at) return false;
        const ts = new Date(String(l.created_at).replace(' ', 'T') + 'Z').getTime();
        return isNaN(ts) || ts >= oneDayAgo;
      });

      let rowsHtml = logs.map(l => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.82rem;">
          <td style="padding: 10px 14px; font-family: monospace;">${escapeHtml(l.created_at)}</td>
          <td style="padding: 10px 14px; font-weight: 700;">${escapeHtml(l.student_name)} <span style="font-size: 0.72rem; color: #64748b;">(#${escapeHtml(l.admission_no)})</span></td>
          <td style="padding: 10px 14px;">${escapeHtml(l.class_name)}</td>
          <td style="padding: 10px 14px; font-weight: 700;">₹${Number(l.due_amount || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 10px 14px;">
            ${l.key_pressed === '1' 
              ? `<span style="font-weight: 800; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px;">[ 1 ] Pay Link</span>`
              : (l.key_pressed === '2' 
                ? `<span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px;">[ 2 ] Counter</span>` 
                : `<span style="color: #94a3b8;">None</span>`)}
          </td>
          <td style="padding: 10px 14px;">
            ${l.payment_link_sent ? `<span style="color: #16a34a; font-weight: 700;">✔ Sent</span>` : `<span style="color: #94a3b8;">-</span>`}
          </td>
          <td style="padding: 10px 14px; text-transform: capitalize;">${escapeHtml(l.status)}</td>
        </tr>
      `).join('');

      if (logs.length === 0) {
        rowsHtml = `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #94a3b8;">No IVR calls in the past 24 hours. Older logs have been automatically cleaned up.</td></tr>`;
      }

      const modalHtml = `
        <div id="ivrLogsModalBackdrop" style="position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(6px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
            <div style="padding: 18px 24px; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 1.12rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="color: #4f46e5;">history</span> Automated IVR Call History & WhatsApp Logs
                </h2>
                <span style="font-size: 0.72rem; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; padding: 3px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  <span class="material-symbols-outlined" style="font-size: 14px;">auto_delete</span> Auto-Removed After 24 Hrs
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" onclick="window.purgeIvrLogsNow()" title="Clear Call History" style="border: 1.5px solid #fca5a5; background: #fef2f2; color: #dc2626; border-radius: 8px; padding: 6px 12px; font-weight: 700; font-size: 0.78rem; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <span class="material-symbols-outlined" style="font-size: 16px;">delete_sweep</span> Clear History
                </button>
                <button type="button" onclick="document.getElementById('ivrLogsModalBackdrop').remove()" style="border: none; background: #f1f5f9; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
              </button>
              </div>
            </div>
            <div style="padding: 16px 24px; overflow-y: auto; flex: 1;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8fafc; text-align: left; font-size: 0.74rem; text-transform: uppercase; color: #475569; border-bottom: 1.5px solid #e2e8f0;">
                    <th style="padding: 8px 14px;">Date/Time</th>
                    <th style="padding: 8px 14px;">Student</th>
                    <th style="padding: 8px 14px;">Class</th>
                    <th style="padding: 8px 14px;">Due Amount</th>
                    <th style="padding: 8px 14px;">Key Pressed</th>
                    <th style="padding: 8px 14px;">WhatsApp QR</th>
                    <th style="padding: 8px 14px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      const existing = document.getElementById('ivrLogsModalBackdrop');
      if (existing) existing.remove();
      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      if (window.showToast) window.showToast('Failed to load call logs: ' + err.message, 'error');
    }
  };

})();
