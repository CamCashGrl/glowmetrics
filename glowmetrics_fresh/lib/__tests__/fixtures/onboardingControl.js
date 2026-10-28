// Synthetic control data; no creator records or usernames.
export function controlTransactions() {
  const rows=[]
  const add=(count,total,action)=>{
    for(let i=0;i<count;i++)rows.push({date:'Oct 10, 2026, 8:00 PM',action,user:`fan${i%235}`,tokens:i===0?total-count+1:1})
  }
  add(994,6331,'Tip From');add(95,857,'Private Show');add(2,200,'Fan Club Membership')
  return rows
}
export const controlPaste=()=>controlTransactions().map(r=>`${r.date}\n${r.action}: ${r.user}\n${r.tokens}  99999`).join('\n')
export const controlFile=()=>['Date,Action,Tokens,Token balance',...controlTransactions().map(r=>`"${r.date}","${r.action}: ${r.user}",${r.tokens},99999`)].join('\n')
