require('./domstub.js');
const fs=require('fs');
let src=fs.readFileSync('/tmp/app.js','utf8').replace(/^"use strict";/,'');
src+="\nmodule.exports={ensureCurriculumImported,validateChapter,vocabOf,sentencesOf,questionsOf,chapterById,normalizeQ,get DB(){return DB},CURRICULUM_BUNDLE};";
fs.writeFileSync('/tmp/app_ch1.js',src);
const T=require('/tmp/app_ch1.js');

let pass=0,fail=0;
const ok=(n,c,i="")=>{c?(pass++,console.log("PASS",n)):(fail++,console.log("FAIL",n,i));};

// authorized source data (mirrors content/chapter01.json)
const AUTH_WORDS=["你好","王老师","请问","大家","好","学生","们","老师","您","你们","谢谢","不客气","同学","再见"];
const AUTH_TRANSLATED=["AI小语，你好！","开学第一天，在办公室里，王一飞和AI助教小语打招呼。","开学第一天，课堂上，学生们学习打招呼用语。","开学第一天，课堂上，学生们学习致谢语、告别语。","妈种麻，我放马。","马吃麻，妈骂马。"];

ok("chapter 1 bundle present in app",T.CURRICULUM_BUNDLE.some(b=>b.bundleCode==="ch01-fltrp-lesson1"));
ok("boot auto-imports chapter 1 exactly once",T.ensureCurriculumImported()===0&&!!T.DB.chapters.find(c=>c.bundleCode==="ch01-fltrp-lesson1"));
ok("second boot is a no-op",T.ensureCurriculumImported()===0);
const ch=T.chapterById?T.DB.chapters.find(c=>c.bundleCode==="ch01-fltrp-lesson1"):null;
ok("chapter 1 exists with bundle code",!!ch);
ok("chapter 1 status is Ready (validation passed)",ch.status==="ready",ch.status);
ok("chapter 1 title from source",ch.title==="AI小语，你好！ Hello, AI Xiaoyu!");

const words=T.vocabOf(ch.id);
ok("14 vocabulary items, exactly the source list",words.length===14&&AUTH_WORDS.every(w=>words.some(v=>v.hanzi===w)),words.map(w=>w.hanzi).join(","));
ok("no invented words (set equality)",new Set(words.map(w=>w.hanzi)).size===14&&words.every(w=>AUTH_WORDS.includes(w.hanzi)));
ok("all vocab pinyin came from source (verified flag)",words.every(w=>w.pinyin&&w.pinyinVerified));

const sents=T.sentencesOf(ch.id);
ok("35 unique source sentences",sents.length===35,sents.length);
ok("only the 6 source-translated sentences carry English",sents.filter(s=>s.english).length===6&&sents.filter(s=>s.english).every(s=>AUTH_TRANSLATED.includes(s.hanzi)));
ok("all 35 sentences carry pinyin (12 source + 23 instructor-requested)",sents.every(s=>s.pinyin)&&sents.filter(s=>s.pinyinProvenance==="source").length===12&&sents.filter(s=>s.pinyinProvenance==="instructor-requested").length===23);

const q=t=>T.questionsOf(ch.id,t);
ok("C2E covers all 14 words",AUTH_WORDS.every(w=>q("vocab_c2e").some(x=>x.hanzi===w)));
ok("E2C covers all 14 words",AUTH_WORDS.every(w=>q("vocab_e2c").some(x=>x.english===words.find(v=>v.hanzi===w).english)));
ok("Listening covers all 14 words",AUTH_WORDS.every(w=>q("listening").some(x=>x.hanzi===w)));
ok("matching/triple possible (14 words ≥ 4)",words.length>=4);
ok("sent_e2c = 6 (only translated prompts), each with 4 options & 1 key",q("sent_e2c").length===6&&q("sent_e2c").every(x=>x.english&&x.options.length===4&&x.options.filter(o=>o.correct).length===1));
ok("sent_c2e = 6 with 4 English options each",q("sent_c2e").length===6&&q("sent_c2e").every(x=>x.options.length===4&&x.options.filter(o=>o.correct).length===1));
ok("Sentence Builder removed per instructor request",q("builder").length===0);
ok("bundle revision applied on re-import",ch.bundleRev>=2);
ok("cloze capped at 15 per chapter & blanks never punctuation",q("cloze").length===15&&q("cloze").every(x=>!/^[،。！？、؛：,.!?…—+＋-]$/.test(x.segments[x.blankIndex])));
ok("cloze spreads over 15 distinct source sentences",new Set(q("cloze").map(x=>x.sentenceId)).size===15);
ok("cloze blanks never punctuation",q("cloze").every(x=>!/^[，。！？、；：,.!?]$/.test(x.segments[x.blankIndex])));
ok("cloze correct option equals the removed source segment",q("cloze").every(x=>{const s=T.DB.sentences.find(s=>s.id===x.sentenceId);return x.options.find(o=>o.correct).hanzi===s.segments[x.blankIndex];}));
ok("every MCQ has exactly one correct option",T.questionsOf(ch.id).filter(x=>x.options).every(x=>x.options.filter(o=>o.correct).length===1));
ok("every question references an existing source item",T.questionsOf(ch.id).every(x=>(x.wordId&&words.some(w=>w.id===x.wordId))||(x.sentenceId&&sents.some(s=>s.id===x.sentenceId))));

const v=ch.validation;
ok("validation: zero blocking issues",v.ok&&v.issues.length===0,JSON.stringify(v.issues));
ok("no missing-pinyin warnings remain",v.warnings.filter(w=>w.includes("no pinyin")).length===0,v.warnings.join("|"));
ok("zero flagged questions (enough distractors in source)",v.flagged===0,v.flagged);
ok("exam bank has validated questions",T.questionsOf(ch.id).filter(x=>x.validation!=="review"&&x.type!=="builder").length>=3);

console.log("\nCOVERAGE ch1: "+JSON.stringify(v.gen.byType));
console.log("===== chapter01: "+pass+" passed, "+fail+" failed =====");
process.exit(fail?1:0);
