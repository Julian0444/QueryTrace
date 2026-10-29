# QueryTrace: revisión independiente de UX, interfaz y tutorial

> Informe histórico sobre `2fb8d54`. Las correcciones y su validación se registran en [tutorial-implementation](../tutorial-implementation/README.md).

La preocupación del usuario está respaldada por problemas concretos. El tutorial explica conceptos correctos, pero su navegación no asegura que se vea el experimento; en móvil, la propia guía puede tapar la acción o la evidencia que señala. No encontré motivos para atribuirlo principalmente a colores o tipografía. Tampoco sería correcto concluir que todo el rediseño empeoró: varias dificultades de la revisión anterior están resueltas.

## Versión, independencia y método

- **Revisor actual:** Codex / GPT-6 Astra. No participó Claude ni se simuló una segunda revisión. Los informes anteriores de Astra y Opus son antecedentes, no revisores de esta ejecución.
- **Fecha:** 27 de octubre de 2026, America/Los_Angeles; las herramientas registran el 28 de octubre en UTC.
- **Checkout:** `/Users/jirustaroure/.codex/worktrees/querytrace-taste-redesign/QueryTrace`.
- **Rama real:** `codex/querytrace-taste-redesign`. **HEAD real:** `2fb8d5412f3c6b437bd02ffff5bf96ca7c865e35`. Ambos coinciden con lo solicitado. Árbol limpio al empezar.
- **Aplicación principal:** `http://localhost:8035/app/`. La primera pasada se hizo con T3 Preview en incógnito. Después se utilizó una pestaña nueva de Chrome/CUA en `http://127.0.0.1:8035/app/`, un origen distinto del de las pestañas personales existentes. No se utilizaron esas pestañas.
- Se registraron [primeras impresiones](first-impressions.md) y se recorrieron los seis pasos **antes de consultar código o informes previos**. La inspección posterior de código se identifica como corroboración, no como experiencia de uso.
- Después se leyeron los cuatro documentos solicitados y se inspeccionaron historial y capturas antiguas con `git show`/`git diff`, sin cambiar el checkout. Los tres assets principales servidos coinciden byte a byte con el checkout: [verificación](served-assets.json).
- Para el error del proveedor se arrancó **el servidor existente** `tests/browser/server.py` en `127.0.0.1:8041`, con sus copias temporales de corpus y proveedor determinista. No se editó el servidor. Se restablecieron sus controles y se detuvo al acabar. No se realizaron llamadas pagadas de generación ni uploads.
- Solo se guardaron informes, registros de observación y capturas en este directorio. No se cambiaron código, configuración, corpus ni permisos; no hubo commits, push, merge o deploy. Las consultas normales pueden dejar los registros de auditoría propios de la aplicación.

**Límite de la observación:** esta es una inspección experta por un solo modelo, no un estudio con personas nuevas. Se distingue lo observado de la inferencia sobre su efecto en la comprensión. No se usa el resultado de tests como prueba de que el tutorial se entiende.

## Primer contacto y recorrido observado

Inicialmente interpreté QueryTrace como una búsqueda sobre documentos financieros con permisos. **Start tour** era la primera acción clara. No sabía todavía si **Retrieve evidence**, **Generate answer** y **Compare** eran pasos consecutivos o caminos alternativos. Esperaba que la guía cargara una pregunta y mostrara qué cambiaba al aplicar permisos. El vocabulario de políticas y las siglas del escenario requerían contexto previo.

