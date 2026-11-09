export type Campus = 'seoul' | 'global'
export type Admission = 'freshman' | 'transfer'
export type Status = 'enrolled' | 'leave'
export type Track = 'double' | 'minor' | 'intensive_minor' | 'intensive' | 'undecided'
export type TransferTerm = 'early' | 'late'

export interface Profile {
  campus: Campus
  entryYear: number
  college: string
  dept: string
  semester: number
  admission: Admission
  status: Status
  track: Track
}

/** 이번 답변에만 적용하는 조건 (저장 프로필을 바꾸지 않음) */
export type Overrides = Partial<Profile> & { transferTerm?: TransferTerm }

export type Topic = 'credits' | 'doubleApply' | 'priority' | 'leave'

export interface ChatContext {
  lastTopic?: Topic
  overrides: Overrides
}

export interface Source {
  title: string
  url: string
  checked: string
}

export interface AskOption {
  label: string
  overrides: Overrides
}

interface ReplyBase {
  /** 적용한 내 조건 칩 */
  applied: string[]
  /** 이번 답변에만 적용한 가정 조건 */
  hypothetical: string[]
  sources: Source[]
}

export type Reply =
  | (ReplyBase & {
      kind: 'credits'
      total: number
      breakdown: { label: string; value: number }[]
      basis: string
    })
  | (ReplyBase & {
      kind: 'doubleApply'
      eligible: boolean
      headline: string
      period?: string
      path?: string
      notes: string[]
    })
  | (ReplyBase & {
      kind: 'conflict'
      headline: string
      items: { source: string; value: string }[]
      contact: string
    })
  | (ReplyBase & { kind: 'info'; headline: string; points: string[]; contact?: string })
  | (ReplyBase & { kind: 'ask'; headline: string; reason: string; options: AskOption[] })
  | (ReplyBase & { kind: 'unsupported'; headline: string; points: string[]; contact?: string })
