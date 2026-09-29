/* ==========================================================
   AIEngine — motor de interpretación y planificación.

   Hoy es un motor de reglas 100% local (sin servidor).
   Está aislado en este único objeto a propósito: el día que
   quieras enchufar una IA real (ej. API de Claude desde un
   backend), solo tienes que reescribir las funciones
   `interpret()` y `decide()` de aquí para que hagan un
   fetch a tu servidor en vez de aplicar reglas — el resto de
   la app (app.js) llama siempre a AIEngine.*, no le importa
   cómo decide por dentro.
   ========================================================== */

const IMPORTANT_WORDS = ['examen','entrega','cliente','proyecto','presentaci[oó]n','trabajo',
  'control','prueba','entrevista','pago','factura','impuestos','salud','m[eé]dico','mudarme'];
const LEISURE_WORDS = ['ver una serie','ver la serie','netflix','peli','película','jugar',
  'redes sociales','instagram','tiktok','quedar con','salir con','descansar','no hacer nada','videojuego'];
const HABIT_WORDS = ['sacar al perro','gimnasio','entrenar','journaling','diario','ordenar',
  'limpiar','hacer la cama','preparar mochila','meditar','leer antes de dormir'];
const DATE_WORDS = {
  'hoy': 0, 'mañana': 1, 'pasado mañana': 2
};
const WEEKDAYS = ['domingo','lunes','martes','miércoles','miercoles','jueves','viernes','sábado','sabado'];

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(name) {
  const idx = { domingo:0, lunes:1, martes:2, 'miércoles':3, miercoles:3, jueves:4, viernes:5, 'sábado':6, sabado:6 }[name];
  const d = new Date();
  const diff = (idx - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const AIEngine = {

  /* ---------- 1. Interpretar el brain dump ---------- */
  interpret(rawText, context) {
    const lines = rawText
      .split(/\n+/)
      .flatMap(l => l.split(/(?<=[a-záéíóúñ0-9])\.\s+(?=[A-ZÁÉÍÓÚÑ])/))
      .map(l => l.trim())
      .filter(Boolean);

    return lines.map(line => this.classify(line, context));
  },

  /* ---------- 2. Clasificar una línea individual ---------- */
  classify(text, context) {
    const lower = text.toLowerCase();

    // Fecha límite
    let deadline = null;
    for (const [word, offset] of Object.entries(DATE_WORDS)) {
      if (lower.includes(word)) deadline = todayStr(offset);
    }
    for (const day of WEEKDAYS) {
      if (lower.includes(day)) deadline = nextWeekday(day.replace('miercoles','miércoles').replace('sabado','sábado'));
    }
    const explicitDate = lower.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (explicitDate) {
      const y = new Date().getFullYear();
      deadline = `${y}-${explicitDate[2].padStart(2,'0')}-${explicitDate[1].padStart(2,'0')}`;
    }

    // Tipo
    const isExam = /examen|control|prueba/.test(lower);
    const isLeisure = LEISURE_WORDS.some(w => new RegExp(w).test(lower));
    const isHabit = HABIT_WORDS.some(w => new RegExp(w).test(lower));

    // Urgencia
    let urgency = 0;
    if (deadline) {
      const days = Math.ceil((new Date(deadline) - new Date(todayStr())) / 86400000);
      if (days <= 1) urgency += 3; else if (days <= 3) urgency += 2; else if (days <= 7) urgency += 1;
    }
    if (/urgente|ya|cuanto antes/.test(lower)) urgency += 2;
    if (isExam) urgency += 1;

    // Importancia
    let importance = 0;
    IMPORTANT_WORDS.forEach(w => { if (new RegExp(w).test(lower)) importance += 1; });
    if (isLeisure) importance -= 3;
    (context.subjectsHard || '').toLowerCase().split(/[,;]/).forEach(s => {
      s = s.trim(); if (s && lower.includes(s)) importance += 1;
    });
    (context.procrastinate || '').toLowerCase().split(/[,;]/).forEach(s => {
      s = s.trim(); if (s && lower.includes(s)) importance += 1;
    });

    let quadrant;
    if (isLeisure) quadrant = 'leisure';
    else if (isHabit) quadrant = 'habit';
    else if (urgency >= 2 && importance >= 1) quadrant = 'do';
    else if (urgency < 2 && importance >= 1) quadrant = 'plan';
    else if (urgency >= 2 && importance < 1) quadrant = 'delegate';
    else quadrant = 'eliminate';

    // División en pasos si es una tarea grande
    let subtasks = null;
    if (quadrant === 'do' || quadrant === 'plan') {
      const template = DECOMPOSE_TEMPLATES.find(t => t.match.test(lower));
      if (template) {
        subtasks = template.steps.map((s, i) => ({ id: `${Date.now()}${i}`, text: s, minutes: template.minutesEach, done: false }));
      }
    }

    const minutes = subtasks ? subtasks[0].minutes : this.estimateMinutes(lower);

    return {
      id: Date.now() + Math.random().toString(16).slice(2),
      text, quadrant, deadline, minutes,
      isExam, isHabit: quadrant === 'habit', isLeisure: quadrant === 'leisure',
      subtasks, activeStep: 0,
      completed: false, delegatedTo: null,
      needsInfo: isExam && !deadline
    };
  },

  estimateMinutes(lower) {
    const hints = [
      [/reuni[oó]n|llamada|entrevista/, 45],
      [/comprar|recado/, 30],
      [/email|correo|responder/, 10],
      [/leer|estudiar/, 40]
    ];
    for (const [re, m] of hints) if (re.test(lower)) return m;
    const words = lower.split(/\s+/).filter(Boolean).length;
    return Math.min(90, Math.max(15, words * 4));
  },

  /* ---------- 3. Construir el plan de un día concreto ---------- */
  buildDayPlan(dateStr, tasks, context) {
    const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=domingo
    const fixed = (context.fixedBlocks || [])
      .filter(b => b.days.includes(dow))
      .map(b => ({ start: toMin(b.start), end: toMin(b.end), label: b.label, type: 'fixed', flexible: b.flexible }))
      .sort((a, b) => a.start - b.start);

    const isToday = dateStr === todayStr();
    const now = new Date();
    const dayStart = Math.max(toMin(context.wake || '07:00'), isToday ? now.getHours() * 60 + now.getMinutes() : 0);
    const dayEnd = toMin(context.sleep || '23:00');

    // huecos libres entre bloques fijos
    const freeWindows = [];
    let cursor = dayStart;
    for (const b of fixed) {
      if (b.start > cursor) freeWindows.push([cursor, Math.min(b.start, dayEnd)]);
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < dayEnd) freeWindows.push([cursor, dayEnd]);

    const totalFree = freeWindows.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
    const reserveForLeisure = Math.round(totalFree * 0.25); // no llenar todo el hueco

    // candidatos: tareas pendientes para hoy (do/plan con deadline <= hoy+un margen, o sin deadline)
    const candidates = tasks
      .filter(t => !t.completed && (t.quadrant === 'do' || t.quadrant === 'plan'))
      .filter(t => !t.deadline || t.deadline >= dateStr)
      .sort((a, b) => {
        if (a.quadrant !== b.quadrant) return a.quadrant === 'do' ? -1 : 1;
        const da = a.deadline || '9999', db = b.deadline || '9999';
        return da.localeCompare(db);
      });

    // hábitos que tocan hoy, según los días que le tocan a cada uno según su frecuencia semanal
    const habitsToday = tasks.filter(t => t.quadrant === 'habit' && !t.completed &&
      Array.isArray(t.assignedDays) && t.assignedDays.includes(dow));

    const items = [];
    habitsToday.forEach(t => items.push({ id: t.id, label: t.text, minutes: Math.min(t.minutes, 30), kind: 'habit' }));
    candidates.forEach(t => {
      if (t.subtasks) {
        const step = t.subtasks.find(s => !s.done);
        if (step) items.push({ id: t.id, stepId: step.id, label: `${t.text} — ${step.text}`, minutes: step.minutes, kind: 'task' });
      } else {
        items.push({ id: t.id, label: t.text, minutes: t.minutes, kind: 'task' });
      }
    });

    // colocar items en los huecos libres, respetando el margen de ocio y metiendo descansos
    const blocks = fixed.map(b => ({ start: b.start, end: b.end, label: b.label, type: 'fixed' }));
    let usedForWork = 0;
    let itemIdx = 0;
    for (const [wStart, wEnd] of freeWindows) {
      let t = wStart;
      while (itemIdx < items.length && t < wEnd) {
        if (usedForWork + items[itemIdx].minutes > totalFree - reserveForLeisure) break;
        const it = items[itemIdx];
        const end = Math.min(t + it.minutes, wEnd);
        if (end - t < 5) break;
        blocks.push({ start: t, end, label: it.label, type: it.kind, taskId: it.id, stepId: it.stepId || null });
        usedForWork += end - t;
        t = end;
        itemIdx++;
        if (t < wEnd - 5 && itemIdx < items.length) {
          const breakEnd = Math.min(t + 10, wEnd);
          blocks.push({ start: t, end: breakEnd, label: 'Descanso', type: 'break' });
          t = breakEnd;
        }
      }
      if (wEnd - t >= 20) {
        blocks.push({ start: t, end: wEnd, label: 'Tiempo libre', type: 'leisure' });
      }
    }

    return blocks.sort((a, b) => a.start - b.start);
  },

  /* ---------- 4. Replanificar el resto del día ---------- */
  replan(dateStr, tasks, context) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const plan = this.buildDayPlan(dateStr, tasks, context).filter(b => b.end > nowMin);
    const pending = plan.filter(b => b.type === 'task' || b.type === 'habit');
    return { plan, priorityNow: pending.slice(0, 2) };
  }
};

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
function fromMin(mins) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
