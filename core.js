export const DAYS = ['월', '화', '수', '목', '금'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];
export const FREE_SUBJECT_ID = 'FREE';
export const UNKNOWN_SUBJECT_ID = 'UNKNOWN';
export const CLASSROOM_OPTIONS = ['201','202','203','204','205','206','207','208','운동장','정보교과실'];

export function emptyClassrooms() {
  return Object.fromEntries(DAYS.map((day) => [day, PERIODS.map(() => [])]));
}

export function normalizeClassrooms(classrooms = {}) {
  const allowed = new Set(CLASSROOM_OPTIONS);
  return DAYS.reduce((result, day) => {
    const source = Array.isArray(classrooms?.[day]) ? classrooms[day] : [];
    result[day] = PERIODS.map((_, index) => {
      const raw = Array.isArray(source[index]) ? source[index] : (source[index] ? String(source[index]).split(/[\/,]/) : []);
      return [...new Set(raw.map((v) => String(v).trim()).filter((v) => allowed.has(v)))];
    });
    return result;
  }, {});
}

export function formatClassrooms(values) {
  return (Array.isArray(values) ? values : []).filter(Boolean).join(' / ');
}

export function normalizeRosterName(value) {
  const compact = String(value ?? '').trim().replace(/\s+/g, '');
  return compact.replace(/[A-Za-z]+$/g, '');
}

export function normalizeScheduleIds(schedule = {}) {
  return DAYS.reduce((result, day) => {
    const source = Array.isArray(schedule?.[day]) ? schedule[day] : [];
    result[day] = PERIODS.map((_, index) => {
      const subjectId = String(source[index] ?? '').trim().toUpperCase();
      return subjectId || UNKNOWN_SUBJECT_ID;
    });
    return result;
  }, {});
}

export function isFreeSubjectId(subjectId) {
  return String(subjectId ?? '').trim().toUpperCase() === FREE_SUBJECT_ID;
}

export function hasUnknownSubject(schedule) {
  const normalized = normalizeScheduleIds(schedule);
  return DAYS.some((day) => normalized[day].some((id) => id === UNKNOWN_SUBJECT_ID));
}

function subjectName(subjectsById, subjectId) {
  if (subjectId === FREE_SUBJECT_ID) return '공강';
  if (subjectId === UNKNOWN_SUBJECT_ID) return '미확인';
  return subjectsById?.get?.(subjectId) || subjectId;
}

export function getStudentsAt(students, subjectsById, day, period) {
  const periodIndex = PERIODS.indexOf(Number(period));
  if (!DAYS.includes(day) || periodIndex < 0) return [];

  return (Array.isArray(students) ? students : []).map((student) => {
    const studentNo = String(student?.studentNo ?? student?.student_no ?? '').trim();
    const name = normalizeRosterName(student?.name);
    const subjectId = normalizeScheduleIds(student?.schedule)[day][periodIndex];
    const classrooms = normalizeClassrooms(student?.classrooms)[day][periodIndex];
    return {
      studentNo,
      name,
      subjectId,
      subject: subjectName(subjectsById, subjectId),
      isFree: isFreeSubjectId(subjectId),
      classrooms,
    };
  }).filter((row) => row.studentNo && row.name);
}

export function buildStudentLabel(student, allStudents = []) {
  const name = normalizeRosterName(student?.name);
  const studentNo = String(student?.studentNo ?? student?.student_no ?? '').trim();
  const sameNameCount = (Array.isArray(allStudents) ? allStudents : [])
    .filter((item) => normalizeRosterName(item?.name) === name)
    .length;
  return sameNameCount > 1 && studentNo ? `${name} (${studentNo})` : name;
}

export function groupStudentsBySubject(students, subjectsById, day, period) {
  const groups = new Map();
  for (const row of getStudentsAt(students, subjectsById, day, period)) {
    if (!groups.has(row.subjectId)) {
      groups.set(row.subjectId, {
        subjectId: row.subjectId,
        subject: row.subject,
        isFree: row.isFree,
        students: [],
      });
    }
    groups.get(row.subjectId).students.push({ studentNo: row.studentNo, name: row.name, classrooms: row.classrooms });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      students: group.students.sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'ko-KR')),
    }))
    .sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;
      if (a.subjectId === UNKNOWN_SUBJECT_ID) return 1;
      if (b.subjectId === UNKNOWN_SUBJECT_ID) return -1;
      return a.subject.localeCompare(b.subject, 'ko-KR');
    });
}

export function findFreeStudents(students, subjectsById, day, period) {
  return getStudentsAt(students, subjectsById, day, period)
    .filter((row) => row.isFree)
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'ko-KR'));
}

export function findClassmatesForCell(students, subjectsById, studentNo, day, period) {
  const rows = getStudentsAt(students, subjectsById, day, period);
  const selected = rows.find((row) => row.studentNo === String(studentNo));
  if (!selected) return null;

  const studentsInSameSlot = rows
    .filter((row) => row.subjectId === selected.subjectId)
    .map((row) => ({ studentNo: row.studentNo, name: row.name }))
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'ko-KR'));

  return {
    subjectId: selected.subjectId,
    subject: selected.subject,
    students: studentsInSameSlot,
    classmates: studentsInSameSlot.filter((row) => row.studentNo !== String(studentNo)),
  };
}


