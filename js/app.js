const STORAGE_KEY = 'pritty_v2_state';
const DAY_LETTERS = ['D','L','M','X','J','V','S']; // índice = getDay() (0=domingo)

let state = null;

function defaultProfile() {
  return {
    name:'', wake:'07:00', sleep:'23:00',
    fixedBlocks:[], goals:[],
    subjectsHard:'', subjectsEasy:'', focusMinutes:30,
    procrastinate:'', hardToStart:'', autonomy:1
  };
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch(e){} }
  return { onboarded:false, profile:defaultProfile(), tasks:[],
    resources:{ notas:[], fechas:[] },
    inspiration:{ favorites:[], hidden:[], hiddenCats:[] } };
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function dayChipsHtml(idPrefix){
  return ['L','M','X','J','V','S','D'].map((l,i)=>{
    const dow = (i+1)%7; // L=1..D=0 → getDay index
    return `<button type="button" class="chip" data-day="${dow}" onclick="this.classList.toggle('active')">${l}</button>`;
  }).join('');
}
function readSelectedDays(containerId){
  return [...document.querySelectorAll(`#${containerId} .chip.active`)].map(b => parseInt(b.dataset.day,10));
}

/* ==================== APP SHELL ==================== */
const App = {
  init(){
    state = loadState();
    if (state.onboarded){ this.enterMain(); }
    else { Onboarding.init(); }
  },
  enterMain(){
    document.getElementById('onboarding').style.display='none';
    document.getElementById('mainApp').style.display='flex';
    document.getElementById('vaciar-greeting').textContent = state.profile.name ? `Vacía tu cabeza, ${state.profile.name}` : 'Vacía tu cabeza';
    this.showScreen('screen-vaciar');
    Plan.render(); Recursos.render(); Inspiracion.render(); Settings.render();
  },
  showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.target===id));
    if (id==='screen-plan') Plan.render();
    if (id==='screen-recursos') Recursos.render();
    if (id==='screen-inspiracion') Inspiracion.render();
    if (id==='screen-settings') Settings.render();
  },
  resetAll(){
    if (confirm('Esto borra tus tareas y tu perfil de este dispositivo. ¿Continuar?')){
      localStorage.removeItem(STORAGE_KEY); location.reload();
    }
  }
};

