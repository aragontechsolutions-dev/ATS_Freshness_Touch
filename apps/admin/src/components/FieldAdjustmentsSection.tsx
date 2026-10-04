import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminBookingDetail, FieldAdjustment, Locale, StaffRole } from '@freshness/types';
import { formatCents } from '../lib/format';
import { formatTimestamp } from '../lib/format';
import { AlertIcon, CheckIcon, CloseIcon, SpinnerIcon } from './Icons';

/**
 * LO QUE EL EQUIPO ENCONTRO EN LA CASA
 * ====================================
 * Donde coordinación decide si la corrección del responsable se cobra o no.
 *
 * ========================================================================
 * APROBAR AQUI ES LO UNICO DEL SISTEMA QUE MUEVE UN PRECIO YA PACTADO
 * ========================================================================
 * Hasta la Etapa 3.6, el precio de una reserva estaba congelado desde que se
 * contrataba y ni esta pantalla podía tocarlo. Por eso el botón dice lo que
 * va a pasar —«cobrar la diferencia»— y no un «guardar» que no compromete a
 * nada.
 *
 * ========================================================================
 * LAS DOS COLUMNAS, Y POR QUE NO BASTA CON LA NUEVA
 * ========================================================================
 * Se enseña «900 → 1.300», no «1.300». Quien decide necesita ver el SALTO:
 * «1.300» no dice nada, «900 → 1.300» dice que el cliente se equivocó en 400
 * pies, y «900 → 13.000» dice que alguien se comió una tecla. Esa última es
 * la que esta pantalla existe para parar.
 */

interface FieldAdjustmentsSectionProps {
  booking: AdminBookingDetail;
  role: StaffRole;
  locale: Locale;
  onResolver: (adjustmentId: string, approve: boolean, note?: string) => Promise<void>;
}