| Paso | Lo que hice siguiendo la interfaz | Lo que ocurrió y pude entender |
| --- | --- | --- |
| 1. Workspace | Start tour → Explore this workspace’s documents → Next | Abrió Documents y mostró documentos reales del corpus ficticio. Next no cambia automáticamente de vista. |
| 2. Identidad | Leí los tres roles y sus recuentos; continué como invitado | Es posible continuar sin iniciar sesión. La distinción rol/administrador es correcta, pero llega antes del ejemplo que la hace necesaria. |
| 3. Recuperación | Primero probé Next sin cargar ni ejecutar; volví con Back; Load example into Query → Retrieve evidence | Next permitió omitir la tarea. Por el camino completo, la pregunta quedó enfocada y la recuperación produjo **6 documentos, 8 fragmentos, 2013 tokens estimados**. La guía siguió pidiendo recuperar evidencia. |
| 4. Comparación | Run policy comparison; bajé a los resultados | La conclusión fue clara: **Top-k incluye dos documentos inaccesibles a Analyst; Full Policy los bloquea**. La tabla compacta y los nombres de ambos modelos financieros hacen tangible el propósito. |
| 5. Traza | Open Full Policy decision trace | Abrió la traza correcta. En escritorio el panel de guía quedó fuera de pantalla; en móvil la guía tapó el destino. Las razones de la tabla requieren además desplazamiento horizontal. |
| 6. Cierre | Leí la explicación; Return to Query → Finish | Explica generación y posible coste; también introduce Upload, Audit y Evaluations. No resume el resultado concreto del ejemplo ni verifica que se haya observado. No pulsé Generate answer en el servidor principal. |

Al finalizar pude explicar que QueryTrace permite **inspeccionar qué fragmentos llegarían al modelo y por qué, comparando relevancia, permisos, versiones y presupuesto**. La comparación concreta fue lo que hizo comprensible esa idea. La guía por sí sola podía terminar sin haberla mostrado.

## Hallazgos

Prioridades: **P1**, afecta al recorrido central de demostración; **P2**, fricción importante de comprensión, con alternativa disponible. No se identificó un P0. Todos los hallazgos siguientes fueron observados por el revisor actual en `2fb8d54`; su impacto en usuarios es un juicio de UX, no un resultado de estudio de usuarios.

### TR-01 · P1 · La guía móvil tapa el control o la evidencia que pide utilizar

**Tipo:** bug funcional, con impacto de accesibilidad. **Estado:** reproducido.

**Pantalla, rol y condiciones:** paso 3, Nimbus, Guest Employee, tema claro, **375 × 667**; y paso 5, Atlas, Guest Analyst, tema oscuro, **390 × 844**. Son viewports CSS medidos, no teléfonos físicos.

**Reproducción:**

1. A 375 × 667, abrir Guide, avanzar al paso 3 y pulsar **Load example into Query**.
2. Buscar **Retrieve evidence**, tal como pide la nota. Desde el campo enfocado, pulsar Tab.
3. En una segunda variante a 390 × 844, recuperar y comparar Permission Wall; en el paso 5 pulsar **Open Full Policy decision trace**.

**Observado:** en la primera variante, Retrieve evidence ocupa `y=309–352`, pero el panel fijo empieza en `y=291`. El centro del botón recibe al panel de guía, no al botón. Tab enfoca `submit-btn` y el foco continúa oculto, con `scrollY=0`. En la segunda, la traza se abre y recibe foco en `y=435–505`, debajo de un panel que empieza en `y=404`. Un desplazamiento manual adicional permite acceder a parte del contenido; no es un bloqueo irreversible.

**Expectativa razonable:** cuando la guía carga un ejemplo o abre su objetivo, este debe quedar visible y utilizable; el foco de teclado debe ser perceptible.

**Efecto en la comprensión:** parece que falta el botón o que abrir la traza no hizo nada. El usuario debe resolver la geometría de la guía antes de entender QueryTrace.

**Evidencia:** [botón tapado](captures/31-mobile-375-light-retrieve-covered.jpg), [foco oculto](captures/32-mobile-keyboard-focus-obscured.jpg), [traza tapada](captures/23-mobile-dark-trace-target.jpg), [recuperación mediante scroll](captures/24-mobile-trace-after-manual-scroll.jpg), [medidas DOM](observations.json).

**Recomendación mínima:** reservar una zona realmente libre para el objetivo al enfocar/desplazarlo, o plegar temporalmente el panel tras ejecutar su acción. Evitar que el panel y el objetivo necesiten el mismo espacio. Verificar ambas alturas de móvil y el foco por Tab.

