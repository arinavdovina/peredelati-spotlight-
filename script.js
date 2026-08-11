const D = window.WORKBOOK_DATA;
const $ = (id) => document.getElementById(id);

const state = {
  expansion: "balanced",
  seed: null,
  plan: []
};

const stagePlan = [
  {stage:"input", label:"Вход в тему"},
  {stage:"noticing", label:"Замечаем язык"},
  {stage:"controlled", label:"Контролируемая практика"},
  {stage:"retrieval", label:"Извлечение из памяти"},
  {stage:"controlled", label:"Точность и закрепление"},
  {stage:"context", label:"Новый бытовой контекст"},
  {stage:"reading", label:"Понимание смысла"},
  {stage:"personalization", label:"Персонализация"},
  {stage:"speaking", label:"Активное использование"},
  {stage:"production", label:"Итоговая мини-миссия"}
];

const focusMix = {
  mixed:   {mixed:5, lexis:3, grammar:3, reading:3, speaking:3},
  lexis:   {lexis:7, mixed:3, reading:1, speaking:2, grammar:1},
  grammar: {grammar:7, mixed:3, reading:2, speaking:2, lexis:1},
  reading: {reading:7, mixed:3, lexis:2, grammar:1, speaking:1},
  speaking:{speaking:7, mixed:3, lexis:2, grammar:1, reading:1}
};

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function chooseWeighted(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s,[,w]) => s+w,0);
  let x = rng()*total;
  for (const [k,w] of entries) { x-=w; if(x<=0) return k; }
  return entries[0][0];
}
function shuffle(arr,rng){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}

function taskCountForPage(pageIndex, mode){
  if(mode==="2") return 2;
  if(mode==="3") return 3;
  return pageIndex % 2 === 0 ? 2 : 3;
}

function stageForPage(i, total){
  if(total === 10) return stagePlan[i];
  const pos = total<=1 ? 0 : i/(total-1);
  const idx = Math.min(stagePlan.length-1, Math.round(pos*(stagePlan.length-1)));
  return stagePlan[idx];
}

function eligibleActivities(grade, focus, stage, used){
  return D.activities.filter(a =>
    a.grades.includes(grade) &&
    !used.has(a.id) &&
    (a.focus===focus || a.focus==="mixed" || focus==="mixed") &&
    (a.stages.includes(stage) || a.stages.includes("context") || a.stages.includes("controlled"))
  );
}

function pickActivity(rng, grade, selectedFocus, stage, used, recentNames){
  const weights = focusMix[selectedFocus] || focusMix.mixed;
  let targetFocus = chooseWeighted(rng, weights);

  // Stronger alignment to page stage
  const stageFav = {
    reading:"reading", speaking:"speaking", personalization:selectedFocus==="grammar"?"grammar":selectedFocus,
    production:selectedFocus==="mixed"?"mixed":selectedFocus
  };
  if(stageFav[stage] && rng() < .55) targetFocus = stageFav[stage];

  let pool = D.activities.filter(a =>
    a.grades.includes(grade) &&
    !used.has(a.id) &&
    a.focus===targetFocus &&
    (a.stages.includes(stage) || a.stages.includes("context") || rng()<.22)
  );

  if(!pool.length) pool = D.activities.filter(a =>
    a.grades.includes(grade) && !used.has(a.id) &&
    (a.focus===targetFocus || a.focus==="mixed")
  );

  if(!pool.length) pool = D.activities.filter(a =>
    a.grades.includes(grade) && !used.has(a.id)
  );

  pool = pool.filter(a => !recentNames.has(a.name));
  if(!pool.length) pool = D.activities.filter(a => a.grades.includes(grade) && !used.has(a.id));
  if(!pool.length) pool = D.activities.filter(a => a.grades.includes(grade));

  return pool[Math.floor(rng()*pool.length)];
}