export function FieldAdjustmentsSection({
  booking,
  role,
  locale,
  onResolver,
}: FieldAdjustmentsSectionProps) {
  const { t } = useTranslation();

  // Sin ajustes no se pinta nada: es el caso normal de casi todos los trabajos.
  if (booking.adjustments.length === 0) return null;

  return (
    <section className="ft-card p-5">
      <h2 className="ft-h2 mb-4 flex items-center gap-2">
        <AlertIcon className="h-5 w-5 text-brand-700 dark:text-brand-400" />
        {t('admin.adjustments.title')}
      </h2>

      <ul className="space-y-4">
        {booking.adjustments.map((ajuste) => (
          <Ajuste
            key={ajuste.id}
            ajuste={ajuste}
            role={role}
            locale={locale}
            onResolver={onResolver}
          />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function Ajuste({
  ajuste,
  role,
  locale,
  onResolver,
}: {
  ajuste: FieldAdjustment;
  role: StaffRole;
  locale: Locale;
  onResolver: (adjustmentId: string, approve: boolean, note?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const abierta = ajuste.state === 'PROPOSED';
  /**
   * SEGUNDO CERROJO, NO EL UNICO.
   *
   * El endpoint del detalle ya es `@Roles('ADMIN', 'DISPATCHER')`, asi que
   * una cuenta de limpieza no llega siquiera a esta pantalla. Esto no suple
   * esa guardia: la acompaña, para que el dia que el detalle se abra a mas
   * roles —o se incruste en otra pantalla— los botones que mueven un precio
   * no viajen con el.
   */
  const puedeDecidir = role === 'ADMIN' || role === 'DISPATCHER';

  const resolver = async (approve: boolean): Promise<void> => {
    setOcupado(true);
    try {
      await onResolver(ajuste.id, approve, approve ? undefined : motivo.trim());
      setRechazando(false);
      setMotivo('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('admin.adjustments.reportedBy', {
            name: ajuste.proposedByFirstName,
            when: formatTimestamp(ajuste.proposedAt, locale),
          })}
        </p>
        <Estado state={ajuste.state} />
      </div>

      <dl className="mt-3 space-y-1.5">
        <Cambio
          etiqueta={t('admin.adjustments.squareFeet')}
          de={ajuste.booked.squareFeet}
          a={ajuste.found.squareFeet}
        />
        <Cambio
          etiqueta={t('admin.adjustments.bedrooms')}
          de={ajuste.booked.bedrooms}
          a={ajuste.found.bedrooms}
        />
        <Cambio
          etiqueta={t('admin.adjustments.bathrooms')}
          de={ajuste.booked.bathrooms}
          a={ajuste.found.bathrooms}
        />
        {extrasCambiados(ajuste).map(({ code, de, a }) => (
          <Cambio key={code} etiqueta={t(`addOns.${code}`)} de={de} a={a} />
        ))}
      </dl>

      {/* Lo que escribió quien estuvo allí. Es con lo que se llama al cliente. */}
      <p className="mt-3 rounded bg-slate-50 p-2.5 text-sm text-slate-700 dark:bg-night-700 dark:text-slate-300">
        {ajuste.note}
      </p>

      <Importe ajuste={ajuste} locale={locale} />

      {ajuste.resolutionNote !== null && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.adjustments.resolvedNote', {
            name: ajuste.resolvedByFirstName ?? '',
            note: ajuste.resolutionNote,
          })}
        </p>
      )}

      {abierta && puedeDecidir && (
        <div className="mt-4">
          {!rechazando ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ft-btn-primary"
                /*
                 * Sin precio automatico no se puede aprobar: el importe lo
                 * tendria que poner alguien a mano, y eso todavia no existe.
                 * Se deshabilita en vez de esconderlo para que se vea que la
                 * opcion existe y por que no se puede usar.
                 */
                disabled={ocupado || ajuste.newTotalCents === null}
                onClick={() => void resolver(true)}
              >
                {ocupado ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
                {t('admin.adjustments.approve')}
              </button>
              <button
                type="button"
                className="ft-btn-ghost"
                disabled={ocupado}
                onClick={() => setRechazando(true)}
              >
                <CloseIcon className="h-4 w-4" />
                {t('admin.adjustments.reject')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="ft-label" htmlFor={`motivo-${ajuste.id}`}>
                {t('admin.adjustments.rejectReason')}
              </label>
              {/*
                EL MOTIVO ES OBLIGATORIO, y no es burocracia: un rechazo sin
                explicacion deja al equipo sin saber si midio mal o si la
                empresa decidio comerse la diferencia. La proxima vez no lo
                reportara, y entonces se pierde el dato de verdad.
              */}
              <textarea
                id={`motivo-${ajuste.id}`}
                className="ft-input min-h-16 w-full"
                value={motivo}
                maxLength={1000}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="ft-btn-ghost"
                  disabled={ocupado}
                  onClick={() => setRechazando(false)}
                >
                  {t('admin.myJobs.adjustment.cancel')}
                </button>
                <button
                  type="button"
                  className="ft-btn-primary"
                  disabled={ocupado || motivo.trim().length === 0}
                  onClick={() => void resolver(false)}
                >
                  {t('admin.adjustments.confirmReject')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Una línea «de X a Y». Solo se pinta si de verdad cambia. */
function Cambio({ etiqueta, de, a }: { etiqueta: string; de: number; a: number }) {
  if (de === a) return null;

  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="text-slate-600 dark:text-slate-400">{etiqueta}</dt>
      <dd className="font-medium text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 line-through dark:text-slate-500">{de}</span>
        <span className="mx-1.5" aria-hidden="true">
          →
        </span>
        <span>{a}</span>
      </dd>
    </div>
  );
}

function Estado({ state }: { state: FieldAdjustment['state'] }) {
  const { t } = useTranslation();

  const color =
    state === 'APPLIED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : state === 'PROPOSED'
        ? 'bg-sun-100 text-slate-900 dark:bg-sun-900 dark:text-sun-100'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200';

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {t(`admin.adjustments.state.${state}`)}
    </span>
  );
}

/**
 * La diferencia, en dinero.
 *
 * `null` NO ES CERO, y el texto lo dice: una casa por encima del último tramo
 * de la tabla no tiene precio automático, y el importe lo tiene que calcular
 * una persona. Enseñar «0 $» ahí diría «no cambia nada», que es lo contrario.
 */
function Importe({ ajuste, locale }: { ajuste: FieldAdjustment; locale: Locale }) {
  const { t } = useTranslation();

  if (ajuste.differenceCents === null || ajuste.newTotalCents === null) {
    return (
      <p className="mt-3 flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {t('admin.adjustments.noAutoPrice')}
      </p>
    );
  }

  const sube = ajuste.differenceCents > 0;

  return (
    <p className="mt-3 text-sm">
      <span className="text-slate-600 dark:text-slate-400">{t('admin.adjustments.newTotal')} </span>
      <span className="font-semibold text-slate-900 dark:text-white">
        {formatCents(ajuste.newTotalCents, locale)}
      </span>
      <span
        className={
          sube
            ? 'ml-2 font-semibold text-amber-700 dark:text-amber-400'
            : 'ml-2 font-semibold text-green-700 dark:text-green-400'
        }
      >
        {sube ? '+' : '−'}
        {formatCents(Math.abs(ajuste.differenceCents), locale)}
      </span>
    </p>
  );
}

/** Los extras cuya cantidad cambia, con lo contratado y lo encontrado. */
function extrasCambiados(ajuste: FieldAdjustment): { code: string; de: number; a: number }[] {
  const contratados = new Map(ajuste.booked.addOns.map((e) => [e.code, e.quantity]));
  const encontrados = new Map(ajuste.found.addOns.map((e) => [e.code, e.quantity]));
  const codigos = new Set([...contratados.keys(), ...encontrados.keys()]);

  return [...codigos]
    .map((code) => ({ code, de: contratados.get(code) ?? 0, a: encontrados.get(code) ?? 0 }))
    .filter((fila) => fila.de !== fila.a);
}
