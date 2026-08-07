import {
  DAYS,
  PERIODS,
  FREE_SUBJECT_ID,
  UNKNOWN_SUBJECT_ID,
  normalizeRosterName,
  normalizeScheduleIds,
  isFreeSubjectId,
  hasUnknownSubject,
  buildStudentLabel,
  groupStudentsBySubject,
  findFreeStudents,
  findClassmatesForCell,
} from './core.js';

const PENDING_IDENTITY_KEY = 'pendingStudentIdentity';
const COOLDOWN_MS = 10 * 60 * 1000;

const elements = {
  identityCard: document.getElementById('identityCard'),
  studentNo: document.getElementById('studentNo'),
  studentName: document.getElementById('studentName'),
  microsoftLoginBtn: document.getElementById('microsoftLoginBtn'),
  accountPanel: document.getElementById('accountPanel'),
  accountStudent: document.getElementById('accountStudent'),
  accountEmail: document.getElementById('accountEmail'),
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
  studentScheduleCard: document.getElementById('studentScheduleCard'),
  selectedStudentTitle: document.getElementById('selectedStudentTitle'),
  selectedStudentUpdated: document.getElementById('selectedStudentUpdated'),
  readonlyScheduleWrap: document.getElementById('readonlyScheduleWrap'),
  classmatePanel: document.getElementById('classmatePanel'),
  classmateTitle: document.getElementById('classmateTitle'),
  classmateMeta: document.getElementById('classmateMeta'),
  classmateList: document.getElementById('classmateList'),
  freeDay: document.getElementById('freeDay'),
  freePeriod: document.getElementById('freePeriod'),
  freeLookupBtn: document.getElementById('freeLookupBtn'),
  freeCount: document.getElementById('freeCount'),
  freeResults: document.getElementById('freeResults'),
  toast: document.getElementById('toast'),
};

const config = normalizeSupabaseConfig(window.TIMETABLE_SUPABASE_CONFIG || {});
const client = createSupabaseClient(config);

const state = {
  session: null,
  profile: null,
  subjects: [],
  subjectsById: new Map(),
  students: [],
  draftSchedule: null,
  selectedStudentNo: '',
  previewUrl: '',
  toastTimer: null,
  busy: false,
};

fillSelect(elements.lookupDay, DAYS, (day) => `${day}요일`);
fillSelect(elements.freeDay, DAYS, (day) => `${day}요일`);
fillSelect(elements.lookupPeriod, PERIODS, (period) => `${period}교시`);
fillSelect(elements.freePeriod, PERIODS, (period) => `${period}교시`);

bindEvents();
await bootstrap();
setInterval(renderQuota, 1000);

function normalizeSupabaseConfig(value) {
  return {
    url: String(value?.url || '').trim().replace(/\/+$/, ''),
    publishableKey: String(value?.publishableKey || '').trim(),
  };
}

function createSupabaseClient(value) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value.url) || !value.publishableKey.startsWith('sb_publishable_')) {
    throw new Error('Supabase 연결 정보가 올바르지 않습니다.');
  }
  if (!window.supabase?.createClient) {
    throw new Error('Supabase 로그인 라이브러리를 불러오지 못했습니다.');
  }
  return window.supabase.createClient(value.url, value.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
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
      if (button.dataset.nav === 'lookup' || button.dataset.nav === 'free') {
        await refreshStudents();
      }
    });
  });

  elements.studentName.addEventListener('blur', () => {
    elements.studentName.value = normalizeRosterName(elements.studentName.value);
  });

  elements.microsoftLoginBtn.addEventListener('click', startMicrosoftLogin);
  elements.logoutBtn.addEventListener('click', logout);
  elements.scheduleImage.addEventListener('change', previewImage);
  elements.analyzeBtn.addEventListener('click', analyzeTimetable);
  elements.saveBtn.addEventListener('click', saveTimetable);
  elements.lookupSearch.addEventListener('input', renderStudentList);
  elements.lookupDay.addEventListener('change', renderTimeLookup);
  elements.lookupPeriod.addEventListener('change', renderTimeLookup);
  elements.timeLookupBtn.addEventListener('click', async () => {
    await refreshStudents();
    renderTimeLookup();
  });
  elements.freeDay.addEventListener('change', renderFreeLookup);
  elements.freePeriod.addEventListener('change', renderFreeLookup);
  elements.freeLookupBtn.addEventListener('click', async () => {
    await refreshStudents();
    renderFreeLookup();
  });

  client.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    window.setTimeout(() => handleAuthenticatedState(), 0);
  });
}

