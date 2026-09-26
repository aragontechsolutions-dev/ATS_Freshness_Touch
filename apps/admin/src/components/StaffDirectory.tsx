import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LocaleSchema,
  StaffRoleSchema,
  formatPhone,
  normalizePhoneInput,
  type AdminStaffDirectoryItem,
  type AuthenticatedStaff,
  type Locale,
  type StaffCreate,
  type StaffUpdate,
} from '@freshness/types';
import {
  ApiClientError,
  createStaff,
  fetchStaffDirectory,
  inviteStaff,
  updateStaff,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonPersonal } from './Skeletons';
import { PencilIcon, PlusIcon, SendIcon, SpinnerIcon, UsersIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface StaffDirectoryProps {
  staff: AuthenticatedStaff;
  locale: Locale;
  onSessionLost: () => void;
}

/** Los campos tal y como se teclean, antes de normalizar. */
interface Borrador {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  locale: string;
  isActive: boolean;
}

const BORRADOR_VACIO: Borrador = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'CLEANER',
  locale: 'en',
  isActive: true,
};

/**
 * PERSONAL
 * --------
 * Hasta ahora, dar de alta a alguien exigia entrar a la base de datos a mano.
 * Eso convertia "contratar" en una tarea del equipo tecnico, que es justo lo
 * que este panel existe para evitar.
 *
 * LA DECISION DE FORMA QUE MAS IMPORTA: dar de alta e invitar son DOS BOTONES
 * DISTINTOS, y el de invitar pregunta antes.
 *
 * Crear una ficha es decir "esta persona trabaja aqui". Invitarla es decir
 * "esta persona puede ver los datos de todos los clientes". Si fueran el mismo
 * formulario, la segunda decision se tomaria por inercia de estar rellenando
 * campos, que es exactamente como se reparten accesos sin querer.
 *
 * EL TELEFONO SE ESCRIBE COMO SE ESCRIBE, igual que en la configuracion del
 * negocio: se teclea "(404) 555-0123" y se guarda en formato internacional.
 */
