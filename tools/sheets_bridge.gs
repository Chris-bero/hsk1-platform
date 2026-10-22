/**
 * =====================================================================
 *  HSK Practice Site ↔ Google Sheets bridge  (Apps Script)
 * =====================================================================
 * SETUP (once):
 *  !! IMPORTANT: your spreadsheet ALREADY contains the lecture site's own Apps
 *  Script project (Code.gs with its own doPost/doGet). DO NOT paste this file
 *  into that project - duplicate doPost() definitions would collide and break
 *  the lecture site. Create a SEPARATE standalone project instead:
 *  1. Go to https://script.google.com -> New project (standalone).
 *  2. Paste this whole file (rename it e.g. PracticeBridge.gs).
 *  3. Set SPREADSHEET_ID below = the id in your sheet URL:
 *     docs.google.com/spreadsheets/d/<THIS_PART>/edit
 *  4. Change TOKEN to a secret string; the practice site Admin Console must be
 *     configured with the SAME token.
 *  5. Deploy -> New deployment -> Web app:
 *       - Execute as: Me   - Who has access: Anyone
 *     Copy the Web app URL (ends with /exec).
 *  6. Run ping once from the editor to authorize spreadsheet scopes.
 *
 * BEHAVIOUR:
 *  - Existing tabs/columns are NEVER overwritten: missing headers are
 *    appended as new columns; existing rows are updated only by key.
 *  - Students tab is READ-ONLY for login (StudentID/StudentName + Code +
 *    AccountStatus=active). Registration stays on the lecture site.
 *  - Every write is keyed/upserted, so retries never duplicate rows.
 * =====================================================================
 */
/* !! AFTER EVERY CODE UPDATE YOU PASTE: re-set these two lines FIRST, then deploy a new version. !! */
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID';  // from the sheet URL /d/<id>/edit
const TOKEN = 'CHANGE_ME_TOKEN';
const SITE  = 'practice';
function ss_(){
  if(!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PASTE_')===0)
    throw new Error('set SPREADSHEET_ID at the top of the script (from the sheet URL /d/<id>/edit)');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/* ---------------- entry point ---------------- */
function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    if(!body || body.token !== TOKEN) return json_({ok:false, error:'bad token'});
    switch(body.action){
      case 'ping':     return json_({ok:true, ts:new Date().toISOString(), tabs:listTabs_()});
      case 'login':    return json_(login_(body.payload||{}));
      case 'log_login':return json_(logLogin_(body.payload||{}));
      case 'push':     return json_(push_(body.payload||{}));
      case 'catalog':  return json_(catalog_(body.payload||{}));
      case 'analytics':return json_(analytics_());
      default:         return json_({ok:false, error:'unknown action: '+body.action});
    }
  }catch(err){
    return json_({ok:false, error:String(err)});
  }
}
function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
           .setMimeType(ContentService.MimeType.JSON);
}
function listTabs_(){
  return ss_().getSheets().map(s=>s.getName());
}

/* ---------------- sheet & row helpers (schema-tolerant) ---------------- */
function sh_(name, headers){
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if(!sh){ sh = ss.insertSheet(name); sh.getRange(1,1,1,headers.length).setValues([headers]); return sh; }
  const last = sh.getLastColumn();
  const row  = last ? sh.getRange(1,1,1,last).getValues()[0] : [];
  const add  = headers.filter(h=>row.indexOf(h)===-1);
  if(add.length) sh.getRange(1,last+1,1,add.length).setValues([add]);
  return sh;
}
function cols_(sh){ return sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; }
function rowFrom_(cols, obj){ return cols.map(c=> (obj.hasOwnProperty(c)? obj[c] : '')); }
function append_(sh, obj){ sh.appendRow(rowFrom_(cols_(sh), obj)); return 'inserted'; }
function findRow_(sh, keyCols, obj){
  const cols = cols_(sh);
  const last = sh.getLastRow();
  if(last < 2) return null;
  const data = sh.getRange(2,1,last-1,cols.length).getValues();
  const ki = keyCols.map(k=>cols.indexOf(k));
  for(let i=0;i<data.length;i++)
    if(keyCols.every((k,j)=> String(data[i][ki[j]])===String(obj[k]))) return {row:data[i], cols:cols, index:i};
  return null;
}
function upsert_(sh, obj, keyCols){
  const cols = cols_(sh);
  const last = sh.getLastRow();
  if(last < 2) return append_(sh, obj);
  const data = sh.getRange(2,1,last-1,cols.length).getValues();
  const ki   = keyCols.map(k=>cols.indexOf(k));
  for(let i=0;i<data.length;i++){
    if(keyCols.every((k,j)=> String(data[i][ki[j]]) === String(obj[k]))) {
      const row = data[i];
      cols.forEach((c,j)=>{ if(obj.hasOwnProperty(c)) row[j]=obj[c]; });
      sh.getRange(i+2,1,1,cols.length).setValues([row]);
      return 'updated';
    }
  }
  return append_(sh, obj);
}

