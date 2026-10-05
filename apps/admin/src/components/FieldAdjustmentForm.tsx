import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  FieldAdjustmentInput,
  MyJob,
  MyJobAdjustment,
  QuoteAddOnInput,
} from '@freshness/types';
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icons';

/**
 * «ESTO NO ES LO QUE PONE LA RESERVA»
 * ===================================
 * La pantalla donde el responsable corrige lo que encontró al llegar: una
 * casa de «900 pies» que son 1.300, un «limpiar la nevera» que son tres.
 *
 * ========================================================================
 * NO ENSEÑA NI UN IMPORTE, Y ES LA DECISION MAS IMPORTANTE DE LA PANTALLA
 * ========================================================================
 * Aquí no aparece lo que costaría la corrección, ni lo que cuesta el
 * trabajo. El contrato que llega al móvil no tiene dónde ponerlo
 * (`field-adjustment.ts`), y el motivo es esta puerta concreta: si quien
 * reporta viera «+40 $», la frase previsible delante del cliente es «esto le
 * va a costar cuarenta dólares más» —dicha por quien no decide los precios y
 * antes de que nadie lo haya aprobado—.
 *
 * Reporta lo que ve. Lo que cuesta lo dice coordinación.
 *
 * ========================================================================
 * Y EMPIEZA CERRADA
 * ========================================================================
 * Es un desplegable, no un formulario siempre abierto. El caso normal es que
 * la casa sea la que decía la reserva: abrir cinco campos en cada tarjeta
 * empujaría los botones de «he llegado» y «he terminado» fuera de la
 * pantalla para resolver un caso que no ocurre casi nunca.
 */

interface FieldAdjustmentFormProps {
  job: MyJob;
  enviando: boolean;
  onEnviar: (cambios: FieldAdjustmentInput) => Promise<void>;
}

