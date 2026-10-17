import test from 'node:test';
import assert from 'node:assert/strict';
import{getDeadline,getRequestStats,sortRequests}from'./serviceRequestUtils.js';

test('getRequestStats keeps active and resolved totals consistent',()=>{
  const stats=getRequestStats([{status:'Pending'},{status:'InProgress'},{status:'HostCompleted'},{status:'Completed'},{status:'Rejected'}]);
  assert.deepEqual({pending:stats.pending,inProgress:stats.inProgress,waitingCompletion:stats.waitingCompletion,completed:stats.completed,rejected:stats.rejected,active:stats.active,resolved:stats.resolved,total:stats.total},{pending:1,inProgress:1,waitingCompletion:1,completed:1,rejected:1,active:3,resolved:2,total:5});
});

test('getDeadline changes tone at the agreed thresholds',()=>{
  const now=Date.parse('2026-10-17T10:00:00Z');
  assert.equal(getDeadline('2026-10-17T09:45:00Z',now).tone,'danger');
  assert.equal(getDeadline('2026-10-17T10:30:00Z',now).tone,'danger');
  assert.equal(getDeadline('2026-10-17T11:31:00Z',now).tone,'warning');
  assert.equal(getDeadline('2026-10-17T12:01:00Z',now).tone,'neutral');
});

test('sortRequests puts overdue and urgent pending work first, resolved last',()=>{
  const now=Date.parse('2026-10-17T10:00:00Z');
  const result=sortRequests([{id:4,status:'Completed'},{id:3,status:'InProgress'},{id:2,status:'Pending',responseDueAt:'2026-10-17T10:20:00Z'},{id:1,status:'Pending',responseDueAt:'2026-10-17T09:00:00Z'}],now);
  assert.deepEqual(result.map(x=>x.id),[1,2,3,4]);
});