**Relación histórica:** Opus ya documentó una superposición del paso 3 en `9753087`, a 375 px de ancho. Aquí se reproduce de nuevo con los controles actuales y otra altura, y se añade el destino del paso 5. No se presenta como una regresión recién introducida por `2fb8d54`.

### TR-02 · P1 · «Next» completa una secuencia de pantallas, no una demostración realizada

**Tipo:** comprensión. **Estado:** reproducido.

**Pantalla, rol y condiciones:** guía de seis pasos, invitado Analyst en Atlas; escritorio claro y móvil. Camino de omisión completo comprobado además en el servidor aislado, con el mismo frontend.

**Reproducción:**

1. Con la pregunta vacía, Start tour → Next cinco veces → Finish.
2. En otra pasada, realizar el paso 3: Load example into Query → Retrieve evidence.
3. Comparar la guía antes y después del resultado y abrir la traza del paso 5.

**Observado:** el primer camino termina sin pregunta, sin recuperación, sin comparación y sin traza. En la aplicación principal ya había comprobado que el paso 3 se salta estando todavía en Documents. Next tiene mayor peso visual que la acción de demostración. Tras recuperar, sigue visible **“Example loaded. Press Retrieve evidence…”**. En el paso 4 coexisten **Run policy comparison**, **Compare policies** y **Next**. En escritorio, abrir la traza desplaza fuera de pantalla las instrucciones y los botones de avance. Reabrir Guide vuelve al paso 1; Restart guide también existe allí.

**Expectativa razonable:** distinguir entre leer una explicación, realizar una acción y comprobar su resultado. Si se permite omitir, explicitarlo; no convertir el avance de páginas en una señal implícita de aprendizaje completado.

**Efecto en la comprensión:** se puede creer que Next ejecuta o confirma lo solicitado, y terminar sin ver la diferencia que la aplicación demuestra. Quien sí ejecuta obtiene poca confirmación dentro de la guía.

**Evidencia:** [paso 4 sin recuperación](captures/05-step4-without-retrieval.png), [guía inalterada tras recuperar](captures/07-retrieved-guide-unchanged.png), [paso 6 sin ejecución](captures/33-tutorial-step6-without-execution.jpg), [registro de omisión completo](captures/tutorial-bypass.json). Corroboración posterior: `frontend/app.js:2317` avanza el índice del paso sin comprobar la tarea.

**Recomendación mínima:** dar prioridad a una acción concreta por paso y actualizar el panel con el resultado observado. Por ejemplo: “Recuperados 8 fragmentos; ahora compara qué documentos bloquea la política”. Mantener una salida explícita y, si se desea, una opción discreta de continuar sin probar. Retirar Restart del paso inicial y hacer explícita la semántica de reabrir/reiniciar.

### TR-03 · P2 · La traza oculta inicialmente la explicación detrás de una columna de identificadores

**Tipo:** comprensión. **Estado:** reproducido.

**Pantalla, rol y condiciones:** Compare, Full Policy; Atlas/Analyst y Nimbus/Manager, escritorio **1440 × 900**; también observado en móvil **390 × 844**.

**Reproducción:** ejecutar una comparación, abrir la traza Full Policy y tratar de seguir la instrucción **“Read the reason beside each outcome”** sin desplazar horizontalmente la tabla.

**Observado:** dentro de la columna de política se ven primero el título del documento y `doc_id / chunk_id`. **Reason and annotations** queda a la derecha, fuera del área visible; en ocasiones también parte de Final outcome. En Nimbus, la región tiene **417 px útiles para 680 px de contenido**. Es posible enfocarla con Tab y desplazarla con flechas: cinco pulsaciones terminaron en `scrollLeft=200`. El contenido existe y es accesible. **La página ya no se ensancha:** `scrollWidth=1440` con viewport de 1440, también comprobado en Atlas.

**Expectativa razonable:** al abrir una explicación de decisiones, ver primero el resultado y su razón, conservando suficiente identidad del documento.

**Efecto en la comprensión:** la parte principal de la enseñanza parece una tabla técnica de referencias. La instrucción no anticipa que hay que buscar la razón fuera del área visible.

