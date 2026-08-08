import {
  DAYS,
  PERIODS,
  FREE_SUBJECT_ID,
  UNKNOWN_SUBJECT_ID,
  CLASSROOM_OPTIONS,
  emptyClassrooms,
  normalizeClassrooms,
  formatClassrooms,
  normalizeRosterName,
  normalizeScheduleIds,
  isFreeSubjectId,
  hasUnknownSubject,
  buildStudentLabel,
  groupStudentsBySubject,
  findClassmatesForCell,
  findMyClassmatesBySubject,
  findSharedClassesWithStudent,
  searchRosterStudents,
  formatRelativeReadAt,
  formatChatListTime,
  isChatMessageUnread,
} from './core.js?v=20260808-2048';

const SESSION_KEY = 'timetableSessionToken';
const COOLDOWN_MS = 10 * 60 * 1000;

const elements = {
  identityCard: document.getElementById('identityCard'),
  studentNo: document.getElementById('studentNo'),
  studentName: document.getElementById('studentName'),
  identityCheckBtn: document.getElementById('identityCheckBtn'),
  pinCard: document.getElementById('pinCard'),
  pinTitle: document.getElementById('pinTitle'),
  pinInput: document.getElementById('pinInput'),
  pinHelp: document.getElementById('pinHelp'),
  pinActionBtn: document.getElementById('pinActionBtn'),
  backToIdentityBtn: document.getElementById('backToIdentityBtn'),
  accountPanel: document.getElementById('accountPanel'),
  accountStudent: document.getElementById('accountStudent'),
  analysisQuota: document.getElementById('analysisQuota'),
  logoutBtn: document.getElementById('logoutBtn'),
  registrationCard: document.getElementById('registrationCard'),
  scheduleImage: document.getElementById('scheduleImage'),
  imagePreviewWrap: document.getElementById('imagePreviewWrap'),
  imagePreview: document.getElementById('imagePreview'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  analysisPanel: document.getElementById('analysisPanel'),
  editableScheduleWrap: document.getElementById('editableScheduleWrap'),
  saveBtn: document.getElementById('saveBtn'),
  lookupSearch: document.getElementById('lookupSearch'),
  studentList: document.getElementById('studentList'),
  lookupDay: document.getElementById('lookupDay'),
  lookupPeriod: document.getElementById('lookupPeriod'),
  timeLookupBtn: document.getElementById('timeLookupBtn'),
  timeLookupResults: document.getElementById('timeLookupResults'),
  myLookupScheduleWrap: document.getElementById('myLookupScheduleWrap'),
  myLookupScheduleUpdated: document.getElementById('myLookupScheduleUpdated'),
  myClassmatePanel: document.getElementById('myClassmatePanel'),
  myClassmateTitle: document.getElementById('myClassmateTitle'),
  myClassmateMeta: document.getElementById('myClassmateMeta'),
  myClassmateList: document.getElementById('myClassmateList'),
  studentScheduleCard: document.getElementById('studentScheduleCard'),
  selectedStudentTitle: document.getElementById('selectedStudentTitle'),
  selectedStudentUpdated: document.getElementById('selectedStudentUpdated'),
  readonlyScheduleWrap: document.getElementById('readonlyScheduleWrap'),
  classmatePanel: document.getElementById('classmatePanel'),
  classmateTitle: document.getElementById('classmateTitle'),
  classmateMeta: document.getElementById('classmateMeta'),
  classmateList: document.getElementById('classmateList'),
  classmateSearch: document.getElementById('classmateSearch'),
  classmateSearchResults: document.getElementById('classmateSearchResults'),
  myClassmateResults: document.getElementById('myClassmateResults'),
  friendSharedPanel: document.getElementById('friendSharedPanel'),
  friendSharedTitle: document.getElementById('friendSharedTitle'),
  friendSharedMeta: document.getElementById('friendSharedMeta'),
  friendSharedClasses: document.getElementById('friendSharedClasses'),
  friendFullScheduleBtn: document.getElementById('friendFullScheduleBtn'),
  friendChatBtn: document.getElementById('friendChatBtn'),
  chatThreadList: document.getElementById('chatThreadList'),
  chatRoom: document.getElementById('chatRoom'),
  chatPeerTitle: document.getElementById('chatPeerTitle'),
  chatReadStatus: document.getElementById('chatReadStatus'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSendBtn: document.getElementById('chatSendBtn'),
  chatBlockBtn: document.getElementById('chatBlockBtn'),
  chatReportBtn: document.getElementById('chatReportBtn'),
  chatBlockNotice: document.getElementById('chatBlockNotice'),
  chatNavUnread: document.getElementById('chatNavUnread'),
  chatSearch: document.getElementById('chatSearch'),
  chatSearchResults: document.getElementById('chatSearchResults'),
  chatBackBtn: document.getElementById('chatBackBtn'),
  chatPhotoBtn: document.getElementById('chatPhotoBtn'),
  chatImageInput: document.getElementById('chatImageInput'),
  chatPhotoPreview: document.getElementById('chatPhotoPreview'),
  chatPhotoPreviewImage: document.getElementById('chatPhotoPreviewImage'),
  chatPhotoRemoveBtn: document.getElementById('chatPhotoRemoveBtn'),
  chatImageLightbox: document.getElementById('chatImageLightbox'),
  chatImageLightboxImage: document.getElementById('chatImageLightboxImage'),
  chatImageLightboxClose: document.getElementById('chatImageLightboxClose'),
  groupCreateBtn: document.getElementById('groupCreateBtn'),
  groupInviteInbox: document.getElementById('groupInviteInbox'),
  groupCreateModal: document.getElementById('groupCreateModal'),
  groupCreateCloseBtn: document.getElementById('groupCreateCloseBtn'),
  groupNameInput: document.getElementById('groupNameInput'),
  groupMemberSearch: document.getElementById('groupMemberSearch'),
  groupMemberSearchResults: document.getElementById('groupMemberSearchResults'),
  groupSelectedMembers: document.getElementById('groupSelectedMembers'),
  groupCreateConfirmBtn: document.getElementById('groupCreateConfirmBtn'),
  groupInfoModal: document.getElementById('groupInfoModal'),
  groupInfoCloseBtn: document.getElementById('groupInfoCloseBtn'),
  groupRenameInput: document.getElementById('groupRenameInput'),
  groupRenameBtn: document.getElementById('groupRenameBtn'),
  groupMemberList: document.getElementById('groupMemberList'),
  groupInviteSearch: document.getElementById('groupInviteSearch'),
  groupInviteSearchResults: document.getElementById('groupInviteSearchResults'),
  groupLeaveBtn: document.getElementById('groupLeaveBtn'),
  chatRoomInfoBtn: document.getElementById('chatRoomInfoBtn'),
  chatRoomKind: document.getElementById('chatRoomKind'),
  toast: document.getElementById('toast'),
};

const config = normalizeSupabaseConfig(window.TIMETABLE_SUPABASE_CONFIG || {});

const state = {
  sessionToken: localStorage.getItem(SESSION_KEY) || '',
  profile: null,
  identity: null,
  pinMode: 'register',
  subjects: [],
  subjectsById: new Map(),
  students: [],
  roster: [],
  draftSchedule: null,
  draftClassrooms: emptyClassrooms(),
  selectedStudentNo: '',
  previewUrl: '',
  toastTimer: null,
  selectedClassmateNo: '',
  chatThreads: [],
  groupRooms: [],
  groupInvites: [],
  chatMessages: [],
  activeThreadId: 0,
  activeGroupId: 0,
  activeChatType: 'direct',
  activeChatPeer: null,
  activeGroupName: '',
  activeGroupMembers: [],
  groupSelectedInvitees: new Set(),
  chatLastMessageId: 0,
  directOtherReadId: 0,
  directOtherReadAt: null,
  chatBlocked: false,
  chatThreadTimer: null,
  chatRoomTimer: null,
  peerTyping: false,
  lastTypingPingAt: 0,
  pendingChatImage: null,
  chatImageUrls: new Map(),
};

fillSelect(elements.lookupDay, DAYS, (day) => `${day}요일`);
fillSelect(elements.lookupPeriod, PERIODS, (period) => `${period}교시`);
bindEvents();
await bootstrap();
setInterval(renderQuota, 1000);

function normalizeSupabaseConfig(value) {
  const url = String(value?.url || '').trim().replace(/\/+$/, '');
  const publishableKey = String(value?.publishableKey || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Supabase 연결 정보가 올바르지 않습니다.');
  }
  return { url, publishableKey };
}

async function rpc(name, params = {}) {
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.details || data?.hint || text || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data;
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.dataset.requiresRegistration === 'true' && !state.profile?.registered) {
        showToast('내 시간표를 먼저 저장해야 조회할 수 있습니다.', true);
        switchView('register');
        return;
      }
      switchView(button.dataset.nav);
      if (button.dataset.nav === 'lookup') await refreshStudents();
      if (button.dataset.nav === 'classmates') await refreshClassmateData();
      if (button.dataset.nav === 'chat') await enterChatView();
      else stopChatPolling();
    });
  });

  elements.studentName.addEventListener('blur', () => {
    elements.studentName.value = normalizeRosterName(elements.studentName.value);
  });
  elements.identityCheckBtn.addEventListener('click', checkIdentity);
  elements.pinActionBtn.addEventListener('click', submitPin);
  elements.backToIdentityBtn.addEventListener('click', backToIdentity);
  elements.pinInput.addEventListener('input', () => {
    elements.pinInput.value = String(elements.pinInput.value || '').replace(/\D/g, '').slice(0, 6);
  });
  elements.pinInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitPin();
  });
  elements.logoutBtn.addEventListener('click', logout);
  elements.friendChatBtn.addEventListener('click', startChatFromFriend);
  elements.chatSendBtn.addEventListener('click', sendChatMessage);
  elements.chatInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChatMessage(); } });
  elements.chatBlockBtn.addEventListener('click', toggleChatBlock);
  elements.chatReportBtn.addEventListener('click', reportChatUser);
  elements.chatSearch?.addEventListener('input', renderChatSearchResults);
  elements.chatBackBtn?.addEventListener('click', closeChatRoom);
  elements.chatInput?.addEventListener('input', handleChatTyping);
  elements.chatPhotoBtn?.addEventListener('click', () => { if (!state.chatBlocked) elements.chatImageInput?.click(); });
  elements.chatImageInput?.addEventListener('change', handleChatImageSelection);
  elements.chatPhotoRemoveBtn?.addEventListener('click', clearPendingChatImage);
  elements.chatImageLightboxClose?.addEventListener('click', closeChatImageLightbox);
  elements.chatImageLightbox?.addEventListener('click', (event) => { if (event.target === elements.chatImageLightbox) closeChatImageLightbox(); });
  elements.chatSendBtn?.addEventListener('pointerdown', (event) => event.preventDefault());
  elements.groupCreateBtn?.addEventListener('click', openGroupCreateModal);
  elements.groupCreateCloseBtn?.addEventListener('click', closeGroupCreateModal);
  elements.groupCreateModal?.addEventListener('click', (event) => { if (event.target === elements.groupCreateModal) closeGroupCreateModal(); });
  elements.groupMemberSearch?.addEventListener('input', renderGroupCreateSearch);
  elements.groupCreateConfirmBtn?.addEventListener('click', createGroupChat);
  elements.chatRoomInfoBtn?.addEventListener('click', () => { if (state.activeChatType === 'group') openGroupInfoModal(); });
  elements.groupInfoCloseBtn?.addEventListener('click', closeGroupInfoModal);
  elements.groupInfoModal?.addEventListener('click', (event) => { if (event.target === elements.groupInfoModal) closeGroupInfoModal(); });
  elements.groupRenameBtn?.addEventListener('click', renameActiveGroup);
  elements.groupInviteSearch?.addEventListener('input', renderGroupInviteSearch);
  elements.groupLeaveBtn?.addEventListener('click', leaveActiveGroup);
  elements.friendFullScheduleBtn.addEventListener('click', () => {
    if (!state.selectedClassmateNo) return;
    const targetNo = state.selectedClassmateNo;
    switchView('lookup');
    selectStudent(targetNo);
  });
  elements.scheduleImage.addEventListener('change', previewImage);
  elements.analyzeBtn.addEventListener('click', analyzeTimetable);
  elements.saveBtn.addEventListener('click', saveTimetable);
  elements.lookupSearch.addEventListener('input', renderStudentList);
  elements.classmateSearch.addEventListener('input', renderClassmateSearchResults);
  elements.lookupDay.addEventListener('change', renderTimeLookup);
  elements.lookupPeriod.addEventListener('change', renderTimeLookup);
  elements.timeLookupBtn.addEventListener('click', async () => { await refreshStudents(); renderTimeLookup(); });
}

