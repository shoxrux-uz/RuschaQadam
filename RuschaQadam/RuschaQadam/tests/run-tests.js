/**
 * Deutsch Qadam — avtomatik testlar (QA)
 * GitHub har safar APK yig'ishdan oldin shu faylni ishga tushiradi.
 * Biror test o'tmasa, APK yig'ilmaydi — buzilgan ilova telefoningizga yetib bormaydi.
 *
 * Ishga tushirish:  npm install jsdom@24  &&  node tests/run-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✅ ' + name); }
  catch (e) { failed++; failures.push(name); console.log('  ❌ ' + name + '\n     → ' + (e && e.message ? e.message : e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }

/* Ilovani "soxta brauzer" (jsdom) ichida ochamiz */
function boot(localData) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://deutsch-qadam.test/',
    beforeParse(window) {
      window.__TEST__ = true;
      window.scrollTo = () => {};
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = () => {};
      window.addEventListener('error', (e) => errors.push(e.message || String(e.error)));
      if (localData) window.localStorage.setItem('ruschaQadam_v1', JSON.stringify(localData));
    }
  });
  dom.window.__errors = errors;
  return dom.window;
}
function run(w, code) { return w.eval(code); }

console.log('\n🧪 Deutsch Qadam — avtomatik testlar\n');

/* ---------- 1. Ilova ishga tushadi ---------- */
console.log('1) Ishga tushish');
const w = boot();
test('Ilova xatosiz ochiladi', () => eq(w.__errors.length, 0, 'JS xatolar: ' + w.__errors.join(' | ')));
test('Bosh sahifa chiziladi', () => assert(w.document.querySelector('.hero h1'), 'hero topilmadi'));
test('"made by shoxrux" yozuvi bor', () => assert(/made by/.test(w.document.querySelector('.made').textContent) && /shoxrux/.test(w.document.querySelector('.made').textContent)));

/* ---------- 2. Ma'lumotlar butunligi ---------- */
console.log('\n2) Ma\'lumotlar butunligi');
test('Lug\'atda kamida 1000 ta so\'z bor', () => assert(run(w, 'ALLW.length') >= 1000, 'so\'zlar: ' + run(w, 'ALLW.length')));
test('Har bir so\'zda nemischa, o\'qilishi va tarjima bor', () => {
  const bad = run(w, 'ALLW.filter(function(x){ return !x.de || !x.tr || !x.uz; }).map(function(x){ return x.id; })');
  eq(bad.length, 0, 'to\'liq bo\'lmagan so\'zlar: ' + bad.join(','));
});
test('Ruscha so\'zlar takrorlanmaydi', () => {
  const dup = run(w, '(function(){ var s={}, d=[]; ALLW.forEach(function(x){ if(s[x.de]) d.push(x.de); s[x.de]=1; }); return d; })()');
  eq(dup.length, 0, 'takroriy: ' + dup.join(', '));
});
test('So\'z ID lari noyob', () => eq(run(w, 'Object.keys(WMAP).length'), run(w, 'ALLW.length')));
test('Har bir mavzuda kamida 8 ta ibora bor (mini test uchun)', () => {
  const small = run(w, 'LESSONS.filter(function(l){ return l.items.length<8; }).map(function(l){ return l.id; })');
  eq(small.length, 0, small.join(','));
});
test('Har bir dialogda kamida 4 ta replika bor', () => eq(run(w, 'DIALOGS.filter(function(d){ return d.lines.length<4; }).length'), 0));

/* ---------- 3. Sonlar ---------- */
console.log('\n3) Sonlarni ruschaga o\'girish');
const NUMS = { 0: 'ноль', 1: 'один', 7: 'семь', 16: 'шестнадцать', 21: 'двадцать один', 40: 'сорок', 90: 'девяносто',
  100: 'сто', 101: 'сто один', 245: 'двести сорок пять', 1000: 'тысяча', 1001: 'тысяча один', 2000: 'две тысячи', 2026: 'две тысячи двадцать шесть',
  5000: 'пять тысяч', 11000: 'одиннадцать тысяч', 21000: 'двадцать одна тысяча', 22500: 'двадцать две тысячи пятьсот',
  999999: 'девятьсот девяносто девять тысяч девятьсот девяносто девять', 1000000: 'один миллион' };
