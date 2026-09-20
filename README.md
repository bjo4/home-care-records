# 居家照顧紀錄 / CareLog

Warren 家庭使用的私密居家照顧紀錄 web app。介面以繁體中文、手機優先設計，讓多位照顧者（Warren、姐姐、爸爸、María）以個人帳號登入並快速記錄每日照護事項；每筆紀錄都會顯示登入者的記錄/確認姓名。

## 功能 / Features

- 今日儀表板：快速新增按鈕、今日紀錄、最新體溫/血壓/血糖/體重摘要
- 六類紀錄：
  - 體溫：時間、溫度、量測部位（額/耳/腋）、記錄人、備註
  - 血壓：時間、收縮壓、舒張壓、脈搏（選填）、姿勢（坐/躺）、記錄人、備註
  - 血糖：時間、mg/dL、量測時機（飯前/飯後/空腹/其他）、記錄人、備註
  - 吃藥確認：藥名/類別、是否已吃、時間、確認人、備註
  - 警訊症狀：症狀 checklist、嚴重程度、是否通知醫護/就醫、今日無異狀一鍵紀錄
  - 體重：時間、kg、衣著（輕/重）、記錄人、備註
- 歷史列表與簡易趨勢圖：體溫、血壓（收縮/舒張）、血糖、體重
- 個別帳號登入：scrypt 密碼雜湊、httpOnly session cookie、登入失敗 lockout
- 登入後記錄人/確認人鎖定為目前使用者，避免代填錯人
- 登出與登入者改密碼表單
- P0/P1 照護資料：
  - `/reminders` 提醒：到期時間、重複、完成狀態、完成者
  - `/meds` 用藥醫囑：進行中/已停、劑量、頻率、途徑、注意事項
  - `/exams` 檢查：待做/完成/待報告、地點、結果摘要
  - `/visits` 看診：科別、醫師、醫囑與下次回診
- `/api/reminders/due`：回傳未來 48 小時未完成提醒，供瀏覽器 session 或外部 bot bearer token 使用
- JSON file store：預設寫入 `.data/carelog.json`，適合家用 Node server behind Cloudflare Tunnel
- Demo seed 與清空資料按鈕：可從空白開始，也可載入範例資料試看

## 居家參考線（非診斷） / Home reference ranges (not diagnosis)

這些範圍只用於居家照護提醒與圖表參考，不作醫療診斷；實際處置請依醫囑或照護團隊建議。

| 類型 | CareLog 標示/圖表參考線 | 來源參考 |
| --- | --- | --- |
| 體溫 | 常見正常帶 `36.5–37.3°C`；低標 `<36.0°C`；發燒線 `>=37.5°C` | MedlinePlus；常見居家/護理非肛溫發燒提醒 |
| 血壓 | 理想上限 `<120/<80`；低標 `<90` 或 `<60`；高標 `>=130` 或 `>=80` | 衛福部國健署 / AHA-ACC 成人靜息血壓分級 |
| 脈搏 | 有填寫時，`<60` 或 `>100 bpm` 標示提醒 | MedlinePlus / 臨床常用成人靜息脈搏範圍 |
| 血糖 | 低標 `<70 mg/dL`；空腹高界 `>=100`；飯後參考 `140`；飯後高關注 `>=180` | 衛福部 / ADA fasting glucose 與 postmeal reference |
| 吃藥 | 記錄為未吃/吐掉會標示 | 家庭照護流程 |
| 症狀 | 非「今日無異狀」且有症狀、嚴重程度、通知醫護或就醫會標示 | 家庭照護流程 |
| 體重 | 不設定健康 kg 範圍；僅沿用日變化 `>=1.0 kg` 提醒 | 家庭照護趨勢提醒 |

Blood glucose UI note: 飯前/空腹較偏向空腹參考線（70/100）；飯後較偏向 140/180 參考線。All glucose chart lines are reference-only, not diagnostic.

## 本機執行 / Run locally

需求：Node.js 20.9+（目前專案使用 Next.js 16）。

第一次啟動如果資料檔還沒有使用者，請提供 bootstrap 帳號：