async function bootstrap() {
  if (!state.sessionToken) {
    renderAccessState();
    return;
  }
  try {
    await loadProfile();
    if (!state.profile) throw new Error('SESSION_EXPIRED');
    await loadSubjects();
    if (state.profile.registered) {
      await refreshStudents();
      await loadRosterStudents();
      loadOwnScheduleIntoEditor();
    }
  } catch {
    clearSession();
  }
  renderAccessState();
}

async function checkIdentity() {
  const studentNo = String(elements.studentNo.value || '').trim();
  const name = normalizeRosterName(elements.studentName.value);
  elements.studentName.value = name;
  if (!/^\d{4}$/.test(studentNo)) {
    showToast('학번 4자리를 정확히 입력해주세요.', true);
    return;
  }
  if (!name) {
    showToast('이름을 입력해주세요.', true);
    return;
  }

  setButtonLoading(elements.identityCheckBtn, true, '명단 확인 중...');
  try {
    const row = firstRow(await rpc('check_student_identity', { p_student_no: studentNo, p_name: name }));
    if (!row?.valid) throw new Error('ROSTER_MISMATCH');
    state.identity = { studentNo: String(row.student_no), name: String(row.name) };
    state.pinMode = row.pin_set ? 'login' : 'register';
    elements.identityCard.hidden = true;
    elements.pinCard.hidden = false;
    elements.pinInput.value = '';
    elements.pinTitle.textContent = state.pinMode === 'register' ? '6자리 PIN 설정' : '6자리 PIN 로그인';
    elements.pinActionBtn.textContent = state.pinMode === 'register' ? 'PIN 설정하고 시작' : 'PIN으로 로그인';
    elements.pinHelp.textContent = state.pinMode === 'register'
      ? '본인만 기억할 6자리 숫자를 정하세요. 서버에는 PIN 원문이 저장되지 않습니다.'
      : '처음 등록할 때 정한 6자리 PIN을 입력하세요.';
    elements.pinInput.focus();
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    setButtonLoading(elements.identityCheckBtn, false);
  }
}

async function submitPin() {
  if (!state.identity) {
    backToIdentity();
    return;
  }
  const pin = String(elements.pinInput.value || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    showToast('PIN은 숫자 6자리로 입력해주세요.', true);
    return;
  }

  setButtonLoading(elements.pinActionBtn, true, state.pinMode === 'register' ? 'PIN 설정 중...' : '로그인 중...');
  try {
    const data = state.pinMode === 'register'
      ? await rpc('register_pin', { p_student_no: state.identity.studentNo, p_name: state.identity.name, p_pin: pin })
      : await rpc('login_with_pin', { p_student_no: state.identity.studentNo, p_pin: pin });
    const row = firstRow(data);
    if (!row?.ok) {
      const error = new Error(row?.message || 'PIN_ERROR');
      error.retryAfterSeconds = Number(row?.retry_after_seconds || 0);
      throw error;
    }
    setSession(String(row.session_token || ''));
    state.profile = {
      student_no: String(row.student_no),
      name: String(row.name),
      registered: Boolean(row.registered),
      analysis_count: Number(row.analysis_count || 0),
      last_analysis_at: row.last_analysis_at || null,
    };
    state.identity = null;
    elements.pinInput.value = '';
    await loadSubjects();
    if (state.profile.registered) {
      await refreshStudents();
      loadOwnScheduleIntoEditor();
    }
    renderAccessState();
    showToast(`${state.profile.name}님, 로그인됐습니다.`);
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    setButtonLoading(elements.pinActionBtn, false);
  }
}

function backToIdentity() {
  state.identity = null;
  elements.pinInput.value = '';
  elements.pinCard.hidden = true;
  elements.identityCard.hidden = false;
}

function setSession(token) {
  state.sessionToken = token;
  localStorage.setItem(SESSION_KEY, token);
}

function clearSession() {
  state.sessionToken = '';
  localStorage.removeItem(SESSION_KEY);
  state.profile = null;
  state.identity = null;
  state.subjects = [];
  state.subjectsById = new Map();
  state.students = [];
  state.roster = [];
  state.draftSchedule = null;
  state.draftClassrooms = emptyClassrooms();
  state.selectedStudentNo = '';
  state.selectedClassmateNo = '';
  stopChatPolling();
  state.chatThreads = []; state.chatMessages = []; state.activeThreadId = 0; state.activeChatPeer = null;
  if (elements.friendSharedPanel) elements.friendSharedPanel.hidden = true;
}

async function loadProfile() {
  if (!state.sessionToken) { state.profile = null; return null; }
  const row = firstRow(await rpc('session_profile', { p_session_token: state.sessionToken }));
  state.profile = row ? {
    student_no: String(row.student_no), name: String(row.name), registered: Boolean(row.registered),
    analysis_count: Number(row.analysis_count || 0), last_analysis_at: row.last_analysis_at || null,
  } : null;
  return state.profile;
}

async function loadSubjects() {
  const data = await rpc('list_subjects', { p_session_token: state.sessionToken });
  state.subjects = (Array.isArray(data) ? data : []).filter((row) => row?.active !== false);
  state.subjectsById = new Map(state.subjects.map((subject) => [subject.subject_id, subject.display_name]));
}

async function refreshStudents() {
  if (!state.profile?.registered) {
    state.students = [];
    renderAllLookups();
    return [];
  }
  const data = await rpc('list_students', { p_session_token: state.sessionToken });
  state.students = (Array.isArray(data) ? data : []).map((row) => ({
    studentNo: String(row.student_no),
    name: normalizeRosterName(row.name),
    schedule: normalizeScheduleIds(row.schedule),
    classrooms: normalizeClassrooms(row.classrooms),
    updatedAt: row.updated_at || '',
  }));
  renderAllLookups();
  return state.students;
}


async function loadRosterStudents() {
  if (!state.profile?.registered || !state.sessionToken) {
    state.roster = [];
    renderClassmateSearchResults();
    return [];
  }

  const data = await rpc('list_student_roster_for_search', {
    p_session_token: state.sessionToken,
  });

  state.roster = (Array.isArray(data) ? data : []).map((row) => ({
    studentNo: String(row.student_no),
    name: normalizeRosterName(row.name),
    registered: Boolean(row.registered),
  }));

  renderClassmateSearchResults();
  return state.roster;
}

async function refreshClassmateData() {
  await refreshStudents();
  await loadRosterStudents();
  renderMyClassmates();
  renderClassmateSearchResults();
}

function loadOwnScheduleIntoEditor() {
  if (!state.profile?.registered || state.draftSchedule) return;
  const own = state.students.find((student) => student.studentNo === state.profile.student_no);
  if (!own) return;
  state.draftSchedule = normalizeScheduleIds(own.schedule);
  state.draftClassrooms = normalizeClassrooms(own.classrooms);
  renderEditableSchedule(state.draftSchedule, state.draftClassrooms);
  elements.analysisPanel.hidden = false;
}

function renderAccessState() {
  const loggedIn = Boolean(state.sessionToken && state.profile);
  elements.identityCard.hidden = loggedIn || Boolean(state.identity);
  elements.pinCard.hidden = loggedIn || !state.identity;
  elements.accountPanel.hidden = !loggedIn;
  elements.registrationCard.hidden = !loggedIn;
  if (loggedIn) elements.accountStudent.textContent = `${state.profile.name} (${state.profile.student_no})`;

  const registered = Boolean(state.profile?.registered);
  document.querySelectorAll('[data-requires-registration="true"]').forEach((button) => {
    button.disabled = !registered;
    button.setAttribute('aria-disabled', String(!registered));
  });
  if (!registered) {
    const activeLocked = document.querySelector('.nav-button.is-active[data-requires-registration="true"]');
    if (activeLocked) switchView('register');
  }
  renderQuota();
}

function renderQuota() {
  if (!state.profile) return;
  const used = Number(state.profile.analysis_count || 0);
  const remaining = Math.max(0, 2 - used);
  const cooldown = getCooldownSeconds(state.profile);
  let text = `AI 분석 ${remaining}회 남음`;
  if (remaining > 0 && cooldown > 0) text += ` · ${formatDuration(cooldown)} 후 재분석`;
  elements.analysisQuota.textContent = text;
  const disabled = remaining <= 0 || cooldown > 0 || !state.sessionToken;
  elements.analyzeBtn.disabled = disabled;
  if (remaining <= 0) elements.analyzeBtn.textContent = 'AI 분석 2회 사용 완료';
  else if (cooldown > 0) elements.analyzeBtn.textContent = `${formatDuration(cooldown)} 후 재분석 가능`;
  else elements.analyzeBtn.textContent = '시간표 AI 분석';
}

