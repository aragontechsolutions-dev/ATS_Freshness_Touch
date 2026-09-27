import type { Locale } from '@freshness/types';

/**
 * EL DISENO DE TODOS LOS CORREOS, EN UN SOLO SITIO
 * ------------------------------------------------
 * Antes habia dos funciones `comoHtml` casi identicas, una en los correos de
 * reservas y otra en los del personal. Casi identicas es el problema: un
 * arreglo se aplicaba a una y no a la otra, y la que menos se mira es la que
 * acaba rota.
 *
 * EL CORREO NO ES UNA PAGINA WEB, y casi todo lo raro de este archivo sale
 * de ahi:
 *
 *   - ESTILOS EN LINEA, atributo por atributo. Muchos clientes tiran la hoja
 *     de estilos y varios ignoran tambien el `<style>` del encabezado.
 *   - TABLAS PARA MAQUETAR. No es nostalgia: Outlook en Windows usa el motor
 *     de Word, que no entiende flex ni grid.
 *   - NADA DE `border-radius` EN LO IMPRESCINDIBLE. Donde no se soporta,
 *     simplemente sale cuadrado; por eso las esquinas redondeadas se usan
 *     como adorno y nunca para que algo se entienda.
 *
 * LAS IMAGENES SE BLOQUEAN POR DEFECTO en Outlook y en Gmail para quien no
 * este en la libreta de direcciones. Por eso la marca de estos correos la
 * llevan EL COLOR Y EL TEXTO, y el logotipo es un extra: con las imagenes
 * apagadas el correo se sigue entendiendo y se sigue reconociendo.
 */

/** Los colores oficiales, los mismos que el sitio y el panel. */
const MARCA = {
  /** Azul oficial. Titulares, botones y la banda de arriba. */
  azul: '#145788',
  /** Azul mas oscuro, para texto grande sobre blanco. */
  azulOscuro: '#10456c',
  /** Amarillo oficial. Solo como filete de acento: sobre blanco no se lee. */
  amarillo: '#f9c400',
  /** Blanco roto oficial: el fondo de la pagina. */
  lienzo: '#f7f9fc',
  borde: '#e2e8f0',
  texto: '#334155',
  textoSuave: '#475569',
  textoTenue: '#64748b',
  textoMuyTenue: '#94a3b8',
} as const;

export const COMPANY_NAME = 'Freshness Touch';

/**
 * De donde se descarga el logotipo.
 *
 * ES OPCIONAL A PROPOSITO, y no solo por si no esta configurado: con las
 * imagenes bloqueadas el resultado es el mismo, y eso le pasa a una buena
 * parte de quien recibe el correo. Sin direccion, en su lugar va el nombre
 * de la empresa en texto, que es exactamente lo que se ve tambien cuando la
 * imagen no carga.
 *
 * VA EN VARIABLE DE ENTORNO Y NO ESCRITA AQUI porque depende del dominio del
 * despliegue, y porque un correo con una imagen rota apuntando a un dominio
 * que ya no es de la empresa es peor que un correo sin imagen.
 */
export interface EmailBranding {
  logoUrl: string | null;
}

export interface EmailLayout {
  locale: Locale;
  /** Lo primero que se lee. Tambien es el asunto, normalmente. */
  titulo: string;
  parrafos: string[];
  /** La llamada a la accion, cuando la hay. */
  boton?: { texto: string; enlace: string };
  /**
   * Bloque de datos en dos columnas: la fecha de una reserva, el importe...
   * Se pinta como tabla porque es una tabla.
   */
  datos?: [etiqueta: string, valor: string][];
  /** Lo que conviene saber. Va en gris, debajo de la accion. */
  nota?: string;
  /** La letra pequena: que hacer si esto no lo pediste. */
  aviso?: string;
  /** Telefono y correo de la empresa, ya formateados. */
  contacto: string[];
  branding: EmailBranding;
}

/**
 * Escapa para meter texto en el CUERPO del HTML.
 *
 * Todo lo que entra aqui pasa por esta funcion, incluido lo que viene de
 * nuestra propia base de datos: el nombre de un cliente es texto que escribio
 * un desconocido en un formulario publico.
 */
export function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * El correo entero, en HTML.
 *
 * Devuelve el documento completo —con `<!doctype>` y `<html lang>`— porque
 * el idioma importa: sin el, los lectores de pantalla leen un correo en
 * espanol con pronunciacion inglesa, y algunos clientes ofrecen traducirlo
 * al idioma en el que ya esta.
 */
