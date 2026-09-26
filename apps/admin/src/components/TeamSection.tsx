import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API_ERROR_CODES,
  staffFullName,
  type AdminAssignment,
  type AdminBookingDetail,
  type AdminStaffOption,
  type AuthenticatedStaff,
} from '@freshness/types';
import { ApiClientError, fetchAssignableStaff, saveAssignments } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonSelectorEquipo } from './Skeletons';
import { SpinnerIcon, UsersIcon } from './Icons';

interface TeamSectionProps {
  booking: AdminBookingDetail;
  staff: AuthenticatedStaff;
  onUpdated: (booking: AdminBookingDetail) => void;
  onSessionLost: () => void;
}

/**
 * QUIEN VA A ESTE TRABAJO
 * -----------------------
 * Hasta ahora la agenda decia que hay que limpiar y cuando, pero quien iba se
 * organizaba por fuera. Lo que se organiza por fuera se olvida.
 *
 * LA LISTA DE PERSONAL SE PIDE SOLO AL PULSAR "cambiar". El detalle de una
 * reserva se abre muchas veces al dia y casi siempre solo para mirar; pedir
 * la plantilla entera en cada apertura serian cientos de peticiones diarias
 * para pintar un selector que casi nadie abre.
 *
 * EL RESPONSABLE ES UN BOTON DE RADIO Y NO UNA CASILLA. Con casillas se puede
 * marcar a dos, y el servidor lo rechazaria con un error despues de haber
 * rellenado el formulario entero. Con radio, el propio control impide el
 * estado invalido: marcar a uno desmarca al anterior.
 */
export function TeamSection({ booking, staff, onUpdated, onSessionLost }: TeamSectionProps) {
  const { t } = useTranslation();

  const [editando, setEditando] = useState(false);
  const [personal, setPersonal] = useState<AdminStaffOption[] | null>(null);
  const [seleccion, setSeleccion] = useState<AdminAssignment[]>([]);
  const [guardando, setGuardando] = useState(false);
  const toast = useToast();

  /*
   * Coordinacion y administracion reparten trabajos. Limpieza no: asignarse
   * trabajos a uno mismo cambia quien cobra que y de quien es la
   * responsabilidad si algo sale mal en esa casa.
   *
   * Esto solo decide si se PINTA el boton. La puerta la cierra el servidor,
   * que responde 403 igual aunque alguien llame a la API por su cuenta.
   */
  const puedeCambiar = staff.role === 'ADMIN' || staff.role === 'DISPATCHER';
  // A una reserva cancelada no va nadie, y el servidor tambien lo rechaza.
  const cancelada = booking.status === 'CANCELLED';

  const abrir = async (): Promise<void> => {
    setSeleccion(booking.assignedStaff.map((p) => ({ staffId: p.staffId, isLead: p.isLead })));
    setEditando(true);

    // Una vez cargada se reutiliza: la plantilla no cambia mientras dura la
    // pantalla, y recargarla en cada apertura seria gastar por gusto.
    if (personal) return;

    try {
      setPersonal((await fetchAssignableStaff()).staff);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
      setEditando(false);
    }
  };

  const alternar = (staffId: string): void => {
    setSeleccion((actual) => {
      const yaEsta = actual.some((a) => a.staffId === staffId);
      if (yaEsta) return actual.filter((a) => a.staffId !== staffId);
      return [...actual, { staffId, isLead: false }];
    });
  };

  const marcarResponsable = (staffId: string): void => {
    // Se apaga a todos y se enciende a uno: no hay estado intermedio con dos.
    setSeleccion((actual) => actual.map((a) => ({ ...a, isLead: a.staffId === staffId })));
  };

  const guardar = async (): Promise<void> => {
    setGuardando(true);

    try {
      onUpdated(await saveAssignments(booking.bookingId, seleccion));
      setEditando(false);
      toast.success('admin.toast.teamSaved');
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      if (error instanceof ApiClientError) {
        /*
         * El choque de horarios es el unico error que trae datos que sirven
         * para arreglarlo: quien choca y con que reserva. Van como detalle
         * del aviso, en texto plano, porque son un nombre y una referencia y
         * no hay frase traducible que los contenga.
         */
        const detalle =
          error.code === API_ERROR_CODES.STAFF_DOUBLE_BOOKED
            ? (error.fields?.[0]?.message ?? undefined)
            : undefined;
        toast.error(error.messageKey, { detail: detalle });
      } else {
        toast.error('admin.errorGeneric');
      }
      // El formulario NO se cierra: se deja lo elegido para poder corregir
      // solo a quien choca en vez de rehacer el equipo entero.
    } finally {
      setGuardando(false);
    }
  };

  const elegido = (staffId: string): AdminAssignment | undefined =>
    seleccion.find((a) => a.staffId === staffId);

  return (
    <section className="ft-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <UsersIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          {t('admin.team')}
        </h2>

        {puedeCambiar && !editando && !cancelada && (
          <button type="button" className="ft-btn-ghost" onClick={() => void abrir()}>
            {booking.assignedStaff.length > 0 ? t('admin.teamChange') : t('admin.teamAssign')}
          </button>
        )}
      </div>

      {!editando && (
        <>
          {booking.assignedStaff.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.teamEmpty')}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {booking.assignedStaff.map((persona) => (
                <li key={persona.staffId} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {persona.name}
                  </span>
                  {persona.isLead && (
                    <span className="rounded-full bg-sun-100 px-2 py-0.5 text-xs font-bold text-slate-800 dark:bg-night-700 dark:text-sun-200">
                      {t('admin.teamLead')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/*
           * Un equipo sin responsable no es invalido, pero si es un descuido
           * que conviene ver: si surge un imprevisto en la casa, nadie sabe
           * quien decide.
           */}
          {booking.assignedStaff.length > 1 &&
            !booking.assignedStaff.some((persona) => persona.isLead) && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('admin.teamNoLeadWarning')}
              </p>
            )}

          {cancelada && booking.assignedStaff.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('admin.teamCancelledNote')}
            </p>
          )}
        </>
      )}

      {editando && (
        <div className="space-y-3">
          {!personal ? (
            <SkeletonSelectorEquipo />
          ) : personal.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.teamNoStaff')}</p>
          ) : (
            <ul className="space-y-2">
              {personal.map((persona) => {
                const asignada = elegido(persona.staffId);
                return (
                  <li
                    key={persona.staffId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 last:border-0 dark:border-night-600"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={asignada !== undefined}
                        disabled={guardando}
                        onChange={() => alternar(persona.staffId)}
                      />
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {staffFullName(persona)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t(`admin.role.${persona.role}`)}
                      </span>
                    </label>

                    {/* El responsable solo se puede elegir entre quienes van. */}
                    {asignada !== undefined && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <input
                          type="radio"
                          className="h-4 w-4"
                          name={`responsable-${booking.bookingId}`}
                          checked={asignada.isLead}
                          disabled={guardando}
                          onChange={() => marcarResponsable(persona.staffId)}
                        />
                        {t('admin.teamLead')}
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">{t('admin.teamHelp')}</p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ft-btn-primary"
              disabled={guardando || !personal}
              onClick={() => void guardar()}
            >
              {guardando && <SpinnerIcon className="h-4 w-4" />}
              {guardando ? t('admin.working') : t('admin.teamSave')}
            </button>
            <button
              type="button"
              className="ft-btn-ghost"
              disabled={guardando}
              onClick={() => setEditando(false)}
            >
              {t('admin.teamDiscard')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
