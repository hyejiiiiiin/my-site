import { JWT } from 'google-auth-library';

// Google Sheets의 "projects" 탭을 서비스 계정으로 읽어 JSON으로 반환하는 서버리스 함수.
// 인증 정보는 절대 코드에 하드코딩하지 않고 환경변수로만 읽는다.
export default async function handler(req, res) {
  try {
    const {
      GOOGLE_SHEET_ID,
      GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_PRIVATE_KEY,
    } = process.env;

    // 필수 환경변수 확인
    if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return res
        .status(500)
        .json({ error: '필수 환경변수(GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)가 설정되지 않았습니다.' });
    }

    // 환경변수에 저장된 \n(literal)을 실제 줄바꿈으로 복원
    const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

    // 서비스 계정 JWT 클라이언트 (읽기 전용 스코프)
    const client = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // "projects" 탭 전체 값 요청
    const range = 'projects';
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}` +
      `/values/${encodeURIComponent(range)}`;

    const { token } = await client.getAccessToken();
    const apiRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(apiRes.status).json({ error: 'Google Sheets API 오류', detail });
    }

    const data = await apiRes.json();

    // CDN 캐싱: 60초 신선 + 5분간 stale 허용
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ rows: data.values || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