/* ---------------- login against the Students tab (read-only) ---------------- */
const STUDENTS_H = ['StudentID','StudentName','Code','CourseLevel','EnrollmentDate','AccountStatus'];
function login_(p){
  const sh = sh_('Students', STUDENTS_H);
  const cols = cols_(sh);
  const iID = cols.indexOf('StudentID'), iName = cols.indexOf('StudentName'),
        iCode = cols.indexOf('Code'), iStatus = cols.indexOf('AccountStatus');
  const last = sh.getLastRow();
  if(last < 2) return {ok:false, error:'no students registered'};
  const data = sh.getRange(2,1,last-1,cols.length).getValues();
  const key = String(p.idOrName||'').trim().toLowerCase();
  const code = String(p.code||'').trim();
  for(const r of data){
    const id = String(r[iID]||'').trim().toLowerCase();
    const nm = String(r[iName]||'').trim().toLowerCase();
    if(id===key || nm===key){
      if(String(r[iStatus]||'').trim().toLowerCase()!=='active')
        return {ok:false, error:'account not active'};
      if(code && String(r[iCode]||'').trim()!==code)
        return {ok:false, error:'wrong code'};
      return {ok:true, student:{StudentID:r[iID], StudentName:r[iName],
              CourseLevel:r[cols.indexOf('CourseLevel')]||''}};
    }
  }
  return {ok:false, error:'student not found'};
}

/* ---------------- LoginLog ---------------- */
const LOGIN_H = ['LogID','StudentID','Site','Ts','Method','LocalID','OK','Note'];
function logLogin_(p){
  const sh = sh_('LoginLog', LOGIN_H);
  return append_(sh, {LogID:uid_('lg'), StudentID:p.StudentID||'', Site:SITE,
    Ts:p.Ts||new Date().toISOString(), Method:p.Method||'', LocalID:p.LocalID||'',
    OK:p.OK===false?'false':'true', Note:p.Note||''});
}