function buildPlan(seed){
  const rng=mulberry32(seed);
  const grade=parseInt($("grade").value,10);
  const focus=$("focus").value;
  const pages=Math.max(6,Math.min(16,parseInt($("pages").value||10,10)));
  const mode=$("tasksPerPage").value;
  const used=new Set();
  const plan=[];
  let recent=[];

  for(let i=0;i<pages;i++){
    const stageObj=stageForPage(i,pages);
    const n=taskCountForPage(i,mode);
    const tasks=[];
    for(let j=0;j<n;j++){
      let a=pickActivity(rng,grade,focus,stageObj.stage,used,new Set(recent.slice(-4)));
      used.add(a.id);
      recent.push(a.name);
      tasks.push(a);
    }
    plan.push({page:i+1, stage:stageObj.stage, label:stageObj.label, tasks});
  }
  return plan;
}

function focusLabel(v){
  return {mixed:"смешанный",lexis:"лексика",grammar:"грамматика",reading:"чтение",speaking:"говорение"}[v] || v;
}
function expansionText(v){
  return {
    careful:"БЕРЕЖНОЕ расширение: 90–95% языка опирается на материал со скриншотов. Добавляй только общеизвестные служебные слова и очень близкие бытовые микроконтексты.",
    balanced:"СБАЛАНСИРОВАННОЕ расширение: учебник — ядро. Можно добавить примерно 15–20% знакомого функционального языка и бытовых контекстов, которые помогают реально использовать материал, но не вводят новую тему.",
    creative:"СМЕЛОЕ, НО КОНТРОЛИРУЕМОЕ расширение: сохраняй лексику/грамматику учебника как ядро, но переноси её в несколько новых знакомых ребёнку ситуаций. Не вводи сложные новые структуры и не превращай тетрадь в другой юнит."
  }[v];
}
function gradeProfile(g){
  return {
    2:"7–8 лет, ориентировочно Pre-A1/A1. Короткие инструкции, минимум письма, крупные визуальные опоры, предложения обычно очень короткие.",
    3:"8–9 лет, ориентировочно A1. Можно использовать короткие тексты, простые таблицы, 1–3 предложения письма, парные микродиалоги.",
    4:"9–10 лет, ориентировочно A1/A1+. Допустимы короткие связные тексты, сравнение, мини-обоснование выбора и более самостоятельная продукция."
  }[g];
}
function styleDescription(){
  const custom=$("customStyle").value.trim();
  return custom
    ? `Строго по фото №3 (мудборду). Дополнительное пожелание: ${custom}`
    : "Строго по фото №3 (мудборду): повторить визуальную систему, рисовку и персонажей.";
}

function pageTaskLines(p){
  return p.tasks.map((t,idx)=>`   ${idx+1}. ${t.name} — ${t.instruction}`).join("\n");
}