/* ==================== ONBOARDING ==================== */
const Onboarding = {
  step:0, blocksDraft:[], goalsDraft:[], autonomy:1,
  init(){
    document.getElementById('nb-days').innerHTML = dayChipsHtml('nb');
    this.renderDots(); this.renderBlocks(); this.renderGoals();
  },
  renderDots(){
    document.getElementById('obDots').innerHTML = [0,1,2,3,4,5].map(i=>`<span class="${i===this.step?'active':''}"></span>`).join('');
  },
  addBlock(){
    const label = document.getElementById('nb-label').value.trim();
    const start = document.getElementById('nb-start').value;
    const end = document.getElementById('nb-end').value;
    const days = readSelectedDays('nb-days');
    const flexible = document.getElementById('nb-flex').checked;
    if (!label || !days.length){ alert('Ponle un nombre y elige al menos un día.'); return; }
    this.blocksDraft.push({ id:Date.now()+'', label, start, end, days, flexible });
    document.getElementById('nb-label').value='';
    document.querySelectorAll('#nb-days .chip').forEach(c=>c.classList.remove('active'));
    this.renderBlocks();
  },
  renderBlocks(){
    document.getElementById('ob-blocks').innerHTML = this.blocksDraft.map(b=>
      `<div class="mini-list-item"><span>${escapeHtml(b.label)} · ${b.days.map(d=>DAY_LETTERS[d]).join('')} · ${b.start}-${b.end}${b.flexible?' (posponible)':''}</span>
      <button onclick="Onboarding.removeBlock('${b.id}')">✕</button></div>`).join('');
  },
  removeBlock(id){ this.blocksDraft = this.blocksDraft.filter(b=>b.id!==id); this.renderBlocks(); },
  addGoal(){
    const text = document.getElementById('ng-text').value.trim();
    const times = parseInt(document.getElementById('ng-times').value,10) || 1;
    if (!text) return;
    this.goalsDraft.push({ id:Date.now()+'', text, timesPerWeek:times });
    document.getElementById('ng-text').value='';
    this.renderGoals();
  },
  renderGoals(){
    document.getElementById('ob-goals').innerHTML = this.goalsDraft.map(g=>
      `<div class="mini-list-item"><span>${escapeHtml(g.text)} · ${g.timesPerWeek}x/semana</span>
      <button onclick="Onboarding.removeGoal('${g.id}')">✕</button></div>`).join('');
  },
  removeGoal(id){ this.goalsDraft = this.goalsDraft.filter(g=>g.id!==id); this.renderGoals(); },
  chooseAutonomy(v){
    this.autonomy = v;
    document.querySelectorAll('#onboarding .onboard-step[data-step="5"] .choice-btn').forEach(b=>
      b.classList.toggle('selected', parseInt(b.dataset.val,10)===v));
  },
  next(){
    document.querySelector(`.onboard-step[data-step="${this.step}"]`).classList.remove('active');
    this.step++;
    document.querySelector(`.onboard-step[data-step="${this.step}"]`).classList.add('active');
    this.renderDots();
  },
  finish(){
    const profile = defaultProfile();
    profile.name = document.getElementById('ob-name').value.trim();
    profile.fixedBlocks = this.blocksDraft;
    profile.goals = this.goalsDraft;
    profile.wake = document.getElementById('ob-wake').value || '07:00';
    profile.sleep = document.getElementById('ob-sleep').value || '23:00';
    profile.subjectsHard = document.getElementById('ob-hard').value.trim();
    profile.subjectsEasy = document.getElementById('ob-easy').value.trim();
    profile.focusMinutes = parseInt(document.getElementById('ob-focus').value,10);
    profile.procrastinate = document.getElementById('ob-procrastinate').value.trim();
    profile.hardToStart = document.getElementById('ob-hardstart').value.trim();
    profile.autonomy = this.autonomy;

    state.profile = profile;
    state.onboarded = true;

    // convertir hábitos de texto libre y objetivos en tareas-hábito recurrentes
    const habitsText = document.getElementById('ob-habits').value;
    habitsText.split(/[,\n]/).map(s=>s.trim()).filter(Boolean).forEach(h=>{
      state.tasks.push(makeHabitTask(h, 7, 15));
    });
    profile.goals.forEach(g=>{
      state.tasks.push(makeHabitTask(g.text, g.timesPerWeek, /gimnasio|entren/i.test(g.text) ? 60 : 30));
    });

    saveState();
    App.enterMain();
  }
};

function assignDaysForFrequency(n){
  n = Math.max(1, Math.min(7, n));
  const days = [1,2,3,4,5,6,0]; // lunes..domingo
  const chosen = [];
  for (let i=0;i<n;i++) chosen.push(days[Math.round(i*7/n)]);
  return chosen;
}
function makeHabitTask(text, timesPerWeek, minutes){
  return {
    id: Date.now()+Math.random().toString(16).slice(2),
    text, quadrant:'habit', deadline:null, minutes,
    isHabit:true, isLeisure:false, isExam:false,
    subtasks:null, completed:false, delegatedTo:null, needsInfo:false,
    timesPerWeek, assignedDays: assignDaysForFrequency(timesPerWeek)
  };
}

/* ==================== VACIAR ==================== */
const Vaciar = {
  organize(){
    const text = document.getElementById('dump-text').value.trim();
    if (!text) return;
    const newTasks = AIEngine.interpret(text, state.profile);
    state.tasks.push(...newTasks);
    saveState();
    document.getElementById('dump-text').value='';
    this.renderQuestions(newTasks);
    App.showScreen('screen-plan');
    Plan.showTab('ahora');
  },
  renderQuestions(newTasks){
    const missing = newTasks.filter(t=>t.needsInfo);
    const el = document.getElementById('vaciar-questions');
    if (!missing.length){ el.innerHTML=''; return; }
    el.innerHTML = `<div class="card"><strong>Antes de seguir…</strong>` + missing.map(t=>
      `<div style="margin-top:8px;">Has añadido "${escapeHtml(t.text)}" pero no veo fecha de examen. ¿Sabes cuándo es?
       <div class="row-2" style="margin-top:6px;">
         <input type="date" id="ans-${t.id}">
         <button class="btn-ghost" onclick="Vaciar.answer('${t.id}')">Guardar</button>
       </div></div>`).join('') + `</div>`;
  },
  answer(taskId){
    const date = document.getElementById(`ans-${taskId}`).value;
    const t = state.tasks.find(t=>t.id===taskId);
    if (t && date){ t.deadline=date; t.needsInfo=false; saveState(); this.renderQuestions(state.tasks.filter(x=>x.needsInfo)); Plan.render(); }
  }
};

