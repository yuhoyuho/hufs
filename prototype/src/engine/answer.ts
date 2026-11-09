import {
  CONTACT,
  DOUBLE_NOTICE,
  SEOUL_COLLEGES,
  SOURCES,
  TRACK_LABEL,
  creditBreakdown,
  lookupCredits,
  priorityCredits,
} from '../data/rules'
import type { ChatContext, Overrides, Profile, Reply, Topic, Track } from '../types'

/**
 * 프로토타입용 답변 엔진.
 * 실제 서비스에서는 질문 해석과 설명 생성을 HyperCLOVA X가 맡고,
 * 수치·자격 판단은 지금처럼 규정 데이터와 코드가 맡는다.
 * 여기서는 질문 해석을 키워드 규칙으로 흉내 낸다.
 */

type P = Partial<Profile> & { transferTerm?: Overrides['transferTerm'] }

export interface AnswerResult {
  reply: Reply
  ctx: ChatContext
}

export const EMPTY_CTX: ChatContext = { overrides: {} }

const yy = (y: number) => `${String(y).slice(2)}학번`
const campusLabel = (c?: string) => (c === 'global' ? '글로벌캠퍼스' : '서울캠퍼스')

function overrideLabels(o: Overrides): string[] {
  const out: string[] = []
  if (o.campus) out.push(campusLabel(o.campus))
  if (o.entryYear) out.push(yy(o.entryYear))
  if (o.college) out.push(o.college)
  if (o.track) out.push(TRACK_LABEL[o.track])
  if (o.admission) out.push(o.admission === 'transfer' ? '편입생' : '신입학')
  if (o.transferTerm) out.push(o.transferTerm === 'late' ? '후기 편입' : '전기 편입')
  if (o.semester) out.push(`${o.semester}번째 학기`)
  if (o.status) out.push(o.status === 'leave' ? '휴학 중' : '재학 중')
  return out
}

const TRACK_WORD: Record<string, Track> = {
  부전공: 'minor',
  이중전공: 'double',
  전공심화: 'intensive',
  '전공심화+부전공': 'intensive_minor',
}

/** 질문에 담긴 '가정 조건'을 뽑는다. 저장 프로필은 절대 바꾸지 않는다. */
function parseHypothetical(q: string): Overrides {
  const o: Overrides = {}
  if (!/(이면|라면|이라면|경우|기준|바꾸|하면|친구)/.test(q)) return o
  const year = q.match(/(\d{4}|\d{2})\s*학번/)
  if (year) {
    const n = Number(year[1])
    o.entryYear = n < 100 ? 2000 + n : n
  }
  const track = q.match(/(전공심화\s*\+\s*부전공|부전공|이중전공|전공심화)\s*(으로|로|이면|이라면|라면|하면)/)
  if (track) o.track = TRACK_WORD[track[1].replace(/\s/g, '')]
  if (/편입생?(이면|이라면|인 경우)/.test(q)) o.admission = 'transfer'
  if (/글로벌\s*캠퍼스?(면|이면|라면)/.test(q)) o.campus = 'global'
  return o
}

function detectTopic(q: string, last?: Topic): Topic | 'unsupported' | undefined {
  if (/우선\s*배정/.test(q)) return 'priority'
  if (/휴학|복학/.test(q)) return 'leave'
  if (/(장학|수강\s*신청|계절\s*학기|전공\s*필수|교환\s*학생|성적|등록금)/.test(q)) return 'unsupported'
  if (/(이중전공|복수전공)/.test(q) && /(신청|언제|기간|대상|마감|일정)/.test(q)) return 'doubleApply'
  if (/(어디서|어떻게|경로|방법)/.test(q) && /신청/.test(q)) return 'doubleApply'
  if (/졸업|학점/.test(q)) return 'credits'
  return last
}

const base = () => ({ applied: [] as string[], hypothetical: [] as string[], sources: [] as Reply['sources'] })

/**
 * @param extra 추가 질문에서 고른 값. 이번 답변(과 이어지는 후속 질문)에만 적용된다.
 */
