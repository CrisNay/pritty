/* ==========================================================
   Contenido estático (no requiere IA real):
   - Tarjetas de Inspiración, con categoría
   - Plantillas para dividir tareas grandes en pasos
   ========================================================== */

const INSPO_CARDS = [
  { id:'i1',  cat:'empezar',    text:'No necesitas tener ganas. Solo necesitas empezar por el siguiente paso.' },
  { id:'i2',  cat:'empezar',    text:'La tarea da miedo entera. En trozos de 10 minutos, no tanto.' },
  { id:'i3',  cat:'empezar',    text:'No hace falta motivación para abrir el cuaderno. Solo ábrelo.' },
  { id:'i4',  cat:'estudiar',   text:'Repasar 15 minutos hoy vale más que repasar 3 horas la noche antes.' },
  { id:'i5',  cat:'estudiar',   text:'Entender algo despacio hoy es ir rápido mañana.' },
  { id:'i6',  cat:'estudiar',   text:'Un resumen a mano vale más que diez relecturas.' },
  { id:'i7',  cat:'dificiles',  text:'Un día difícil no borra los días en que sí cumpliste.' },
  { id:'i8',  cat:'dificiles',  text:'No tienes que hacerlo todo hoy. Solo lo siguiente.' },
  { id:'i9',  cat:'dificiles',  text:'Está bien que hoy sea un día de mínimos. Mínimos también cuenta.' },
  { id:'i10', cat:'volver',     text:'Mira lo que pasa cuando dejas de esperar el momento perfecto.' },
  { id:'i11', cat:'volver',     text:'No pasa nada por parar unos días. Lo raro sería no volver nunca.' },
  { id:'i12', cat:'volver',     text:'Empezar de nuevo no es fracasar. Es lo que hace la gente que sigue.' },
  { id:'i13', cat:'objetivos',  text:'Recuerda por qué empezaste esto cuando parecía buena idea.' },
  { id:'i14', cat:'objetivos',  text:'Tu objetivo no necesita que hoy sea perfecto. Necesita que hoy aparezcas.' },
  { id:'i15', cat:'progreso',   text:'Llevas más días cumpliendo de los que crees. Mira atrás un momento.' },
  { id:'i16', cat:'progreso',   text:'Cada vez que tachas algo, tu cabeza confía un poco más en el plan.' },
  { id:'i17', cat:'progreso',   text:'Esto ya no es la primera vez que lo consigues. Es una racha.' }
];

const INSPO_CATEGORY_LABELS = {
  empezar:   'Para empezar',
  estudiar:  'Para estudiar',
  dificiles: 'Para días difíciles',
  volver:    'Para volver después de parar',
  objetivos: 'Para recordar tus objetivos',
  progreso:  'Para reconocer tu progreso'
};

/* Plantillas de descomposición: si el texto de la tarea coincide con el patrón,
   se generan estos pasos. {first: índice del paso que se propone para "hoy"} */
const DECOMPOSE_TEMPLATES = [
  {
    match: /estudiar|examen|prueba|control/,
    steps: ['Revisar apuntes', 'Leer el tema', 'Hacer un resumen', 'Estudiar los conceptos', 'Hacer práctica', 'Repasar'],
    minutesEach: 30
  },
  {
    match: /redact|texto argumentativo|comentario|ensayo|escribir sobre/,
    steps: ['Buscar y ordenar ideas', 'Hacer un esquema', 'Escribir un borrador', 'Revisar y corregir'],
    minutesEach: 30
  },
  {
    match: /glosario|vocabulario|fichas/,
    steps: ['Reunir las palabras/términos', 'Buscar definiciones', 'Pasarlo a limpio'],
    minutesEach: 20
  },
  {
    match: /proyecto|trabajo (?:de|para)|presentaci[oó]n/,
    steps: ['Definir qué hay que entregar', 'Reunir el material', 'Hacer un borrador', 'Revisar y pulir'],
    minutesEach: 35
  }
];
