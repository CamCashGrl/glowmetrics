// Creator timezone — single source of truth for "which clock is the creator on".
//
// The canonical value is always an IANA zone (e.g. 'America/Los_Angeles'),
// never a fixed offset like PST/GMT-8, so DST is handled for free. It is stored
// in profiles.timezone (set during onboarding Step 1 or from the dashboard).
//
// Resolution order (resolveCreatorTimeZone):
//   1. a valid saved profiles.timezone
//   2. otherwise the browser's IANA zone
//   3. otherwise 'UTC'
//
// The analytics engine (lib/analytics.js runEngine) does its own bucketing and
// just needs the resolved zone passed in. The zoned* helpers below are for
// dashboard code outside the engine that reads hours/days/dates off a Date, so
// it lands on the same clock the engine used.

export function isValidTimeZone(tz){
  if(!tz||typeof tz!=='string')return false
  try{new Intl.DateTimeFormat('en-US',{timeZone:tz});return true}catch{return false}
}

export function detectBrowserTimeZone(){
  try{
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(tz)?tz:'UTC'
  }catch{return 'UTC'}
}

export function resolveCreatorTimeZone(saved){
  return isValidTimeZone(saved)?saved:detectBrowserTimeZone()
}

// Human-readable name, e.g. 'Pacific Time'. Falls back to the IANA id.
export function timeZoneLabel(tz){
  for(const timeZoneName of ['longGeneric','long']){
    try{
      const part=new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName}).formatToParts(new Date()).find(p=>p.type==='timeZoneName')
      if(part?.value)return part.value
    }catch{}
  }
  return tz
}

export function allTimeZones(){
  let list=[]
  try{list=Intl.supportedValuesOf('timeZone')}catch{}
  return list.includes('UTC')?list:['UTC',...list]
}

// Calendar parts of `date` on the creator's clock. Formatters are cached per
// zone (constructing Intl.DateTimeFormat per call is expensive on big tip sets).
const partsFormatters=new Map()
export function zonedParts(date,tz){
  let fmt=partsFormatters.get(tz)
  if(!fmt){
    fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'})
    partsFormatters.set(tz,fmt)
  }
  const p={}
  for(const{type,value}of fmt.formatToParts(new Date(date)))p[type]=value
  return{
    year:+p.year,month:+p.month,day:+p.day,
    hour:(+p.hour)%24,minute:+p.minute,
    weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),
  }
}

export const zonedHour=(date,tz)=>zonedParts(date,tz).hour
export const zonedDay=(date,tz)=>zonedParts(date,tz).weekday
export function zonedYMD(date,tz){
  const{year,month,day}=zonedParts(date,tz)
  return`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
export const zonedMonthKey=(date,tz)=>zonedYMD(date,tz).slice(0,7)
export function zonedHourDecimal(date,tz){
  const{hour,minute}=zonedParts(date,tz)
  return hour+minute/60
}

// Wall-clock date ('YYYY-MM-DD') + time ('HH:MM') on the creator's clock → the
// real instant. Two passes settle the zone offset, including across DST edges.
export function zonedWallTimeToDate(dateStr,timeStr,tz){
  const[y,mo,d]=String(dateStr).split('-').map(Number)
  const[h,mi]=String(timeStr).split(':').map(Number)
  if([y,mo,d,h,mi].some(n=>!Number.isFinite(n)))return new Date(NaN)
  const wall=Date.UTC(y,mo-1,d,h,mi)
  let t=wall
  for(let i=0;i<2;i++){
    const p=zonedParts(t,tz)
    const shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)
    t+=wall-shown
  }
  return new Date(t)
}