export function answer(
  question: string,
  profile: Partial<Profile> | null,
  ctx: ChatContext = EMPTY_CTX,
  extra?: Overrides,
): AnswerResult {
  const q = question.trim()
  const fresh = parseHypothetical(q)
  const isFollow = /^(그럼|그러면|그렇다면|그건)/.test(q) || Object.keys(fresh).length > 0 || !!extra
  const overrides: Overrides = isFollow ? { ...ctx.overrides, ...fresh, ...extra } : {}
  const p: P = { ...(profile ?? {}), ...overrides }

  const detected = detectTopic(q, isFollow ? ctx.lastTopic : undefined)
  const topic = detected ?? (isFollow ? 'credits' : undefined)

  let reply: Reply
  switch (topic) {
    case 'credits':
      reply = credits(p)
      break
    case 'doubleApply':
      reply = doubleApply(p)
      break
    case 'priority':
      reply = priority(p)
      break
    case 'leave':
      reply = leave(p)
      break
    default:
      reply = unsupported(p)
  }
  reply.hypothetical = overrideLabels(overrides)
  const nextTopic = topic && topic !== 'unsupported' ? topic : ctx.lastTopic
  return { reply, ctx: { lastTopic: nextTopic, overrides } }
}

const contactFor = (p: P) => (p.campus === 'global' ? CONTACT.global : CONTACT.seoul)

function credits(p: P): Reply {
  if (!p.campus) {
    return {
      ...base(),
      kind: 'ask',
      headline: '어느 캠퍼스 기준으로 알려드릴까요?',
      reason: '졸업학점은 캠퍼스마다 배분표가 달라서, 모르는 상태로 숫자를 말하지 않을게요.',
      options: [
        { label: '서울캠퍼스', overrides: { campus: 'seoul' } },
        { label: '글로벌캠퍼스', overrides: { campus: 'global' } },
      ],
    }
  }
  if (!p.entryYear) {
    return {
      ...base(),
      kind: 'ask',
      applied: [campusLabel(p.campus)],
      headline: '입학년도를 알려주세요.',
      reason: '2025학년도 전후로 졸업학점 배분표가 달라요.',
      options: [2026, 2025, 2024, 2023].map((y) => ({ label: `${y}학년도`, overrides: { entryYear: y } })),
    }
  }
  if (!p.college) {
    return {
      ...base(),
      kind: 'ask',
      applied: [campusLabel(p.campus), yy(p.entryYear)],
      headline: '소속 대학을 알려주세요.',
      reason: '사범대학·AI융합대학은 다른 배분표를 따라요.',
      options: [
        { label: '사범·AI융합대 외', overrides: { college: SEOUL_COLLEGES[0] } },
        { label: 'AI융합대학', overrides: { college: 'AI융합대학' } },
        { label: '사범대학', overrides: { college: '사범대학' } },
      ],
    }
  }
  if (!p.track || p.track === 'undecided') {
    return {
      ...base(),
      kind: 'ask',
      applied: [campusLabel(p.campus), yy(p.entryYear), p.college],
      headline: '어떤 이수 유형 기준으로 볼까요?',
      reason: '저장된 이수 유형이 ‘미정’이에요. 유형에 따라 전공 최소학점이 달라져요. 고른 유형은 이번 답변에만 쓰고 프로필은 그대로 둬요.',
      options: (['double', 'minor', 'intensive_minor', 'intensive'] as const).map((t) => ({
        label: TRACK_LABEL[t],
        overrides: { track: t },
      })),
    }
  }
  const found = lookupCredits(p.campus, p.entryYear, p.college, p.track)
  const applied = [campusLabel(p.campus), yy(p.entryYear), p.college, TRACK_LABEL[p.track]]
  if (!found.ok) {
    return {
      ...base(),
      kind: 'unsupported',
      applied,
      headline: '이 조건의 졸업학점은 아직 안내하지 못해요.',
      points: [found.reason, '원문 배분표에서 직접 확인하거나 아래 부서로 문의해 주세요.'],
      contact: contactFor(p),
      sources: [SOURCES.credits],
    }
  }
  return {
    ...base(),
    kind: 'credits',
    applied,
    total: found.row.total,
    breakdown: creditBreakdown(found.row),
    basis: found.basis,
    sources: [SOURCES.credits],
  }
}

