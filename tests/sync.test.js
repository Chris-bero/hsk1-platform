require('./domstub.js');
const fs=require('fs');
let src=fs.readFileSync('/tmp/app.js','utf8').replace(/^"use strict";/,'');
src+="\nmodule.exports={SYNC,stableQid,lessonIdOf,linkSheetStudent,register,login,get DB(){return DB},chapterById};";
fs.writeFileSync('/tmp/app_sync.js',src);
const T=require('/tmp/app_sync.js');
let pass=0,fail=0;
const ok=(n,c,i="")=>{c?(pass++,console.log("PASS",n)):(fail++,console.log("FAIL",n,i));};

// fetch stub
let calls=[], mode="ok";
global.fetch=async(url,opts)=>{calls.push({url,opts:JSON.parse(opts.body)});
  if(mode==="fail")throw new Error("network down");
  const a=calls[calls.length-1].opts.action;
  return {json:async()=> a==="login"?{ok:true,student:{StudentID:"stu-0001",StudentName:"Ebra",CourseLevel:"new-hsk-1"}}
    : a==="ping"?{ok:true,tabs:["Students","Sessions"]}:{ok:true,written:{attempts:1}}};};

(async()=>{
  // 1 disabled → no-op
  ok("sync disabled by default",T.SYNC.enabled()===false);
  T.SYNC.enqueue("attempt",{x:1});
  ok("enqueue is no-op when disabled",T.SYNC.queue().length===0);
  // 2 enable + enqueue batches by kind
  T.SYNC.save({url:"https://example/exec",token:"tok123"});
  ok("enabled after save",T.SYNC.enabled()===true);
  T.SYNC.enqueue("attempt",{StudentID:"stu-0001",QuestionID:"vocab_c2e:W1"});
  T.SYNC.enqueue("vocab",{StudentID:"stu-0001",WordID:"W1"});
  T.SYNC.enqueue("session",{SessionID:"s1",StudentID:"stu-001"});
  ok("queue holds 3 messages",T.SYNC.queue().length===3);
  // 3 flush batches into ONE push call and clears queue
  const r=await T.SYNC.flush();
  ok("flush ok",r&&r.ok===true);
  ok("single batched POST with token",calls.length===1&&calls[0].opts.token==="tok123"&&calls[0].opts.action==="push");
  ok("payload bucketed by kind",calls[0].opts.payload.attempts.length===1&&calls[0].opts.payload.vocab.length===1&&calls[0].opts.payload.sessions.length===1);
  ok("queue cleared after success",T.SYNC.queue().length===0);
  ok("last status ok",T.SYNC.last().ok===true);
  // 4 failure keeps queue
  mode="fail";
  T.SYNC.enqueue("attempt",{StudentID:"stu-0001",QuestionID:"q2"});
  const r2=await T.SYNC.flush();
  ok("failed flush returns error",r2.ok===false);
  ok("queue RETAINED on failure (retry later)",T.SYNC.queue().length===1);
  ok("last status records error",T.SYNC.last().ok===false&&!!T.SYNC.last().error);
  mode="ok";
  await T.SYNC.flush();
  // 5 stable ids
  ok("stableQid deterministic & blank-aware",T.stableQid({type:"cloze",sourceItemId:"S1",blankIndex:2})==="cloze:S1:2"&&T.stableQid({type:"cloze",sourceItemId:"S1",blankIndex:3})!=="cloze:S1:2");
  const ch=T.DB.chapters.find(c=>c.bundleCode==="ch01-fltrp-lesson1");
  ok("lessonIdOf maps to lesson-<num>",T.lessonIdOf(ch.id)==="lesson-1");
  // 6 sheet login link
  const res=await T.SYNC.login("stu-0001","8520");
  ok("login action sent with credentials",calls[calls.length-1].opts.action==="login"&&calls[calls.length-1].opts.payload.code==="8520");
  const u=T.linkSheetStudent(res.student);
  ok("linkSheetStudent creates linked local profile",u.sheetId==="stu-0001"&&u.name==="Ebra");
  const u2=T.linkSheetStudent(res.student);
  ok("re-login links SAME profile (no duplicates)",u2.id===u.id&&T.DB.users.filter(x=>x.sheetId==="stu-0001").length===1);
  console.log("===== sync: "+pass+" passed, "+fail+" failed =====");
  process.exit(fail?1:0);
})();
