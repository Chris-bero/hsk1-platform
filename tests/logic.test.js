require('./domstub.js');
const fs=require('fs');
let src=fs.readFileSync('/tmp/app.js','utf8');
// export internals for testing
src+="\nmodule.exports={loadFixture,validateChapter,genQuestionsForChapter,vocabOf,sentencesOf,questionsOf,register,login,recordAttempt,overallStats,wrongList,selfCheck,normalizeQ,importChapterJSON,removeFixture,saveSettings,applyPinyinClass,get DB(){return DB},shuffle,updateVocabProgress,myAttempts,chapterById,ACT};";
src=src.replace(/^"use strict";/,'');
fs.writeFileSync('/tmp/app_mod.js',src);
const T=require('/tmp/app_mod.js');

let pass=0,fail=0;
const ok=(name,cond,info="")=>{cond?(pass++,console.log("PASS",name)):(fail++,console.log("FAIL",name,info));};

// --- fixture & generation ---
ok("fixture loads",T.loadFixture()===true);
const ch=T.chapterById("fixture-demo");
ok("fixture chapter exists & ready",ch&&ch.status==="ready");
const words=T.vocabOf("fixture-demo");
ok("fixture words = 6",words.length===6,words.length);
const v=T.validateChapter("fixture-demo");
ok("validation passes",v.ok,JSON.stringify(v.issues));
ok("vocab_c2e covers every word",words.every(w=>T.questionsOf("fixture-demo","vocab_c2e").some(q=>q.wordId===w.id)));
ok("vocab_e2e covers every word",words.every(w=>T.questionsOf("fixture-demo","vocab_e2c").some(q=>q.wordId===w.id)));
ok("listening covers every word",words.every(w=>T.questionsOf("fixture-demo","listening").some(q=>q.wordId===w.id)));
const qs=T.questionsOf("fixture-demo");
ok("all MCQs have exactly 1 correct option",qs.filter(q=>q.options).every(q=>q.options.filter(o=>o.correct).length===1));
ok("MCQs have 4 options OR are flagged for review",qs.filter(q=>q.options).every(q=>q.options.length===4||q.validation==="review"),JSON.stringify(qs.filter(q=>q.options&&q.options.length<4&&q.validation!=="review").map(q=>q.type)));
ok("cloze questions generated from source sentences",T.questionsOf("fixture-demo","cloze").length>0);
ok("Sentence Builder removed per instructor request",T.questionsOf("fixture-demo","builder").length===0&&!T.ACT.builder);
ok("cloze blank answer is a real segment",T.questionsOf("fixture-demo","cloze").every(q=>{const s=T.DB.sentences.find(s=>s.id===q.sentenceId);return q.segments[q.blankIndex]===s.segments[q.blankIndex];}));

// --- shuffle keeps key ---
const q1=T.questionsOf("fixture-demo","vocab_c2e")[0];
let mapOk=true;
for(let i=0;i<50;i++){const n=T.normalizeQ(q1);if(!n._opts[n._correctIdx].correct)mapOk=false;}
ok("normalizeQ shuffle preserves correct-answer mapping (50 runs)",mapOk);

// --- auth & isolation ---
const r1=T.register("Alice","pass1");ok("register Alice",!!r1.ok,r1.err||"");
ok("student ID generated",/^HSK1-\d{4}$/.test(r1.ok.studentId),r1.ok.studentId);
ok("duplicate name rejected",!!T.register("alice","xxxx").err);
const st0=T.overallStats();
ok("fresh stats zero",st0.totalAttempts===0&&st0.accuracy===null);

// --- attempts & accuracy ---
const c2e=T.questionsOf("fixture-demo","vocab_c2e");
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[0].id,type:"vocab_c2e",submitted:"x",correct:true,runId:"r1"});
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[1].id,type:"vocab_c2e",submitted:"y",correct:false,runId:"r1"});
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[2].id,type:"vocab_c2e",submitted:null,correct:false,skipped:true,runId:"r1"});
const st1=T.overallStats();
ok("attempts counted (skipped excluded from accuracy)",st1.totalAttempts===2&&st1.correct===1&&st1.accuracy===50,JSON.stringify(st1));
ok("unique questions = 2 (skipped not submitted)",st1.uniqueQuestions===2);
ok("unique wrong = 1",st1.uniqueWrong===1);

// --- wrong list & resolution ---
let wl=T.wrongList();
ok("wrongList has 1 unresolved",wl.length===1&&!wl[0].resolved);
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[1].id,type:"vocab_c2e",submitted:"z",correct:true,runId:"r2"});
wl=T.wrongList();
ok("historical mistake kept but resolved after correct retry",wl.length===1&&wl[0].resolved&&wl[0].wrongCount===1&&wl[0].attempts===2);

