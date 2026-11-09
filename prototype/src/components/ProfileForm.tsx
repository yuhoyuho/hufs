import { useState } from 'react'
import { collegeNames, deptsOf } from '../data/colleges'
import { TRACK_LABEL } from '../data/rules'
import type { Campus, Profile, Track } from '../types'

const YEARS = Array.from({ length: 12 }, (_, i) => 2026 - i)
const TRACKS: Track[] = ['double', 'minor', 'intensive_minor', 'intensive', 'undecided']

export const DEFAULT_PROFILE: Profile = {
  campus: 'seoul',
  entryYear: 2026,
  college: '서양어대학',
  dept: '스페인어과',
  semester: 2,
  admission: 'freshman',
  status: 'enrolled',
  track: 'undecided',
}

interface Props {
  initial?: Profile
  submitLabel: string
  onSubmit: (p: Profile) => void
  onDelete?: () => void
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'sel' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 캠퍼스·대학·학과가 서로 맞지 않으면(목록 변경, 예전 저장값) 첫 항목으로 맞춘다 */
function withValidAffiliation(p: Profile, campus: Campus = p.campus, college = p.college, dept = p.dept): Profile {
  const colleges = collegeNames(campus)
  const c = colleges.includes(college) ? college : colleges[0]
  const depts = deptsOf(campus, c)
  return { ...p, campus, college: c, dept: depts.includes(dept) ? dept : depts[0] }
}

export function ProfileForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const [p, setP] = useState<Profile>(() => withValidAffiliation(initial ?? DEFAULT_PROFILE))
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }))
  const colleges = collegeNames(p.campus)
  const depts = deptsOf(p.campus, p.college)

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(p)
      }}
    >
      <fieldset>
        <legend>캠퍼스</legend>
        <Seg
          value={p.campus}
          options={[
            { value: 'seoul', label: '서울' },
            { value: 'global', label: '글로벌' },
          ]}
          onChange={(v) => setP((prev) => withValidAffiliation(prev, v))}
        />
      </fieldset>

      <div className="row2">
        <label className="field">
          <span>입학년도</span>
          <select value={p.entryYear} onChange={(e) => set('entryYear', Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}학년도
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>현재 이수학기</span>
          <select value={p.semester} onChange={(e) => set('semester', Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                {s}번째 학기
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row2">
        <label className="field">
          <span>소속 대학</span>
          <select value={p.college} onChange={(e) => setP((prev) => withValidAffiliation(prev, prev.campus, e.target.value, ''))}>
            {colleges.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>학과·학부</span>
          <select value={p.dept} onChange={(e) => set('dept', e.target.value)} disabled={depts.length <= 1}>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="row2">
        <fieldset>
          <legend>입학 구분</legend>
          <Seg
            value={p.admission}
            options={[
              { value: 'freshman', label: '신입학' },
              { value: 'transfer', label: '편입' },
            ]}
            onChange={(v) => set('admission', v)}
          />
        </fieldset>
        <fieldset>
          <legend>학적 상태</legend>
          <Seg
            value={p.status}
            options={[
              { value: 'enrolled', label: '재학' },
              { value: 'leave', label: '휴학' },
            ]}
            onChange={(v) => set('status', v)}
          />
        </fieldset>
      </div>

      <fieldset>
        <legend>전공 이수 유형</legend>
        <Seg
          value={p.track}
          options={TRACKS.map((t) => ({ value: t, label: t === 'undecided' ? '미정' : TRACK_LABEL[t] }))}
          onChange={(v) => set('track', v)}
        />
        <p className="hint">아직 정하지 않았다면 ‘미정’을 고르세요. 필요할 때 다시 여쭤볼게요.</p>
      </fieldset>

      <div className="privacy">
        <strong>이 기기 브라우저에만 저장돼요.</strong>
        <span>학번 전체·실명·성적은 받지 않아요. 질문에 답할 때 필요한 항목만 사용해요.</span>
      </div>

      <button className="btn" type="submit">
        {submitLabel}
      </button>
      {onDelete && (
        <button className="btn danger" type="button" onClick={onDelete}>
          내 정보 삭제
        </button>
      )}
    </form>
  )
}
