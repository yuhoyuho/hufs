export type Theme = 'black' | 'white' | 'beige'

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'black', label: '블랙' },
  { id: 'white', label: '화이트' },
  { id: 'beige', label: '베이지' },
]

const KEY = 'hufs-proto-theme'
const isTheme = (v: unknown): v is Theme => v === 'black' || v === 'white' || v === 'beige'

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return isTheme(v) ? v : 'white'
  } catch {
    return 'white'
  }
}

/** <html data-theme>에 반영하고, 가능하면 이 기기에 기억한다. */
export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme
  if (!persist) return
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* 저장 불가 환경에서는 이번 방문 동안만 유지 */
  }
}
