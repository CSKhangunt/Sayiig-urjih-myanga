# Тэрбумтан

Монгол интерфэйстэй Monopoly загварын олон тоглогчийн тоглоом. React 19 + Vite frontend, Express + Socket.IO backend, MongoDB Atlas, Clerk ашиглана. npm package-lock.json нь dependency хувилбаруудыг түгжинэ.

## Локал ажиллуулах

1. Node.js 22 эсвэл түүнээс шинэ хувилбар суулгана.
2. `.env.example`-ийг `.env` болгон хуулж Clerk болон MongoDB утгуудыг оруулна.
3. `npm ci`, дараа нь `npm run dev` ажиллуулна.
4. Frontend http://localhost:5173, backend http://localhost:3001 дээр ажиллана.

Clerk secret key байхгүй үед хамгаалагдсан API болон тоглоомд нэвтрэх боломжгүй. Google/Facebook нэвтрэлтийг зөвхөн Clerk Dashboard-аас тохируулна.

## Командууд

- `npm run dev`: frontend ба backend.
- `npm run server`: байнгын Node.js backend.
- `npm test`: engine, presence, profile, UTF-8 болон HTTP invitation тестүүд.
- `npm run lint`: Oxlint.
- `npm run build`: production frontend.
- `node --test test/encoding.test.js`: UTF-8 шалгалт.

## Байршуулалт

Vercel дээр frontend, Render/Railway дээр ONE backend instance ажиллуулна. Backend-ийг олон instance болгон өсгөх Redis adapter одоогоор байхгүй.

Frontend environment: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`.

Backend environment: `CLERK_SECRET_KEY`, `MONGODB_URI`, `CLIENT_ORIGIN`, `PORT`, `NODE_ENV`.

`CLIENT_ORIGIN` нь зөвшөөрөгдсөн frontend origin-уудын таслалаар тусгаарласан жагсаалт. Secret key-г VITE_ prefix-тэй хувьсагчид хэзээ ч хадгалахгүй.

[Байршуулалт](DEPLOYMENT.md), [Clerk](CLERK_SETUP.md), [MongoDB](DATABASE_SETUP.md), [ажлын бодит явц ба үлдсэн асуудал](IMPLEMENTATION_PROGRESS.md).

## Өгөгдөл ба эрх

Clerk JWT-г API, social socket, game socket дээр шалгана. Game session нь Clerk identity-тэй холбогдоно. Найзын өөрчлөлт, presence болон урилгыг хэрэглэгчийн хувийн Socket.IO room-оор түгээнэ. Тоглоомын engine нь шоо, хөрөнгө, түрээс, арилжааны үр дүнг сервер дээр тооцно.

Үнэгүй хоёр cosmetic бий. Paid purchase болон бодит мөнгөний төлбөр байхгүй. Skin нь avatar token-ийн өнгөт хүрээ хэлбэрээр харагдана.

Тоглоомын дууссан үр дүн game/user unique index-тэй. Хуучин тоглоомд зохиомол статистик үүсгэхгүй. Идэвхтэй тоглоомын төлөвийг секунд тутам MongoDB snapshot-д хадгална.

## Одоогийн баталгаажуулалт

Production deploy, бодит Clerk login, хоёр браузерийн бүрэн workflow, account deletion зэрэг нь баталгаажаагүй. Release хийхээс өмнө IMPLEMENTATION_PROGRESS.md-ийн нээлттэй асуудлуудыг хааж, бодит орчинд шалгана. `server/oauth.js` нь анхны security тестүүдэд зориулж хадгалсан тусгаарлагдсан хуучин module; backend runtime-д ашиглагдахгүй.