export function emailHtml(layout: EmailLayout): string {
  const { titulo, parrafos, boton, datos, nota, aviso, contacto, branding, locale } = layout;

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <!--
      Sin esto, Outlook en movil encoge el correo entero hasta hacerlo
      ilegible en vez de dejar que se adapte al ancho de la pantalla.
    -->
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapar(titulo)}</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:${MARCA.lienzo};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${MARCA.lienzo};">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid ${MARCA.borde};overflow:hidden;">
            ${cabecera(branding, titulo)}
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:${MARCA.azulOscuro};">${escapar(titulo)}</h1>
                ${parrafos.map((p) => `<p style="margin:0 0 12px;font-size:15px;color:${MARCA.texto};line-height:1.55;">${escapar(p)}</p>`).join('')}
                ${datos && datos.length > 0 ? tablaDeDatos(datos) : ''}
                ${boton ? llamadaALaAccion(boton) : ''}
                ${nota ? `<p style="margin:0 0 12px;font-size:14px;color:${MARCA.textoSuave};line-height:1.55;">${escapar(nota)}</p>` : ''}
                ${aviso ? `<p style="margin:0 0 4px;font-size:13px;color:${MARCA.textoTenue};line-height:1.55;">${escapar(aviso)}</p>` : ''}
              </td>
            </tr>
            ${pie(contacto)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* -------------------------------------------------------------------------- */

/**
 * La banda de color y el logotipo.
 *
 * LA BANDA VA PRIMERO Y ES LA QUE HACE EL TRABAJO. Es un color de fondo, y
 * un color de fondo no se puede bloquear: aunque las imagenes esten
 * apagadas, el correo se sigue reconociendo de un vistazo. El logotipo va
 * despues, sobre blanco, porque lleva texto casi negro y sobre el azul de
 * marca desapareceria.
 */
function cabecera(branding: EmailBranding, titulo: string): string {
  const banda = `<tr><td style="height:6px;line-height:6px;font-size:0;background:${MARCA.azul};">&nbsp;</td></tr>`;

  if (!branding.logoUrl) {
    /*
     * Sin logotipo, el nombre en texto y con el color de marca. Es tambien
     * lo que ve quien tiene las imagenes bloqueadas, asi que conviene que
     * este resuelto y no que sea un hueco.
     */
    return `${banda}
            <tr>
              <td align="center" style="padding:20px 24px 0;">
                <span style="font-size:19px;font-weight:700;color:${MARCA.azul};letter-spacing:0.2px;">${COMPANY_NAME}</span>
              </td>
            </tr>`;
  }

  return `${banda}
            <tr>
              <td align="center" style="padding:20px 24px 4px;">
                <!--
                  EL ANCHO VA TAMBIEN COMO ATRIBUTO: Outlook usa el motor de
                  Word e ignora el estilo; sin el atributo pintaria la imagen
                  a su tamano real —480 px— y romperia el ancho del correo.

                  EL ALTO NO SE PONE, y esto se aprendio mirandolo. Con
                  un alto fijo, el hueco de 160 px se reserva igual cuando
                  las imagenes estan bloqueadas, y el correo se abre con un
                  agujero blanco enorme antes del titulo. Sin el, Outlook
                  escala en proporcion y el hueco se encoge hasta la linea de
                  texto alternativo.

                  El texto alternativo no es un tramite: con las imagenes
                  apagadas es literalmente lo que se lee en su lugar, y por
                  eso lleva el color y el peso de la marca.
                -->
                <img src="${escapar(branding.logoUrl)}" width="240"
                     alt="${COMPANY_NAME}" title="${escapar(titulo)}"
                     style="display:block;width:240px;max-width:100%;height:auto;border:0;font-size:17px;font-weight:700;color:${MARCA.azul};" />
              </td>
            </tr>`;
}

/** Los datos de una reserva, en dos columnas. */
function tablaDeDatos(datos: [string, string][]): string {
  const filas = datos
    .map(
      ([etiqueta, valor]) => `
          <tr>
            <td style="padding:6px 12px 6px 0;color:${MARCA.textoSuave};font-size:14px;">${escapar(etiqueta)}</td>
            <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapar(valor)}</td>
          </tr>`,
    )
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">${filas}</table>`;
}

/**
 * El boton.
 *
 * SIEMPRE VA ACOMPANADO DEL ENLACE EN TEXTO, justo debajo. Hay clientes de
 * correo que no pintan botones, y quien lea esto en un movil viejo o en un
 * cliente de texto tiene que poder copiarlo a mano. Es la diferencia entre
 * que alguien entre o que llame por telefono.
 *
 * EL ENLACE SE ESCAPA COMO ATRIBUTO, que no es lo mismo que escapar texto:
 * va dentro de `href="..."`, asi que unas comillas sin escapar permitirian
 * cerrar el atributo y anadir otros.
 */
function llamadaALaAccion(boton: { texto: string; enlace: string }): string {
  const enlace = escapar(boton.enlace);

  return `<p style="margin:20px 0 12px;">
                  <a href="${enlace}" style="display:inline-block;padding:12px 22px;background:${MARCA.azul};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${escapar(boton.texto)}</a>
                </p>
                <p style="margin:0 0 16px;font-size:12px;color:${MARCA.textoMuyTenue};word-break:break-all;line-height:1.5;">${enlace}</p>`;
}

/**
 * El pie.
 *
 * El filete amarillo es el unico sitio donde aparece el amarillo de marca:
 * como texto no se lee sobre blanco —lo dice el estudio de contraste de
 * `docs/09`—, pero como linea de tres pixeles cumple su papel.
 */
function pie(contacto: string[]): string {
  return `<tr>
              <td style="padding:0 24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="height:3px;line-height:3px;font-size:0;background:${MARCA.amarillo};">&nbsp;</td></tr>
                </table>
                <div style="padding-top:14px;">
                  ${contacto.map((linea) => `<p style="margin:0 0 4px;font-size:13px;color:${MARCA.textoTenue};">${escapar(linea)}</p>`).join('')}
                  <p style="margin:10px 0 0;font-size:13px;font-weight:600;color:${MARCA.azul};">${COMPANY_NAME}</p>
                </div>
              </td>
            </tr>`;
}