**Evidencia:** [traza estrecha](captures/28-desktop-dark-expanded-trace.jpg), [razones tras scroll de teclado](captures/30-trace-reasons-visible.jpg), [Atlas sin desbordamiento global](captures/40-atlas-expanded-comparison-light.jpg), [medidas](observations.json).

**Recomendación mínima:** priorizar documento → resultado → razón y relegar el identificador de fragmento al detalle; otra opción acotada es abrir la decisión seleccionada a mayor ancho. No volver a introducir el desbordamiento global ya corregido.

### TR-04 · P2 · La instrucción de refresco nombra un botón que ya no existe

**Tipo:** comprensión; inconsistencia de texto. **Estado:** reproducido.

**Pantalla, rol y condiciones:** Query, Guest Analyst en Atlas, tema claro, **1440 × 900**; también apareció al reabrir la guía sobre un borrador modificado.

**Reproducción:** recuperar evidencia para una pregunta, editar su texto sin volver a ejecutar y leer el aviso sobre los resultados anteriores.

**Observado:** **“Controls changed — press Run to refresh these results.”** Los controles disponibles son Retrieve evidence y Generate answer. No existe un botón Run. El resultado anterior sí conserva su pregunta ejecutada y muestra un estado desactualizado; no se observó una atribución silenciosa del resultado a la pregunta nueva.

**Expectativa razonable:** indicar el nombre exacto de la acción que actualiza ese resultado, sin hacer deducir si se refiere a recuperar o generar.

**Efecto en la comprensión:** reintroduce la ambigüedad que los nuevos nombres de acciones intentaban resolver, precisamente cuando el usuario experimenta con su propia pregunta.

**Evidencia:** [aviso y botones reales](captures/37-stale-results-press-run.jpg). Corroboración posterior: `frontend/app.js:133` mantiene el texto Run.

**Recomendación mínima:** nombrar la acción correspondiente al resultado mostrado. Mantener la pregunta ejecutada y la advertencia de desactualización, que sí ayudan.

### TR-05 · P2 · El propósito aparece tarde; la entrada enseña controles antes de plantear el experimento

**Tipo:** comprensión, no preferencia visual. **Estado:** reproducido como observación de interfaz; el efecto sobre otras personas es una hipótesis de UX.

**Pantalla, rol y condiciones:** bienvenida, pantalla inicial y pasos 1–2; Atlas/Guest Analyst, escritorio **1440 × 900**, tema claro.

**Reproducción:** abrir la aplicación, leer la bienvenida y el formulario; iniciar el tour y llegar hasta antes de cargar la primera pregunta.

**Observado:** la bienvenida dice **“Follow the evidence”**; la pantalla persistente encabeza **“Your question”**. La guía empieza con workspace y después detalla tres roles, cantidades de documentos, cuentas públicas y diferencia entre administrador y rol. La primera pregunta concreta llega en el paso 3. La distinción funcional entre recuperación y generación está mejor nombrada que antes, pero la idea “qué información puede llegar al modelo y por qué” requiere abrir la guía o interpretar escenarios y políticas. Los escenarios sí explican su intención; no es una ausencia total de explicación.

**Expectativa razonable:** entender el problema y el resultado que se va a observar antes de estudiar todos los controles. Un escenario de permisos puede explicar el rol en el momento en que un documento se bloquea.

**Efecto en la comprensión:** la app puede parecer un buscador financiero con opciones técnicas. El momento convincente —dos documentos incluidos sin permisos y bloqueados por Full Policy— queda varios pasos después.

**Evidencia:** [pantalla actual](captures/36-current-landing-light.jpg), [primeras impresiones previas a los informes](first-impressions.md), [paso 2 actual](captures/03-desktop-step2.png), [pantalla histórica con propósito explícito](../madethis-style/after/guide-1440-light.png).

**Recomendación mínima:** recuperar una frase breve de propósito junto a la pregunta y empezar el recorrido con Permission Wall como invitado. Introducir rol, workspace y cuenta autenticada cuando expliquen un resultado; no restaurar todos los controles o párrafos antiguos.

## Qué cambió realmente respecto de las referencias

