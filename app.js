'use strict';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function normalizeName(value) {
  const compact = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!compact) return '';
  const parts = compact.split(' ');
  const allHangul = parts.every((part) => /^\p{Script=Hangul}+$/u.test(part));
  return allHangul ? parts.join('') : compact;
}

function normalizeSchedule(schedule = {}) {
  return DAYS.reduce((result, day) => {
    const source = Array.isArray(schedule[day]) ? schedule[day] : [];
    result[day] = PERIODS.map((_, index) => String(source[index] ?? '').trim());
    return result;
  }, {});
}

function isFreeSubject(subject) {
  const normalized = String(subject ?? '').trim();
  return normalized === '' || normalized === '공강';
}

function validateStudentDraft(name, schedule) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return { ok: false, message: '학생 이름을 입력해주세요.' };
  }
  if (normalizedName.length > 30) {
    return { ok: false, message: '학생 이름은 30자 이내로 입력해주세요.' };
  }
  if (!schedule || typeof schedule !== 'object') {
    return { ok: false, message: '먼저 시간표 이미지를 분석해주세요.' };
  }

  const normalizedSchedule = normalizeSchedule(schedule);
  const tooLong = DAYS.some((day) => normalizedSchedule[day].some((subject) => subject.length > 60));
  if (tooLong) {
    return { ok: false, message: '과목명은 60자 이내로 입력해주세요.' };
  }

  return { ok: true, name: normalizedName, schedule: normalizedSchedule };
}

function getStudentsAt(students, day, period) {
  const periodIndex = PERIODS.indexOf(Number(period));
  if (!DAYS.includes(day) || periodIndex < 0) return [];

  return (Array.isArray(students) ? students : []).map((student) => {
    const subject = normalizeSchedule(student.schedule)[day][periodIndex];
    const free = isFreeSubject(subject);
    return {
      name: normalizeName(student.name),
      subject: free ? '공강' : subject,
      isFree: free,
    };
  });
}

function findFreeStudents(students, day, period) {
  return getStudentsAt(students, day, period).filter((item) => item.isFree);
}

function normalizeSubjectForMatch(subject) {
  const normalized = String(subject ?? '').trim().replace(/\s+/g, ' ');
  return isFreeSubject(normalized) ? '공강' : normalized;
}

function groupStudentsBySubject(students, day, period) {
  const groups = new Map();
  getStudentsAt(students, day, period).forEach((item) => {
    const subject = normalizeSubjectForMatch(item.subject);
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push(item.name);
  });

  return Array.from(groups, ([subject, names]) => ({
    subject,
    students: names.sort((a, b) => a.localeCompare(b, 'ko-KR')),
    isFree: subject === '공강',
  })).sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;
    return a.subject.localeCompare(b.subject, 'ko-KR');
  });
}

function findClassmatesForCell(students, studentName, day, period) {
  const normalizedName = normalizeName(studentName);
  const rows = getStudentsAt(students, day, period);
  const selected = rows.find((item) => item.name === normalizedName);
  if (!selected) return null;

  const subject = normalizeSubjectForMatch(selected.subject);
  const names = rows
    .filter((item) => normalizeSubjectForMatch(item.subject) === subject)
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b, 'ko-KR'));

  return {
    subject,
    students: names,
    classmates: names.filter((name) => name !== normalizedName),
  };
}

function upsertStudent(students, student) {
  const nextStudent = {
    ...student,
    name: normalizeName(student?.name),
    schedule: normalizeSchedule(student?.schedule),
  };
  const next = Array.isArray(students) ? students.filter(Boolean).map((item) => ({ ...item })) : [];
  const index = next.findIndex((item) => normalizeName(item.name) === nextStudent.name);
  if (index >= 0) next.splice(index, 1);
  next.unshift(nextStudent);
  return next;
}

function normalizeSupabaseConfig(config = {}) {
  return {
    url: String(config.url ?? '').trim().replace(/\/+$/, ''),
    publishableKey: String(config.publishableKey ?? '').trim(),
  };
}

function isSupabaseConfigured(config) {
  const normalized = normalizeSupabaseConfig(config);
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalized.url)
    && normalized.publishableKey.startsWith('sb_publishable_');
}

function getSupabaseHeaders(config, extra = {}) {
  const normalized = normalizeSupabaseConfig(config);
  return {
    apikey: normalized.publishableKey,
    Accept: 'application/json',
    ...extra,
  };
}

