// =============================================
// Problem Solving Bot — Google Apps Script
// =============================================
// 설정값은 스크립트 속성(Script Properties)에서 관리
//   GH_TOKEN       : GitHub Personal Access Token
//   DRIVE_FOLDER_ID: Problem Solving 폴더 ID
// =============================================

const PROPS            = PropertiesService.getScriptProperties();
const GH_TOKEN         = PROPS.getProperty('GH_TOKEN');
const DRIVE_FOLDER_ID  = PROPS.getProperty('DRIVE_FOLDER_ID');
const HSBOTBOARD_REPO  = 'RyanHSoo/hsbotboard';
const POSTED_IDS_KEY   = 'POSTED_FILE_IDS';

// ── 메인 실행 함수 (매일 자정 트리거) ─────────────────────
function runDailyCheck() {
  if (!DRIVE_FOLDER_ID) {
    Logger.log('[오류] DRIVE_FOLDER_ID가 설정되지 않았습니다.');
    return;
  }
  if (!GH_TOKEN) {
    Logger.log('[오류] GH_TOKEN이 설정되지 않았습니다.');
    return;
  }

  const today     = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd');
  Logger.log('실행 날짜: ' + today);

  const folder    = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const files     = folder.getFiles();
  const postedIds = getPostedIds();
  let   newCount  = 0;

  while (files.hasNext()) {
    const file     = files.next();
    const fileId   = file.getId();
    const fileName = file.getName();
    const mimeType = file.getMimeType();

    // Google Docs 파일만 처리
    if (mimeType !== MimeType.GOOGLE_DOCS) continue;

    // 오늘 날짜(yyMMdd) 로 시작하는 파일만 처리
    if (!fileName.startsWith(today)) continue;

    // 이미 포스팅된 파일은 건너뜀 (중복 방지)
    if (postedIds.has(fileId)) {
      Logger.log('[스킵] 이미 포스팅됨: ' + fileName);
      continue;
    }

    Logger.log('[처리] ' + fileName);

    try {
      const caseName = fileName.replace(/^\d{6}[_\s]*/, '').trim();
      const htmlBody = extractDocAsHtml(fileId);
      const category = detectCategory(caseName);

      const success = postToBoard({
        date      : formatDate(new Date()),
        title     : caseName,
        category  : category,
        htmlBody  : htmlBody,
      });

      if (success) {
        postedIds.add(fileId);
        newCount++;
        Logger.log('[완료] 포스팅: ' + caseName);
      } else {
        Logger.log('[실패] GitHub 업데이트 실패: ' + caseName);
      }
    } catch (e) {
      Logger.log('[오류] ' + fileName + ' → ' + e.message);
    }
  }

  savePostedIds(postedIds);
  Logger.log('=== 완료: 신규 ' + newCount + '개 포스트 ===');
}

