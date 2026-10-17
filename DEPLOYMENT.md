# Үйлдвэрлэлийн байршуулалт

## Архитектур

- Frontend: Vercel
- Backend болон Socket.IO: Render эсвэл Railway дээрх байнгын Node.js сервер
- Database: MongoDB Atlas
- Authentication: Clerk

Vercel дээр Socket.IO болон Express backend байрлуулахгүй. `vercel.json` нь зөвхөн Vite-ийн `dist` файлуудыг үйлчилнэ.

## Backend environment

```env
PORT=10000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
CLIENT_ORIGIN=https://your-app.vercel.app
CLERK_SECRET_KEY=sk_live_...
```

`CLIENT_ORIGIN` олон frontend domain-той бол таслалаар тусгаарлана.

## Frontend environment

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://your-backend.onrender.com
VITE_SOCKET_URL=https://your-backend.onrender.com
```

## Алхамууд

1. MongoDB Atlas-д database user болон Network Access тохируулна.
2. Clerk Dashboard-д production application үүсгэнэ.
3. Google/Facebook provider-уудыг Clerk дээр идэвхжүүлнэ.
4. Backend-ийг Render/Railway-д холбоно.
5. `/api/health` endpoint `ok: true` буцааж байгааг шалгана.
6. Backend URL-ээ frontend-ийн `VITE_API_URL`, `VITE_SOCKET_URL`-д өгнө.
7. Frontend-ийг Vercel-д deploy хийнэ.
8. Clerk-ийн allowed origins-д Vercel domain-ийг нэмнэ.

## Локал ажиллуулах

```bash
npm install
npm run dev
```

## Шалгалт

```bash
npm run lint
npm test
npm run build
```

Secret key-г repository-д хэзээ ч commit хийхгүй.

## Production шалгалтын дараалал

1. Render Blueprint-д render.yaml сонгоно. Backend зөвхөн нэг instance ашиглана.
2. CLIENT_ORIGIN-д Vercel-ийн яг HTTPS origin-ийг өгнө (төгсгөлийн slash болон замгүй).
3. CLERK_SECRET_KEY болон MONGODB_URI-г Render-ийн secret environment-д оруулна. PORT-ийг Render автоматаар өгнө.
4. MongoDB нь transaction дэмждэг replica set байх ёстой. Atlas энэ шаардлагыг хангана.
5. Backend database болон index initialization дууссаны дараа сонсож эхэлнэ. /api/health нь database эсвэл Clerk тохиргоо бэлэн биш бол 503 буцаана.
6. Vercel environment-д VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL, VITE_SOCKET_URL-г тохируулна. Хоёр backend URL нь HTTPS origin байх ёстой; WSS connection-ийг Socket.IO үүнээс үүсгэнэ.
7. Vercel дээр missing/HTTP frontend backend URL нь build-ийг зогсооно. Render production origin нь HTTP эсвэл wildcard бол startup зогсоно.
8. Clerk Dashboard-д production instance/domain болон Google/Facebook connection-оо тохируулна. Secret утгыг frontend-д өгөхгүй.
9. Хоёр тусдаа браузераар нэвтэрч найз, урилга, presence, skin, gameplay, reconnect, logout-ийг шалгана. Account deletion-ийг зөвхөн тусгай test account-аар шалгана.

## Автомат integration тест

`npm test` нь өөрийн түр MongoDB replica set ажиллуулж, бодит backend процесс болон Socket.IO client-уудыг шалгана. MongoDB binary анх удаа татагдахад сүлжээ шаардлагатай. Эдгээр тест нь Atlas-ийн хэрэглэгчийн өгөгдөлд бичихгүй.

Clerk verification тест нь жинхэнэ SDK болон тестэд шинээр үүсгэсэн RSA түлхүүр ашигладаг. Энэ нь hosted Clerk sign-in/sign-up шалгалтыг орлохгүй. CLERK_JWT_KEY нь Clerk Dashboard-аас авсан JWT public key-г networkless verification-д ашиглах нэмэлт backend тохиргоо; secret биш боловч дурын түлхүүрийг production-д оруулахгүй.

## Account deletion ажиллагаа

Устгах баталгаажуулалтын дараа AccountDeletion job эхэлж хадгалагдана. Pending болон completed tombstone нь API/socket нэвтрэлтийг хориглоно. Worker Clerk identity-г устгаж, MongoDB cleanup хийнэ; алдаа гарвал exponential backoff-оор дахин оролдоно. Clerk 404 нь аль хэдийн устсан гэж тооцогдоно. Worker crash-ийн lease 60 секундэд дуусна. Админ AccountDeletion collection-ийн pending төлөв, attempts, nextAttemptAt-ийг хянах хэрэгтэй.

## Энэ орчны гадаад шалгалт

Clerk backend secret, Vercel token, Render API key илрээгүй. Иймээс hosted authentication болон deployment smoke test BLOCKED. Нууц утгыг чатад илгээхгүй; local .env болон hosting dashboard-д тохируулна.