export function StaffDirectory({ staff, locale, onSessionLost }: StaffDirectoryProps) {
  const { t } = useTranslation();

  const toast = useToast();
  const [personal, setPersonal] = useState<AdminStaffDirectoryItem[] | null>(null);
  const [canInvite, setCanInvite] = useState(false);
  /** Solo el fallo de la CARGA inicial: sin lista no hay nada que gestionar. */
  const [errorKey, setErrorKey] = useState<string | null>(null);

  /** `null` = nada abierto; `'nueva'` = alta; un identificador = edicion. */
  const [abierta, setAbierta] = useState<string | 'nueva' | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO);
  const [ocupado, setOcupado] = useState(false);

  const fallo = (error: unknown): void => {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      onSessionLost();
      return;
    }
    toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric', {
      // El motivo del proveedor, cuando lo hay, ahorra mucho tiempo al
      // configurar: "signups not allowed" se resuelve en un minuto. Va como
      // texto plano dentro del aviso, nunca interpretado.
      detail:
        error instanceof ApiClientError ? (error.fields?.[0]?.message ?? undefined) : undefined,
    });
  };

  useEffect(() => {
    let vigente = true;

    fetchStaffDirectory()
      .then((directorio) => {
        if (!vigente) return;
        setPersonal(directorio.staff);
        setCanInvite(directorio.canInvite);
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        /*
         * La carga inicial no reutiliza `fallo` a proposito: esa funcion se
         * crea de nuevo en cada pintado, asi que meterla en las dependencias
         * volveria a pedir el directorio sin parar.
         */
        if (error instanceof ApiClientError && error.statusCode === 401) {
          onSessionLost();
          return;
        }
        setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
      });

    return () => {
      vigente = false;
    };
  }, [onSessionLost]);

  const abrirAlta = (): void => {
    setBorrador(BORRADOR_VACIO);
    setAbierta('nueva');
  };

  const abrirEdicion = (persona: AdminStaffDirectoryItem): void => {
    setBorrador({
      firstName: persona.firstName,
      lastName: persona.lastName,
      email: persona.email,
      phone: persona.phone ?? '',
      role: persona.role,
      locale: persona.locale,
      isActive: persona.isActive,
    });
    setAbierta(persona.staffId);
  };

  /** Mete la ficha devuelta por el servidor en la lista, sin recargar todo. */
  const asentar = (ficha: AdminStaffDirectoryItem): void => {
    setPersonal((actual) => {
      const resto = (actual ?? []).filter((p) => p.staffId !== ficha.staffId);
      return [...resto, ficha].sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          a.firstName.localeCompare(b.firstName) ||
          a.lastName.localeCompare(b.lastName),
      );
    });
  };

  const guardar = async (): Promise<void> => {
    setOcupado(true);

    // El telefono se normaliza aqui: el contrato solo acepta formato
    // internacional, y vacio significa "no hay", no cadena vacia.
    const telefono = borrador.phone.trim() ? normalizePhoneInput(borrador.phone) : null;
    const role = StaffRoleSchema.catch('CLEANER').parse(borrador.role);
    const locale = LocaleSchema.catch('en').parse(borrador.locale);

    try {
      if (abierta === 'nueva') {
        const datos: StaffCreate = {
          firstName: borrador.firstName.trim(),
          lastName: borrador.lastName.trim(),
          email: borrador.email.trim().toLowerCase(),
          phone: telefono,
          role,
          locale,
        };
        asentar(await createStaff(datos));
      } else if (abierta) {
        const datos: StaffUpdate = {
          firstName: borrador.firstName.trim(),
          lastName: borrador.lastName.trim(),
          email: borrador.email.trim().toLowerCase(),
          phone: telefono,
          role,
          locale,
          isActive: borrador.isActive,
        };
        asentar(await updateStaff(abierta, datos));
      }
      setAbierta(null);
      toast.success('admin.toast.staffSaved');
    } catch (error) {
      // El formulario NO se cierra: se conserva lo tecleado para corregir.
      fallo(error);
    } finally {
      setOcupado(false);
    }
  };

  const invitar = async (persona: AdminStaffDirectoryItem): Promise<void> => {
    /*
     * Se pregunta antes. Es la unica accion de este panel que reparte acceso
     * a los datos de todos los clientes, y no tiene deshacer: la cuenta queda
     * creada en el proveedor aunque luego se de de baja la ficha.
     */
    if (!window.confirm(t('admin.staff.inviteConfirm'))) return;

    setOcupado(true);

    try {
      asentar(await inviteStaff(persona.staffId));
      toast.success('admin.staff.inviteSent');
    } catch (error) {
      fallo(error);
    } finally {
      setOcupado(false);
    }
  };

  if (errorKey) {
    return (
      <section className="ft-card p-5" role="alert">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
      </section>
    );
  }

  if (!personal) {
    return <SkeletonPersonal />;
  }

  const activas = personal.filter((p) => p.isActive);
  const inactivas = personal.filter((p) => !p.isActive);

  return (
    <div className="space-y-4">
      <section className="ft-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <UsersIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              {t('admin.staff.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('admin.staff.intro')}
            </p>
          </div>
          {abierta === null && (
            <button type="button" className="ft-btn-primary" onClick={abrirAlta}>
              <PlusIcon className="h-4 w-4" />
              {t('admin.staff.add')}
            </button>
          )}
        </div>

        {!canInvite && (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.staff.inviteUnavailable')}
          </p>
        )}
      </section>

      {abierta === 'nueva' && (
        <Formulario
          borrador={borrador}
          setBorrador={setBorrador}
          conEstado={false}
          esPropia={false}
          ocupado={ocupado}
          onGuardar={() => void guardar()}
          onDescartar={() => setAbierta(null)}
        />
      )}

      {activas.length === 0 && inactivas.length === 0 ? (
        <section className="ft-card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <UsersIcon className="h-9 w-9 text-slate-400 dark:text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.staff.empty')}</p>
        </section>
      ) : (
        <>
          {activas.map((persona) => (
            <Ficha
              key={persona.staffId}
              persona={persona}
              locale={locale}
              esPropia={persona.staffId === staff.staffId}
              canInvite={canInvite}
              ocupado={ocupado}
              editando={abierta === persona.staffId}
              borrador={borrador}
              setBorrador={setBorrador}
              onEditar={() => abrirEdicion(persona)}
              onGuardar={() => void guardar()}
              onDescartar={() => setAbierta(null)}
              onInvitar={() => void invitar(persona)}
            />
          ))}

          {inactivas.length > 0 && (
            <>
              <h3 className="px-1 pt-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {t('admin.staff.inactiveHeading')}
              </h3>
              {inactivas.map((persona) => (
                <Ficha
                  key={persona.staffId}
                  persona={persona}
                  locale={locale}
                  esPropia={persona.staffId === staff.staffId}
                  canInvite={canInvite}
                  ocupado={ocupado}
                  editando={abierta === persona.staffId}
                  borrador={borrador}
                  setBorrador={setBorrador}
                  onEditar={() => abrirEdicion(persona)}
                  onGuardar={() => void guardar()}
                  onDescartar={() => setAbierta(null)}
                  onInvitar={() => void invitar(persona)}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Ficha({
  persona,
  locale,
  esPropia,
  canInvite,
  ocupado,
  editando,
  borrador,
  setBorrador,
  onEditar,
  onGuardar,
  onDescartar,
  onInvitar,
}: {
  persona: AdminStaffDirectoryItem;
  locale: Locale;
  esPropia: boolean;
  canInvite: boolean;
  ocupado: boolean;
  editando: boolean;
  borrador: Borrador;
  setBorrador: (valor: Borrador) => void;
  onEditar: () => void;
  onGuardar: () => void;
  onDescartar: () => void;
  onInvitar: () => void;
}) {
  const { t } = useTranslation();

  if (editando) {
    return (
      <Formulario
        borrador={borrador}
        setBorrador={setBorrador}
        conEstado
        esPropia={esPropia}
        ocupado={ocupado}
        onGuardar={onGuardar}
        onDescartar={onDescartar}
      />
    );
  }

  const ayudaAcceso =
    persona.access === 'NONE'
      ? t('admin.staff.accessNoneHelp')
      : persona.access === 'INVITED'
        ? t('admin.staff.accessInvitedHelp', {
            date: persona.invitedAt ? formatTimestamp(persona.invitedAt, locale) : '',
          })
        : t('admin.staff.accessLinkedHelp');

  return (
    <section className={`ft-card p-5 ${persona.isActive ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">
            {persona.firstName} {persona.lastName}
            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t(`admin.role.${persona.role}`)}
            </span>
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-300">
            {persona.email}
            {persona.phone && ` · ${formatPhone(persona.phone)}`}
          </p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold">{t(`admin.staff.access${persona.access}`)}</span>
            {' · '}
            {ayudaAcceso}
          </p>
          {esPropia && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.staff.selfNote')}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/*
            Invitar solo aparece donde tiene sentido: alguien activo, sin
            cuenta todavia, y en un despliegue que pueda mandar invitaciones.
            Un boton que se sabe que va a fallar no deberia pintarse.
          */}
          {canInvite && persona.isActive && persona.access === 'NONE' && (
            <button type="button" className="ft-btn-ghost" disabled={ocupado} onClick={onInvitar}>
              <SendIcon className="h-4 w-4" />
              {t('admin.staff.invite')}
            </button>
          )}
          <button type="button" className="ft-btn-ghost" disabled={ocupado} onClick={onEditar}>
            <PencilIcon className="h-4 w-4" />
            {t('admin.staff.edit')}
          </button>
        </div>
      </div>
    </section>
  );
}

function Formulario({
  borrador,
  setBorrador,
  conEstado,
  esPropia,
  ocupado,
  onGuardar,
  onDescartar,
}: {
  borrador: Borrador;
  setBorrador: (valor: Borrador) => void;
  conEstado: boolean;
  esPropia: boolean;
  ocupado: boolean;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  const { t } = useTranslation();
  const telefonoNormalizado = borrador.phone.trim() ? normalizePhoneInput(borrador.phone) : null;

  const completo =
    borrador.firstName.trim().length > 0 &&
    borrador.lastName.trim().length > 0 &&
    borrador.email.trim().length > 0;

  return (
    <section className="ft-card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta={t('admin.staff.firstName')}
          valor={borrador.firstName}
          onChange={(v) => setBorrador({ ...borrador, firstName: v })}
          maxLength={80}
        />
        <Campo
          etiqueta={t('admin.staff.lastName')}
          valor={borrador.lastName}
          onChange={(v) => setBorrador({ ...borrador, lastName: v })}
          maxLength={80}
        />
      </div>

      <div>
        <Campo
          etiqueta={t('admin.staff.email')}
          valor={borrador.email}
          onChange={(v) => setBorrador({ ...borrador, email: v })}
          maxLength={160}
          /*
           * `type="text"` a proposito, no `email`. Con `email`, el navegador
           * bloquea el envio con SU mensaje y en SU idioma, que puede no ser
           * el del panel. La validacion la hace el contrato y el mensaje lo
           * da la aplicacion. Es la misma leccion que el horario.
           */
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('admin.staff.emailHelp')}
        </p>
      </div>

      <div>
        <Campo
          etiqueta={t('admin.staff.phoneOptional')}
          valor={borrador.phone}
          onChange={(v) => setBorrador({ ...borrador, phone: v })}
          maxLength={24}
        />
        {telefonoNormalizado && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatPhone(telefonoNormalizado)}
          </p>
        )}
      </div>

      <div>
        <label className="ft-label" htmlFor="puesto">
          {t('admin.staff.role')}
        </label>
        <select
          id="puesto"
          className="ft-input w-full sm:w-64"
          value={borrador.role}
          /*
           * Nadie se cambia su propio puesto: te dejaria fuera del panel en
           * la siguiente peticion. El servidor lo rechaza igual; esto evita
           * que alguien rellene el formulario para nada.
           */
          disabled={ocupado || esPropia}
          onChange={(event) => setBorrador({ ...borrador, role: event.target.value })}
        >
          {StaffRoleSchema.options.map((puesto) => (
            <option key={puesto} value={puesto}>
              {t(`admin.role.${puesto}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="ft-label" htmlFor="idioma">
          {t('admin.staff.locale')}
        </label>
        <select
          id="idioma"
          className="ft-input w-full sm:w-64"
          value={borrador.locale}
          disabled={ocupado}
          onChange={(event) => setBorrador({ ...borrador, locale: event.target.value })}
        >
          {LocaleSchema.options.map((idioma) => (
            <option key={idioma} value={idioma}>
              {t(`admin.staff.localeName.${idioma}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('admin.staff.localeHelp')}
        </p>
      </div>

      {conEstado && (
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={borrador.isActive}
              disabled={ocupado || esPropia}
              onChange={(event) => setBorrador({ ...borrador, isActive: event.target.checked })}
            />
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {t('admin.staff.active')}
            </span>
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('admin.staff.activeHelp')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="ft-btn-primary"
          disabled={ocupado || !completo}
          onClick={onGuardar}
        >
          {ocupado && <SpinnerIcon className="h-4 w-4" />}
          {ocupado ? t('admin.working') : t('admin.staff.save')}
        </button>
        <button type="button" className="ft-btn-ghost" disabled={ocupado} onClick={onDescartar}>
          {t('admin.staff.discard')}
        </button>
      </div>
    </section>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  maxLength,
}: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  maxLength: number;
}) {
  return (
    <div>
      <label className="ft-label" htmlFor={etiqueta}>
        {etiqueta}
      </label>
      <input
        id={etiqueta}
        type="text"
        className="ft-input w-full"
        maxLength={maxLength}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
