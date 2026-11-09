import { useEffect, useMemo, useRef, useState } from 'react'
import { ProfileForm, DEFAULT_PROFILE } from './components/ProfileForm'
import { ReplyCard } from './components/ReplyCard'
import { TRACK_LABEL } from './data/rules'
import { EMPTY_CTX, answer } from './engine/answer'
import { THEMES, applyTheme, loadTheme, type Theme } from './theme'
import type { AskOption, ChatContext, Profile, Reply, Source } from './types'

const STORAGE_KEY = 'hufs-proto-profile'

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}
function saveProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 저장 불가 환경(시크릿 창 등)에서는 이번 세션 동안만 유지 */
  }
}

type BotMsg = { id: number; role: 'bot'; question: string; reply: Reply }
type Msg = { id: number; role: 'user'; text: string } | BotMsg
type View = 'chat' | 'profile' | 'compare'

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: 'chat', label: '학사 상담', hint: '상담' },
  { id: 'profile', label: '내 학사 프로필', hint: '프로필' },
  { id: 'compare', label: '프로필 비교', hint: '시연' },
]

const STARTERS = ['졸업하려면 총 몇 학점 필요해?', '이중전공 신청 언제야?', '우선배정 기준이 몇 학점이야?', '휴학은 언제 신청해?']
const FOLLOWUPS: Record<string, string[]> = {
  credits: ['그럼 부전공으로 바꾸면?', '내 친구가 2024학번이면?', '이중전공 신청 언제야?'],
  doubleApply: ['우선배정 기준이 몇 학점이야?', '신청은 어디서 해?', '졸업하려면 총 몇 학점 필요해?'],
  priority: ['이중전공 신청 언제야?', '졸업하려면 총 몇 학점 필요해?'],
  leave: ['졸업하려면 총 몇 학점 필요해?', '이중전공 신청 언제야?'],
}

const profileRows = (p: Profile): [string, string][] => [
  ['캠퍼스', p.campus === 'seoul' ? '서울캠퍼스' : '글로벌캠퍼스'],
  ['입학년도', `${p.entryYear}학년도 (${String(p.entryYear).slice(2)}학번)`],
  ['소속', [p.college, p.dept].filter(Boolean).join(' · ')],
  ['이수학기', `${p.semester}번째 학기`],
  ['학적', `${p.admission === 'transfer' ? '편입' : '신입학'} · ${p.status === 'leave' ? '휴학' : '재학'}`],
  ['이수 유형', p.track === 'undecided' ? '미정' : TRACK_LABEL[p.track]],
]

function dday(target: string) {
  const t = new Date(target + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - now.getTime()) / 86400000)
}

