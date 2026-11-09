import type { AskOption, Reply } from '../types'

interface Props {
  reply: Reply
  onOption?: (o: AskOption) => void
  onAction?: (msg: string) => void
  compact?: boolean
}

type Tone = 'ok' | 'alert' | 'neutral'

/** 답변 머리줄: 주제 라벨 + 상태 점. 빨강은 '확인 필요'(자료 충돌)에만 쓴다. */
function heading(reply: Reply): { topic: string; status?: { tone: Tone; label: string } } {
  switch (reply.kind) {
    case 'credits':
      return { topic: '졸업학점' }
    case 'doubleApply':
      return {
        topic: '이중전공 신청',
        status: reply.eligible ? { tone: 'ok', label: '신청 대상' } : { tone: 'neutral', label: '이번 공고 대상 아님' },
      }
    case 'conflict':
      return { topic: '우선배정 기준', status: { tone: 'alert', label: '확인 필요' } }
    case 'ask':
      return { topic: '추가 정보', status: { tone: 'neutral', label: '답변 전 확인' } }
    case 'unsupported':
      return { topic: '안내', status: { tone: 'neutral', label: '지원 범위 밖' } }
    case 'info':
      return { topic: '안내' }
  }
}

export function ReplyCard({ reply, onOption, onAction, compact }: Props) {
  const head = heading(reply)
  return (
    <section className="bot" aria-label={`답변: ${head.topic}`}>
      <header className="bot-head">
        <span className="caption">답변 · {head.topic}</span>
        {head.status && (
          <span className={`status ${head.status.tone}`}>
            <i className="dot" aria-hidden="true" />
            {head.status.label}
          </span>
        )}
      </header>

      {reply.hypothetical.length > 0 && (
        <p className="hyp">
          <b>이번 답변에만 적용</b> {reply.hypothetical.join(' · ')} — 저장된 내 프로필은 그대로예요.
        </p>
      )}

      {reply.applied.length > 0 && (
        <p className="applied">
          <span>적용 조건</span>
          {reply.applied.join(' · ')}
        </p>
      )}

      <Body reply={reply} onOption={onOption} />

      {reply.sources.length > 0 && (
        <details className="src" open={!compact}>
          <summary>
            근거 {reply.sources.length}건 · 확인일 {reply.sources[0].checked}
          </summary>
          <ul>
            {reply.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {reply.kind !== 'ask' && (
        <footer className="bot-foot">
          <span>입력한 정보에 기반한 안내이며, 학교의 공식 학적·졸업 판정과는 별개예요.</span>
          {!compact && (
            <span className="actions">
              <button type="button" onClick={() => onAction?.('답변 복사는 프로토타입에서 지원하지 않아요')}>
                복사
              </button>
              <button type="button" onClick={() => onAction?.('신고가 접수되면 담당 부서 검토 후 규정 데이터를 고쳐요 (프로토타입)')}>
                틀렸어요
              </button>
            </span>
          )}
        </footer>
      )}
    </section>
  )
}

function Body({ reply, onOption }: { reply: Reply; onOption?: (o: AskOption) => void }) {
  switch (reply.kind) {
    case 'credits':
      return (
        <>
          <p className="headline">
            총 <b className="big">{reply.total}학점</b>이 필요해요.
          </p>
          <div className="credit-table" role="table" aria-label="영역별 최소 이수학점">
            {reply.breakdown.map((b) => (
              <div key={b.label} role="row">
                <span role="cell">{b.label}</span>
                <b role="cell">{b.value}</b>
              </div>
            ))}
          </div>
          <p className="note">
            {reply.basis}를 적용했어요. 위 숫자는 영역별 <b>최소</b> 이수학점이고, 총 졸업학점은 이와 별도 기준이에요.
          </p>
          <p className="note">학점 외에도 졸업논문(또는 졸업시험)·졸업인증·외국어인증을 통과해야 졸업할 수 있어요.</p>
        </>
      )
    case 'doubleApply':
      return (
        <>
          <p className="headline sm">{reply.headline}</p>
          {reply.period && (
            <dl className="kv">
              <div>
                <dt>신청 기간</dt>
                <dd>{reply.period}</dd>
              </div>
              <div>
                <dt>신청 경로</dt>
                <dd>{reply.path}</dd>
              </div>
            </dl>
          )}
          <ul className="points">
            {reply.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )
    case 'conflict':
      return (
        <>
          <p className="headline sm">{reply.headline}</p>
          <div className="conflict">
            {reply.items.map((i) => (
              <div key={i.source}>
                <span>{i.source}</span>
                <b>{i.value}</b>
              </div>
            ))}
          </div>
          <p className="note">
            신청 전에 <b>{reply.contact}</b>에 확인해 주세요.
          </p>
        </>
      )
    case 'info':
    case 'unsupported':
      return (
        <>
          <p className="headline sm">{reply.headline}</p>
          <ul className="points">
            {reply.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {reply.contact && <p className="note">문의: {reply.contact}</p>}
        </>
      )
    case 'ask':
      return (
        <>
          <p className="headline sm">{reply.headline}</p>
          <p className="note">{reply.reason}</p>
          <div className="options">
            {reply.options.map((o) => (
              <button type="button" key={o.label} disabled={!onOption} onClick={() => onOption?.(o)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )
  }
}