/* ==================== PLAN ==================== */
const Plan = {
  tab:'ahora',
  showTab(tab){
    this.tab = tab;
    document.querySelectorAll('#plan-tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
    this.render();
  },
  render(){
    const el = document.getElementById('plan-content');
    if (this.tab==='ahora') return this.renderAhora(el);
    if (this.tab==='hoy') return this.renderDay(el, todayStr(), 'Hoy');
    if (this.tab==='manana') return this.renderDay(el, todayStr(1), 'Mañana');
    if (this.tab==='semana') return this.renderWeek(el);
  },
  currentBlock(){
    const blocks = AIEngine.buildDayPlan(todayStr(), state.tasks, state.profile);
    const nowMin = new Date().getHours()*60 + new Date().getMinutes();
    return blocks.find(b => b.type!=='fixed' && b.type!=='break' && b.end > nowMin) || null;
  },
  renderAhora(el){
    if (!state.tasks.length){
      el.innerHTML = emptyState('Todavía no hay nada que organizar. Ve a "Vaciar" y cuéntame qué tienes en la cabeza.');
      return;
    }
    const b = this.currentBlock();
    if (!b){
      el.innerHTML = `<div class="now-card"><div class="eyebrow">POR AHORA</div><div class="task-title">Nada urgente ahora mismo</div>
        <div class="task-meta">Buen momento para algo de tu lista, o simplemente para descansar.</div></div>`;
      return;
    }
    const typeLabel = { task:'Tarea', habit:'Hábito', leisure:'Tiempo libre' }[b.type] || '';
    el.innerHTML = `<div class="now-card">
      <div class="eyebrow">AHORA</div>
      <div class="task-title">${escapeHtml(b.label)}</div>
      <div class="task-meta">${typeLabel} · hasta las ${fromMin(b.end)}</div>
      <div class="actions">
        ${b.type!=='leisure' ? `<button class="btn-primary" onclick="Plan.completeBlock('${b.taskId||''}','${b.stepId||''}')">He terminado, siguiente</button>` : `<button class="btn-primary" onclick="Plan.showTab('hoy')">Ver el resto del día</button>`}
      </div>
    </div>
    <button class="btn-ghost replan-btn" onclick="Plan.replan()">No he podido cumplir esto, reorganiza</button>`;
  },
  completeBlock(taskId, stepId){
    const t = state.tasks.find(t=>t.id===taskId);
    if (t){
      if (stepId && t.subtasks){
        const s = t.subtasks.find(s=>s.id===stepId);
        if (s) s.done = true;
        if (t.subtasks.every(s=>s.done)) t.completed = true;
      } else {
        t.completed = true;
      }
      saveState();
    }
    this.render();
  },
  replan(){
    const { priorityNow } = AIEngine.replan(todayStr(), state.tasks, state.profile);
    const el = document.getElementById('plan-content');
    if (!priorityNow.length){
      el.innerHTML = `<div class="card">No pasa nada. Ahora mismo no tienes nada más pendiente hoy — buen momento para descansar.</div>`;
      return;
    }
    el.innerHTML = `<div class="card"><strong>Vale, no pasa nada. He reorganizado el día.</strong>
      <p class="subtitle" style="margin:8px 0 0;">Esto es lo que más necesitas hacer ahora:</p>
      ${priorityNow.map(b=>`<div class="task-mini"><span class="content">${escapeHtml(b.label)}</span></div>`).join('')}
      <button class="btn-primary" style="margin-top:10px;" onclick="Plan.showTab('ahora')">Volver a Ahora</button>
    </div>`;
  },
  renderDay(el, dateStr, label){
    const blocks = AIEngine.buildDayPlan(dateStr, state.tasks, state.profile);
    if (!blocks.length){ el.innerHTML = emptyState(`Sin bloques planificados para ${label.toLowerCase()} todavía.`); return; }
    const colors = { fixed:'var(--fixed)', task:'var(--do)', habit:'var(--habit)', leisure:'var(--leisure)', break:'var(--eliminate)' };
    el.innerHTML = `<h3 style="margin:0 0 8px;">${label}</h3>` + blocks.map(b=>`
      <div class="block ${b.doneMark?'done':''}">
        <div class="time">${fromMin(b.start)}</div>
        <div class="bar" style="background:${colors[b.type]||'#ddd'}"></div>
        <div class="b-content"><div class="b-title">${escapeHtml(b.label)}</div><div class="b-type">${b.type==='fixed'?'Fijo':b.type==='break'?'Descanso':b.type==='leisure'?'Ocio':b.type==='habit'?'Hábito':'Tarea'}</div></div>
      </div>`).join('') + this.quadrantExtras();
  },
  quadrantExtras(){
    const delegate = state.tasks.filter(t=>!t.completed && t.quadrant==='delegate');
    const eliminate = state.tasks.filter(t=>!t.completed && t.quadrant==='eliminate');
    let html = '';
    if (delegate.length){
      html += `<div class="quadrant-section"><h3><span class="dot" style="background:var(--do)"></span>Podrías delegarlo</h3>` +
        delegate.map(t=>`<div class="task-mini"><span class="content">${escapeHtml(t.text)}</span><button onclick="Plan.delegate('${t.id}')">Delegar</button></div>`).join('') + `</div>`;
    }
    if (eliminate.length){
      html += `<div class="quadrant-section"><h3><span class="dot" style="background:var(--eliminate)"></span>Candidatas a eliminar</h3>` +
        eliminate.map(t=>`<div class="task-mini"><span class="content">${escapeHtml(t.text)}</span><button onclick="Plan.remove('${t.id}')">Eliminar</button></div>`).join('') + `</div>`;
    }
    return html;
  },
  delegate(id){
    const name = prompt('¿A quién delegas esto?');
    const t = state.tasks.find(t=>t.id===id);
    if (t && name){ t.delegatedTo=name; t.completed=true; saveState(); this.render(); }
  },
  remove(id){ state.tasks = state.tasks.filter(t=>t.id!==id); saveState(); this.render(); },
  renderWeek(el){
    let html = '';
    for (let i=0;i<7;i++){
      const d = todayStr(i);
      const blocks = AIEngine.buildDayPlan(d, state.tasks, state.profile).filter(b=>b.type==='task'||b.type==='habit');
      const label = new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'short'});
      html += `<div class="card"><strong style="text-transform:capitalize;">${label}</strong>` +
        (blocks.length ? blocks.map(b=>`<div class="task-mini" style="margin-top:6px;"><span class="content">${fromMin(b.start)} · ${escapeHtml(b.label)}</span></div>`).join('') : `<p class="subtitle" style="margin:6px 0 0;">Día libre de tareas planificadas.</p>`) + `</div>`;
    }
    el.innerHTML = html;
  }
};