const lastBotOf = (msgs: Msg[]) => [...msgs].reverse().find((m): m is BotMsg => m.role === 'bot')

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [view, setView] = useState<View>('chat')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [ctx, setCtx] = useState<ChatContext>(EMPTY_CTX)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState<Theme>(loadTheme)

  const changeTheme = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  if (!profile) {
    return (
      <div className="onboarding">
        <div className="window">
          <div className="window-bar">
            <Brand />
            <ThemePicker value={theme} onChange={changeTheme} />
          </div>
          <div className="window-body">
            <p className="caption">처음 한 번만</p>
            <h2 className="title">내 학사 정보를 알려주세요</h2>
            <p className="note">질문할 때마다 이 정보를 기준으로 적용 규정을 골라 답해요.</p>
            <ProfileForm
              submitLabel="저장하고 시작하기"
              onSubmit={(p) => {
                saveProfile(p)
                setProfile(p)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const lastBot = lastBotOf(msgs)
  const current = VIEWS.find((v) => v.id === view)!
  const newChat = () => {
    setView('chat')
    setMsgs([])
    setCtx(EMPTY_CTX)
  }

  return (
    <div className="app">
      <header className="toolbar">
        <Brand />
        <span className="toolbar-title">{current.label}</span>
        <ThemePicker value={theme} onChange={changeTheme} />
        <button className="tool-btn" onClick={newChat}>
          ＋ 새 질문
        </button>
      </header>

      <nav className="side" aria-label="화면 이동">
        <p className="side-label">학사 도우미</p>
        {VIEWS.map((v) => (
          <NavRow key={v.id} on={view === v.id} onClick={() => setView(v.id)} label={v.label} hint={view === v.id ? '현재' : undefined} />
        ))}
        <p className="side-label gap">지원 범위</p>
        <ul className="side-list">
          <li>졸업학점</li>
          <li>이중전공·부전공</li>
          <li>휴·복학</li>
        </ul>
      </nav>

      <nav className="tabs" aria-label="화면 이동">
        {VIEWS.map((v) => (
          <NavRow key={v.id} on={view === v.id} onClick={() => setView(v.id)} label={v.hint} />
        ))}
      </nav>

      <main className="main">
        {view === 'chat' && (
          <Chat
            profile={profile}
            msgs={msgs}
            setMsgs={setMsgs}
            ctx={ctx}
            setCtx={setCtx}
            onToast={setToast}
            onEditProfile={() => setView('profile')}
          />
        )}
        {view === 'profile' && (
          <div className="page">
            <p className="caption">설정</p>
            <h2 className="title">내 학사 프로필</h2>
            <p className="note">바꾼 내용은 다음 질문부터 바로 반영돼요.</p>
            <ProfileForm
              key={JSON.stringify(profile)}
              initial={profile}
              submitLabel="변경 내용 저장"
              onSubmit={(p) => {
                saveProfile(p)
                setProfile(p)
                setToast('프로필을 저장했어요')
                setView('chat')
              }}
              onDelete={() => {
                if (!confirm('이 기기에 저장된 내 학사 프로필을 삭제할까요?')) return
                saveProfile(null)
                setProfile(null)
                setMsgs([])
                setCtx(EMPTY_CTX)
                setView('chat')
              }}
            />
          </div>
        )}
        {view === 'compare' && <Compare />}
      </main>

      <aside className="sources" aria-label="확인한 공식 자료">
        <p className="side-label">확인한 공식 자료</p>
        {view === 'chat' && lastBot && lastBot.reply.sources.length > 0 ? (
          lastBot.reply.sources.map((s) => <SourceRow key={s.url} s={s} />)
        ) : (
          <p className="note pad">답변에 사용한 공식 자료가 여기에 표시돼요.</p>
        )}
      </aside>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="logo" aria-hidden="true">
        외
      </span>
      <h1>외대 놓침방지</h1>
      <span className="badge">프로토타입</span>
    </div>
  )
}

function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-picker" role="group" aria-label="화면 테마">
      {THEMES.map((t) => (
        <button key={t.id} type="button" aria-pressed={value === t.id} title={`${t.label} 테마`} onClick={() => onChange(t.id)}>
          <i className={`swatch ${t.id}`} aria-hidden="true" />
          <span className="theme-label">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

function NavRow({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button className="nav-row" aria-current={on ? 'page' : undefined} onClick={onClick}>
      <i className="dot" aria-hidden="true" />
      {label}
      {hint && <em>{hint}</em>}
    </button>
  )
}

function SourceRow({ s }: { s: Source }) {
  return (
    <div className="source-row">
      <b>{s.title}</b>
      <span>확인일 {s.checked}</span>
      <a href={s.url} target="_blank" rel="noreferrer">
        원문 보기 ↗
      </a>
    </div>
  )
}

interface ChatProps {
  profile: Profile
  msgs: Msg[]
  setMsgs: React.Dispatch<React.SetStateAction<Msg[]>>
  ctx: ChatContext
  setCtx: (c: ChatContext) => void
  onToast: (m: string) => void
  onEditProfile: () => void
}

function Chat({ profile, msgs, setMsgs, ctx, setCtx, onToast, onEditProfile }: ChatProps) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs])

  // 홈 화면: 내 프로필 기준으로 '나에게 해당하는' 마감만 보여준다
  const deadline = useMemo(() => {
    const r = answer('이중전공 신청 언제야?', profile).reply
    if (r.kind === 'doubleApply' && r.eligible) {
      return { title: '이중전공 신청', d: dday('2026-11-24'), period: '11.24(화) 10:00 ~ 11.30(월) 16:00' }
    }
    return null
  }, [profile])

  const ask = (text: string, picked?: AskOption) => {
    const question = text.trim()
    if (!question) return
    const res = answer(question, profile, ctx, picked?.overrides)
    setCtx(res.ctx)
    const id = Date.now()
    setMsgs((m) => [
      ...m,
      { id, role: 'user', text: picked ? picked.label : question },
      { id: id + 1, role: 'bot', question, reply: res.reply },
    ])
    setInput('')
  }

  const lastBot = lastBotOf(msgs)
  const followups = lastBot && ctx.lastTopic ? FOLLOWUPS[ctx.lastTopic] : []

  return (
    <div className="chat">
      <div className="msgs">
        {msgs.length === 0 && (
          <div className="home">
            <p className="caption">학사 상담</p>
            <h2 className="title">무엇이 궁금한가요?</h2>

            <section className="block">
              <header className="block-head">
                <h3>저장된 내 학사 프로필</h3>
                <button className="link" onClick={onEditProfile}>
                  수정
                </button>
              </header>
              <dl className="kv">
                {profileRows(profile).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {deadline && deadline.d >= 0 && (
              <section className="block">
                <header className="block-head">
                  <h3>내게 해당하는 일정</h3>
                </header>
                <div className="schedule-row">
                  <b className="dday">{deadline.d === 0 ? 'D-DAY' : `D-${deadline.d}`}</b>
                  <span>
                    <b>{deadline.title}</b>
                    <small>{deadline.period}</small>
                  </span>
                  <span className="status ok">
                    <i className="dot" aria-hidden="true" />
                    신청 대상
                  </span>
                </div>
              </section>
            )}

            <section className="block">
              <header className="block-head">
                <h3>자주 묻는 질문</h3>
              </header>
              <ul className="q-list">
                {STARTERS.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)}>
                      {s}
                      <span aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {msgs.map((m) =>
          m.role === 'user' ? (
            <p key={m.id} className="me">
              {m.text}
            </p>
          ) : (
            <ReplyCard
              key={m.id}
              reply={m.reply}
              onAction={onToast}
              onOption={m === lastBot ? (o) => ask(m.question, o) : undefined}
            />
          ),
        )}
        <div ref={endRef} />
      </div>

      {followups.length > 0 && (
        <div className="followups">
          <span>이어서</span>
          {followups.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="inputbar"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={msgs.length ? '이어서 물어보세요' : '학사 질문을 입력하세요'}
          aria-label="질문 입력"
        />
        <button type="submit" disabled={!input.trim()}>
          보내기
        </button>
      </form>
    </div>
  )
}

const PRESETS: { label: string; profile: Partial<Profile> }[] = [
  { label: 'A · 서울 26학번 · 서양어대 · 이중전공', profile: { ...DEFAULT_PROFILE, track: 'double' } },
  {
    label: 'B · 서울 24학번 · 사회과학대 · 이중전공',
    profile: { ...DEFAULT_PROFILE, entryYear: 2024, college: '사회과학대학', dept: '정치외교학과', semester: 6, track: 'double' },
  },
  { label: 'C · 캠퍼스·학과 미등록', profile: { entryYear: 2026 } },
]
const COMPARE_QS = ['졸업하려면 총 몇 학점 필요해?', '이중전공 신청 언제야?', '우선배정 기준이 몇 학점이야?']

function Compare() {
  const [q, setQ] = useState(COMPARE_QS[0])
  return (
    <div className="page wide">
      <p className="caption">시연용 예시 프로필</p>
      <h2 className="title">같은 질문, 다른 답</h2>
      <p className="note">세 학생이 같은 질문을 했을 때, 저장된 프로필에 따라 적용 규정과 답이 달라져요.</p>
      <div className="segbar" role="tablist" aria-label="비교할 질문">
        {COMPARE_QS.map((x) => (
          <button key={x} role="tab" aria-selected={x === q} type="button" onClick={() => setQ(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className="compare">
        {PRESETS.map((pr) => (
          <div key={pr.label} className="compare-col">
            <p className="compare-head">{pr.label}</p>
            <ReplyCard reply={answer(q, pr.profile).reply} compact />
          </div>
        ))}
      </div>
    </div>
  )
}