function doubleApply(p: P): Reply {
  const sources = [SOURCES.doubleNotice, SOURCES.doubleInfo]
  const notTarget = (applied: string[], first: string): Reply => ({
    ...base(),
    kind: 'doubleApply',
    applied,
    eligible: false,
    headline: '이번 공고의 일반 신청 대상은 아니에요.',
    notes: [first, '이미 이수 유형이 정해진 경우, 본인 학번대에 여석이 있을 때만 변경 신청이 가능해요.'],
    sources,
  })

  if (!p.admission || !p.semester || !p.status) {
    return {
      ...base(),
      kind: 'ask',
      headline: '현재 학적 정보를 알려주세요.',
      reason: '이중전공 신청 대상은 신입학/편입 여부와 지금 몇 번째 학기인지에 따라 달라져요.',
      options: [
        { label: '신입학 · 2번째 학기 재학', overrides: { admission: 'freshman', semester: 2, status: 'enrolled' } },
        {
          label: '2026 후기 편입생',
          overrides: { admission: 'transfer', transferTerm: 'late', entryYear: 2026, semester: 1, status: 'enrolled' },
        },
      ],
      sources,
    }
  }

  const statusLabel = p.status === 'leave' ? '휴학 중' : '재학 중'
  if (p.admission === 'transfer') {
    const yearLabel = p.entryYear ? `${p.entryYear} 편입` : '편입생'
    if (p.entryYear === 2026 && !p.transferTerm) {
      return {
        ...base(),
        kind: 'ask',
        applied: ['편입생', yearLabel, statusLabel],
        headline: '전기 편입인가요, 후기 편입인가요?',
        reason: '이번 공고는 ‘2026년도 후기 편입생’을 신청 대상으로 명시하고 있어요. 프로필에 없는 정보라 여쭤볼게요.',
        options: [
          { label: '후기 편입 (2026-2학기)', overrides: { transferTerm: 'late' } },
          { label: '전기 편입 (2026-1학기)', overrides: { transferTerm: 'early' } },
        ],
        sources,
      }
    }
    if (p.entryYear === 2026 && p.transferTerm === 'late') {
      return {
        ...base(),
        kind: 'doubleApply',
        applied: ['편입생', '2026 후기 편입', statusLabel],
        eligible: true,
        headline: '2026-2학기 이중전공 신청 대상이에요.',
        period: DOUBLE_NOTICE.period,
        path: DOUBLE_NOTICE.path,
        notes: ['1학년이 아니어도, 공고에 ‘2026년도 후기 편입생’이 신청 대상으로 포함되어 있어요.', DOUBLE_NOTICE.missedWarning],
        sources,
      }
    }
    return notTarget(['편입생', yearLabel, statusLabel], '2026-2 공고의 편입생 대상은 ‘2026년도 후기 편입생’이에요.')
  }

  const applied = ['신입학', `현재 ${p.semester}번째 학기`, statusLabel]
  if (p.semester === 2 && p.status === 'enrolled') {
    return {
      ...base(),
      kind: 'doubleApply',
      applied,
      eligible: true,
      headline: '2026-2학기 이중전공 신청 대상이에요.',
      period: DOUBLE_NOTICE.period,
      path: DOUBLE_NOTICE.path,
      notes: [DOUBLE_NOTICE.missedWarning, '우선배정 학점 기준은 자료마다 다르게 적혀 있어요. “우선배정 기준이 몇 학점이야?”로 확인해 보세요.'],
      sources,
    }
  }
  return notTarget(applied, '공고 대상은 2026-2학기를 두 번째 학기로 ‘재학 중’인 2학년 진급 예정자예요.')
}