function buildPrompt(plan){
  const grade=$("grade").value;
  const focus=$("focus").value;
  const pages=plan.length;
  const tasksMode=$("tasksPerPage").value;
  const instr=$("instructionLanguage").value;
  const answerKeys=$("answerKeys").value;
  const extra=$("extra").value.trim();
  const watermark=$("watermark").value.trim();
  const lesson=$("lesson").value.trim();

  const totalTasks=plan.reduce((s,p)=>s+p.tasks.length,0);
  const keysText = answerKeys==="separate"
    ? "После всех страниц добавь отдельный компактный блок ANSWER KEY. Не размещай ответы на ученических страницах."
    : "Не добавляй ключи и не показывай правильные ответы на самих страницах.";

  return `Ты — опытный методист по английскому языку для начальной школы, разработчик printable ESL materials и арт-директор учебных рабочих тетрадей.

ТВОЯ ЗАДАЧА
Создай полностью готовую к использованию рабочую тетрадь по ПРИКРЕПЛЁННЫМ СКРИНШОТАМ УЧЕБНИКА.

ВАЖНО О ВХОДНЫХ ДАННЫХ
— К сообщению прикреплены скриншоты учебника и отдельное ФОТО №3 с визуальным мудбордом.
— СКРИНШОТЫ УЧЕБНИКА используй только как содержательный источник: активная лексика, грамматические модели, речевые функции, типы текстов, знакомые формулировки и реальный уровень сложности.
— ФОТО №3 используй как обязательный визуальный референс: стиль рисовки, палитра, композиционные приёмы, декоративные элементы, тип фонов и ПЕРСОНАЖЕЙ.
— Не проси меня перепечатывать материал со скриншотов.
— Не копируй дизайн учебника.
— НЕ используй персонажей из учебника.
— Все герои рабочей тетради должны быть взяты из мудборда на фото №3 и сохранять узнаваемый внешний вид от страницы к странице.
— Не придумывай отдельный «unit focus» и не сужай материал до искусственно выбранной подтемы. Используй весь совместимый языковой материал, реально представленный на прикреплённых страницах.
— Сохрани учебник как содержательное ядро, но создай НОВЫЕ задания и новые бытовые микроконтексты.

ПРОФИЛЬ
— Класс: ${grade}.
— Возраст и уровень: ${gradeProfile(grade)}
— Главный фокус тетради: ${focusLabel(focus)}.
— Количество страниц: ${pages}.
— Формат страниц: отдельные вертикальные A4, portrait.
— Заданий: ${tasksMode==="2-3" ? "2–3 на каждой странице, чередуй 2 и 3" : tasksMode+" на каждой странице"}.
— Всего ориентировочно: ${totalTasks} заданий.
— Язык инструкций ученику: ${instr}.
— Визуальный стиль и персонажи: ${styleDescription()}
— ${expansionText(state.expansion)}
${watermark ? `— На каждой странице аккуратно размести watermark: ${watermark}.` : ""}
${lesson ? `— Предусмотри небольшое поле/маркер: ${lesson}.` : ""}
${extra ? `— Дополнительные требования пользователя: ${extra}` : ""}

МЕТОДИЧЕСКАЯ ЛОГИКА
1. Не делай 10 независимых листов. Это одна цельная тетрадь с развитием сложности.
2. Двигайся от знакомства/замечания языка → контролируемой практики → извлечения из памяти → использования в бытовом контексте → персонализации → короткой самостоятельной продукции.
3. Не повторяй один и тот же механический формат подряд.
4. В каждом задании должна быть понятная учебная функция. Избегай заданий «для красоты».
5. Не перегружай страницу: много белого пространства, крупные поля ответа, читаемые инструкции.
6. В заданиях с выбором ответа не делай паттерн, где правильный ответ постоянно стоит первым, последним или в одной и той же позиции. Распределяй позиции ответов равномерно.
7. Не допускай, чтобы ребёнок мог систематически угадывать правильный ответ по внешним признакам: самый длинный вариант, самый короткий вариант, единственный грамматически согласованный вариант, вариант с повтором слов из вопроса, слишком очевидно выделяющийся дистрактор.
8. Дистракторы должны быть правдоподобными, близкими по форме и уровню сложности, но всё же неверными по смыслу, грамматике или контексту.
9. Проверяй, чтобы хотя бы большинство заданий действительно требовали подумать: сравнить, вспомнить, соотнести смысл, заметить языковую деталь, применить правило или понять контекст, а не просто ткнуть в первый похожий ответ.
10. Для multiple choice, matching и true/false избегай механической угадайки. Делай так, чтобы ответ опирался на понимание языка, а не на шаблон теста.
11. Новая лексика вне скриншотов — только если она действительно нужна для бытового переноса и понятна по контексту.
12. Не вводи незнакомую грамматику ради разнообразия.
13. Если фокус = speaking, задания всё равно должны иметь визуальные/лексические опоры; не оставляй пустые «Discuss» без scaffolding.
14. Если фокус = reading, тексты должны быть короткими, возрастными, связанными с языком со скриншотов, а вопросы — проверять смысл, а не только угадывание по одному слову.
15. Если фокус = mixed, распределяй лексику, грамматику, чтение и говорение по тетради, но всё связывай одной темой.
16. Перед финальной генерацией самостоятельно проведи быструю проверку качества: нет ли однотипного расположения правильных ответов, нет ли слишком лёгких дистракторов, и действительно ли задания требуют мыслительного усилия на уровне возраста.
17. ${keysText}

ПОСТРАНИЧНАЯ СТРУКТУРА
${plan.map(p=>`PAGE ${p.page} — ${p.label.toUpperCase()}
${pageTaskLines(p)}`).join("\n\n")}

АРТ-ДИРЕКШН ПО ФОТО №3
— Фото №3 — не свободное вдохновение, а основной визуальный эталон серии.
— Повтори максимально близко характер линий, степень детализации, палитру, формы, пропорции, одежду, мимику персонажей, тип фонов и декоративных элементов.
— Персонажи берутся ТОЛЬКО с мудборда, а не со страниц учебника.
— Если на фото №3 несколько героев, выбери 1–3 повторяющихся персонажа и используй их последовательно во всей тетради.
— Сохраняй визуальную идентичность героя на всех страницах: лицо, волосы, одежду/цветовую кодировку, пропорции и характер рисовки.
— Учебник определяет содержание. Фото №3 определяет визуал.
— Не смешивай дизайн учебника с дизайном мудборда.

ТРЕБОВАНИЯ К КАЖДОЙ СТРАНИЦЕ
— Один лист = одно отдельное изображение/страница, НЕ коллаж.
— Вертикальный A4.
— Все задания на странице полностью видимы и не обрезаны.
— 2–3 задания визуально отделены друг от друга.
— Крупный, читаемый английский текст.
— Не допускай декоративных элементов поверх заданий.
— Иллюстрации должны помогать понять задание, а не просто украшать лист.
— Сохраняй единый стиль на всех страницах.
— Нумерация заданий сквозная или последовательная внутри страниц — выбери один вариант и не меняй его.
— Не размещай учительские комментарии на ученических страницах.

СНАЧАЛА ПЕРЕД ГЕНЕРАЦИЕЙ
Кратко, в 6–10 строках, сформулируй:
1) какую тему и ключевой языковой материал ты увидел на скриншотах;
2) что считаешь активной лексикой;
3) какую грамматику/речевые модели используешь;
4) что именно добавишь как бытовое расширение;
5) почему предложенная последовательность подходит для ${grade} класса;\n6) какие визуальные признаки фото №3 ты сохраняешь;\n7) каких персонажей мудборда используешь как повторяющихся героев.

ЗАТЕМ
Сгенерируй все ${pages} страниц как единую серию, строго по структуре выше. Не сокращай количество страниц и не объединяй их в один лист.`;
}

