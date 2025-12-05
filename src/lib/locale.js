const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩']

const dateTimeFormatter = new Intl.DateTimeFormat('ar-SA', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const numberFormatter = new Intl.NumberFormat('ar-SA')

export function toArabicDigits(value){
  if(value === null || value === undefined) return ''
  return String(value).replace(/[0-9]/g, digit => arabicDigits[Number(digit)] || digit)
}

export function formatNumberArabic(value){
  if(value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if(Number.isNaN(num)) return toArabicDigits(value)
  return numberFormatter.format(num)
}

export function formatDateTimeArabic(value){
  if(!value) return '—'
  try{
    const date = value instanceof Date ? value : new Date(value)
    if(Number.isNaN(date.getTime())) return '—'
    return dateTimeFormatter.format(date)
  }catch(_){
    return '—'
  }
}