function priority(p: P): Reply {
  const sources = [SOURCES.doubleInfo, SOURCES.doubleNotice]
  if (!p.entryYear) {
    return {
      ...base(),
      kind: 'ask',
      headline: '입학년도를 알려주세요.',
      reason: '우선배정 학점 기준은 25학번 전후로 다르게 안내되어 있어요.',
      options: [2026, 2025, 2024].map((y) => ({ label: `${y}학년도`, overrides: { entryYear: y } })),
      sources,
    }
  }
  const { info, notice, conflict } = priorityCredits(p.entryYear)
  const applied = [yy(p.entryYear)]
  if (!conflict) {
    return {
      ...base(),
      kind: 'info',
      applied,
      headline: `우선배정 기준은 ${notice}학점이에요.`,
      points: ['학사정보 안내와 2026-2학기 공고 모두 이 학번대에 34학점을 적용하고 있어요.'],
      sources,
    }
  }
  return {
    ...base(),
    kind: 'conflict',
    applied,
    headline: '공식 자료끼리 기준이 달라요. 한쪽으로 단정하지 않을게요.',
    items: [
      { source: '학사정보 · 이중전공 안내', value: `34학점 (25학번 이후 ${info}학점)` },
      { source: '2026-2학기 이중전공 신청 공고', value: `${notice}학점` },
    ],
    contact: contactFor(p),
    sources,
  }
}

function leave(p: P): Reply {
  const sources = [SOURCES.leave]
  const contact = contactFor(p)
  if (!p.status || !p.semester) {
    return {
      ...base(),
      kind: 'ask',
      headline: '지금 재학 중인가요, 휴학 중인가요?',
      reason: '휴학 신청과 복학 신청은 안내가 달라요.',
      options: [
        { label: '재학 중', overrides: { status: 'enrolled' } },
        { label: '휴학 중', overrides: { status: 'leave' } },
      ],
      sources,
    }
  }
  const applied = [p.admission === 'transfer' ? '편입생' : '신입학', `현재 ${p.semester}번째 학기`, p.status === 'leave' ? '휴학 중' : '재학 중']
  if (p.status === 'leave') {
    return {
      ...base(),
      kind: 'info',
      applied,
      headline: '복학은 휴학이 끝나는 학기말 접수기간에 신청해요.',
      points: [
        '접수 시기: 2월 또는 8월 초순경, 종합정보시스템에서 복학 신청',
        '복학 예정자는 복학 전이라도 수강신청을 해야 해요.',
        '군휴학은 복학 학기 수업일수 1/4선 이전에 전역해야 그 학기에 복학할 수 있어요.',
      ],
      contact,
      sources,
    }
  }
  if (p.semester === 1) {
    return {
      ...base(),
      kind: 'info',
      applied,
      headline: '지금은 일반휴학을 신청할 수 없어요.',
      points: [
        '신·편입생은 1학기 재학 중 일반휴학이 허가되지 않아요.',
        '예외: 질병·입원으로 4주 이상 치료가 필요하면 수업일수 3/4선 이전까지 가능 (병원급 이상 진단서 첨부)',
        '군입대휴학은 입대일 이전에 종합정보시스템에서 신청해요.',
      ],
      contact,
      sources,
    }
  }
  return {
    ...base(),
    kind: 'info',
    applied,
    headline: '일반휴학은 학기 시작 전 접수기간에 신청해요.',
    points: [
      '접수 시기: 2월 또는 8월 초순경, 종합정보시스템에서 신청 후 결재 상황 확인',
      '일반휴학은 1회 1년이 원칙이고, 재학 중 통산 3년을 넘을 수 없어요.',
      '군입대휴학은 입대일 이전에 신청하고 복무 증명 서류를 업로드해요.',
    ],
    contact,
    sources,
  }
}

function unsupported(p: P): Reply {
  return {
    ...base(),
    kind: 'unsupported',
    headline: '현재 지원하지 않는 영역이에요.',
    points: ['지금은 졸업학점, 이중전공 신청·우선배정, 휴·복학을 안내해요.', '그 밖의 질문은 학교 공식 페이지나 담당 부서에서 확인해 주세요.'],
    contact: contactFor(p),
  }
}
