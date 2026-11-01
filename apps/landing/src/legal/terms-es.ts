import type { Documento } from './documento';

/**
 * Los Terminos y Condiciones en espanol. TRADUCCION DE CORTESIA: manda la
 * inglesa, y el propio documento lo dice en su penultima seccion.
 *
 * ESTE ARCHIVO ES EL ORIGINAL. No hay copia en Markdown: lo que el cliente
 * acepta es lo que esta pagina ensena, asi que esta pagina es el documento.
 * Ver `apps/landing/src/legal/documento.ts`.
 *
 * AL CAMBIAR EL FONDO HAY QUE SUBIR LA VERSION en
 * `packages/types/src/legal.ts`. Si se edita sin subirla, lo guardado en cada
 * reserva apunta a un texto que ya no es el que esa persona acepto.
 */
export const TERMS_ES: Documento = {
  titulo: 'Términos y Condiciones',
  bloques: [
    {
      t: 'h2',
      texto: '1. Qué es esto y cómo lo acepta',
    },
    {
      t: 'p',
      texto:
        'Estos Términos son el acuerdo entre usted y {{company}}, que opera como Freshness Touch («nosotros»), cuando reserva una limpieza a través de nuestro sitio web.',
    },
    {
      t: 'p',
      texto:
        'Al reservar, marca una casilla confirmando que ha leído y acepta estos Términos y nuestra Política de Privacidad. **Esa marca es lo que forma el acuerdo.** Registramos qué versión aceptó y cuándo, y le mandaremos esa versión exacta si la pide.',
    },
    {
      t: 'p',
      texto:
        'Debe tener al menos 18 años y capacidad legal para contratar. Debe además ser el propietario de la vivienda que vamos a limpiar o contar con el permiso del propietario para que estemos allí y hagamos el trabajo.',
    },
    {
      t: 'h2',
      texto: '2. El precio que le damos',
    },
    {
      t: 'p',
      texto:
        '**El precio que muestra nuestra calculadora es un presupuesto, no una factura.** Se calcula con lo que usted nos dice: el tipo de servicio, la frecuencia, el número de habitaciones y baños, los pies cuadrados, los extras que elija y lo lejos que está su casa de nuestra base.',
    },
    {
      t: 'ul',
      items: [
        'Un presupuesto **vale 7 días**. Pasados, los precios pueden haber cambiado.',
        '**Los servicios de limpieza están exentos del impuesto sobre ventas de Georgia** (O.C.G.A. §§ 48-8-2(31) y 48-8-30(f)(1)), así que el precio que ve es el que paga. No se añade impuesto.',
        'Algunas casas son demasiado grandes, demasiado lejanas o demasiado particulares para un precio automático. En esos casos se lo decimos y le damos un presupuesto a mano.',
        '**Si lo que encontramos no coincide con lo que nos dijo** —bastantes más pies cuadrados, una vivienda que no se ha limpiado en mucho tiempo, polvo de obra, condiciones de acumulación— pararemos, le diremos qué requiere de verdad y cuánto costaría, y **esperaremos a que usted lo apruebe antes de hacer trabajo adicional**. No le sorprenderemos con una factura mayor.',
      ],
    },
    {
      t: 'h2',
      texto: '3. El depósito de traslado',
    },
    {
      t: 'p',
      texto:
        'Al reservar, retenemos **35,00 USD** en su tarjeta. Una retención no es un cobro: el banco reserva el dinero, pero no sale de su cuenta.',
    },
    {
      t: 'ul',
      items: [
        'Se **acredita íntegro contra su factura final**. No es un coste añadido.',
        'Si cancela a tiempo (sección 5), se **libera**. Según su banco, puede tardar unos días laborables en desaparecer del extracto.',
        'Una retención **caduca sola a los 7 días como máximo**, que es lo máximo que permiten las redes de tarjetas. Si caduca, el dinero vuelve a usted sin que nadie tenga que hacer nada.',
        '**Solo la cobramos en una situación: si cancela cuando nuestro equipo ya va de camino.** A esa altura el viaje ya está pagado en combustible y salarios.',
      ],
    },
    {
      t: 'p',
      texto:
        'Su reserva no queda confirmada hasta que la retención se autoriza. Si su tarjeta se rechaza, el hueco de la cita no queda reservado y se lo diremos.',
    },
    {
      t: 'h2',
      texto: '4. El pago del resto',
    },
    {
      t: 'p',
      texto:
        'El resto del precio —el total menos el depósito— se paga el día del servicio. Cobramos en la tarjeta con la que reservó, y el recibo se le manda por correo.',
    },
    {
      t: 'p',
      texto:
        'Las propinas **no son nunca obligatorias y nunca se añaden automáticamente**. Si quiere dejar una, es enteramente su decisión.',
    },
    {
      t: 'h2',
      texto: '5. Cambiar o cancelar una cita',
    },
    {
      t: 'tabla',
      cabecera: ['Cuándo nos lo dice', 'Qué pasa'],
      filas: [
        [
          '**Con más de 24 horas de antelación**',
          'La movemos o cancelamos **sin coste**, y la retención se libera',
        ],
        [
          '**Con menos de 24 horas**',
          'Cobramos el depósito de 35,00 USD. La cita se cancela y no se debe nada más',
        ],
        [
          '**Después de que el equipo haya salido** hacia su casa',
          'Cobramos el depósito de 35,00 USD. Nada más',
        ],
        [
          '**No podemos entrar** al llegar y nadie responde',
          'Se trata como una cancelación con el equipo ya en camino: se cobra el depósito de 35,00 USD',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'Para cambiar o cancelar, llame al {{phone}} o escriba a {{email}}. No confíe en un mensaje enviado en la última hora antes de la cita: si el equipo ya salió, puede que no lo veamos a tiempo.',
    },
    {
      t: 'p',
      texto:
        '**Si somos nosotros los que tenemos que cancelar o mover su cita** —una baja, una avería, tiempo severo o cualquier cosa que haga inseguro el viaje— se lo diremos en cuanto lo sepamos, liberaremos la retención y le ofreceremos el hueco alternativo más próximo. Nunca se le cobra una cita que no pudimos cumplir.',
    },
    {
      t: 'h2',
      texto: '6. Entrar en su casa',
    },
    {
      t: 'p',
      texto:
        'Puede estar o no estar; muchos de nuestros clientes no están. Elija lo que elija, es responsabilidad suya que podamos entrar.',
    },
    {
      t: 'ul',
      items: [
        'Si nos da un código de puerta, el lugar de una llave o instrucciones de la alarma, los tratamos como confidenciales y solo los ve el equipo asignado a su trabajo y administración.',
        '**Desactive su alarma o denos el código.** No somos responsables de las tasas por falsa alarma causadas por instrucciones equivocadas, caducadas o que no se nos dieron.',
        'Nuestro equipo no forzará una entrada, no entrará por una ventana ni aceptará una llave de un vecino del que no se nos haya hablado.',
        'Si pone un punto en el mapa marcando su entrada, lo usamos para encontrar la puerta. **Lo borramos 24 horas después de que termine el trabajo.**',
      ],
    },
    {
      t: 'h2',
      texto: '7. Mascotas, menores y otras personas en la vivienda',
    },
    {
      t: 'ul',
      items: [
        '**Háblenos de sus mascotas al reservar.** Nos encanta trabajar con ellas cerca, pero necesitamos saberlo. Asegure a cualquier animal que pueda morder, escaparse o asustarse con una aspiradora.',
        'Si una situación en la vivienda es insegura para nuestro equipo —un animal agresivo, una persona con actitud amenazante, un riesgo que no pueden esquivar— se marcharán y nos llamarán. Nos pondremos en contacto con usted y la cita se tratará como una cancelación con el equipo ya en camino.',
        'Nuestro equipo no vigila a menores ni a mascotas.',
      ],
    },
    {
      t: 'h2',
      texto: '8. Qué incluye la limpieza',
    },
    {
      t: 'p',
      texto:
        'Nuestro sitio web publica la lista de tareas que el equipo lleva de verdad, y una lista de lo que **no** limpiamos, que hoy incluye patios y porches, ventanas por fuera y sus rieles, platos y lavavajillas, paredes, el interior de neveras y armarios que siguen con cosas dentro, y electrodomésticos pequeños como hornos de sobremesa y freidoras de aire. Lo decimos por delante y no después, y si necesita algo de esa lista le indicaremos quién lo hace.',
    },
    {
      t: 'p',
      texto: 'Los extras se cotizan y se cobran aparte. No forman parte de una limpieza normal.',
    },
    {
      t: 'p',
      texto:
        'Llevamos nuestro propio equipo y nuestros propios productos profesionales. Si prefiere que usemos los suyos, díganoslo al reservar.',
    },
    {
      t: 'h2',
      texto: '9. Servicio recurrente',
    },
    {
      t: 'p',
      texto:
        'Elegir una frecuencia —semanal, cada dos semanas, mensual— le da una tarifa con descuento para esa frecuencia.',
    },
    {
      t: 'p',
      texto:
        '**No damos de alta ninguna suscripción automática y no cobramos su tarjeta de forma recurrente.** Cada cita se reserva, se cotiza y se cobra de una en una, y usted confirma cada una. No hay nada que cancelar más que una cita que ya haya reservado.',
    },
    {
      t: 'p',
      texto:
        '[RECURRING RATE RULE — ver docs/40 §6: la dueña tiene que decidir qué pasa con la tarifa con descuento si un cliente deja el plan recurrente después de una o dos visitas.]',
    },
    {
      t: 'h2',
      texto: '10. Nuestra garantía de repaso',
    },
    {
      t: 'p',
      texto:
        'Si algo no le ha gustado, **díganoslo dentro de las 24 horas siguientes al servicio y volvemos a arreglarlo sin coste**. Ésa es la garantía tal y como está publicada en nuestro sitio web y forma parte de este acuerdo.',
    },
    {
      t: 'p',
      texto:
        'Para que funcione necesitamos enterarnos pronto y necesitamos saber qué concretamente estuvo mal. Pasadas las 24 horas seguiremos queriendo escucharle, y haremos lo que razonablemente podamos, pero el repaso gratuito va unido a ese plazo.',
    },
    {
      t: 'h2',
      texto: '11. Daños, roturas y pérdidas',
    },
    {
      t: 'p',
      texto:
        'Tenemos **póliza de responsabilidad civil general**. Si dañamos algo, queremos arreglarlo.',
    },
    {
      t: 'ul',
      items: [
        '**Díganoslo dentro de las 24 horas siguientes al servicio.** Un daño comunicado más tarde es muy difícil de atribuir a una limpieza, y nuestra aseguradora lo dirá.',
        'Guarde antes de que lleguemos lo **irreemplazable, de mucho valor o con valor sentimental**: joyas, dinero, objetos de colección, herencias, documentos importantes. Pedimos a nuestro equipo que no mueva esas cosas, pero el sitio más seguro para ellas es guardadas.',
        'Algunas cosas se rompen por cómo estaban ya, no por la limpieza: fijaciones flojas, juntas deterioradas, objetos ya agrietados o pegados, persianas y barras de cortina al final de su vida, superficies con el acabado gastado. No respondemos de condiciones preexistentes, y se lo diremos si vemos una.',
        'No aceptamos responsabilidad por daños causados por productos de limpieza que usted nos pidió usar.',
        '**Nunca decimos estar afianzados**, porque no lo estamos. Nuestro sitio dice «asegurados», y eso es exactamente lo que somos.',
      ],
    },
    {
      t: 'h2',
      texto: '12. Su parte del acuerdo',
    },
    {
      t: 'p',
      texto: 'Para recibir la limpieza que está pagando, le pedimos que:',
    },
    {
      t: 'ul',
      items: [
        'Nos diga la verdad sobre la vivienda: tamaño, estado, mascotas, acceso.',
        'Recoja objetos personales y desorden de las superficies que quiere limpias. Nuestro equipo limpia; no organiza sus pertenencias salvo que lo haya contratado.',
        'Se asegure de que haya agua corriente y electricidad.',
        'Nos diga dónde aparcar si aparcar es difícil.',
        'Nos avise con antelación de cualquier cosa en la vivienda que requiera cuidado especial o sea peligrosa.',
      ],
    },
    {
      t: 'p',
      texto:
        'Podemos rechazar o detener un trabajo —y cobrar el depósito de 35,00 USD si nuestro equipo ya se desplazó— si la vivienda resulta presentar un riesgo sanitario o de seguridad para el que nuestro equipo no está equipado, como aguas residuales, moho, plagas, residuos de drogas, residuos biológicos o condiciones que exijan equipo de protección que no llevamos.',
    },
    {
      t: 'h2',
      texto: '13. Fotos y vídeo de su casa',
    },
    {
      t: 'p',
      texto:
        'A veces tomamos fotos o vídeos cortos de antes y después. **Reservar no es un permiso para publicarlos.** Ese permiso lo pedimos aparte, por escrito, en su propio formulario, y allí explicamos qué podemos fotografiar y dónde podemos publicarlo.',
    },
    {
      t: 'p',
      texto:
        'Puede retirar ese permiso en cualquier momento y quitamos el material en un plazo de **5 días**. La sección 7 de nuestra Política de Privacidad lo explica entero, incluido que quitamos las coordenadas GPS de cada imagen antes de guardarla y que nunca publicamos su nombre ni su dirección junto a las fotos.',
    },
    {
      t: 'h2',
      texto: '14. Nuestros empleados',
    },
    {
      t: 'p',
      texto:
        'Las personas que limpian son nuestras empleadas. Pasan una verificación de antecedentes penales y de identidad antes de su primer trabajo.',
    },
    {
      t: 'p',
      texto:
        '[NON-SOLICITATION — ver docs/40 §6: la dueña tiene que decidir si incluir una cláusula sobre contratar a nuestro personal directamente. Es común en este sector y es también de las cláusulas que un tribunal mira con lupa. Se deja fuera hasta que lo decidan la dueña y un abogado.]',
    },
    {
      t: 'h2',
      texto: '15. Límites de nuestra responsabilidad',
    },
    {
      t: 'p',
      texto: 'En la máxima medida que permite la ley de Georgia:',
    },
    {
      t: 'ul',
      items: [
        'Nuestra responsabilidad total derivada de una limpieza concreta se limita a lo que usted pagó por esa limpieza, **salvo** los daños materiales cubiertos por nuestra póliza de responsabilidad civil, que se gestionan por esa póliza y no quedan limitados por este párrafo.',
        'No respondemos de perjuicios indirectos o consecuenciales —tiempo de trabajo perdido, una cita propia que se le pasó, pérdida de ingresos de alquiler— derivados de una limpieza que llegó tarde, se movió o se canceló.',
        '**Nada en estos Términos limita nuestra responsabilidad por negligencia grave, dolo, daños personales causados por nosotros, ni por nada más que no se pueda limitar ni excluir bajo la ley de Georgia.**',
      ],
    },
    {
      t: 'p',
      texto:
        'Nuestro sitio web, la calculadora de precios y el sistema de reservas se ofrecen tal y como están. Trabajamos para que sean exactos y estén disponibles, pero no garantizamos que estén libres de errores ni siempre en línea. Si un error del sistema le da un precio evidentemente equivocado, se lo diremos antes de empezar cualquier trabajo y podrá retirarse sin más.',
    },
    {
      t: 'h2',
      texto: '16. Si algo va mal entre nosotros',
    },
    {
      t: 'p',
      texto:
        '**Hable con nosotros primero.** Llame al {{phone}} o escriba a {{email}}. Casi todo se arregla en una llamada, y preferimos arreglarlo a discutirlo.',
    },
    {
      t: 'p',
      texto:
        'Estos Términos se rigen por las leyes del estado de Georgia, sin atender a sus normas de conflicto de leyes. Cualquier disputa que no podamos resolver entre nosotros se presentará ante los tribunales estatales o federales situados en {{county}}, Georgia, y ambos aceptamos esa jurisdicción.',
    },
    {
      t: 'p',
      texto:
        '[ARBITRATION — ver docs/40 §6: a propósito, este borrador no incluye arbitraje obligatorio ni renuncia a acciones colectivas. La dueña y un abogado deben decidir si se añade.]',
    },
    {
      t: 'p',
      texto:
        'Nada de aquí impide a ninguna de las partes acudir a un tribunal de cuantías menores (_small claims court_).',
    },
    {
      t: 'h2',
      texto: '17. Cambios en estos Términos',
    },
    {
      t: 'p',
      texto:
        'Podemos actualizar estos Términos. La versión vigente está siempre en nuestro sitio web con su fecha de entrada en vigor y su número de versión.',
    },
    {
      t: 'p',
      texto:
        '**Un cambio nunca se aplica hacia atrás a una reserva que ya hizo.** Los Términos que rigen su cita son los que aceptó al reservarla, y guardamos el registro de qué versión fue.',
    },
    {
      t: 'h2',
      texto: '18. El resto del armazón legal',
    },
    {
      t: 'ul',
      items: [
        '**Acuerdo completo.** Estos Términos, nuestra Política de Privacidad, su permiso de fotos si lo dio, y la confirmación de reserva que le mandamos son el acuerdo completo entre nosotros. Nada que nadie haya dicho de manera informal los modifica.',
        '**Si una parte falla.** Si alguna disposición resulta inejecutable, el resto sigue en vigor y esa disposición se limita solo en lo necesario.',
        '**Sin renuncia.** Que no exijamos algo una vez no significa que hayamos renunciado a ello.',
        '**Cesión.** Usted no puede transferir este acuerdo a otra persona sin nuestro consentimiento. Nosotros podemos transferirlo si se vende la empresa, y estos Términos van con ella.',
        '**Negocio independiente.** Somos una empresa de limpieza, no su empleado ni su mandatario. Las personas que limpian son nuestras empleadas, no suyas.',
      ],
    },
    {
      t: 'h2',
      texto: '19. Idioma',
    },
    {
      t: 'p',
      texto:
        'Estos Términos se publican en inglés y en español. **La versión inglesa es la que gobierna**; la española se ofrece por comodidad, porque buena parte de nuestra clientela lee en español y nadie debería tener que aceptar un contrato que no puede leer. Si alguna vez las dos no coinciden, manda el texto inglés.',
    },
    {
      t: 'h2',
      texto: '20. Cómo contactarnos',
    },
    {
      t: 'contacto',
    },
  ],
};
