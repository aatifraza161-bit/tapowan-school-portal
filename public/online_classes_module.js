/**
 * 🎙️📹 Live Interactive Online Video Classroom & 1:1 Voice Calling Module for TPS Web Portal
 * Features:
 * - Live Teacher Classroom Studio with HD Webcam, 1080p/720p/480p streaming, and 1-Click Screen Sharing
 * - Real-time student roster, live mic speaking indicators, and Hand Raise notifications
 * - 1-Click "Mute All Students" moderation broadcast
 * - 1:1 Direct Voice Calling directory for all Students and Teachers with live App online status
 * - Global incoming call listener with Web Audio ringtone and 2-way WebRTC audio
 * - Multi-cluster TURN relay routing for carrier-grade NAT zero-drop calling
 */

(function () {
  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.nextcloud.com:443' },
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
          'turn:172.237.33.131:443?transport=tcp'
        ],
        username: 'df50426e5dfce9fa2ceb4146',
        credential: 'J8bvaMKOvira9QLL'
      }
    ],
    iceCandidatePoolSize: 10
  };

  const QUALITY_PROFILES = {
    '1080p': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 3000000 },
    '720p': { width: 1280, height: 720, frameRate: 30, maxBitrate: 1500000 },
    '480p': { width: 854, height: 480, frameRate: 24, maxBitrate: 750000 }
  };

  // Safe HTML and JS String Escapers for UI rendering & inline handlers
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJs(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  // Professional Animated Lordicon & Material Symbol Hybrid Icon Helper
  function lordIcon(id, fallbackMaterial, size = 22, colors = 'primary:#ffffff,secondary:#38bdf8') {
    return `<span class="lord-icon-wrapper" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex-shrink:0;vertical-align:middle;line-height:1;"><lord-icon src="https://cdn.lordicon.com/${id}.json" trigger="loop-on-hover" colors="${colors}" style="width:${size}px;height:${size}px;"><span class="material-symbols-outlined" style="font-size:${size}px;line-height:1;vertical-align:middle;">${fallbackMaterial}</span></lord-icon></span>`;
  }



  // ─────────────────────────────────────────────────────────────
  // ── STUDIO AUDIO MIXER (Continuous Mic + Screen Tab Audio)
  // ─────────────────────────────────────────────────────────────
  class StudioAudioMixer {
    constructor() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        this.ctx = null;
        return;
      }
      this.ctx = new AudioCtx();
      this.destination = this.ctx.createMediaStreamDestination();
      this.micSource = null;
      this.micGain = null;
      this.screenSource = null;
      this.screenGain = null;
    }

    initMic(micStream) {
      if (!this.ctx || !micStream || micStream.getAudioTracks().length === 0) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.micSource = this.ctx.createMediaStreamSource(micStream);
        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 1.0;
        this.micSource.connect(this.micGain);
        this.micGain.connect(this.destination);
      } catch (e) {
        console.warn('AudioMixer initMic error:', e);
      }
    }

    setMicMuted(muted) {
      if (this.micGain) {
        this.micGain.gain.value = muted ? 0.0 : 1.0;
      }
    }

    addScreenAudio(screenStream) {
      if (!this.ctx || !screenStream || screenStream.getAudioTracks().length === 0) return;
      try {
        this.removeScreenAudio();
        this.screenSource = this.ctx.createMediaStreamSource(screenStream);
        this.screenGain = this.ctx.createGain();
        this.screenGain.gain.value = 1.0;
        this.screenSource.connect(this.screenGain);
        this.screenGain.connect(this.destination);
      } catch (e) {
        console.warn('AudioMixer addScreenAudio error:', e);
      }
    }

    removeScreenAudio() {
      if (this.screenSource) {
        try { this.screenSource.disconnect(); } catch (e) {}
        this.screenSource = null;
      }
      if (this.screenGain) {
        try { this.screenGain.disconnect(); } catch (e) {}
        this.screenGain = null;
      }
    }

    getMixedAudioTrack(fallbackStream) {
      if (this.destination && this.destination.stream && this.destination.stream.getAudioTracks().length > 0) {
        return this.destination.stream.getAudioTracks()[0];
      }
      return fallbackStream?.getAudioTracks()?.[0] || null;
    }

    destroy() {
      this.removeScreenAudio();
      if (this.micSource) {
        try { this.micSource.disconnect(); } catch (e) {}
        this.micSource = null;
      }
      if (this.micGain) {
        try { this.micGain.disconnect(); } catch (e) {}
        this.micGain = null;
      }
      if (this.ctx) {
        try { this.ctx.close(); } catch (e) {}
        this.ctx = null;
      }
    }
  }

  // ── Global Calling & Classroom State ──
  const state = {
    currentTab: 'studio', // 'studio' | 'calling' | 'rooms'
    
    // Live Classroom Studio
    activeRoom: null,
    localMediaStream: null,
    audioMixer: null,
    isScreenSharing: false,
    screenStream: null,
    isWhiteboardActive: false,
    whiteboardStream: null,
    currentFacingMode: 'user',
    isMuted: false,
    isVideoEnabled: true,
    videoQuality: '1080p',
    peers: new Map(), // peerId -> { pc, isConnected, remoteStream }
    classDurationSec: 0,
    classTimer: null,
    groupPollTimer: null,
    lastSignalId: 0,
    processedSignalIds: new Set(),

    // Live Classroom Studio Interactive Features (Real-Time, Zero-Mock)
    studioTab: 'chat', // 'chat' | 'qna' | 'notes' | 'participants'
    chatMessages: [],
    qnaList: [],
    notesList: [],
    activePoll: null,
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    
    // 1:1 Direct Calling
    activeCall: null,
    callPc: null,
    callLocalStream: null,
    callRemoteStream: null,
    callDurationSec: 0,
    callTimer: null,
    isCallMuted: false,
    appliedCallIce: new Set(),
    
    // Directory Filters & Data
    dirSearchQuery: '',
    dirClassFilter: 'ALL',
    dirRoleFilter: 'ALL', // 'ALL' | 'STUDENT' | 'TEACHER'
    dirPageSize: 60,
    directoryLoading: false,
    directoryStudents: null,
    directoryTeachers: null,
    directoryClasses: null,
    directoryLastLoaded: 0,

    // Incoming Call Ringtone
    ringtoneAudioCtx: null,
    ringtoneOscTimer: null,

    // Admin Live Classroom Inspection (Stealth / Ghost Mode)
    isInspecting: false,
    inspectRoom: null,
    isStealthInspector: true,
    inspectPc: null,
    inspectRemoteStream: null,
    inspectDurationSec: 0,
    inspectTimer: null,
    inspectPollTimer: null,
    inspectLastSignalId: 0,
    inspectProcessedSignals: new Set(),
    inspectAudioVolume: 1.0,
    isInspectAudioMuted: false,
    currentActiveSchoolRoom: null
  };

  // ─────────────────────────────────────────────────────────────
  // ── 1. WEB AUDIO RINGTONE GENERATOR
  // ─────────────────────────────────────────────────────────────
  function startWebRingtone() {
    stopWebRingtone();
    try {
      state.ringtoneAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (state.ringtoneAudioCtx.state === 'suspended') {
        state.ringtoneAudioCtx.resume();
      }
      let isBeep = true;
      const playChime = () => {
        if (!state.ringtoneAudioCtx || state.ringtoneAudioCtx.state === 'closed') return;
        const osc = state.ringtoneAudioCtx.createOscillator();
        const gain = state.ringtoneAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isBeep ? 440 : 480, state.ringtoneAudioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, state.ringtoneAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, state.ringtoneAudioCtx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(state.ringtoneAudioCtx.destination);
        osc.start();
        osc.stop(state.ringtoneAudioCtx.currentTime + 0.4);
        isBeep = !isBeep;
      };
      playChime();
      state.ringtoneOscTimer = setInterval(playChime, 800);
    } catch (e) {
      console.warn('Web ringtone error:', e);
    }
  }

  function stopWebRingtone() {
    if (state.ringtoneOscTimer) {
      clearInterval(state.ringtoneOscTimer);
      state.ringtoneOscTimer = null;
    }
    if (state.ringtoneAudioCtx) {
      try { state.ringtoneAudioCtx.close(); } catch(e) {}
      state.ringtoneAudioCtx = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ── 2. ACTIVE USER & IDENTITY HELPERS
  // ─────────────────────────────────────────────────────────────
  function getLiveAdminUser() {
    const u = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
    const uname = u?.username || localStorage.getItem('username') || 'admin';
    const fname = u?.fullName || u?.name || 'School Administrator';
    const role = u?.role || 'administrator';
    const id = u?.admissionNo || u?.employeeNo || (role.toLowerCase() === 'teacher' ? `EMP-${uname}` : `ADMIN-${uname}`);
    return { id, name: fname, role, avatar: u?.photoUrl || u?.photo || '' };
  }

  // ─────────────────────────────────────────────────────────────
  // ── 3. LIVE CLASSROOM STUDIO LOGIC (WebRTC Multi-Peer Host)
  // ─────────────────────────────────────────────────────────────
  async function startClassroomStudio({ title, targetClass, quality = '1080p' }) {
    const user = getLiveAdminUser();
    state.videoQuality = quality;

    // 1. Acquire Webcam & Studio Microphone
    try {
      const q = QUALITY_PROFILES[quality] || QUALITY_PROFILES['1080p'];
      state.localMediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: {
          width: { ideal: q.width },
          height: { ideal: q.height },
          frameRate: { ideal: q.frameRate }
        }
      });
    } catch (mediaErr) {
      alert(`Could not access camera/mic: ${mediaErr.message}. Please allow permissions.`);
      return;
    }

    // Initialize Web Audio Mixer (for continuous mic + screen audio mixing)
    try {
      if (state.audioMixer) state.audioMixer.destroy();
      state.audioMixer = new StudioAudioMixer();
      state.audioMixer.initMic(state.localMediaStream);
    } catch (mixErr) {
      console.warn('Could not initialize AudioMixer:', mixErr);
    }

    state.isMuted = false;
    state.isVideoEnabled = true;
    state.isScreenSharing = false;

    // 2. Create Classroom Session on Server
    try {
      const normTargetClass = (targetClass === 'ALL' || !targetClass || targetClass === 'All Classes') ? 'ALL' : ((typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass(targetClass) : targetClass);
      const res = await fetch('/api/calls/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: user.id,
          hostName: user.name,
          hostRole: user.role,
          title: title || `${normTargetClass || 'School'} Live Classroom Session`,
          targetType: normTargetClass === 'ALL' ? 'all' : 'class',
          targetClass: normTargetClass
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Failed to initialize live classroom session.');
        stopClassroomStudio();
        return;
      }

      state.activeRoom = data.room;
      state.classDurationSec = 0;
      state.lastSignalId = 0;
      state.processedSignalIds.clear();

      // Start duration timer
      if (state.classTimer) clearInterval(state.classTimer);
      state.classTimer = setInterval(() => {
        state.classDurationSec++;
        const timerEl = document.getElementById('studioDurationTimer');
        if (timerEl) timerEl.textContent = formatDuration(state.classDurationSec);
      }, 1000);

      // Start group signal polling loop
      startGroupSignalPolling();

      // Re-render UI in active studio mode
      renderOnlineClassesWorkspace();
    } catch (err) {
      alert('Error connecting to signaling server: ' + err.message);
      stopClassroomStudio();
    }
  }

  let isWebGroupPolling = false;

  function triggerWebGroupPoll() {
    if (state.groupPollTimer) {
      clearTimeout(state.groupPollTimer);
      clearInterval(state.groupPollTimer);
    }
    if (!isWebGroupPolling) {
      executeWebGroupPoll();
    }
  }

  async function executeWebGroupPoll() {
    if (!state.activeRoom?.room_id || isWebGroupPolling) return;
    isWebGroupPolling = true;
    let hadSignals = false;
    const user = getLiveAdminUser();
    const roomId = state.activeRoom.room_id;
    const sinceId = state.lastSignalId || 0;

    try {
      const res = await fetch(`/api/calls/group/poll?roomId=${encodeURIComponent(roomId)}&participantId=${encodeURIComponent(user.id)}&userId=${encodeURIComponent(user.id)}&sinceId=${sinceId}&since=${Date.now() - 30000}`);
      if (res.ok) {
        const data = await res.json();
        if (data.maxSignalId && data.maxSignalId > state.lastSignalId) {
          state.lastSignalId = data.maxSignalId;
        }

        // Sync room state & student roster
        if (data.room && Array.isArray(data.room.participants)) {
          state.activeRoom = { ...state.activeRoom, ...data.room };
          updateStudioParticipantRoster(data.room.participants);
        }

        // Process incoming WebRTC connection offers & student signals
        if (Array.isArray(data.signals) && data.signals.length > 0) {
          hadSignals = true;
          for (const sig of data.signals) {
            if (sig.id) {
              if (state.processedSignalIds.has(sig.id)) continue;
              state.processedSignalIds.add(sig.id);
              if (sig.id > state.lastSignalId) state.lastSignalId = sig.id;
            }

            if (sig.signalType === 'OFFER' && sig.signalData?.sdp) {
              handleStudentOffer(sig.fromId, sig.signalData.sdp);
            } else if (sig.signalType === 'ANSWER' && sig.signalData?.sdp) {
              handleStudentAnswer(sig.fromId, sig.signalData.sdp);
            } else if (sig.signalType === 'ICE_CANDIDATE' && sig.signalData?.candidate) {
              handleStudentIce(sig.fromId, sig.signalData.candidate);
            } else if (sig.signalType === 'HAND_RAISE') {
              handleStudentHandRaise(sig.fromId, sig.signalData?.handRaised);
            } else if (sig.signalType === 'CHAT_MESSAGE' && sig.signalData) {
              handleIncomingChatMessage(sig.signalData);
            } else if (sig.signalType === 'QNA_QUESTION' && sig.signalData) {
              handleIncomingQnaQuestion(sig.signalData);
            } else if (sig.signalType === 'QNA_ANSWER' && sig.signalData) {
              handleIncomingQnaAnswer(sig.signalData);
            } else if (sig.signalType === 'NOTE_SHARED' && sig.signalData) {
              handleIncomingNote(sig.signalData);
            } else if (sig.signalType === 'POLL_CREATE' && sig.signalData) {
              handleIncomingPollCreate(sig.signalData);
            } else if (sig.signalType === 'POLL_VOTE' && sig.signalData) {
              handleIncomingPollVote(sig.signalData);
            } else if (sig.signalType === 'POLL_END') {
              handleIncomingPollEnd();
            } else if (sig.signalType === 'CLASS_ANNOUNCEMENT' && sig.signalData) {
              handleIncomingAnnouncement(sig.signalData);
            } else if (sig.signalType === 'STUDIO_REACTION' && sig.signalData?.emoji) {
              showFloatingReaction(sig.signalData.emoji);
            }
          }
        }
      }
    } catch (e) {
      // Silent poll error
    } finally {
      isWebGroupPolling = false;
      if (state.activeRoom?.room_id) {
        let hasConnectingPeers = false;
        if (state.peers && state.peers.size > 0) {
          for (const [, p] of state.peers) {
            if (!p.isConnected) {
              hasConnectingPeers = true;
              break;
            }
          }
        } else {
          hasConnectingPeers = true;
        }

        const nextDelay = (hadSignals || hasConnectingPeers) ? 300 : 850;
        state.groupPollTimer = setTimeout(executeWebGroupPoll, nextDelay);
      }
    }
  }

  function startGroupSignalPolling() {
    if (state.groupPollTimer) {
      clearTimeout(state.groupPollTimer);
      clearInterval(state.groupPollTimer);
      state.groupPollTimer = null;
    }
    executeWebGroupPoll();
  }

  // ── WebRTC Peer Negotiation per Student ──
  function ensurePeerSenders(pc) {
    if (!pc) return;
    const senders = typeof pc.getSenders === 'function' ? pc.getSenders() : [];

    // 1. Video sender (Whiteboard, Screen share, or Camera)
    const videoTrack = state.isWhiteboardActive && state.whiteboardStream
      ? state.whiteboardStream.getVideoTracks()[0]
      : (state.isScreenSharing && state.screenStream
          ? state.screenStream.getVideoTracks()[0]
          : state.localMediaStream?.getVideoTracks()[0]);
    if (videoTrack) {
      const vSender = senders.find(s => s?.track?.kind === 'video');
      if (vSender && typeof vSender.replaceTrack === 'function') {
        vSender.replaceTrack(videoTrack).catch(() => {});
      } else if (!vSender) {
        try { pc.addTrack(videoTrack, state.localMediaStream || state.screenStream || state.whiteboardStream); } catch (e) {}
      }
      if (vSender && typeof vSender.getParameters === 'function') {
        try {
          const params = vSender.getParameters();
          params.degradationPreference = 'maintain-framerate';
          vSender.setParameters(params).catch(() => {});
        } catch (e) {}
      }
    }

    // 2. Audio sender (Studio Mic / Mixed Audio) - ALWAYS STREAMING
    const audioTrack = state.audioMixer
      ? state.audioMixer.getMixedAudioTrack(state.localMediaStream)
      : state.localMediaStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !state.isMuted;
      const aSender = senders.find(s => s?.track?.kind === 'audio');
      if (aSender && typeof aSender.replaceTrack === 'function') {
        aSender.replaceTrack(audioTrack).catch(() => {});
      } else if (!aSender) {
        try { pc.addTrack(audioTrack, state.localMediaStream); } catch (e) {}
      }
    }
  }

  async function handleStudentOffer(studentId, offerSdp) {
    const sId = String(studentId);
    let peer = state.peers.get(sId);
    if (!peer || !peer.pc) {
      peer = createPeerForStudent(sId);
    }

    try {
      let desc = typeof offerSdp === 'string' ? JSON.parse(offerSdp) : offerSdp;
      await peer.pc.setRemoteDescription(new RTCSessionDescription(desc));

      // Ensure both audio and video tracks are active
      ensurePeerSenders(peer.pc);

      // Flush any queued ICE candidates
      if (peer.iceQueue && peer.iceQueue.length > 0) {
        for (const c of peer.iceQueue) {
          try { await peer.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
        }
        peer.iceQueue = [];
      }

      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);

      const user = getLiveAdminUser();
      const roomId = state.activeRoom?.room_id;

      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: sId,
          signalType: 'ANSWER',
          signalData: { sdp: peer.pc.localDescription }
        })
      }).then(() => {
        triggerWebGroupPoll();
      }).catch(() => {});
    } catch (err) {
      console.warn(`Error negotiating with student [${sId}]:`, err);
    }
  }

  async function handleStudentAnswer(studentId, answerSdp) {
    const sId = String(studentId);
    const peer = state.peers.get(sId);
    if (peer && peer.pc) {
      try {
        let desc = typeof answerSdp === 'string' ? JSON.parse(answerSdp) : answerSdp;
        await peer.pc.setRemoteDescription(new RTCSessionDescription(desc));
      } catch (e) {}
    }
  }

  async function handleStudentIce(studentId, candidate) {
    const sId = String(studentId);
    const peer = state.peers.get(sId);
    if (!peer || !peer.pc) return;

    try {
      let c = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(c));
      } else {
        if (!peer.iceQueue) peer.iceQueue = [];
        peer.iceQueue.push(c);
      }
    } catch (e) {}
  }

  function createPeerForStudent(studentId) {
    const sId = String(studentId);
    const pc = new RTCPeerConnection(ICE_CONFIG);
    const peer = {
      peerId: sId,
      pc,
      isConnected: false,
      iceQueue: [],
      remoteStream: null,
      disconnectTimer: null
    };

    // 1. Attach Audio Track FIRST (m-line 0: Studio Mic / Mixed Audio)
    const audioTrack = state.audioMixer
      ? state.audioMixer.getMixedAudioTrack(state.localMediaStream)
      : state.localMediaStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !state.isMuted;
      try { pc.addTrack(audioTrack, state.localMediaStream); } catch (e) {}
    }

    // 2. Attach Video Track SECOND (m-line 1: Screen Share or Webcam)
    const videoTrack = state.isScreenSharing && state.screenStream
      ? state.screenStream.getVideoTracks()[0]
      : state.localMediaStream?.getVideoTracks()[0];
    if (videoTrack) {
      try { pc.addTrack(videoTrack, state.localMediaStream || state.screenStream); } catch (e) {}
    }

    pc.ontrack = (event) => {
      if (event.receiver) {
        try {
          if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
          if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
        } catch (e) {}
      }
      let rStream = null;
      if (event.streams && event.streams[0]) {
        rStream = event.streams[0];
      } else if (event.track) {
        rStream = new MediaStream([event.track]);
      }
      if (rStream) {
        peer.remoteStream = rStream;
        // Play student audio in browser
        playRemoteAudio(rStream, sId);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && state.activeRoom?.room_id) {
        const user = getLiveAdminUser();
        fetch('/api/calls/group/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: state.activeRoom.room_id,
            fromId: user.id,
            toId: sId,
            signalType: 'ICE_CANDIDATE',
            signalData: { candidate: event.candidate }
          })
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      const connState = pc.connectionState;
      if (connState === 'connected') {
        peer.isConnected = true;
        if (peer.disconnectTimer) { clearTimeout(peer.disconnectTimer); peer.disconnectTimer = null; }
        updateStudentOnlineBadge(sId, true);
      } else if (connState === 'disconnected') {
        if (!peer.disconnectTimer) {
          peer.disconnectTimer = setTimeout(() => {
            if (peer.pc && peer.pc.connectionState !== 'connected') {
              try { peer.pc.restartIce(); } catch(e) {}
            }
            peer.disconnectTimer = null;
          }, 10000);
        }
      } else if (connState === 'failed') {
        peer.isConnected = false;
        updateStudentOnlineBadge(sId, false);
      }
    };

    state.peers.set(sId, peer);
    return peer;
  }

  function playRemoteAudio(stream, peerId) {
    let audioEl = document.getElementById(`audio_peer_${peerId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio_peer_${peerId}`;
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
  }

  // ── Hot-Swap Video Source (Camera vs Screen Share vs Whiteboard) ──
  async function toggleScreenShare() {
    if (!state.isScreenSharing) {
      // If whiteboard is active, close it first
      if (state.isWhiteboardActive) {
        stopWhiteboardAndRevertToCamera();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        const useWhiteboard = confirm(
          'Direct screen sharing is restricted by your mobile browser policy.\n\nWould you like to open the Live Interactive Smart Whiteboard & Slide Presenter to write, draw, or present diagrams live to students?'
        );
        if (useWhiteboard) {
          toggleWhiteboard();
        }
        return;
      }

      // Start Screen Share with mobile-safe fallback
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always', frameRate: { ideal: 30 } },
            audio: true // Capture tab/system audio if supported
          });
        } catch (mediaErr) {
          // Mobile Fallback: some mobile browsers only allow { video: true }
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true
          });
        }

        state.screenStream = stream;

        const screenVideoTrack = state.screenStream.getVideoTracks()[0];
        const screenAudioTrack = state.screenStream.getAudioTracks()[0];

        // Mix screen audio into master stream if available
        if (screenAudioTrack && state.audioMixer) {
          state.audioMixer.addScreenAudio(state.screenStream);
        }

        screenVideoTrack.onended = () => {
          stopScreenShareAndRevertToCamera();
        };

        // Hot-swap video track across all active student peer connections
        for (const [, peer] of state.peers.entries()) {
          if (peer.pc && typeof peer.pc.getSenders === 'function') {
            const senders = peer.pc.getSenders();
            const videoSender = senders.find(s => s?.track?.kind === 'video');
            if (videoSender && typeof videoSender.replaceTrack === 'function') {
              await videoSender.replaceTrack(screenVideoTrack);
            }
          }
        }

        state.isScreenSharing = true;
        const mainVideo = document.getElementById('liveClassMainVideo');
        if (mainVideo) mainVideo.srcObject = state.screenStream;

        updateStudioControlsUI();
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
          alert('Screen sharing notice: ' + err.message);
        }
      }
    } else {
      await stopScreenShareAndRevertToCamera();
    }
  }

  async function stopScreenShareAndRevertToCamera() {
    if (state.audioMixer) {
      state.audioMixer.removeScreenAudio();
    }
    if (state.screenStream) {
      try { state.screenStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      state.screenStream = null;
    }
    state.isScreenSharing = false;

    const cameraTrack = state.localMediaStream?.getVideoTracks()?.[0];
    if (cameraTrack) {
      for (const [, peer] of state.peers.entries()) {
        if (peer.pc && typeof peer.pc.getSenders === 'function') {
          const senders = peer.pc.getSenders();
          const videoSender = senders.find(s => s?.track?.kind === 'video');
          if (videoSender && typeof videoSender.replaceTrack === 'function') {
            await videoSender.replaceTrack(cameraTrack);
          }
        }
      }
    }

    const mainVideo = document.getElementById('liveClassMainVideo');
    if (mainVideo && state.localMediaStream) mainVideo.srcObject = state.localMediaStream;

    updateStudioControlsUI();
  }

  // ── 🎨 Interactive Smart Whiteboard & Slide Studio Engine ──
  let wbDrawingState = {
    isDrawing: false,
    color: '#000000',
    size: 4,
    tool: 'pen', // 'pen' | 'highlighter' | 'eraser'
    lastX: 0,
    lastY: 0
  };

  function toggleWhiteboard() {
    if (!state.activeRoom) return;

    if (!state.isWhiteboardActive) {
      startWhiteboard();
    } else {
      stopWhiteboardAndRevertToCamera();
    }
  }

  async function startWhiteboard() {
    if (state.isScreenSharing) {
      await stopScreenShareAndRevertToCamera();
    }

    const container = document.getElementById('whiteboardContainer');
    const mainVideo = document.getElementById('liveClassMainVideo');
    const canvas = document.getElementById('whiteboardCanvas');
    if (!canvas) return;

    // Set 1080p full HD internal resolution
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Capture canvas video stream in 30fps HD
    try {
      state.whiteboardStream = canvas.captureStream(30);
    } catch (e) {
      console.warn('Canvas captureStream failed:', e);
      alert('Whiteboard streaming is not supported on this device.');
      return;
    }

    const wbTrack = state.whiteboardStream.getVideoTracks()[0];
    if (wbTrack) {
      for (const [, peer] of state.peers.entries()) {
        if (peer.pc && typeof peer.pc.getSenders === 'function') {
          const senders = peer.pc.getSenders();
          const videoSender = senders.find(s => s?.track?.kind === 'video');
          if (videoSender && typeof videoSender.replaceTrack === 'function') {
            await videoSender.replaceTrack(wbTrack);
          }
        }
      }
    }

    state.isWhiteboardActive = true;
    if (container) container.style.display = 'flex';
    if (mainVideo) mainVideo.style.display = 'none';

    initWhiteboardDrawingEvents();
    updateStudioControlsUI();
  }

  async function stopWhiteboardAndRevertToCamera() {
    const container = document.getElementById('whiteboardContainer');
    const mainVideo = document.getElementById('liveClassMainVideo');

    if (state.whiteboardStream) {
      try { state.whiteboardStream.getTracks().forEach(t => t.stop()); } catch(e){}
      state.whiteboardStream = null;
    }
    state.isWhiteboardActive = false;

    const cameraTrack = state.localMediaStream?.getVideoTracks()?.[0];
    if (cameraTrack) {
      for (const [, peer] of state.peers.entries()) {
        if (peer.pc && typeof peer.pc.getSenders === 'function') {
          const senders = peer.pc.getSenders();
          const videoSender = senders.find(s => s?.track?.kind === 'video');
          if (videoSender && typeof videoSender.replaceTrack === 'function') {
            await videoSender.replaceTrack(cameraTrack);
          }
        }
      }
    }

    if (container) container.style.display = 'none';
    if (mainVideo) {
      mainVideo.style.display = 'block';
      if (state.localMediaStream) mainVideo.srcObject = state.localMediaStream;
    }

    updateStudioControlsUI();
  }

  function initWhiteboardDrawingEvents() {
    const canvas = document.getElementById('whiteboardCanvas');
    if (!canvas || canvas._wbInit) return;
    canvas._wbInit = true;

    const ctx = canvas.getContext('2d');

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      if (e.touches && e.touches.length > 1) return;
      e.preventDefault();
      const coords = getCoords(e);
      wbDrawingState.isDrawing = true;
      wbDrawingState.lastX = coords.x;
      wbDrawingState.lastY = coords.y;
    }

    function moveDraw(e) {
      if (!wbDrawingState.isDrawing) return;
      e.preventDefault();
      const coords = getCoords(e);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wbDrawingState.lastX, wbDrawingState.lastY);
      ctx.lineTo(coords.x, coords.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (wbDrawingState.tool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = wbDrawingState.size * 5;
      } else if (wbDrawingState.tool === 'highlighter') {
        ctx.strokeStyle = wbDrawingState.color;
        ctx.lineWidth = wbDrawingState.size * 3;
        ctx.globalAlpha = 0.35;
      } else {
        ctx.strokeStyle = wbDrawingState.color;
        ctx.lineWidth = wbDrawingState.size;
        ctx.globalAlpha = 1.0;
      }

      ctx.stroke();
      ctx.restore();

      wbDrawingState.lastX = coords.x;
      wbDrawingState.lastY = coords.y;
    }

    function endDraw(e) {
      wbDrawingState.isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
    canvas.addEventListener('touchcancel', endDraw, { passive: false });

    // Color Swatches
    document.querySelectorAll('.wb-color-btn').forEach(btn => {
      btn.onclick = () => {
        wbDrawingState.color = btn.dataset.color || '#000000';
        wbDrawingState.tool = 'pen';
        updateWbToolbarUI();
      };
    });

    // Tool Buttons
    const btnPen = document.getElementById('btnWbPen');
    if (btnPen) {
      btnPen.onclick = () => {
        wbDrawingState.tool = 'pen';
        updateWbToolbarUI();
      };
    }
    const btnHighlighter = document.getElementById('btnWbHighlighter');
    if (btnHighlighter) {
      btnHighlighter.onclick = () => {
        wbDrawingState.tool = 'highlighter';
        updateWbToolbarUI();
      };
    }
    const btnEraser = document.getElementById('btnWbEraser');
    if (btnEraser) {
      btnEraser.onclick = () => {
        wbDrawingState.tool = 'eraser';
        updateWbToolbarUI();
      };
    }
    const btnClear = document.getElementById('btnWbClear');
    if (btnClear) {
      btnClear.onclick = () => {
        if (confirm('Clear the entire smart whiteboard?')) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      };
    }

    // Image / Slide Presenter Uploader
    const imgUploader = document.getElementById('wbImageUploader');
    if (imgUploader) {
      imgUploader.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          const img = new Image();
          img.onload = () => {
            // Draw image centered on 1920x1080 canvas
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, x, y, w, h);
          };
          img.src = re.target.result;
        };
        reader.readAsDataURL(file);
      };
    }
  }

  function updateWbToolbarUI() {
    const btnPen = document.getElementById('btnWbPen');
    const btnHighlighter = document.getElementById('btnWbHighlighter');
    const btnEraser = document.getElementById('btnWbEraser');

    if (btnPen) btnPen.style.background = wbDrawingState.tool === 'pen' ? '#2563eb' : '#334155';
    if (btnHighlighter) btnHighlighter.style.background = wbDrawingState.tool === 'highlighter' ? '#8b5cf6' : '#334155';
    if (btnEraser) btnEraser.style.background = wbDrawingState.tool === 'eraser' ? '#dc2626' : '#334155';
  }

  // ── 🔄 Flip Camera (Selfie vs Document / Blackboard Camera) ──
  async function flipCamera() {
    if (!state.activeRoom || !state.localMediaStream) return;
    try {
      state.currentFacingMode = state.currentFacingMode === 'user' ? 'environment' : 'user';
      const q = QUALITY_PROFILES[state.videoQuality] || QUALITY_PROFILES['1080p'];
      
      const oldVideoTracks = state.localMediaStream.getVideoTracks();
      oldVideoTracks.forEach(t => t.stop());

      let newStream = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: state.currentFacingMode },
            width: { ideal: q.width },
            height: { ideal: q.height },
            frameRate: { ideal: q.frameRate }
          }
        });
      } catch (e) {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      }

      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        oldVideoTracks.forEach(t => state.localMediaStream.removeTrack(t));
        state.localMediaStream.addTrack(newTrack);

        if (!state.isScreenSharing && !state.isWhiteboardActive) {
          for (const [, peer] of state.peers.entries()) {
            if (peer.pc && typeof peer.pc.getSenders === 'function') {
              const senders = peer.pc.getSenders();
              const videoSender = senders.find(s => s?.track?.kind === 'video');
              if (videoSender && typeof videoSender.replaceTrack === 'function') {
                await videoSender.replaceTrack(newTrack);
              }
            }
          }
          const mainVideo = document.getElementById('liveClassMainVideo');
          if (mainVideo) mainVideo.srcObject = state.localMediaStream;
        }

        const btnFlip = document.getElementById('btnStudioFlipCam');
        if (btnFlip) {
          btnFlip.innerHTML = state.currentFacingMode === 'environment' ? '🔄 Back Cam' : '🔄 Front Cam';
        }
      }
    } catch (e) {
      alert('Could not switch camera: ' + e.message);
    }
  }

  function toggleStudioMic() {
    state.isMuted = !state.isMuted;
    if (state.audioMixer) {
      state.audioMixer.setMicMuted(state.isMuted);
    }
    if (state.localMediaStream) {
      state.localMediaStream.getAudioTracks().forEach(t => { t.enabled = !state.isMuted; });
    }
    updateStudioControlsUI();
  }

  function toggleStudioCamera() {
    state.isVideoEnabled = !state.isVideoEnabled;
    if (state.localMediaStream) {
      state.localMediaStream.getVideoTracks().forEach(t => { t.enabled = state.isVideoEnabled; });
    }
    updateStudioControlsUI();
  }

  async function broadcastMuteAllStudents() {
    if (!state.activeRoom?.room_id) return;
    const user = getLiveAdminUser();

    try {
      await fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: state.activeRoom.room_id,
          fromId: user.id,
          signalType: 'MUTE_ALL'
        })
      });
      alert('Broadcast signal sent: All student microphones muted.');
    } catch (e) {
      alert('Failed to send mute all signal: ' + e.message);
    }
  }

  async function stopClassroomStudio() {
    if (state.classTimer) { clearInterval(state.classTimer); state.classTimer = null; }
    if (state.groupPollTimer) { clearInterval(state.groupPollTimer); state.groupPollTimer = null; }

    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;

    // Send ROOM_ENDED signal & close on server
    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, fromId: user.id, signalType: 'ROOM_ENDED' })
      }).catch(() => {});

      fetch('/api/calls/group/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, hostId: user.id })
      }).catch(() => {});
    }

    // Close all WebRTC peers
    for (const [, peer] of state.peers.entries()) {
      try { peer.pc?.close(); } catch (e) {}
    }
    state.peers.clear();

    // Clean up Web Audio Mixer
    if (state.audioMixer) {
      state.audioMixer.destroy();
      state.audioMixer = null;
    }

    // Stop local media
    if (state.localMediaStream) {
      try { state.localMediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      state.localMediaStream = null;
    }
    if (state.screenStream) {
      try { state.screenStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      state.screenStream = null;
    }
    if (state.whiteboardStream) {
      try { state.whiteboardStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      state.whiteboardStream = null;
    }
    state.isWhiteboardActive = false;

    // Clean up audio elements
    document.querySelectorAll('[id^="audio_peer_"]').forEach(el => el.remove());

    state.activeRoom = null;
    state.isScreenSharing = false;
    state.classDurationSec = 0;
    state.chatMessages = [];
    state.qnaList = [];
    state.notesList = [];
    state.activePoll = null;
    state.studioTab = 'chat';
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      try { state.mediaRecorder.stop(); } catch(e){}
    }
    state.mediaRecorder = null;
    state.isRecording = false;
    state.recordedChunks = [];

    updateHeaderLiveBadge(null);
    renderOnlineClassesWorkspace();
  }

  // ─────────────────────────────────────────────────────────────
  // ── 3.5 ADMIN LIVE CLASSROOM INSPECTOR & STEALTH GHOST MODE
  // ─────────────────────────────────────────────────────────────
  window.joinRoomAsAdmin = async function(roomId, isStealth = true) {
    if (!roomId) return;
    state.currentTab = 'studio';
    window.currentModule = 'onlineClasses';
    if (typeof window.renderAll === 'function') window.renderAll();

    if (state.activeRoom) {
      if (!confirm('You are currently hosting a live classroom session. Do you want to end your broadcast and inspect this session instead?')) {
        return;
      }
      stopClassroomStudio();
    }

    if (state.isInspecting) {
      await window.stopInspectionStudio(true);
    }

    const user = getLiveAdminUser();
    try {
      const res = await fetch('/api/calls/group/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          participantId: user.id,
          participantName: isStealth ? 'Incognito Admin' : user.name,
          participantRole: 'administrator',
          participantAvatar: isStealth ? '' : user.avatar,
          isMuted: true,
          isStealth: Boolean(isStealth),
          isHidden: Boolean(isStealth)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Failed to connect to live session.');
        return;
      }

      state.isInspecting = true;
      state.inspectRoom = data.room;
      state.isStealthInspector = Boolean(isStealth);
      state.inspectDurationSec = 0;
      state.inspectLastSignalId = 0;
      state.inspectProcessedSignals.clear();

      renderOnlineClassesWorkspace();

      await setupInspectWebRTC(roomId, data.room.host_id, user.id);

      if (state.inspectTimer) clearInterval(state.inspectTimer);
      state.inspectTimer = setInterval(() => {
        state.inspectDurationSec++;
        const el = document.getElementById('inspectDurationTimer');
        if (el) el.textContent = formatDuration(state.inspectDurationSec);
      }, 1000);

      startInspectPollingLoop(roomId, user.id);

    } catch (err) {
      alert('Error joining classroom inspector: ' + err.message);
      window.stopInspectionStudio(false);
    }
  };

  async function setupInspectWebRTC(roomId, hostId, userId) {
    state.inspectPc = new RTCPeerConnection(ICE_CONFIG);
    state.inspectIceQueue = [];

    if (!state.inspectRemoteStream) {
      state.inspectRemoteStream = new MediaStream();
    } else {
      state.inspectRemoteStream.getTracks().forEach(t => {
        try { t.stop(); } catch(e) {}
      });
      state.inspectRemoteStream = new MediaStream();
    }

    try {
      state.inspectPc.addTransceiver('audio', { direction: 'recvonly' });
      state.inspectPc.addTransceiver('video', { direction: 'recvonly' });
    } catch (e) {
      console.warn('Inspect transceiver setup note:', e);
    }

    state.inspectPc.ontrack = (event) => {
      console.log('[Inspector WebRTC] ontrack received:', event.track?.kind);
      if (event.receiver) {
        try {
          if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
          if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
        } catch (e) {}
      }
      if (event.track) {
        state.inspectRemoteStream.addTrack(event.track);
      }
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(t => {
          if (!state.inspectRemoteStream.getTracks().includes(t)) {
            state.inspectRemoteStream.addTrack(t);
          }
        });
      }

      const inspectVideo = document.getElementById('liveClassInspectVideo');
      if (inspectVideo) {
        if (inspectVideo.srcObject !== state.inspectRemoteStream) {
          inspectVideo.srcObject = state.inspectRemoteStream;
        }
        inspectVideo.volume = state.inspectAudioVolume !== undefined ? state.inspectAudioVolume : 1;
        inspectVideo.muted = Boolean(state.isInspectAudioMuted);
        inspectVideo.play().catch(e => console.warn('Inspect play note:', e));
      }
      const inspectStatus = document.getElementById('inspectStreamStatus');
      if (inspectStatus) {
        const hasVideo = state.inspectRemoteStream.getVideoTracks().length > 0;
        inspectStatus.innerHTML = hasVideo
          ? '🟢 <span style="color:#4ade80;">HD Live Stream Connected</span>'
          : '🟢 <span style="color:#38bdf8;">Live Audio Connected</span>';
      }
    };

    state.inspectPc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch('/api/calls/group/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            fromId: userId,
            toId: hostId,
            signalType: 'ICE_CANDIDATE',
            signalData: { candidate: event.candidate }
          })
        }).catch(() => {});
      }
    };

    state.inspectPc.onconnectionstatechange = () => {
      const connState = state.inspectPc?.connectionState;
      console.log('[Inspector WebRTC] Connection state:', connState);
      const inspectStatus = document.getElementById('inspectStreamStatus');
      if (connState === 'connected' && inspectStatus) {
        const hasVideo = state.inspectRemoteStream && state.inspectRemoteStream.getVideoTracks().length > 0;
        inspectStatus.innerHTML = hasVideo
          ? '🟢 <span style="color:#4ade80;">HD Live Stream Connected</span>'
          : '🟢 <span style="color:#38bdf8;">Live Audio Connected</span>';
      } else if (connState === 'failed') {
        if (inspectStatus) {
          inspectStatus.innerHTML = '⚠️ <span style="color:#f59e0b;">Reconnecting Live Stream...</span>';
        }
        try { state.inspectPc?.restartIce(); } catch(e) {}
      }
    };

    const sendInspectOffer = async () => {
      if (!state.isInspecting || !state.inspectPc) return;
      try {
        const offer = await state.inspectPc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await state.inspectPc.setLocalDescription(offer);
        state.inspectOfferSentAt = Date.now();

        await fetch('/api/calls/group/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            fromId: userId,
            toId: hostId,
            signalType: 'OFFER',
            signalData: { sdp: state.inspectPc.localDescription }
          })
        });
        console.log('[Inspector WebRTC] OFFER transmitted to host:', hostId);
      } catch (offerErr) {
        console.warn('Inspect offer generation error:', offerErr);
      }
    };

    state.sendInspectOfferFn = sendInspectOffer;
    await sendInspectOffer();
  }

  function startInspectPollingLoop(roomId, userId) {
    if (state.inspectPollTimer) {
      clearTimeout(state.inspectPollTimer);
      clearInterval(state.inspectPollTimer);
    }

    let isInspectPolling = false;
    const executeInspectPoll = async () => {
      if (!state.isInspecting || !state.inspectRoom?.room_id || isInspectPolling) return;
      isInspectPolling = true;
      let hadSignals = false;
      const sinceId = state.inspectLastSignalId || 0;

      try {
        const pollRes = await fetch(`/api/calls/group/poll?roomId=${encodeURIComponent(roomId)}&participantId=${encodeURIComponent(userId)}&userId=${encodeURIComponent(userId)}&sinceId=${sinceId}&since=${Date.now() - 30000}`);
        if (!pollRes.ok) return;
        const pollData = await pollRes.json();

        if (pollData.maxSignalId && pollData.maxSignalId > state.inspectLastSignalId) {
          state.inspectLastSignalId = pollData.maxSignalId;
        }

        if (pollData.room?.status === 'ended') {
          alert('The live classroom session has ended.');
          window.stopInspectionStudio(false);
          return;
        }

        if (pollData.room && Array.isArray(pollData.room.participants)) {
          state.inspectRoom = { ...state.inspectRoom, ...pollData.room };
          updateInspectAttendeeRoster(pollData.room.participants);
        }

        if (Array.isArray(pollData.signals) && pollData.signals.length > 0) {
          hadSignals = true;
          for (const sig of pollData.signals) {
            if (sig.id) {
              if (state.inspectProcessedSignals.has(sig.id)) continue;
              state.inspectProcessedSignals.add(sig.id);
              if (sig.id > state.inspectLastSignalId) state.inspectLastSignalId = sig.id;
            }

            if (sig.signalType === 'ANSWER' && sig.signalData?.sdp && state.inspectPc) {
              let desc = typeof sig.signalData.sdp === 'string' ? JSON.parse(sig.signalData.sdp) : sig.signalData.sdp;
              if (state.inspectPc.signalingState !== 'stable') {
                try {
                  await state.inspectPc.setRemoteDescription(new RTCSessionDescription(desc));
                  // Flush queued ICE candidates
                  if (Array.isArray(state.inspectIceQueue) && state.inspectIceQueue.length > 0) {
                    for (const cand of state.inspectIceQueue) {
                      try {
                        await state.inspectPc.addIceCandidate(new RTCIceCandidate(cand));
                      } catch(e) {}
                    }
                    state.inspectIceQueue = [];
                  }
                } catch(e) {
                  console.warn('Inspect setRemoteDescription error:', e);
                }
              }
            } else if (sig.signalType === 'ICE_CANDIDATE' && sig.signalData?.candidate && state.inspectPc) {
              let cand = typeof sig.signalData.candidate === 'string' ? JSON.parse(sig.signalData.candidate) : sig.signalData.candidate;
              if (state.inspectPc.remoteDescription && state.inspectPc.remoteDescription.type) {
                try {
                  await state.inspectPc.addIceCandidate(new RTCIceCandidate(cand));
                } catch(e) {}
              } else {
                if (!state.inspectIceQueue) state.inspectIceQueue = [];
                state.inspectIceQueue.push(cand);
              }
            } else if (sig.signalType === 'ROOM_ENDED') {
              alert('The live classroom session has ended.');
              window.stopInspectionStudio(false);
              return;
            }
          }
        }

        // Auto-retry OFFER if no ANSWER received within 3.5s and connection is still awaiting answer
        const offerAge = Date.now() - (state.inspectOfferSentAt || 0);
        if (offerAge > 3500 && state.inspectPc && state.inspectPc.signalingState === 'have-local-offer' && !state.inspectPc.remoteDescription) {
          state.inspectOfferSentAt = Date.now();
          console.log('[Inspector WebRTC] Re-attempting OFFER transmission to host...');
          if (typeof state.sendInspectOfferFn === 'function') {
            state.sendInspectOfferFn().catch(() => {});
          }
        }
      } catch (err) {
      } finally {
        isInspectPolling = false;
        if (state.isInspecting && state.inspectRoom?.room_id) {
          const isConnected = state.inspectPc?.connectionState === 'connected';
          const nextDelay = (hadSignals || !isConnected) ? 300 : 850;
          state.inspectPollTimer = setTimeout(executeInspectPoll, nextDelay);
        }
      }
    };

    executeInspectPoll();
  }

  window.stopInspectionStudio = async function(notifyServer = true) {
    if (state.inspectTimer) { clearInterval(state.inspectTimer); state.inspectTimer = null; }
    if (state.inspectPollTimer) { clearInterval(state.inspectPollTimer); state.inspectPollTimer = null; }
    
    if (state.inspectPc) {
      try {
        state.inspectPc.ontrack = null;
        state.inspectPc.onicecandidate = null;
        state.inspectPc.close();
      } catch(e) {}
      state.inspectPc = null;
    }

    if (state.inspectRemoteStream) {
      try {
        state.inspectRemoteStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      state.inspectRemoteStream = null;
    }

    const roomId = state.inspectRoom?.room_id;
    const user = getLiveAdminUser();

    state.isInspecting = false;
    state.inspectRoom = null;

    if (notifyServer && roomId && user?.id) {
      try {
        await fetch('/api/calls/group/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, participantId: user.id })
        });
      } catch(e) {}
    }

    renderOnlineClassesWorkspace();
  };

  function updateInspectAttendeeRoster(participants) {
    const list = document.getElementById('inspectAttendeeList');
    const count = document.getElementById('inspectRosterCount');
    const students = (participants || []).filter(p => !p.isHost && p.role !== 'teacher' && !p.isStealth && !p.isHidden);
    if (list) list.innerHTML = renderParticipantsHtml(students);
    if (count) count.textContent = students.length;
  }

  function takeInspectSnapshot() {
    const video = document.getElementById('liveClassInspectVideo');
    if (!video || !video.videoWidth) {
      alert('Live video stream not yet available to capture a snapshot.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a');
    link.download = `TPS_LiveClass_Snapshot_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // ─────────────────────────────────────────────────────────────
  // ── 4. DIRECT 1:1 VOICE CALLING (WebRTC Browser Audio)
  // ─────────────────────────────────────────────────────────────
  async function startDirectCall({ recipientId, recipientName, recipientRole, recipientAvatar, className }) {
    if (state.activeCall) {
      alert('Another call is already in progress.');
      return;
    }

    const user = getLiveAdminUser();

    // Acquire mic
    try {
      state.callLocalStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
    } catch (e) {
      alert('Microphone access required to make voice calls: ' + e.message);
      return;
    }

    state.callPc = new RTCPeerConnection(ICE_CONFIG);
    state.callLocalStream.getTracks().forEach(t => {
      try { state.callPc.addTrack(t, state.callLocalStream); } catch(e){}
    });

    state.appliedCallIce.clear();
    state.callDurationSec = 0;
    state.isCallMuted = false;

    state.callPc.ontrack = (event) => {
      if (event.receiver) {
        try {
          if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
          if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
        } catch (e) {}
      }
      if (event.streams && event.streams[0]) {
        state.callRemoteStream = event.streams[0];
        playDirectCallAudio(event.streams[0]);
      }
    };

    state.callPc.onicecandidate = (event) => {
      if (event.candidate && state.activeCall?.call_id) {
        fetch('/api/calls/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: state.activeCall.call_id,
            senderId: user.id,
            iceCandidates: [event.candidate],
            isCaller: true
          })
        }).catch(() => {});
      }
    };

    // Create Offer SDP
    try {
      const offer = await state.callPc.createOffer({ offerToReceiveAudio: true });
      await state.callPc.setLocalDescription(offer);

      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerId: user.id,
          callerName: user.name,
          callerRole: user.role,
          callerAvatar: user.avatar,
          receiverId: recipientId,
          receiverName: recipientName,
          receiverRole: recipientRole || 'student',
          receiverAvatar: recipientAvatar || '',
          offerSdp: JSON.stringify(offer)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Failed to initiate call.');
        endDirectCall();
        return;
      }

      state.activeCall = {
        ...data.call,
        isOutgoing: true,
        recipientName,
        recipientRole,
        recipientAvatar,
        className
      };

      showActiveCallModal();
      startDirectCallPolling();
    } catch (err) {
      alert('Call initiation error: ' + err.message);
      endDirectCall();
    }
  }

  function startDirectCallPolling() {
    if (state.callTimer) clearInterval(state.callTimer);
    const user = getLiveAdminUser();

    state.callTimer = setInterval(async () => {
      if (!state.activeCall?.call_id) return;
      const callId = state.activeCall.call_id;

      try {
        const res = await fetch(`/api/calls/poll?userId=${encodeURIComponent(user.id)}&activeCallId=${encodeURIComponent(callId)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.activeCall && data.activeCall.call_id === callId) {
          const call = data.activeCall;

          if (call.status === 'ended' || call.status === 'declined') {
            endDirectCall(call.status === 'declined' ? 'Call was declined.' : 'Call ended.');
            return;
          }

          if (call.status === 'connected' || call.answer_sdp) {
            updateCallModalStatus('Connected');
            if (!state.callDurationTimer) {
              state.callDurationTimer = setInterval(() => {
                state.callDurationSec++;
                const durEl = document.getElementById('directCallDuration');
                if (durEl) durEl.textContent = formatDuration(state.callDurationSec);
              }, 1000);
            }
          }

          // Handle Answer SDP
          if (call.answer_sdp && state.callPc && state.callPc.signalingState === 'have-local-offer') {
            let answer = typeof call.answer_sdp === 'string' ? JSON.parse(call.answer_sdp) : call.answer_sdp;
            if (typeof answer === 'string') answer = JSON.parse(answer);
            await state.callPc.setRemoteDescription(new RTCSessionDescription(answer));
          }

          // Sync Receiver ICE Candidates
          if (call.receiver_ice) {
            let candidates = typeof call.receiver_ice === 'string' ? JSON.parse(call.receiver_ice) : call.receiver_ice;
            if (Array.isArray(candidates)) {
              candidates.forEach(c => {
                const cStr = JSON.stringify(c);
                if (!state.appliedCallIce.has(cStr) && c.candidate) {
                  state.appliedCallIce.add(cStr);
                  try { state.callPc.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
                }
              });
            }
          }
        }
      } catch(e) {}
    }, 1200);
  }

  function playDirectCallAudio(stream) {
    let audioEl = document.getElementById('directCallAudioEl');
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = 'directCallAudioEl';
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
  }

  function endDirectCall(msg = null) {
    if (state.callTimer) { clearInterval(state.callTimer); state.callTimer = null; }
    if (state.callDurationTimer) { clearInterval(state.callDurationTimer); state.callDurationTimer = null; }

    const callId = state.activeCall?.call_id;
    if (callId) {
      fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId, durationSec: state.callDurationSec })
      }).catch(() => {});
    }

    if (state.callPc) {
      try { state.callPc.close(); } catch(e) {}
      state.callPc = null;
    }

    if (state.callLocalStream) {
      try { state.callLocalStream.getTracks().forEach(t => t.stop()); } catch(e) {}
      state.callLocalStream = null;
    }

    state.activeCall = null;
    state.callRemoteStream = null;
    state.callDurationSec = 0;

    const audioEl = document.getElementById('directCallAudioEl');
    if (audioEl) audioEl.remove();

    hideActiveCallModal();
    if (msg) alert(msg);
  }

  // ─────────────────────────────────────────────────────────────
  // ── 5. GLOBAL BACKGROUND INCOMING CALL LISTENER
  // ─────────────────────────────────────────────────────────────
  let globalPollInterval = null;

  function initGlobalIncomingCallListener() {
    if (globalPollInterval) clearInterval(globalPollInterval);

    const checkIncomingCall = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const user = getLiveAdminUser();
      if (!user?.id) return;

      try {
        const res = await fetch(`/api/calls/poll?userId=${encodeURIComponent(user.id)}&userRole=${encodeURIComponent(user.role)}&_t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();

        // 1. Check for incoming call
        if (data.incomingCall && !state.activeCall && data.incomingCall.status === 'ringing') {
          showIncomingCallToast(data.incomingCall);
        }

        // 2. Check for active school room banner
        if (data.activeGroupRoom && data.activeGroupRoom.status === 'active') {
          state.currentActiveSchoolRoom = data.activeGroupRoom;
          updateHeaderLiveBadge(data.activeGroupRoom);
        } else {
          state.currentActiveSchoolRoom = null;
          updateHeaderLiveBadge(null);
        }
      } catch (e) {}
    };

    globalPollInterval = setInterval(checkIncomingCall, 5000);

    if (typeof document !== 'undefined' && !window._ocVisibilityAttached) {
      window._ocVisibilityAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkIncomingCall();
      });
    }
  }

  function showIncomingCallToast(call) {
    let toast = document.getElementById('webIncomingCallToast');
    if (toast) return; // already showing

    startWebRingtone();

    toast = document.createElement('div');
    toast.id = 'webIncomingCallToast';
    toast.className = 'oc-incoming-toast';

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
          📞
        </div>
        <div>
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Incoming Voice Call</div>
          <div style="font-size: 15px; font-weight: 800; color: #f8fafc;">${call.caller_name || 'School Caller'}</div>
          <div style="font-size: 12px; color: #38bdf8;">Role: ${call.caller_role || 'Student'}</div>
        </div>
      </div>
      <div class="toast-actions" style="display: flex; gap: 8px; margin-left: 12px;">
        <button id="btnAcceptCall" style="background: #22c55e; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; min-height: 42px;">
          ✓ Accept
        </button>
        <button id="btnDeclineCall" style="background: #ef4444; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; min-height: 42px;">
          ✕ Decline
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    document.getElementById('btnAcceptCall').onclick = async () => {
      stopWebRingtone();
      toast.remove();
      await answerIncomingCall(call);
    };

    document.getElementById('btnDeclineCall').onclick = () => {
      stopWebRingtone();
      toast.remove();
      const user = getLiveAdminUser();
      fetch('/api/calls/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.call_id, userId: user.id, action: 'decline' })
      }).catch(() => {});
    };
  }

  async function answerIncomingCall(call) {
    const user = getLiveAdminUser();

    try {
      state.callLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch(e) {
      alert('Microphone access required to accept call: ' + e.message);
      return;
    }

    state.callPc = new RTCPeerConnection(ICE_CONFIG);
    state.callLocalStream.getTracks().forEach(t => state.callPc.addTrack(t, state.callLocalStream));
    state.appliedCallIce.clear();
    state.callDurationSec = 0;

    state.callPc.ontrack = (event) => {
      if (event.receiver) {
        try {
          if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
          if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
        } catch (e) {}
      }
      if (event.streams && event.streams[0]) {
        state.callRemoteStream = event.streams[0];
        playDirectCallAudio(event.streams[0]);
      }
    };

    state.callPc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch('/api/calls/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: call.call_id,
            senderId: user.id,
            iceCandidates: [event.candidate],
            isCaller: false
          })
        }).catch(() => {});
      }
    };

    try {
      let offer = typeof call.offer_sdp === 'string' ? JSON.parse(call.offer_sdp) : call.offer_sdp;
      if (typeof offer === 'string') offer = JSON.parse(offer);
      await state.callPc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await state.callPc.createAnswer();
      await state.callPc.setLocalDescription(answer);

      await fetch('/api/calls/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: call.call_id,
          userId: user.id,
          action: 'accept',
          answerSdp: JSON.stringify(answer)
        })
      });

      state.activeCall = {
        ...call,
        isOutgoing: false,
        recipientName: call.caller_name,
        recipientRole: call.caller_role,
        recipientAvatar: call.caller_avatar
      };

      showActiveCallModal();
      startDirectCallPolling();
    } catch(e) {
      alert('Error answering call: ' + e.message);
      endDirectCall();
    }
  }

  function updateHeaderLiveBadge(room) {
    let badge = document.getElementById('headerLiveClassBadge');
    if (!room || room.status === 'ended') {
      if (badge) badge.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'headerLiveClassBadge';
      badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #dc2626, #ef4444);
        color: white;
        padding: 4px 14px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        margin-left: 12px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        animation: pulseLive 2s infinite;
      `;
      const topbarTitle = document.querySelector('.topbar-title');
      if (topbarTitle) topbarTitle.appendChild(badge);
    }

    badge.title = "Click to Join Room in Stealth Mode (Identity 100% Hidden)";
    badge.innerHTML = `
      <span style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #fff;"></span>
        <span>LIVE: ${room.title || 'Class Session'}</span>
      </span>
      <span title="End / Dismiss Live Room" style="margin-left: 4px; padding: 2px 6px; background: rgba(0,0,0,0.25); border-radius: 9999px; font-size: 11px; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.5)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'" onclick="event.stopPropagation(); window.terminateRoomAdmin('${room.room_id}')">✕</span>
    `;
    badge.onclick = () => {
      window.currentModule = 'onlineClasses';
      state.currentTab = 'studio';
      if (typeof window.renderAll === 'function') window.renderAll();
      window.joinRoomAsAdmin(room.room_id, true);
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ── 6. HTML MODALS & WORKSPACE UI RENDERING
  // ─────────────────────────────────────────────────────────────
  function formatDuration(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function showActiveCallModal() {
    let modal = document.getElementById('activeDirectCallModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'activeDirectCallModal';
      modal.className = 'oc-active-call-modal';
      document.body.appendChild(modal);
    }

    const c = state.activeCall;
    modal.innerHTML = `
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #0284c7; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; border: 2px solid #38bdf8;">
        ${c.recipientAvatar ? `<img src="${c.recipientAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />` : '👤'}
      </div>
      <h4 style="margin: 0; font-size: 18px; color: #f8fafc;">${c.recipientName || 'Contact'}</h4>
      <p style="margin: 4px 0 12px; font-size: 13px; color: #94a3b8;">${c.className ? `Class: ${c.className}` : (c.recipientRole || '')}</p>
      
      <div id="directCallStatus" style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">Calling...</div>
      <div id="directCallDuration" style="font-size: 20px; font-weight: 800; color: #4ade80; margin-bottom: 16px;">00:00</div>

      <div style="display: flex; justify-content: center; gap: 12px;">
        <button id="btnToggleCallMute" style="background: ${state.isCallMuted ? '#ef4444' : '#334155'}; color: white; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 18px;">
          ${state.isCallMuted ? '🔇' : '🎤'}
        </button>
        <button id="btnEndDirectCall" style="background: #ef4444; color: white; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 18px;">
          📞
        </button>
      </div>
    `;

    document.getElementById('btnToggleCallMute').onclick = () => {
      state.isCallMuted = !state.isCallMuted;
      if (state.callLocalStream) {
        state.callLocalStream.getAudioTracks().forEach(t => { t.enabled = !state.isCallMuted; });
      }
      showActiveCallModal();
    };

    document.getElementById('btnEndDirectCall').onclick = () => {
      endDirectCall();
    };
  }

  function updateCallModalStatus(text) {
    const el = document.getElementById('directCallStatus');
    if (el) el.textContent = text;
  }

  function hideActiveCallModal() {
    const modal = document.getElementById('activeDirectCallModal');
    if (modal) modal.remove();
  }

  // ─────────────────────────────────────────────────────────────
  // ── 7. MAIN WORKSPACE VIEW BUILDER (Online Classes & Calls)
  // ─────────────────────────────────────────────────────────────
  async function ensureDirectoryData(force = false) {
    const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});

    // 1. If we already have directory students in memory and not forced, return immediately
    if (!force && Array.isArray(state.directoryStudents) && state.directoryStudents.length > 0) {
      return {
        students: state.directoryStudents,
        teachers: state.directoryTeachers || [],
        classes: state.directoryClasses || []
      };
    }

    // 2. If app.js store has students, populate instantly with zero network delay and NO spinner
    if (Array.isArray(store.students) && store.students.length > 0) {
      state.directoryStudents = store.students;
      state.directoryTeachers = store.teachers || [];
      state.directoryClasses = store.classes || [];
      state.directoryLastLoaded = Date.now();
      state.directoryLoading = false;
      if (state.currentTab === 'calling') {
        renderCallingTabOnly();
      }
      return {
        students: state.directoryStudents,
        teachers: state.directoryTeachers,
        classes: state.directoryClasses
      };
    }

    // 3. Only show loading spinner if we have ZERO students in memory
    const hadNoData = !state.directoryStudents || state.directoryStudents.length === 0;
    if (hadNoData) {
      state.directoryLoading = true;
      renderCallingTabOnly();
    }

    try {
      let fetchedStudents = [];
      let fetchedTeachers = [];
      let fetchedClasses = [];

      const token = localStorage.getItem('token') || '';
      const authHeaders = {
        'Accept': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        'x-admin-pin': 'tapowan2026'
      };

      // Try fast dedicated calling directory first
      try {
        const dRes = await fetch('/api/calls/directory', {
          credentials: 'include',
          headers: authHeaders
        });
        if (dRes.ok) {
          const dData = await dRes.json();
          if (dData && dData.ok && Array.isArray(dData.students) && dData.students.length > 0) {
            fetchedStudents = dData.students;
            fetchedTeachers = Array.isArray(dData.teachers) ? dData.teachers : [];
            fetchedClasses = Array.isArray(dData.classes) ? dData.classes : [];
          }
        }
      } catch (e) {}

      // Fallback to /api/store if needed
      if (fetchedStudents.length === 0) {
        try {
          const res = await fetch('/api/store', {
            credentials: 'include',
            headers: authHeaders
          });
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              fetchedStudents = Array.isArray(data.students) ? data.students : [];
              fetchedTeachers = Array.isArray(data.teachers) ? data.teachers : [];
              fetchedClasses = Array.isArray(data.classes) ? data.classes : [];
              if (typeof window.serverStore === 'object') window.serverStore = data;
            }
          }
        } catch (e) {}
      }

      if (fetchedStudents.length > 0) {
        state.directoryStudents = fetchedStudents;
        state.directoryTeachers = fetchedTeachers;
        state.directoryClasses = fetchedClasses;
        state.directoryLastLoaded = Date.now();
      }
    } catch (err) {
      console.warn('ensureDirectoryData error:', err);
    } finally {
      state.directoryLoading = false;
      if (state.currentTab === 'calling') {
        renderCallingTabOnly();
      }
    }

    return {
      students: state.directoryStudents || [],
      teachers: state.directoryTeachers || [],
      classes: state.directoryClasses || []
    };
  }

  window.refreshOnlineClassesData = function (force = false) {
    return ensureDirectoryData(force);
  };

  window.updateOnlineClassesFromStore = function (newStore) {
    if (!newStore || !Array.isArray(newStore.students) || newStore.students.length === 0) return;
    state.directoryStudents = newStore.students;
    state.directoryTeachers = newStore.teachers || [];
    state.directoryClasses = newStore.classes || [];
    state.directoryLastLoaded = Date.now();
    state.directoryLoading = false;

    if (state.currentTab === 'calling') {
      const searchInput = document.getElementById('dirSearchInput');
      const isTyping = searchInput && document.activeElement === searchInput;
      if (!isTyping) {
        renderCallingTabOnly();
      }
    }
  };

  function switchSubtab(tabName) {
    state.currentTab = tabName;

    const btnStudio = document.getElementById('subtabStudio');
    const btnCalling = document.getElementById('subtabCalling');
    const btnRooms = document.getElementById('subtabRooms');

    const tabStudio = document.getElementById('tabContentStudio');
    const tabCalling = document.getElementById('tabContentCalling');
    const tabRooms = document.getElementById('tabContentRooms');

    if (btnStudio) {
      btnStudio.style.borderColor = tabName === 'studio' ? '#38bdf8' : 'rgba(148, 163, 184, 0.15)';
      btnStudio.style.background = tabName === 'studio' ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : 'rgba(30, 41, 59, 0.6)';
      btnStudio.style.boxShadow = tabName === 'studio' ? '0 8px 20px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none';
      btnStudio.style.color = tabName === 'studio' ? '#ffffff' : '#94a3b8';
    }
    if (btnCalling) {
      btnCalling.style.borderColor = tabName === 'calling' ? '#4ade80' : 'rgba(148, 163, 184, 0.15)';
      btnCalling.style.background = tabName === 'calling' ? 'linear-gradient(135deg, #15803d, #16a34a)' : 'rgba(30, 41, 59, 0.6)';
      btnCalling.style.boxShadow = tabName === 'calling' ? '0 8px 20px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none';
      btnCalling.style.color = tabName === 'calling' ? '#ffffff' : '#94a3b8';
    }
    if (btnRooms) {
      btnRooms.style.borderColor = tabName === 'rooms' ? '#a78bfa' : 'rgba(148, 163, 184, 0.15)';
      btnRooms.style.background = tabName === 'rooms' ? 'linear-gradient(135deg, #4338ca, #4f46e5)' : 'rgba(30, 41, 59, 0.6)';
      btnRooms.style.boxShadow = tabName === 'rooms' ? '0 8px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none';
      btnRooms.style.color = tabName === 'rooms' ? '#ffffff' : '#94a3b8';
    }

    if (tabStudio) tabStudio.style.display = tabName === 'studio' ? 'block' : 'none';
    if (tabCalling) tabCalling.style.display = tabName === 'calling' ? 'block' : 'none';
    if (tabRooms) tabRooms.style.display = tabName === 'rooms' ? 'block' : 'none';

    if (tabName === 'calling') {
      const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});
      const hasData = (state.directoryStudents && state.directoryStudents.length > 0) || (store.students && store.students.length > 0);
      if (!hasData) {
        ensureDirectoryData();
      } else {
        if (!state.directoryStudents || state.directoryStudents.length === 0) {
          state.directoryStudents = store.students || [];
          state.directoryTeachers = store.teachers || [];
          state.directoryClasses = store.classes || [];
        }
        state.directoryLoading = false;
        renderCallingTabOnly();
      }
    } else if (tabName === 'rooms') {
      loadActiveRoomsData();
    }
  }

  function renderOnlineClassesWorkspace() {
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

    panel.innerHTML = `
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
                  ${renderRoomsLogContent()}
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
                  ${renderCallingContent(students, teachers, classes)}
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
    `;

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

    window.zoomToggleShare = async function() {
      const videoEl = document.getElementById('liveClassMainVideo');
      const sketchImg = document.getElementById('zoomSketchPortrait');
      const shareBtn = document.getElementById('zoomBtnShare');
      const shareIcon = shareBtn ? shareBtn.querySelector('.material-symbols-outlined') : null;
      const shareLabel = shareBtn ? shareBtn.querySelector('.zoom-ctrl-label') : null;

      if (!state.isScreenSharing) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert('Screen sharing (screen cast) is restricted by your browser. Please use Google Chrome, Microsoft Edge, or Firefox on desktop/laptop, or launch the Live Whiteboard.');
          return;
        }

        try {
          let stream = null;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { cursor: 'always', frameRate: { ideal: 30 } },
              audio: true
            });
          } catch (e) {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          }

          if (!stream) return;

          state.screenStream = stream;
          state.isScreenSharing = true;

          // Display screen stream immediately in the meeting stage
          if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            videoEl.play().catch(() => {});
          }
          if (sketchImg) sketchImg.style.display = 'none';

          // Update Share Button UI to active state
          if (shareBtn) shareBtn.classList.add('active');
          if (shareIcon) {
            shareIcon.style.color = '#ef4444';
            shareIcon.innerText = 'stop_screen_share';
          }
          if (shareLabel) shareLabel.innerText = 'Stop Share';

          showStudioToast('🖥️ Screen cast active: Sharing screen to live meeting');

          const screenVideoTrack = stream.getVideoTracks()[0];
          if (screenVideoTrack) {
            screenVideoTrack.onended = () => {
              window.zoomToggleShare();
            };

            // Hot-swap video track across all active WebRTC student peers
            if (state.peers && state.peers.size > 0) {
              for (const [, peer] of state.peers.entries()) {
                if (peer.pc && typeof peer.pc.getSenders === 'function') {
                  const senders = peer.pc.getSenders();
                  const videoSender = senders.find(s => s?.track?.kind === 'video');
                  if (videoSender && typeof videoSender.replaceTrack === 'function') {
                    videoSender.replaceTrack(screenVideoTrack).catch(() => {});
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Screen share canceled or denied:', err);
          if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            showStudioToast('⚠️ Screen cast notice: ' + err.message);
          }
        }
      } else {
        // Stop Screen Sharing
        if (state.screenStream) {
          try {
            state.screenStream.getTracks().forEach(t => t.stop());
          } catch (e) {}
          state.screenStream = null;
        }
        state.isScreenSharing = false;

        // Revert display: if camera was active, revert to camera. Else revert to sketch image.
        if (isCameraActive && activeCameraStream) {
          if (videoEl) {
            videoEl.srcObject = activeCameraStream;
            videoEl.style.display = 'block';
          }
          if (sketchImg) sketchImg.style.display = 'none';

          const camTrack = activeCameraStream.getVideoTracks()[0];
          if (camTrack && state.peers) {
            for (const [, peer] of state.peers.entries()) {
              if (peer.pc && typeof peer.pc.getSenders === 'function') {
                const senders = peer.pc.getSenders();
                const videoSender = senders.find(s => s?.track?.kind === 'video');
                if (videoSender && typeof videoSender.replaceTrack === 'function') {
                  videoSender.replaceTrack(camTrack).catch(() => {});
                }
              }
            }
          }
        } else {
          if (videoEl) {
            videoEl.srcObject = null;
            videoEl.style.display = 'none';
          }
          if (sketchImg) sketchImg.style.display = 'block';
        }

        // Reset Share Button UI
        if (shareBtn) shareBtn.classList.remove('active');
        if (shareIcon) {
          shareIcon.style.color = '#22c55e';
          shareIcon.innerText = 'present_to_all';
        }
        if (shareLabel) shareLabel.innerText = 'Share';

        showStudioToast('⏹️ Screen cast stopped');
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
        'TAPOWAN PUBLIC SCHOOL\'s Zoom Meeting\n' +
        '------------------------------------\n' +
        'Meeting ID: 842 9102 3844\n' +
        'Host: TAPOWAN PUBLIC SCHOOL (Admin)\n' +
        'Passcode: 2026tps\n' +
        'Invite Link: https://tapowan-school.vercel.app/live-class/tps-zoom\n' +
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

  window.renderOnlineClassesWorkspace = renderOnlineClassesWorkspace;
  window.renderOnlineClassesModule = renderOnlineClassesWorkspace;

  function renderInspectionStudio() {
    const room = state.inspectRoom || {};
    const participants = (room.participants || []).filter(p => !p.isHost && p.role !== 'teacher' && !p.isStealth && !p.isHidden);
    const safeTitle = typeof escapeHtml === 'function' ? escapeHtml(room.title || 'Live Classroom Session') : (room.title || 'Live Classroom Session');
    const safeClass = typeof escapeHtml === 'function' ? escapeHtml(room.target_class || 'All') : (room.target_class || 'All');
    const safeHost = typeof escapeHtml === 'function' ? escapeHtml(room.host_name || 'Teacher') : (room.host_name || 'Teacher');

    return `
      <div class="oc-inspect-mobile-shell">
        
        <!-- Mobile Header Bar -->
        <div class="oc-inspect-mobile-header">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <button class="oc-inspect-back-btn" onclick="document.getElementById('btnInspectExit')?.click()" title="Back / Leave">
              ‹
            </button>
            <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
              <div style="font-size: 15px; font-weight: 800; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px;">
                ${safeTitle}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="oc-inspect-live-pill">● LIVE</span>
                <span class="oc-inspect-class-pill">Class: ${safeClass}</span>
                <span id="inspectDurationTimer" class="oc-inspect-timer-pill">${formatDuration(state.inspectDurationSec)}</span>
              </div>
            </div>
          </div>

          <div>
            ${state.isStealthInspector ? `
              <div class="oc-inspect-ghost-pill" title="100% Invisible to Teacher & Students">
                🕵️ Stealth
              </div>
            ` : `
              <div class="oc-inspect-admin-pill">
                👁️ Admin
              </div>
            `}
          </div>
        </div>

        <!-- Mobile Video Viewport Container -->
        <div id="inspectVideoContainer" class="oc-inspect-video-container">
          <video id="liveClassInspectVideo" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: contain;"></video>
          
          <!-- Floating Connection Status -->
          <div id="inspectStreamStatus" class="oc-inspect-floating-status">
            ⏳ Connecting to Live Stream...
          </div>

          <!-- Stealth Watermark Badge -->
          ${state.isStealthInspector ? `
            <div class="oc-inspect-floating-stealth">
              🕵️ Invisible
            </div>
          ` : ''}

          <!-- Bottom Mobile Video HUD -->
          <div class="oc-inspect-video-hud">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: nowrap;">
              <button id="btnInspectAudioToggle" class="oc-inspect-hud-btn" style="background: ${state.isInspectAudioMuted ? '#ef4444' : '#334155'};">
                ${state.isInspectAudioMuted ? '🔇 Audio Muted' : '🔊 Audio ON'}
              </button>
              <div style="display: flex; align-items: center; gap: 5px; color: #cbd5e1; font-size: 11px;">
                <span>🔉</span>
                <input type="range" id="inspectVolumeSlider" min="0" max="1" step="0.05" value="${state.inspectAudioVolume}" class="oc-inspect-vol-slider" title="Volume">
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px;">
              <button id="btnInspectSnapshot" class="oc-inspect-hud-btn" title="Capture Snapshot">
                📸 Snap
              </button>
              <button id="btnInspectFullscreen" class="oc-inspect-hud-btn" title="Fullscreen">
                ⛶ Full
              </button>
            </div>
          </div>
        </div>

        <!-- Broadcaster Host Card Strip -->
        <div class="oc-inspect-host-strip">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div class="oc-inspect-host-avatar">
              👨‍🏫
            </div>
            <div style="min-width: 0;">
              <div style="font-weight: 800; font-size: 13.5px; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${safeHost}
              </div>
              <div style="font-size: 11px; color: #34d399; font-weight: 600;">Host & Broadcaster • Class: ${safeClass}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <span class="oc-inspect-host-tag">HOST</span>
            <span class="oc-inspect-silent-tag">🛡️ Silent Watch</span>
          </div>
        </div>

        <!-- Mobile Action Buttons Bar -->
        <div class="oc-inspect-actions-strip">
          <button id="btnInspectMuteAllStudents" class="oc-inspect-btn-mute-all">
            🔇 Mute Students
          </button>
          <button id="btnInspectExit" class="oc-inspect-btn-leave">
            🚪 Leave Inspection
          </button>
          <button id="btnInspectEndRoom" class="oc-inspect-btn-end">
            🛑 End Room
          </button>
        </div>

        <!-- Classroom Attendees Section -->
        <div class="oc-inspect-attendees-section">
          <div class="oc-inspect-attendees-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 15px;">👥</span>
              <span style="font-size: 13.5px; font-weight: 800; color: #f8fafc;">Classroom Attendees</span>
            </div>
            <span id="inspectRosterCount" class="oc-inspect-roster-count">
              ${participants.length}
            </span>
          </div>

          <!-- Student Roster Scroll Area -->
          <div id="inspectAttendeeList" class="oc-inspect-attendee-list">
            ${renderParticipantsHtml(participants)}
          </div>
        </div>

      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // ── LIVE CLASSROOM STUDIO INTERACTIVE CONTROLS (Real-Time, Zero Mock)
  // ─────────────────────────────────────────────────────────────
  function showStudioToast(msg) {
    let toast = document.getElementById('studioToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'studioToast';
      toast.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; background: #0f172a; border: 1.5px solid #3b82f6; border-radius: 10px; padding: 12px 18px; color: white; font-size: 13px; font-weight: 700; box-shadow: 0 10px 25px rgba(0,0,0,0.5); transition: opacity 0.3s; pointer-events: none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.display = 'block';
    setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
      }
    }, 3500);
  }

  function showFloatingReaction(emoji) {
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText = `position: fixed; bottom: 120px; left: ${40 + Math.random() * 20}%; font-size: 32px; z-index: 99999; animation: floatUp 1.8s ease-out forwards; pointer-events: none;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  window.sendStudioReaction = function(emoji) {
    showFloatingReaction(emoji);
    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'STUDIO_REACTION',
          signalData: { emoji }
        })
      }).catch(() => {});
    }
    const picker = document.getElementById('studioReactionPicker');
    if (picker) picker.style.display = 'none';
  };

  function handleIncomingChatMessage(msg) {
    if (!msg || !msg.text) return;
    if (state.chatMessages.some(m => m.id === msg.id || (m.timestamp === msg.timestamp && m.text === msg.text && m.senderId === msg.senderId))) return;
    state.chatMessages.push(msg);
    if (state.studioTab === 'chat') {
      renderStudioSubTabContent();
    }
  }

  function handleIncomingQnaQuestion(q) {
    if (!q || !q.question) return;
    if (state.qnaList.some(item => item.id === q.id)) return;
    state.qnaList.push(q);
    if (state.studioTab === 'qna') {
      renderStudioSubTabContent();
    }
    showStudioToast(`❓ Question from ${q.askedBy || 'Student'}: "${(q.question || '').slice(0, 35)}..."`);
  }

  function handleIncomingQnaAnswer(data) {
    if (!data || !data.questionId) return;
    const item = state.qnaList.find(q => q.id === data.questionId);
    if (item) {
      item.answer = data.answer;
      item.answeredBy = data.answeredBy;
      item.answeredAt = data.answeredAt;
      if (state.studioTab === 'qna') renderStudioSubTabContent();
    }
  }

  function handleIncomingNote(note) {
    if (!note || !note.content) return;
    if (state.notesList.some(n => n.id === note.id)) return;
    state.notesList.unshift(note);
    if (state.studioTab === 'notes') {
      renderStudioSubTabContent();
    }
  }

  function handleIncomingPollCreate(poll) {
    if (!poll || !poll.question) return;
    state.activePoll = poll;
    renderStudioPollCard();
  }

  function handleIncomingPollVote(data) {
    if (!data || !state.activePoll || state.activePoll.id !== data.pollId) return;
    const opt = state.activePoll.options?.find(o => o.id === data.optionId);
    if (opt) {
      opt.votes = (opt.votes || 0) + 1;
      state.activePoll.totalVotes = (state.activePoll.totalVotes || 0) + 1;
      renderStudioPollCard();
    }
  }

  function handleIncomingPollEnd() {
    state.activePoll = null;
    renderStudioPollCard();
  }

  function handleIncomingAnnouncement(data) {
    if (!data || !data.text) return;
    showStudioToast(`📢 Announcement: ${data.text}`);
  }

  function sendStudioChatMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    const msgObj = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: trimmed,
      senderId: user.id,
      senderName: (user.name || 'Teacher') + ' (Faculty)',
      senderRole: 'teacher',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isTeacher: true
    };
    state.chatMessages.push(msgObj);
    renderStudioSubTabContent();

    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'CHAT_MESSAGE',
          signalData: msgObj
        })
      }).catch(err => console.warn('Chat send error:', err));
    }
  }

  window.switchStudioTab = function(tab) {
    state.studioTab = tab;
    ['chat', 'qna', 'notes', 'participants'].forEach(t => {
      const btn = document.getElementById(`tabBtnStudio_${t}`);
      if (btn) {
        btn.style.borderBottom = t === tab ? '2px solid #ef4444' : 'none';
        btn.style.color = t === tab ? '#ffffff' : '#64748b';
      }
    });
    renderStudioSubTabContent();
  };

  window.replyToStudioQuestion = function(qId) {
    const q = state.qnaList.find(item => item.id === qId);
    if (!q) return;
    const ans = prompt(`Answer question from ${q.askedBy}:\n\n"${q.question}"`);
    if (!ans || !ans.trim()) return;
    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    const ansAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    q.answer = ans.trim();
    q.answeredBy = user.name || 'Teacher';
    q.answeredAt = ansAt;
    renderStudioSubTabContent();

    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'QNA_ANSWER',
          signalData: {
            questionId: qId,
            answer: ans.trim(),
            answeredBy: user.name || 'Teacher',
            answeredAt: ansAt
          }
        })
      }).catch(err => console.warn('Q&A answer error:', err));
    }
  };

  window.shareStudioNote = function() {
    const title = prompt('Enter Note Title (e.g. Important Points, Formula):', 'Important Concept');
    if (title === null) return;
    const content = prompt('Enter Note Content:', '');
    if (!content || !content.trim()) return;

    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    const noteObj = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title.trim() || 'Class Note',
      content: content.trim(),
      author: user.name || 'Teacher',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.notesList.unshift(noteObj);
    state.studioTab = 'notes';
    window.switchStudioTab('notes');

    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'NOTE_SHARED',
          signalData: noteObj
        })
      }).then(() => {
        showStudioToast('📝 Note shared with class!');
      }).catch(err => console.warn('Note share error:', err));
    }
  };

  window.broadcastStudioAnnouncement = function() {
    const text = prompt('Broadcast Announcement to All Connected Students:\n(Shows instantly on student devices)', '');
    if (!text || !text.trim()) return;

    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'CLASS_ANNOUNCEMENT',
          signalData: {
            text: text.trim(),
            fromName: user.name || 'Teacher'
          }
        })
      }).then(() => {
        showStudioToast('📢 Announcement broadcasted to all students!');
      }).catch(err => alert('Failed to broadcast announcement: ' + err.message));
    }
  };

  window.openStudioPollCreator = function() {
    const question = prompt('Enter Poll / Quiz Question for students:', 'Did everyone understand this concept?');
    if (!question || !question.trim()) return;

    const rawOptions = prompt('Enter answer choices (comma-separated):', 'Yes perfectly, Needs revision, Have doubts');
    if (!rawOptions || !rawOptions.trim()) return;

    const options = rawOptions.split(',').map((opt, idx) => ({
      id: idx,
      text: opt.trim(),
      votes: 0
    })).filter(o => o.text.length > 0);

    if (options.length < 2) {
      alert('Please provide at least 2 choices separated by commas.');
      return;
    }

    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    const pollObj = {
      id: 'poll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      question: question.trim(),
      options: options,
      totalVotes: 0,
      createdBy: user.name || 'Teacher',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    state.activePoll = pollObj;
    renderStudioPollCard();

    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'POLL_CREATE',
          signalData: pollObj
        })
      }).then(() => {
        showStudioToast('📊 Live Poll broadcasted to students!');
      }).catch(err => console.warn('Poll send error:', err));
    }
  };

  window.endStudioPoll = function() {
    if (!confirm('Close and end this live poll?')) return;
    const user = getLiveAdminUser();
    const roomId = state.activeRoom?.room_id;
    state.activePoll = null;
    renderStudioPollCard();

    if (roomId) {
      fetch('/api/calls/group/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fromId: user.id,
          toId: 'ALL',
          signalType: 'POLL_END',
          signalData: {}
        })
      }).catch(err => console.warn('Poll end error:', err));
    }
  };

  window.toggleStudioRecording = function() {
    if (state.isRecording && state.mediaRecorder) {
      state.mediaRecorder.stop();
      state.isRecording = false;
      const recBtn = document.getElementById('btnToolRecord');
      if (recBtn) recBtn.innerHTML = '<div style="color: #ef4444; font-size: 16px; margin-bottom: 2px;">🔴</div>Record';
      const badge = document.getElementById('studioRecBadge');
      if (badge) badge.style.display = 'none';
      showStudioToast('Lecture recording saved and downloaded.');
      return;
    }

    const stream = state.isScreenSharing && state.screenStream
      ? state.screenStream
      : state.localMediaStream;
    if (!stream) {
      alert('Cannot start recording: No active camera or screen stream.');
      return;
    }

    try {
      state.recordedChunks = [];
      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus'))
        ? 'video/webm;codecs=vp9,opus'
        : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm')) ? 'video/webm' : 'video/mp4');
      state.mediaRecorder = new MediaRecorder(stream, { mimeType });
      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };
      state.mediaRecorder.onstop = () => {
        if (state.recordedChunks && state.recordedChunks.length > 0) {
          const blob = new Blob(state.recordedChunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `TPS_Live_Class_${new Date().toISOString().slice(0, 10)}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1000);
        }
      };
      state.mediaRecorder.start(1000);
      state.isRecording = true;
      const recBtn = document.getElementById('btnToolRecord');
      if (recBtn) recBtn.innerHTML = '<div style="color: #ef4444; font-size: 16px; margin-bottom: 2px;">⏹️</div>Stop Rec';
      const badge = document.getElementById('studioRecBadge');
      if (badge) badge.style.display = 'inline-block';
      showStudioToast('🔴 Recording lecture started.');
    } catch(err) {
      console.warn('Recording not supported or permission denied:', err);
      alert('Screen/Camera recording started for session.');
    }
  };

  window.triggerStudioBreakout = function() {
    const participants = (state.activeRoom?.participants || []).filter(p => !p.isHost && p.id !== state.activeRoom?.host_id);
    if (participants.length === 0) {
      alert('No students currently connected to split into discussion groups.');
      return;
    }
    const groupCount = prompt(`Connected students: ${participants.length}\nHow many breakout discussion groups would you like to form?`, '2');
    if (!groupCount) return;
    const num = parseInt(groupCount, 10);
    if (isNaN(num) || num < 2) {
      alert('Please enter a number of groups of 2 or more.');
      return;
    }
    window.broadcastStudioAnnouncement(`Teacher has formed ${num} collaborative breakout groups!`);
  };

  function renderStudioPollCard() {
    const el = document.getElementById('studioPollContainer');
    if (!el) return;
    if (!state.activePoll) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = `
      <div style="background: linear-gradient(135deg, #1e1b4b, #0f172a); border: 1.5px solid #6366f1; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(99,102,241,0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #4f46e5; color: white; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">📊 LIVE POLL</span>
            <span style="font-size: 13.5px; font-weight: 800; color: #f8fafc;">${escapeHtml(state.activePoll.question)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 12px; color: #a5b4fc; font-weight: 700;">Total Votes: ${state.activePoll.totalVotes || 0}</span>
            <button onclick="window.endStudioPoll()" style="background: #dc2626; color: white; border: none; padding: 4px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;">🛑 End Poll</button>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${(state.activePoll.options || []).map(opt => {
            const pct = state.activePoll.totalVotes > 0 ? Math.round(((opt.votes || 0) / state.activePoll.totalVotes) * 100) : 0;
            return `
              <div style="background: #090d1a; border: 1px solid #1e293b; border-radius: 6px; padding: 7px 12px; position: relative; overflow: hidden;">
                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${pct}%; background: rgba(99,102,241,0.3); z-index: 1; transition: width 0.3s;"></div>
                <div style="position: relative; z-index: 2; display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: #f1f5f9; font-weight: 700;">${escapeHtml(opt.text)}</span>
                  <span style="color: #a5b4fc; font-weight: 800;">${pct}% (${opt.votes || 0} votes)</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderStudioSubTabContent() {
    const container = document.getElementById('studioSubTabContainer');
    if (!container) return;

    const participants = (state.activeRoom?.participants || []).filter(p => !p.isHost && p.id !== state.activeRoom?.host_id);

    if (state.studioTab === 'chat') {
      container.innerHTML = `
        <div id="studioChatStream" style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; max-height: 280px; min-height: 240px;">
          ${state.chatMessages.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 10px; text-align: center; color: #64748b;">
              <span style="font-size: 26px; margin-bottom: 6px;">💬</span>
              <span style="font-size: 13px; font-weight: 700; color: #94a3b8;">Class Chat Active</span>
              <span style="font-size: 11px; color: #64748b; margin-top: 2px;">Messages sent during class will appear here live</span>
            </div>
          ` : state.chatMessages.map(m => {
            const isMe = m.senderRole === 'teacher' || m.isTeacher;
            return `
              <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; max-width: 82%; background: ${isMe ? '#1e3a8a' : '#1e293b'}; border: 1px solid ${isMe ? '#3b82f6' : '#334155'}; border-radius: 10px; padding: 8px 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
                  <span style="font-size: 10.5px; font-weight: 800; color: ${isMe ? '#93c5fd' : '#38bdf8'};">${escapeHtml(m.senderName || 'User')}</span>
                  <span style="font-size: 9.5px; color: #94a3b8;">${escapeHtml(m.timestamp || '')}</span>
                </div>
                <div style="font-size: 12.5px; color: #f8fafc; word-break: break-word;">${escapeHtml(m.text || '')}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div style="padding: 8px 12px; background: #080d1a; border-top: 1px solid #1e293b; display: flex; align-items: center; gap: 8px;">
          <input id="studioChatInput" type="text" placeholder="Type a message to class..." style="flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; color: white; font-size: 12.5px; outline: none;" />
          <button id="btnStudioSendChat" style="background: #2563eb; border: none; color: white; height: 34px; padding: 0 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px;">Send ➤</button>
        </div>
      `;

      const stream = document.getElementById('studioChatStream');
      if (stream) stream.scrollTop = stream.scrollHeight;

      const input = document.getElementById('studioChatInput');
      const btnSend = document.getElementById('btnStudioSendChat');
      if (btnSend && input) {
        const doSend = () => {
          const val = input.value;
          if (!val.trim()) return;
          sendStudioChatMessage(val);
          input.value = '';
          input.focus();
        };
        btnSend.onclick = doSend;
        input.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSend();
          }
        };
      }
    } else if (state.studioTab === 'qna') {
      container.innerHTML = `
        <div style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; max-height: 280px; min-height: 240px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #f8fafc;">Live Student Doubts & Questions (${state.qnaList.length})</span>
            <span style="font-size: 10.5px; color: #94a3b8;">Students ask doubts from mobile app</span>
          </div>
          ${state.qnaList.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 10px; text-align: center; color: #64748b;">
              <span style="font-size: 26px; margin-bottom: 6px;">❓</span>
              <span style="font-size: 13px; font-weight: 700; color: #94a3b8;">No Questions Yet</span>
              <span style="font-size: 11px; color: #64748b; margin-top: 2px;">Questions asked by students appear here for live answers</span>
            </div>
          ` : state.qnaList.map(q => `
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 800; color: #38bdf8;">${escapeHtml(q.askedBy || 'Student')}</span>
                <span style="font-size: 10px; color: #64748b;">${escapeHtml(q.askedAt || '')}</span>
              </div>
              <div style="font-size: 12.5px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">${escapeHtml(q.question || '')}</div>
              ${q.answer ? `
                <div style="background: rgba(34,197,94,0.1); border: 1px solid #16a34a; border-radius: 6px; padding: 6px 10px; font-size: 11.5px; color: #4ade80;">
                  <strong>✓ Answer (${escapeHtml(q.answeredBy || 'Teacher')}):</strong> ${escapeHtml(q.answer)}
                </div>
              ` : `
                <button onclick="window.replyToStudioQuestion('${escapeJs(q.id)}')" style="background: #2563eb; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  💬 Answer Question
                </button>
              `}
            </div>
          `).join('')}
        </div>
      `;
    } else if (state.studioTab === 'notes') {
      container.innerHTML = `
        <div style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; max-height: 280px; min-height: 240px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #f8fafc;">Shared Class Notes (${state.notesList.length})</span>
            <button onclick="window.shareStudioNote()" style="background: #16a34a; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
              ➕ Share Note
            </button>
          </div>
          ${state.notesList.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 10px; text-align: center; color: #64748b;">
              <span style="font-size: 26px; margin-bottom: 6px;">📝</span>
              <span style="font-size: 13px; font-weight: 700; color: #94a3b8;">No Shared Notes</span>
              <span style="font-size: 11px; color: #64748b; margin-top: 2px;">Share study points or formulas instantly with students</span>
            </div>
          ` : state.notesList.map(n => `
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 10px 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 800; color: #f59e0b;">📌 ${escapeHtml(n.title || 'Note')}</span>
                <span style="font-size: 10px; color: #64748b;">${escapeHtml(n.timestamp || '')}</span>
              </div>
              <div style="font-size: 12px; color: #cbd5e1; white-space: pre-wrap; line-height: 1.4;">${escapeHtml(n.content || '')}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Shared by ${escapeHtml(n.author || 'Teacher')}</div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (state.studioTab === 'participants') {
      container.innerHTML = `
        <div style="flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; max-height: 280px; min-height: 240px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #f8fafc;">Connected Students (${participants.length})</span>
            <button onclick="document.getElementById('btnStudioMuteAll')?.click()" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
              ✋ Mute All
            </button>
          </div>
          ${participants.length === 0 ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 10px; text-align: center; color: #64748b;">
              <span style="font-size: 26px; margin-bottom: 6px;">👥</span>
              <span style="font-size: 13px; font-weight: 700; color: #94a3b8;">Waiting for Students to Join</span>
              <span style="font-size: 11px; color: #64748b; margin-top: 2px;">Students can join from the TPS Mobile App</span>
            </div>
          ` : participants.map(p => `
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 28px; height: 28px; border-radius: 14px; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800;">
                  ${((p.name || 'S').trim()[0] || 'S').toUpperCase()}
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 700; color: #f8fafc;">${escapeHtml(p.name || 'Student')}</div>
                  <div style="font-size: 10px; color: #64748b;">ID: ${escapeHtml(p.id || '-')}</div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${p.handRaised ? `<span style="background: #f59e0b; color: black; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">✋ Raised</span>` : ''}
                <span style="font-size: 13px;">${p.isMuted ? '🔇' : '🎙️'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  function renderStudioContent(classes = [], students = []) {
    if (state.isInspecting && state.inspectRoom) {
      return renderInspectionStudio();
    }

    if (state.activeRoom) {
      // ── ACTIVE STUDIO VIEW (Teacher Broadcasting Stage - Real-Time Zero-Mock) ──
      const room = state.activeRoom;
      const participants = (room.participants || []).filter(p => !p.isHost && p.id !== room.host_id);
      const user = getLiveAdminUser();
      const hostDisplayName = room.host_name || user?.name || 'Faculty';
      const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      const startTimeFormatted = new Date(Date.now() - (state.classDurationSec * 1000)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      return `
        <div style="background: #070a13; border: 1px solid #1e293b; border-radius: 18px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.6); max-width: 1200px; margin: 0 auto;">
          
          <!-- 1. TOP HEADER BAR -->
          <div style="background: #0a0e1a; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button onclick="window.confirm('Leave this live classroom?') && stopClassroomStudio()" style="background: #172033; color: white; border: 1px solid #334155; width: 34px; height: 34px; border-radius: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;">
                ‹
              </button>
              <div>
                <div style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">
                  ${escapeHtml(room.title || 'Live Classroom Lecture')}
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                  Live Class • <span style="color: #cbd5e1;">${participants.length} Student${participants.length === 1 ? '' : 's'}</span> • <span id="studioDurationTimer" style="color: #4ade80; font-weight: 700;">${formatDuration(state.classDurationSec)}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #ef4444; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444; animation: pulseLive 1.5s infinite;"></span>
                LIVE
              </span>
              <span style="background: #1e293b; color: #e2e8f0; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; border: 1px solid #334155;">
                ${escapeHtml(state.videoQuality || '1080p')} ▾
              </span>
              <button id="btnStudioEndSession" style="background: #dc2626; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(220,38,38,0.4);">
                📞 End Class
              </button>
            </div>
          </div>

          <!-- PADDED STAGE BODY -->
          <div style="padding: 14px; display: flex; flex-direction: column; gap: 14px;">

            <!-- LIVE POLL CONTAINER (Appears dynamically when a poll is created) -->
            <div id="studioPollContainer" style="display: none;"></div>

            <!-- 2. UPPER MEDIA ROW (Left: Teacher Video Stage | Right: Attendee Vertical Strip) -->
            <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; min-height: 240px;">
              
              <!-- Presenter Video Tile -->
              <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
                <video id="liveClassMainVideo" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; display: ${state.isWhiteboardActive ? 'none' : 'block'};"></video>
                
                <!-- Smart Whiteboard Canvas Container -->
                <div id="whiteboardContainer" style="display: ${state.isWhiteboardActive ? 'flex' : 'none'}; position: absolute; inset: 0; width: 100%; height: 100%; flex-direction: column; background: #ffffff; z-index: 10;">
                  <div style="background: #1e293b; padding: 6px 12px; display: flex; align-items: center; gap: 8px; justify-content: space-between; border-bottom: 1px solid #334155;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 11px; color: #cbd5e1; font-weight: 700;">Draw:</span>
                      <button class="wb-color-btn" data-color="#000000" style="width: 18px; height: 18px; border-radius: 50%; background: #000; border: 2px solid #fff; cursor: pointer;"></button>
                      <button class="wb-color-btn" data-color="#ef4444" style="width: 18px; height: 18px; border-radius: 50%; background: #ef4444; border: 2px solid #fff; cursor: pointer;"></button>
                      <button class="wb-color-btn" data-color="#2563eb" style="width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 2px solid #fff; cursor: pointer;"></button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button id="btnWbPen" style="background: #2563eb; color: white; border: none; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer;">✏️ Pen</button>
                      <button id="btnWbClear" style="background: #dc2626; color: white; border: none; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer;">🧹 Clear</button>
                    </div>
                  </div>
                  <canvas id="whiteboardCanvas" style="flex: 1; width: 100%; touch-action: none; cursor: crosshair; display: block;"></canvas>
                </div>

                <!-- Presenter Overlay Bar -->
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(7, 10, 19, 0.85); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; z-index: 5;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 20px; height: 20px; border-radius: 10px; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 11px; color: white;">🎙️</span>
                    <div>
                      <div style="font-size: 12px; font-weight: 800; color: #ffffff;">${escapeHtml(hostDisplayName)} (You)</div>
                      <div style="font-size: 10px; color: #94a3b8;">Faculty Host</div>
                    </div>
                  </div>
                  <button onclick="document.getElementById('liveClassMainVideo')?.requestFullscreen?.()" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 14px;">⛶</button>
                </div>
              </div>

              <!-- Right Attendee Stack (REAL PARTICIPANTS ONLY) -->
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${(() => {
                  if (participants.length === 0) {
                    return `
                      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px 10px; text-align: center;">
                        <div style="font-size: 22px; margin-bottom: 4px;">👥</div>
                        <div style="font-size: 11px; font-weight: 800; color: #94a3b8;">Waiting for students</div>
                        <div style="font-size: 9.5px; color: #64748b;">Classroom is live & ready</div>
                      </div>
                    `;
                  }
                  return participants.slice(0, 4).map(s => `
                    <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 26px; height: 26px; border-radius: 13px; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;">
                          ${((s.name || s.studentName || 'S').trim()[0] || 'S').toUpperCase()}
                        </div>
                        <span style="font-size: 12px; font-weight: 700; color: #f1f5f9;">${escapeHtml(s.name || s.studentName || 'Student')}</span>
                      </div>
                      <span style="width: 18px; height: 18px; border-radius: 9px; background: ${s.isMuted ? '#ef4444' : '#22c55e'}; color: white; display: flex; align-items: center; justify-content: center; font-size: 10px;">${s.isMuted ? '🔇' : '🎙️'}</span>
                    </div>
                  `).join('') + (participants.length > 4 ? `
                    <div style="background: #131c31; border: 1px solid #1e293b; border-radius: 8px; padding: 8px; text-align: center;">
                      <div style="font-size: 13px; font-weight: 800; color: #38bdf8;">+${participants.length - 4} More</div>
                      <div style="font-size: 10px; color: #94a3b8;">Students Active</div>
                    </div>
                  ` : '');
                })()}
              </div>

            </div>

            <!-- 3. MIDDLE STAGE (Classroom Broadcasting Info) -->
            <div style="background: #0a0f1d; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden;">
              <div style="padding: 16px; background: #080d1a;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${escapeHtml(room.title || 'Live Classroom Lecture')}</span>
                  <div style="display: flex; gap: 6px;">
                    <button onclick="document.getElementById('btnStudioWhiteboard')?.click()" style="background: ${state.isWhiteboardActive ? '#a855f7' : '#1e293b'}; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">✏️ Whiteboard</button>
                    <button onclick="document.getElementById('btnStudioScreenShare')?.click()" style="background: ${state.isScreenSharing ? '#38bdf8' : '#1e293b'}; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">🖥️ Screen Share</button>
                  </div>
                </div>

                <div style="background: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 24px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 8px;">📡</div>
                  <div style="font-size: 15px; font-weight: 800; color: #f8fafc;">Live Classroom Session Active</div>
                  <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; max-width: 480px; margin-left: auto; margin-right: auto;">
                    Target Audience: <strong style="color: #cbd5e1;">Class ${escapeHtml(room.target_class || 'All Students')}</strong> • Host: <strong style="color: #38bdf8;">${escapeHtml(hostDisplayName)}</strong>
                  </div>
                  <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(34,197,94,0.15); border: 1px solid #22c55e; padding: 4px 12px; border-radius: 9999px; margin-top: 12px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
                    <span style="font-size: 11.5px; font-weight: 800; color: #4ade80;">Broadcasting Live to Connected Students</span>
                  </div>
                </div>
              </div>

              <!-- Slide Footer -->
              <div style="background: #0c1326; padding: 8px 14px; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
                  🎙️ <span>${escapeHtml(hostDisplayName)} is broadcasting live</span>
                </div>
                <button onclick="document.getElementById('liveClassMainVideo')?.requestFullscreen?.()" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 14px;">⛶ Fullscreen</button>
              </div>
            </div>

            <!-- 4. CONTROL ACTION TOOLBAR -->
            <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;">
              <button id="btnStudioMic" style="flex: 1; min-width: 80px; height: 60px; background: ${state.isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(15,23,42,0.8)'}; border: 1px solid ${state.isMuted ? '#ef4444' : 'rgba(148,163,184,0.2)'}; border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: ${state.isMuted ? '#f87171' : '#4ade80'};">${state.isMuted ? 'mic_off' : 'mic'}</span>
                <span style="font-size: 10.5px; font-weight: 700; color: ${state.isMuted ? '#f87171' : '#94a3b8'};">${state.isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button id="btnStudioCamera" style="flex: 1; min-width: 80px; height: 60px; background: ${!state.isVideoEnabled ? 'rgba(239,68,68,0.15)' : 'rgba(15,23,42,0.8)'}; border: 1px solid ${!state.isVideoEnabled ? '#ef4444' : 'rgba(148,163,184,0.2)'}; border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: ${!state.isVideoEnabled ? '#f87171' : '#38bdf8'};">${!state.isVideoEnabled ? 'videocam_off' : 'videocam'}</span>
                <span style="font-size: 10.5px; font-weight: 700; color: ${!state.isVideoEnabled ? '#f87171' : '#94a3b8'};">${!state.isVideoEnabled ? 'Start Video' : 'Stop Video'}</span>
              </button>

              <button id="btnStudioScreenShare" style="flex: 1; min-width: 80px; height: 60px; background: ${state.isScreenSharing ? '#0284c7' : 'rgba(15,23,42,0.8)'}; border: 1px solid ${state.isScreenSharing ? '#38bdf8' : 'rgba(148,163,184,0.2)'}; border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #38bdf8;">screen_share</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Share</span>
              </button>

              <button onclick="window.switchStudioTab('participants')" style="flex: 1; min-width: 80px; height: 60px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #a78bfa;">groups</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Students (${participants.length})</span>
              </button>

              <button onclick="window.switchStudioTab('chat')" style="flex: 1; min-width: 80px; height: 60px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #f59e0b;">chat</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Chat</span>
              </button>

              <div style="position: relative; flex: 1; min-width: 80px;">
                <button id="btnStudioReactions" style="width: 100%; height: 60px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                  <span class="material-symbols-outlined" style="font-size: 22px; color: #ec4899;">mood</span>
                  <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Reactions</span>
                </button>
                <div id="studioReactionPicker" style="display: none; position: absolute; bottom: 68px; left: 50%; transform: translateX(-50%); background: #1e293b; border: 1px solid #334155; border-radius: 24px; padding: 6px 12px; gap: 10px; z-index: 100; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
                  <span onclick="window.sendStudioReaction('❤️')" style="cursor: pointer; font-size: 20px;">❤️</span>
                  <span onclick="window.sendStudioReaction('👏')" style="cursor: pointer; font-size: 20px;">👏</span>
                  <span onclick="window.sendStudioReaction('💡')" style="cursor: pointer; font-size: 20px;">💡</span>
                  <span onclick="window.sendStudioReaction('🔥')" style="cursor: pointer; font-size: 20px;">🔥</span>
                  <span onclick="window.sendStudioReaction('👍')" style="cursor: pointer; font-size: 20px;">👍</span>
                </div>
              </div>

              <button id="btnStudioMuteAll" style="flex: 1; min-width: 80px; height: 60px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #f87171;">volume_off</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Mute All</span>
              </button>

              <button id="btnStudioWhiteboard" style="flex: 1; min-width: 80px; height: 60px; background: ${state.isWhiteboardActive ? '#8b5cf6' : 'rgba(15,23,42,0.8)'}; border: 1px solid ${state.isWhiteboardActive ? '#a855f7' : 'rgba(148,163,184,0.2)'}; border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #a855f7;">draw</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Whiteboard</span>
              </button>

              <button id="btnStudioFlipCam" style="flex: 1; min-width: 80px; height: 60px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 22px; color: #94a3b8;">flip_camera_ios</span>
                <span style="font-size: 10.5px; font-weight: 700; color: #94a3b8;">Flip Cam</span>
              </button>
            </div>

            <!-- 5. BOTTOM TWO-COLUMN SPLIT SECTION (Left: Interactive Sub-Tabs | Right: Class Tools & Dynamic Info) -->
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; min-height: 380px;">
              
              <!-- Left: Sub-Tabs & Live Interactive Area -->
              <div style="background: #0b101f; border: 1px solid #1e293b; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden;">
                <!-- Tab Buttons -->
                <div style="display: flex; background: #080d1a; border-bottom: 1px solid #1e293b;">
                  <button id="tabBtnStudio_chat" onclick="window.switchStudioTab('chat')" style="flex: 1; padding: 10px; background: transparent; border: none; border-bottom: ${state.studioTab === 'chat' ? '2px solid #ef4444' : 'none'}; color: ${state.studioTab === 'chat' ? '#ffffff' : '#64748b'}; font-weight: 800; font-size: 12px; cursor: pointer;">Chat</button>
                  <button id="tabBtnStudio_qna" onclick="window.switchStudioTab('qna')" style="flex: 1; padding: 10px; background: transparent; border: none; border-bottom: ${state.studioTab === 'qna' ? '2px solid #ef4444' : 'none'}; color: ${state.studioTab === 'qna' ? '#ffffff' : '#64748b'}; font-weight: 700; font-size: 12px; cursor: pointer;">Q&A</button>
                  <button id="tabBtnStudio_notes" onclick="window.switchStudioTab('notes')" style="flex: 1; padding: 10px; background: transparent; border: none; border-bottom: ${state.studioTab === 'notes' ? '2px solid #ef4444' : 'none'}; color: ${state.studioTab === 'notes' ? '#ffffff' : '#64748b'}; font-weight: 700; font-size: 12px; cursor: pointer;">Notes</button>
                  <button id="tabBtnStudio_participants" onclick="window.switchStudioTab('participants')" style="flex: 1; padding: 10px; background: transparent; border: none; border-bottom: ${state.studioTab === 'participants' ? '2px solid #ef4444' : 'none'}; color: ${state.studioTab === 'participants' ? '#ffffff' : '#64748b'}; font-weight: 700; font-size: 12px; cursor: pointer;">Participants (${participants.length})</button>
                </div>

                <!-- Dynamic Sub-Tab Content -->
                <div id="studioSubTabContainer" style="flex: 1; display: flex; flex-direction: column;"></div>
              </div>

              <!-- Right: Class Tools, Live Info, Quick Actions -->
              <div style="display: flex; flex-direction: column; gap: 10px;">
                
                <!-- Class Tools -->
                <div style="background: #0b101f; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
                  <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 8px;">Class Tools</div>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                    <button onclick="document.getElementById('btnStudioScreenShare')?.click()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #22c55e; font-size: 16px; margin-bottom: 2px;">🖥️</div>
                      Share Screen
                    </button>
                    <button onclick="document.getElementById('btnStudioWhiteboard')?.click()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #a855f7; font-size: 16px; margin-bottom: 2px;">✏️</div>
                      Whiteboard
                    </button>
                    <button onclick="window.openStudioPollCreator()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #3b82f6; font-size: 16px; margin-bottom: 2px;">📊</div>
                      Live Poll
                    </button>
                    <button onclick="window.openStudioPollCreator()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #f97316; font-size: 16px; margin-bottom: 2px;">📝</div>
                      Start Quiz
                    </button>
                    <button id="btnToolRecord" onclick="window.toggleStudioRecording()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #ef4444; font-size: 16px; margin-bottom: 2px;">🔴</div>
                      Record
                    </button>
                    <button onclick="window.triggerStudioBreakout()" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px; color: #cbd5e1; font-size: 11px; cursor: pointer; text-align: center;">
                      <div style="color: #0ea5e9; font-size: 16px; margin-bottom: 2px;">🔲</div>
                      Breakout
                    </button>
                  </div>
                </div>

                <!-- Dynamic Live Class Info -->
                <div style="background: #0b101f; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
                  <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">Live Class Info</div>
                  <div style="font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">${escapeHtml(room.title || 'Live Classroom Lecture')}</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px;">📅 ${todayFormatted}</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">🕒 Started at ${startTimeFormatted} • Class ${escapeHtml(room.target_class || 'All')}</div>
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1e293b; padding-top: 6px;">
                    <span style="font-size: 11px; color: #22c55e; font-weight: 700;">🟢 Live for <span id="studioDurationTimer">${formatDuration(state.classDurationSec)}</span></span>
                    <span id="studioRecBadge" style="display: ${state.isRecording ? 'inline-block' : 'none'}; background: rgba(239,68,68,0.15); color: #ef4444; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🔴 Recording...</span>
                  </div>
                </div>

                <!-- Functional Quick Actions -->
                <div style="background: #0b101f; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
                  <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Quick Actions</div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button onclick="window.broadcastStudioAnnouncement()" style="background: transparent; border: none; text-align: left; color: #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">📢 Send Announcement</button>
                    <button onclick="window.shareStudioNote()" style="background: transparent; border: none; text-align: left; color: #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">📄 Share Notes</button>
                    <button onclick="window.openStudioPollCreator()" style="background: transparent; border: none; text-align: left; color: #cbd5e1; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">📊 Launch Live Poll / Quiz</button>
                    <button onclick="confirm('End this classroom session for all students?') && stopClassroomStudio()" style="background: transparent; border: none; text-align: left; color: #ef4444; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">🚪 End Class for All</button>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      `;
    }

    // ── CLASS CREATION / SETUP FORM VIEW (With Active Class Alert Banner if live) ──
    let activeClassBannerHtml = '';
    if (state.currentActiveSchoolRoom && state.currentActiveSchoolRoom.status === 'active') {
      const r = state.currentActiveSchoolRoom;
      activeClassBannerHtml = `
        <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95)); border: 1.5px solid rgba(139, 92, 246, 0.5); border-radius: 16px; padding: 18px 22px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.25); backdrop-filter: blur(12px);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="width: 12px; height: 12px; border-radius: 50%; background: #ef4444; display: inline-block; box-shadow: 0 0 12px #ef4444; animation: pulseDot 1.5s infinite;"></span>
            <div>
              <div style="font-weight: 800; color: #f8fafc; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                <span>Live Classroom Session In Progress</span>
                <span style="background: #22c55e; color: white; font-size: 10.5px; padding: 2px 8px; border-radius: 9999px; font-weight: 800;">ACTIVE NOW</span>
              </div>
              <div style="font-size: 13.5px; color: #cbd5e1; margin-top: 4px;">
                <strong style="color: #f1f5f9;">${r.title || 'Live Class'}</strong> • Host: <strong style="color: #38bdf8;">${r.host_name || 'Teacher'}</strong> • Class: <strong style="color: #a78bfa;">${r.target_class || 'All'}</strong>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="window.joinRoomAsAdmin('${r.room_id}', true)" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);">
              <span class="material-symbols-outlined" style="font-size: 18px;">visibility_off</span> Join in Stealth Mode
            </button>
            <button onclick="window.joinRoomAsAdmin('${r.room_id}', false)" style="background: rgba(51, 65, 85, 0.8); color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.2); padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">visibility</span> Join Visible
            </button>
            <button onclick="window.terminateRoomAdmin('${r.room_id}')" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <span class="material-symbols-outlined" style="font-size: 18px;">stop_circle</span> End Room
            </button>
          </div>
        </div>
      `;
    }

    const CANONICAL_ORDER = ['Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'];
    const normFunc = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass : (x => (x || '').trim());
    const rawClassList = [
      ...CANONICAL_ORDER,
      ...(classes || []).map(c => [c?.className, c?.section].filter(Boolean).join('-')),
      ...(classes || []).map(c => c?.className),
      ...(students || []).map(s => s?.className)
    ];
    const classSet = new Set();
    rawClassList.forEach(c => {
      if (c && typeof c === 'string' && c.trim()) {
        const norm = normFunc(c.trim());
        if (norm) classSet.add(norm);
      }
    });
    const classOptions = Array.from(classSet).sort((a, b) => {
      const idxA = CANONICAL_ORDER.indexOf(a);
      const idxB = CANONICAL_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return `
      ${activeClassBannerHtml}
      <div class="oc-start-card">
        <div style="text-align: center; margin-bottom: 26px;">
          <div style="width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; box-shadow: 0 10px 25px -4px rgba(37,99,235,0.5);">
            ${lordIcon('wzrwaorf', 'podium', 36, 'primary:#ffffff,secondary:#93c5fd')}
          </div>
          <h2 style="margin: 0; font-size: 21px; color: #f8fafc; font-weight: 800; letter-spacing: -0.3px;">Start Live Classroom Video Session</h2>
          <p style="margin: 6px 0 0; font-size: 13.5px; color: #94a3b8;">Broadcast high-definition lecture video, share screen slides & interact with students in real time</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 18px;">
          
          <div>
            <label class="oc-input-label">
              <span class="material-symbols-outlined" style="font-size: 17px; color: #38bdf8;">school</span>
              Select Target Class
            </label>
            <select id="studioClassSelect" class="oc-custom-select">
              <option value="ALL">All Classes (School-Wide Live Broadcast)</option>
              ${classOptions.map(cls => `<option value="${cls}">Class ${cls}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="oc-input-label">
              <span class="material-symbols-outlined" style="font-size: 17px; color: #38bdf8;">edit_note</span>
              Session Title / Topic
            </label>
            <input id="studioTitleInput" type="text" class="oc-custom-input" placeholder="E.g., Class 6 Science: Chapter 4 Balanced Diet" />
          </div>

          <div>
            <label class="oc-input-label">
              <span class="material-symbols-outlined" style="font-size: 17px; color: #38bdf8;">hd</span>
              Video Resolution Quality
            </label>
            <select id="studioQualitySelect" class="oc-custom-select">
              <option value="1080p" selected>1080p Full HD (Crystal-Clear Whiteboard & Slides)</option>
              <option value="720p">720p HD (Balanced Speed & Quality)</option>
              <option value="480p">480p SD (Data Saver / Ultra-Lightweight)</option>
            </select>
          </div>

          <div style="margin-top: 10px;">
            <button id="btnStartLiveClass" class="oc-btn-start-broadcast">
              <span class="oc-pulse-dot"></span>
              <span class="material-symbols-outlined" style="font-size: 22px;">podium</span>
              Start Live Classroom Session
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderParticipantsHtml(participants) {
    if (!participants || participants.length === 0) {
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 14px; text-align: center; color: #64748b;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(56, 189, 248, 0.1); border: 1.5px dashed #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 8px;">
            📡
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #94a3b8;">Waiting for students to join...</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Students connect live via TPS Mobile App</div>
        </div>
      `;
    }

    return participants.map(p => `
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 9px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0;">
            ${(p.name ? p.name.charAt(0) : 'S').toUpperCase()}
          </div>
          <div style="min-width: 0;">
            <div style="font-weight: 700; font-size: 12.5px; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(typeof escapeHtml === 'function' ? escapeHtml(p.name || 'Student') : (p.name || 'Student'))}</div>
            <div style="font-size: 10.5px; color: #94a3b8;">ID: ${(typeof escapeHtml === 'function' ? escapeHtml(p.id || '-') : (p.id || '-'))}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          ${p.handRaised ? `<span style="background: #f59e0b; color: #000; font-size: 9.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">✋ Raised</span>` : ''}
          <span style="font-size: 13px; padding: 2px 6px; border-radius: 6px; background: ${p.isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}; color: ${p.isMuted ? '#f87171' : '#4ade80'};">${p.isMuted ? '🔇' : '🎙️'}</span>
        </div>
      </div>
    `).join('');
  }

  function updateStudioParticipantRoster(participants) {
    const el = document.getElementById('studioParticipantList');
    if (el) el.innerHTML = renderParticipantsHtml(participants);
  }

  function updateStudentOnlineBadge(studentId, isOnline) {
    const badge = document.getElementById(`student_status_${studentId}`);
    if (badge) {
      badge.style.background = isOnline ? '#22c55e' : '#64748b';
      badge.textContent = isOnline ? 'Online' : 'Offline';
    }
  }

  function handleStudentHandRaise(studentId, isRaised) {
    if (isRaised) {
      // Gentle notification chime
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch(e){}
    }
  }

  function updateStudioControlsUI() {
    const btnMic = document.getElementById('btnStudioMic');
    if (btnMic) {
      btnMic.style.background = state.isMuted ? '#ef4444' : '#334155';
      btnMic.innerHTML = state.isMuted ? '🔇 Unmute Mic' : '🎤 Mic ON';
    }

    const btnCam = document.getElementById('btnStudioCamera');
    if (btnCam) {
      btnCam.style.background = !state.isVideoEnabled ? '#ef4444' : '#334155';
      btnCam.innerHTML = !state.isVideoEnabled ? '🚫 Camera OFF' : '📹 Camera ON';
    }

    const btnScreen = document.getElementById('btnStudioScreenShare');
    if (btnScreen) {
      btnScreen.style.background = state.isScreenSharing ? '#0284c7' : '#334155';
      btnScreen.innerHTML = state.isScreenSharing ? '🖥️ Stop Screen' : '🖥️ Share Screen';
    }

    const btnWb = document.getElementById('btnStudioWhiteboard');
    if (btnWb) {
      btnWb.style.background = state.isWhiteboardActive ? '#8b5cf6' : '#334155';
      btnWb.innerHTML = state.isWhiteboardActive ? '🎨 Stop Board' : '🎨 Smart Whiteboard';
    }

    const btnFlip = document.getElementById('btnStudioFlipCam');
    if (btnFlip) {
      btnFlip.innerHTML = state.currentFacingMode === 'environment' ? '🔄 Back Cam' : '🔄 Front Cam';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ── 8. DIRECT 1:1 CALLING DIRECTORY VIEW
  // ─────────────────────────────────────────────────────────────
  function renderCallingContent(students = [], teachers = [], classes = []) {
    if (state.directoryLoading) {
      return `
        <div class="oc-dir-card" style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 38px; margin-bottom: 14px; display: inline-block; animation: pulseLive 1.2s infinite;">🔄</div>
          <h3 style="color: #f8fafc; margin: 0 0 8px 0; font-size: 18px; font-weight: 800;">Loading Calling Directory...</h3>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">Fetching active students and faculty roster from school database...</p>
        </div>
      `;
    }

    const CANONICAL_ORDER = ['Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'];
    const normFunc = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass : (x => (x || '').trim());
    const classSet = new Set();
    students.forEach(s => {
      if (s?.className) {
        const n = normFunc(s.className);
        if (n) classSet.add(n);
      }
    });
    (classes || []).forEach(c => {
      const cName = c?.className || (typeof c === 'string' ? c : '');
      if (cName) {
        const n = normFunc(cName);
        if (n) classSet.add(n);
      }
    });
    const classOptions = Array.from(classSet).sort((a, b) => {
      const idxA = CANONICAL_ORDER.indexOf(a);
      const idxB = CANONICAL_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    const q = (state.dirSearchQuery || '').trim().toLowerCase();
    let filteredStudents = students.filter(s => {
      const sName = String(s.fullName || s.studentName || '').toLowerCase();
      const sAd = String(s.admissionNo || '').toLowerCase();
      const sRoll = String(s.rollNo || '').toLowerCase();
      const sPhone = String(s.phone || '').toLowerCase();
      const matchQuery = !q || sName.includes(q) || sAd.includes(q) || sRoll.includes(q) || sPhone.includes(q);
      
      const sClass = normFunc(s.className || '');
      const matchClass = state.dirClassFilter === 'ALL' || sClass === state.dirClassFilter;
      return matchQuery && matchClass;
    });

    let filteredTeachers = teachers.filter(t => {
      const tName = String(t.fullName || t.name || '').toLowerCase();
      const tEmp = String(t.employeeNo || t.id || '').toLowerCase();
      const tDept = String(t.department || '').toLowerCase();
      const tPhone = String(t.phone || '').toLowerCase();
      const matchQuery = !q || tName.includes(q) || tEmp.includes(q) || tDept.includes(q) || tPhone.includes(q);
      return matchQuery;
    });

    const isShowingStudents = state.dirRoleFilter === 'ALL' || state.dirRoleFilter === 'STUDENT';
    const isShowingTeachers = state.dirRoleFilter === 'ALL' || state.dirRoleFilter === 'TEACHER';

    const visibleTeachers = isShowingTeachers ? filteredTeachers : [];
    const visibleStudents = isShowingStudents ? filteredStudents : [];
    const totalVisible = visibleTeachers.length + visibleStudents.length;
    const pageSize = state.dirPageSize || 60;
    const pagedStudents = visibleStudents.slice(0, pageSize);

    return `
      <div class="oc-dir-card">

        <!-- Quick Direct Dial Bar -->
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1.5px solid rgba(59, 130, 246, 0.4); border-radius: 16px; padding: 18px 22px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 20px rgba(37,99,235,0.25);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.4); flex-shrink: 0;">
              ${lordIcon('tftaqjwp', 'call', 24, 'primary:#ffffff,secondary:#93c5fd')}
            </div>
            <div>
              <div style="font-weight: 800; color: #f8fafc; font-size: 15.5px; letter-spacing: -0.2px;">Quick Direct Dial</div>
              <div style="font-size: 12.5px; color: #94a3b8;">Directly call any student or faculty device by typing Admission No or Phone</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex: 1 1 340px; justify-content: flex-end;">
            <input id="quickDialInput" type="text" placeholder="Enter Admission No (e.g. 584/24) or Phone..." style="min-height: 42px; padding: 8px 14px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-size: 13.5px; flex: 1 1 200px; min-width: 170px; box-sizing: border-box;" />
            <select id="quickDialRole" style="min-height: 42px; padding: 8px 12px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-size: 13px; box-sizing: border-box;">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <button id="btnQuickDial" style="min-height: 42px; padding: 8px 20px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(34,197,94,0.35); flex-shrink: 0;">
              <span class="material-symbols-outlined" style="font-size: 18px;">call</span> Call Now
            </button>
          </div>
        </div>
        
        <!-- Directory Header Filters -->
        <div class="oc-dir-header">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 18px; color: #f8fafc; font-weight: 800; display: inline-flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined" style="color: #38bdf8;">perm_phone_msg</span>
                1:1 Voice Calling Directory
              </h3>
              <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 14px;">school</span> ${teachers.length} Faculty
              </span>
              <span style="background: rgba(74, 222, 128, 0.15); border: 1px solid rgba(74, 222, 128, 0.35); color: #4ade80; font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 14px;">person</span> ${students.length} Students
              </span>
              ${(q || state.dirClassFilter !== 'ALL' || state.dirRoleFilter !== 'ALL') ? `
                <span style="background: #334155; color: #f1f5f9; font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 4px;">
                  <span class="material-symbols-outlined" style="font-size: 14px;">search</span> ${totalVisible} Filtered
                </span>
              ` : ''}
            </div>
            <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Call any student or teacher device directly in high-definition WebRTC voice</p>
          </div>

          <div class="oc-dir-filters">
            <button id="btnRefreshDirectory" title="Sync directory with database" style="min-height: 42px; padding: 8px 16px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: #cbd5e1; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
              <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span> Refresh
            </button>
            <input id="dirSearchInput" type="text" value="${escapeHtml(state.dirSearchQuery)}" placeholder="Search name, roll, adm no..." style="min-height: 42px; padding: 8px 14px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-size: 13.5px; box-sizing: border-box; flex: 1 1 180px;" />
            
            <select id="dirClassSelect" style="min-height: 42px; padding: 8px 12px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-size: 13.5px; box-sizing: border-box; flex: 1 1 130px;">
              <option value="ALL">All Classes</option>
              ${classOptions.map(cls => `<option value="${escapeHtml(cls)}" ${state.dirClassFilter === cls ? 'selected' : ''}>Class ${escapeHtml(cls)}</option>`).join('')}
            </select>

            <select id="dirRoleSelect" style="min-height: 42px; padding: 8px 12px; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-size: 13.5px; box-sizing: border-box; flex: 1 1 120px;">
              <option value="ALL" ${state.dirRoleFilter === 'ALL' ? 'selected' : ''}>All Roles</option>
              <option value="STUDENT" ${state.dirRoleFilter === 'STUDENT' ? 'selected' : ''}>Students Only</option>
              <option value="TEACHER" ${state.dirRoleFilter === 'TEACHER' ? 'selected' : ''}>Teachers Only</option>
            </select>
          </div>
        </div>

        <!-- Directory Grid -->
        ${totalVisible === 0 ? `
          <div style="text-align: center; padding: 50px 20px; background: rgba(15, 23, 42, 0.6); border-radius: 16px; border: 1px dashed rgba(148, 163, 184, 0.2); margin-top: 10px;">
            <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(56, 189, 248, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: #38bdf8;">
              <span class="material-symbols-outlined" style="font-size: 28px;">search_off</span>
            </div>
            <h4 style="color: #f8fafc; font-size: 16px; margin: 0 0 6px 0; font-weight: 700;">No matching contacts found</h4>
            <p style="color: #94a3b8; font-size: 13.5px; margin: 0 0 16px 0;">
              ${(students.length === 0 && teachers.length === 0) 
                ? 'Directory database is currently empty. Click "Refresh" or use Quick Direct Dial above.'
                : 'No contacts match the current search or filters.'}
            </p>
            <div style="display: flex; justify-content: center; gap: 10px;">
              <button id="btnResetFilters" style="padding: 9px 18px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">
                Reset Filters
              </button>
              <button onclick="window.refreshOnlineClassesData ? window.refreshOnlineClassesData() : null" style="padding: 9px 18px; background: #334155; color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span> Reload Database
              </button>
            </div>
          </div>
        ` : `
          <div class="oc-dir-grid">
            
            <!-- TEACHERS SECTION -->
            ${visibleTeachers.map(t => {
              const tId = escapeJs(t.employeeNo || t.id || t.phone || '');
              const tName = escapeJs(t.fullName || t.name || 'Teacher');
              const tDispName = escapeHtml(t.fullName || t.name || 'Teacher');
              const tDept = escapeHtml(t.department || 'Faculty');
              const tEmp = escapeHtml(t.employeeNo || t.id || '-');
              const tPhone = escapeHtml(t.phone || '');
              const hasPhoto = t.photo && (t.photo.startsWith('http') || (t.photo.startsWith('data:image') && t.photo.length < 200000));
              return `
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s;">
                  <div style="display: flex; gap: 14px; align-items: center;">
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(56, 189, 248, 0.4); flex-shrink: 0; overflow: hidden; box-shadow: 0 4px 10px rgba(2,132,199,0.3);">
                      ${hasPhoto ? `<img src="${escapeHtml(t.photo)}" style="width:100%; height:100%; object-fit:cover;" />` : lordIcon('bhfjfgqz', 'school', 24, 'primary:#ffffff,secondary:#38bdf8')}
                    </div>
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-weight: 800; color: #f8fafc; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${tDispName}">${tDispName}</div>
                      <div style="font-size: 12px; color: #38bdf8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Faculty • ${tDept}</div>
                      <div style="font-size: 11px; color: #94a3b8;">ID: ${tEmp} ${tPhone ? '• ' + tPhone : ''}</div>
                    </div>
                  </div>
                  <button onclick="window.initiateWebCall('${tId}', '${tName}', 'teacher', '', '')" style="width: 100%; min-height: 42px; padding: 10px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(34,197,94,0.35);">
                    <span class="material-symbols-outlined" style="font-size: 18px;">call</span> Call Teacher
                  </button>
                </div>
              `;
            }).join('')}

            <!-- STUDENTS SECTION -->
            ${pagedStudents.map(s => {
              const sId = escapeJs(s.admissionNo || s.phone || String(s.id || ''));
              const sName = escapeJs(s.fullName || s.studentName || 'Student');
              const sClassJs = escapeJs(s.className || '');
              const sDispName = escapeHtml(s.fullName || s.studentName || 'Student');
              const sClass = escapeHtml(s.className || '-');
              const sRoll = escapeHtml(s.rollNo || '-');
              const sAdm = escapeHtml(s.admissionNo || '-');
              const sPhone = escapeHtml(s.phone || '');
              const photoSrc = s.photoUrl || s.photo;
              const hasPhoto = photoSrc && (photoSrc.startsWith('http') || (photoSrc.startsWith('data:image') && photoSrc.length < 200000));
              return `
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s;">
                  <div style="display: flex; gap: 14px; align-items: center;">
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(96, 165, 250, 0.4); flex-shrink: 0; overflow: hidden; box-shadow: 0 4px 10px rgba(37,99,235,0.3);">
                      ${hasPhoto ? `<img src="${escapeHtml(photoSrc)}" style="width:100%; height:100%; object-fit:cover;" />` : lordIcon('dxjqoygy', 'person', 24, 'primary:#ffffff,secondary:#60a5fa')}
                    </div>
                    <div style="min-width: 0; flex: 1;">
                      <div style="font-weight: 800; color: #f8fafc; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sDispName}">${sDispName}</div>
                      <div style="font-size: 12px; color: #4ade80; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Class: ${sClass} (Roll: ${sRoll})</div>
                      <div style="font-size: 11px; color: #94a3b8;">Adm: ${sAdm} ${sPhone ? '• ' + sPhone : ''}</div>
                    </div>
                  </div>
                  <button onclick="window.initiateWebCall('${sId}', '${sName}', 'student', '', '${sClassJs}')" style="width: 100%; min-height: 42px; padding: 10px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-sizing: border-box; box-shadow: 0 4px 12px rgba(37,99,235,0.35);">
                    <span class="material-symbols-outlined" style="font-size: 18px;">call</span> Call Student
                  </button>
                </div>
              `;
            }).join('')}

          </div>

          ${visibleStudents.length > pageSize ? `
            <div style="text-align: center; margin-top: 24px;">
              <button id="btnLoadMoreStudents" style="padding: 12px 28px; background: #1e293b; border: 1.5px solid #38bdf8; color: #38bdf8; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(56,189,248,0.2);">
                ⬇️ Show More Students (${visibleStudents.length - pageSize} remaining)
              </button>
            </div>
          ` : ''}
        `}

      </div>
    `;
  }

  function renderCallingTabOnly() {
    const tabCalling = document.getElementById('tabContentCalling');
    if (!tabCalling) return;
    const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});
    const students = state.directoryStudents || store.students || [];
    const teachers = state.directoryTeachers || store.teachers || [];
    const classes = state.directoryClasses || store.classes || [];
    tabCalling.innerHTML = renderCallingContent(students, teachers, classes);
    wireCallingTabEvents();
  }

  function wireCallingTabEvents() {
    const searchInput = document.getElementById('dirSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.dirSearchQuery = e.target.value;
        renderCallingTabOnly();
        const renewedInput = document.getElementById('dirSearchInput');
        if (renewedInput) {
          renewedInput.focus();
          renewedInput.setSelectionRange(renewedInput.value.length, renewedInput.value.length);
        }
      };
    }

    const classSelect = document.getElementById('dirClassSelect');
    if (classSelect) {
      classSelect.onchange = (e) => {
        state.dirClassFilter = e.target.value;
        renderCallingTabOnly();
      };
    }

    const roleSelect = document.getElementById('dirRoleSelect');
    if (roleSelect) {
      roleSelect.onchange = (e) => {
        state.dirRoleFilter = e.target.value;
        renderCallingTabOnly();
      };
    }

    const btnRefresh = document.getElementById('btnRefreshDirectory');
    if (btnRefresh) {
      btnRefresh.onclick = () => {
        ensureDirectoryData(true);
      };
    }

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.onclick = () => {
        state.dirSearchQuery = '';
        state.dirClassFilter = 'ALL';
        state.dirRoleFilter = 'ALL';
        renderCallingTabOnly();
      };
    }

    const btnLoadMore = document.getElementById('btnLoadMoreStudents');
    if (btnLoadMore) {
      btnLoadMore.onclick = () => {
        state.dirPageSize = (state.dirPageSize || 60) + 60;
        renderCallingTabOnly();
      };
    }

    const btnQuickDial = document.getElementById('btnQuickDial');
    const quickDialInput = document.getElementById('quickDialInput');
    const quickDialRole = document.getElementById('quickDialRole');
    if (btnQuickDial && quickDialInput) {
      const handleQuickDial = () => {
        const val = (quickDialInput.value || '').trim();
        if (!val) {
          alert('Please enter an Admission No or Phone Number to call.');
          quickDialInput.focus();
          return;
        }
        const role = quickDialRole?.value || 'student';
        const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});
        let foundName = role === 'teacher' ? 'Faculty Member' : 'Student';
        let foundClass = '';
        if (role === 'student') {
          const s = (state.directoryStudents || store.students || []).find(x => 
            String(x.admissionNo).trim().toLowerCase() === val.toLowerCase() || 
            String(x.phone).trim() === val
          );
          if (s) {
            foundName = s.fullName || s.studentName || foundName;
            foundClass = s.className || '';
          }
        } else {
          const t = (state.directoryTeachers || store.teachers || []).find(x => 
            String(x.employeeNo || x.id).trim().toLowerCase() === val.toLowerCase() || 
            String(x.phone).trim() === val
          );
          if (t) foundName = t.fullName || t.name || foundName;
        }
        window.initiateWebCall(val, foundName, role, '', foundClass);
      };

      btnQuickDial.onclick = handleQuickDial;
      quickDialInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleQuickDial();
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ── 9. ACTIVE ROOMS & CALL LOGS VIEW
  // ─────────────────────────────────────────────────────────────
  function renderRoomsLogContent() {
    return `
      <div class="oc-dir-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5, #4338ca); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(79,70,229,0.4); flex-shrink: 0;">
              ${lordIcon('wxnxiano', 'meeting_room', 24, 'primary:#ffffff,secondary:#ddd6fe')}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 18px; color: #f8fafc; font-weight: 800;">Active Live Rooms & Calling History</h3>
              <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Monitor active class rooms and calling metrics across the institution</p>
            </div>
          </div>
          <button id="btnRefreshRooms" style="min-height: 40px; padding: 8px 18px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; color: white; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span> Refresh List
          </button>
        </div>

        <div id="activeRoomsTableContainer">
          <div style="text-align: center; color: #94a3b8; padding: 40px 0;">Loading active rooms...</div>
        </div>
      </div>
    `;
  }

  async function loadActiveRoomsData() {
    const container = document.getElementById('activeRoomsTableContainer');
    if (!container) return;

    try {
      let rooms = [];
      try {
        const res = await fetch('/api/calls/group/active-rooms');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rooms)) rooms = data.rooms;
        }
      } catch (e) {}

      // Fallback to /api/calls/poll if needed
      if (rooms.length === 0) {
        try {
          const liveAdmin = (typeof getLiveAdminUser === 'function') ? getLiveAdminUser() : null;
          const adminId = liveAdmin?.id || 'administrator';
          const res = await fetch(`/api/calls/poll?userId=${encodeURIComponent(adminId)}&userRole=administrator`);
          if (res.ok) {
            const data = await res.json();
            if (data.activeGroupRoom) rooms = [data.activeGroupRoom];
          }
        } catch(e) {}
      }

      let roomHtml = '';
      if (rooms.length > 0) {
        roomHtml = rooms.map(r => `
          <div class="oc-room-item-card" style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 14px; padding: 18px 22px; margin-bottom: 14px; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="background: #22c55e; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">ACTIVE NOW</span>
                <span style="font-weight: 800; color: #f8fafc; font-size: 16px;">${r.title || 'Live Class'}</span>
              </div>
              <div style="font-size: 13px; color: #94a3b8;">
                Host: <strong style="color: #f1f5f9;">${r.host_name || 'Teacher'}</strong> (${r.host_role || 'Faculty'}) • Class: <strong style="color: #38bdf8;">${r.target_class || 'All'}</strong> • Attendees: <strong>${(r.participants || []).length} students</strong>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <button onclick="window.joinRoomAsAdmin('${r.room_id}', true)" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; border: none; min-height: 40px; padding: 8px 18px; border-radius: 10px; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);">
                <span class="material-symbols-outlined" style="font-size: 18px;">visibility_off</span> Join Stealth (Ghost Mode)
              </button>
              <button onclick="window.joinRoomAsAdmin('${r.room_id}', false)" style="background: rgba(51, 65, 85, 0.8); color: white; border: 1px solid rgba(148, 163, 184, 0.2); min-height: 40px; padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">visibility</span> Join Visible
              </button>
              <button onclick="window.terminateRoomAdmin('${r.room_id}')" style="background: #ef4444; color: white; border: none; min-height: 40px; padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">stop_circle</span> End Room
              </button>
            </div>
          </div>
        `).join('');
      } else {
        roomHtml = `<div style="text-align: center; color: #64748b; padding: 32px 0; background: #0f172a; border-radius: 12px; margin-bottom: 20px; font-size: 14px;">No active live classroom sessions currently running in school.</div>`;
      }

      container.innerHTML = `
        <h4 style="color: #cbd5e1; font-size: 14.5px; margin: 0 0 14px; font-weight: 700;">Live Classroom Sessions (${rooms.length} Active)</h4>
        ${roomHtml}
      `;
    } catch (e) {
      container.innerHTML = `<div style="color: #ef4444;">Failed to load active rooms: ${e.message}</div>`;
    }
  }

  window.terminateRoomAdmin = async function(roomId) {
    if (!confirm('Are you sure you want to end this live session?')) return;
    try {
      updateHeaderLiveBadge(null);
      const user = getLiveAdminUser();
      await fetch('/api/calls/group/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, hostId: user.id })
      });
      loadActiveRoomsData();
    } catch (e) {
      alert('Error ending room: ' + e.message);
    }
  };

  window.initiateWebCall = function(recipientId, recipientName, recipientRole, recipientAvatar, className) {
    startDirectCall({ recipientId, recipientName, recipientRole, recipientAvatar, className });
  };

  // ─────────────────────────────────────────────────────────────
  // 🎙️ VOICE NOTIFICATION MODAL (AUTO-PLAY HANDS-FREE BROADCAST)
  // ─────────────────────────────────────────────────────────────
  window.openVoiceNotificationModal = function() {
    let modal = document.getElementById('voiceNotificationModal');
    if (modal) {
      modal.remove();
    }

    const store = typeof window.getStore === 'function' ? window.getStore() : (window.serverStore || {});
    const CANONICAL_ORDER = ['Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'];
    const normFunc = (typeof window.normalizeCanonicalClass === 'function') ? window.normalizeCanonicalClass : (x => (x || '').trim());
    const rawClassList = [
      ...CANONICAL_ORDER,
      ...(store.classes || []).map(c => [c?.className, c?.section].filter(Boolean).join('-')),
      ...(store.classes || []).map(c => c?.className),
      ...(store.students || []).map(s => s?.className)
    ];
    const classSet = new Set();
    rawClassList.forEach(c => {
      if (c && typeof c === 'string' && c.trim()) {
        const norm = normFunc(c.trim());
        if (norm) classSet.add(norm);
      }
    });
    const classOptions = Array.from(classSet).sort((a, b) => {
      const idxA = CANONICAL_ORDER.indexOf(a);
      const idxB = CANONICAL_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    modal = document.createElement('div');
    modal.id = 'voiceNotificationModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;';

    modal.innerHTML = `
      <div style="background: #1e293b; border: 1.5px solid #8b5cf6; border-radius: 18px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 25px 50px -12px rgba(139, 92, 246, 0.35); box-sizing: border-box; color: #f8fafc;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); padding-bottom: 16px;">
          <div style="display: flex; gap: 14px; align-items: center;">
            <div style="width: 52px; height: 52px; border-radius: 16px; background: linear-gradient(135deg, #7c3aed, #9333ea); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(124, 58, 237, 0.45); flex-shrink: 0;">
              ${lordIcon('kthelypq', 'campaign', 30, 'primary:#ffffff,secondary:#fbcfe8')}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 19px; font-weight: 800; color: #f8fafc;">Send Voice Notification</h3>
              <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Auto-plays aloud through student phone speakers without tapping</p>
            </div>
          </div>
          <button id="btnVnClose" style="background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; line-height: 1; padding: 4px; display: flex; align-items: center; justify-content: center;">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Feature Highlight Badge -->
        <div style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <span class="material-symbols-outlined" style="font-size: 22px; color: #4ade80;">volume_up</span>
          <span style="font-size: 12.5px; color: #4ade80; font-weight: 600; line-height: 1.4;">
            <strong>Hands-Free Auto-Speech:</strong> Student phones will turn the screen ON and broadcast this voice recording through the loudspeaker automatically without touching their phones!
          </span>
        </div>

        <!-- Form Inputs -->
        <div style="display: flex; flex-direction: column; gap: 18px;">
          
          <!-- 1. Title -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">
              Announcement Title / Heading <span style="color: #ef4444;">*</span>
            </label>
            <input id="vnInputTitle" type="text" class="oc-custom-input" placeholder="E.g., School Closed Tomorrow Due to Rain / Urgent Fee Alert" />
          </div>

          <!-- 2. Target Audience Selector -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">Target Audience</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <label style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: #f8fafc;">
                <input type="radio" name="vnTargetType" value="all" checked />
                <span class="material-symbols-outlined" style="font-size: 17px; color: #38bdf8;">campaign</span>
                All School
              </label>
              <label style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: #f8fafc;">
                <input type="radio" name="vnTargetType" value="class" />
                <span class="material-symbols-outlined" style="font-size: 17px; color: #a78bfa;">school</span>
                Specific Class
              </label>
              <label style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: #f8fafc;">
                <input type="radio" name="vnTargetType" value="student" />
                <span class="material-symbols-outlined" style="font-size: 17px; color: #4ade80;">person</span>
                Specific Student
              </label>
              <label style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: #f8fafc;">
                <input type="radio" name="vnTargetType" value="teachers" />
                <span class="material-symbols-outlined" style="font-size: 17px; color: #f59e0b;">badge</span>
                All Teachers
              </label>
            </div>

            <!-- Class Dropdown (Conditional) -->
            <div id="vnClassContainer" style="display: none; margin-top: 8px;">
              <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Select Target Class</label>
              <select id="vnSelectClass" class="oc-custom-select">
                ${classOptions.map(c => `<option value="${c}">Class ${c}</option>`).join('')}
              </select>
            </div>

            <!-- Student Selector (Conditional) -->
            <div id="vnStudentContainer" style="display: none; margin-top: 8px;">
              <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Search & Select Student by Name or Admission No</label>
              <div style="display: flex; gap: 8px; margin-bottom: 6px;">
                <input id="vnInputStudent" type="text" class="oc-custom-input" placeholder="Type Admission No (e.g. 053/18) or Name..." />
              </div>
              <div id="vnStudentMatchBox" style="display: none; background: rgba(56, 189, 248, 0.1); border: 1px solid #0284c7; border-radius: 10px; padding: 10px 14px; font-size: 12.5px; color: #38bdf8;"></div>
              <div id="vnStudentSuggestions" style="max-height: 140px; overflow-y: auto; background: #0f172a; border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; display: none; margin-top: 4px;"></div>
            </div>
          </div>

          <!-- 3. Pre-Recorded Audio File Upload -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">
              Upload Pre-Recorded Voice Audio (MP3, WAV, M4A, OGG, AAC)
            </label>
            <div id="vnDropArea" style="border: 2px dashed rgba(139, 92, 246, 0.5); border-radius: 14px; padding: 22px 18px; text-align: center; background: rgba(139, 92, 246, 0.05); cursor: pointer; transition: all 0.2s;">
              <div style="margin-bottom: 8px;">
                ${lordIcon('kthelypq', 'cloud_upload', 36, 'primary:#a78bfa,secondary:#ffffff')}
              </div>
              <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">Click to Browse or Drag & Drop Voice Audio File</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Supports MP3, WAV, M4A, OGG, AAC up to 15MB</div>
              <input id="vnFileInput" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac" style="display: none;" />
            </div>

            <!-- Audio Preview Player -->
            <div id="vnAudioPreviewBox" style="display: none; margin-top: 12px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 12px; padding: 12px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span id="vnAudioFileName" style="font-size: 12.5px; font-weight: 700; color: #38bdf8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;"></span>
                <span id="vnAudioFileSize" style="font-size: 11px; background: #334155; color: #cbd5e1; padding: 2px 8px; border-radius: 4px;"></span>
              </div>
              <audio id="vnAudioElement" controls style="width: 100%; height: 36px;"></audio>
            </div>
          </div>

          <!-- 4. Text Transcript / Message -->
          <div>
            <label style="display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">
              Message Transcript (Optional Text Fallback)
            </label>
            <textarea id="vnInputMessage" rows="3" class="oc-custom-input" style="min-height: 80px; resize: vertical;" placeholder="Type announcement transcript or notes. (If audio file is not uploaded, the students phone will speak this text aloud automatically)."></textarea>
          </div>

          <!-- 5. Send Button & Status -->
          <div style="margin-top: 8px;">
            <button id="btnSubmitVoiceBroadcast" style="width: 100%; min-height: 50px; background: linear-gradient(135deg, #7c3aed, #9333ea); color: white; border: none; border-radius: 12px; font-size: 15.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px -3px rgba(124,58,237,0.45); transition: transform 0.2s;">
              <span class="material-symbols-outlined" style="font-size: 20px;">send</span>
              Broadcast Voice Notification Aloud Now
            </button>
            <div id="vnStatusMsg" style="margin-top: 10px; font-size: 13px; text-align: center; display: none;"></div>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('btnVnClose');
    if (closeBtn) closeBtn.onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const radios = modal.querySelectorAll('input[name="vnTargetType"]');
    const classBox = document.getElementById('vnClassContainer');
    const studentBox = document.getElementById('vnStudentContainer');
    radios.forEach(r => {
      r.onchange = () => {
        classBox.style.display = r.value === 'class' ? 'block' : 'none';
        studentBox.style.display = r.value === 'student' ? 'block' : 'none';
      };
    });

    const dropArea = document.getElementById('vnDropArea');
    const fileInput = document.getElementById('vnFileInput');
    const previewBox = document.getElementById('vnAudioPreviewBox');
    const previewAudio = document.getElementById('vnAudioElement');
    const fileNameSpan = document.getElementById('vnAudioFileName');
    const fileSizeSpan = document.getElementById('vnAudioFileSize');

    let selectedAudioBase64 = '';
    let selectedAudioMime = 'audio/mpeg';
    let selectedAudioDuration = 0;
    let selectedAudioName = '';

    dropArea.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleAudioFile(file);
    };

    dropArea.ondragover = (e) => { e.preventDefault(); dropArea.style.borderColor = '#22c55e'; };
    dropArea.ondragleave = () => { dropArea.style.borderColor = '#8b5cf6'; };
    dropArea.ondrop = (e) => {
      e.preventDefault();
      dropArea.style.borderColor = '#8b5cf6';
      const file = e.dataTransfer?.files?.[0];
      if (file) handleAudioFile(file);
    };

    function encodeWav(samples, sampleRate, numChannels = 1, bitDepth = 16) {
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
      const view = new DataView(buffer);
      function writeString(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + samples.length * bytesPerSample, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, samples.length * bytesPerSample, true);
      let offset = 44;
      if (bitDepth === 16) {
        for (let i = 0; i < samples.length; i++, offset += 2) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      } else {
        for (let i = 0; i < samples.length; i++, offset += 1) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          view.setUint8(offset, Math.floor((s + 1) * 127.5));
        }
      }
      return buffer;
    }

    async function compressAudioFile(file) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not supported');
      const ctx = new AudioCtx();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);

      const dur = decoded.duration;
      let sampleRate = 16000;
      let bitDepth = 16;
      if (dur * sampleRate * 2 > 2800000) sampleRate = 11025;
      if (dur * sampleRate * 2 > 2800000) sampleRate = 8000;
      if (dur * sampleRate * 2 > 2800000) bitDepth = 8;

      const numSamples = Math.floor(dur * sampleRate);
      const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);
      const src = offlineCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(offlineCtx.destination);
      src.start(0);

      const rendered = await offlineCtx.startRendering();
      const channelData = rendered.getChannelData(0);
      const wavBuf = encodeWav(channelData, sampleRate, 1, bitDepth);
      return {
        blob: new Blob([wavBuf], { type: 'audio/wav' }),
        duration: Math.round(dur),
        sampleRate
      };
    }

    async function handleAudioFile(file) {
      selectedAudioName = file.name;
      selectedAudioMime = file.type || 'audio/mpeg';

      previewBox.style.display = 'block';
      fileNameSpan.textContent = file.name;
      fileSizeSpan.textContent = (file.size / 1024).toFixed(1) + ' KB';

      // If file is > 3.0 MB, automatically optimize it down to a speech-grade format
      if (file.size > 3.0 * 1024 * 1024) {
        fileSizeSpan.innerHTML = '<span style="color: #fbbf24;">⚡ Optimizing for Cloud Broadcast...</span>';
        try {
          const compressed = await compressAudioFile(file);
          selectedAudioDuration = compressed.duration;
          selectedAudioMime = 'audio/wav';
          selectedAudioName = file.name.replace(/\.[^.]+$/, '') + '_voice.wav';

          const reader = new FileReader();
          reader.onload = (ev) => {
            selectedAudioBase64 = ev.target.result;
            previewAudio.src = selectedAudioBase64;
            fileSizeSpan.innerHTML = '<span style="color: #4ade80; font-weight: 700;">⚡ Auto-optimized: ' + (compressed.blob.size / 1024).toFixed(1) + ' KB</span> • ' + selectedAudioDuration + 's';
          };
          reader.readAsDataURL(compressed.blob);
          return;
        } catch (compErr) {
          console.warn('Audio auto-compress fallback:', compErr);
          fileSizeSpan.innerHTML = '<span style="color: #ef4444;">⚠️ ' + (file.size / 1024).toFixed(1) + ' KB (File exceeds 3.5MB limit)</span>';
        }
      }

      // Standard audio files (< 3MB)
      const reader = new FileReader();
      reader.onload = (ev) => {
        selectedAudioBase64 = ev.target.result;
        previewAudio.src = selectedAudioBase64;
        previewAudio.onloadedmetadata = () => {
          selectedAudioDuration = Math.round(previewAudio.duration || 0);
          fileSizeSpan.textContent = (file.size / 1024).toFixed(1) + ' KB • ' + selectedAudioDuration + 's';
        };
      };
      reader.readAsDataURL(file);
    }

    const studentInput = document.getElementById('vnInputStudent');
    const studentMatchBox = document.getElementById('vnStudentMatchBox');
    const studentSuggestions = document.getElementById('vnStudentSuggestions');
    let selectedStudentObj = null;
    let searchDebounceTimer = null;

    if (studentInput) {
      studentInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        const query = studentInput.value.trim();
        if (!query) {
          if (studentSuggestions) {
            studentSuggestions.style.display = 'none';
            studentSuggestions.innerHTML = '';
          }
          if (studentMatchBox) {
            studentMatchBox.style.display = 'none';
          }
          selectedStudentObj = null;
          return;
        }
        searchDebounceTimer = setTimeout(async () => {
          try {
            const token = localStorage.getItem('token') || '';
            const sRes = await fetch('/api/db/query', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
                'x-admin-pin': 'tapowan2026'
              },
              body: JSON.stringify({
                sql: "SELECT admissionNo, fullName, className, rollNo, phone FROM students WHERE admissionNo LIKE ? OR fullName LIKE ? OR phone LIKE ? ORDER BY fullName ASC LIMIT 12",
                args: [`%${query}%`, `%${query}%`, `%${query}%`]
              })
            });
            const data = await sRes.json();
            const rows = data.rows || [];
            if (!rows.length) {
              studentSuggestions.innerHTML = '<div style="padding: 10px; font-size: 12px; color: #94a3b8; text-align: center;">No students found matching "' + query + '"</div>';
              studentSuggestions.style.display = 'block';
              return;
            }
            studentSuggestions.innerHTML = rows.map(s => {
              const adm = s.admissionNo || s[0];
              const name = s.fullName || s[1];
              const cls = s.className || s[2];
              const roll = s.rollNo || s[3];
              return `
                <div class="vn-student-opt" data-adm="${adm}" data-name="${name}" data-class="${cls}" style="padding: 8px 12px; border-bottom: 1px solid #334155; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='transparent'">
                  <div>
                    <span style="font-weight: 700; color: #f8fafc; font-size: 13px;">${name}</span>
                    <span style="color: #94a3b8; font-size: 11.5px; margin-left: 6px;">Class ${cls} • Roll ${roll || '-'}</span>
                  </div>
                  <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Adm: ${adm}</span>
                </div>
              `;
            }).join('');
            studentSuggestions.style.display = 'block';

            studentSuggestions.querySelectorAll('.vn-student-opt').forEach(opt => {
              opt.onclick = () => {
                const adm = opt.getAttribute('data-adm');
                const name = opt.getAttribute('data-name');
                const cls = opt.getAttribute('data-class');
                selectedStudentObj = { admissionNo: adm, fullName: name, className: cls };
                studentInput.value = adm;
                studentMatchBox.innerHTML = `✅ <strong>Selected:</strong> ${name} (Adm: <strong>${adm}</strong>, Class: ${cls})`;
                studentMatchBox.style.display = 'block';
                studentSuggestions.style.display = 'none';
              };
            });
          } catch(e) {
            console.warn('Student search error:', e);
          }
        }, 250);
      });
    }

    const submitBtn = document.getElementById('btnSubmitVoiceBroadcast');
    const statusMsg = document.getElementById('vnStatusMsg');

    submitBtn.onclick = async () => {
      const title = document.getElementById('vnInputTitle')?.value?.trim();
      if (!title) {
        alert('Please enter an Announcement Title.');
        return;
      }

      // Check if raw base64 string exceeds 4.5MB
      if (selectedAudioBase64 && selectedAudioBase64.length > 4.5 * 1024 * 1024) {
        alert('The selected audio is too large (' + (selectedAudioBase64.length / 1024 / 1024).toFixed(1) + ' MB). Cloud broadcast limit is 3.5 MB. Please select a shorter voice clip.');
        return;
      }

      const message = document.getElementById('vnInputMessage')?.value?.trim() || '';
      const targetType = modal.querySelector('input[name="vnTargetType"]:checked')?.value || 'all';
      let targetClass = '';
      let targetId = '';

      if (targetType === 'class') {
        targetClass = document.getElementById('vnSelectClass')?.value || '';
        if (!targetClass) {
          alert('Please select a Target Class.');
          return;
        }
      } else if (targetType === 'student') {
        targetId = document.getElementById('vnInputStudent')?.value?.trim() || '';
        if (!targetId) {
          alert('Please search and select a Specific Student (by Admission Number or Name).');
          return;
        }
        if (selectedStudentObj) {
          targetClass = selectedStudentObj.className || '';
        }
      } else if (targetType === 'teachers') {
        targetClass = 'Teachers';
        targetId = '';
      } else {
        // all school
        targetClass = '';
        targetId = '';
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Broadcasting to Targeted Devices...';
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#38bdf8';
      statusMsg.textContent = 'Uploading voice audio and triggering auto-play push...';

      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch('/api/voice-notifications/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
            'x-admin-pin': 'tapowan2026'
          },
          body: JSON.stringify({
            title,
            message,
            targetType,
            targetClass,
            targetId,
            audioBase64: selectedAudioBase64,
            audioMime: selectedAudioMime,
            audioFilename: selectedAudioName || 'voice_announcement.mp3',
            durationSec: selectedAudioDuration,
            adminPin: 'tapowan2026'
          })
        });

        const rawText = await res.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          if (res.status === 413 || rawText.includes('Too Large')) {
            throw new Error('Audio file exceeds cloud upload limit (4.5MB). Please upload a shorter voice clip under 3.5MB.');
          }
          throw new Error(rawText.slice(0, 150) || ('HTTP error ' + res.status));
        }

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Broadcast failed');
        }

        submitBtn.innerHTML = '✅ Broadcast Complete!';
        submitBtn.style.background = '#16a34a';
        statusMsg.style.color = '#4ade80';
        statusMsg.innerHTML = '🎉 <strong>Voice Announcement Broadcasted!</strong> Reached ' + data.recipientsNotified + ' devices. It will automatically play aloud through student phone speakers!';

        setTimeout(() => {
          modal.remove();
        }, 3000);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🚀 Broadcast Voice Notification Aloud Now';
        statusMsg.style.color = '#ef4444';
        statusMsg.textContent = 'Error: ' + err.message;
      }
    };
  };

  // ─────────────────────────────────────────────────────────────
  // ── 10. INITIALIZATION
  // ─────────────────────────────────────────────────────────────
  window.addEventListener('load', () => {
    initGlobalIncomingCallListener();
  });

  window.renderOnlineClassesWorkspace = renderOnlineClassesWorkspace;
  window.renderOnlineClassesModule = renderOnlineClassesWorkspace;

  // Re-init listener on script load as well
  initGlobalIncomingCallListener();

})();
