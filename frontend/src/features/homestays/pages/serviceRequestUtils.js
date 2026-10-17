export const ACTIVE_STATUSES = ['Pending','ChangeProposed','Approved','InProgress','HostCompleted'];
export const RESOLVED_STATUSES = ['Completed','Rejected','Cancelled'];

export function getRequestStats(items=[]){
  const stats={pending:0,waitingCustomer:0,approved:0,inProgress:0,waitingCompletion:0,completed:0,rejected:0,cancelled:0,active:0,resolved:0,total:items.length};
  for(const item of items){
    if(item.status==='Pending')stats.pending++;
    else if(item.status==='ChangeProposed')stats.waitingCustomer++;
    else if(item.status==='Approved')stats.approved++;
    else if(item.status==='InProgress')stats.inProgress++;
    else if(item.status==='HostCompleted')stats.waitingCompletion++;
    else if(item.status==='Completed')stats.completed++;
    else if(item.status==='Rejected')stats.rejected++;
    else if(item.status==='Cancelled')stats.cancelled++;
  }
  stats.active=stats.pending+stats.waitingCustomer+stats.approved+stats.inProgress+stats.waitingCompletion;
  stats.resolved=stats.completed+stats.rejected+stats.cancelled;
  return stats;
}

export function getDeadline(dueAt,now=Date.now()){
  const due=new Date(dueAt).getTime();
  if(!Number.isFinite(due))return{minutes:Infinity,tone:'neutral',label:'Không có hạn'};
  const minutes=Math.ceil((due-now)/60000),abs=Math.abs(minutes);
  if(minutes<0)return{minutes,tone:'danger',label:`Quá hạn ${formatDuration(abs)}`};
  if(minutes<=30)return{minutes,tone:'danger',label:`Còn ${formatDuration(minutes)}`};
  if(minutes<=120)return{minutes,tone:'warning',label:`Còn ${formatDuration(minutes)}`};
  return{minutes,tone:'neutral',label:`Còn ${formatDuration(minutes)}`};
}

function formatDuration(minutes){
  if(minutes<60)return`${Math.max(0,minutes)} phút`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?`${hours} giờ ${rest} phút`:`${hours} giờ`;
}

export function requestPriority(item,now=Date.now()){
  if(item.status==='Pending'){
    const deadline=getDeadline(item.responseDueAt,now);
    if(deadline.minutes<0)return 0;
    if(deadline.minutes<=120)return 1;
    return 2;
  }
  return {ChangeProposed:3,Approved:4,InProgress:5,HostCompleted:6,Completed:7,Rejected:8,Cancelled:9}[item.status]??10;
}

export function sortRequests(items=[],now=Date.now()){
  return [...items].sort((a,b)=>requestPriority(a,now)-requestPriority(b,now)||new Date(a.responseDueAt)-new Date(b.responseDueAt));
}

export function groupPriority(group,now=Date.now()){
  return Math.min(...group.items.map(item=>requestPriority(item,now)),10);
}
