# Clerk тохиргоо

1. Clerk Dashboard-д application үүсгэнэ.
2. `VITE_CLERK_PUBLISHABLE_KEY`-г frontend environment-д нэмнэ.
3. `CLERK_SECRET_KEY`-г зөвхөн backend environment-д нэмнэ.
4. Google болон Facebook social connection-ийг Clerk Dashboard-аас идэвхжүүлнэ.
5. Local болон production domain-уудыг Allowed origins-д нэмнэ.

Backend Clerk token-ийг `@clerk/backend`-ийн `verifyToken`-оор шалгана. Client-ээс ирсэн Clerk user ID-г шууд итгэхгүй.

Backend `authorizedParties`-г `CLIENT_ORIGIN`-оос авна. Local domain болон production domain-оо яг тохируулна. Browser API хүсэлт game session token-оос гадна X-Clerk-Token илгээнэ; game socket мөн clerkToken илгээнэ.

Бүртгэл устгах API нь session token-ийн fva claim-аар сүүлийн 10 минутын баталгаажуулалтыг шаарддаг. Claim байхгүй үед хүсэлтийг хориглоно. Dashboard-ийн account deletion тохиргоо болон дахин нэвтрэх урсгалыг бодит хэрэглэгчээр шалгах шаардлагатай.

Локал шалгалтаар publishable key тохируулагдсан, CLERK_SECRET_KEY тохируулагдаагүй байна. Secret key-г чатад илгээхгүйгээр local .env болон hosting dashboard-д нэмнэ.