No sabemos qué versión prefería el usuario. Las dos referencias se inspeccionaron como documentos históricos, **no se ejecutaron** en otro checkout.

| Referencia | Evidencia concreta | Interpretación acotada |
| --- | --- | --- |
| `e9ca89f`, 9 de octubre | [Captura de la guía](../madethis-style/after/guide-1440-light.png). Incluye “Context Policy Lab”, una frase persistente sobre qué documentos puede usar una consulta y por qué, explicación del rol y de la política. También tiene más controles y Skip tour. | Había más apoyo para entender el propósito, pero también más densidad. No permite concluir que toda la versión fuese más usable. |
| `9753087`, 25 de octubre | [Paso 3](../independent-ui-review/opus/32-guide-step3-1440.png), [móvil](../independent-ui-review/opus/80-mobile-375-guide-step3.png), diff de index.html y styles.css. Se retiran la introducción persistente y explicaciones visibles; se cambia el tratamiento gráfico. | El contenido de `renderTour()` es **idéntico** al de `e9ca89f`, comprobado por hash. No hubo sustitución completa de la secuencia del tutorial entre esas referencias. Cambió especialmente su contexto de interfaz. |
| `2fb8d54`, actual | [Pantalla actual](captures/36-current-landing-light.jpg), [cuenta restringida](captures/25-restricted-analyst-dark.jpg), [fragmentos](captures/27-comparison-selected-fragments.jpg). Renombra acciones, reúne escenarios, mueve herramientas, elimina Skip tour y corrige fallos. | Mantiene los seis pasos. Reduce controles respecto de `9753087`, pero conserva el avance independiente de la tarea y el panel móvil que puede tapar objetivos. |

[Verificación de hashes y títulos del tutorial](history-verification.json). La inferencia más defendible es que se redujo texto de orientación útil mientras se conservó una guía con varias acciones competidoras. No está demostrada una preferencia general por el diseño antiguo ni se recomienda revertirlo.

## Contraste con las revisiones anteriores

Se consultaron [síntesis anterior](../independent-ui-review/README.md), [Opus](../independent-ui-review/opus/report.md), [Astra](../independent-ui-review/astra/report.md) y [remediación](../ui-remediation/README.md) después de las primeras impresiones y del recorrido inicial.

| Problema histórico y observador | Comprobación actual en `2fb8d54` |
| --- | --- |
| B1: la traza desborda toda la página; Opus y coordinador | **No reproducido.** Atlas y Nimbus a 1440: el documento sigue midiendo 1440; scroll local y columnas independientes. Persiste la fricción de lectura TR-03, que es distinta. |
| B2: Try again cambia Ask por recuperación; Astra, Opus y coordinador | **No reproducido.** Proveedor determinista: una llamada fallida; tras restablecerlo, Try again produce Model-generated answer y una llamada nueva. [Error](captures/34-deterministic-provider-error.jpg), [recuperación](captures/35-provider-retry-generates-answer.jpg), [conteos](captures/provider-check.json). |
| B3: falso Running al regresar de un escenario; Opus y coordinador | **No reproducido.** Versions and freshness termina su comparación como Partner; volver a Query muestra “Scenario loaded. Retrieve evidence…”. [Captura](captures/39-scenario-return-ready.jpg). |
| Entrada con ejemplos y escenarios duplicados; Astra y Opus | **Corregido en lo observado.** Un selector persistente, una acción por escenario y preguntas visibles. El problema de orientación restante es TR-05, no la antigua duplicación. |
| Cuenta restringida llena de controles deshabilitados; Astra y Opus | **No reproducido para Julia/Analyst.** Solo Query/Documents, rol fijo y un escenario compatible. El paso 4 ofrece Inspect my document access y explica la limitación. [Guía restringida](captures/26-restricted-guide-step4.jpg). |
| Compare sin lector ni contexto de política; Astra y Opus | **Corregido en lo probado.** Read selected fragments expone el texto incluido, identifica su política y tiene región desplazable por teclado; las cabeceras de política permanecen visibles al bajar. |
| Superposición móvil de la guía; Opus | **Reproducido** en las condiciones de TR-01. La observación anterior de Astra sobre navegación accesible no equivalía a probar cada acción integrada. |
| Previews cortados y poca evidencia sustantiva; Opus | **Persiste de forma acotada.** En el 10-K el preview acaba en “real-t”; Read source permite leer ARR 34,2 % y NRR 118 %. No se considera contenido perdido. [Fuente expandida](captures/38-query-source-expanded.jpg). |
| Pregunta vacía sin respuesta; Opus | **No reproducido.** Retrieve evidence enfoca el campo requerido y muestra validación nativa “Completa este campo”. |
| Recuperación de Evaluations, uploads, estados privados/vacíos y matriz de errores; informes anteriores | **No comprobado en esta revisión.** No se trasladan sus conclusiones como hallazgos actuales. |