Object.keys(NUMS).forEach((n) => test(n + ' → ' + NUMS[n], () => eq(run(w, 'numDe(' + n + ')'), NUMS[n])));

/* ---------- 4. Testlar (savollar) to'g'ri tuziladi ---------- */
console.log('\n4) Savollar to\'g\'ri tuziladi');
function checkQs(qs, label) {
  assert(qs.length > 0, label + ': savol yo\'q');
  qs.forEach((q, i) => {
    assert(q.options.indexOf(q.answer) > -1, label + ' #' + i + ': to\'g\'ri javob variantlar ichida yo\'q');
    eq(new Set(q.options).size, q.options.length, label + ' #' + i + ': variantlar takrorlangan');
    assert(q.options.length >= 2, label + ' #' + i + ': variant kam');
  });
}
test('Barcha bo\'lim va rejimlarda lug\'at testi', () => {
  const cats = run(w, 'VOCAB.map(function(c){ return c.id; })').concat(['all']);
  ['de2uz', 'uz2de', 'audio'].forEach((m) => cats.forEach((c) => {
    for (let k = 0; k < 3; k++) checkQs(run(w, "TCFG.mode='" + m + "';TCFG.cat='" + c + "';TCFG.n=10;buildVocabQuiz()"), m + '/' + c);
  }));
});
test('Har bir mavzu mini testi', () => run(w, 'LESSONS.map(function(l){ return l.id; })').forEach((id) => checkQs(run(w, "buildLessonQuiz('" + id + "')"), id)));
test('Talaffuz testi', () => { for (let k = 0; k < 5; k++) checkQs(run(w, 'buildSoundQuiz(10)'), 'sound'); });
test('Sonlar testi', () => { for (let k = 0; k < 10; k++) checkQs(run(w, 'buildNumberQuiz(10)'), 'numbers'); });
test('Dialog testlari', () => { checkQs(run(w, "buildDialogQuiz(['d2','d4'],8)"), 'dlg1'); checkQs(run(w, "buildDialogQuiz(['d1','d3','d5'],8)"), 'dlg2'); });
test('Bo\'lim imtihonlari va yakuniy imtihon to\'liq', () => {
  run(w, "NODES.filter(function(n){ return n.spec; }).map(function(n){ return n.id; })").forEach((id) => {
    for (let k = 0; k < 3; k++) {
      const qs = run(w, "(function(){ var n=nodeById('" + id + "'); return buildExam(n.spec, n.n); })()");
      checkQs(qs, id);
      eq(qs.length, run(w, "nodeById('" + id + "').n"), id + ' savollar soni');
    }
  });
});
test('Daraja aniqlash testi 9 savol (A1)', () => { const qs = run(w, 'buildPlacement()'); checkQs(qs, 'placement'); eq(qs.length, 9); });

/* ---------- 5. Progress saqlanadi ---------- */
console.log('\n5) Progressni saqlash');
test('O\'rganilgan so\'zlar ixcham saqlanib, qayta o\'qiladi', () => {
  run(w, 'ALLW.forEach(function(x,i){ if(i%3===0) state.learned[x.id]=1; }); saveState();');
  const before = run(w, 'learnedCount()');
  const back = run(w, 'Object.keys(unpackLearned(packLearned())).length');
  eq(back, before);
});
test('Saqlangan ma\'lumot Google limitidan (8800 belgi) kichik', () => {
  run(w, 'ALLW.forEach(function(x){ state.learned[x.id]=1; }); for(var i=0;i<200;i++){ state.wrong[ALLW[i].id]=3; } for(var d=0; d<100; d++){ var dt=new Date(); dt.setDate(dt.getDate()-d); state.days[dayKey(dt)]=50; } saveState();');
  const len = run(w, 'localStorage.getItem(LS_KEY).length');
  assert(len < 8800, 'hajm: ' + len);
});
test('Eski formatdagi progress yo\'qolmaydi', () => {
  const w2 = boot({ xp: 120, name: 'Ali', learned: { oila0: 1, feyl3: 1 }, ts: 1 });
  eq(w2.eval('state.xp'), 120); eq(w2.eval('state.name'), 'Ali'); eq(w2.eval('learnedCount()'), 2);
});

