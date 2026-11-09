import type { Source, Track } from '../types'
import { collegeNames } from './colleges'

/** 모든 규정은 한국외대 홈페이지 학사정보·학사공지 2026.11.06 확인 기준 */
export const CHECKED = '2026.11.06'

export const SOURCES = {
  credits: { title: '졸업이수학점(졸업학점 배분표)', url: 'https://www.hufs.ac.kr/hufs/11373/subview.do', checked: CHECKED },
  doubleInfo: { title: '학사정보 · 이중전공', url: 'https://www.hufs.ac.kr/hufs/11384/subview.do', checked: CHECKED },
  doubleNotice: {
    title: '2026-2학기 이중전공 신청 일정 공고 (2026.11.05)',
    url: 'https://www.hufs.ac.kr/bbs/hufs/2181/270884/artclView.do',
    checked: CHECKED,
  },
  leave: { title: '학사정보 · 휴·복학', url: 'https://www.hufs.ac.kr/hufs/11387/subview.do', checked: CHECKED },
} satisfies Record<string, Source>

export const CONTACT = {
  seoul: '서울 학사종합지원센터 02-2173-2130',
  global: '글로벌 학사종합지원센터 031-330-4027',
}

export const TRACK_LABEL: Record<Track, string> = {
  double: '이중전공',
  minor: '부전공',
  intensive_minor: '전공심화+부전공',
  intensive: '전공심화',
  undecided: '이수 유형 미정',
}

/** 단과대학 목록 (출처·확인일은 colleges.ts 참조) */
export const SEOUL_COLLEGES = collegeNames('seoul')
export const GLOBAL_COLLEGES = collegeNames('global')

interface CreditRow {
  major: number
  double?: number
  minor?: number
  general: number
  basic?: number
  total: number
}

type CreditTable = Record<Exclude<Track, 'undecided'>, CreditRow>

/** 서울 2025학년도 이후 입학생, 모든대학(사범대학 제외) */
const SEOUL_2025: CreditTable = {
  double: { major: 42, double: 42, general: 32, basic: 6, total: 126 },
  minor: { major: 42, minor: 21, general: 32, basic: 6, total: 126 },
  intensive_minor: { major: 54, minor: 21, general: 32, basic: 6, total: 126 },
  intensive: { major: 54, general: 32, basic: 6, total: 126 },
}

/** 서울 2015~2024학년도 입학생, 모든대학(사범대학·AI융합대학 제외) */
const SEOUL_2015_2024: CreditTable = {
  double: { major: 54, double: 42, general: 32, total: 134 },
  minor: { major: 54, minor: 21, general: 32, total: 134 },
  intensive_minor: { major: 70, minor: 21, general: 32, total: 134 },
  intensive: { major: 70, general: 32, total: 134 },
}

/** 서울 2015~2024학년도 입학생, AI융합대학 */
const SEOUL_2015_2024_AI: CreditTable = {
  double: { major: 42, double: 42, general: 32, total: 134 },
  minor: { major: 42, minor: 21, general: 32, total: 134 },
  intensive_minor: { major: 58, minor: 21, general: 32, total: 134 },
  intensive: { major: 58, general: 32, total: 134 },
}

export type CreditLookup =
  | { ok: true; row: CreditRow; basis: string }
  | { ok: false; reason: string }

export function lookupCredits(campus: string, entryYear: number, college: string, track: Exclude<Track, 'undecided'>): CreditLookup {
  if (campus !== 'seoul') return { ok: false, reason: '이 프로토타입에는 서울캠퍼스 배분표만 수록되어 있어요.' }
  if (college === '사범대학') return { ok: false, reason: '사범대학은 교직 이수 여부에 따라 기준이 달라 이 프로토타입에서는 다루지 않아요.' }
  if (entryYear >= 2025) {
    return { ok: true, row: SEOUL_2025[track], basis: '서울캠퍼스 2025학년도 이후 입학생 배분표(사범대학 제외)' }
  }
  if (entryYear >= 2015) {
    if (college === 'AI융합대학') {
      return { ok: true, row: SEOUL_2015_2024_AI[track], basis: '서울캠퍼스 2015~2024학년도 입학생 배분표(AI융합대학)' }
    }
    return { ok: true, row: SEOUL_2015_2024[track], basis: '서울캠퍼스 2015~2024학년도 입학생 배분표(사범대학·AI융합대학 제외)' }
  }
  return { ok: false, reason: '2014학년도 이전 입학생 기준은 수록되어 있지 않아요.' }
}

export function creditBreakdown(row: CreditRow) {
  const items: { label: string; value: number }[] = [{ label: '전공', value: row.major }]
  if (row.double) items.push({ label: '이중전공', value: row.double })
  if (row.minor) items.push({ label: '부전공', value: row.minor })
  items.push({ label: '교양', value: row.general })
  if (row.basic) items.push({ label: '기초', value: row.basic })
  return items
}

/** 2026-2학기 이중전공 신청 공고 (2026.11.05) */
export const DOUBLE_NOTICE = {
  period: '2026.11.24(화) 10:00 ~ 11.30(월) 16:00',
  path: '종합정보시스템 → 전공/교직관리 → 이중전공 신청',
  missedWarning:
    '기간 내 미신청·탈락 시 다음 학기부터 일반 신청은 할 수 없고, 본인 학번대에 여석이 있는 경우에만 변경 신청이 가능해요.',
}

/** 우선배정 학점 기준: 학사정보 안내와 2026-2 공고가 다름 */
export function priorityCredits(entryYear: number) {
  const info = entryYear >= 2025 ? 32 : 34
  const notice = 34
  return { info, notice, conflict: info !== notice }
}