// ── Google Docs → 정제된 HTML 변환 ───────────────────────
function extractDocAsHtml(fileId) {
  const exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
                    + fileId + '&exportFormat=html';
  const res = UrlFetchApp.fetch(exportUrl, {
    headers     : { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Docs 내보내기 실패: ' + res.getResponseCode());
  }

  let html = res.getContentText();

  // <body> 내용만 추출
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return '<p>(내용 없음)</p>';
  html = bodyMatch[1];

  // 구글 독스 스타일 클리닝
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');   // 스타일 블록 제거
  html = html.replace(/style="[^"]*"/gi, '');              // 인라인 스타일 제거
  html = html.replace(/class="[^"]*"/gi, '');              // class 속성 제거
  html = html.replace(/<span>([\s\S]*?)<\/span>/gi, '$1'); // 빈 span 제거
  html = html.replace(/<p>\s*<\/p>/gi, '');                // 빈 p 태그 제거
  html = html.replace(/\s{2,}/g, ' ');                     // 연속 공백 정리
  html = html.replace(/<hr[^>]*>/gi, '<hr>');              // hr 태그 정리

  return html.trim();
}

// ── 카테고리 자동 감지 ────────────────────────────────────
function detectCategory(title) {
  const map = [
    [['전략', '성장', '시장진입'],       '성장전략'],
    [['운영', '프로세스', '효율'],        '운영개선'],
    [['조직', 'HR', '인사', '리더십'],   '조직/HR'],
    [['재무', '비용', '수익'],           '재무분석'],
    [['마케팅', '브랜드', '고객'],        '마케팅'],
    [['디지털', '전환', 'DX'],           '디지털전환'],
    [['AI', '데이터', '자동화'],          'AI/기술'],
    [['리스크', '위기', '대응'],          '리스크관리'],
  ];
  for (const [keywords, cat] of map) {
    if (keywords.some(kw => title.includes(kw))) return cat;
  }
  return '기타';
}

// ── hsbotboard problem_solving_data.json 업데이트 ─────────
function postToBoard({ date, title, category, htmlBody }) {
  const apiBase  = 'https://api.github.com/repos/' + HSBOTBOARD_REPO + '/contents/';
  const filePath = 'problem_solving_data.json';
  const headers  = {
    Authorization : 'token ' + GH_TOKEN,
    Accept        : 'application/vnd.github.v3+json',
    'User-Agent'  : 'ProblemSolvingBot/1.0',
  };

  // 현재 파일 내용 가져오기
  const getRes = UrlFetchApp.fetch(apiBase + filePath, {
    headers           : headers,
    muteHttpExceptions: true,
  });

  if (getRes.getResponseCode() !== 200) {
    Logger.log('GitHub 조회 실패: ' + getRes.getResponseCode() + ' ' + getRes.getContentText());
    return false;
  }

  const fileData    = JSON.parse(getRes.getContentText());
  const decoded     = Utilities.newBlob(
    Utilities.base64Decode(fileData.content.replace(/\n/g, ''))
  ).getDataAsString();
  const currentData = JSON.parse(decoded);

  // 중복 체크 (같은 날짜 + 같은 제목)
  const isDuplicate = currentData.some(
    item => item.date === date && item.title === title
  );
  if (isDuplicate) {
    Logger.log('[중복] 이미 존재: ' + title);
    return false;
  }

  // 고유 ID 생성
  const safeTitle = title.replace(/[^a-zA-Z0-9가-힣]/g, '-').substring(0, 20);
  const rowId     = 'ps-' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd')
                    + '-' + safeTitle;

  const newItem = {
    id          : rowId,
    date        : date,
    category    : category,
    title       : title,
    detail_html : htmlBody,
  };

  currentData.unshift(newItem); // 최신 글이 맨 위

  const newContent = Utilities.base64Encode(
    Utilities.newBlob(
      JSON.stringify(currentData, null, 2), 'application/json'
    ).getBytes()
  );

  // GitHub 파일 업데이트
  const putRes = UrlFetchApp.fetch(apiBase + filePath, {
    method            : 'PUT',
    headers           : headers,
    payload           : JSON.stringify({
      message : 'Add: Problem Solving - ' + title + ' (' + date + ')',
      content : newContent,
      sha     : fileData.sha,
    }),
    muteHttpExceptions: true,
  });

  const code = putRes.getResponseCode();
  if (code !== 200 && code !== 201) {
    Logger.log('GitHub 업데이트 실패: ' + code + ' ' + putRes.getContentText());
    return false;
  }
  return true;
}

// ── 날짜 포맷 (YYYY.MM.DD) ───────────────────────────────
function formatDate(d) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '.' + m + '.' + day;
}

// ── 포스팅된 파일 ID 관리 ─────────────────────────────────
function getPostedIds() {
  const stored = PROPS.getProperty(POSTED_IDS_KEY);
  return new Set(stored ? JSON.parse(stored) : []);
}

function savePostedIds(idsSet) {
  PROPS.setProperty(POSTED_IDS_KEY, JSON.stringify([...idsSet]));
}

// ── 수동 테스트용 함수 ────────────────────────────────────
// 특정 파일 ID로 직접 테스트하려면 이 함수를 실행
function testSingleFile() {
  const testFileId = 'YOUR_GOOGLE_DOCS_FILE_ID_HERE'; // 테스트할 파일 ID 입력
  const caseName   = '테스트 케이스';
  const htmlBody   = extractDocAsHtml(testFileId);
  Logger.log('추출된 HTML:\n' + htmlBody.substring(0, 500));

  const success = postToBoard({
    date    : formatDate(new Date()),
    title   : caseName,
    category: detectCategory(caseName),
    htmlBody: htmlBody,
  });
  Logger.log('포스팅 결과: ' + (success ? '성공' : '실패'));
}
