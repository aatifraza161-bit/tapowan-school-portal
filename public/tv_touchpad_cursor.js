/**
 * TPS Cybernetic Virtual TV Cursor & Touchpad Pointer Engine
 * Integrates WebRTC P2P DataChannel (<2ms), HiveMQ MQTT (<15ms), & Cloudflare WebSocket
 * Allows controlling the Tapowan School Portal via Phone Touchpad & Remote.
 */
(function() {
  'use strict';

  // 1. Inject Styles
  const styleId = 'tps-tv-cursor-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .virtual-tv-cursor {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 28px !important;
        height: 28px !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        transform: translate3d(-200px, -200px, 0);
        opacity: 0 !important;
        visibility: hidden !important;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s ease;
        will-change: transform;
        contain: layout paint style !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .virtual-tv-cursor.visible {
        opacity: 1 !important;
        visibility: visible !important;
      }
      .virtual-tv-cursor .cursor-svg {
        width: 28px !important;
        height: 28px !important;
        display: block !important;
        filter: drop-shadow(0 2px 8px rgba(0, 243, 255, 0.95)) drop-shadow(0 0 16px rgba(0, 243, 255, 0.5));
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .virtual-tv-cursor.hovering .cursor-svg {
        filter: drop-shadow(0 2px 10px rgba(255, 215, 0, 0.95)) drop-shadow(0 0 22px rgba(255, 215, 0, 0.6));
      }
      .virtual-tv-cursor.hovering path {
        fill: #ffd700 !important;
      }
      .virtual-tv-cursor .cursor-click-ring {
        position: absolute;
        top: -2px;
        left: -2px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid #00f3ff;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.3);
      }
      .virtual-tv-cursor .cursor-click-ring.pulse {
        animation: tvCursorClickPulse 0.4s ease-out forwards;
      }
      @keyframes tvCursorClickPulse {
        0% { transform: scale(0.3); opacity: 1; border-color: #ffd700; box-shadow: 0 0 15px #ffd700; }
        100% { transform: scale(2.5); opacity: 0; border-color: #00f3ff; }
      }
      .virtual-tv-cursor .cursor-scroll-badge {
        position: absolute;
        top: 26px;
        left: 14px;
        background: rgba(2, 7, 19, 0.94);
        border: 1px solid #00f3ff;
        border-radius: 12px;
        padding: 2px 8px;
        font-family: monospace;
        font-size: 10px;
        font-weight: 800;
        color: #00f3ff;
        letter-spacing: 0.8px;
        white-space: nowrap;
        box-shadow: 0 0 14px rgba(0, 243, 255, 0.5);
        opacity: 0 !important;
        visibility: hidden !important;
        transform: translateY(4px);
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
        pointer-events: none;
      }
      .virtual-tv-cursor.scrolling .cursor-scroll-badge {
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  // 2. Ensure Cursor DOM Overlay
  function ensureCursorDOM() {
    let cursor = document.getElementById('virtualTvCursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'virtualTvCursor';
      cursor.className = 'virtual-tv-cursor';
      cursor.innerHTML = `
        <svg viewBox="0 0 28 28" width="28" height="28" class="cursor-svg">
          <defs>
            <filter id="tvPortalCursorGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0, 243, 255, 0.95)"/>
            </filter>
          </defs>
          <path d="M2 2 L10 24 L14 15 L23 13 Z" fill="#00f3ff" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" filter="url(#tvPortalCursorGlow)"/>
        </svg>
        <div class="cursor-click-ring" id="cursorClickRing"></div>
        <div class="cursor-scroll-badge" id="cursorScrollBadge"><span>⇅</span> <span>SCROLL</span></div>
      `;
      const cursorParent = document.body || document.documentElement;
      if (cursorParent) cursorParent.appendChild(cursor);
    }
    return cursor;
  }

  let virtualTvCursor = null;
  let cursorClickRing = null;
  let cursorHideTimer = null;
  let cursorScrollTimer = null;
  let tvCursorX = Math.round((window.innerWidth || 1920) / 2);
  let tvCursorY = Math.round((window.innerHeight || 1080) / 2);
  let tvCursorInitialized = true;

  function getTvCursor() {
    if (!virtualTvCursor) virtualTvCursor = ensureCursorDOM();
    if (!cursorClickRing) cursorClickRing = document.getElementById('cursorClickRing');
    return virtualTvCursor;
  }

  function showTvCursor() {
    const el = getTvCursor();
    if (!el) return;
    el.classList.add('visible');
    clearTimeout(cursorHideTimer);
    cursorHideTimer = setTimeout(() => {
      if (el) el.classList.remove('visible');
    }, 7000);
  }

  let hoverDebounceTimer = null;
  function scheduleHoverCheck() {
    if (hoverDebounceTimer) return;
    hoverDebounceTimer = setTimeout(() => {
      hoverDebounceTimer = null;
      try {
        const hoverTarget = document.elementFromPoint(tvCursorX, tvCursorY);
        let isClickable = false;
        if (hoverTarget) {
          const clickableEl = hoverTarget.closest('button, a, input, select, textarea, [tabindex], [role="button"], [onclick], .btn, .btn-action, .card, .nav-item, tr, .clickable');
          if (clickableEl) isClickable = true;
        }
        const el = getTvCursor();
        if (el) el.classList.toggle('hovering', isClickable);
      } catch (_) {}
    }, 60);
  }

  function moveVirtualTvCursor(dx, dy) {
    const el = getTvCursor();
    if (!tvCursorInitialized || tvCursorX < 0 || tvCursorY < 0) {
      tvCursorX = Math.round(window.innerWidth / 2);
      tvCursorY = Math.round(window.innerHeight / 2);
      tvCursorInitialized = true;
    }
    showTvCursor();
    tvCursorX = Math.max(2, Math.min(window.innerWidth - 6, tvCursorX + (dx || 0)));
    tvCursorY = Math.max(2, Math.min(window.innerHeight - 6, tvCursorY + (dy || 0)));

    if (el) {
      el.style.transform = `translate3d(${tvCursorX}px, ${tvCursorY}px, 0)`;
      scheduleHoverCheck();
    }
  }

  function clickVirtualTvCursor() {
    showTvCursor();
    const ring = cursorClickRing || document.getElementById('cursorClickRing');
    if (ring) {
      ring.classList.remove('pulse');
      void ring.offsetWidth;
      ring.classList.add('pulse');
    }

    try {
      const target = document.elementFromPoint(tvCursorX, tvCursorY);
      if (target) {
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
          try {
            const ev = new MouseEvent(evtType, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: tvCursorX,
              clientY: tvCursorY
            });
            target.dispatchEvent(ev);
          } catch (_) {}
        });
        if (typeof target.click === 'function') target.click();
        if (typeof target.focus === 'function') target.focus();

        const inputTarget = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') ? target : target.closest('input, textarea');
        if (inputTarget) {
          inputTarget.focus();
        }
      }
    } catch (err) {
      console.warn('[TV Cursor] Click dispatch error:', err);
    }
  }

  function triggerCarouselSlide(dir) {
    try {
      if (dir === 'right') {
        const nextBtn = document.querySelector('.carousel-control-next, .btn-next, .slick-next, .swiper-button-next, [aria-label="Next"], [title="Next"], .nav-next, #nextSlideBtn');
        if (nextBtn) { nextBtn.click(); return; }
      } else {
        const prevBtn = document.querySelector('.carousel-control-prev, .btn-prev, .slick-prev, .swiper-button-prev, [aria-label="Previous"], [title="Previous"], .nav-prev, #prevSlideBtn');
        if (prevBtn) { prevBtn.click(); return; }
      }
    } catch (_) {}
  }

  function scrollVirtualTv(dx, dy) {
    showTvCursor();
    const el = getTvCursor();
    if (el) {
      el.classList.add('scrolling');
      const badge = document.getElementById('cursorScrollBadge');
      if (badge) {
        if (Math.abs(dx) > Math.abs(dy)) {
          badge.innerHTML = '<span>⇆</span> <span>' + (dx > 0 ? 'SLIDE RIGHT ▶' : '◀ SLIDE LEFT') + '</span>';
        } else {
          badge.innerHTML = '<span>⇅</span> <span>' + (dy > 0 ? 'SCROLL DOWN ▼' : '▲ SCROLL UP') + '</span>';
        }
      }
      clearTimeout(cursorScrollTimer);
      cursorScrollTimer = setTimeout(() => {
        if (el) el.classList.remove('scrolling');
      }, 800);
    }

    try {
      const target = document.elementFromPoint(tvCursorX, tvCursorY) || document.body;

      // 1. VERTICAL SCROLL RESOLUTION (if dy != 0)
      let scrollableY = null;
      if (dy !== 0) {
        let currY = target;
        while (currY && currY !== document.body && currY !== document.documentElement) {
          const st = window.getComputedStyle(currY);
          if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && currY.scrollHeight > currY.clientHeight + 2) {
            scrollableY = currY;
            break;
          }
          currY = currY.parentElement;
        }
      }

      // 2. HORIZONTAL SLIDE & SCROLL RESOLUTION (if dx != 0)
      let scrollableX = null;
      if (dx !== 0) {
        // A) Ascend from target to find horizontal container
        let currX = target;
        while (currX && currX !== document.body && currX !== document.documentElement) {
          const st = window.getComputedStyle(currX);
          const hasHorizOverflow = (st.overflowX === 'auto' || st.overflowX === 'scroll' || (currX.scrollWidth > currX.clientWidth + 4 && st.overflowX !== 'hidden'));
          if (hasHorizOverflow && currX.scrollWidth > currX.clientWidth) {
            scrollableX = currX;
            break;
          }
          currX = currX.parentElement;
        }

        // B) Check children of target if target is a card section or table parent
        if (!scrollableX && target && target.querySelector) {
          const innerScroll = target.querySelector('.table-wrap, .wa-table-wrap, .table-container, .table-responsive, [style*="overflow-x"], .cards-row, .horizontal-scroll, table');
          if (innerScroll && innerScroll.scrollWidth > innerScroll.clientWidth) {
            scrollableX = innerScroll;
          }
        }

        // C) Page-wide fallback: Find any visible horizontally scrollable table or container on screen
        if (!scrollableX) {
          const candidates = document.querySelectorAll('.table-wrap, .wa-table-wrap, .table-container, .table-responsive, div[style*="overflow-x: auto"], div[style*="overflow-x:auto"], div[style*="overflow-x: scroll"], div[style*="overflow-x:scroll"], .cards-row, .horizontal-scroll');
          for (let i = 0; i < candidates.length; i++) {
            const cand = candidates[i];
            if (cand.scrollWidth > cand.clientWidth && cand.offsetParent !== null) {
              scrollableX = cand;
              break;
            }
          }
        }
      }

      // Apply Vertical Scroll
      if (scrollableY) {
        scrollableY.scrollTop += dy;
      } else if (dy !== 0) {
        window.scrollBy({ top: dy, behavior: 'auto' });
      }

      // Apply Horizontal Scroll / Slide
      if (scrollableX) {
        scrollableX.scrollLeft += dx;
      } else if (dx !== 0) {
        window.scrollBy({ left: dx, behavior: 'auto' });
      }

      // D) Carousel & Slider Trigger on strong slide
      if (Math.abs(dx) >= 200) {
        triggerCarouselSlide(dx > 0 ? 'right' : 'left');
      }

    } catch (err) {
      console.warn('[TV Cursor] Scroll exception:', err);
      try {
        window.scrollBy({ top: dy, left: dx || 0, behavior: 'auto' });
      } catch (_) {}
    }
  }

  function handleTouchpadAction(action) {
    showTvCursor();
    if (action === 'back') {
      const activeModal = document.querySelector('.modal-overlay, #liveOtaOverlay, .overlay:not(.hidden)');
      if (activeModal) {
        activeModal.remove();
        return;
      }
      if (window.history && window.history.length > 1) {
        window.history.back();
      }
    } else if (action === 'home') {
      if (typeof window.navigateToModule === 'function') {
        window.navigateToModule('dashboard');
      }
    } else if (action === 'slide_left' || action === 'left' || action === 'prev') {
      scrollVirtualTv(-300, 0);
    } else if (action === 'slide_right' || action === 'right' || action === 'next') {
      scrollVirtualTv(300, 0);
    } else if (action === 'slide_up' || action === 'up') {
      scrollVirtualTv(0, -250);
    } else if (action === 'slide_down' || action === 'down') {
      scrollVirtualTv(0, 250);
    }
  }

  function applyTvRemoteInput(text, submit) {
    const input = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      ? document.activeElement
      : document.querySelector('input:focus, input[type="text"], input[type="search"]');

    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (submit) {
        if (input.form) {
          input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        input.blur();
      }
    }
  }

  function applyTvRemoteKey(key) {
    const input = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      ? document.activeElement
      : document.querySelector('input:focus, input[type="text"]');
    if (!input) return;

    if (key === 'Backspace') {
      input.value = input.value.slice(0, -1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (key === 'Space') {
      input.value += ' ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (key === 'Enter') {
      applyTvRemoteInput(input.value, true);
    }
  }

  // Fast Wire Protocol Parser for Zero-Latency Direct LAN DataChannel (<2ms)
  function handleFastWirePacket(raw) {
    if (typeof raw !== 'string') return;
    const c = raw.charAt(0);
    if (c === 'm') {
      const spaceIdx = raw.indexOf(' ', 2);
      const dx = parseFloat(raw.slice(2, spaceIdx)) || 0;
      const dy = parseFloat(raw.slice(spaceIdx + 1)) || 0;
      moveVirtualTvCursor(dx, dy);
    } else if (c === 'c') {
      clickVirtualTvCursor();
    } else if (c === 's') {
      const spaceIdx = raw.indexOf(' ', 2);
      const dx = parseFloat(raw.slice(2, spaceIdx)) || 0;
      const dy = parseFloat(raw.slice(spaceIdx + 1)) || 0;
      scrollVirtualTv(dx, dy);
    } else if (c === 'a') {
      handleTouchpadAction(raw.slice(2));
    } else if (c === 'k') {
      const parts = raw.split(' ');
      const subCmd = parts[1];
      const val = decodeURIComponent(parts.slice(2).join(' '));
      if (subCmd === 'txt') {
        applyTvRemoteInput(val, false);
      } else if (subCmd === 'sub') {
        applyTvRemoteInput(val, true);
      }
    }
  }

  // ============================================================
  // Communication Channel 1: Cloudflare WebSocket
  // ============================================================
  let remoteWs = null;
  function connectRemoteWebSocket() {
    try {
      remoteWs = new WebSocket('wss://jarvis-tv.pages.dev/ws');
      window.remoteWs = remoteWs;
      remoteWs.onopen = function() {
        console.log('[TV Cursor] Connected to Cloudflare WebSocket (wss://jarvis-tv.pages.dev/ws)');
      };
      remoteWs.onmessage = function(event) {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'touchpad_move') {
            moveVirtualTvCursor(msg.dx, msg.dy);
          } else if (msg.type === 'touchpad_click') {
            clickVirtualTvCursor();
          } else if (msg.type === 'touchpad_scroll') {
            scrollVirtualTv(msg.dx, msg.dy);
          } else if (msg.type === 'touchpad_action') {
            handleTouchpadAction(msg.action);
          } else if (msg.type === 'touchpad_text') {
            applyTvRemoteInput(msg.text || '', msg.submit);
          } else if (msg.type === 'touchpad_key') {
            applyTvRemoteKey(msg.key);
          } else if (msg.type === 'logout_session') {
            localStorage.removeItem('token');
            localStorage.removeItem('tps_user');
            sessionStorage.removeItem('tps_user');
            if (typeof window.logout === 'function') {
              window.logout();
            } else {
              window.location.reload();
            }
          } else if (msg.type === 'sync_session' || msg.type === 'auth_session') {
            if (msg.token) localStorage.setItem('token', msg.token);
            if (msg.user) {
              localStorage.setItem('tps_user', JSON.stringify(msg.user));
              if (typeof window.applyAuthUI === 'function') window.applyAuthUI(msg.user);
            }
            console.log('[TV Cursor] Synced session via WebSocket:', msg.user?.fullName);
          } else if (msg.type === 'navigate' && msg.url) {
            window.location.href = msg.url;
          } else if (msg.type === 'voice_command') {
            handleTvVoiceCommand(msg.command || (msg.data && msg.data.command));
          }
        } catch (_) {}
      };
      remoteWs.onclose = function() {
        setTimeout(connectRemoteWebSocket, 3000);
      };
    } catch (err) {
      console.warn('[TV Cursor] WebSocket init error:', err);
    }
  }

  // ============================================================
  // Communication Channel 2: HiveMQ MQTT Topic (<15ms)
  // ============================================================
  let tvMqttClient = null;
  let tvRtcPeer = null;
  let tvRtcDataChannel = null;

  async function handleP2pOffer(offerSdp, senderPhoneId) {
    try {
      if (tvRtcPeer) {
        try { tvRtcPeer.close(); } catch(_) {}
      }
      tvRtcPeer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      tvRtcPeer.ondatachannel = function(evt) {
        tvRtcDataChannel = evt.channel;
        tvRtcDataChannel.onopen = function() {
          console.log('[TV Cursor] ⚡ WebRTC P2P DataChannel OPEN! Direct LAN UDP active (<2ms)');
        };
        tvRtcDataChannel.onmessage = function(e) {
          handleFastWirePacket(e.data);
        };
      };

      tvRtcPeer.onicecandidate = function(evt) {
        if (evt.candidate && tvMqttClient) {
          try {
            const iceMsg = new Paho.MQTT.Message(JSON.stringify({
              type: 'p2p_ice',
              target: senderPhoneId,
              candidate: evt.candidate
            }));
            iceMsg.destinationName = 'tps/school/tv_touchpad_85511';
            iceMsg.qos = 0;
            tvMqttClient.send(iceMsg);
          } catch(_) {}
        }
      };

      await tvRtcPeer.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
      const answer = await tvRtcPeer.createAnswer();
      await tvRtcPeer.setLocalDescription(answer);

      if (tvMqttClient) {
        const ansMsg = new Paho.MQTT.Message(JSON.stringify({
          type: 'p2p_answer',
          target: senderPhoneId,
          sdp: answer.sdp
        }));
        ansMsg.destinationName = 'tps/school/tv_touchpad_85511';
        ansMsg.qos = 0;
        tvMqttClient.send(ansMsg);
      }
    } catch (err) {
      console.warn('[TV Cursor] P2P Offer handling error:', err);
    }
  }

  function connectTvMqtt() {
    try {
      if (typeof Paho === 'undefined' || !Paho.MQTT) {
        setTimeout(connectTvMqtt, 600);
        return;
      }
      const clientId = 'tps_portal_rx_' + Math.random().toString(36).slice(2, 9);
      tvMqttClient = new Paho.MQTT.Client('broker.hivemq.com', 8884, '/mqtt', clientId);
      window.tvMqttClient = tvMqttClient;
      tvMqttClient.onConnectionLost = function(resp) {
        console.warn('[TV Cursor] MQTT Connection lost:', resp.errorMessage);
        setTimeout(connectTvMqtt, 2000);
      };

      tvMqttClient.onMessageArrived = function(msg) {
        try {
          const data = JSON.parse(msg.payloadString);
          if (data.type === 'p2p_offer' && data.sdp) {
            handleP2pOffer(data.sdp, data.phoneId);
          } else if (data.type === 'p2p_ice' && data.candidate && tvRtcPeer) {
            tvRtcPeer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
          } else if (data.type === 'touchpad_move') {
            moveVirtualTvCursor(data.dx, data.dy);
          } else if (data.type === 'touchpad_click') {
            clickVirtualTvCursor();
          } else if (data.type === 'touchpad_scroll') {
            scrollVirtualTv(data.dx, data.dy);
          } else if (data.type === 'touchpad_action') {
            handleTouchpadAction(data.action);
          } else if (data.type === 'touchpad_text') {
            applyTvRemoteInput(data.text || '', data.submit);
          } else if (data.type === 'touchpad_key') {
            applyTvRemoteKey(data.key);
          } else if (data.type === 'sync_session' || data.type === 'auth_session') {
            if (data.token) localStorage.setItem('token', data.token);
            if (data.user) {
              localStorage.setItem('tps_user', JSON.stringify(data.user));
              if (typeof window.applyAuthUI === 'function') window.applyAuthUI(data.user);
            }
            console.log('[TV Cursor] Synced session via MQTT:', data.user?.fullName);
          } else if (data.type === 'navigate' && data.url) {
            window.location.href = data.url;
          } else if (data.type === 'voice_command' && data.command) {
            handleTvVoiceCommand(data.command);
          }
        } catch (_) {}
      };

      tvMqttClient.connect({
        useSSL: true,
        timeout: 8,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: function() {
          console.log('[TV Cursor] ✅ Connected to HiveMQ MQTT Broker (topic: tps/school/tv_touchpad_85511)');
          tvMqttClient.subscribe('tps/school/tv_touchpad_85511', { qos: 0 });
        },
        onFailure: function(err) {
          console.warn('[TV Cursor] MQTT connection failure:', err);
          setTimeout(connectTvMqtt, 3000);
        }
      });
    } catch (err) {
      console.warn('[TV Cursor] MQTT init exception:', err);
      setTimeout(connectTvMqtt, 3000);
    }
  }

  // Global TV Remote Command & Voice Query Router
  function handleTvVoiceCommand(rawCmd) {
    if (!rawCmd || !rawCmd.trim()) return;
    var c = rawCmd.trim();
    console.log('[TV Portal] Processing remote command:', c);

    if (c.startsWith('javascript:')) {
      try { eval(c.substring(11)); } catch(e) { console.warn('Remote JS eval err:', e); }
      return;
    }

    if (c === '__RELOAD__' || c.toLowerCase() === 'reload') {
      window.location.reload();
      return;
    }

    if (c === '__ASSISTANT__' || c.toLowerCase() === 'open assistant' || c.toLowerCase() === 'jarvis' || c.toLowerCase() === 'tps assistant') {
      window.location.href = 'https://jarvis-tv.pages.dev';
      return;
    }

    if (c === '__PORTAL__' || c.toLowerCase() === 'open portal' || c.toLowerCase() === 'school portal') {
      if (typeof window.navigateToModule === 'function') window.navigateToModule('dashboard');
      return;
    }

    if (c === '__LAUNCH__' || c.toLowerCase() === 'launch' || c.toLowerCase() === 'open tv') {
      return;
    }

    if (c.startsWith('http://') || c.startsWith('https://')) {
      window.location.href = c;
      return;
    }

    // Portal Module Navigation routing
    var low = c.toLowerCase();
    if (low.includes('fee') || low.includes('collection') || low.includes('slip') || low.includes('receipt')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('fees'); return; }
    } else if (low.includes('due') || low.includes('pending fee') || low.includes('unpaid')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('dues'); return; }
    } else if (low.includes('attendance') || low.includes('present') || low.includes('absent')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('attendance'); return; }
    } else if (low.includes('student') || low.includes('admission') || low.includes('roster')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('students'); return; }
    } else if (low.includes('teacher') || low.includes('faculty') || low.includes('staff')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('teachers'); return; }
    } else if (low.includes('timetable') || low.includes('routine') || low.includes('period')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('timetable'); return; }
    } else if (low.includes('exam') || low.includes('marks') || low.includes('report card') || low.includes('paper')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('exams'); return; }
    } else if (low.includes('dashboard') || low.includes('home') || low.includes('overview')) {
      if (typeof window.navigateToModule === 'function') { window.navigateToModule('dashboard'); return; }
    }

    // Seamlessly transition to TPS Assistant with pre-filled query for instant AI voice answer on TV
    window.location.href = 'https://jarvis-tv.pages.dev?q=' + encodeURIComponent(c);
  }

  window.handleQuery = handleTvVoiceCommand;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureCursorDOM();
      connectRemoteWebSocket();
      connectTvMqtt();
    });
  } else {
    ensureCursorDOM();
    connectRemoteWebSocket();
    connectTvMqtt();
  }

  // Expose test handles globally
  window.moveVirtualTvCursor = moveVirtualTvCursor;
  window.clickVirtualTvCursor = clickVirtualTvCursor;
  window.scrollVirtualTv = scrollVirtualTv;
  console.log('[TV Cursor] Cybernetic Virtual Cursor & Touchpad Pointer Engine initialized');
})();
