---
name: create-pr
description: GitHub PR을 자동으로 생성합니다. 작업 브랜치의 커밋, 파일 변경을 분석해 PR 제목과 설명을 작성한 뒤, 사용자 승인을 받아 GitHub에 PR을 올립니다. 스킬 사용 시 현재 브랜치가 main이나 develop과 다른지 먼저 확인하고, 커밋 기록과 변경 파일을 함께 분석해 문맥을 파악합니다. "PR 만들어줘", "PR 생성해", "풀 리퀘스트 올려줄래" 같은 요청에 반응하고, 이미 원격에 푸시된 브랜치라면 바로 PR 생성을, 아직 로컬에만 있다면 먼저 푸시를 제안합니다.
---

## 프로세스 개요

```
1. 현재 git 상태 확인
   └─ 브랜치, 커밋 기록, 변경 파일 분석

2. PR 정보 수집 (사용자 입력 또는 자동 추론)
   └─ 제목, 설명, 타겟 브랜치

3. 사용자 승인
   └─ 생성할 PR 내용 확인 후 OK 신호

4. 서브에이전트(fork)에 PR 생성 위임
   └─ GitHub CLI를 사용해 실제 PR 생성

5. PR URL 반환
```

---

## 단계별 지침

### 1단계: Git 상태 분석

```bash
git status                      # 현재 브랜치 확인
git log main..HEAD --oneline   # main과의 차이 커밋 (target=main인 경우)
git diff --stat main HEAD      # 변경된 파일 요약
```

**확인 사항:**
- 현재 브랜치가 `main` 또는 `develop`이 아닌지 (PR 대상 브랜치와 다른지)
- 로컬 커밋이 얼마나 있는지
- 어떤 파일들이 변경되었는지

### 2단계: PR 정보 수집

**자동 추론 (권장):**
- 커밋 메시지들을 읽어 PR 제목 작성
- 변경 파일 목록과 커밋 내용으로 설명 작성
- 프로젝트 구조에서 언어 판단 (한국어 커밋이면 한국어 PR, 영문이면 영문)

**사용자 입력:**
- 커밋만으로 부족하면 "제목과 설명을 직접 입력해주시겠어요?" 제안
- 기본 템플릿 제시 (references/ 폴더의 템플릿 참고)

### 3단계: Target Branch 결정

```
기본값: main
사용자가 다른 브랜치 지정 → 그것 사용
프로젝트 설정이 있으면 → 그것 우선
```

### 4단계: 사용자 승인

생성할 PR의 다음 정보를 명확히 표시:
```
브랜치:    feature/something → main
제목:     feat: 새로운 기능 추가
설명:     (요약 표시)
```

**"OK" 또는 "수정 필요" 응답 대기**

### 5단계: 서브에이전트(fork)로 PR 생성 위임

다음 정보를 서브에이전트에 전달:

```
## PR 생성 작업 (fork context)

- 현재 로컬 브랜치: <branch-name>
- 타겟 브랜치: <target-branch>
- PR 제목: <title>
- PR 설명: <body>
- 원격이 최신인지 확인: git push (필요시)
- GitHub CLI로 생성:
  gh pr create \
    --title "<title>" \
    --body "<body>" \
    --base <target-branch>
```

**fork 사용 이유:**
- PR 생성 후 로컬 상태 변경이 격리됨
- 원격 상태와 로컬 상태 불일치 방지
- 여러 PR을 동시에 생성할 때 간섭 없음

### 6단계: 결과 보고

PR이 성공적으로 생성되면:
```
✅ PR 생성 완료!
URL: https://github.com/owner/repo/pull/123
```

실패 시:
```
❌ PR 생성 실패
원인: (에러 메시지)
해결: (제안 조치)
```

---

## 에러 처리

| 상황 | 해결 방법 |
|------|---------|
| 로컬 커밋이 없음 | "현재 브랜치에 새 커밋이 없습니다. 먼저 변경을 커밋해주세요." |
| 원격에 푸시 안 됨 | "먼저 `git push`로 원격에 푸시해주세요. 그 다음 PR을 생성하겠습니다." |
| gh CLI 없음 | "GitHub CLI가 설치되지 않았습니다. `brew install gh` 또는 `winget install GitHub.cli`로 설치해주세요." |
| 인증 실패 | "GitHub 인증이 필요합니다. `gh auth login`을 실행해주세요." |
| 이미 열린 PR 있음 | "이 브랜치로 이미 PR이 있습니다. PR을 추가 커밋으로 업데이트하겠습니다." |

---

## 언어 판단 규칙

- 프로젝트의 **최근 커밋 메시지 언어** 기준
- 한국어 커밋이 많으면 → **한국어 PR**
- 영문 커밋이 많으면 → **영문 PR**
- 섞여있으면 → **사용자에게 선택 받기**

---

## 참고 문서

**PR 템플릿:**
- `references/pr-template-en.md` — 영문 PR 템플릿
- `references/pr-template-ko.md` — 한국어 PR 템플릿

**필요한 도구:**
- Git (로컬에 설치되어 있음)
- GitHub CLI (`gh`)
- GitHub 계정 인증

---

## 예시

### 입력
```
"PR 만들어줘"
```

### 프로세스
```
1. git log main..HEAD --oneline 실행
   → "feat: add dark mode", "fix: button styling" 확인

2. 변경 파일 확인
   → src/theme.ts, src/Button.tsx, src/App.tsx

3. PR 정보 자동 작성
   제목: feat: add dark mode support
   설명: 다크 모드 토글 기능 추가, 버튼 스타일 개선

4. 사용자 확인
   ✅ OK!

5. 서브에이전트(fork)에서 실행
   gh pr create --title "feat: add dark mode support" --body "..."

6. 결과
   ✅ PR 생성 완료!
   URL: https://github.com/example/repo/pull/42
```

---

## 중요 노트

- **원격 푸시 확인**: PR 생성 전에 `git push`가 되어있는지 확인합니다
- **Fork 격리**: PR 생성 작업은 fork context에서 실행되어 로컬 상태를 변경하지 않습니다
- **사용자 승인**: 생성 전에 반드시 사용자의 명시적 승인을 받습니다
- **정보 수집**: 커밋과 파일 변경으로부터 최대한 많은 정보를 자동 추론합니다