/* ---------------- push: sessions / attempts / vocab / lesson / exams ---------------- */
const SESSION_H  = ['SessionID','StudentID','Site','LessonID','StartedAt','EndedAt','Seconds'];
const EVENT_H    = ['EventID','StudentID','Site','Ts','EventType','LessonID','QuestionID','ActivityType','Submitted','Correct','Skipped','Ms','Note'];
const SQS_H      = ['StudentID','QuestionID','LessonID','ActivityType','Attempts','Correct','LastCorrect','LastTs'];
const QS_H       = ['QuestionID','LessonID','ActivityType','Attempts','Correct','LastTs'];
const SVP_H      = ['StudentID','LessonID','WordID','Hanzi','Correct','Incorrect','State','SelfKnown','Days','LastTs'];
const SLP_H      = ['StudentID','LessonID','StartedAt','LastPracticedAt','ActivitiesUsed','Attempts','Correct','Accuracy','CompletedAt'];
function push_(p){
  const out = {sessions:0, attempts:0, vocab:0, lessons:0, exams:0};
  (p.sessions||[]).forEach(s=>{
    upsert_(sh_('Sessions', SESSION_H), Object.assign({Site:SITE}, s), ['SessionID']);
    out.sessions++;
  });
  (p.attempts||[]).forEach(a=>{
    append_(sh_('LearningEvents', EVENT_H), Object.assign({EventID:uid_('ev'), Site:SITE, EventType:'attempt'}, a));
    const shQ = sh_('StudentQuizStats', SQS_H);
    const prev = findRow_(shQ, ['StudentID','QuestionID'], a);
    const prevA = prev ? Number(prev.row[prev.cols.indexOf('Attempts')])||0 : 0;
    const prevC = prev ? Number(prev.row[prev.cols.indexOf('Correct')])||0 : 0;
    upsert_(shQ, {
      StudentID:a.StudentID, QuestionID:a.QuestionID, LessonID:a.LessonID||'',
      ActivityType:a.ActivityType||'', Attempts:prevA+(Number(a.AttemptsDelta)||1),
      Correct:prevC+(Number(a.CorrectDelta)||0), LastCorrect:a.Correct==='true'||a.Correct===true?'true':'false',
      LastTs:a.Ts}, ['StudentID','QuestionID']);
    bumpStat_(sh_('QuizStats', QS_H), {QuestionID:a.QuestionID, LessonID:a.LessonID||'',
      ActivityType:a.ActivityType||'', Ts:a.Ts}, a);
    out.attempts++;
  });
  (p.vocab||[]).forEach(v=>{
    upsert_(sh_('StudentVocabularyProgress', SVP_H), v, ['StudentID','WordID']);
    out.vocab++;
  });
  (p.lessons||[]).forEach(l=>{
    upsert_(sh_('StudentLessonProgress', SLP_H), l, ['StudentID','LessonID']);
    out.lessons++;
  });
  (p.exams||[]).forEach(x=>{
    append_(sh_('LearningEvents', EVENT_H), {EventID:uid_('ev'), StudentID:x.StudentID, Site:SITE,
      Ts:x.Ts, EventType:'exam_result', LessonID:x.LessonID||'', QuestionID:'', ActivityType:'exam',
      Submitted:'', Correct:'', Skipped:'', Ms:x.DurationSec||'', Note:JSON.stringify(x)});
    out.exams++;
  });
  return {ok:true, written:out};
}
/* QuizStats stores cumulative Attempts/Correct: implement as upsert with increments */
function bumpStat_(sh, key, a){
  const cols = cols_(sh);
  const last = sh.getLastRow();
  const ki = ['QuestionID'].map(k=>cols.indexOf(k));
  if(last>=2){
    const data = sh.getRange(2,1,last-1,cols.length).getValues();
    for(let i=0;i<data.length;i++){
      if(String(data[i][ki[0]])===String(key.QuestionID)){
        const iA = cols.indexOf('Attempts'), iC = cols.indexOf('Correct'), iT = cols.indexOf('LastTs');
        data[i][iA] = (Number(data[i][iA])||0) + 1;
        data[i][iC] = (Number(data[i][iC])||0) + ((a.Correct==='true'||a.Correct===true)?1:0);
        data[i][iT] = key.Ts||'';
        sh.getRange(i+2,1,1,cols.length).setValues([data[i]]);
        return;
      }
    }
  }
  append_(sh, {QuestionID:key.QuestionID, LessonID:key.LessonID, ActivityType:key.ActivityType,
    Attempts:1, Correct:((a.Correct==='true'||a.Correct===true)?1:0), LastTs:key.Ts||''});
}

/* ---------------- Lessons catalog (from admin) ---------------- */
const LESSON_H = ['LessonID','LessonNum','Title','WordsCount','SentencesCount','QuestionsCount','Status','UpdatedAt','Site'];
function catalog_(p){
  (p.lessons||[]).forEach(l=>{
    upsert_(sh_('Lessons', LESSON_H), Object.assign({Site:SITE, UpdatedAt:new Date().toISOString()}, l), ['LessonID']);
  });
  return {ok:true, lessons:(p.lessons||[]).length};
}

/* ---------------- teacher dashboard: raw tables (client aggregates) ---------------- */
function table_(name, fallbackHeaders){
  const ss = ss_();
  const sh = ss.getSheetByName(name);
  if(!sh) return [];
  const last = sh.getLastRow();
  if(last < 2) return [];
  const cols = cols_(sh);
  const data = sh.getRange(2,1,last-1,cols.length).getValues();
  return data.map(r=>{ const o={}; cols.forEach((c,i)=>o[c]=r[i]); return o; });
}
function analytics_(){
  const ev = table_('LearningEvents', []).filter(e=>String(e.EventType||'')==='attempt' || String(e.EventType||'')==='exam_result');
  return {ok:true, source:'sheet', ts:new Date().toISOString(),
    students:  table_('Students', []).map(r=>({StudentID:r.StudentID, StudentName:r.StudentName, AccountStatus:r.AccountStatus})),
    sessions:  table_('Sessions', []),
    slp:       table_('StudentLessonProgress', []),
    svp:       table_('StudentVocabularyProgress', []),
    sqs:       table_('StudentQuizStats', []),
    qs:        table_('QuizStats', []),
    events:    ev};
}

function uid_(p){ return p+'-'+Utilities.getUuid().slice(0,8); }