async function bootstrap() {
  const { data, error } = await client.auth.getSession();
  if (error) {
    showToast('로그인 상태를 확인하지 못했습니다.', true);
    return;
  }
  state.session = data.session;
  await handleAuthenticatedState();
}

async function handleAuthenticatedState() {
  if (state.busy) return;
  state.busy = true;
  try {
    if (!state.session) {
      resetSignedInState();
      renderAccessState();
      return;
    }

    await loadProfile();
    if (!state.profile) {
      const pending = readPendingIdentity();
      if (pending) {
        await claimStudent(pending.studentNo, pending.name);
      }
    }

    if (state.profile) {
      clearPendingIdentity();
      await loadSubjects();
      if (state.profile.registered) {
        await refreshStudents();
        loadOwnScheduleIntoEditor();
      }
    }
    renderAccessState();
  } catch (error) {
    showToast(humanizeError(error), true);
  } finally {
    state.busy = false;
  }
}

function resetSignedInState() {
  state.profile = null;
  state.students = [];
  state.subjects = [];
  state.subjectsById = new Map();
  state.draftSchedule = null;
  state.selectedStudentNo = '';
  elements.analysisPanel.hidden = true;
  elements.studentScheduleCard.hidden = true;
}

async function startMicrosoftLogin() {
  const studentNo = String(elements.studentNo.value || '').trim();
  const name = normalizeRosterName(elements.studentName.value);
  elements.studentName.value = name;

  if (!/^\d{4}$/.test(studentNo)) {
    showToast('학번 4자리를 정확히 입력해주세요.', true);
    elements.studentNo.focus();
    return;
  }
  if (!name) {
    showToast('이름을 입력해주세요.', true);
    elements.studentName.focus();
    return;
  }

  sessionStorage.setItem('pendingStudentIdentity', JSON.stringify({ studentNo, name }));
  setButtonLoading(elements.microsoftLoginBtn, true, 'Microsoft 로그인 연결 중...');

  try {
    if (state.session) {
      await claimStudent(studentNo, name);
      clearPendingIdentity();
      await loadSubjects();
      renderAccessState();
      return;
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo,
      },
    });
    if (error) throw error;
  } catch (error) {
    showToast(humanizeError(error), true);
    setButtonLoading(elements.microsoftLoginBtn, false);
  }
}

async function claimStudent(studentNo, name) {
  const { data, error } = await client.rpc('claim_student', {
    p_student_no: studentNo,
    p_name: name,
  });
  if (error) {
    if (/ROSTER_MISMATCH|STUDENT_ALREADY_BOUND|ACCOUNT_ALREADY_BOUND/.test(error.message || '')) {
      await client.auth.signOut();
    }
    throw error;
  }
  state.profile = Array.isArray(data) ? data[0] || null : data;
  if (!state.profile) throw new Error('학생 계정 연결 결과를 확인하지 못했습니다.');
  return state.profile;
}

async function loadProfile() {
  const { data, error } = await client.rpc('my_student_profile');
  if (error) throw error;
  state.profile = Array.isArray(data) ? data[0] || null : data;
  return state.profile;
}

