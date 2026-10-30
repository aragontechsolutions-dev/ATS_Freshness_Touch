import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RESCHEDULE_FREE_NOTICE_HOURS,
  canReschedule,
  isLateReschedule,
  type AdminBookingDetail,
  type AuthenticatedStaff,
} from '@freshness/types';
import { ApiClientError, isSessionError, rescheduleBooking } from '../lib/api';
import { AlertIcon, SpinnerIcon } from './Icons';

interface MoverCitaProps {
  booking: AdminBookingDetail;
  staff: AuthenticatedStaff;
  onMovida: (booking: AdminBookingDetail) => void;
  onSessionLost: () => void;
}

/**
 * MOVER LA CITA
 * =============
 * Lo que hasta ahora se hacia cancelando y creando otra, que no es lo mismo:
 * perdia el historial, cambiaba la referencia que el cliente tiene por
 * escrito y dejaba la retencion colgando de una cita cancelada.
 *
 * ========================================================================
 * EL AVISO DE LAS 24 HORAS SE PINTA ANTES DE MOVER, NO DESPUES
 * ========================================================================
 * Y es la razon de que este calculo viva en el panel ademas de en el
 * servidor. El servidor sabe si el movimiento llego tarde y lo anota, pero
 * eso no le sirve de nada a quien esta al telefono con el cliente: para
 * entonces ya esta hecho.
 *
 * Lo que hace falta es saberlo MIENTRAS se decide, porque cambia lo que se
 * le dice por telefono: con mas de 24 horas es gratis, y por debajo la
 * empresa tiene derecho a cobrar los 35 dolares del deposito.
 *
 * ========================================================================
 * ESTO NO COBRA NADA
 * ========================================================================
 * Ni aqui ni en el servidor. Son dos decisiones, igual que al cancelar:
 * mover la agenda lo hace coordinacion, cobrar lo hace administracion con el
 * boton de abajo. Lo que si queda es la nota: el registro de actividad
 * guarda que ese movimiento llego tarde, para que al revisar el mes se vea
 * cual daba derecho a cobrar.
 */
export function MoverCita({ booking, staff, onMovida, onSessionLost }: MoverCitaProps) {
  const { t } = useTranslation();

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');
  const [motivo, setMotivo] = useState('');
  const [fueraDeHorario, setFueraDeHorario] = useState(false);
  const [doblarEquipo, setDoblarEquipo] = useState(false);
  const [avisar, setAvisar] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /*
   * NI EMPEZADA NI TERMINADA NI CANCELADA. La regla es del contrato, la
   * misma que aplica el servidor: aqui solo se evita ofrecer un formulario
   * que va a fallar al enviarse.
   */
  if (!canReschedule(booking.status)) return null;

  const tarde = isLateReschedule(new Date(booking.scheduledStart), new Date());

  /*
   * El motivo es obligatorio en cuanto se salta una norma, y tambien cuando
   * el movimiento llega tarde: eso da derecho a cobrar 35 dolares, y lo que
   * cuesta dinero se explica en el momento. El servidor lo exige igual; esto
   * evita el viaje.
   */
  const motivoObligatorio = tarde || fueraDeHorario || doblarEquipo;
  const faltaMotivo = motivoObligatorio && motivo.trim().length < 3;
  const faltaFecha = fecha === '' || hora === '';

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    if (guardando || faltaFecha || faltaMotivo) return;

    setGuardando(true);
    setErrorKey(null);

    try {
      const actualizada = await rescheduleBooking(booking.bookingId, {
        /*
         * La hora se interpreta en la zona del NAVEGADOR, igual que al meter
         * una reserva a mano. Quien usa el panel esta en Georgia, que es la
         * zona de la empresa; si algun dia deja de serlo, las dos pantallas
         * tendran que cambiar juntas.
         */
        startsAt: new Date(`${fecha}T${hora}`).toISOString(),
        allowOutsideHours: fueraDeHorario,
        allowOverlap: doblarEquipo,
        notifyCustomer: avisar,
        reason: motivo.trim(),
      });
      onMovida(actualizada);
      setFecha('');
      setMotivo('');
      setFueraDeHorario(false);
      setDoblarEquipo(false);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ft-card space-y-4 p-5" onSubmit={(evento) => void enviar(evento)}>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t('admin.reschedule.title')}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t('admin.reschedule.subtitle')}
        </p>
      </div>

      {tarde && (
        /*
         * EN AMBAR Y CON TEXTO, no solo con color: la regla de siempre de
         * este panel. Y con `role="status"` para que un lector de pantalla
         * lo cuente al aparecer, porque aparece sin que nadie lo pida.
         */
        <p
          className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
          role="status"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('admin.reschedule.lateWarning', { hours: RESCHEDULE_FREE_NOTICE_HOURS })}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ft-label" htmlFor="mover-fecha">
            {t('admin.reschedule.date')}
          </label>
          <input
            id="mover-fecha"
            type="date"
            className="ft-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="ft-label" htmlFor="mover-hora">
            {t('admin.reschedule.time')}
          </label>
          <input
            id="mover-hora"
            type="time"
            className="ft-input"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            required
          />
          {/* La duracion no cambia: lo que se mueve es el principio. */}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('admin.reschedule.sameDuration')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={fueraDeHorario}
            onChange={(e) => setFueraDeHorario(e.target.checked)}
          />
          <span>{t('admin.reschedule.outsideHours')}</span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={doblarEquipo}
            onChange={(e) => setDoblarEquipo(e.target.checked)}
          />
          <span>{t('admin.reschedule.allowOverlap')}</span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={avisar}
            onChange={(e) => setAvisar(e.target.checked)}
          />
          <span>{t('admin.reschedule.notify')}</span>
        </label>
        {!avisar && (
          /*
           * Se dice en cuanto se desmarca, no al final: una cita que cambia
           * de hora sin que el cliente lo sepa es una casa vacia cuando
           * llega el equipo, o alguien esperando una manana entera.
           */
          <p className="pl-6 text-xs text-amber-700 dark:text-amber-300">
            {t('admin.reschedule.notifyOffWarning')}
          </p>
        )}
      </div>

      <div>
        <label className="ft-label" htmlFor="mover-motivo">
          {motivoObligatorio
            ? t('admin.reschedule.reasonRequired')
            : t('admin.reschedule.reasonOptional')}
        </label>
        <input
          id="mover-motivo"
          className="ft-input"
          placeholder={t('admin.reschedule.reasonPlaceholder')}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={300}
        />
      </div>

      {errorKey !== null && (
        <p
          className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t(errorKey)}</span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="ft-btn-primary"
          disabled={guardando || faltaFecha || faltaMotivo}
        >
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {guardando ? t('admin.working') : t('admin.reschedule.submit')}
        </button>
        {/*
          EL MISMO AVISO, PERO A LA VISTA. Un boton gris que no explica nada
          deja a quien lo mira convencido de que el sistema no deja mover la
          cita. Ya paso con cancelar: ver `reasonMissing`.
        */}
        {faltaMotivo && (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.reschedule.reasonMissing')}
          </span>
        )}
      </div>

      {/* Quien no es administracion no ve el boton de cobrar: que lo tardio
          da derecho a cobrar hay que decirlo igual, porque es lo que tiene
          que contarle a administracion. */}
      {tarde && staff.role !== 'ADMIN' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('admin.reschedule.lateNotAdmin')}
        </p>
      )}
    </form>
  );
}