function getCooldownSeconds(profile) {
  if (Number(profile?.analysis_count || 0) !== 1 || !profile?.last_analysis_at) return 0;
  const next = new Date(profile.last_analysis_at).getTime() + COOLDOWN_MS;
  return Math.max(0, Math.ceil((next - Date.now()) / 1000));
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function logout() {
  const token = state.sessionToken;
  try { if (token) await rpc('logout_session', { p_session_token: token }); } catch {}
  clearSession();
  elements.studentNo.value = '';
  elements.studentName.value = '';
  elements.pinInput.value = '';
  elements.analysisPanel.hidden = true;
  elements.studentScheduleCard.hidden = true;
  renderAccessState();
  showToast('로그아웃했습니다.');
}

function previewImage() {
  const file = elements.scheduleImage.files?.[0];
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = '';
  if (!file) {
    elements.imagePreviewWrap.hidden = true;
    elements.imagePreview.removeAttribute('src');
    return;
  }
  if (!file.type.startsWith('image/')) {
    elements.scheduleImage.value = '';
    showToast('이미지 파일만 선택할 수 있습니다.', true);
    return;
  }
  state.previewUrl = URL.createObjectURL(file);
  elements.imagePreview.src = state.previewUrl;
  elements.imagePreviewWrap.hidden = false;
}

async function analyzeTimetable() {
  if (!state.sessionToken || !state.profile) {
    showToast('먼저 학번과 PIN으로 로그인해주세요.', true);
    return;
  }
  const file = elements.scheduleImage.files?.[0];
  if (!file) {
    showToast('분석할 시간표 이미지를 선택해주세요.', true);
    return;
  }
  const cooldown = getCooldownSeconds(state.profile);
  if (Number(state.profile.analysis_count || 0) >= 2 || cooldown > 0) { renderQuota(); return; }

  setButtonLoading(elements.analyzeBtn, true, 'AI 분석 중...');
  try {
    const image = await fileToDataUrl(file);
    const result = await callAnalysis(image);
    state.draftSchedule = normalizeScheduleIds(result.schedule);
    state.draftClassrooms = normalizeClassrooms(result.classrooms || {});
    renderEditableSchedule(state.draftSchedule, state.draftClassrooms);
    elements.analysisPanel.hidden = false;
    await loadProfile();
    renderAccessState();
    elements.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('AI 분석이 끝났습니다. 모든 칸을 확인해주세요.');
  } catch (error) {
    try { await loadProfile(); } catch {}
    if (error?.attemptConsumed) {
      if (!state.draftSchedule) {
        state.draftSchedule = createUnknownSchedule();
        state.draftClassrooms = emptyClassrooms();
        renderEditableSchedule(state.draftSchedule, state.draftClassrooms);
        elements.analysisPanel.hidden = false;
      }
      renderAccessState();
      showToast('분석 요청 1회가 사용됐습니다. 결과가 없으면 드롭다운에서 직접 선택해주세요.', true);
    } else {
      showToast(humanizeError(error), true);
    }
  } finally {
    setButtonLoading(elements.analyzeBtn, false);
    renderQuota();
  }
}

function createUnknownSchedule() {
  return Object.fromEntries(DAYS.map((day) => [day, Array(7).fill(UNKNOWN_SUBJECT_ID)]));
}

async function callAnalysis(image) {
  const sessionToken = state.sessionToken;
  const response = await fetch(`${config.url}/functions/v1/analyze-timetable`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
      'X-Timetable-Session': sessionToken,
    },
    body: JSON.stringify({ image }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.message || `AI 분석 실패 (${response.status})`);
    error.status = response.status;
    error.retryAfterSeconds = Number(body.retry_after_seconds || 0);
    error.attemptConsumed = Boolean(body.attempt_consumed);
    throw error;
  }
  if (!body?.schedule) throw new Error('AI 분석 결과 형식이 올바르지 않습니다.');
  return body;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function renderEditableSchedule(schedule, classrooms = state.draftClassrooms) {
  elements.editableScheduleWrap.replaceChildren(buildScheduleTable(schedule, classrooms, true));
}

function renderReadonlySchedule(schedule, classrooms, onCellClick, roomResolver = null) {
  elements.readonlyScheduleWrap.replaceChildren(
    buildScheduleTable(schedule, classrooms, false, onCellClick, roomResolver)
  );
}

function buildScheduleTable(schedule, classrooms, editable, onCellClick, roomResolver = null) {
  const normalized = normalizeScheduleIds(schedule);
  const normalizedRooms = normalizeClassrooms(classrooms);
  const table = document.createElement('table');
  table.className = 'schedule-table';
  const thead = document.createElement('thead');
  const header = document.createElement('tr');
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = '교시';
  header.appendChild(corner);
  for (const day of DAYS) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = `${day}요일`;
    header.appendChild(th);
  }
  thead.appendChild(header);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  PERIODS.forEach((period, index) => {
    const row = document.createElement('tr');
    const periodHeader = document.createElement('th');
    periodHeader.scope = 'row';
    periodHeader.textContent = `${period}교시`;
    row.appendChild(periodHeader);
    for (const day of DAYS) {
      const td = document.createElement('td');
      const subjectId = normalized[day][index];
      if (editable) {
        const select = document.createElement('select');
        select.className = 'schedule-select';
        if (subjectId === UNKNOWN_SUBJECT_ID) select.classList.add('is-unknown');
        select.dataset.day = day;
        select.dataset.period = String(period);
        select.setAttribute('aria-label', `${day}요일 ${period}교시 과목 선택`);
        for (const subject of state.subjects) {
          const option = document.createElement('option');
          option.value = subject.subject_id;
          option.textContent = subject.subject_id === UNKNOWN_SUBJECT_ID ? '⚠ 미확인 - 과목 선택 필요' : subject.display_name;
          option.selected = subject.subject_id === subjectId;
          select.appendChild(option);
        }
        select.addEventListener('change', () => select.classList.toggle('is-unknown', select.value === UNKNOWN_SUBJECT_ID));
        const roomSelect = document.createElement('select');
        roomSelect.className = 'classroom-select';
        roomSelect.multiple = true;
        roomSelect.size = 2;
        roomSelect.dataset.day = day;
        roomSelect.dataset.period = String(period);
        roomSelect.setAttribute('aria-label', `${day}요일 ${period}교시 교실 선택 (복수 가능)`);
        const currentRooms = new Set(normalizedRooms[day][index]);
        for (const room of CLASSROOM_OPTIONS) {
          const roomOption = document.createElement('option');
          roomOption.value = room;
          roomOption.textContent = room;
          roomOption.selected = currentRooms.has(room);
          roomSelect.appendChild(roomOption);
        }
        const roomHint = document.createElement('span');
        roomHint.className = 'classroom-edit-hint';
        roomHint.textContent = '교실 · 복수선택 가능';
        td.append(select, roomHint, roomSelect);
      } else {
        const displayName = state.subjectsById.get(subjectId) || (subjectId === FREE_SUBJECT_ID ? '공강' : '미확인');
        td.className = `schedule-cell${isFreeSubjectId(subjectId) ? ' is-free' : ''}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-cell-button';
        const subjectText = document.createElement('span');
        subjectText.className = 'schedule-subject-name';
        subjectText.textContent = displayName;
        button.appendChild(subjectText);
        const storedRooms = normalizedRooms[day][index];
        const resolvedRooms = typeof roomResolver === 'function'
          ? roomResolver(subjectId, day, period, storedRooms)
          : storedRooms;
        const roomText = formatClassrooms(resolvedRooms);
        if (roomText && !isFreeSubjectId(subjectId)) {
          const room = document.createElement('span');
          room.className = 'schedule-classroom';
          room.textContent = roomText;
          button.appendChild(room);
        }
        button.addEventListener('click', () => onCellClick?.(day, period));
        td.appendChild(button);
      }
      row.appendChild(td);
    }
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function collectEditedSchedule() {
  const schedule = Object.fromEntries(DAYS.map((day) => [day, Array(7).fill(UNKNOWN_SUBJECT_ID)]));
  elements.editableScheduleWrap.querySelectorAll('.schedule-select').forEach((select) => {
    const day = select.dataset.day;
    const index = Number(select.dataset.period) - 1;
    if (DAYS.includes(day) && index >= 0 && index < 7) schedule[day][index] = select.value;
  });
  return normalizeScheduleIds(schedule);
}


function collectEditedClassrooms() {
  const classrooms = emptyClassrooms();
  elements.editableScheduleWrap.querySelectorAll('.classroom-select').forEach((select) => {
    const day = select.dataset.day;
    const index = Number(select.dataset.period) - 1;
    if (!DAYS.includes(day) || index < 0 || index >= 7) return;
    classrooms[day][index] = Array.from(select.selectedOptions).map((option) => option.value);
  });
  return normalizeClassrooms(classrooms);
}

async function saveTimetable() {
  if (!state.profile || !state.sessionToken) {
    showToast('먼저 학번과 PIN으로 로그인해주세요.', true);
    return;
  }
  const schedule = collectEditedSchedule();
  const classrooms = collectEditedClassrooms();
  if (hasUnknownSubject(schedule)) {
    showToast('미확인 칸이 있습니다. 모든 칸에서 실제 과목 또는 공강을 선택해주세요.', true);
    return;
  }
  setButtonLoading(elements.saveBtn, true, '저장 중...');
  try {
    const row = firstRow(await rpc('save_my_timetable', { p_session_token: state.sessionToken, p_schedule: schedule, p_classrooms: classrooms }));
    if (row) state.profile = { ...state.profile, ...row, registered: true };
    state.draftSchedule = schedule;
    state.draftClassrooms = classrooms;
    await loadProfile();
    await refreshStudents();
    renderAccessState();
    showToast(`${state.profile.name} 시간표가 저장됐습니다. 이제 조회할 수 있습니다.`);
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    setButtonLoading(elements.saveBtn, false);
  }
}

function renderAllLookups() {
  renderMyLookupSchedule();
  renderStudentList();
  renderTimeLookup();
  renderMyClassmates();
  renderClassmateSearchResults();
  if (state.selectedStudentNo) {
    const exists = state.students.some((student) => student.studentNo === state.selectedStudentNo);
    if (exists) selectStudent(state.selectedStudentNo, false);
    else elements.studentScheduleCard.hidden = true;
  }
}

function renderStudentList() {
  const query = String(elements.lookupSearch.value || '').trim().toLocaleLowerCase('ko-KR');
  const filtered = state.students.filter((student) => `${student.name} ${student.studentNo}`.toLocaleLowerCase('ko-KR').includes(query));
  elements.studentList.replaceChildren();
  if (!state.students.length) { elements.studentList.appendChild(createEmptyState('등록된 시간표가 없습니다.')); return; }
  if (!filtered.length) { elements.studentList.appendChild(createEmptyState('검색 결과가 없습니다.')); return; }
  for (const student of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'student-button';
    const textWrap = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = buildStudentLabel(student, state.students);
    const updated = document.createElement('span');
    updated.textContent = student.updatedAt ? `업데이트 ${formatUpdatedAt(student.updatedAt)}` : '등록됨';
    textWrap.append(strong, updated);
    const action = document.createElement('strong');
    action.textContent = '보기';
    action.style.color = 'var(--primary)';
    button.append(textWrap, action);
    button.addEventListener('click', () => selectStudent(student.studentNo));
    elements.studentList.appendChild(button);
  }
}

function selectStudent(studentNo, shouldScroll = true) {
  const student = state.students.find((item) => item.studentNo === String(studentNo));
  if (!student) return;
  state.selectedStudentNo = student.studentNo;
  elements.selectedStudentTitle.textContent = `${buildStudentLabel(student, state.students)} 시간표`;
  elements.selectedStudentUpdated.textContent = student.updatedAt ? `마지막 저장: ${formatUpdatedAt(student.updatedAt)}` : '';
  renderReadonlySchedule(
    student.schedule,
    student.classrooms,
    (day, period) => renderClassmatesForCell(student.studentNo, day, period),
    (subjectId, day, period, storedRooms) =>
      getCanonicalClassroomsForSlot(subjectId, day, period, storedRooms),
  );
  elements.classmatePanel.hidden = true;
  elements.studentScheduleCard.hidden = false;
  if (shouldScroll) elements.studentScheduleCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function getCanonicalClassroomsForSubject(subjectId, day = '', period = 0, preferredRooms = []) {
  const wanted = String(subjectId || '').trim();
  if (!wanted || wanted === FREE_SUBJECT_ID || wanted === UNKNOWN_SUBJECT_ID) {
    return Array.isArray(preferredRooms) ? preferredRooms : [];
  }

  const preferred = Array.isArray(preferredRooms) ? preferredRooms.filter(Boolean) : [];
  const scores = new Map();

  const addCandidate = (rooms, weight = 1) => {
    const normalized = Array.isArray(rooms) ? rooms.filter(Boolean) : [];
    const label = formatClassrooms(normalized);
    if (!label) return;
    const current = scores.get(label) || { score: 0, rooms: normalized };
    current.score += weight;
    scores.set(label, current);
  };

  // 1) 내가 이 과목을 듣고 있다면 내 시간표의 과목-교실 연결을 가장 강한 기준으로 사용.
  const me = state.students.find(
    (student) => student.studentNo === String(state.profile?.student_no || '')
  );

  if (me) {
    const mySchedule = normalizeScheduleIds(me.schedule);
    const myClassrooms = normalizeClassrooms(me.classrooms);

    for (const d of DAYS) {
      PERIODS.forEach((p, index) => {
        if (mySchedule[d][index] === wanted && myClassrooms[d][index].length) {
          addCandidate(myClassrooms[d][index], 100);
        }
      });
    }
  }

  // 2) 전체 학생 데이터에서 "이 과목과 실제로 함께 저장된 교실" 빈도를 누적.
  for (const student of state.students) {
    const schedule = normalizeScheduleIds(student.schedule);
    const classrooms = normalizeClassrooms(student.classrooms);

    for (const d of DAYS) {
      PERIODS.forEach((p, index) => {
        if (schedule[d][index] !== wanted) return;
        const rooms = classrooms[d][index];
        if (!rooms.length) return;

        // 전체 과목-교실 일치도
        addCandidate(rooms, 4);

        // 현재 조회 중인 정확한 요일·교시라면 추가 가중치
        if (d === day && Number(p) === Number(period)) addCandidate(rooms, 3);
      });
    }
  }

  // 3) 호출자가 가진 정확한 셀 교실은 동점일 때 살리는 정도로만 반영.
  if (preferred.length) addCandidate(preferred, 1);

  if (!scores.size) return preferred;

  return Array.from(scores.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return formatClassrooms(a.rooms).localeCompare(formatClassrooms(b.rooms), 'ko-KR');
    })[0].rooms;
}

function getCanonicalClassroomsForSlot(subjectId, day, period, preferredRooms = []) {
  return getCanonicalClassroomsForSubject(subjectId, day, period, preferredRooms);
}

function getResolvedRoomsForStudentSlot(student, day, period) {
  if (!student) return [];
  const index = PERIODS.indexOf(Number(period));
  if (!DAYS.includes(day) || index < 0) return [];

  const schedule = normalizeScheduleIds(student.schedule);
  const classrooms = normalizeClassrooms(student.classrooms);
  const subjectId = schedule[day][index];
  const exactRooms = classrooms[day][index];

  // 개인 시간표/같이 듣는 친구 화면은 해당 학생의 실제 셀 값을 우선.
  if (exactRooms.length) return exactRooms;

  // 누락된 경우에만 과목 기준 합의값으로 보완.
  return getCanonicalClassroomsForSubject(subjectId, day, period, []);
}

function renderMyLookupSchedule() {
  if (!elements.myLookupScheduleWrap) return;

  if (!state.profile?.registered) {
    elements.myLookupScheduleWrap.replaceChildren(createEmptyState('시간표를 등록하면 내 시간표가 표시됩니다.'));
    if (elements.myLookupScheduleUpdated) elements.myLookupScheduleUpdated.textContent = '';
    return;
  }

  const me = state.students.find((student) => student.studentNo === String(state.profile.student_no));

  if (!me) {
    elements.myLookupScheduleWrap.replaceChildren(createEmptyState('내 시간표 정보를 불러오는 중입니다.'));
    return;
  }

  if (elements.myLookupScheduleUpdated) {
    elements.myLookupScheduleUpdated.textContent = me.updatedAt
      ? `마지막 저장: ${formatUpdatedAt(me.updatedAt)}`
      : '';
  }

  const table = buildScheduleTable(
    me.schedule,
    me.classrooms,
    false,
    (day, period) => renderClassmatesForCell(me.studentNo, day, period, {
      panel: elements.myClassmatePanel,
      title: elements.myClassmateTitle,
      meta: elements.myClassmateMeta,
      list: elements.myClassmateList,
    }),
    (subjectId, day, period, storedRooms) =>
      getCanonicalClassroomsForSlot(subjectId, day, period, storedRooms),
  );

  elements.myLookupScheduleWrap.replaceChildren(table);
}


function renderTimeLookup() {
  if (!state.profile?.registered) return;
  const day = elements.lookupDay.value || DAYS[0];
  const period = Number(elements.lookupPeriod.value || 1);
  const groups = groupStudentsBySubject(state.students, state.subjectsById, day, period);
  elements.timeLookupResults.replaceChildren();
  if (!groups.length) { elements.timeLookupResults.appendChild(createEmptyState('조회할 학생이 없습니다.')); return; }
  for (const group of groups) {
    const section = document.createElement('section');
    section.className = `subject-group${group.isFree ? ' is-free' : ''}`;
    const heading = document.createElement('div');
    heading.className = 'subject-group__heading';
    const subject = document.createElement('strong');
    subject.textContent = group.subject;
    const count = document.createElement('span');
    count.textContent = `${group.students.length}명`;
    heading.append(subject, count);
    const resolvedRooms = getCanonicalClassroomsForSubject(
      group.subjectId,
      day,
      period,
      [],
    );

    const classrooms = document.createElement('div');
    classrooms.className = 'subject-group__classrooms';
    classrooms.textContent = formatClassrooms(resolvedRooms);
    classrooms.hidden = group.isFree || resolvedRooms.length === 0;

    const names = document.createElement('div');
    names.className = 'subject-group__students';
    for (const studentRef of group.students) {
      const student = state.students.find((item) => item.studentNo === studentRef.studentNo) || studentRef;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'student-chip';
      chip.textContent = buildStudentLabel(student, state.students);
      chip.addEventListener('click', () => selectStudent(studentRef.studentNo));
      names.appendChild(chip);
    }
    section.append(heading, classrooms, names);
    elements.timeLookupResults.appendChild(section);
  }
}

function renderClassmatesForCell(studentNo, day, period, target = null) {
  const match = findClassmatesForCell(state.students, state.subjectsById, studentNo, day, period);
  if (!match) return;

  const panel = target?.panel || elements.classmatePanel;
  const title = target?.title || elements.classmateTitle;
  const meta = target?.meta || elements.classmateMeta;
  const list = target?.list || elements.classmateList;
  if (!panel || !title || !meta || !list) return;

  title.textContent = match.subjectId === FREE_SUBJECT_ID ? '같이 공강인 친구' : `${match.subject} 같이 듣는 친구`;
  const selectedStudent = state.students.find((student) => student.studentNo === String(studentNo));
  const roomText = formatClassrooms(getResolvedRoomsForStudentSlot(selectedStudent, day, period));
  meta.textContent = `${day}요일 ${period}교시${roomText ? ` · ${roomText}` : ''} · 전체 ${match.students.length}명`;
  list.replaceChildren();
  if (!match.classmates.length) list.appendChild(createEmptyState('같은 시간에 함께 있는 다른 친구가 없습니다.'));
  else {
    for (const studentRef of match.classmates) {
      const student = state.students.find((item) => item.studentNo === studentRef.studentNo) || studentRef;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'student-chip';
      chip.textContent = buildStudentLabel(student, state.students);
      chip.addEventListener('click', () => selectStudent(studentRef.studentNo));
      list.appendChild(chip);
    }
  }
  panel.hidden = false;
}


function renderClassmateSearchResults() {
  if (!state.profile?.registered) return;

  const query = String(elements.classmateSearch.value || '').trim();
  elements.classmateSearchResults.replaceChildren();

  if (!query) {
    const hint = document.createElement('p');
    hint.className = 'classmate-search-hint';
    hint.textContent = '친구 이름이나 학번을 입력하면 등록 여부와 같이 듣는 수업을 확인할 수 있습니다.';
    elements.classmateSearchResults.appendChild(hint);
    return;
  }

  const results = searchRosterStudents(
    state.roster,
    query,
    state.profile.student_no,
  );

  if (!results.length) {
    elements.classmateSearchResults.appendChild(createEmptyState('해당 이름 또는 학번의 학생을 찾지 못했습니다.'));
    return;
  }

  for (const result of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `classmate-search-result${result.registered ? '' : ' is-unregistered'}`;

    const main = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${result.name} (${result.studentNo})`;
    const status = document.createElement('span');
    status.textContent = result.registered
      ? '시간표 등록됨 · 눌러서 같이 듣는 수업 확인'
      : '아직 시간표를 등록하지 않았어요';
    main.append(name, status);

    const badge = document.createElement('span');
    badge.className = `registration-status${result.registered ? ' is-registered' : ''}`;
    badge.textContent = result.registered ? '등록됨' : '미등록';

    button.append(main, badge);
    button.addEventListener('click', () => {
      if (!result.registered) {
        showToast(`${result.name}님은 아직 시간표를 등록하지 않았어요.`);
        return;
      }

      const registeredStudent = state.students.find((student) => student.studentNo === result.studentNo);
      if (!registeredStudent) {
        showToast('등록 정보가 갱신 중입니다. 잠시 후 다시 확인해주세요.', true);
        return;
      }

      renderFriendSharedClasses(result.studentNo);
    });

    elements.classmateSearchResults.appendChild(button);
  }
}

function renderMyClassmates() {
  if (!state.profile?.registered) return;

  const groups = findMyClassmatesBySubject(
    state.students,
    state.subjectsById,
    state.profile.student_no,
  );

  elements.myClassmateResults.replaceChildren();

  if (!groups.length) {
    elements.myClassmateResults.appendChild(createEmptyState('표시할 수업이 없습니다. 내 시간표를 확인해주세요.'));
    return;
  }

  for (const group of groups) {
    const card = document.createElement('article');
    card.className = 'card classmate-subject-card';

    const heading = document.createElement('div');
    heading.className = 'classmate-subject-card__heading';

    const titleWrap = document.createElement('div');
    const kicker = document.createElement('p');
    kicker.className = 'section-kicker';
    kicker.textContent = '내 수업';
    const title = document.createElement('h3');
    title.textContent = group.subject;

    const resolvedRoomLabels = Array.from(new Set(
      group.slots
        .map((slot) => {
          const me = state.students.find((student) => student.studentNo === String(state.profile.student_no));
          const rooms = getResolvedRoomsForStudentSlot(me, slot.day, slot.period);
          return formatClassrooms(rooms);
        })
        .filter(Boolean)
    ));

    const room = document.createElement('p');
    room.className = 'classmate-subject-card__room';
    room.textContent = resolvedRoomLabels.join(' · ');
    room.hidden = resolvedRoomLabels.length === 0;

    titleWrap.append(kicker, title, room);

    const count = document.createElement('span');
    count.className = 'classmate-count';
    count.textContent = `${group.classmates.length}명`;
    heading.append(titleWrap, count);

    const slotList = document.createElement('div');
    slotList.className = 'classmate-slot-list';
    for (const slot of group.slots) {
      const badge = document.createElement('span');
      badge.className = 'classmate-slot';
      badge.textContent = `${slot.day}요일 ${slot.period}교시`;
      slotList.appendChild(badge);
    }

    const friends = document.createElement('div');
    friends.className = 'classmate-list';

    if (!group.classmates.length) {
      friends.appendChild(createEmptyState('같은 시간에 이 과목을 함께 듣는 친구가 없습니다.'));
    } else {
      for (const studentRef of group.classmates) {
        const student = state.students.find((item) => item.studentNo === studentRef.studentNo) || studentRef;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'student-chip';
        chip.textContent = buildStudentLabel(student, state.students);
        chip.addEventListener('click', () => {
          renderFriendSharedClasses(studentRef.studentNo);
        });
        friends.appendChild(chip);
      }
    }

    card.append(heading, slotList, friends);
    elements.myClassmateResults.appendChild(card);
  }
}


function renderFriendSharedClasses(studentNo) {
  if (!state.profile?.registered) return;
  const friend = state.students.find((student) => student.studentNo === String(studentNo));
  if (!friend) return;

  const shared = findSharedClassesWithStudent(
    state.students,
    state.subjectsById,
    state.profile.student_no,
    friend.studentNo,
  );

  state.selectedClassmateNo = friend.studentNo;
  elements.friendSharedTitle.textContent = `${buildStudentLabel(friend, state.students)}와 같이 듣는 수업`;
  elements.friendSharedMeta.textContent = `${shared.length}개 과목`;
  elements.friendSharedClasses.replaceChildren();

  if (!shared.length) {
    elements.friendSharedClasses.appendChild(createEmptyState('같은 요일·교시·과목으로 겹치는 수업이 없습니다.'));
  } else {
    for (const group of shared) {
      const row = document.createElement('div');
      row.className = 'friend-shared-class';
      const subject = document.createElement('strong');
      subject.textContent = group.subject;
      const slots = document.createElement('span');
      const me = state.students.find((student) => student.studentNo === String(state.profile.student_no));
      slots.textContent = group.slots.map((slot) => {
        const roomText = formatClassrooms(getResolvedRoomsForStudentSlot(me, slot.day, slot.period));
        return `${slot.day} ${slot.period}교시${roomText ? ` · ${roomText}` : ''}`;
      }).join(' / ');
      row.append(subject, slots);
      elements.friendSharedClasses.appendChild(row);
    }
  }

  elements.friendFullScheduleBtn.textContent = `${friend.name} 전체 시간표 보기`;
  elements.friendChatBtn.textContent = `${friend.name}님과 1:1 채팅`;
  elements.friendChatBtn.disabled = false;
  elements.friendSharedPanel.hidden = false;
  elements.friendSharedPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}



function renderChatSearchResults() {
  if (!elements.chatSearchResults || !elements.chatSearch) return;
  const query = String(elements.chatSearch.value || '').trim();
  elements.chatSearchResults.replaceChildren();
  elements.chatSearchResults.hidden = !query;
  if (!query) return;
  const results = searchRosterStudents(state.roster, query, state.profile?.student_no || '');
  if (!results.length) {
    elements.chatSearchResults.appendChild(createEmptyState('검색 결과가 없습니다.'));
    return;
  }
  for (const result of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dm-search-result${result.registered ? '' : ' is-disabled'}`;
    const info = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = `${result.name} (${result.studentNo})`;
    const small = document.createElement('span'); small.textContent = result.registered ? '메시지 보내기' : '아직 시간표를 등록하지 않았어요';
    info.append(strong, small);
    const action = document.createElement('span'); action.className='dm-search-action'; action.textContent = result.registered ? '채팅' : '미등록';
    button.append(info, action);
    button.disabled = !result.registered;
    if (result.registered) button.addEventListener('click', async () => {
      try { await openChatWithStudent(result.studentNo); elements.chatSearch.value=''; renderChatSearchResults(); }
      catch (error) { showToast(humanizeError(error), true); }
    });
    elements.chatSearchResults.appendChild(button);
  }
}

function activeChatRoomId() {
  return state.activeChatType === 'group' ? Number(state.activeGroupId || 0) : Number(state.activeThreadId || 0);
}

function closeChatRoom() {
  if (activeChatRoomId()) setTypingState(false).catch(() => {});
  state.activeThreadId = 0;
  state.activeGroupId = 0;
  state.activeChatType = 'direct';
  state.activeChatPeer = null;
  state.activeGroupName = '';
  state.activeGroupMembers = [];
  state.chatMessages = [];
  state.chatLastMessageId = 0;
  state.peerTyping = false;
  state.directOtherReadId = 0;
  state.directOtherReadAt = null;
  elements.chatRoom.hidden = true;
  document.getElementById('chatView')?.classList.remove('is-room-open');
  startChatPolling();
}

async function setTypingState(active) {
  const roomId = activeChatRoomId();
  if (!roomId || !state.sessionToken) return;
  if (state.activeChatType === 'group') {
    await rpc('group_set_typing', { p_session_token: state.sessionToken, p_group_id: roomId, p_typing: Boolean(active) });
  } else {
    await rpc('chat_set_typing', { p_session_token: state.sessionToken, p_thread_id: roomId, p_typing: Boolean(active) });
  }
}

function handleChatTyping() {
  if (!activeChatRoomId() || state.chatBlocked) return;
  const active = Boolean(String(elements.chatInput.value || '').trim());
  const now = Date.now();
  if (!active) { setTypingState(false).catch(() => {}); return; }
  if (now - state.lastTypingPingAt < 1700) return;
  state.lastTypingPingAt = now;
  setTypingState(true).catch(() => {});
}

async function startChatFromFriend() {
  if (!state.selectedClassmateNo) return;
  try {
    await openChatWithStudent(state.selectedClassmateNo);
    switchView('chat');
    startChatPolling();
  } catch (error) { showToast(humanizeError(error), true); }
}

function openGroupCreateModal() {
  state.groupSelectedInvitees = new Set();
  elements.groupNameInput.value = '';
  elements.groupMemberSearch.value = '';
  elements.groupMemberSearchResults.replaceChildren();
  elements.groupSelectedMembers.replaceChildren();
  elements.groupCreateModal.hidden = false;
  setTimeout(() => elements.groupNameInput?.focus(), 50);
}

function closeGroupCreateModal() {
  elements.groupCreateModal.hidden = true;
  state.groupSelectedInvitees = new Set();
}

function renderSelectedGroupMembers() {
  elements.groupSelectedMembers.replaceChildren();
  for (const studentNo of state.groupSelectedInvitees) {
    const person = state.roster.find((row) => String(row.studentNo) === String(studentNo));
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'group-selected-chip';
    chip.textContent = `${person?.name || studentNo} ×`;
    chip.addEventListener('click', () => {
      state.groupSelectedInvitees.delete(String(studentNo));
      renderSelectedGroupMembers();
      renderGroupCreateSearch();
    });
    elements.groupSelectedMembers.appendChild(chip);
  }
}

function renderGroupCreateSearch() {
  const query = String(elements.groupMemberSearch.value || '').trim();
  elements.groupMemberSearchResults.replaceChildren();
  if (!query) return;
  const results = searchRosterStudents(state.roster, query, state.profile?.student_no || '').filter((row) => row.registered);
  for (const result of results.slice(0, 20)) {
    const selected = state.groupSelectedInvitees.has(String(result.studentNo));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `group-member-search-item${selected ? ' is-selected' : ''}`;
    const strong = document.createElement('strong'); strong.textContent = result.name;
    const span = document.createElement('span'); span.textContent = selected ? '선택됨' : result.studentNo;
    button.append(strong, span);
    button.addEventListener('click', () => {
      if (selected) state.groupSelectedInvitees.delete(String(result.studentNo));
      else state.groupSelectedInvitees.add(String(result.studentNo));
      renderSelectedGroupMembers();
      renderGroupCreateSearch();
    });
    elements.groupMemberSearchResults.appendChild(button);
  }
}

async function createGroupChat() {
  const name = String(elements.groupNameInput.value || '').trim();
  if (!name) { showToast('단체채팅방 이름을 입력해주세요.', true); return; }
  const invitees = Array.from(state.groupSelectedInvitees);
  if (!invitees.length) { showToast('초대할 친구를 한 명 이상 선택해주세요.', true); return; }
  setButtonLoading(elements.groupCreateConfirmBtn, true, '만드는 중...');
  try {
    const row = firstRow(await rpc('group_create_with_invites', {
      p_session_token: state.sessionToken,
      p_name: name,
      p_invitees: invitees,
    }));
    closeGroupCreateModal();
    await loadChatThreads(true);
    if (row?.group_id) await openGroupChat({ group_id: row.group_id, group_name: row.group_name || name });
  } catch (error) { showToast(humanizeError(error), true); }
  finally { setButtonLoading(elements.groupCreateConfirmBtn, false); }
}

function renderGroupInvites() {
  if (!elements.groupInviteInbox) return;
  elements.groupInviteInbox.replaceChildren();
  elements.groupInviteInbox.hidden = !state.groupInvites.length;
  for (const invite of state.groupInvites) {
    const card = document.createElement('div');
    card.className = 'group-invite-card';
    const info = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = `${invite.inviter_name}님이 '${invite.group_name}'에 초대했어요`;
    const small = document.createElement('span'); small.textContent = `현재 ${Number(invite.member_count || 1)}명 · 초대를 수락해야 입장합니다.`;
    info.append(strong, small);
    const actions = document.createElement('div'); actions.className = 'group-invite-actions';
    const accept = document.createElement('button'); accept.type='button'; accept.className='accept'; accept.textContent='수락';
    const decline = document.createElement('button'); decline.type='button'; decline.className='decline'; decline.textContent='거절';
    accept.addEventListener('click', () => respondGroupInvite(invite, true));
    decline.addEventListener('click', () => respondGroupInvite(invite, false));
    actions.append(decline, accept);
    card.append(info, actions);
    elements.groupInviteInbox.appendChild(card);
  }
}

async function respondGroupInvite(invite, accept) {
  try {
    await rpc('group_respond_invite', { p_session_token: state.sessionToken, p_invite_id: Number(invite.invite_id), p_accept: Boolean(accept) });
    await loadChatThreads(true);
    if (accept) await openGroupChat({ group_id: invite.group_id, group_name: invite.group_name });
  } catch (error) { showToast(humanizeError(error), true); }
}

async function enterChatView() {
  if (!state.roster.length) await loadRosterStudents();
  renderChatSearchResults();
  await loadChatThreads();
  startChatPolling();
}

function stopChatPolling() {
  if (state.chatThreadTimer) clearInterval(state.chatThreadTimer);
  if (state.chatRoomTimer) clearInterval(state.chatRoomTimer);
  state.chatThreadTimer = null;
  state.chatRoomTimer = null;
}

function startChatPolling() {
  stopChatPolling();
  state.chatThreadTimer = setInterval(() => loadChatThreads(true), 6500);
  if (activeChatRoomId()) state.chatRoomTimer = setInterval(() => loadChatMessages(true, false), 1500);
}

async function loadChatThreads(silent = false) {
  if (!state.sessionToken || !state.profile?.registered) return;
  try {
    const [directRows, groupRows, inviteRows] = await Promise.all([
      rpc('chat_list_threads_v2', { p_session_token: state.sessionToken }),
      rpc('group_list_rooms', { p_session_token: state.sessionToken }),
      rpc('group_list_invites', { p_session_token: state.sessionToken }),
    ]);
    const directs = (Array.isArray(directRows) ? directRows : []).map((row) => ({ ...row, room_type: 'direct' }));
    state.groupRooms = (Array.isArray(groupRows) ? groupRows : []).map((row) => ({ ...row, room_type: 'group' }));
    state.groupInvites = Array.isArray(inviteRows) ? inviteRows : [];
    if (state.activeChatType === 'group' && state.activeGroupId) {
      const activeRoom = state.groupRooms.find((row) => Number(row.group_id) === Number(state.activeGroupId));
      if (activeRoom && String(activeRoom.group_name) !== state.activeGroupName) {
        state.activeGroupName = String(activeRoom.group_name);
        if (!elements.chatRoom.hidden) {
          elements.chatPeerTitle.textContent = state.activeGroupName;
          if (elements.groupInfoModal && !elements.groupInfoModal.hidden && elements.groupRenameInput) {
          elements.groupRenameInput.value = state.activeGroupName;
        }
        }
      }
    }
    state.chatThreads = [...directs, ...state.groupRooms].sort((a,b) => {
      const at = new Date(a.last_message_at || 0).getTime();
      const bt = new Date(b.last_message_at || 0).getTime();
      return bt - at;
    });
    renderGroupInvites();
    renderChatThreads();
  } catch (error) { if (!silent) showToast(humanizeError(error), true); }
}

function renderChatThreads() {
  elements.chatThreadList.replaceChildren();
  const totalUnread = state.chatThreads.reduce((sum, row) => sum + Number(row.unread_count || 0), 0) + state.groupInvites.length;
  elements.chatNavUnread.textContent = String(totalUnread);
  elements.chatNavUnread.hidden = totalUnread <= 0;
  if (!state.chatThreads.length) {
    elements.chatThreadList.appendChild(createEmptyState('아직 대화가 없습니다. 친구를 검색하거나 단체채팅을 만들어보세요.'));
    return;
  }
  for (const row of state.chatThreads) {
    const isGroup = row.room_type === 'group';
    const roomId = Number(isGroup ? row.group_id : row.thread_id);
    const isActive = state.activeChatType === row.room_type && roomId === activeChatRoomId();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-thread${isActive ? ' is-active' : ''}`;
    const body = document.createElement('div'); body.className = 'chat-thread__body';
    const top = document.createElement('div'); top.className = 'chat-thread__top';
    const name = document.createElement('strong');
    const kind = document.createElement('span'); kind.className='chat-thread__kind'; kind.textContent = isGroup ? `단체 ${Number(row.member_count || 1)}명` : '1:1';
    name.textContent = isGroup ? String(row.group_name) : `${row.other_name} (${row.other_student_no})`;
    const time = document.createElement('span'); time.textContent = formatChatListTime(row.last_message_at);
    const nameWrap = document.createElement('span'); nameWrap.append(kind,name);
    top.append(nameWrap,time);
    const preview = document.createElement('span'); preview.className='chat-thread__preview'; preview.textContent = row.last_message || '대화를 시작해보세요.';
    body.append(top,preview);
    if (Number(row.unread_count || 0) > 0) {
      const badge = document.createElement('span'); badge.className='chat-unread-count'; badge.textContent=String(row.unread_count); button.append(body,badge);
    } else button.append(body);
    button.addEventListener('click', () => openExistingChat(row));
    elements.chatThreadList.appendChild(button);
  }
}

function resetActiveMessageState() {
  state.chatMessages = [];
  state.chatLastMessageId = 0;
  state.peerTyping = false;
  state.directOtherReadId = 0;
  state.directOtherReadAt = null;
  clearPendingChatImage();
}

async function openChatWithStudent(studentNo) {
  const row = firstRow(await rpc('chat_start_or_open', { p_session_token: state.sessionToken, p_other_student_no: String(studentNo) }));
  if (!row) throw new Error('CHAT_NOT_FOUND');
  state.activeChatType = 'direct';
  state.activeGroupId = 0;
  state.activeThreadId = Number(row.thread_id);
  state.activeChatPeer = { studentNo: String(row.other_student_no), name: String(row.other_name) };
  state.activeGroupName = '';
  state.chatBlocked = Boolean(row.blocked);
  resetActiveMessageState();
  elements.chatRoom.hidden = false;
  document.getElementById('chatView')?.classList.add('is-room-open');
  await loadChatMessages(false, true);
  await loadChatThreads(true);
  startChatPolling();
  refocusChatInput();
}

async function openExistingChat(row) {
  if (row.room_type === 'group') return openGroupChat(row);
  state.activeChatType = 'direct';
  state.activeGroupId = 0;
  state.activeThreadId = Number(row.thread_id);
  state.activeChatPeer = { studentNo: String(row.other_student_no), name: String(row.other_name) };
  state.activeGroupName = '';
  state.chatBlocked = Boolean(row.blocked);
  resetActiveMessageState();
  elements.chatRoom.hidden = false;
  document.getElementById('chatView')?.classList.add('is-room-open');
  await loadChatMessages(false, true);
  startChatPolling();
  refocusChatInput();
}

async function openGroupChat(row) {
  state.activeChatType = 'group';
  state.activeThreadId = 0;
  state.activeGroupId = Number(row.group_id);
  state.activeChatPeer = null;
  state.activeGroupName = String(row.group_name || '단체채팅');
  state.chatBlocked = false;
  resetActiveMessageState();
  elements.chatRoom.hidden = false;
  document.getElementById('chatView')?.classList.add('is-room-open');
  await loadChatMessages(false, true);
  startChatPolling();
  refocusChatInput();
}

function formatGroupTyping(row) {
  const count = Number(row?.typing_count || 0);
  const names = Array.isArray(row?.typing_names) ? row.typing_names.filter(Boolean) : [];
  if (!count) return '';
  if (count === 1) return `${names[0] || '친구'}님이 입력 중...`;
  if (count <= 3) return `${names.join(', ')}님이 입력 중...`;
  return `${names.join(', ')} 외 ${count - names.length}명이 입력 중...`;
}

async function loadChatMessages(silent = false, reset = false) {
  const roomId = activeChatRoomId();
  if (!roomId) return;
  const expectedType = state.activeChatType;
  const expectedId = roomId;
  if (reset) resetActiveMessageState();
  const afterId = reset ? 0 : Number(state.chatLastMessageId || 0);
  try {
    let rows = [];
    let statusChanged = false;
    if (expectedType === 'group') {
      const [data, typingRows] = await Promise.all([
        rpc('group_list_messages', { p_session_token: state.sessionToken, p_group_id: expectedId, p_after_id: afterId, p_limit: 80 }),
        rpc('group_get_typing', { p_session_token: state.sessionToken, p_group_id: expectedId }),
      ]);
      rows = Array.isArray(data) ? data : [];
      const typingText = formatGroupTyping(firstRow(typingRows));
      statusChanged = typingText !== (state.peerTyping || '');
      state.peerTyping = typingText;
    } else {
      const [data, threadStateRows] = await Promise.all([
        rpc('chat_list_messages_v3', { p_session_token: state.sessionToken, p_thread_id: expectedId, p_after_id: afterId, p_limit: 80 }),
        rpc('chat_get_thread_state', { p_session_token: state.sessionToken, p_thread_id: expectedId }),
      ]);
      rows = Array.isArray(data) ? data : [];
      const threadState = firstRow(threadStateRows) || {};
      const nextTyping = Boolean(threadState.typing);
      const nextReadId = Number(threadState.other_last_read_message_id || 0);
      const nextReadAt = threadState.other_last_read_at || null;
      statusChanged = nextTyping !== Boolean(state.peerTyping) || nextReadId !== state.directOtherReadId || nextReadAt !== state.directOtherReadAt || Boolean(threadState.blocked) !== state.chatBlocked;
      state.peerTyping = nextTyping;
      state.directOtherReadId = nextReadId;
      state.directOtherReadAt = nextReadAt;
      state.chatBlocked = Boolean(threadState.blocked);
    }

    if (state.activeChatType !== expectedType || activeChatRoomId() !== expectedId) return;
    if (reset) state.chatMessages = rows;
    else if (rows.length) {
      const seen = new Set(state.chatMessages.map((m) => Number(m.id)));
      for (const row of rows) if (!seen.has(Number(row.id))) state.chatMessages.push(row);
    }
    state.chatLastMessageId = Number(state.chatMessages.at(-1)?.id || 0);

    if (reset || rows.length) renderChatRoom();
    else if (statusChanged) updateChatRoomStatus();
    if (expectedType === 'group') await rpc('group_mark_read', { p_session_token: state.sessionToken, p_group_id: expectedId });
    else await rpc('chat_mark_read', { p_session_token: state.sessionToken, p_thread_id: expectedId });
    if (!silent) await loadChatThreads(true);
  } catch (error) { if (!silent) showToast(humanizeError(error), true); }
}

function clearPendingChatImage() {
  state.pendingChatImage = null;
  if (elements.chatImageInput) elements.chatImageInput.value = '';
  if (elements.chatPhotoPreviewImage) elements.chatPhotoPreviewImage.removeAttribute('src');
  if (elements.chatPhotoPreview) elements.chatPhotoPreview.hidden = true;
}

function handleChatImageSelection() {
  const file = elements.chatImageInput?.files?.[0] || null;
  if (!file) return clearPendingChatImage();
  const allowed = new Set(['image/jpeg','image/png','image/webp']);
  if (!allowed.has(file.type)) {
    showToast('JPG, PNG, WEBP 사진만 보낼 수 있습니다.', true);
    return clearPendingChatImage();
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('사진은 최대 5MB까지 보낼 수 있습니다.', true);
    return clearPendingChatImage();
  }
  state.pendingChatImage = file;
  const url = URL.createObjectURL(file);
  elements.chatPhotoPreviewImage.src = url;
  elements.chatPhotoPreview.hidden = false;
  elements.chatPhotoPreviewImage.onload = () => URL.revokeObjectURL(url);
  refocusChatInput();
}

async function chatMediaRequest(formOrBody, isForm = false) {
  const response = await fetch(`${config.url}/functions/v1/chat-media`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'x-timetable-session': state.sessionToken,
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    },
    body: isForm ? formOrBody : JSON.stringify(formOrBody),
    cache: 'no-store',
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try { message = (await response.json())?.error || message; } catch {}
    throw new Error(message);
  }
  return response;
}

async function uploadChatImage(file) {
  const roomId = activeChatRoomId();
  const form = new FormData();
  form.append('action', 'upload');
  form.append('mode', state.activeChatType === 'group' ? 'group' : 'direct');
  if (state.activeChatType === 'group') form.append('group_id', String(roomId));
  else form.append('thread_id', String(roomId));
  form.append('file', file, file.name || 'photo');
  const response = await chatMediaRequest(form, true);
  const data = await response.json();
  if (!data?.path) throw new Error('CHAT_IMAGE_UPLOAD_FAILED');
  return String(data.path);
}

function isChatNearBottom(threshold = 120) {
  const viewport = elements.chatMessages;
  if (!viewport) return true;
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
}

function scrollChatToBottom() {
  const viewport = elements.chatMessages;
  if (!viewport) return;
  viewport.scrollTop = viewport.scrollHeight;
}

async function loadChatImage(imagePath, img) {
  if (!imagePath || !img || !activeChatRoomId()) return;
  const cached = state.chatImageUrls.get(imagePath);
  if (cached) { img.src = cached; return; }
  try {
    const roomId = activeChatRoomId();
    const response = await chatMediaRequest({
      action: 'signed_url',
      mode: state.activeChatType === 'group' ? 'group' : 'direct',
      thread_id: state.activeChatType === 'direct' ? roomId : undefined,
      group_id: state.activeChatType === 'group' ? roomId : undefined,
      path: imagePath,
    });
    const data = await response.json();
    const signedUrl = data?.signedUrl || data?.signed_url || data?.url || '';
    if (!signedUrl) throw new Error('SIGNED_URL_MISSING');
    state.chatImageUrls.set(imagePath, signedUrl);
    img.src = signedUrl;
  } catch (error) {
    console.error('CHAT_IMAGE_LOAD_FAILED', imagePath, error);
    state.chatImageUrls.delete(imagePath);
    img.removeAttribute('src');
    img.alt = '사진을 불러오지 못했습니다.';
    img.classList.add('is-error');
  }
}

function openChatImageLightbox(src) {
  if (!src || !elements.chatImageLightbox) return;
  elements.chatImageLightboxImage.src = src;
  elements.chatImageLightbox.hidden = false;
  document.body.classList.add('is-lightbox-open');
}

function closeChatImageLightbox() {
  if (!elements.chatImageLightbox) return;
  elements.chatImageLightbox.hidden = true;
  elements.chatImageLightboxImage.removeAttribute('src');
  document.body.classList.remove('is-lightbox-open');
}

function updateChatRoomStatus() {
  const isGroup = state.activeChatType === 'group';
  if (!isGroup && !state.activeChatPeer) return;

  if (elements.chatRoomKind) elements.chatRoomKind.textContent = isGroup ? '단체채팅' : '1:1 채팅';
  if (elements.chatPeerTitle) {
    elements.chatPeerTitle.textContent = isGroup
      ? state.activeGroupName
      : `${state.activeChatPeer.name} (${state.activeChatPeer.studentNo})`;
  }
  if (elements.chatRoomInfoBtn) elements.chatRoomInfoBtn.disabled = !isGroup;

  if (elements.chatReadStatus) {
    elements.chatReadStatus.textContent = isGroup
      ? String(state.peerTyping || '')
      : (state.peerTyping ? '입력 중...' : formatRelativeReadAt(state.directOtherReadAt));
    elements.chatReadStatus.classList.toggle('is-typing', Boolean(state.peerTyping));
  }

  if (elements.chatBlockNotice) elements.chatBlockNotice.hidden = isGroup || !state.chatBlocked;
  if (elements.chatInput) elements.chatInput.disabled = !isGroup && state.chatBlocked;
  if (elements.chatSendBtn) elements.chatSendBtn.disabled = !isGroup && state.chatBlocked;
  if (elements.chatPhotoBtn) elements.chatPhotoBtn.disabled = !isGroup && state.chatBlocked;

  if (elements.chatBlockBtn) {
    elements.chatBlockBtn.hidden = isGroup;
    if (!isGroup) elements.chatBlockBtn.textContent = state.chatBlocked ? '차단 해제' : '차단';
  }
  if (elements.chatReportBtn) elements.chatReportBtn.hidden = isGroup;
}

function renderChatRoom() {
  const isGroup = state.activeChatType === 'group';
  if (!isGroup && !state.activeChatPeer) return;
  const stickToBottom = isChatNearBottom();
  updateChatRoomStatus();
  elements.chatMessages.replaceChildren();

  let previousSender = '';
  for (const message of state.chatMessages) {
    const mine = String(message.sender_student_no) === String(state.profile.student_no);
    const row = document.createElement('div'); row.className = `chat-message-row ${mine ? 'is-mine' : 'is-other'}`;
    if (isGroup && !mine && String(message.sender_student_no) !== previousSender) {
      const sender = document.createElement('div'); sender.className='group-sender-name'; sender.textContent = message.sender_name || message.sender_student_no;
      row.appendChild(sender);
    }
    const bubble = document.createElement('div'); bubble.className='chat-bubble';
    if (message.image_path) {
      bubble.classList.add('has-image');
      const image = document.createElement('img');
      image.className = 'chat-image-message';
      image.alt = '채팅으로 보낸 사진';
      image.loading = 'lazy';
      image.dataset.stickToBottom = stickToBottom ? '1' : '0';
      image.addEventListener('load', () => {
        image.classList.add('is-loaded');
        if (image.dataset.stickToBottom === '1') requestAnimationFrame(scrollChatToBottom);
      }, { once: true });
      image.addEventListener('click', () => { if (image.src) openChatImageLightbox(image.src); });
      bubble.appendChild(image);
      loadChatImage(String(message.image_path), image);
    }
    if (String(message.body || '').trim()) {
      const text = document.createElement('div'); text.className = 'chat-bubble-text'; text.textContent = message.body; bubble.appendChild(text);
    }
    const meta = document.createElement('div'); meta.className='chat-message-meta';
    const time = document.createElement('span'); time.textContent = new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit'}).format(new Date(message.created_at));
    meta.appendChild(time);
    if (isGroup && mine && Number(message.read_count || 0) > 0) {
      const read = document.createElement('span'); read.className='group-read-count'; read.textContent=`${Number(message.read_count)}명 읽음`; meta.prepend(read);
    } else if (!isGroup && isChatMessageUnread(message, state.directOtherReadId, state.profile.student_no)) {
      const unread=document.createElement('span'); unread.className='chat-message-unread'; unread.textContent='1'; meta.prepend(unread);
    }
    row.append(bubble,meta);
    elements.chatMessages.appendChild(row);
    previousSender = String(message.sender_student_no || '');
  }

  if (stickToBottom) requestAnimationFrame(scrollChatToBottom);
}

function refocusChatInput() {
  if (!elements.chatInput || elements.chatInput.disabled) return;
  requestAnimationFrame(() => {
    try { elements.chatInput.focus({ preventScroll: true }); }
    catch { elements.chatInput.focus(); }
    setTimeout(() => {
      if (document.activeElement !== elements.chatInput) {
        try { elements.chatInput.focus({ preventScroll: true }); } catch { elements.chatInput.focus(); }
      }
    }, 60);
  });
}

async function sendChatMessage() {
  const body = String(elements.chatInput.value || '').trim();
  const imageFile = state.pendingChatImage;
  const roomId = activeChatRoomId();
  if (!roomId || (!body && !imageFile)) return;
  if (body.length > 500) { showToast('메시지는 최대 500자입니다.', true); return; }
  setButtonLoading(elements.chatSendBtn,true,'전송 중...');
  try {
    let imagePath = null;
    if (imageFile) imagePath = await uploadChatImage(imageFile);
    if (state.activeChatType === 'group') {
      await rpc('group_send_message', { p_session_token: state.sessionToken, p_group_id: roomId, p_body: body, p_image_path: imagePath });
    } else {
      await rpc('chat_send_message_v2', { p_session_token: state.sessionToken, p_thread_id: roomId, p_body: body, p_image_path: imagePath });
    }
    elements.chatInput.value='';
    clearPendingChatImage();
    await setTypingState(false).catch(() => {});
    await loadChatMessages(true, false);
    loadChatThreads(true).catch(() => {});
  } catch(error){ showToast(humanizeError(error),true); }
  finally {
    setButtonLoading(elements.chatSendBtn,false);
    if(state.activeChatType === 'direct' && state.chatBlocked) elements.chatSendBtn.disabled=true;
    refocusChatInput();
  }
}

async function openGroupInfoModal() {
  if (state.activeChatType !== 'group' || !state.activeGroupId) return;
  try {
    const [roomRows, memberRows] = await Promise.all([
      rpc('group_get_room', { p_session_token: state.sessionToken, p_group_id: state.activeGroupId }),
      rpc('group_list_members', { p_session_token: state.sessionToken, p_group_id: state.activeGroupId }),
    ]);
    const room = firstRow(roomRows) || {};
    state.activeGroupName = String(room.group_name || state.activeGroupName);
    state.activeGroupMembers = Array.isArray(memberRows) ? memberRows : [];
    elements.groupRenameInput.value = state.activeGroupName;
    elements.groupMemberList.replaceChildren();
    for (const member of state.activeGroupMembers) {
      const row = document.createElement('div'); row.className='group-member-row';
      const strong = document.createElement('strong'); strong.textContent=member.name;
      const span = document.createElement('span'); span.textContent=String(member.student_no) === String(state.profile.student_no) ? '나' : member.student_no;
      row.append(strong,span); elements.groupMemberList.appendChild(row);
    }
    elements.groupInviteSearch.value='';
    elements.groupInviteSearchResults.replaceChildren();
    elements.groupInfoModal.hidden=false;
  } catch (error) { showToast(humanizeError(error), true); }
}

function closeGroupInfoModal() { elements.groupInfoModal.hidden=true; }

async function renameActiveGroup() {
  const name=String(elements.groupRenameInput.value||'').trim();
  if (!name || !state.activeGroupId) return;
  try {
    const result=await rpc('group_rename',{p_session_token:state.sessionToken,p_group_id:state.activeGroupId,p_name:name});
    state.activeGroupName=typeof result==='string'?result:name;
    renderChatRoom();
    await loadChatThreads(true);
    showToast('채팅방 이름을 변경했습니다.');
  } catch(error){ showToast(humanizeError(error),true); }
}

function renderGroupInviteSearch() {
  const query=String(elements.groupInviteSearch.value||'').trim();
  elements.groupInviteSearchResults.replaceChildren();
  if(!query)return;
  const memberNos=new Set(state.activeGroupMembers.map((m)=>String(m.student_no)));
  const results=searchRosterStudents(state.roster,query,state.profile?.student_no||'').filter((row)=>row.registered&&!memberNos.has(String(row.studentNo)));
  for(const result of results.slice(0,20)){
    const button=document.createElement('button');button.type='button';button.className='group-member-search-item';
    const strong=document.createElement('strong');strong.textContent=result.name;
    const span=document.createElement('span');span.textContent='초대';
    button.append(strong,span);
    button.addEventListener('click',async()=>{
      try{await rpc('group_invite_student',{p_session_token:state.sessionToken,p_group_id:state.activeGroupId,p_student_no:String(result.studentNo)});showToast(`${result.name}님에게 초대장을 보냈습니다.`);elements.groupInviteSearch.value='';renderGroupInviteSearch();}
      catch(error){showToast(humanizeError(error),true);}
    });
    elements.groupInviteSearchResults.appendChild(button);
  }
}

async function leaveActiveGroup() {
  if(!state.activeGroupId)return;
  if(!window.confirm(`'${state.activeGroupName}' 채팅방에서 나갈까요?`))return;
  try{
    await rpc('group_leave',{p_session_token:state.sessionToken,p_group_id:state.activeGroupId});
    closeGroupInfoModal();closeChatRoom();await loadChatThreads(true);showToast('채팅방에서 나왔습니다.');
  }catch(error){showToast(humanizeError(error),true);}
}

async function toggleChatBlock() {
  if (state.activeChatType !== 'direct' || !state.activeChatPeer) return;
  const wasBlocked = state.chatBlocked;
  try {
    await rpc(wasBlocked ? 'chat_unblock_student' : 'chat_block_student',{p_session_token:state.sessionToken,p_other_student_no:state.activeChatPeer.studentNo});
    state.chatBlocked = !wasBlocked;
    renderChatRoom();
    showToast(state.chatBlocked ? '상대를 차단했습니다.' : '차단을 해제했습니다.');
  } catch(error){ showToast(humanizeError(error),true); }
}

async function reportChatUser() {
  if (state.activeChatType !== 'direct' || !state.activeThreadId || !state.activeChatPeer) return;
  const reason = window.prompt(`${state.activeChatPeer.name}님을 신고하는 이유를 입력해주세요.`, '부적절한 메시지');
  if (!reason?.trim()) return;
  try {
    await rpc('chat_report_student',{p_session_token:state.sessionToken,p_thread_id:state.activeThreadId,p_reason:reason.trim()});
    showToast('신고가 접수됐습니다. 상대방에게는 신고 사실이 표시되지 않습니다.');
  } catch(error){ showToast(humanizeError(error),true); }
}


function switchView(viewName) {
  document.querySelectorAll('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== viewName; });
  document.querySelectorAll('[data-nav]').forEach((button) => {
    const active = button.dataset.nav === viewName;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.getElementById('mainContent')?.scrollIntoView({ block: 'start' });
}

function fillSelect(select, values, labeler) {
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = labeler(value);
    select.appendChild(option);
  }
}

function createEmptyState(message) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  return div;
}

function setButtonLoading(button, loading, label = '처리 중...') {
  if (loading) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) { button.textContent = button.dataset.originalText; delete button.dataset.originalText; }
  }
}

function showToast(message, isError = false) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, isError ? 5200 : 3000);
}