/* ---------- 6. Daraja va XP ---------- */
console.log('\n6) XP, daraja va kunlik maqsad');
test('Daraja XP oshgan sari kamaymaydi', () => {
  let prev = 0; for (let x = 0; x < 20000; x += 37) { const L = run(w, 'levelOf(' + x + ')'); assert(L >= prev, 'xp=' + x); prev = L; }
});
test('Daraja chegaralari to\'g\'ri', () => { eq(run(w, 'levelOf(0)'), 1); eq(run(w, 'levelOf(39)'), 1); eq(run(w, 'levelOf(40)'), 2); eq(run(w, 'levelOf(120)'), 3); });
test('XP qo\'shilganda bugungi kun va seriya yangilanadi', () => {
  const w3 = boot({ name: 'T', onboarded: true, ts: 1 });
  w3.eval('gainXp(30)');
  eq(w3.eval('state.xp'), 30); eq(w3.eval('state.days[dayKey()]'), 30); eq(w3.eval('state.streak'), 1);
  assert(w3.eval("!!state.ach.first"), '"Birinchi qadam" yutug\'i ochilmadi');
});

/* ---------- 7. O'rganish yo'li ---------- */
console.log('\n7) O\'rganish yo\'li');
test('Boshida faqat birinchi bosqich ochiq', () => {
  const w4 = boot({ name: 'T', onboarded: true, ts: 1 });
  eq(w4.eval('currentNode().id'), 'abc');
  assert(w4.eval("nodeUnlocked('abc')"), 'abc yopiq'); assert(!w4.eval("nodeUnlocked('salom')"), 'salom ochiq bo\'lmasligi kerak');
});
test('Testdan o\'tilganda keyingi bosqich ochiladi', () => {
  const w5 = boot({ name: 'T', onboarded: true, ts: 1 });
  w5.eval("startNodeTest('abc'); QZ.qs.forEach(function(q){ var i=q.options.indexOf(q.answer); quizPick({dataset:{p:String(i)}}); quizNext(); });");
  assert(w5.eval("nodeIsDone('abc')"), 'abc tugamadi'); assert(w5.eval("nodeUnlocked('salom')"), 'salom ochilmadi');
});
test('Past natijada bosqich ochilmaydi', () => {
  const w6 = boot({ name: 'T', onboarded: true, ts: 1 });
  w6.eval("startNodeTest('abc'); QZ.qs.forEach(function(q){ var i=(q.options.indexOf(q.answer)+1)%q.options.length; quizPick({dataset:{p:String(i)}}); quizNext(); });");
  assert(!w6.eval("nodeIsDone('abc')"), 'abc noto\'g\'ri tugatildi'); assert(w6.eval('weakWords().length') >= 0);
});
test('Yakuniy imtihondan o\'tilganda sertifikat ochiladi', () => {
  const w7 = boot({ name: 'Shoxrux', onboarded: true, ts: 1 });
  w7.eval("NODES.forEach(function(n){ if(n.id!=='final') state.path[n.id]=90; }); startNodeTest('final'); QZ.qs.forEach(function(q){ var i=q.options.indexOf(q.answer); quizPick({dataset:{p:String(i)}}); quizNext(); }); go('cert');");
  assert(w7.eval("nodeIsDone('final')"), 'final tugamadi');
  assert(/Shoxrux/.test(w7.document.querySelector('.cert').textContent), 'sertifikatda ism yo\'q');
});