function emptyState(msg){ return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/></svg><p>${msg}</p></div>`; }

/* ==================== RECURSOS ==================== */
const Recursos = {
  tab:'notas',
  showTab(t){ this.tab=t; document.querySelectorAll('.res-tabs button').forEach(b=>b.classList.toggle('active', b.dataset.rt===t)); this.render(); },
  render(){
    const el = document.getElementById('recursos-content');
    if (this.tab==='notas') return this.renderNotas(el);
    if (this.tab==='fechas') return this.renderFechas(el);
    if (this.tab==='horario') return this.renderHorario(el);
  },
  renderNotas(el){
    el.innerHTML = `<div class="card">
      <div class="field"><textarea id="note-text" placeholder="Pega o escribe un apunte, resumen o recordatorio..."></textarea></div>
      <button class="btn-ghost" style="width:100%;" onclick="Recursos.addNota()">Guardar apunte</button>
    </div>` + state.resources.notas.map(n=>`<div class="res-item">${escapeHtml(n.text)}<div class="meta">${n.date}</div></div>`).join('');
  },
  addNota(){
    const text = document.getElementById('note-text').value.trim();
    if (!text) return;
    state.resources.notas.unshift({ id:Date.now()+'', text, date: todayStr() });
    saveState(); this.render();
  },
  renderFechas(el){
    el.innerHTML = `<div class="card">
      <div class="row-2">
        <div class="field"><label>Asignatura / examen</label><input id="fecha-subj" placeholder="Ej: Economía"></div>
        <div class="field"><label>Fecha</label><input id="fecha-date" type="date"></div>
      </div>
      <button class="btn-ghost" style="width:100%;" onclick="Recursos.addFecha()">Guardar fecha</button>
    </div>` + state.resources.fechas.map(f=>`<div class="res-item">${escapeHtml(f.subject)}<div class="meta">${f.date}</div></div>`).join('');
  },
  addFecha(){
    const subject = document.getElementById('fecha-subj').value.trim();
    const date = document.getElementById('fecha-date').value;
    if (!subject || !date) return;
    state.resources.fechas.push({ id:Date.now()+'', subject, date });
    // si hay una tarea de examen pendiente de fecha para esta asignatura, se la asignamos
    const t = state.tasks.find(t=>t.needsInfo && t.text.toLowerCase().includes(subject.toLowerCase()));
    if (t){ t.deadline = date; t.needsInfo = false; }
    saveState(); this.render();
  },
  renderHorario(el){
    el.innerHTML = state.profile.fixedBlocks.map(b=>
      `<div class="res-item">${escapeHtml(b.label)} · ${b.days.map(d=>DAY_LETTERS[d]).join('')} · ${b.start}-${b.end}${b.flexible?' (posponible)':''}</div>`
    ).join('') + `<p class="subtitle">Para editarlo, ve a Ajustes.</p>`;
  }
};

/* ==================== INSPIRACIÓN ==================== */
const Inspiracion = {
  filter:'all',
  render(){
    const cats = ['all', ...Object.keys(INSPO_CATEGORY_LABELS)].filter(c=>c==='all'||!state.inspiration.hiddenCats.includes(c));
    document.getElementById('insp-filters').innerHTML = cats.map(c=>
      `<button class="chip ${this.filter===c?'active':''}" onclick="Inspiracion.setFilter('${c}')">${c==='all'?'Todo':INSPO_CATEGORY_LABELS[c]}</button>`).join('');
    const cards = INSPO_CARDS.filter(c => !state.inspiration.hidden.includes(c.id) && !state.inspiration.hiddenCats.includes(c.cat))
      .filter(c => this.filter==='all' || c.cat===this.filter)
      .sort((a,b) => (state.inspiration.favorites.includes(b.id)?1:0) - (state.inspiration.favorites.includes(a.id)?1:0));
    document.getElementById('insp-grid').innerHTML = cards.map(c=>{
      const fav = state.inspiration.favorites.includes(c.id);
      return `<div class="insp-card">
        <span class="cat">${INSPO_CATEGORY_LABELS[c.cat]}</span>
        <p>${escapeHtml(c.text)}</p>
        <div class="insp-actions">
          <button class="${fav?'on':''}" onclick="Inspiracion.toggleFav('${c.id}')">${fav?'♥':'♡'}</button>
          <button onclick="Inspiracion.hideCard('${c.id}')">Ocultar</button>
          <button onclick="Inspiracion.hideCategory('${c.cat}')">No este tipo</button>
        </div>
      </div>`;
    }).join('') || emptyState('No queda nada por aquí con este filtro.');
  },
  setFilter(c){ this.filter=c; this.render(); },
  toggleFav(id){
    const f = state.inspiration.favorites;
    const i = f.indexOf(id);
    if (i>-1) f.splice(i,1); else f.push(id);
    saveState(); this.render();
  },
  hideCard(id){ state.inspiration.hidden.push(id); saveState(); this.render(); },
  hideCategory(cat){ state.inspiration.hiddenCats.push(cat); saveState(); this.render(); }
};

/* ==================== AJUSTES ==================== */
const Settings = {
  blocksDraft:null, goalsDraft:null,
  render(){
    const p = state.profile;
    document.getElementById('st-name').value = p.name;
    document.getElementById('st-wake').value = p.wake;
    document.getElementById('st-sleep').value = p.sleep;
    document.getElementById('st-hard').value = p.subjectsHard;
    document.getElementById('st-easy').value = p.subjectsEasy;
    document.getElementById('st-procrastinate').value = p.procrastinate;
    document.getElementById('sb-days').innerHTML = dayChipsHtml('sb');
    document.querySelectorAll('#screen-settings .settings-section .choice-btn').forEach(b=>
      b.classList.toggle('selected', parseInt(b.dataset.val,10)===p.autonomy));
    this.renderBlocks(); this.renderGoals();
  },
  renderBlocks(){
    document.getElementById('st-blocks').innerHTML = state.profile.fixedBlocks.map(b=>
      `<div class="mini-list-item"><span>${escapeHtml(b.label)} · ${b.days.map(d=>DAY_LETTERS[d]).join('')} · ${b.start}-${b.end}</span>
      <button onclick="Settings.removeBlock('${b.id}')">✕</button></div>`).join('') || `<p class="subtitle">Sin bloques todavía.</p>`;
  },
  addBlock(){
    const label = document.getElementById('sb-label').value.trim();
    const start = document.getElementById('sb-start').value;
    const end = document.getElementById('sb-end').value;
    const days = readSelectedDays('sb-days');
    const flexible = document.getElementById('sb-flex').checked;
    if (!label || !days.length){ alert('Ponle un nombre y elige al menos un día.'); return; }
    state.profile.fixedBlocks.push({ id:Date.now()+'', label, start, end, days, flexible });
    document.getElementById('sb-label').value='';
    document.querySelectorAll('#sb-days .chip').forEach(c=>c.classList.remove('active'));
    saveState(); this.renderBlocks();
  },
  removeBlock(id){ state.profile.fixedBlocks = state.profile.fixedBlocks.filter(b=>b.id!==id); saveState(); this.renderBlocks(); },
  renderGoals(){
    document.getElementById('st-goals').innerHTML = state.profile.goals.map(g=>
      `<div class="mini-list-item"><span>${escapeHtml(g.text)} · ${g.timesPerWeek}x/semana</span>
      <button onclick="Settings.removeGoal('${g.id}')">✕</button></div>`).join('') || `<p class="subtitle">Sin objetivos todavía.</p>`;
  },
  addGoal(){
    const text = document.getElementById('sg-text').value.trim();
    const times = parseInt(document.getElementById('sg-times').value,10) || 1;
    if (!text) return;
    state.profile.goals.push({ id:Date.now()+'', text, timesPerWeek:times });
    state.tasks.push(makeHabitTask(text, times, /gimnasio|entren/i.test(text) ? 60 : 30));
    document.getElementById('sg-text').value='';
    saveState(); this.renderGoals();
  },
  removeGoal(id){ state.profile.goals = state.profile.goals.filter(g=>g.id!==id); saveState(); this.renderGoals(); },
  chooseAutonomy(v){
    state.profile.autonomy = v;
    document.querySelectorAll('#screen-settings .settings-section .choice-btn').forEach(b=>
      b.classList.toggle('selected', parseInt(b.dataset.val,10)===v));
  },
  save(){
    state.profile.name = document.getElementById('st-name').value.trim();
    state.profile.wake = document.getElementById('st-wake').value;
    state.profile.sleep = document.getElementById('st-sleep').value;
    state.profile.subjectsHard = document.getElementById('st-hard').value.trim();
    state.profile.subjectsEasy = document.getElementById('st-easy').value.trim();
    state.profile.procrastinate = document.getElementById('st-procrastinate').value.trim();
    saveState();
    document.getElementById('vaciar-greeting').textContent = state.profile.name ? `Vacía tu cabeza, ${state.profile.name}` : 'Vacía tu cabeza';
    alert('Ajustes guardados.');
  }
};

document.addEventListener('DOMContentLoaded', ()=>App.init());
