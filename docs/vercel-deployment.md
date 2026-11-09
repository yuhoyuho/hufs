# Vercel 배포

- 공개 주소: https://hufs-ui-mockups-20261106.vercel.app
- 프로젝트: `yhyh3/hufs-ui-mockups-20261106`
- 관리 화면: https://vercel.com/yhyh3/hufs-ui-mockups-20261106
- 배포 방식: Vercel CLI 65.12.0에서 로컬 파일 업로드. Git 자동 배포는 연결하지 않았어.

## 현재 운영: 클릭 프로토타입 (2026.11.09)

- 내용: `prototype/`의 빌드 결과(`npm run build` → `prototype/dist`)
- 배포 ID: `dpl_8uHiUAJYjkpDJCo9h2MbCeBYynCS` (2026.11.09, macOS 레퍼런스 기반 디자인 변경 · `docs/design-references-macos-20261109`)
- 대상·상태: Production · Ready
- 확인한 내용: 공개 주소가 새 JS·CSS 번들을 제공하고 CSS에 상태 점 토큰이 포함됨
- 이전 배포
  - `dpl_2nwPAJ9vGjB14ZfLti4hDRjbckzU` (단과대학별 학과 선택 상자, 기존 디자인)
  - `dpl_2iWwnXEeThcxShZo15nPNjfzeLJF` (첫 프로토타입 배포, 학과 직접 입력 방식)

### 다시 올리기

`prototype/dist`에는 Vercel 연결 정보가 없으니, 빌드 결과를 임시 폴더에 모아 갤러리 프로젝트 연결 정보와 함께 올려.

```powershell
Set-Location -LiteralPath 'C:\Users\hiq\orca\workspaces\hufs\sardine\prototype'
npm run build
$D = Join-Path $env:TEMP 'hufs-prototype-deploy'
Remove-Item -Recurse -Force $D -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $D '.vercel') | Out-Null
Copy-Item -Recurse dist\* $D
Copy-Item ..\docs\ui-mockups-v2-20261106\vercel.json $D
Copy-Item ..\docs\ui-mockups-v2-20261106\.vercel\project.json (Join-Path $D '.vercel')
Set-Location $D
npx --yes vercel@65.12.0 deploy --prod --scope yhyh3 --yes --non-interactive
```

## 이전 운영: 목업 갤러리 (2026.11.06)

- 내용: `docs/ui-mockups-v2-20261106` (정적 HTML + PNG)
- 배포 ID: `dpl_7dpbUmF7bp7VKiWa14FDikcw7yd1`
- 당시 확인: 연결 경로 40개 실패 0개, 390px 모바일 가로 넘침 없음, `.env.local`·내부 기록 JSON 배포 제외(HTTP 404)

갤러리 폴더에서 `vercel deploy --prod`를 실행하면 **같은 주소의 프로토타입이 갤러리로 덮어써지니** 주의해.
갤러리를 다시 운영 주소로 되돌리려면 이전 배포를 승격하면 돼.

```powershell
npx --yes vercel@65.12.0 promote dpl_7dpbUmF7bp7VKiWa14FDikcw7yd1 --scope yhyh3 --yes
```

`vercel.json`은 빌드·패키지 설치 없이 업로드한 폴더를 정적 사이트로 제공하도록 설정했어. `.vercel`과 환경 파일은 배포 결과물을 전달할 때 포함하지 마.