```bash
export CARELOG_BOOTSTRAP_USERS="warren:change-this-warren:Warren,vickie:change-this-vickie:姐姐,fanlee:change-this-fanlee:爸爸,maria:change-this-maria:María"
npm install
npm run dev
```

開啟：

```text
http://127.0.0.1:8800
```

Production build 與啟動：

```bash
npm ci
npm run build
PORT=8800 CARELOG_BOOTSTRAP_USERS="warren:change-this-warren:Warren,vickie:change-this-vickie:姐姐,fanlee:change-this-fanlee:爸爸,maria:change-this-maria:María" npm start
```

部署目標可將 Cloudflare Tunnel 指到本機 `http://127.0.0.1:8800`，公開網域例如 `https://care.kuroshimae.cc`。本專案不會自行部署。

## 設定 / Configuration

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `PORT` | `8800` | `npm run dev` 與 `npm start` 使用的 port |
| `CARELOG_DATA_FILE` | `.data/carelog.json` | JSON 資料檔路徑 |
| `CARELOG_BOOTSTRAP_USERS` | 無 | 當資料檔沒有任何 users 時建立初始帳號；格式：`username:password:DisplayName`，多筆用逗號分隔 |
| `CARELOG_COOKIE_SECURE` | `false` | 設為 `true` 時 session cookie 加上 `Secure`；若本機用 `http://127.0.0.1:8800` 測試請維持 `false` |
| `CARELOG_REMINDER_TOKEN` | 無 | 選填；外部 bot 可用 `Authorization: Bearer <token>` 呼叫 `/api/reminders/due` |

範例：

```bash
PORT=8800 \
CARELOG_DATA_FILE=/var/lib/carelog/carelog.json \
CARELOG_BOOTSTRAP_USERS="warren:replace-me-1:Warren,vickie:replace-me-2:姐姐,fanlee:replace-me-3:爸爸,maria:replace-me-4:María" \
CARELOG_COOKIE_SECURE=true \
npm start
```

Bootstrap only runs when the JSON store has zero users. After the first successful boot, change the initial passwords in the app and remove the bootstrap env from your shell/service file.

## Authentication / 認證

- Seed usernames: `warren`, `vickie`, `fanlee`, `maria`
- Display names: `Warren`, `姐姐`, `爸爸`, `María`
- Passwords are stored as `scrypt$...` hashes; plaintext passwords are never written to JSON.
- Sessions use an `httpOnly` cookie named `carelog_session`; all app pages are protected except `/login` and static assets.
- Failed login lockout: 5 failed attempts for the same username within 15 minutes locks that username for 10 minutes.
- Logged-in users can change their own password from the home page.

## Reminder API / 提醒 API

```bash
curl -H "Authorization: Bearer $CARELOG_REMINDER_TOKEN" \
  http://127.0.0.1:8800/api/reminders/due
```

Response:

```json
{
  "windowHours": 48,
  "reminders": []
}
```

Browser requests can also use the normal `carelog_session` cookie. Without a valid session or bearer token, the API returns `401`.

## 測試 / Tests

```bash
npm test
npm run lint
npm run build
```

## Notes

- 請部署在私人家庭用途的主機/網域後面；目前沒有角色權限分級。
- shared PIN/password、飲食、活動、睡眠、port/catheter、就診與緊急聯絡人尚未納入。
- Demo seed 只會在目前 records 為空時寫入；清空資料只清照護 records，保留 users/sessions。

## Docs checked

- Docs: Next.js 16.3.5 - App Router installation / scripts (https://nextjs.org/docs/app/getting-started/installation, checked 2026-09-20)
- Docs: Tailwind CSS 4 - Next.js framework guide (https://tailwindcss.com/docs/installation/framework-guides/nextjs, checked 2026-09-20)
- Docs: shadcn/ui 4.21.0 - Next.js installation / add components (https://ui.shadcn.com/docs/installation/next, checked 2026-09-20)
- Docs: tsx 4.23.13 - Node.js loader (https://github.com/privatenumber/tsx#nodejs-loader, checked 2026-09-20)
