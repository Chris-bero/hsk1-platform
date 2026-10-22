require('./domstub.js');
const fs=require('fs');
let src=fs.readFileSync('/tmp/app.js','utf8').replace(/^"use strict";/,'');
src+="\nmodule.exports={aggregateAnalytics,localRawTables,get DB(){return DB}};";
fs.writeFileSync('/tmp/app_an.js',src);
const T=require('/tmp/app_an.js');
let pass=0,fail=0;
const ok=(n,c,i="")=>{c?(pass++,console.log("PASS",n)):(fail++,console.log("FAIL",n,i));};

const RAW={source:"sheet",
 students:[{StudentID:"s1",StudentName:"A"},{StudentID:"s2",StudentName:"B"}],
 sessions:[{SessionID:"x1",StudentID:"s1",LessonID:"lesson-1",Seconds:600,EndedAt:"2026-10-20T10:00:00Z"},
           {SessionID:"x2",StudentID:"s2",LessonID:"lesson-1",Seconds:300,EndedAt:"2026-10-21T10:00:00Z"}],
 slp:[{StudentID:"s1",LessonID:"lesson-1",CompletedAt:""},{StudentID:"s1",LessonID:"lesson-2",CompletedAt:"2026-10-20"},{StudentID:"s2",LessonID:"lesson-1",CompletedAt:""}],
 svp:[{StudentID:"s1",LessonID:"lesson-1",State:"mastered"},{StudentID:"s1",LessonID:"lesson-1",State:"mastered"},{StudentID:"s1",LessonID:"lesson-1",State:"needs_revision"},{StudentID:"s2",LessonID:"lesson-1",State:"learning"}],
 sqs:[],qs:[],
 events:[
  {StudentID:"s1",Ts:"2026-10-20T09:00:00Z",EventType:"attempt",LessonID:"lesson-1",QuestionID:"q1",ActivityType:"vocab_c2e",Correct:"true",Skipped:"false"},
  {StudentID:"s1",Ts:"2026-10-20T09:01:00Z",EventType:"attempt",LessonID:"lesson-1",QuestionID:"q2",ActivityType:"vocab_c2e",Correct:"false",Skipped:"false"},
  {StudentID:"s1",Ts:"2026-10-20T09:02:00Z",EventType:"attempt",LessonID:"lesson-1",QuestionID:"q3",ActivityType:"cloze",Correct:"false",Skipped:"true"},
  {StudentID:"s2",Ts:"2026-10-21T09:00:00Z",EventType:"attempt",LessonID:"lesson-1",QuestionID:"q2",ActivityType:"vocab_c2e",Correct:"false",Skipped:"false"},
  {StudentID:"s2",Ts:"2026-10-21T09:01:00Z",EventType:"exam_result",LessonID:"lesson-1",Note:"{}"}]};
const A=T.aggregateAnalytics(RAW);
ok("cohort students & active(7d)",A.cohort.students===2&&A.cohort.active===2);
ok("cohort attempts exclude skipped",A.cohort.attempts===3,A.cohort.attempts);
ok("cohort correct/incorrect",A.cohort.correct===1&&A.cohort.incorrect===2);
ok("cohort accuracy 33%",A.cohort.accuracy===33,A.cohort.accuracy);
ok("cohort time = 900s & sessions 2 & exams 1",A.cohort.seconds===900&&A.cohort.sessions===2&&A.cohort.exams===1);
ok("byDay groups & seconds",A.byDay.length===2&&A.byDay.find(d=>d.date==="2026-10-20").seconds===600);
ok("byActivity accuracy",A.byActivity.find(a=>a.type==="vocab_c2e").attempts===3&&A.byActivity.find(a=>a.type==="cloze")===undefined);
ok("byLesson started/completed",A.byLesson.find(l=>l.lessonId==="lesson-1").started===2&&A.byLesson.find(l=>l.lessonId==="lesson-2").completed===1);
ok("topMissed ranks q2 (2 wrong)",A.topMissed[0].questionId==="q2"&&A.topMissed[0].wrong===2);
const s1=A.per["s1"],s2=A.per["s2"];
ok("per-student attempts/skipped",s1.attempts===2&&s1.skipped===1&&s2.attempts===1);
ok("per-student accuracy",s1.accuracy===50&&s2.accuracy===0);
ok("per-student time/sessions",s1.seconds===600&&s1.sessions===1&&s2.seconds===300);
ok("per-student lessons & mastery",s1.lessonsStarted===2&&s1.lessonsCompleted===1&&s1.wordsMastered===2&&s1.wordsRevision===1&&s2.wordsLearning===1);
ok("per-student missed & recent",s1.missed["q2"]===1&&s1.recent.length===3&&s1.recent[0].ts.startsWith("2026-10-20T09:02"));
ok("per-student exams",s2.exams===1&&s1.exams===0);
// per-lesson deep dive
const L1=A.lessons.find(l=>l.lessonId==="lesson-1");
ok("per-lesson: students & attempts",L1&&Object.keys(L1.students).length===2&&L1.attempts===3);
ok("per-lesson: accuracy & correct",L1.correct===1&&L1.accuracy===33);
ok("per-lesson: seconds from sessions",L1.seconds===900);
ok("per-lesson: byActivity",L1.byActivity["vocab_c2e"].attempts===3);
ok("per-lesson: missed list (q2 wrong twice)",L1.missedList.length===1&&L1.missedList[0].qid==="q2"&&L1.missedList[0].n===2);
ok("per-lesson: vocab states",L1.vocab.mastered===2&&L1.vocab.revision===1&&L1.vocab.learning===1);
ok("per-lesson: studentList sorted",L1.studentList[0].attempts>=L1.studentList[1].attempts);
ok("per-lesson: exams counted",L1.exams===1);
// local fallback shape
const L=T.localRawTables();
ok("localRawTables returns same schema",["students","sessions","slp","svp","events"].every(k=>Array.isArray(L[k]))&&L.source==="local");
const AL=T.aggregateAnalytics(L);
ok("local aggregate runs without crash",AL.cohort&&Array.isArray(AL.students));
console.log("===== analytics: "+pass+" passed, "+fail+" failed =====");
process.exit(fail?1:0);
