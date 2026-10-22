require('./domstub.js');
const fs=require('fs');
// simulate opening admin.html#teacher
global.location.hash="#teacher";
let src=fs.readFileSync('/tmp/admin.js','utf8').replace(/^"use strict";/,'');
src+="\nmodule.exports={render,register,login,SYNC,get DB(){return DB}};";
fs.writeFileSync('/tmp/admin_t.js',src);
const A=require('/tmp/admin_t.js');
let pass=0,fail=0;
const ok=(n,c)=>{c?(pass++,console.log("PASS",n)):(fail++,console.log("FAIL",n));};
// sheet analytics stub
global.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);
  return {json:async()=> b.action==="analytics"?{ok:true,source:"sheet",students:[{StudentID:"s1",StudentName:"A",AccountStatus:"active"}],
    sessions:[{StudentID:"s1",Seconds:120,EndedAt:"2026-10-21T01:00:00Z"}],slp:[],svp:[],sqs:[],qs:[],
    events:[{StudentID:"s1",Ts:"2026-10-21T01:00:00Z",EventType:"attempt",LessonID:"lesson-1",QuestionID:"q1",ActivityType:"vocab_c2e",Correct:"true",Skipped:"false"}]}
   :{ok:true}};};
(async()=>{
  A.register("Owner","pass1");
  A.SYNC.save({url:"https://x/exec",token:"t"});
  A.render();                       // draws gate->console->teacher tab (async)
  await new Promise(r=>setTimeout(r,80));
  ok("teacher tab renders from SHEET source without crash",true);
  A.SYNC.save({url:"",token:""});   // local fallback path
  A.render();
  await new Promise(r=>setTimeout(r,80));
  ok("teacher tab renders from LOCAL fallback without crash",true);
  console.log("===== admin_teacher: "+pass+" passed, "+fail+" failed =====");
  process.exit(fail?1:0);
})();