export function FieldAdjustmentForm({ job, enviando, onEnviar }: FieldAdjustmentFormProps) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);

  const [squareFeet, setSquareFeet] = useState(String(job.squareFeet));
  const [bedrooms, setBedrooms] = useState(String(job.bedrooms));
  const [bathrooms, setBathrooms] = useState(String(job.bathrooms));
  const [addOns, setAddOns] = useState<QuoteAddOnInput[]>(job.addOns);
  const [note, setNote] = useState('');

  /**
   * LO CONTRATADO CAMBIA BAJO LOS PIES DE ESTA PANTALLA.
   *
   * ========================================================================
   * HACE FALTA DESDE QUE LA PWA SE REFRESCA SOLA
   * ========================================================================
   * Estos campos arrancan con lo que dice la reserva, y hasta la Etapa 3.8
   * eso no se movia mientras la pantalla estaba abierta. Ahora si: cuando
   * coordinacion aprueba una correccion, la reserva pasa a decir 1.300 pies
   * donde decia 900, y el sondeo lo trae.
   *
   * Sin esto, el formulario se quedaria con el 900 de cuando se monto, y
   * volver a abrirlo propondria «de 1.300 a 900» —deshacer la correccion que
   * se acaba de aprobar— sin que nadie lo hubiera pedido.
   *
   * NO SE TOCA MIENTRAS ESTA ABIERTO: un refresco no puede borrar lo que
   * alguien esta tecleando de pie en una cocina. Se sincroniza al cerrarse,
   * que es cuando no hay nada que perder.
   */
  const contratado = [
    job.squareFeet,
    job.bedrooms,
    job.bathrooms,
    job.addOns.map((e) => `${e.code}:${e.quantity}`).join(','),
  ].join('|');

  useEffect(() => {
    if (abierto) return;
    setSquareFeet(String(job.squareFeet));
    setBedrooms(String(job.bedrooms));
    setBathrooms(String(job.bathrooms));
    setAddOns(job.addOns);
  }, [contratado, abierto]);

  const abierta = job.adjustments.find((a) => a.state === 'PROPOSED');
  /**
   * Si en este trabajo ya se aprobo una correccion.
   *
   * Que exista significa que la reserva YA dice lo que hay en la casa y que
   * alguien ya decidio lo que cuesta: el asunto esta cerrado, y la pantalla
   * tiene que parecerlo.
   */
  const aplicada = job.adjustments.find((a) => a.state === 'APPLIED');
  const ultima = job.adjustments[0];

  /*
   * SOLO EL RESPONSABLE, Y SOLO DESPUES DE FICHAR.
   *
   * Las dos condiciones son las MISMAS que comprueba el servidor, y vienen
   * calculadas de alli (`iAmLead`, `iHaveArrived`). Con reglas propias, la
   * pantalla acabaria ofreciendo un boton que la API rechaza, y nadie
   * sabria explicar por que.
   */
  if (!job.iAmLead) return null;

  /* Lo ya reportado se ve aunque no se pueda reportar mas. */
  const historial = ultima ? <Reportado ajuste={ultima} /> : null;

  if (!job.iHaveArrived) {
    return (
      <>
        {historial}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('admin.myJobs.adjustment.needsArrival')}
        </p>
      </>
    );
  }

  if (abierta) {
    /*
     * Con una propuesta esperando no se ofrece otra. Mandar una segunda
     * sustituye a la primera —el servidor lo admite a proposito, porque el
     * responsable puede medir otra vez— pero ofrecerlo por defecto invita a
     * mandar tres versiones de lo mismo y a que coordinacion no sepa cual
     * mirar.
     */
    return <Reportado ajuste={abierta} />;
  }

  const enviar = async (): Promise<void> => {
    const cambios: FieldAdjustmentInput = { note: note.trim() };

    /*
     * SOLO VIAJA LO QUE DE VERDAD CAMBIA. Un campo igual a lo contratado se
     * deja fuera: el contrato lo trata como «esto sigue igual», y mandarlo
     * todo haria imposible distinguir «lo miré y está bien» de «ni lo toqué».
     */
    const pies = Number(squareFeet);
    if (Number.isFinite(pies) && pies !== job.squareFeet) cambios.squareFeet = pies;

    const hab = Number(bedrooms);
    if (Number.isFinite(hab) && hab !== job.bedrooms) cambios.bedrooms = hab;

    const banos = Number(bathrooms);
    if (Number.isFinite(banos) && banos !== job.bathrooms) cambios.bathrooms = banos;

    if (!mismosExtras(job.addOns, addOns)) cambios.addOns = addOns;

    await onEnviar(cambios);
    setAbierto(false);
    setNote('');
  };

  const algoCambia =
    Number(squareFeet) !== job.squareFeet ||
    Number(bedrooms) !== job.bedrooms ||
    Number(bathrooms) !== job.bathrooms ||
    !mismosExtras(job.addOns, addOns);

  return (
    <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
      {historial}

      {!abierto ? (
        /*
         * ========================================================================
         * CON UNA CORRECCION YA APROBADA, EL BOTON GRANDE DESAPARECE
         * ========================================================================
         * Dejar «Esto no es lo que pone la reserva» a tamaño completo despues de
         * que administracion haya puesto el precio hace parecer que el asunto
         * sigue sin resolver, y lo esta: la reserva ya dice lo que hay en la casa
         * y alguien ya decidio lo que cuesta.
         *
         * PERO NO SE QUITA DEL TODO, y esa es la parte pensada. Corregir los pies
         * cuadrados y descubrir DESPUES que hay tres neveras es un caso normal:
         * se mide al entrar y la cocina se ve mas tarde. Sin salida alguna, al
         * equipo solo le quedaria llamar por telefono, que es justo el camino que
         * esta pantalla existe para evitar.
         *
         * Queda como un enlace pequeño: cuesta encontrarlo a proposito, no se
         * pulsa por error, y esta ahi cuando de verdad hace falta.
         */
        aplicada ? (
          <button
            type="button"
            /*
             * DISCRETO NO ES LO MISMO QUE DIFICIL DE PULSAR.
             *
             * La primera version media 28 px de alto, y la regla de esta
             * pantalla son 44: se usa de pie, con una mano y a veces con
             * guantes. Lo que tiene que ser pequeño es la LETRA —para que no
             * compita con el resto de la tarjeta—, no el blanco de dedo.
             */
            className="flex min-h-11 w-full items-center justify-center text-xs font-medium text-slate-500 underline underline-offset-2 dark:text-slate-400"
            onClick={() => setAbierto(true)}
          >
            {t('admin.myJobs.adjustment.openAgain')}
          </button>
        ) : (
          <button
            type="button"
            className="ft-btn-ghost w-full justify-center py-2.5 text-sm"
            onClick={() => setAbierto(true)}
          >
            <AlertIcon className="h-4 w-4" />
            {t('admin.myJobs.adjustment.open')}
          </button>
        )
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('admin.myJobs.adjustment.title')}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {t('admin.myJobs.adjustment.intro')}
            </p>
          </div>

          <Numero
            etiqueta={t('admin.myJobs.adjustment.squareFeet')}
            contratado={job.squareFeet}
            valor={squareFeet}
            onChange={setSquareFeet}
          />
          <div className="grid grid-cols-2 gap-3">
            <Numero
              etiqueta={t('admin.myJobs.adjustment.bedrooms')}
              contratado={job.bedrooms}
              valor={bedrooms}
              onChange={setBedrooms}
            />
            <Numero
              etiqueta={t('admin.myJobs.adjustment.bathrooms')}
              contratado={job.bathrooms}
              valor={bathrooms}
              onChange={setBathrooms}
            />
          </div>

          {job.addOns.length > 0 && (
            <div>
              <p className="ft-label">{t('admin.myJobs.adjustment.addOns')}</p>
              <ul className="space-y-2">
                {job.addOns.map((extra) => (
                  <Extra
                    key={extra.code}
                    code={extra.code}
                    contratada={extra.quantity}
                    cantidad={addOns.find((a) => a.code === extra.code)?.quantity ?? 0}
                    onChange={(cantidad) =>
                      setAddOns((actual) => cambiarCantidad(actual, extra.code, cantidad))
                    }
                  />
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="ft-label" htmlFor={`nota-${job.bookingId}`}>
              {t('admin.myJobs.adjustment.note')}
            </label>
            <textarea
              id={`nota-${job.bookingId}`}
              className="ft-input min-h-20 w-full"
              value={note}
              maxLength={1000}
              placeholder={t('admin.myJobs.adjustment.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            {/*
              El motivo es obligatorio y se dice POR QUE, no solo que falta:
              lo lee alguien que no estuvo en la casa y que va a tener que
              llamar al cliente con ello en la mano.
            */}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.myJobs.adjustment.noteWhy')}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="ft-btn-ghost flex-1 justify-center py-2.5"
              disabled={enviando}
              onClick={() => setAbierto(false)}
            >
              {t('admin.myJobs.adjustment.cancel')}
            </button>
            <button
              type="button"
              className="ft-btn-primary flex-1 justify-center py-2.5"
              disabled={enviando || !algoCambia || note.trim().length === 0}
              onClick={() => void enviar()}
            >
              {enviando ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
              {t('admin.myJobs.adjustment.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Un número, con lo contratado al lado.
 *
 * LO CONTRATADO SE VE SIEMPRE, incluso mientras se teclea encima. Es lo que
 * convierte «1300» en «de 900 a 1300», que es la diferencia entre teclear una
 * cifra y darse cuenta de que uno se ha comido un cero.
 */
function Numero({
  etiqueta,
  contratado,
  valor,
  onChange,
}: {
  etiqueta: string;
  contratado: number;
  valor: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const cambiado = Number(valor) !== contratado;

  return (
    <div>
      <label className="ft-label">{etiqueta}</label>
      <input
        /*
         * `inputMode="numeric"` y no `type="number"`: en el movil abre el
         * teclado de cifras igual, y no trae las flechitas de incremento, que
         * a 390 px son dos blancos de dedo al lado del campo.
         */
        type="text"
        inputMode="numeric"
        className="ft-input w-full"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {cambiado
          ? t('admin.myJobs.adjustment.wasBooked', { value: contratado })
          : t('admin.myJobs.adjustment.asBooked')}
      </p>
    </div>
  );
}

/** Un extra contratado, con su cantidad corregible. Cero significa que no hay. */
function Extra({
  code,
  contratada,
  cantidad,
  onChange,
}: {
  code: string;
  contratada: number;
  cantidad: number;
  onChange: (cantidad: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-900 dark:text-slate-100">{t(`addOns.${code}`)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {cantidad === contratada
            ? t('admin.myJobs.adjustment.asBooked')
            : t('admin.myJobs.adjustment.wasBooked', { value: contratada })}
        </p>
      </div>

      {/*
        Botones de más y menos, no un campo de texto: con guantes se acierta
        un botón de 44 px y no se acierta un cursor dentro de un campo. Y los
        números reales aquí son 1, 2 o 3.
      */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="ft-btn-ghost h-11 w-11 justify-center p-0 text-lg"
          aria-label={t('admin.myJobs.adjustment.fewer')}
          disabled={cantidad === 0}
          onClick={() => onChange(cantidad - 1)}
        >
          −
        </button>
        <span className="w-6 text-center text-base font-semibold tabular-nums">{cantidad}</span>
        <button
          type="button"
          className="ft-btn-ghost h-11 w-11 justify-center p-0 text-lg"
          aria-label={t('admin.myJobs.adjustment.more')}
          disabled={cantidad >= 50}
          onClick={() => onChange(cantidad + 1)}
        >
          +
        </button>
      </div>
    </li>
  );
}

/**
 * Lo ya reportado y en qué quedó.
 *
 * EL MOTIVO DEL RECHAZO SE VE, y es lo más importante de todo el componente:
 * un rechazo mudo enseña a no volver a reportar nada, y entonces se pierde el
 * dato de verdad.
 */
function Reportado({ ajuste }: { ajuste: MyJobAdjustment }) {
  const { t } = useTranslation();

  const color =
    ajuste.state === 'APPLIED'
      ? 'border-green-600 bg-green-50 dark:border-green-700 dark:bg-night-700'
      : ajuste.state === 'REJECTED'
        ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-night-700'
        : 'border-sun-400 bg-sun-50 dark:border-sun-600 dark:bg-night-700';

  return (
    <div className={`mb-3 rounded-lg border p-3 ${color}`}>
      <p className="text-xs font-bold tracking-wide text-slate-800 uppercase dark:text-slate-200">
        {t(`admin.myJobs.adjustment.state.${ajuste.state}`)}
      </p>
      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
        {t('admin.myJobs.adjustment.reportedSize', {
          from: ajuste.booked.squareFeet,
          to: ajuste.found.squareFeet,
        })}
      </p>
      {ajuste.resolutionNote !== null && (
        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{ajuste.resolutionNote}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function cambiarCantidad(
  actual: QuoteAddOnInput[],
  code: string,
  cantidad: number,
): QuoteAddOnInput[] {
  /*
   * CERO SE QUITA DE LA LISTA, no se guarda como «cantidad 0». El contrato
   * exige cantidad mínima 1, y un extra con cero es la forma de decir que ese
   * extra no está: la lista lo dice mejor no teniéndolo.
   */
  if (cantidad <= 0) return actual.filter((extra) => extra.code !== code);

  if (actual.some((extra) => extra.code === code)) {
    return actual.map((extra) => (extra.code === code ? { ...extra, quantity: cantidad } : extra));
  }
  return [...actual, { code: code as QuoteAddOnInput['code'], quantity: cantidad }];
}

/** Dos listas de extras son iguales si tienen los mismos códigos y cantidades. */
function mismosExtras(a: readonly QuoteAddOnInput[], b: readonly QuoteAddOnInput[]): boolean {
  if (a.length !== b.length) return false;

  const porCodigo = new Map(a.map((extra) => [extra.code, extra.quantity]));
  return b.every((extra) => porCodigo.get(extra.code) === extra.quantity);
}