function renderPlan(plan){
  const wrap=$("outline");
  wrap.innerHTML="";
  plan.forEach(p=>{
    const card=document.createElement("div");
    card.className="page-card";
    card.innerHTML=`<b>Страница ${p.page} · ${p.label}</b><p>${p.tasks.map(t=>t.name).join(" • ")}</p>`;
    wrap.appendChild(card);
  });
}

function generate(newSeed=true){
  if(newSeed || !state.seed) state.seed = Math.floor(Math.random()*900000)+100000;
  state.plan=buildPlan(state.seed);
  renderPlan(state.plan);
  $("promptOutput").value=buildPrompt(state.plan);
  $("emptyState").classList.add("hidden");
  $("resultWrap").classList.remove("hidden");
  $("copyBtn").disabled=false;
  $("downloadBtn").disabled=false;
  $("rerollBtn").disabled=false;
  $("seedLabel").textContent=`вариант #${state.seed}`;
  setTimeout(()=> $("promptOutput").scrollTop=0,0);
}

$("generateBtn").addEventListener("click",()=>generate(true));
$("rerollBtn").addEventListener("click",()=>generate(true));

$("copyBtn").addEventListener("click", async ()=>{
  await navigator.clipboard.writeText($("promptOutput").value);
  const old=$("copyBtn").textContent;
  $("copyBtn").textContent="Скопировано ✓";
  setTimeout(()=>$("copyBtn").textContent=old,1200);
});

$("downloadBtn").addEventListener("click",()=>{
  const blob=new Blob([$("promptOutput").value],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`workbook_prompt_grade_${$("grade").value}_${state.seed}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

document.querySelectorAll("#expansionControl button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    state.expansion=btn.dataset.value;
    document.querySelectorAll("#expansionControl button").forEach(x=>x.classList.toggle("active",x===btn));
  });
});