async function loadSubjects() {
  const { data, error } = await client
    .from('subjects')
    .select('subject_id,display_name,sort_order,active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true });
  if (error) throw error;
  state.subjects = Array.isArray(data) ? data : [];
  state.subjectsById = new Map(state.subjects.map((subject) => [subject.subject_id, subject.display_name]));
}

async function refreshStudents() {
  if (!state.profile?.registered) {
    state.students = [];
    renderAllLookups();
    return [];
  }
  const { data, error } = await client
    .from('students')
    .select('student_no,name,schedule,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  state.students = (Array.isArray(data) ? data : []).map((row) => ({
    studentNo: String(row.student_no),
    name: normalizeRosterName(row.name),
    schedule: normalizeScheduleIds(row.schedule),
    updatedAt: row.updated_at || '',
  }));
  renderAllLookups();
  return state.students;
}

function loadOwnScheduleIntoEditor() {
  if (!state.profile?.registered || state.draftSchedule) return;
  const own = state.students.find((student) => student.studentNo === state.profile.student_no);
  if (!own) return;
  state.draftSchedule = normalizeScheduleIds(own.schedule);
  renderEditableSchedule(state.draftSchedule);
  elements.analysisPanel.hidden = false;
}

function renderAccessState() {
  const signedIn = Boolean(state.session);
  const bound = Boolean(state.profile);
  const registered = Boolean(state.profile?.registered);

  elements.identityCard.hidden = bound;
  elements.accountPanel.hidden = !bound;
  elements.registrationCard.hidden = !bound;

  if (bound) {
    elements.accountStudent.textContent = `${state.profile.name} (${state.profile.student_no})`;
    elements.accountEmail.textContent = state.session?.user?.email || 'Microsoft 계정 연결됨';
  }

  document.querySelectorAll('[data-requires-registration="true"]').forEach((button) => {
    button.disabled = !registered;
    button.setAttribute('aria-disabled', String(!registered));
  });

  if (!registered) {
    const activeLocked = document.querySelector('.nav-button.is-active[data-requires-registration="true"]');
    if (activeLocked) switchView('register');
  }

  if (signedIn && !bound) {
    elements.microsoftLoginBtn.textContent = '이 학번·이름을 현재 Microsoft 계정에 연결';
  } else {
    elements.microsoftLoginBtn.textContent = 'Microsoft 계정으로 로그인하고 연결';
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

  const disabled = remaining <= 0 || cooldown > 0 || !state.session;
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
  await client.auth.signOut();
  clearPendingIdentity();
  elements.studentNo.value = '';
  elements.studentName.value = '';
  showToast('로그아웃했습니다.');
}

function previewImage() {
  const file = elements.scheduleImage.files?.[0];
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = '';
  }
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
  if (!state.session || !state.profile) {
    showToast('먼저 학생 계정 연결을 완료해주세요.', true);
    return;
  }
  const file = elements.scheduleImage.files?.[0];
  if (!file) {
    showToast('분석할 시간표 이미지를 선택해주세요.', true);
    return;
  }
  const cooldown = getCooldownSeconds(state.profile);
  if (Number(state.profile.analysis_count || 0) >= 2 || cooldown > 0) {
    renderQuota();
    return;
  }

  setButtonLoading(elements.analyzeBtn, true, 'AI 분석 중...');
  try {
    const image = await fileToDataUrl(file);
    const result = await callAnalysis(image, state.session);
    state.draftSchedule = normalizeScheduleIds(result.schedule);
    renderEditableSchedule(state.draftSchedule);
    elements.analysisPanel.hidden = false;
    await loadProfile();
    renderAccessState();
    elements.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('AI 분석이 끝났습니다. 모든 칸을 확인해주세요.');
  } catch (error) {
    if (state.session && state.profile) {
      try {
        await loadProfile();
      } catch {}
    }
    if (error?.attemptConsumed) {
      if (!state.draftSchedule) {
        state.draftSchedule = createUnknownSchedule();
        renderEditableSchedule(state.draftSchedule);
        elements.analysisPanel.hidden = false;
      }
      renderAccessState();
      showToast('AI 분석은 실패했지만 이번 분석 횟수는 사용되었습니다. 드롭다운에서 직접 과목을 선택할 수 있습니다.', true);
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

async function callAnalysis(image, session) {
  const response = await fetch(`${config.url}/functions/v1/analyze-timetable`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
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

function renderEditableSchedule(schedule) {
  elements.editableScheduleWrap.replaceChildren(buildScheduleTable(schedule, true));
}

function renderReadonlySchedule(schedule, onCellClick) {
  elements.readonlyScheduleWrap.replaceChildren(buildScheduleTable(schedule, false, onCellClick));
}

function buildScheduleTable(schedule, editable, onCellClick) {
  const normalized = normalizeScheduleIds(schedule);
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
          option.textContent = subject.subject_id === UNKNOWN_SUBJECT_ID
            ? '⚠ 미확인 - 과목 선택 필요'
            : subject.display_name;
          option.selected = subject.subject_id === subjectId;
          select.appendChild(option);
        }
        select.addEventListener('change', () => {
          select.classList.toggle('is-unknown', select.value === UNKNOWN_SUBJECT_ID);
        });
        td.appendChild(select);
      } else {
        const displayName = state.subjectsById.get(subjectId) || (subjectId === FREE_SUBJECT_ID ? '공강' : '미확인');
        td.className = `schedule-cell${isFreeSubjectId(subjectId) ? ' is-free' : ''}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-cell-button';
        button.textContent = displayName;
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

async function saveTimetable() {
  if (!state.profile || !state.session) {
    showToast('먼저 학생 계정을 연결해주세요.', true);
    return;
  }
  const schedule = collectEditedSchedule();
  if (hasUnknownSubject(schedule)) {
    showToast('미확인 칸이 있습니다. 모든 칸에서 실제 과목 또는 공강을 선택해주세요.', true);
    return;
  }

  setButtonLoading(elements.saveBtn, true, '저장 중...');
  try {
    const { data, error } = await client.rpc('save_my_timetable', { p_schedule: schedule });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row) state.profile = { ...state.profile, ...row, registered: true };
    state.draftSchedule = schedule;
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
  renderStudentList();
  renderTimeLookup();
  renderFreeLookup();
  if (state.selectedStudentNo) {
    const exists = state.students.some((student) => student.studentNo === state.selectedStudentNo);
    if (exists) selectStudent(state.selectedStudentNo, false);
    else elements.studentScheduleCard.hidden = true;
  }
}

function renderStudentList() {
  if (!elements.studentList) return;
  const query = String(elements.lookupSearch.value || '').trim().toLocaleLowerCase('ko-KR');
  const filtered = state.students.filter((student) => {
    const label = `${student.name} ${student.studentNo}`.toLocaleLowerCase('ko-KR');
    return label.includes(query);
  });
  elements.studentList.replaceChildren();

  if (!state.students.length) {
    elements.studentList.appendChild(createEmptyState('등록된 시간표가 없습니다.'));
    return;
  }
  if (!filtered.length) {
    elements.studentList.appendChild(createEmptyState('검색 결과가 없습니다.'));
    return;
  }

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
  renderReadonlySchedule(student.schedule, (day, period) => renderClassmatesForCell(student.studentNo, day, period));
  elements.classmatePanel.hidden = true;
  elements.studentScheduleCard.hidden = false;
  if (shouldScroll) elements.studentScheduleCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTimeLookup() {
  if (!state.profile?.registered) return;
  const day = elements.lookupDay.value || DAYS[0];
  const period = Number(elements.lookupPeriod.value || 1);
  const groups = groupStudentsBySubject(state.students, state.subjectsById, day, period);
  elements.timeLookupResults.replaceChildren();
  if (!groups.length) {
    elements.timeLookupResults.appendChild(createEmptyState('조회할 학생이 없습니다.'));
    return;
  }
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
    section.append(heading, names);
    elements.timeLookupResults.appendChild(section);
  }
}

function renderClassmatesForCell(studentNo, day, period) {
  const match = findClassmatesForCell(state.students, state.subjectsById, studentNo, day, period);
  if (!match) return;
  elements.classmateTitle.textContent = match.subjectId === FREE_SUBJECT_ID
    ? '같이 공강인 친구'
    : `${match.subject} 같이 듣는 친구`;
  elements.classmateMeta.textContent = `${day}요일 ${period}교시 · 전체 ${match.students.length}명`;
  elements.classmateList.replaceChildren();
  if (!match.classmates.length) {
    elements.classmateList.appendChild(createEmptyState('같은 시간에 함께 있는 다른 친구가 없습니다.'));
  } else {
    for (const studentRef of match.classmates) {
      const student = state.students.find((item) => item.studentNo === studentRef.studentNo) || studentRef;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'student-chip';
      chip.textContent = buildStudentLabel(student, state.students);
      chip.addEventListener('click', () => selectStudent(studentRef.studentNo));
      elements.classmateList.appendChild(chip);
    }
  }
  elements.classmatePanel.hidden = false;
  elements.classmatePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderFreeLookup() {
  if (!state.profile?.registered) return;
  const day = elements.freeDay.value || DAYS[0];
  const period = Number(elements.freePeriod.value || 1);
  const freeStudents = findFreeStudents(state.students, state.subjectsById, day, period);
  elements.freeCount.textContent = `${freeStudents.length}명`;
  elements.freeResults.replaceChildren();
  if (!freeStudents.length) {
    elements.freeResults.appendChild(createEmptyState(`${day}요일 ${period}교시에 공강인 학생이 없습니다.`));
    return;
  }
  for (const row of freeStudents) {
    const student = state.students.find((item) => item.studentNo === row.studentNo) || row;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'result-item is-free';
    const name = document.createElement('strong');
    name.textContent = buildStudentLabel(student, state.students);
    const meta = document.createElement('span');
    meta.textContent = `${day}요일 ${period}교시 · 공강`;
    item.append(name, meta);
    item.addEventListener('click', () => selectStudent(row.studentNo));
    elements.freeResults.appendChild(item);
  }
}

function readPendingIdentity() {
  try {
    const raw = sessionStorage.getItem(PENDING_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingIdentity() {
  sessionStorage.removeItem(PENDING_IDENTITY_KEY);
}

function switchView(viewName) {
  document.querySelectorAll('[data-view]').forEach((view) => {
    view.hidden = view.dataset.view !== viewName;
  });
  document.querySelectorAll('[data-nav]').forEach((button) => {
    const active = button.dataset.nav === viewName;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
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
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function showToast(message, isError = false) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, isError ? 5200 : 3000);
}

function humanizeError(error) {
  const message = String(error?.message || error || '알 수 없는 오류');
  if (/ROSTER_MISMATCH/.test(message)) return '학번 또는 이름이 명단과 일치하지 않습니다.';
  if (/STUDENT_ALREADY_BOUND/.test(message)) return '이미 다른 Microsoft 계정에 연결된 학생입니다.';
  if (/ACCOUNT_ALREADY_BOUND/.test(message)) return '이 Microsoft 계정은 이미 다른 학생에게 연결되어 있습니다.';
  if (/ANALYSIS_LIMIT_REACHED/.test(message)) return 'AI 분석 가능 횟수 2회를 모두 사용했습니다.';
  if (/ANALYSIS_COOLDOWN/.test(message)) {
    const seconds = Number(error?.retryAfterSeconds || 0);
    return seconds > 0 ? `재분석은 ${formatDuration(seconds)} 후 가능합니다.` : '첫 분석 후 10분이 지나야 다시 분석할 수 있습니다.';
  }
  if (/ANALYSIS_IN_PROGRESS/.test(message)) return '이미 분석 중입니다. 잠시 후 다시 시도해주세요.';
  if (/INVALID_SUBJECT|UNKNOWN/.test(message)) return '미확인 과목이 있습니다. 과목 목록에서 다시 선택해주세요.';
  if (/ANALYSIS_REQUIRED/.test(message)) return '시간표를 한 번 AI 분석한 뒤 저장할 수 있습니다.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
  return message.length > 180 ? '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' : message;
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}