function isExcludedFromClassmateMatching(subjectsById, subjectId) {
  const name = String(subjectName(subjectsById, subjectId) || '').trim();
  return name === '창체';
}

export function findMyClassmatesBySubject(students, subjectsById, studentNo) {
  const targetNo = String(studentNo ?? '').trim();
  const all = Array.isArray(students) ? students : [];
  const me = all.find((student) => String(student?.studentNo ?? student?.student_no ?? '').trim() === targetNo);
  if (!me) return [];

  const mySchedule = normalizeScheduleIds(me.schedule);
  const myClassrooms = normalizeClassrooms(me.classrooms);
  const groups = new Map();

  for (const day of DAYS) {
    PERIODS.forEach((period, index) => {
      const subjectId = mySchedule[day][index];
      if (subjectId === FREE_SUBJECT_ID || subjectId === UNKNOWN_SUBJECT_ID || isExcludedFromClassmateMatching(subjectsById, subjectId)) return;

      if (!groups.has(subjectId)) {
        groups.set(subjectId, {
          subjectId,
          subject: subjectName(subjectsById, subjectId),
          slots: [],
          classmatesByNo: new Map(),
        });
      }

      const group = groups.get(subjectId);
      group.slots.push({ day, period, classrooms: myClassrooms[day][index] });

      for (const student of all) {
        const otherNo = String(student?.studentNo ?? student?.student_no ?? '').trim();
        if (!otherNo || otherNo === targetNo) continue;
        const otherSchedule = normalizeScheduleIds(student?.schedule);
        if (otherSchedule[day][index] !== subjectId) continue;
        group.classmatesByNo.set(otherNo, {
          studentNo: otherNo,
          name: normalizeRosterName(student?.name),
        });
      }
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      subjectId: group.subjectId,
      subject: group.subject,
      slots: group.slots,
      classmates: Array.from(group.classmatesByNo.values())
        .filter((student) => student.name)
        .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'ko-KR')),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, 'ko-KR'));
}

export function findSharedClassesWithStudent(students, subjectsById, myStudentNo, otherStudentNo) {
  const myNo = String(myStudentNo ?? '').trim();
  const otherNo = String(otherStudentNo ?? '').trim();
  const all = Array.isArray(students) ? students : [];
  const me = all.find((student) => String(student?.studentNo ?? student?.student_no ?? '').trim() === myNo);
  const other = all.find((student) => String(student?.studentNo ?? student?.student_no ?? '').trim() === otherNo);
  if (!me || !other || !myNo || !otherNo || myNo === otherNo) return [];

  const mine = normalizeScheduleIds(me.schedule);
  const theirs = normalizeScheduleIds(other.schedule);
  const myClassrooms = normalizeClassrooms(me.classrooms);
  const groups = new Map();

  for (const day of DAYS) {
    PERIODS.forEach((period, index) => {
      const subjectId = mine[day][index];
      if (subjectId === FREE_SUBJECT_ID || subjectId === UNKNOWN_SUBJECT_ID || isExcludedFromClassmateMatching(subjectsById, subjectId)) return;
      if (theirs[day][index] !== subjectId) return;
      if (!groups.has(subjectId)) {
        groups.set(subjectId, {
          subjectId,
          subject: subjectName(subjectsById, subjectId),
          slots: [],
        });
      }
      groups.get(subjectId).slots.push({ day, period, classrooms: myClassrooms[day][index] });
    });
  }

  return Array.from(groups.values())
    .sort((a, b) => a.subject.localeCompare(b.subject, 'ko-KR'));
}

export function searchRosterStudents(roster, query, ownStudentNo = '') {
  const normalizedQuery = String(query ?? '').trim().toLocaleLowerCase('ko-KR');
  if (!normalizedQuery) return [];

  const ownNo = String(ownStudentNo ?? '').trim();
  const rows = (Array.isArray(roster) ? roster : [])
    .map((row) => ({
      studentNo: String(row?.studentNo ?? row?.student_no ?? '').trim(),
      name: normalizeRosterName(row?.name ?? row?.normalized_name),
      registered: Boolean(row?.registered),
    }))
    .filter((row) => row.studentNo && row.name && row.studentNo !== ownNo)
    .filter((row) => `${row.name} ${row.studentNo}`.toLocaleLowerCase('ko-KR').includes(normalizedQuery));

  return rows
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'ko-KR'))
    .slice(0, 30);
}


export function formatRelativeReadAt(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  const current = now instanceof Date ? now : new Date(now);
  const diffMs = current.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금 읽음';
  if (minutes < 60) return `${minutes}분 전 읽음`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 읽음`;
  if (hours < 48) return '어제 읽음';
  return `${date.getMonth() + 1}월 ${date.getDate()}일 읽음`;
}

export function formatChatListTime(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return '';
  if (date.toDateString() === current.toDateString()) {
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date);
}

export function isChatMessageUnread(message, otherReadMessageId, myStudentNo) {
  const sender = String(message?.sender_student_no ?? message?.senderStudentNo ?? '').trim();
  const id = Number(message?.id || 0);
  const readId = Number(otherReadMessageId || 0);
  return sender === String(myStudentNo ?? '').trim() && id > readId;
}