La permanencia de una fuente superseded no se contó como bug: la interfaz explica que freshness penaliza y puede cambiar prioridad sin garantizar exclusión. Tampoco se contó la exposición de la línea base de invitado como fallo de seguridad. La cuenta autenticada comprobada mostró 6/16 documentos y una traza con títulos restringidos ocultos; esto no constituye una auditoría de seguridad completa.

## Cierre

### 1. Los cinco problemas más importantes

1. **TR-01, P1:** la guía tapa objetivos y foco en móvil.
2. **TR-02, P1:** se puede terminar sin realizar el experimento; falta confirmación de lo ejecutado.
3. **TR-05, P2:** el propósito y la pregunta concreta llegan después de explicar controles.
4. **TR-03, P2:** la razón de la decisión queda fuera de la vista inicial de la traza.
5. **TR-04, P2:** “press Run” no corresponde a los nombres actuales.

### 2. Qué funciona bien y conviene conservar

La comparación que nombra los dos documentos bloqueados, el resumen de resultados por política, la separación explícita entre recuperar y generar, los lectores de fuentes y fragmentos, y la distinción entre bloqueo, presupuesto y penalización. También funcionan la simplificación de cuentas restringidas, las cabeceras de política, el aviso de resultado desactualizado y la restauración del borrador/rol/resultado anterior al salir de una guía que cargó otro ejemplo. En escritorio, Tab/Enter, Escape y Skip to query funcionaron en las rutas probadas. Los temas claro y oscuro mantienen una presentación coherente; no se propone cambiar su estética como solución a los problemas del recorrido.

### 3. Qué combinar, mover o eliminar

| Control o explicación | Cambio mínimo propuesto y motivo |
| --- | --- |
| Load example + instrucción de Retrieve + Next | Unificar la progresión en una acción de ejemplo y una confirmación visible; evitar que tres controles parezcan resolver la misma tarea. |
| Run policy comparison y Compare policies | Usar un único nombre y punto de ejecución durante ese paso. El siguiente avance debe señalar qué cambió. |
| Workspace, cuentas y administrador en los pasos 1–2 | Mover la explicación extensa después del primer contraste de permisos; mantener los controles disponibles. |
| Restart en el paso 1 y reapertura siempre desde el inicio | Quitar la redundancia inicial y distinguir reanudar de reiniciar. Mantener Exit y Back. |
| IDs técnicos en la tabla de decisiones | Moverlos al detalle para que resultado y razón sean visibles primero. |
| Generate answer, Upload, Audit y Evaluations en el cierre | Conservar generación como opción explícita después de entender la evidencia; dejar las herramientas secundarias en Tools y resumirlas fuera del hilo principal del tutorial. |
| Frase de propósito | Recuperar una frase breve junto a la pregunta. No reinstalar todas las explicaciones ni los launchers antiguos. |

### 4. Recorrido de tutorial propuesto

**Una pregunta concreta → recuperar evidencia → comparar la misma pregunta y rol → abrir una decisión y su fragmento → probar una variación propia.**

