export const DAYS = ['월', '화', '수', '목', '금'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];
export const FREE_SUBJECT_ID = 'FREE';
export const UNKNOWN_SUBJECT_ID = 'UNKNOWN';

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
    return {
      studentNo,
      name,
      subjectId,
      subject: subjectName(subjectsById, subjectId),
      isFree: isFreeSubjectId(subjectId),
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
    groups.get(row.subjectId).students.push({ studentNo: row.studentNo, name: row.name });
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