/* ---------- 8. Barcha sahifalar ochiladi ---------- */
console.log('\n8) Barcha sahifalar');
const w8 = boot({ name: 'T', onboarded: true, ts: 1 });
w8.eval("bootStep('splash'); bootStep('data');");
const VIEWS = [['home'], ['stats'], ['sounds'], ['lessons'], ['lesson', 'salom'], ['dialogs'], ['dialog', 'd1'], ['numbers', 'learn'], ['numbers', 'conv'], ['numbers', 'practice'],
  ['vocab'], ['tests'], ['games'], ['game', 'memory'], ['game', 'scramble'], ['game', 'sentence'], ['game', 'dictation'], ['game', 'speed'], ['grammar'], ['cert']];
VIEWS.forEach((v) => test('Sahifa: ' + v.join('/'), () => {
  const before = w8.__errors.length;
  w8.eval("go('" + v[0] + "'," + (v[1] ? "'" + v[1] + "'" : 'null') + ')');
  eq(w8.__errors.length, before, 'xato: ' + w8.__errors.slice(before).join(' | '));
  assert(w8.document.getElementById('main').innerHTML.length > 100, 'sahifa bo\'sh');
}));
test('Sozlamalar oynasi ochiladi', () => { w8.eval('openSettings()'); assert(w8.document.getElementById('modal').classList.contains('show')); w8.eval('closeModal()'); });
test('Tungi rejim almashadi', () => { w8.eval("state.settings.theme='light'; ACT.toggleTheme()"); eq(w8.document.documentElement.getAttribute('data-theme'), 'dark'); });
test('"Orqaga" tugmasi oldingi sahifaga qaytaradi', () => {
  w8.eval("go('home'); HIST=[]; go('vocab'); go('tests');");
  w8.eval('window.__back()'); eq(w8.eval('current.view'), 'vocab');
  w8.eval('window.__back()'); eq(w8.eval('current.view'), 'home');
  eq(w8.eval('window.__back()'), false, 'bosh sahifada ilovadan chiqish kerak');
});

/* ---------- 8b. Talaffuz baholash ---------- */
console.log('\n8b) Talaffuzni baholash');
test('To\'g\'ri aytilgan ibora 100 ball', () => eq(w.eval('scorePron("Меня зовут Шохрух.", ["меня зовут Шохрух"]).score'), 100));
test('Raqam bilan tanilgan son ham to\'g\'ri hisoblanadi', () => eq(w.eval('scorePron("Мне двадцать пять лет.", ["Мне 25 лет"]).score'), 100));
test('Umuman boshqa gap past ball oladi', () => assert(w.eval('scorePron("Извините, где вокзал?", ["и так далее"]).score') < 40));
test('Talaffuz mashqi sahifasi ochiladi', () => { const b = w8.__errors.length; w8.eval("go('game','pron')"); eq(w8.__errors.length, b); });

/* ---------- 9. Onboarding ---------- */
console.log('\n9) Onboarding');
test('Yangi foydalanuvchiga onboarding ko\'rsatiladi va saqlanadi', () => {
  const w9 = boot();
  w9.eval("bootStep('splash'); bootStep('data');");
  assert(w9.document.getElementById('onb').classList.contains('show'), 'onboarding chiqmadi');
  w9.eval("obNext(); document.getElementById('obName').value='lola'; obNext(); OB.reason='ish'; obNext(); OB.goal=100; obNext(); obNext(); obFinish();");
  eq(w9.eval('state.name'), 'Lola'); eq(w9.eval('state.goal'), 100); eq(w9.eval('state.onboarded'), true);
});

/* ---------- Natija ---------- */
console.log('\n────────────────────────────────────────');
console.log('Natija: ' + passed + ' ta o\'tdi, ' + failed + ' ta xato');
if (failed) { console.log('Xato testlar:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('🎉 Hammasi joyida — APK yig\'ish mumkin!\n');
process.exit(0);
