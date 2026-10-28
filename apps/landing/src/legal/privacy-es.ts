import type { Documento } from './documento';

/**
 * La Politica de Privacidad en espanol. TRADUCCION DE CORTESIA: manda la
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
export const PRIVACY_ES: Documento = {
  titulo: 'Política de Privacidad',
  bloques: [
    {
      t: 'h2',
      texto: '1. Quiénes somos y qué cubre esto',
    },
    {
      t: 'p',
      texto:
        'Freshness Touch es una empresa de limpieza residencial y comercial que opera en el estado de Georgia, Estados Unidos. Esta política explica qué información personal recogemos cuando usa nuestro sitio web, pide un presupuesto o reserva una limpieza; para qué la recogemos; con quién la compartimos; cuánto tiempo la guardamos; y qué puede pedirnos que hagamos con ella.',
    },
    {
      t: 'contacto',
    },
    {
      t: 'p',
      texto:
        'Esta política cubre nuestro sitio web y nuestro sistema de reservas. No cubre lo que usted nos envíe por un servicio de mensajería ajeno como WhatsApp, que se rige además por la política de privacidad de ese servicio.',
    },
    {
      t: 'h2',
      texto: '2. Resumen en lenguaje claro',
    },
    {
      t: 'p',
      texto:
        'Solo recogemos lo que necesitamos para calcular un precio, llegar a su casa y limpiarla, cobrarle correctamente y contarle qué está pasando.',
    },
    {
      t: 'ul',
      items: [
        '**No vendemos su información personal.** Nunca lo hemos hecho y no tenemos intención de hacerlo.',
        '**No compartimos su información con anunciantes ni con intermediarios de datos.**',
        '**No usamos cookies de publicidad ni de analítica**, y no le seguimos por otros sitios web. Nuestro sitio guarda dos cosas en su navegador —su idioma y si eligió modo claro u oscuro— y nada más.',
        '**Nunca vemos ni guardamos el número completo de su tarjeta.** La tarjeta la gestiona nuestra pasarela de pago; nosotros solo vemos la marca y los últimos cuatro dígitos.',
        '**Las fotos de su casa no se publican nunca sin su permiso aparte y por escrito**, y puede pedir que se retiren en cualquier momento.',
      ],
    },
    {
      t: 'h2',
      texto: '3. Qué recogemos y para qué',
    },
    {
      t: 'h3',
      texto: '3.1 Cuando usa la calculadora de precios',
    },
    {
      t: 'p',
      texto:
        'Para darle un precio le pedimos su **código postal** y los datos del trabajo: tipo de servicio, con qué frecuencia lo quiere, número de habitaciones y baños, pies cuadrados y los extras que elija. Guardamos ese presupuesto para poder reproducir el precio exacto que le dimos si más adelante nos pregunta por él.',
    },
    {
      t: 'p',
      texto: '**No** hace falta que nos dé su nombre, su correo ni su teléfono para ver un precio.',
    },
    {
      t: 'h3',
      texto: '3.2 Cuando reserva',
    },
    {
      t: 'tabla',
      cabecera: ['Qué recogemos', 'Para qué'],
      filas: [
        ['Nombre y apellido', 'Para identificar su reserva y dirigirnos a usted correctamente'],
        ['Correo electrónico', 'Para enviarle la confirmación, el recibo y los recordatorios'],
        ['Teléfono', 'Para que el equipo pueda localizarle el día del servicio'],
        [
          'Dirección del servicio (calle, unidad, ciudad, estado, código postal)',
          'Para llegar, y para calcular la distancia del traslado',
        ],
        [
          'Instrucciones de acceso, si decide darlas',
          'Para que el equipo pueda entrar si usted no está',
        ],
        [
          'Un punto en el mapa que marque su entrada, si decide ponerlo',
          'Porque la búsqueda automática de direcciones puede dejar una casa de la Georgia rural a cientos de metros',
        ],
        [
          'Las indicaciones que escriba para el equipo',
          'Para limpiar lo que usted realmente quiere que se limpie',
        ],
        ['Idioma preferido', 'Para escribirle en inglés o en español'],
        [
          'La dirección IP desde la que se hizo la reserva',
          'Seguridad: para detectar abusos y reservas fraudulentas',
        ],
        [
          'Si marcó la casilla de comunicaciones comerciales',
          'Para mandar ofertas solo a quien las pidió',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'Darnos las instrucciones de acceso y el punto del mapa es **opcional**. Puede reservar sin ninguno de los dos y abrirle la puerta al equipo usted mismo.',
    },
    {
      t: 'h3',
      texto: '3.3 Información de pago',
    },
    {
      t: 'p',
      texto:
        'Los pagos con tarjeta los gestiona **Stripe, Inc.** Usted introduce los datos de su tarjeta en el formulario seguro de Stripe. **Nunca recibimos, vemos ni guardamos el número completo de su tarjeta, su fecha de caducidad ni su código de seguridad.**',
    },
    {
      t: 'p',
      texto:
        'Lo que sí guardamos, porque lo necesitamos para gestionar su reserva y responder preguntas de facturación, es: la marca de la tarjeta (Visa, Mastercard…), los **últimos cuatro dígitos**, los importes autorizados, cobrados y devueltos, el estado de cada pago, las referencias que Stripe nos da para identificar la operación, y el código del motivo si un pago se rechaza.',
    },
    {
      t: 'h3',
      texto: '3.4 Fotos y vídeo de su casa',
    },
    {
      t: 'p',
      texto:
        'A veces tomamos fotos o vídeos cortos de antes y después. **No se publican nunca en ningún sitio sin su permiso aparte y por escrito**, que pedimos en su propio formulario, no escondido en estas condiciones. La sección 7 lo explica entero.',
    },
    {
      t: 'h3',
      texto: '3.5 Qué NO recogemos',
    },
    {
      t: 'ul',
      items: [
        'No recogemos su número de seguridad social, su número de licencia de conducir, su fecha de nacimiento ni números de cuentas financieras.',
        'No recogemos información de salud, datos biométricos, ni información sobre su raza, religión, política, afiliación sindical, orientación sexual o situación migratoria.',
        'No usamos cámaras, grabación de audio ni ningún tipo de dispositivo de vigilancia en su casa.',
        'No ejecutamos guiones de publicidad ni de analítica en nuestro sitio web, así que no construimos un perfil de su navegación.',
        'No recogemos a sabiendas información de menores (sección 11).',
      ],
    },
    {
      t: 'h2',
      texto: '4. Con quién la compartimos',
    },
    {
      t: 'p',
      texto:
        'Compartimos información personal solo con las empresas que operan partes de nuestro servicio, y solo lo que cada una necesita. Cada una está sujeta a su propio contrato y a su propia política de privacidad. No vendemos ni alquilamos su información a nadie.',
    },
    {
      t: 'tabla',
      cabecera: ['Quién', 'Qué recibe', 'Qué hace con ella'],
      filas: [
        [
          '**Stripe, Inc.**',
          'Los datos de su tarjeta (directamente de usted), su correo, los importes',
          'Gestiona la retención del depósito, el cobro final y las devoluciones; le manda el recibo de la tarjeta',
        ],
        [
          '**Supabase**',
          'Todo lo que hay en nuestra base de datos, alojada en Estados Unidos',
          'Almacena nuestra base de datos y nuestros archivos',
        ],
        [
          '**Render**',
          'Los datos que nuestro sistema procesa mientras funciona',
          'Ejecuta nuestro sistema de reservas',
        ],
        [
          '**Vercel**',
          'Las peticiones que su navegador hace a nuestro sitio',
          'Sirve nuestro sitio web',
        ],
        [
          '**Resend**',
          'Su nombre, su correo, la referencia de la reserva, la hora de la cita y la dirección',
          'Entrega nuestros correos de confirmación, recordatorio y recibo',
        ],
        [
          '**Google Maps Platform** (Google LLC)',
          'Su código postal y estado al pedir un presupuesto; también su calle y ciudad una vez que reserva',
          'Calcula la distancia en coche desde nuestra base, que forma parte de su precio',
        ],
        [
          '**Geocodificador de la Oficina del Censo de EE. UU.**',
          'La dirección del servicio',
          'Convierte la dirección en coordenadas. Es un servicio público gratuito del gobierno de EE. UU.',
        ],
        [
          '**Telegram**',
          'Avisos internos de trabajo, que incluyen su nombre, la hora de la cita y la dirección',
          'Avisa a nuestro propio equipo de los trabajos nuevos y de los cambios',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'También podemos revelar información cuando la ley lo exige —una citación, una orden judicial, un requerimiento legítimo de una administración—, a nuestra aseguradora o a nuestros abogados en relación con una reclamación, a nuestro contador a efectos fiscales, o a un comprador si algún día se vende la empresa, caso en el que esta política seguirá aplicándose a la información recogida antes de la venta.',
    },
    {
      t: 'p',
      texto:
        'Nuestros empleados ven solo lo que su trabajo necesita: el equipo de limpieza asignado a su trabajo ve su dirección, sus instrucciones de acceso y sus indicaciones, pero **nunca ningún importe de pago**. Cada vez que una persona del equipo consulta o modifica información sensible, nuestro sistema registra quién lo hizo y cuándo.',
    },
    {
      t: 'h2',
      texto: '5. Dónde se guarda',
    },
    {
      t: 'p',
      texto:
        'En Estados Unidos. Nuestro sitio web, nuestro sistema de reservas, nuestra base de datos y nuestro almacenamiento de archivos están alojados con proveedores estadounidenses.',
    },
    {
      t: 'h2',
      texto: '6. Cuánto tiempo la guardamos',
    },
    {
      t: 'tabla',
      cabecera: ['Qué', 'Cuánto'],
      filas: [
        [
          'El punto del mapa que marca su entrada',
          '**Se borra 24 horas después de que termine el trabajo**, automáticamente',
        ],
        [
          'La retención en la tarjeta de una reserva sin pagar',
          'Se libera automáticamente; una retención caduca a los 7 días como máximo',
        ],
        [
          'Un presupuesto',
          'Su precio vale 7 días; guardamos el registro para poder reproducir lo que le cotizamos',
        ],
        [
          'Su permiso de fotos y vídeo, y la prueba de que lo dio',
          'Mientras podamos usar el material, más el tiempo que nuestra aseguradora y la ley nos exijan poder demostrar que lo dio',
        ],
        [
          'Fotos o vídeos que acordamos retirar',
          'Se quitan de todos los sitios donde los publicamos en un plazo de **5 días** desde su petición',
        ],
        [
          'Registros de reservas, pagos y servicios',
          'Mientras sea cliente, y después el tiempo que los necesitemos a efectos fiscales, contables, de seguro y de reclamaciones legales',
        ],
        [
          'Nuestro registro interno de quién hizo qué en el sistema',
          '**Un año**, y después se borra solo. A propósito **no** contiene datos de tarjeta, contraseñas, códigos de puerta, nombres ni direcciones',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'Cuando acaba un plazo de conservación, borramos la información o le quitamos lo que le identifica.',
    },
    {
      t: 'h2',
      texto: '7. Fotos y vídeo de su casa',
    },
    {
      t: 'p',
      texto:
        'Es la parte de nuestro servicio que más toca su privacidad, así que la tratamos aparte.',
    },
    {
      t: 'ol',
      items: [
        '**Pedimos el permiso en su propio formulario**, que dice qué podemos fotografiar (interior, exterior, antes y después), dónde podemos publicarlo (nuestro sitio web, redes sociales) y por cuánto tiempo. No tratamos una reserva como un permiso para publicar.',
        '**El permiso queda escrito.** Guardamos cómo lo dio —un formulario firmado, un formulario web, un correo o un mensaje— y conservamos una copia de esa prueba. La prueba se guarda en un almacén de archivos **privado** que, por diseño, no es alcanzable desde internet.',
        '**Si vive alguien más en la propiedad**, necesitamos también su permiso antes de publicar nada.',
        '**Quitamos los datos de ubicación de cada foto antes de guardarla.** Los teléfonos graban las coordenadas GPS dentro del archivo de imagen; nuestro sistema las elimina en el servidor para que las coordenadas de su casa no viajen con la foto.',
        '**Puede cambiar de opinión en cualquier momento.** Dígalo por cualquier vía y retiramos el material, de todos los sitios donde lo publicamos, en 5 días. Con su registro de permiso le mandamos además un enlace de un solo uso para que pueda pedir la retirada usted mismo sin depender de que le atienda una persona. Ese enlace es personal: trátelo como una contraseña y no lo reenvíe.',
        '**Nunca publicamos su nombre ni su dirección con las imágenes.**',
      ],
    },
    {
      t: 'h2',
      texto: '8. Correo comercial y mensajes de texto',
    },
    {
      t: 'p',
      texto:
        '**Correo.** Le mandamos correo transaccional porque reservó con nosotros: su confirmación, su recibo, un recordatorio antes de la cita. Es parte del servicio y no se puede ser cliente sin él, aunque puede pedirnos que usemos el teléfono en su lugar.',
    },
    {
      t: 'p',
      texto:
        'El correo comercial es otra cosa. Solo lo mandamos si marcó la casilla pidiéndolo, todos llevan un enlace para darse de baja, y la baja surte efecto de inmediato y no afecta a su servicio.',
    },
    {
      t: 'p',
      texto:
        '**Mensajes de texto / SMS.** **No** mandamos mensajes de texto comerciales hoy. Si algún día lo hacemos, pediremos antes su consentimiento expreso por escrito y por separado, le diremos que ese consentimiento no es condición para comprar nada, y podrá cortarlos respondiendo STOP.',
    },
    {
      t: 'p',
      texto:
        '**Llamadas.** Podemos llamarle por una reserva que haya hecho. No hacemos llamadas comerciales automáticas.',
    },
    {
      t: 'h2',
      texto: '9. Cómo la protegemos',
    },
    {
      t: 'ul',
      items: [
        'Todo viaja por una conexión cifrada (HTTPS).',
        'Los números de tarjeta no se guardan nunca en nuestros sistemas; los tiene nuestra pasarela de pago.',
        'Entrar a nuestro panel exige una cuenta individual, y cada puesto ve solo lo que necesita.',
        'La base de datos rechaza los accesos que no vienen por nuestro sistema.',
        'Las fotos se sirven con enlaces de corta duración, no con direcciones públicas permanentes.',
        'Los documentos que prueban el permiso de fotos viven en un almacén privado que no tiene dirección pública en absoluto.',
        'Nuestro sistema registra quién consultó o modificó información sensible.',
        'Cada persona que limpia pasa una verificación de antecedentes penales y de identidad antes de su primer trabajo.',
      ],
    },
    {
      t: 'p',
      texto:
        'Ningún sistema es perfecto y no decimos que el nuestro lo sea. Si una brecha afecta a su información personal, se lo notificaremos según exige la ley de notificación de brechas de Georgia, O.C.G.A. § 10-1-910 y siguientes.',
    },
    {
      t: 'h2',
      texto: '10. Sus opciones y sus derechos',
    },
    {
      t: 'p',
      texto:
        'Georgia no tiene hoy una ley general de privacidad de datos del consumidor. Aun así ofrecemos lo siguiente a todo el mundo, como política propia, y sin cobrar por ello:',
    },
    {
      t: 'ul',
      items: [
        '**Preguntar qué tenemos sobre usted** y obtener una copia.',
        '**Corregir** lo que esté mal.',
        '**Borrar** su información. Quitamos su nombre, correo, teléfono, calle, instrucciones de acceso, el punto del mapa, sus indicaciones y su nombre de cualquier permiso de imagen — y retiramos esas fotos a la vez. Conservamos lo que la ley exige: las referencias e importes de las reservas, la ciudad y el código postal, y la marca y los últimos cuatro dígitos de la tarjeta. Se lo diremos con esas palabras.',
        '**Retirar su permiso** para fotos y vídeo (sección 7).',
        '**Darse de baja** del correo comercial en cualquier momento.',
        '**Pedirnos que no le llamemos ni le escribamos** en absoluto, caso en el que ya no podremos prestarle el servicio, y se lo diremos claramente.',
      ],
    },
    {
      t: 'p',
      texto:
        'Escriba a {{email}} o llame al {{phone}}. Responderemos en un plazo de 30 días, y puede que antes necesitemos verificar quién es usted: no vamos a dar su dirección a alguien que solo conoce su correo.',
    },
    {
      t: 'p',
      texto:
        'Si vive en un estado con su propia ley de privacidad del consumidor, puede tener derechos legales adicionales. Pídanoslos y los atenderemos.',
    },
    {
      t: 'h2',
      texto: '11. Menores',
    },
    {
      t: 'p',
      texto:
        'Nuestros servicios son para adultos. No dirigimos nuestro sitio web a menores, no recogemos a sabiendas información personal de nadie menor de 13 años, y si nos enteramos de que lo hemos hecho, la borramos. Si cree que un menor nos ha dado información, escriba a {{email}}.',
    },
    {
      t: 'h2',
      texto: '12. Cambios en esta política',
    },
    {
      t: 'p',
      texto:
        'Si cambiamos esta política publicaremos la versión nueva aquí, con una fecha de entrada en vigor y un número de versión nuevos. Si un cambio afecta de forma sustancial a cómo usamos información que ya tenemos, se lo diremos antes de que surta efecto; por correo, si es cliente.',
    },
    {
      t: 'p',
      texto:
        'Cuando reserva, registramos qué versión de esta política y de nuestros Términos y Condiciones aceptó, y cuándo. Si quiere saber qué aceptó, pídalo y le mandaremos esa versión exacta.',
    },
    {
      t: 'h2',
      texto: '13. Idioma',
    },
    {
      t: 'p',
      texto:
        'Esta política se publica en inglés y en español. **La versión inglesa es la que gobierna**; la española se ofrece por comodidad. Si alguna vez las dos no coinciden, manda el texto inglés.',
    },
    {
      t: 'h2',
      texto: '14. Cómo contactarnos',
    },
    {
      t: 'contacto',
    },
  ],
};
