# Primeras impresiones — registradas antes de leer código o revisiones

- Revisor: Codex / GPT-6 Astra; revisión individual, sin Claude.
- Versión comprobada: rama codex/querytrace-taste-redesign; HEAD 2fb8d5412f3c6b437bd02ffff5bf96ca7c865e35; árbol limpio.
- URL: http://localhost:8035/app/; perfil incógnito nuevo.
- Viewport CSS comprobado con innerWidth/innerHeight: 1440 × 900, DPR 1. La herramienta entrega capturas raster a 1280 × 800; no confundir con el viewport.
- Creo que sirve para hacer preguntas a documentos financieros y estudiar cómo los permisos cambian la evidencia. Aún no entiendo la relación entre recuperación, generación y comparación.
- Primera acción aparente: Start tour, claramente enfocada en el diálogo de bienvenida.
- Espero que Start tour me lleve a una pregunta concreta y que cada paso indique qué pulsar y qué observar.
- Retrieve evidence parece buscar fragmentos; Generate answer parece responder usando esos fragmentos, pero la pantalla no aclara si son acciones consecutivas o alternativas.
- Compare aparece en la navegación y en cada escenario. Espero que una tarjeta cargue su pregunta y abra una comparación; todavía no sé si ejecuta automáticamente.
- Top-k, Full policy, ARR, NRR, IC y LP asumen vocabulario previo. El saludo menciona evidencia, permisos y traza, pero no formula el problema que demuestra la aplicación.
- Preferencia visual provisional: composición sobria y acción inicial visible; esto no demuestra todavía la calidad del recorrido.

## Recorrido de los seis pasos, todavía sin consultar código ni informes

1. Start tour abre un panel integrado sobre la aplicación. Explore this workspace’s documents cambia a Documents; Next avanza. La introducción explica selección de contexto, pero precede a cualquier ejemplo concreto.
2. Identity and document permissions presenta Analyst 6/16, VP 12/16, Partner 16/16, cuentas públicas y diferencia administrador/rol. No inicié sesión en esta primera pasada; Next lo permite.
3. Retrieve your first context recomienda Permission Wall. Probé Next sin cargar ni recuperar: permitió llegar al paso 4, permaneciendo en Documents. Volví con Back, pulsé Load example into Query y apareció una instrucción adicional para pulsar Retrieve evidence. La pregunta se cargó y quedó enfocada. Ejecuté únicamente Retrieve evidence.
4. La recuperación produjo 6 documentos, 8 fragmentos, 2013 tokens estimados, 10 documentos bloqueados. La guía seguía diciendo que pulsara Retrieve evidence; no apareció confirmación de esa tarea en el panel. Run policy comparison ejecutó correctamente la comparación. Había que bajar para ver la conclusión: Top-k incluye 2 documentos inaccesibles a Analyst; Full Policy los bloquea. Las tres columnas y el resumen ayudan a entender el propósito.
5. Open Full Policy decision trace abrió la traza correcta y desplazó la página hasta ella. La explicación del tutorial quedó fuera de pantalla. La tabla se ve estrecha dentro de la tercera columna; las razones están a la derecha. El texto diferencia bloqueo, exclusión por presupuesto y penalización por antigüedad.
6. El cierre explica generación, citas, uploads, audit y evaluations. Indica expresamente posible coste del proveedor. No pulsé Generate answer. No hay comprobación de lo aprendido ni resumen ligado a los dos documentos bloqueados del ejemplo.

Lo que puedo explicar al terminar: QueryTrace permite inspeccionar qué fragmentos llegarían al modelo, comparar selección sin controles con políticas de permisos/presupuesto/frescura y rastrear por qué se incluye o excluye cada fragmento. La evidencia más clara fue el resumen de la comparación, no la introducción.
