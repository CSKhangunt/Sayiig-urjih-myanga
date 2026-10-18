export async function readApiResponse(response) {
  let data
  try { data = await response.json() } catch {
    throw new Error(`HTTP ${response.status}: Сервер JSON хариу буцаасангүй. API хаяг эсвэл deploy тохиргоог шалгана уу.`)
  }
  if (!response.ok) {
    const explanations = { 401: 'Нэвтрэлт хүчингүй эсвэл хугацаа дууссан.', 403: 'Урилга хүчингүй эсвэл нэвтрэх эрх хүрэхгүй.', 404: 'Өрөө эсвэл API зам олдсонгүй.', 409: 'Өрөө дүүрсэн эсвэл тоглоом эхэлсэн.', 503: 'Сервер түр бэлэн биш байна.' }
    throw new Error(`HTTP ${response.status}: ${data.error || explanations[response.status] || 'API хүсэлт амжилтгүй.'}`)
  }
  return data
}

export const NETWORK_ERROR = 'Сүлжээ/CORS: Сервертэй холбогдож чадсангүй. Browser-ийн сүлжээ эсвэл серверийн зөвшөөрөгдсөн domain тохиргоог шалгана уу.'
