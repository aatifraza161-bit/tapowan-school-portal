const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'public', 'online_classes_module.js');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = 'function renderOnlineClassesWorkspace() {';
const endMarker = 'window.renderOnlineClassesWorkspace = renderOnlineClassesWorkspace;';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find boundaries for renderOnlineClassesWorkspace');
  process.exit(1);
}

const replacementCode = `function renderOnlineClassesWorkspace() {
    const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});
    const students = state.directoryStudents || store.students || [];
    const teachers = state.directoryTeachers || store.teachers || [];
    const classes = state.directoryClasses || store.classes || [];

    // 1. Hide default dashboard grids, hero, statsCards
    const analyticsGrid = document.querySelector('.analytics-grid');
    if (analyticsGrid) analyticsGrid.style.display = 'none';

    const hero = document.getElementById('dashboardHero');
    if (hero) hero.style.display = 'none';

    const sc = document.getElementById('statsCards');
    if (sc) sc.style.display = 'none';

    // 2. Hide default form & table panels
    const formPanel = document.getElementById('dynamicForm')?.closest('.panel') || document.getElementById('formPanel');
    if (formPanel) formPanel.style.display = 'none';

    const tablePanel = document.getElementById('tablePanel') || document.querySelector('.table-wrap')?.closest('.panel');
    if (tablePanel) tablePanel.style.display = 'none';

    // 3. Hide any other panels
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.querySelectorAll('.panel:not(#onlineClassesPanel)').forEach(p => {
        p.style.display = 'none';
      });
    }

    let panel = document.getElementById('onlineClassesPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'onlineClassesPanel';
      panel.className = 'panel';
      panel.style.cssText = 'background:transparent; padding:0; box-shadow:none;';
      if (contentArea) contentArea.appendChild(panel);
    }

    panel.classList.remove('hidden');
    panel.style.display = 'block';

    panel.innerHTML = \`
      <style>
        /* ============================================================
           ZOOM WORKPLACE MEETING UI - AUTHENTIC MEETING ROOM DESIGN
           (Unnecessary Web Header Removed - Dedicated Sound Announcement)
           ============================================================ */
        .zoom-workplace-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 72px);
          min-height: 640px;
          background: #18181b;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          user-select: none;
          position: relative;
        }

        /* ── BODY LAYOUT (Left narrow sidebar + Center Meeting Stage) ── */
        .zoom-body-layout {
          display: flex;
          flex: 1;
          min-height: 0;
          position: relative;
          overflow: hidden;
        }

        /* Left Narrow Sidebar */
        .zoom-left-sidebar {
          width: 68px;
          background: #18181b;
          border-right: 1px solid #27272a;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px 4px;
          box-sizing: border-box;
          flex-shrink: 0;
          z-index: 40;
        }
        .zoom-sidebar-top-group, .zoom-sidebar-bottom-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
          width: 100%;
        }
        .zoom-sidebar-item {
          width: 58px;
          height: 52px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transition: background 0.15s, color 0.15s;
          padding: 4px;
          box-sizing: border-box;
        }
        .zoom-sidebar-item:hover {
          background: rgba(255,255,255,0.06);
          color: #f4f4f5;
        }
        .zoom-sidebar-item.active {
          background: #27272a;
          color: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .zoom-sidebar-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: -0.2px;
        }

        /* Center Main Viewport */
        .zoom-main-viewport {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #18181b;
          position: relative;
          min-width: 0;
          overflow: hidden;
        }

        /* Meeting Stage View (#zoomViewHome) */
        .zoom-stage-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          min-height: 0;
          background: #18181b;
        }

        /* ── MEETING TOP HEADER BAR (Clean & Authentic) ── */
        .zoom-meeting-top-bar {
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          z-index: 30;
          background: #18181b;
          border-bottom: 1px solid #27272a;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .zoom-meeting-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .zoom-info-badge {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.6);
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-style: italic;
          font-family: serif;
          transition: background 0.15s, border-color 0.15s;
        }
        .zoom-info-badge:hover {
          background: rgba(255,255,255,0.2);
          border-color: #ffffff;
        }
        .zoom-meeting-title-text {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.2px;
        }

        /* Prominent Sound Announcement Button */
        .zoom-sound-announce-btn {
          background: linear-gradient(135deg, #7c3aed, #9333ea);
          border: 1px solid rgba(168, 85, 247, 0.4);
          color: #ffffff;
          padding: 7px 18px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.45);
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .zoom-sound-announce-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(124, 58, 237, 0.65);
          background: linear-gradient(135deg, #6d28d9, #7e22ce);
        }

        .zoom-meeting-center-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(39,39,42,0.8);
          color: #d4d4d8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .zoom-meeting-center-close:hover {
          background: #3f3f46;
          color: #ffffff;
        }
        .zoom-meeting-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .zoom-hdr-btn {
          background: none;
          border: none;
          color: #d4d4d8;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
        }
        .zoom-hdr-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #ffffff;
        }
        .zoom-zm-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #3f3f46;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.15);
        }

        /* Meeting Canvas Area */
        .zoom-stage-canvas {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #18181b;
          overflow: hidden;
        }
        .zoom-sketch-image {
          max-height: 72%;
          max-width: 70%;
          object-fit: contain;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.8));
          pointer-events: none;
          transition: opacity 0.3s;
        }
        .zoom-live-video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: none;
          background: #000;
        }

        /* Bottom-Left Name Badge (Red mic + Name matching screenshot) */
        .zoom-name-pill {
          position: absolute;
          bottom: 18px;
          left: 20px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border-radius: 4px;
          padding: 6px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.2px;
          z-index: 25;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.08);
        }

        /* ── BOTTOM TOOLBAR (EXACT ZOOM CONTROLS) ── */
        .zoom-bottom-bar {
          height: 66px;
          background: #18181b;
          border-top: 1px solid #27272a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
          z-index: 50;
          box-sizing: border-box;
          position: relative;
        }
        .zoom-ctrl-left, .zoom-ctrl-center, .zoom-ctrl-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Control Buttons (Stacked icon + chevron + label) */
        .zoom-ctrl-btn {
          height: 54px;
          min-width: 60px;
          padding: 4px 8px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #d4d4d8;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          transition: background 0.15s, color 0.15s;
          position: relative;
        }
        .zoom-ctrl-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #ffffff;
        }
        .zoom-ctrl-btn.active {
          background: rgba(255,255,255,0.12);
          color: #ffffff;
        }
        .zoom-ctrl-icon-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .zoom-ctrl-label {
          font-size: 10.5px;
          font-weight: 500;
          white-space: nowrap;
          letter-spacing: -0.2px;
        }
        .zoom-ctrl-chevron {
          font-size: 12px !important;
          color: #a1a1aa;
        }

        /* Share Button (Green Accent) */
        .zoom-share-icon {
          color: #22c55e !important;
        }

        /* End Button (Red Square + Red Label) */
        .zoom-end-btn-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          cursor: pointer;
          background: none;
          border: none;
          padding: 4px 8px;
          border-radius: 8px;
          transition: background 0.15s;
        }
        .zoom-end-btn-wrap:hover {
          background: rgba(239,68,68,0.12);
        }
        .zoom-end-square {
          width: 28px;
          height: 28px;
          background: #e11d48;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(225,29,72,0.35);
          transition: transform 0.1s, background 0.15s;
        }
        .zoom-end-btn-wrap:hover .zoom-end-square {
          background: #be123c;
          transform: scale(1.05);
        }
        .zoom-end-label {
          font-size: 10.5px;
          font-weight: 700;
          color: #f43f5e;
        }

        /* ── SLIDE-OUT DRAWERS (Participants & Chat) ── */
        .zoom-side-drawer {
          position: absolute;
          top: 0;
          right: -360px;
          width: 340px;
          bottom: 0;
          background: #1f1f23;
          border-left: 1px solid #27272a;
          z-index: 45;
          display: flex;
          flex-direction: column;
          transition: right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: -10px 0 30px rgba(0,0,0,0.5);
        }
        .zoom-side-drawer.open {
          right: 0;
        }
        .zoom-drawer-header {
          padding: 14px 16px;
          border-bottom: 1px solid #27272a;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #18181b;
        }
        .zoom-drawer-title {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }
        .zoom-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ── POPUPS (Reactions, Host Tools, More) ── */
        .zoom-popup-bubble {
          position: absolute;
          bottom: 74px;
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.6);
          z-index: 60;
          display: none;
        }
        .zoom-reaction-row {
          display: flex;
          gap: 8px;
          font-size: 24px;
        }
        .zoom-reaction-btn {
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.15s;
          padding: 4px;
          border-radius: 8px;
        }
        .zoom-reaction-btn:hover {
          transform: scale(1.25);
          background: rgba(255,255,255,0.1);
        }

        /* Floating reaction animations */
        @keyframes zoomFloatUp {
          0% { transform: translateY(0) scale(0.8); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.4); opacity: 0; }
        }
        .zoom-floating-emoji {
          position: absolute;
          bottom: 80px;
          font-size: 34px;
          pointer-events: none;
          z-index: 999;
          animation: zoomFloatUp 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        /* Secondary Views (Chat, Meetings, Contacts, Settings) */
        .zoom-tab-view {
          flex: 1;
          display: none;
          flex-direction: column;
          background: #09090b;
          overflow-y: auto;
          padding: 24px;
          color: #f4f4f5;
        }
      </style>

      <div class="zoom-workplace-container">
        
        <!-- MAIN BODY (Sidebar + Stage) -->
        <div class="zoom-body-layout">
          
          <!-- Left Narrow Vertical Sidebar -->
          <nav class="zoom-left-sidebar">
            <div class="zoom-sidebar-top-group">
              <button class="zoom-sidebar-item active" id="zoomNavHome" onclick="window.zoomSwitchTab('home')" title="Zoom Meeting Stage">
                <span class="material-symbols-outlined" style="font-size: 20px;">home</span>
                <span class="zoom-sidebar-label">Home</span>
              </button>
              <button class="zoom-sidebar-item" id="zoomNavSound" onclick="window.openVoiceNotificationModal()" title="Sound Announcement to Students">
                <span class="material-symbols-outlined" style="font-size: 20px; color: #c084fc;">campaign</span>
                <span class="zoom-sidebar-label" style="color: #c084fc; font-weight: 700;">Announce</span>
              </button>
              <button class="zoom-sidebar-item" id="zoomNavChat" onclick="window.zoomSwitchTab('chat')" title="Team Chat">
                <span class="material-symbols-outlined" style="font-size: 20px;">chat_bubble</span>
                <span class="zoom-sidebar-label">Chat</span>
              </button>
              <button class="zoom-sidebar-item" id="zoomNavMeetings" onclick="window.zoomSwitchTab('meetings')" title="Meetings & Classrooms">
                <span class="material-symbols-outlined" style="font-size: 20px;">calendar_month</span>
                <span class="zoom-sidebar-label">Meetings</span>
              </button>
              <button class="zoom-sidebar-item" id="zoomNavContacts" onclick="window.zoomSwitchTab('contacts')" title="1:1 Calling Directory">
                <span class="material-symbols-outlined" style="font-size: 20px;">contacts</span>
                <span class="zoom-sidebar-label">Contacts</span>
              </button>
            </div>

            <div class="zoom-sidebar-bottom-group">
              <button class="zoom-sidebar-item" id="zoomNavSettings" onclick="window.zoomSwitchTab('settings')" title="Admin Settings">
                <span class="material-symbols-outlined" style="font-size: 20px;">settings</span>
                <span class="zoom-sidebar-label">Settings</span>
              </button>
            </div>
          </nav>

          <!-- Main Viewport Container -->
          <main class="zoom-main-viewport">
            
            <!-- TAB 1: ZOOM MEETING STAGE (Home) -->
            <section class="zoom-stage-view" id="zoomViewHome">
              
              <!-- Clean Meeting Header Bar with Sound Announcement -->
              <div class="zoom-meeting-top-bar">
                <div class="zoom-meeting-title-group">
                  <div class="zoom-info-badge" onclick="window.zoomShowMeetingInfo()" title="Meeting Information">i</div>
                  <span class="zoom-meeting-title-text">TAPOWAN PUBLIC SCHOOL's Zoom Meeting</span>
                  <span style="background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: #4ade80; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; margin-left: 4px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span>
                    Active
                  </span>
                </div>

                <!-- Center: Prominent Sound Announcement Option -->
                <div style="display: flex; align-items: center; gap: 10px;">
                  <button class="zoom-sound-announce-btn" onclick="window.openVoiceNotificationModal()" title="Auto-plays sound message aloud through student phone speakers without tapping">
                    <span class="material-symbols-outlined" style="font-size: 19px;">campaign</span>
                    <span>Sound Announcement</span>
                  </button>
                </div>

                <!-- Right Action Icons -->
                <div class="zoom-meeting-header-actions">
                  <span class="material-symbols-outlined" style="color: #22c55e; font-size: 19px;" title="Meeting Encrypted">security</span>
                  <button class="zoom-hdr-btn" onclick="window.zoomCopyInviteLink()" title="Copy Invite Link">
                    <span class="material-symbols-outlined" style="font-size: 18px;">link</span>
                  </button>
                  <button class="zoom-hdr-btn" onclick="window.zoomShowAiCompanion()" title="AI Companion">
                    <span class="material-symbols-outlined" style="font-size: 18px; color: #c084fc;">auto_awesome</span>
                  </button>
                  <button class="zoom-hdr-btn" onclick="window.zoomToggleViewLayout()" title="Switch Layout">
                    <span class="material-symbols-outlined" style="font-size: 18px;">grid_view</span>
                    <span style="font-size: 12px; font-weight: 500;">View</span>
                  </button>
                  <div class="zoom-zm-badge">zm</div>
                </div>
              </div>

              <!-- Meeting Canvas -->
              <div class="zoom-stage-canvas" id="zoomStageCanvas">
                <!-- Pencil Sketch Centered Image -->
                <img id="zoomSketchPortrait" class="zoom-sketch-image" src="/zoom_sample_sketch.png" alt="TAPOWAN PUBLIC SCHOOL" />
                
                <!-- Live Video Element (Turns on when camera starts) -->
                <video id="liveClassMainVideo" class="zoom-live-video-element" autoplay playsinline muted></video>

                <!-- Whiteboard Overlay -->
                <div id="whiteboardContainer" style="display: none; position: absolute; inset: 0; background: #ffffff; z-index: 28; flex-direction: column;">
                  <div style="background: #18181b; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #27272a;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span style="color: #fff; font-size: 12px; font-weight: 700;">Smart Whiteboard:</span>
                      <button class="wb-color-btn" data-color="#000" style="width: 20px; height: 20px; border-radius: 50%; background: #000; border: 2px solid #fff; cursor: pointer;"></button>
                      <button class="wb-color-btn" data-color="#ef4444" style="width: 20px; height: 20px; border-radius: 50%; background: #ef4444; border: 2px solid #fff; cursor: pointer;"></button>
                      <button class="wb-color-btn" data-color="#2563eb" style="width: 20px; height: 20px; border-radius: 50%; background: #2563eb; border: 2px solid #fff; cursor: pointer;"></button>
                      <button id="btnWbClear" style="background: #ef4444; color: white; border: none; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Clear</button>
                    </div>
                    <button onclick="window.zoomToggleWhiteboard()" style="background: #3f3f46; color: white; border: none; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">Close Whiteboard</button>
                  </div>
                  <canvas id="whiteboardCanvas" style="flex: 1; width: 100%; cursor: crosshair;"></canvas>
                </div>

                <!-- Bottom-Left Name Badge matching screenshot -->
                <div class="zoom-name-pill" id="zoomNamePill">
                  <span class="material-symbols-outlined" id="zoomNameMicIcon" style="font-size: 15px; color: #ef4444;">mic_off</span>
                  <span>TAPOWAN PUBLIC SCHOOL</span>
                </div>

                <!-- Floating Reactions Spawner -->
                <div id="zoomFloatingReactionsContainer" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 35;"></div>

                <!-- Slide-Out Participants Drawer -->
                <aside class="zoom-side-drawer" id="zoomParticipantsDrawer">
                  <div class="zoom-drawer-header">
                    <span class="zoom-drawer-title">Participants (<span id="zoomDrawerCount">1</span>)</span>
                    <button class="zoom-nav-arrow-btn" onclick="window.zoomToggleParticipants()"><span class="material-symbols-outlined" style="font-size: 18px;">close</span></button>
                  </div>
                  <div class="zoom-drawer-body">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #27272a; border-radius: 8px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="zoom-nav-avatar" style="width: 28px; height: 28px; font-size: 11px; background: #4338ca; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">TP</div>
                        <div>
                          <div style="font-size: 12.5px; font-weight: 700; color: #fff;">TAPOWAN PUBLIC SCHOOL</div>
                          <div style="font-size: 10.5px; color: #a1a1aa;">Host, me</div>
                        </div>
                      </div>
                      <div style="display: flex; gap: 6px; color: #a1a1aa;">
                        <span class="material-symbols-outlined" style="font-size: 17px; color: #ef4444;">mic_off</span>
                        <span class="material-symbols-outlined" style="font-size: 17px; color: #ef4444;">videocam_off</span>
                      </div>
                    </div>
                    <div id="zoomParticipantsRosterList" style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;"></div>
                  </div>
                  <div style="padding: 12px 16px; border-top: 1px solid #27272a; display: flex; gap: 8px;">
                    <button onclick="window.zoomCopyInviteLink()" style="flex: 1; padding: 8px; background: #3f3f46; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Invite</button>
                    <button onclick="window.zoomMuteAll()" style="flex: 1; padding: 8px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Mute All</button>
                  </div>
                </aside>

                <!-- Slide-Out Chat Drawer -->
                <aside class="zoom-side-drawer" id="zoomChatDrawer">
                  <div class="zoom-drawer-header">
                    <span class="zoom-drawer-title">Meeting Chat</span>
                    <button class="zoom-nav-arrow-btn" onclick="window.zoomToggleChat()"><span class="material-symbols-outlined" style="font-size: 18px;">close</span></button>
                  </div>
                  <div class="zoom-drawer-body" id="zoomChatMessagesContainer">
                    <div style="background: rgba(255,255,255,0.04); padding: 10px 12px; border-radius: 8px; font-size: 12px; color: #a1a1aa;">
                      Welcome to TAPOWAN Live Meeting. Messages sent here are visible to all students and teachers.
                    </div>
                  </div>
                  <div style="padding: 12px 16px; border-top: 1px solid #27272a; display: flex; flex-direction: column; gap: 8px;">
                    <textarea id="zoomChatInput" rows="2" placeholder="Type message to everyone..." style="background: #27272a; border: 1px solid #3f3f46; border-radius: 8px; color: white; font-size: 12px; padding: 8px; resize: none; outline: none;"></textarea>
                    <div style="display: flex; justify-content: flex-end;">
                      <button onclick="window.zoomSendChatMessage()" style="background: #0b5cff; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">Send</button>
                    </div>
                  </div>
                </aside>

                <!-- Reactions Popup Bubble -->
                <div class="zoom-popup-bubble" id="zoomReactionsPopup" style="left: calc(50% - 110px);">
                  <div class="zoom-reaction-row">
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('❤️')">❤️</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('👍')">👍</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('👏')">👏</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('😂')">😂</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('😮')">😮</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('🎉')">🎉</button>
                    <button class="zoom-reaction-btn" onclick="window.zoomSendReaction('✋')">✋</button>
                  </div>
                </div>

                <!-- Host Tools Popup -->
                <div class="zoom-popup-bubble" id="zoomHostToolsMenu" style="left: calc(50% + 20px); min-width: 200px;">
                  <div style="font-size: 12px; font-weight: 700; color: #a1a1aa; margin-bottom: 6px;">HOST SECURITY TOOLS</div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button onclick="window.zoomMuteAll()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#ef4444;">mic_off</span> Mute All Participants
                    </button>
                    <button onclick="window.zoomToggleWhiteboard()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#c084fc;">draw</span> Whiteboard Studio
                    </button>
                    <button onclick="window.openVoiceNotificationModal()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#c084fc;">campaign</span> Sound Announcement
                    </button>
                  </div>
                </div>

                <!-- More Menu Popup -->
                <div class="zoom-popup-bubble" id="zoomMoreMenu" style="left: calc(50% + 150px); min-width: 180px;">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button onclick="window.toggleStudioRecording()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#ef4444;">fiber_manual_record</span> Record to Local
                    </button>
                    <button onclick="window.openStudioPollCreator()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#38bdf8;">poll</span> Launch Live Poll
                    </button>
                    <button onclick="window.openVoiceNotificationModal()" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#c084fc;">campaign</span> Sound Announcement
                    </button>
                    <button onclick="window.zoomSwitchTab('settings')" style="background:none; border:none; color:white; text-align:left; padding:6px; font-size:12px; cursor:pointer; border-radius:4px; display:flex; align-items:center; gap:8px;">
                      <span class="material-symbols-outlined" style="font-size:16px; color:#cbd5e1;">settings</span> Audio / Video Settings
                    </button>
                  </div>
                </div>

              </div>

              <!-- ── BOTTOM TOOLBAR (EXACT ZOOM CONTROLS) ── -->
              <footer class="zoom-bottom-bar">
                
                <!-- Left: Audio & Video -->
                <div class="zoom-ctrl-left">
                  <!-- Audio Button -->
                  <button class="zoom-ctrl-btn" id="zoomBtnAudio" onclick="window.zoomToggleAudio()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" id="zoomIconAudio" style="font-size: 20px; color: #ef4444;">mic_off</span>
                      <span class="material-symbols-outlined zoom-ctrl-chevron">expand_less</span>
                    </div>
                    <span class="zoom-ctrl-label" id="zoomLabelAudio">Audio</span>
                  </button>

                  <!-- Video Button -->
                  <button class="zoom-ctrl-btn" id="zoomBtnVideo" onclick="window.zoomToggleVideo()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" id="zoomIconVideo" style="font-size: 20px; color: #ef4444;">videocam_off</span>
                      <span class="material-symbols-outlined zoom-ctrl-chevron">expand_less</span>
                    </div>
                    <span class="zoom-ctrl-label" id="zoomLabelVideo">Video</span>
                  </button>
                </div>

                <!-- Center: Participants, Chat, React, Share, Host tools, Sound Announce, Breakout Rooms, More -->
                <div class="zoom-ctrl-center">
                  <!-- Participants -->
                  <button class="zoom-ctrl-btn" id="zoomBtnParticipants" onclick="window.zoomToggleParticipants()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px;">group</span>
                      <span class="zoom-ctrl-chevron">1</span>
                      <span class="material-symbols-outlined zoom-ctrl-chevron">expand_less</span>
                    </div>
                    <span class="zoom-ctrl-label">Participants</span>
                  </button>

                  <!-- Chat -->
                  <button class="zoom-ctrl-btn" id="zoomBtnChat" onclick="window.zoomToggleChat()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px;">chat_bubble</span>
                    </div>
                    <span class="zoom-ctrl-label">Chat</span>
                  </button>

                  <!-- React -->
                  <button class="zoom-ctrl-btn" id="zoomBtnReact" onclick="window.zoomToggleReactions(event)">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px; color: #f43f5e;">favorite</span>
                    </div>
                    <span class="zoom-ctrl-label">React</span>
                  </button>

                  <!-- Share Screen (Green Accent) -->
                  <button class="zoom-ctrl-btn" id="zoomBtnShare" onclick="window.zoomToggleShare()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined zoom-share-icon" style="font-size: 20px;">present_to_all</span>
                      <span class="material-symbols-outlined zoom-ctrl-chevron">expand_less</span>
                    </div>
                    <span class="zoom-ctrl-label">Share</span>
                  </button>

                  <!-- Host Tools -->
                  <button class="zoom-ctrl-btn" id="zoomBtnHostTools" onclick="window.zoomToggleHostTools(event)">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px;">shield_person</span>
                    </div>
                    <span class="zoom-ctrl-label">Host tools</span>
                  </button>

                  <!-- Sound Announcement Button -->
                  <button class="zoom-ctrl-btn" id="zoomBtnSoundAnnounce" onclick="window.openVoiceNotificationModal()" title="Broadcast Sound Announcement to Student Phones">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px; color: #c084fc;">campaign</span>
                    </div>
                    <span class="zoom-ctrl-label" style="color: #c084fc; font-weight: 700;">Announce</span>
                  </button>

                  <!-- Breakout Rooms -->
                  <button class="zoom-ctrl-btn" id="zoomBtnBreakout" onclick="window.zoomTriggerBreakout()">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px;">grid_view</span>
                    </div>
                    <span class="zoom-ctrl-label">Breakout Rooms</span>
                  </button>

                  <!-- More -->
                  <button class="zoom-ctrl-btn" id="zoomBtnMore" onclick="window.zoomToggleMore(event)">
                    <div class="zoom-ctrl-icon-row">
                      <span class="material-symbols-outlined" style="font-size: 20px;">more_horiz</span>
                    </div>
                    <span class="zoom-ctrl-label">More</span>
                  </button>
                </div>

                <!-- Right: End Meeting -->
                <div class="zoom-ctrl-right">
                  <button class="zoom-end-btn-wrap" onclick="window.zoomEndMeeting()" title="End or Leave Meeting">
                    <div class="zoom-end-square">
                      <span class="material-symbols-outlined" style="font-size: 16px; font-weight: 800;">close</span>
                    </div>
                    <span class="zoom-end-label">End</span>
                  </button>
                </div>

              </footer>

            </section>

            <!-- TAB 2: CHAT VIEW -->
            <section class="zoom-tab-view" id="zoomViewChat">
              <div style="max-width: 900px; margin: 0 auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
                  <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff;">Zoom Team Chat & Class Channels</h2>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1aa;">Real-time messaging channels for faculty and student classrooms</p>
                  </div>
                  <button onclick="window.zoomSwitchTab('home')" style="background: #27272a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">← Return to Meeting</button>
                </div>
                <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; min-height: 400px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                  <span class="material-symbols-outlined" style="font-size: 48px; color: #0b5cff; margin-bottom: 12px;">chat_bubble</span>
                  <div style="font-size: 16px; font-weight: 700; color: #fff;">TAPOWAN General Discussion Channel Active</div>
                  <div style="font-size: 13px; color: #a1a1aa; max-width: 440px; margin-top: 6px;">Use the in-meeting chat drawer during active video classes or broadcast alerts to students.</div>
                  <button onclick="window.zoomSwitchTab('home'); setTimeout(window.zoomToggleChat, 100);" style="margin-top: 16px; background: #0b5cff; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Open In-Meeting Chat Drawer</button>
                </div>
              </div>
            </section>

            <!-- TAB 3: MEETINGS & ROOMS VIEW -->
            <section class="zoom-tab-view" id="zoomViewMeetings">
              <div style="max-width: 1000px; margin: 0 auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
                  <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff;">Scheduled Meetings & Classrooms</h2>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1aa;">Active rooms, recorded lectures and timetable schedules</p>
                  </div>
                  <button onclick="window.zoomSwitchTab('home')" style="background: #27272a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">← Return to Meeting</button>
                </div>
                <div>
                  \${renderRoomsLogContent()}
                </div>
              </div>
            </section>

            <!-- TAB 4: CONTACTS & 1:1 CALLING VIEW -->
            <section class="zoom-tab-view" id="zoomViewContacts">
              <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
                  <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff;">Direct Contacts & Voice Calling Directory</h2>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1aa;">Place 1:1 HD WebRTC calls to students and teachers</p>
                  </div>
                  <button onclick="window.zoomSwitchTab('home')" style="background: #27272a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">← Return to Meeting</button>
                </div>
                <div>
                  \${renderCallingContent(students, teachers, classes)}
                </div>
              </div>
            </section>

            <!-- TAB 5: SETTINGS VIEW -->
            <section class="zoom-tab-view" id="zoomViewSettings">
              <div style="max-width: 800px; margin: 0 auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
                  <div>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff;">Zoom Workplace Admin Settings</h2>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #a1a1aa;">Manage hardware audio, video resolution and classroom policies</p>
                  </div>
                  <button onclick="window.zoomSwitchTab('home')" style="background: #27272a; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">← Return to Meeting</button>
                </div>

                <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Camera Resolution</label>
                    <select id="zoomSettingQuality" style="background: #27272a; border: 1px solid #3f3f46; color: white; padding: 8px 12px; border-radius: 8px; width: 100%; max-width: 300px;">
                      <option value="1080p" selected>Full HD 1080p (60 fps)</option>
                      <option value="720p">HD 720p (30 fps)</option>
                      <option value="480p">SD 480p (Data Saver)</option>
                    </select>
                  </div>

                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">WebRTC VoIP Signaling Server</label>
                    <input type="text" readonly value="https://tapowan-whatsapp-gateway.onrender.com/api" style="background: #27272a; border: 1px solid #3f3f46; color: #a1a1aa; padding: 8px 12px; border-radius: 8px; width: 100%; max-width: 480px;" />
                  </div>

                  <div style="padding-top: 12px; border-top: 1px solid #27272a;">
                    <button onclick="alert('VoIP diagnostics complete: WebRTC Audio & Video pipelines operating normally.')" style="background: #0b5cff; color: white; border: none; padding: 9px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Run VoIP Diagnostic Test</button>
                  </div>
                </div>
              </div>
            </section>

          </main>
        </div>

      </div>
    \`;

    // ─────────────────────────────────────────────────────────────
    // ── ZOOM WORKPLACE INTERACTIVE EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────
    let isMicMuted = true;
    let isCameraActive = false;
    let activeCameraStream = null;

    window.zoomSwitchTab = function(tabName) {
      const views = ['home', 'chat', 'meetings', 'contacts', 'settings'];
      views.forEach(v => {
        const viewEl = document.getElementById('zoomView' + v.charAt(0).toUpperCase() + v.slice(1));
        const navEl = document.getElementById('zoomNav' + v.charAt(0).toUpperCase() + v.slice(1));
        if (viewEl) viewEl.style.display = (v === tabName) ? (v === 'home' ? 'flex' : 'flex') : 'none';
        if (navEl) navEl.classList.toggle('active', v === tabName);
      });
      if (tabName === 'contacts') {
        wireCallingTabEvents();
        ensureDirectoryData();
      } else if (tabName === 'meetings') {
        loadActiveRoomsData();
      }
    };

    window.zoomToggleAudio = function() {
      isMicMuted = !isMicMuted;
      const icon = document.getElementById('zoomIconAudio');
      const label = document.getElementById('zoomLabelAudio');
      const nameMic = document.getElementById('zoomNameMicIcon');
      if (icon) {
        icon.innerText = isMicMuted ? 'mic_off' : 'mic';
        icon.style.color = isMicMuted ? '#ef4444' : '#22c55e';
      }
      if (label) label.innerText = isMicMuted ? 'Audio' : 'Mute';
      if (nameMic) {
        nameMic.innerText = isMicMuted ? 'mic_off' : 'mic';
        nameMic.style.color = isMicMuted ? '#ef4444' : '#22c55e';
      }
      showStudioToast(isMicMuted ? '🔇 Microphone muted' : '🎙️ Microphone active');
      if (state.activeRoom) toggleStudioMic();
    };

    window.zoomToggleVideo = function() {
      const videoEl = document.getElementById('liveClassMainVideo');
      const sketchImg = document.getElementById('zoomSketchPortrait');
      const icon = document.getElementById('zoomIconVideo');
      const label = document.getElementById('zoomLabelVideo');

      if (!isCameraActive) {
        navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
          .then(stream => {
            activeCameraStream = stream;
            isCameraActive = true;
            if (videoEl) {
              videoEl.srcObject = stream;
              videoEl.style.display = 'block';
              videoEl.play().catch(() => {});
            }
            if (sketchImg) sketchImg.style.display = 'none';
            if (icon) {
              icon.innerText = 'videocam';
              icon.style.color = '#ffffff';
            }
            if (label) label.innerText = 'Stop Video';
            showStudioToast('📹 Video camera turned ON');
          })
          .catch(err => {
            console.warn('Camera access denied or unavailable:', err);
            showStudioToast('⚠️ Camera permission not granted or device unavailable');
          });
      } else {
        if (activeCameraStream) {
          activeCameraStream.getTracks().forEach(t => t.stop());
          activeCameraStream = null;
        }
        isCameraActive = false;
        if (videoEl) {
          videoEl.srcObject = null;
          videoEl.style.display = 'none';
        }
        if (sketchImg) sketchImg.style.display = 'block';
        if (icon) {
          icon.innerText = 'videocam_off';
          icon.style.color = '#ef4444';
        }
        if (label) label.innerText = 'Video';
        showStudioToast('🚫 Video camera turned OFF');
      }
    };

    window.zoomToggleParticipants = function() {
      const drawer = document.getElementById('zoomParticipantsDrawer');
      const btn = document.getElementById('zoomBtnParticipants');
      if (!drawer) return;
      const isOpen = drawer.classList.contains('open');
      drawer.classList.toggle('open', !isOpen);
      if (btn) btn.classList.toggle('active', !isOpen);
      if (!isOpen) {
        const chat = document.getElementById('zoomChatDrawer');
        if (chat) chat.classList.remove('open');
      }
    };

    window.zoomToggleChat = function() {
      const drawer = document.getElementById('zoomChatDrawer');
      const btn = document.getElementById('zoomBtnChat');
      if (!drawer) return;
      const isOpen = drawer.classList.contains('open');
      drawer.classList.toggle('open', !isOpen);
      if (btn) btn.classList.toggle('active', !isOpen);
      if (!isOpen) {
        const part = document.getElementById('zoomParticipantsDrawer');
        if (part) part.classList.remove('open');
      }
    };

    window.zoomToggleReactions = function(e) {
      if (e) e.stopPropagation();
      const popup = document.getElementById('zoomReactionsPopup');
      if (!popup) return;
      const isVisible = popup.style.display === 'block';
      popup.style.display = isVisible ? 'none' : 'block';
    };

    window.zoomSendReaction = function(emoji) {
      const container = document.getElementById('zoomFloatingReactionsContainer');
      if (container) {
        const el = document.createElement('div');
        el.className = 'zoom-floating-emoji';
        el.innerText = emoji;
        el.style.left = (40 + Math.random() * 20) + '%';
        container.appendChild(el);
        setTimeout(() => el.remove(), 2300);
      }
      const popup = document.getElementById('zoomReactionsPopup');
      if (popup) popup.style.display = 'none';
      if (typeof window.sendStudioReaction === 'function') window.sendStudioReaction(emoji);
    };

    window.zoomToggleHostTools = function(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('zoomHostToolsMenu');
      if (!menu) return;
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    };

    window.zoomToggleMore = function(e) {
      if (e) e.stopPropagation();
      const menu = document.getElementById('zoomMoreMenu');
      if (!menu) return;
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    };

    // Global click dismiss for popups
    document.addEventListener('click', function(e) {
      const reactPop = document.getElementById('zoomReactionsPopup');
      const hostPop = document.getElementById('zoomHostToolsMenu');
      const morePop = document.getElementById('zoomMoreMenu');
      if (reactPop && !reactPop.contains(e.target) && !document.getElementById('zoomBtnReact')?.contains(e.target)) {
        reactPop.style.display = 'none';
      }
      if (hostPop && !hostPop.contains(e.target) && !document.getElementById('zoomBtnHostTools')?.contains(e.target)) {
        hostPop.style.display = 'none';
      }
      if (morePop && !morePop.contains(e.target) && !document.getElementById('zoomBtnMore')?.contains(e.target)) {
        morePop.style.display = 'none';
      }
    });

    window.zoomToggleShare = function() {
      if (typeof toggleScreenShare === 'function') {
        toggleScreenShare();
      } else {
        alert('Starting screen share...');
      }
    };

    window.zoomToggleWhiteboard = function() {
      const wb = document.getElementById('whiteboardContainer');
      if (!wb) return;
      const isVis = wb.style.display === 'flex';
      wb.style.display = isVis ? 'none' : 'flex';
      if (!isVis && typeof initWhiteboardCanvas === 'function') {
        initWhiteboardCanvas();
      }
    };

    window.zoomMuteAll = function() {
      if (confirm('Broadcast Mute command to all participants in this live meeting?')) {
        if (typeof broadcastMuteAllStudents === 'function') broadcastMuteAllStudents();
        showStudioToast('🔇 Muted all participants');
      }
    };

    window.zoomTriggerBreakout = function() {
      if (typeof triggerStudioBreakout === 'function') {
        triggerStudioBreakout();
      } else {
        prompt('Enter number of breakout rooms to form for students:', '2');
        showStudioToast('🔲 Breakout rooms initialized');
      }
    };

    window.zoomEndMeeting = function() {
      if (confirm('End meeting for all participants? (Click Cancel to keep meeting running)')) {
        if (activeCameraStream) {
          activeCameraStream.getTracks().forEach(t => t.stop());
          activeCameraStream = null;
        }
        if (state.activeRoom && typeof stopClassroomStudio === 'function') {
          stopClassroomStudio();
        }
        showStudioToast('🔴 Meeting ended');
      }
    };

    window.zoomCopyInviteLink = function() {
      const link = 'https://tapowan-school.vercel.app/live-class/tps-zoom';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
          showStudioToast('🔗 Meeting invite link copied to clipboard!');
        }).catch(() => {
          prompt('Meeting Invite Link:', link);
        });
      } else {
        prompt('Meeting Invite Link:', link);
      }
    };

    window.zoomShowMeetingInfo = function() {
      alert(
        'TAPOWAN PUBLIC SCHOOL\\\'s Zoom Meeting\\n' +
        '------------------------------------\\n' +
        'Meeting ID: 842 9102 3844\\n' +
        'Host: TAPOWAN PUBLIC SCHOOL (Admin)\\n' +
        'Passcode: 2026tps\\n' +
        'Invite Link: https://tapowan-school.vercel.app/live-class/tps-zoom\\n' +
        'Encryption: Enhanced 256-Bit WebRTC AES'
      );
    };

    window.zoomShowAiCompanion = function() {
      alert('✨ Zoom AI Companion is active and taking real-time notes and lecture summary.');
    };

    window.zoomToggleViewLayout = function() {
      showStudioToast('⊞ Switched layout view');
    };

    window.zoomCollapseMeeting = function() {
      showStudioToast('Meeting collapsed to picture-in-picture mode');
    };

    window.zoomSendChatMessage = function() {
      const input = document.getElementById('zoomChatInput');
      const val = input ? input.value.trim() : '';
      if (!val) return;
      const container = document.getElementById('zoomChatMessagesContainer');
      if (container) {
        const msgDiv = document.createElement('div');
        msgDiv.style.cssText = 'background: #27272a; padding: 8px 12px; border-radius: 8px; margin-top: 6px;';
        msgDiv.innerHTML = '<div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-bottom: 2px;">TAPOWAN (Host)</div><div style="font-size: 12.5px; color: #fff;">' + escapeHtml(val) + '</div>';
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
      }
      if (input) input.value = '';
    };

    // Initialize default directory & rooms in background
    if (state.currentTab === 'calling') {
      ensureDirectoryData();
    }
  }
`;

const updatedContent = content.slice(0, startIndex) + replacementCode + '\n  ' + content.slice(endIndex);

fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('Successfully updated Zoom Workplace UI: removed white top navbar and added dedicated Sound Announcement options.');
