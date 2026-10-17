# Хуучин OAuth

Хуучин Google/Facebook болон password route-ууд runtime-ээс салгагдсан. Нэвтрэлтийг [CLERK_SETUP.md](CLERK_SETUP.md)-ийн дагуу тохируулна.

server/oauth.js нь анхны гурван security regression тестэд зориулж тусгаарлагдсан хэвээр байна. Шинэ provider credential эсвэл callback тохируулах шаардлагагүй.
