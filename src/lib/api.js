// Simple client-side helpers to call our Vercel functions

export async function fetchEquipment(){
  try{
    const resp = await fetch('/api/equipment')
    const json = await resp.json()
    if(json.ok) return json.data
    // Fallback to sample if DB not yet configured
    return json.sample || []
  }catch(e){
    return []
  }
}
