import { describe, expect, it } from 'vitest'
import type { Profile } from '../types'
import { EMPTY_CTX, answer } from './answer'

const me: Profile = {
  campus: 'seoul',
  entryYear: 2026,
  college: '서양어대학',
  dept: '스페인어과',
  semester: 2,
  admission: 'freshman',
  status: 'enrolled',
  track: 'double',
}

const Q_CREDITS = '졸업하려면 총 몇 학점 필요해?'

describe('기획서 시연 시나리오', () => {
  it('서울·2026·비사범대·이중전공 → 126학점 (42·42·32·6)', () => {
    const { reply } = answer(Q_CREDITS, me)
    expect(reply.kind).toBe('credits')
    if (reply.kind !== 'credits') return
    expect(reply.total).toBe(126)
    expect(reply.breakdown.map((b) => b.value)).toEqual([42, 42, 32, 6])
  })

  it('서울·2024·사범/AI융합대 외·이중전공 → 134학점', () => {
    const { reply } = answer(Q_CREDITS, { ...me, entryYear: 2024 })
    expect(reply.kind === 'credits' && reply.total).toBe(134)
  })

  it('캠퍼스·학과 미등록 → 숫자 대신 추가 질문', () => {
    const { reply } = answer(Q_CREDITS, { entryYear: 2026 })
    expect(reply.kind).toBe('ask')
  })

  it('2번째 학기 신입학 재학생 → 이중전공 신청 대상 + 기간', () => {
    const { reply } = answer('이중전공 신청 언제야?', me)
    expect(reply.kind).toBe('doubleApply')
    if (reply.kind !== 'doubleApply') return
    expect(reply.eligible).toBe(true)
    expect(reply.period).toContain('11.24')
  })

  it('2026 후기 편입생 → 1학년이 아니어도 대상', () => {
    const transfer: Profile = { ...me, admission: 'transfer', semester: 1 }
    const first = answer('이중전공 신청 언제야?', transfer)
    expect(first.reply.kind).toBe('ask')
    const { reply } = answer('이중전공 신청 언제야?', transfer, first.ctx, { transferTerm: 'late' })
    expect(reply.kind === 'doubleApply' && reply.eligible).toBe(true)
  })

  it('25학번 우선배정 기준 → 32/34 자료 충돌 표시', () => {
    const { reply } = answer('우선배정 기준이 몇 학점이야?', { ...me, entryYear: 2025 })
    expect(reply.kind).toBe('conflict')
  })

  it('24학번 우선배정 기준 → 두 자료 모두 34학점, 충돌 없음', () => {
    const { reply } = answer('우선배정 기준이 몇 학점이야?', { ...me, entryYear: 2024 })
    expect(reply.kind).toBe('info')
  })

  it('가정 질문은 이번 답변에만 적용하고 프로필을 바꾸지 않음', () => {
    const profile = { ...me }
    const first = answer(Q_CREDITS, profile)
    const { reply } = answer('내 친구가 2024학번이면?', profile, first.ctx)
    expect(reply.kind === 'credits' && reply.total).toBe(134)
    expect(reply.hypothetical).toContain('24학번')
    expect(profile.entryYear).toBe(2026)
  })

  it('이어서 “그럼 부전공으로 바꾸면?” → 가정 조건·주제 유지, 부전공 기준', () => {
    const a = answer(Q_CREDITS, me)
    const b = answer('내 친구가 2024학번이면?', me, a.ctx)
    const { reply } = answer('그럼 부전공으로 바꾸면?', me, b.ctx)
    expect(reply.kind).toBe('credits')
    if (reply.kind !== 'credits') return
    expect(reply.total).toBe(134)
    expect(reply.breakdown).toEqual([
      { label: '전공', value: 54 },
      { label: '부전공', value: 21 },
      { label: '교양', value: 32 },
    ])
    expect(reply.hypothetical).toEqual(['24학번', '부전공'])
  })

  it('새 질문을 하면 가정 조건이 풀리고 저장 프로필로 돌아옴', () => {
    const a = answer('내 친구가 2024학번이면?', me, { ...EMPTY_CTX, lastTopic: 'credits' })
    const { reply } = answer(Q_CREDITS, me, a.ctx)
    expect(reply.kind === 'credits' && reply.total).toBe(126)
    expect(reply.hypothetical).toEqual([])
  })

  it('지원 범위 밖 질문 → 지원하지 않는 영역 안내', () => {
    const { reply } = answer('장학금 받을 수 있어?', me)
    expect(reply.kind).toBe('unsupported')
  })

  it('1학기 신입생 휴학 질문 → 일반휴학 제한 안내', () => {
    const { reply } = answer('휴학하고 싶어', { ...me, semester: 1 })
    expect(reply.kind === 'info' && reply.headline).toContain('신청할 수 없어요')
  })
})