function humanizeError(error) {
  const message = String(error?.message || error || '알 수 없는 오류');
  if (/ROSTER_MISMATCH/.test(message)) return '학번 또는 이름이 명단과 일치하지 않습니다.';
  if (/PIN_ALREADY_SET/.test(message)) return '이미 PIN이 설정된 학번입니다. 다시 학번·이름 확인 후 PIN으로 로그인해주세요.';
  if (/PIN_NOT_SET/.test(message)) return '아직 PIN이 설정되지 않은 학번입니다.';
  if (/PIN_FORMAT/.test(message)) return 'PIN은 숫자 6자리여야 합니다.';
  if (/PIN_INVALID/.test(message)) return 'PIN이 틀렸습니다.';
  if (/PIN_LOCKED/.test(message)) {
    const seconds = Number(error?.retryAfterSeconds || 900);
    return `PIN 입력이 여러 번 틀렸습니다. ${formatDuration(seconds)} 후 다시 시도해주세요.`;
  }
  if (/SESSION_REQUIRED|SESSION_EXPIRED/.test(message)) return '로그인 시간이 만료됐습니다. 학번과 PIN으로 다시 로그인해주세요.';
  if (/ANALYSIS_LIMIT_REACHED/.test(message)) return 'AI 분석 가능 횟수 2회를 모두 사용했습니다.';
  if (/ANALYSIS_COOLDOWN/.test(message)) {
    const seconds = Number(error?.retryAfterSeconds || 0);
    return seconds > 0 ? `재분석은 ${formatDuration(seconds)} 후 가능합니다.` : '첫 분석 후 10분이 지나야 다시 분석할 수 있습니다.';
  }
  if (/ANALYSIS_IN_PROGRESS/.test(message)) return '이미 분석 중입니다. 잠시 후 다시 시도해주세요.';
  if (/INVALID_SUBJECT|UNKNOWN/.test(message)) return '미확인 과목이 있습니다. 과목 목록에서 다시 선택해주세요.';
  if (/ANALYSIS_REQUIRED/.test(message)) return '시간표를 한 번 AI 분석한 뒤 저장할 수 있습니다.';
  if (/CHAT_TARGET_NOT_REGISTERED/.test(message)) return '상대가 아직 시간표를 등록하지 않아 채팅할 수 없습니다.';
  if (/CHAT_BLOCKED/.test(message)) return '차단된 상대와는 메시지를 주고받을 수 없습니다.';
  if (/CHAT_RATE_LIMIT/.test(message)) return '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내주세요.';
  if (/CHAT_MESSAGE_TOO_LONG/.test(message)) return '메시지는 최대 500자입니다.';
  if (/CHAT_FORBIDDEN|CHAT_NOT_FOUND/.test(message)) return '이 대화에 접근할 수 없습니다.';
  if (/GROUP_INVITE_NOT_FOUND/.test(message)) return '이미 처리됐거나 만료된 초대입니다.';
  if (/GROUP_ALREADY_MEMBER/.test(message)) return '이미 이 채팅방에 들어와 있는 친구입니다.';
  if (/GROUP_NAME_REQUIRED/.test(message)) return '단체채팅방 이름을 입력해주세요.';
  if (/GROUP_FORBIDDEN|GROUP_NOT_FOUND/.test(message)) return '이 단체채팅방에 접근할 수 없습니다.';
  if (/REGISTRATION_REQUIRED/.test(message)) return '시간표를 먼저 등록해야 채팅할 수 있습니다.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
  return message.length > 180 ? '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' : message;
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