Empezar como invitado con Permission Wall y explicar qué se va a observar. Tras recuperar, mostrar los recuentos reales. Comparar y señalar los dos documentos que cambian por permisos. Abrir uno y leer su razón, sin taparlo; usar otro ejemplo breve para explicar que penalizar una versión no equivale a eliminarla. Cerrar con una frase sobre lo aprendido y la invitación a cambiar rol o pregunta; generar una respuesta y entrar con una cuenta quedan como continuaciones opcionales. [Diagrama del recorrido propuesto](proposed-tour.html). No se ha implementado.

### 5. Cobertura real y pendientes

| Área | Probado | Pendiente / límite |
| --- | --- | --- |
| Tutorial | Seis pasos en escritorio y móvil; camino con acciones; omisión completa; Back, Exit, Guide, Restart, Finish; recarga después de terminar. | No todas las combinaciones de rol, vista y paso. |
| Escenarios y preguntas | Atlas Permission Wall, Versions and freshness; Nimbus Stale Runbook; preguntas propias sobre ARR y failover; Retrieve y Compare. | Financial model access y Roadmap Drift no se ejecutaron como tarjetas. |
| Roles y políticas | Invitados Analyst, Employee, Manager; Partner mediante escenario; Full Policy, Permissions Only y Top-k; cambios de rol/política y workspace. | VP y matriz exhaustiva de políticas/roles no probados. |
| Identidad | Tarjeta pública Julia/Analyst, escenario compatible, Documents 6/16, traza con títulos ocultos; cambio de workspace pasa a invitado. | Otras cinco identidades, botón Sign out aislado, errores de login y prueba de penetración no comprobados. |
| Evidencia | Traza Query/Compare; fuente 10-K; fragmentos del runbook; desplazamiento de tabla con teclado. | Exportación JSON, exhaustividad de corpus y calidad de ranking no auditadas. |
| Borradores/resultados | Abrir guía con ambos; cargar ejemplo que cambia pregunta y rol; salir y recuperar pregunta, rol y resultado previos; avisos por edición. | Cierre del navegador con borrador, carreras de peticiones y cambios de corpus durante la guía no probados. |
| Generación | Solo error y recuperación con proveedor determinista de pruebas; dos llamadas ficticias en total. | Ninguna generación real, evaluación de calidad de respuesta ni prueba de todas las citas. |
| Responsive y temas | **1440 × 900** claro/oscuro; **390 × 844** claro/oscuro; **375 × 667** claro. Omisión completa también a **1728 × 850**, tamaño inicial real de la pestaña de pruebas. | Sin dispositivo físico, teclado virtual, tablet, Safari/Firefox, zoom 200 %, lector de pantalla ni auditoría de contraste. |
| Teclado | Tab por guía/formulario, activación por Enter, Escape devuelve foco a Guide, Skip to query, tabla con flechas; foco oculto móvil reproducido. | Sin recorrido exhaustivo de toda la aplicación. |
| Herramientas secundarias | Inspección de su posición/explicaciones. | Uploads, Audit y Evaluations no ejercitados en esta revisión. |

Las capturas iniciales de T3 se exportaron a **1280 × 800** aunque el viewport CSS medido era **1440 × 900**; están identificadas como `01`–`11`. Dos snapshots móviles de T3 fallaron por timeout, por lo que esas observaciones visuales se repitieron con Chrome/CUA. Las capturas `20`–`40` provienen de CUA. La compresión/raster de una captura no se usó como prueba de tamaño, desenfoque del producto ni defecto de tipografía. [Registro de procedencia](captures/desktop-capture-provenance.json).

No se ejecutó la suite de producto, porque esta entrega no cambia su implementación. Se comprobó la integridad de los artefactos y el estado final del repositorio. Las pestañas creadas y el servidor de pruebas se cerraron; el servidor principal se dejó en ejecución.

### 6. Desacuerdos entre revisores

No hay desacuerdos entre revisores actuales: solo participó Codex. La lectura posterior de los informes de Astra y Opus se usa para distinguir problemas corregidos de problemas reproducidos; no constituye una síntesis de dos revisiones nuevas. La afirmación histórica de que la navegación móvil era accesible tenía una cobertura distinta de las acciones concretas que ahora quedan tapadas. No permite descartar TR-01 ni afirmar que todo el tutorial móvil falle.