// --- mastery rule: not mastered after 1 correct ---
const u=T.DB.users[0];
const vp=T.DB.vocabProgress[u.id][c2e[0].wordId];
ok("1 correct => learning, not mastered",vp.state==="learning",vp.state);
// simulate distinct days
vp.days={"2026-01-01":true,"2026-01-02":true};vp.correct=2;
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[0].id,type:"vocab_c2e",submitted:"a",correct:true,runId:"r3"});
ok("3 correct across 2 days => mastered",T.DB.vocabProgress[u.id][c2e[0].wordId].state==="mastered",T.DB.vocabProgress[u.id][c2e[0].wordId].state);
T.recordAttempt({chapterId:"fixture-demo",questionId:c2e[0].id,type:"vocab_c2e",submitted:"b",correct:false,runId:"r3"});
ok("wrong after mastery => needs_revision (history kept)",T.DB.vocabProgress[u.id][c2e[0].wordId].state==="needs_revision"&&T.DB.vocabProgress[u.id][c2e[0].wordId].correct===3);

// --- data isolation: second user ---
T.login("Alice","pass1");
const r2ok=(T.DB.sessionUserId=null,T.register("Bob","pass2"));
const stBob=T.overallStats();
ok("Bob sees zero attempts (isolation)",stBob.totalAttempts===0&&stBob.accuracy===null,JSON.stringify(stBob));
ok("Bob wrong list empty",T.wrongList().length===0);
T.login("Bob","wrongpass").err&&0;
ok("bad password rejected",!!T.login("Bob","wrongpass").err);
ok("good password works",!!T.login("Bob","pass2").ok);
T.login("Alice","pass1");
{const n=T.overallStats().totalAttempts;ok("Alice still has her 5 attempts (isolation kept)",n===5,"got "+n);}

// --- import pipeline (admin workflow) ---
const imp=T.importChapterJSON({chapter:{num:1,title:"Import Test",sourceFile:"t.pdf",representative:{hanzi:"甲乙。",pinyin:"jiǎ yǐ.",english:"tokens"}},
  vocab:[{hanzi:"甲",pinyin:"jiǎ",english:"token A",pinyinVerified:true},{hanzi:"乙",pinyin:"yǐ",english:"token B",pinyinVerified:true},
         {hanzi:"丙",pinyin:"bǐng",english:"token C",pinyinVerified:true},{hanzi:"丁",pinyin:"dīng",english:"token D",pinyinVerified:true}],
  sentences:[{hanzi:"甲喜欢乙。",pinyin:"jiǎ xǐhuan yǐ.",english:"A likes B.",segments:["甲","喜欢","乙","。"]}]});
ok("import ok",imp.ok);
ok("imported chapter ready or review",["ready","review"].includes(imp.chapter.status),imp.chapter.status);
ok("imported questions generated",imp.gen.generated>0,JSON.stringify(imp.gen.byType));
ok("import validation counts",imp.validation.counts.words===4&&imp.validation.counts.sentences===1);
const imp2=T.importChapterJSON({chapter:{},vocab:null});
ok("bad import rejected",!imp2.ok);

// --- missing-content policy: tiny chapter => flagged, not invented ---
const imp3=T.importChapterJSON({chapter:{num:99,title:"Tiny",sourceFile:"t2.pdf"},vocab:[{hanzi:"一",english:"one"}],sentences:[]});
const tiny=imp3.chapter;
ok("1-word chapter: MCQs flagged for review (insufficient distractors)",tiny.validation.flagged>0,JSON.stringify(tiny.validation.gen));
ok("no extra words invented",T.vocabOf(tiny.id).length===1);
ok("no sentences invented",T.sentencesOf(tiny.id).length===0);

// --- self check ---
const sc=T.selfCheck();
ok("selfCheck all green",sc.every(r=>r[1]),JSON.stringify(sc.filter(r=>!r[1])));

// --- regression: global toggles must NOT rebuild the app (live exercise sessions survive) ---
{
  const src=fs.readFileSync('/tmp/app.js','utf8');
  ok("header pinyin toggle = instant class sync, no re-render",src.includes('onclick:()=>{saveSettings({pinyin:!mySettings().pinyin});syncHeaderToggles();')&&(src.match(/saveSettings\(\{pinyin:!mySettings\(\)\.pinyin\}\);render\(\)/g)||[]).length===0);
  ok("timed & theme toggles also avoid full re-render and read live settings",src.includes('saveSettings({timed:!mySettings().timed});syncHeaderToggles();')&&src.includes('saveSettings({theme:t==="dark"?"light":"dark"});syncHeaderToggles();'));
  T.login("Alice","pass1");
  T.saveSettings({pinyin:false});
  ok("pinyin OFF → body.pyoff applied instantly",document.body.classList.contains("pyoff")===true);
  T.saveSettings({pinyin:true});
  ok("pinyin ON → body.pyoff removed instantly",document.body.classList.contains("pyoff")===false);
  ok("pinyin rendered via CSS-controlled .pyv elements (not conditional mounting)",src.includes('class:"qpinyin pyv"')&&src.includes('class:"py pyv"'));
  ok("header toggles read LIVE settings (stale-closure regression)",src.includes('saveSettings({pinyin:!mySettings().pinyin});syncHeaderToggles();')&&src.includes('saveSettings({timed:!mySettings().timed});syncHeaderToggles();'));
}

console.log("\n===== "+pass+" passed, "+fail+" failed =====");
process.exit(fail?1:0);