async function readErrorMessage(response) {
  try {
    const body = await response.text();
    if (!body) return `HTTP ${response.status || '오류'}`;
    try {
      const parsed = JSON.parse(body);
      return parsed.message || parsed.hint || parsed.details || body;
    } catch {
      return body;
    }
  } catch {
    return `HTTP ${response.status || '오류'}`;
  }
}

async function fetchStudentsFromSupabase(config, fetchImpl = fetch) {
  const normalized = normalizeSupabaseConfig(config);
  if (!isSupabaseConfigured(normalized)) {
    throw new Error('Supabase 연결 정보가 설정되지 않았습니다.');
  }

  const query = 'select=name,updated_at,schedule&order=updated_at.desc';
  const response = await fetchImpl(`${normalized.url}/rest/v1/students?${query}`, {
    method: 'GET',
    headers: getSupabaseHeaders(normalized),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`공용 시간표를 불러오지 못했습니다: ${await readErrorMessage(response)}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && normalizeName(row.name))
    .map((row) => ({
      name: normalizeName(row.name),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
      schedule: normalizeSchedule(row.schedule),
    }));
}

async function analyzeScheduleImage(config, imageDataUrl, fetchImpl = fetch) {
  const normalized = normalizeSupabaseConfig(config);
  if (!isSupabaseConfigured(normalized)) {
    throw new Error('Supabase 연결 정보가 설정되지 않았습니다.');
  }
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(String(imageDataUrl || ''))) {
    throw new Error('분석할 이미지 데이터가 올바르지 않습니다.');
  }

  const response = await fetchImpl(`${normalized.url}/functions/v1/analyze-timetable`, {
    method: 'POST',
    headers: getSupabaseHeaders(normalized, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!response.ok) {
    throw new Error(`시간표 이미지 분석에 실패했습니다: ${await readErrorMessage(response)}`);
  }

  const data = await response.json();
  if (!data || !data.schedule || typeof data.schedule !== 'object') {
    throw new Error('AI 분석 결과 형식이 올바르지 않습니다.');
  }
  return normalizeSchedule(data.schedule);
}

function fileToDataUrl(file, globalObj = window) {
  return new Promise((resolve, reject) => {
    const reader = new globalObj.FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function upsertStudentToSupabase(config, student, fetchImpl = fetch) {
  const normalized = normalizeSupabaseConfig(config);
  if (!isSupabaseConfigured(normalized)) {
    throw new Error('Supabase 연결 정보가 설정되지 않았습니다.');
  }

  const validation = validateStudentDraft(student?.name, student?.schedule);
  if (!validation.ok) throw new Error(validation.message);

  const payload = {
    name: validation.name,
    updated_at: student?.updatedAt || new Date().toISOString(),
    schedule: validation.schedule,
  };

  const response = await fetchImpl(`${normalized.url}/rest/v1/students?on_conflict=name`, {
    method: 'POST',
    headers: getSupabaseHeaders(normalized, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`시간표를 저장하지 못했습니다: ${await readErrorMessage(response)}`);
  }

  return payload;
}

function initApp(doc = document, globalObj = window) {
  const elements = {
    studentName: doc.getElementById('studentName'),
    scheduleImage: doc.getElementById('scheduleImage'),
    imagePreviewWrap: doc.getElementById('imagePreviewWrap'),
    imagePreview: doc.getElementById('imagePreview'),
    analyzeBtn: doc.getElementById('analyzeBtn'),
    analysisPanel: doc.getElementById('analysisPanel'),
    editableScheduleWrap: doc.getElementById('editableScheduleWrap'),
    saveBtn: doc.getElementById('saveBtn'),
    lookupSearch: doc.getElementById('lookupSearch'),
    studentList: doc.getElementById('studentList'),
    lookupDay: doc.getElementById('lookupDay'),
    lookupPeriod: doc.getElementById('lookupPeriod'),
    timeLookupBtn: doc.getElementById('timeLookupBtn'),
    timeLookupResults: doc.getElementById('timeLookupResults'),
    studentScheduleCard: doc.getElementById('studentScheduleCard'),
    selectedStudentTitle: doc.getElementById('selectedStudentTitle'),
    selectedStudentUpdated: doc.getElementById('selectedStudentUpdated'),
    readonlyScheduleWrap: doc.getElementById('readonlyScheduleWrap'),
    classmatePanel: doc.getElementById('classmatePanel'),
    classmateTitle: doc.getElementById('classmateTitle'),
    classmateMeta: doc.getElementById('classmateMeta'),
    classmateList: doc.getElementById('classmateList'),
    freeDay: doc.getElementById('freeDay'),
    freePeriod: doc.getElementById('freePeriod'),
    freeLookupBtn: doc.getElementById('freeLookupBtn'),
    freeCount: doc.getElementById('freeCount'),
    freeResults: doc.getElementById('freeResults'),
    toast: doc.getElementById('toast'),
  };

  const state = {
    students: [],
    draftSchedule: null,
    selectedStudentName: '',
    previewUrl: '',
    toastTimer: null,
    supabaseConfig: normalizeSupabaseConfig(globalObj.TIMETABLE_SUPABASE_CONFIG),
    syncing: false,
  };

  fillSelect(elements.lookupDay, DAYS, (day) => `${day}요일`);
  fillSelect(elements.freeDay, DAYS, (day) => `${day}요일`);
  fillSelect(elements.lookupPeriod, PERIODS, (period) => `${period}교시`);
  fillSelect(elements.freePeriod, PERIODS, (period) => `${period}교시`);

  async function refreshSharedStudents({ notifyOnError = true } = {}) {
    if (state.syncing) return state.students;
    state.syncing = true;
    try {
      state.students = await fetchStudentsFromSupabase(state.supabaseConfig, globalObj.fetch.bind(globalObj));
      renderStudentList(doc, elements, state);
      renderTimeLookup(doc, elements, state);
      renderFreeLookup(doc, elements, state);

      if (state.selectedStudentName) {
        const selectedExists = state.students.some((student) => student.name === state.selectedStudentName);
        if (selectedExists) selectStudent(doc, elements, state, state.selectedStudentName, false);
        else elements.studentScheduleCard.hidden = true;
      }
      return state.students;
    } catch (error) {
      if (notifyOnError) showToast(elements, state, humanizeSupabaseError(error), true);
      return state.students;
    } finally {
      state.syncing = false;
    }
  }

  doc.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', async () => {
      switchView(doc, button.dataset.nav);
      if (button.dataset.nav === 'lookup' || button.dataset.nav === 'free') {
        await refreshSharedStudents();
      }
    });
  });

  elements.studentName.addEventListener('blur', () => {
    elements.studentName.value = normalizeName(elements.studentName.value);
  });

  elements.scheduleImage.addEventListener('change', () => {
    const file = elements.scheduleImage.files?.[0];
    if (state.previewUrl) {
      globalObj.URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = '';
    }

    if (!file) {
      elements.imagePreview.removeAttribute('src');
      elements.imagePreviewWrap.hidden = true;
      return;
    }

    if (!file.type.startsWith('image/')) {
      elements.scheduleImage.value = '';
      elements.imagePreview.removeAttribute('src');
      elements.imagePreviewWrap.hidden = true;
      showToast(elements, state, '이미지 파일만 선택할 수 있습니다.', true);
      return;
    }

    state.previewUrl = globalObj.URL.createObjectURL(file);
    elements.imagePreview.src = state.previewUrl;
    elements.imagePreviewWrap.hidden = false;
  });

  elements.analyzeBtn.addEventListener('click', async () => {
    const name = normalizeName(elements.studentName.value);
    if (!name) {
      showToast(elements, state, '학생 이름을 먼저 입력해주세요.', true);
      elements.studentName.focus();
      return;
    }

    const file = elements.scheduleImage.files?.[0];
    if (!file) {
      showToast(elements, state, '분석할 시간표 이미지를 선택해주세요.', true);
      elements.scheduleImage.focus();
      return;
    }

    elements.studentName.value = name;
    setButtonLoading(elements.analyzeBtn, true, 'AI 분석 중...');

    try {
      const imageDataUrl = await fileToDataUrl(file, globalObj);
      state.draftSchedule = await analyzeScheduleImage(
        state.supabaseConfig,
        imageDataUrl,
        globalObj.fetch.bind(globalObj),
      );
      renderEditableSchedule(doc, elements.editableScheduleWrap, state.draftSchedule);
      elements.analysisPanel.hidden = false;
      elements.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showToast(elements, state, humanizeAnalysisError(error), true);
    } finally {
      setButtonLoading(elements.analyzeBtn, false);
    }
  });

  elements.saveBtn.addEventListener('click', async () => {
    if (!state.draftSchedule) {
      showToast(elements, state, '먼저 시간표 분석을 진행해주세요.', true);
      return;
    }

    const editedSchedule = collectEditedSchedule(elements.editableScheduleWrap);
    const validation = validateStudentDraft(elements.studentName.value, editedSchedule);
    if (!validation.ok) {
      showToast(elements, state, validation.message, true);
      return;
    }

    setButtonLoading(elements.saveBtn, true, '공유 저장 중...');
    try {
      const student = {
        name: validation.name,
        updatedAt: new Date().toISOString(),
        schedule: validation.schedule,
      };
      await upsertStudentToSupabase(state.supabaseConfig, student, globalObj.fetch.bind(globalObj));
      state.students = upsertStudent(state.students, student);
      state.draftSchedule = validation.schedule;
      elements.studentName.value = validation.name;
      renderStudentList(doc, elements, state);
      renderTimeLookup(doc, elements, state);
      renderFreeLookup(doc, elements, state);
      showToast(elements, state, `${validation.name} 시간표를 모두에게 공유했습니다.`);
    } catch (error) {
      showToast(elements, state, humanizeSupabaseError(error), true);
    } finally {
      setButtonLoading(elements.saveBtn, false);
    }
  });

  elements.lookupSearch.addEventListener('input', () => renderStudentList(doc, elements, state));
  elements.timeLookupBtn.addEventListener('click', async () => {
    await refreshSharedStudents();
    renderTimeLookup(doc, elements, state);
  });
  elements.lookupDay.addEventListener('change', () => renderTimeLookup(doc, elements, state));
  elements.lookupPeriod.addEventListener('change', () => renderTimeLookup(doc, elements, state));
  elements.freeLookupBtn.addEventListener('click', async () => {
    await refreshSharedStudents();
    renderFreeLookup(doc, elements, state);
  });
  elements.freeDay.addEventListener('change', () => renderFreeLookup(doc, elements, state));
  elements.freePeriod.addEventListener('change', () => renderFreeLookup(doc, elements, state));

  renderStudentList(doc, elements, state);
  renderTimeLookup(doc, elements, state);
  renderFreeLookup(doc, elements, state);

  if (!isSupabaseConfigured(state.supabaseConfig)) {
    showToast(elements, state, '공용 DB 연결 정보가 없습니다. 관리자에게 알려주세요.', true);
  } else {
    refreshSharedStudents({ notifyOnError: false });
  }

  return state;
}

function humanizeAnalysisError(error) {
  const message = String(error?.message || error || '알 수 없는 오류');
  if (/404|not found|AI 키가 설정되지/i.test(message)) {
    return '시간표 AI 분석 서버 설정이 아직 완료되지 않았습니다. 관리자 설정이 필요합니다.';
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'AI 분석 서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
  }
  if (/413|too large|payload|용량이 너무/i.test(message)) {
    return '이미지 용량이 너무 큽니다. 스크린샷이나 더 작은 이미지를 사용해주세요.';
  }
  return message.length > 160 ? '시간표 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' : message;
}

function humanizeSupabaseError(error) {
  const message = String(error?.message || error || '알 수 없는 오류');
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return '공용 DB에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
  }
  if (/row-level security|permission denied|42501/i.test(message)) {
    return '공용 DB 권한 설정을 확인해주세요.';
  }
  if (/duplicate key|23505/i.test(message)) {
    return '같은 이름의 시간표를 갱신하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
  return message.length > 140 ? '공용 DB 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' : message;
}

function fillSelect(select, values, labeler) {
  select.replaceChildren();
  values.forEach((value) => {
    const option = select.ownerDocument.createElement('option');
    option.value = String(value);
    option.textContent = labeler(value);
    select.appendChild(option);
  });
}

function switchView(doc, viewName) {
  doc.querySelectorAll('[data-view]').forEach((view) => {
    view.hidden = view.dataset.view !== viewName;
  });

  doc.querySelectorAll('[data-nav]').forEach((button) => {
    const active = button.dataset.nav === viewName;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const main = doc.getElementById('mainContent');
  main?.scrollIntoView({ block: 'start' });
}

function renderEditableSchedule(doc, container, schedule) {
  container.replaceChildren(buildScheduleTable(doc, schedule, true));
}

function renderReadOnlySchedule(doc, container, schedule, onCellClick) {
  container.replaceChildren(buildScheduleTable(doc, schedule, false, onCellClick));
}

function buildScheduleTable(doc, schedule, editable, onCellClick) {
  const normalized = normalizeSchedule(schedule);
  const table = doc.createElement('table');
  table.className = 'schedule-table';

  const thead = doc.createElement('thead');
  const headerRow = doc.createElement('tr');
  const corner = doc.createElement('th');
  corner.scope = 'col';
  corner.textContent = '교시';
  headerRow.appendChild(corner);
  DAYS.forEach((day) => {
    const th = doc.createElement('th');
    th.scope = 'col';
    th.textContent = `${day}요일`;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  PERIODS.forEach((period, periodIndex) => {
    const row = doc.createElement('tr');
    const periodHeader = doc.createElement('th');
    periodHeader.scope = 'row';
    periodHeader.textContent = `${period}교시`;
    row.appendChild(periodHeader);

    DAYS.forEach((day) => {
      const td = doc.createElement('td');
      const subject = normalized[day][periodIndex];

      if (editable) {
        const input = doc.createElement('input');
        input.className = 'schedule-input';
        input.type = 'text';
        input.maxLength = 60;
        input.value = subject;
        input.dataset.day = day;
        input.dataset.period = String(period);
        input.setAttribute('aria-label', `${day}요일 ${period}교시 과목명`);
        td.appendChild(input);
      } else {
        const free = isFreeSubject(subject);
        td.className = `schedule-cell${free ? ' is-free' : ''}`;
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'schedule-cell-button';
        button.textContent = free ? '공강' : subject;
        button.setAttribute('aria-label', `${day}요일 ${period}교시 ${free ? '공강' : subject} 같이 있는 친구 보기`);
        button.addEventListener('click', () => {
          if (typeof onCellClick === 'function') onCellClick(day, period);
        });
        td.appendChild(button);
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function collectEditedSchedule(container) {
  const schedule = normalizeSchedule({});
  container.querySelectorAll('.schedule-input').forEach((input) => {
    const day = input.dataset.day;
    const periodIndex = Number(input.dataset.period) - 1;
    if (DAYS.includes(day) && periodIndex >= 0 && periodIndex < PERIODS.length) {
      schedule[day][periodIndex] = input.value.trim();
    }
  });
  return schedule;
}

function renderStudentList(doc, elements, state) {
  const query = normalizeName(elements.lookupSearch.value).toLocaleLowerCase('ko-KR');
  const filtered = state.students.filter((student) => student.name.toLocaleLowerCase('ko-KR').includes(query));
  elements.studentList.replaceChildren();

  if (!state.students.length) {
    elements.studentList.appendChild(createEmptyState(doc, '아직 공유된 시간표가 없습니다. 먼저 시간표를 등록해보세요.'));
    elements.studentScheduleCard.hidden = true;
    return;
  }

  if (!filtered.length) {
    elements.studentList.appendChild(createEmptyState(doc, '검색 결과가 없습니다. 다른 이름으로 찾아보세요.'));
    return;
  }

  filtered.forEach((student) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'student-button';
    button.setAttribute('aria-label', `${student.name} 전체 시간표 보기`);

    const textWrap = doc.createElement('div');
    const name = doc.createElement('strong');
    name.textContent = student.name;
    const updated = doc.createElement('span');
    updated.textContent = student.updatedAt ? `업데이트 ${formatUpdatedAt(student.updatedAt)}` : '공유된 시간표';
    textWrap.append(name, updated);

    const action = doc.createElement('strong');
    action.textContent = '보기';
    action.style.color = 'var(--primary)';

    button.append(textWrap, action);
    button.addEventListener('click', () => selectStudent(doc, elements, state, student.name));
    elements.studentList.appendChild(button);
  });
}

function selectStudent(doc, elements, state, studentName, shouldScroll = true) {
  const student = state.students.find((item) => item.name === studentName);
  if (!student) return;
  state.selectedStudentName = student.name;
  elements.selectedStudentTitle.textContent = `${student.name} 시간표`;
  elements.selectedStudentUpdated.textContent = student.updatedAt ? `마지막 저장: ${formatUpdatedAt(student.updatedAt)}` : '';
  renderReadOnlySchedule(doc, elements.readonlyScheduleWrap, student.schedule, (day, period) => {
    renderClassmatesForCell(doc, elements, state, student.name, day, period);
  });
  if (elements.classmatePanel) elements.classmatePanel.hidden = true;
  elements.studentScheduleCard.hidden = false;
  if (shouldScroll) elements.studentScheduleCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTimeLookup(doc, elements, state) {
  const day = elements.lookupDay.value || DAYS[0];
  const period = Number(elements.lookupPeriod.value || PERIODS[0]);
  const groups = groupStudentsBySubject(state.students, day, period);
  elements.timeLookupResults.replaceChildren();

  if (!groups.length) {
    elements.timeLookupResults.appendChild(createEmptyState(doc, '공유된 학생이 없어 조회할 수 없습니다.'));
    return;
  }

  groups.forEach((group) => {
    const item = doc.createElement('section');
    item.className = `subject-group${group.isFree ? ' is-free' : ''}`;

    const heading = doc.createElement('div');
    heading.className = 'subject-group__heading';
    const subject = doc.createElement('strong');
    subject.textContent = group.subject;
    const count = doc.createElement('span');
    count.textContent = `${group.students.length}명`;
    heading.append(subject, count);

    const names = doc.createElement('div');
    names.className = 'subject-group__students';
    group.students.forEach((studentName) => {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'student-chip';
      chip.textContent = studentName;
      chip.setAttribute('aria-label', `${studentName} 전체 시간표 보기`);
      chip.addEventListener('click', () => selectStudent(doc, elements, state, studentName));
      names.appendChild(chip);
    });

    item.append(heading, names);
    elements.timeLookupResults.appendChild(item);
  });
}

function renderClassmatesForCell(doc, elements, state, studentName, day, period) {
  const match = findClassmatesForCell(state.students, studentName, day, period);
  if (!match || !elements.classmatePanel) return;

  elements.classmateTitle.textContent = match.subject === '공강'
    ? '같이 공강인 친구'
    : `${match.subject} 같이 듣는 친구`;
  elements.classmateMeta.textContent = `${day}요일 ${period}교시 · 전체 ${match.students.length}명`;
  elements.classmateList.replaceChildren();

  if (!match.classmates.length) {
    elements.classmateList.appendChild(createEmptyState(
      doc,
      match.subject === '공강'
        ? '이 시간에 같이 공강인 다른 친구가 없습니다.'
        : '이 수업을 같이 듣는 다른 친구가 없습니다.',
    ));
  } else {
    match.classmates.forEach((name) => {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.className = 'student-chip';
      chip.textContent = name;
      chip.setAttribute('aria-label', `${name} 전체 시간표 보기`);
      chip.addEventListener('click', () => selectStudent(doc, elements, state, name));
      elements.classmateList.appendChild(chip);
    });
  }

  elements.classmatePanel.hidden = false;
  elements.classmatePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderFreeLookup(doc, elements, state) {
  const day = elements.freeDay.value || DAYS[0];
  const period = Number(elements.freePeriod.value || PERIODS[0]);
  const freeStudents = findFreeStudents(state.students, day, period);
  elements.freeCount.textContent = `${freeStudents.length}명`;
  elements.freeResults.replaceChildren();

  if (!state.students.length) {
    elements.freeResults.appendChild(createEmptyState(doc, '아직 공유된 학생이 없습니다. 시간표를 등록하면 공강을 찾을 수 있습니다.'));
    return;
  }

  if (!freeStudents.length) {
    elements.freeResults.appendChild(createEmptyState(doc, `${day}요일 ${period}교시에는 공강인 학생이 없습니다.`));
    return;
  }

  freeStudents.forEach((student) => {
    const item = doc.createElement('div');
    item.className = 'result-item is-free';
    const name = doc.createElement('strong');
    name.textContent = student.name;
    const meta = doc.createElement('span');
    meta.textContent = `${day}요일 ${period}교시 · 공강`;
    item.append(name, meta);
    elements.freeResults.appendChild(item);
  });
}

function createEmptyState(doc, message) {
  const div = doc.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  return div;
}

function formatUpdatedAt(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function setButtonLoading(button, loading, loadingText = '처리 중...') {
  if (loading) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = loadingText;
    return;
  }
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = button.dataset.originalText || button.textContent;
}

function showToast(elements, state, message, isError = false) {
  if (state.toastTimer) window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.setAttribute('role', isError ? 'alert' : 'status');
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp(document, window);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DAYS,
    PERIODS,
    normalizeName,
    normalizeSchedule,
    isFreeSubject,
    validateStudentDraft,
    getStudentsAt,
    findFreeStudents,
    groupStudentsBySubject,
    findClassmatesForCell,
    upsertStudent,
    normalizeSupabaseConfig,
    isSupabaseConfigured,
    fetchStudentsFromSupabase,
    analyzeScheduleImage,
    upsertStudentToSupabase,
    humanizeAnalysisError,
    humanizeSupabaseError,
    initApp,
  };
}
