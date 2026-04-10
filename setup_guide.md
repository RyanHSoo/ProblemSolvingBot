# ProblemSolvingBot 세팅 가이드

## 전체 흐름
구글 드라이브 (Problem Solving 폴더) → GAS 자동 실행 → hsbotboard 게시판 자동 업데이트

---

## Step 1: Google Drive 폴더 ID 확인
1. 구글 드라이브에서 `Problem Solving` 폴더 열기
2. 주소창 URL에서 폴더 ID 복사
   - 예: `https://drive.google.com/drive/folders/1ABC_xyz_폴더ID`
   - 폴더 ID = `1ABC_xyz_폴더ID` 부분

---

## Step 2: Google Apps Script 생성
1. https://script.google.com 접속
2. **새 프로젝트** 클릭
3. 프로젝트 이름: `ProblemSolvingBot`
4. `problem_solving_bot.gs` 파일 내용 전체 붙여넣기
5. 저장 (Ctrl+S)

---

## Step 3: Script Properties 설정
1. GAS 편집기 상단 메뉴 → **프로젝트 설정** (톱니바퀴 아이콘)
2. **스크립트 속성** 탭 → **속성 추가**
3. 아래 두 가지 추가:

| 속성명 | 값 |
|--------|-----|
| `GH_TOKEN` | GitHub Personal Access Token |
| `DRIVE_FOLDER_ID` | Step 1에서 복사한 폴더 ID |

---

## Step 4: 권한 설정 및 첫 실행
1. `runDailyCheck` 함수 선택 후 **실행** 버튼 클릭
2. 권한 요청 팝업 → **권한 검토** → 구글 계정 선택 → **허용**
   - Drive, Docs, 외부 URL 접근 권한 필요
3. 로그(실행 로그)에서 오류 없이 완료되는지 확인

---

## Step 5: 자동 트리거 설정
1. 왼쪽 메뉴 **⏰ 트리거** 클릭
2. **트리거 추가** 클릭
3. 설정값:
   - 실행 함수: `runDailyCheck`
   - 이벤트 소스: **시간 기반**
   - 시간 기반 트리거 유형: **하루 중 특정 시간**
   - 시간대: **Asia/Seoul**
   - 시간: **오전 12시~1시** (자정)
4. **저장**

---

## 파일명 규칙 (젬스 저장 시 준수)
- 형식: `yyMMdd_케이스명`
- 예: `260410_A사 시장진입전략`, `260411_조직 개편 방향성`
- 반드시 6자리 날짜로 시작해야 자동 감지됨

---

## 카테고리 자동 분류 기준
| 케이스명에 포함된 키워드 | 자동 카테고리 |
|------------------------|--------------|
| 전략, 성장, 시장진입 | 성장전략 |
| 운영, 프로세스, 효율 | 운영개선 |
| 조직, HR, 인사, 리더십 | 조직/HR |
| 재무, 비용, 수익 | 재무분석 |
| 마케팅, 브랜드, 고객 | 마케팅 |
| 디지털, 전환, DX | 디지털전환 |
| AI, 데이터, 자동화 | AI/기술 |
| 리스크, 위기, 대응 | 리스크관리 |
| (해당 없음) | 기타 |
