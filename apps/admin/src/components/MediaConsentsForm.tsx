import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CONSENT_CHANNELS,
  CONSENT_EVIDENCE_KINDS,
  CONSENT_EVIDENCE_TYPES,
  CONSENT_REMOVAL_DAYS_DEFAULT,
  MediaConsentSchema,
  removalState,
  type ConsentChannel,
  type ConsentEvidenceKind,
  type Locale,
  type MediaConsent,
  type StoredMediaConsent,
} from '@freshness/types';
import {
  ApiClientError,
  createMediaConsent,
  deleteMediaConsentEvidence,
  setMediaConsentRemovalRequest,
  downloadMediaConsentEvidence,
  fetchMediaConsents,
  setMediaConsentRevoked,
  updateMediaConsent,
  uploadMediaConsentEvidence,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface MediaConsentsFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * Lo que hay escrito en los campos.
 *
 * Cadenas y nunca `null`, porque vienen de inputs. Las listas de piezas se
 * teclean separadas por lineas, que es como se pega algo copiado.
 */
interface Borrador {
  reference: string;
  evidenceKind: ConsentEvidenceKind;
  customerName: string;
  propertyAddress: string;
  occupiedByOthers: boolean;
  occupantConsent: boolean;
  serviceDate: string;
  signedAt: string;
  coversInterior: boolean;
  coversExterior: boolean;
  allowsBefore: boolean;
  channels: ConsentChannel[];
  removalDays: string;
  videoIds: string;
  photoPaths: string;
  notes: string;
}

const VACIO: Borrador = {
  reference: '',
  /*
   * EL PAPEL SIGUE SIENDO LO PRIMERO QUE PROPONE, aunque ya no sea lo unico
   * que vale: es lo que hay en el archivador, y quien abre esta pantalla
   * suele venir con una hoja en la mano. Lo demas esta a un clic.
   */
  evidenceKind: 'SIGNED_PAPER',
  customerName: '',
  propertyAddress: '',
  occupiedByOthers: false,
  occupantConsent: false,
  serviceDate: '',
  signedAt: '',
  coversInterior: true,
  coversExterior: false,
  allowsBefore: false,
  channels: ['WEBSITE'],
  removalDays: String(CONSENT_REMOVAL_DAYS_DEFAULT),
  videoIds: '',
  photoPaths: '',
  notes: '',
};

/**
 * LOS PERMISOS DE IMAGEN
 * ----------------------
 * Aqui no se configura nada: SE ARCHIVA UN PAPEL FIRMADO. Lo que se anote
 * decide que sale publicado y que no.
 *
 * Tres decisiones de la pantalla:
 *
 *   1. LA CASILLA DEL «ANTES» VA APARTE Y SE VE. Es la parte sensible del
 *      permiso —la casa sucia de una persona concreta— y marcarla sin
 *      querer, entre otras diez, seria facil.
 *
 *   2. RETIRAR PIDE CONFIRMACION, porque despublica al momento. No es un
 *      cambio de configuracion que se pueda deshacer sin que nadie lo note:
 *      entre pulsar y que la foto desaparezca de la web no hay nada.
 *
 *   3. UN PERMISO RETIRADO SIGUE EN LA LISTA, en gris. Es exactamente lo que
 *      hay que poder ensenar: que existio, que amparaba estas piezas y
 *      cuando dejo de hacerlo.
 */
export function MediaConsentsForm({ locale, onSessionLost }: MediaConsentsFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [fichas, setFichas] = useState<StoredMediaConsent[]>([]);
  /** Que ficha se esta editando: su id, `'nueva'`, o nada. */
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);

  /*
   * HOY, EN LA ZONA DEL NAVEGADOR y calculado una sola vez por pintado.
   *
   * Dentro del bucle de las fichas se recalcularia por cada una, y entre la
   * primera y la ultima puede cambiar el dia. Un plazo que vence hoy en una
   * tarjeta y manana en la de abajo es el tipo de incoherencia que hace
   * desconfiar de toda la pantalla.
   */
  const hoy = new Date().toISOString().slice(0, 10);

  const perdioSesion = onSessionLost;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      setFichas(await fetchMediaConsents());
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }
  }, [perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Traduce un fallo de la API a algo que se pueda leer, o cierra la sesion. */
  const manejar = (error: unknown): void => {
    if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403)) {
      perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
      return;
    }
    setProblema(error instanceof ApiClientError ? t(error.messageKey) : t('admin.errorGeneric'));
  };

  const enviar = async (evento: FormEvent): Promise<void> => {
    evento.preventDefault();
    setProblema(null);

    const validado = MediaConsentSchema.safeParse(aContrato(borrador));
    if (!validado.success) {
      // El primer mensaje del contrato: estan escritos para leerse.
      setProblema(validado.error.issues[0]?.message ?? t('admin.consents.errInvalid'));
      return;
    }

    setGuardando(true);
    try {
      if (editando === 'nueva') {
        await createMediaConsent(validado.data);
      } else if (editando !== null) {
        await updateMediaConsent(editando, validado.data);
      }

      toast.success('admin.consents.saved');
      setEditando(null);
      setBorrador(VACIO);
      await cargar();
    } catch (error) {
      manejar(error);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarRetirada = async (ficha: StoredMediaConsent): Promise<void> => {
    const retirar = ficha.revokedAt === null;

    /*
     * CONFIRMAR ANTES DE RETIRAR, porque despublica al momento. Entre pulsar
     * y que la foto desaparezca de la web no hay nada.
     */
    if (retirar && !window.confirm(t('admin.consents.confirmRevoke'))) return;

    setProblema(null);
    setGuardando(true);
    try {
      await setMediaConsentRevoked(ficha.id, retirar);
      toast.success(retirar ? 'admin.consents.revoked' : 'admin.consents.restored');
      await cargar();
    } catch (error) {
      manejar(error);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * ANOTA QUE EL CLIENTE PIDIO LA RETIRADA, o anula la anotacion.
   *
   * NO RETIRA NADA: arranca el reloj y pone la ficha en la lista de avisos.
   * Despublicar sigue siendo el boton de retirar, y son dos cosas distintas
   * a proposito — anotar una peticion de hace tres dias para dejar
   * constancia no puede despublicar sin querer.
   */
  const anotarRetirada = async (
    ficha: StoredMediaConsent,
    requestedAt: string | null,
  ): Promise<void> => {
    setProblema(null);
    setGuardando(true);
    try {
      await setMediaConsentRemovalRequest(ficha.id, requestedAt);
      toast.success(
        requestedAt === null ? 'admin.consents.removalCancelled' : 'admin.consents.removalSaved',
      );
      await cargar();
    } catch (error) {
      manejar(error);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * GUARDA LA PRUEBA. Es la diferencia entre anotar que existe un papel y
   * tenerlo: el dia que haya que ensenarlo, una referencia a un PDF que esta
   * en el correo de alguien no sirve.
   */
  const subirPrueba = async (ficha: StoredMediaConsent, file: File): Promise<void> => {
    setProblema(null);
    setGuardando(true);
    try {
      await uploadMediaConsentEvidence(ficha.id, file);
      toast.success('admin.consents.evidenceSaved');
      await cargar();
    } catch (error) {
      manejar(error);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * DESCARGA LA PRUEBA.
   *
   * La direccion temporal se revoca en cuanto el navegador se lleva el
   * archivo: mientras existe es una direccion de este origen que abre un
   * documento firmado, y no hay motivo para dejarla viva.
   */
  const verPrueba = async (ficha: StoredMediaConsent): Promise<void> => {
    setProblema(null);
    try {
      const blob = await downloadMediaConsentEvidence(ficha.id);
      const direccion = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = direccion;
      enlace.download = `${ficha.consent.reference}${extensionDe(ficha.evidencePath)}`;
      enlace.click();
      URL.revokeObjectURL(direccion);
    } catch (error) {
      manejar(error);
    }
  };

  const borrarPrueba = async (ficha: StoredMediaConsent): Promise<void> => {
    if (!window.confirm(t('admin.consents.confirmEvidenceDelete'))) return;

    setProblema(null);
    setGuardando(true);
    try {
      await deleteMediaConsentEvidence(ficha.id);
      toast.success('admin.consents.evidenceDeleted');
      await cargar();
    } catch (error) {
      manejar(error);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <SkeletonFormulario />;

  if (errorKey !== null) {
    return (
      <p
        className="ft-card flex items-start gap-2 p-4 text-sm text-red-700 dark:text-red-300"
        role="alert"
      >
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {t(errorKey)}
      </p>
    );
  }

  const campo = <K extends keyof Borrador>(clave: K, valor: Borrador[K]): void => {
    setBorrador((actual) => ({ ...actual, [clave]: valor }));
    setProblema(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.consents.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.consents.intro')}
        </p>
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-50 p-3
                     text-sm text-red-800 dark:border-red-400/30 dark:bg-night-700
                     dark:text-red-200"
          role="note"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t('admin.consents.strictNotice')}
        </p>
      </header>

      {editando === null ? (
        <button
          type="button"
          className="ft-btn-primary"
          onClick={() => {
            setBorrador(VACIO);
            setEditando('nueva');
          }}
        >
          {t('admin.consents.add')}
        </button>
      ) : (
        <form className="ft-card space-y-4 p-4" onSubmit={(evento) => void enviar(evento)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Texto
              etiqueta={t('admin.consents.reference')}
              ayuda={t('admin.consents.referenceHelp')}
              valor={borrador.reference}
              onCambiar={(v) => {
                campo('reference', v);
              }}
            />
            <label className="block">
              <span className="ft-label">{t('admin.consents.evidenceKind')}</span>
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                {t('admin.consents.evidenceKindHelp')}
              </span>
              <select
                className="ft-input"
                value={borrador.evidenceKind}
                onChange={(evento) => {
                  campo('evidenceKind', evento.target.value as ConsentEvidenceKind);
                }}
              >
                {CONSENT_EVIDENCE_KINDS.map((medio) => (
                  <option key={medio} value={medio}>
                    {t(`admin.consents.evidence.${medio}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Texto
              etiqueta={t('admin.consents.customerName')}
              valor={borrador.customerName}
              onCambiar={(v) => {
                campo('customerName', v);
              }}
            />
            <Texto
              etiqueta={t('admin.consents.propertyAddress')}
              ayuda={t('admin.consents.propertyAddressHelp')}
              valor={borrador.propertyAddress}
              onCambiar={(v) => {
                campo('propertyAddress', v);
              }}
            />
          </div>

          {/*
           * QUIEN VIVE ALLI, EN SU PROPIO RECUADRO.
           *
           * Mismo tratamiento que la casilla del «antes»: es una decision con
           * consecuencias para una persona que no esta en la conversacion —el
           * inquilino— y perdida entre los demas campos se marcaria sin leer.
           */}
          <fieldset className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
            <legend className="ft-label px-1">{t('admin.consents.occupancy')}</legend>
            <Casilla
              etiqueta={t('admin.consents.occupiedByOthers')}
              marcada={borrador.occupiedByOthers}
              onCambiar={(v) => {
                campo('occupiedByOthers', v);
              }}
            />
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              {t('admin.consents.occupiedByOthersHelp')}
            </p>
            {borrador.occupiedByOthers && (
              <div className="mt-3 space-y-1">
                <Casilla
                  etiqueta={t('admin.consents.occupantConsent')}
                  marcada={borrador.occupantConsent}
                  onCambiar={(v) => {
                    campo('occupantConsent', v);
                  }}
                />
                {!borrador.occupantConsent && (
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    {t('admin.consents.occupantBlocked')}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <Texto
              etiqueta={t('admin.consents.serviceDate')}
              tipo="date"
              valor={borrador.serviceDate}
              onCambiar={(v) => {
                campo('serviceDate', v);
              }}
            />
            <Texto
              etiqueta={t('admin.consents.signedAt')}
              ayuda={t('admin.consents.signedAtHelp')}
              tipo="date"
              valor={borrador.signedAt}
              onCambiar={(v) => {
                campo('signedAt', v);
              }}
            />
            <Texto
              etiqueta={t('admin.consents.removalDays')}
              tipo="number"
              valor={borrador.removalDays}
              onCambiar={(v) => {
                campo('removalDays', v);
              }}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="ft-label">{t('admin.consents.covers')}</legend>
            <Casilla
              etiqueta={t('admin.consents.coversInterior')}
              marcada={borrador.coversInterior}
              onCambiar={(v) => {
                campo('coversInterior', v);
              }}
            />
            <Casilla
              etiqueta={t('admin.consents.coversExterior')}
              marcada={borrador.coversExterior}
              onCambiar={(v) => {
                campo('coversExterior', v);
              }}
            />
          </fieldset>

          {/*
            LA CASILLA DEL «ANTES» VA APARTE Y DESTACADA. Es la parte
            sensible del permiso —la casa sucia de una persona concreta— y
            marcarla sin querer, entre otras diez, seria facil.
          */}
          <div className="rounded-lg border border-sun-600/40 bg-sun-50 p-3 dark:border-sun-300/30 dark:bg-night-700">
            <Casilla
              etiqueta={t('admin.consents.allowsBefore')}
              marcada={borrador.allowsBefore}
              onCambiar={(v) => {
                campo('allowsBefore', v);
              }}
            />
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('admin.consents.allowsBeforeHelp')}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="ft-label">{t('admin.consents.channels')}</legend>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('admin.consents.channelsHelp')}
            </p>
            {CONSENT_CHANNELS.map((canal) => (
              <Casilla
                key={canal}
                etiqueta={t(`admin.consents.channel.${canal}`)}
                marcada={borrador.channels.includes(canal)}
                onCambiar={(marcada) => {
                  campo(
                    'channels',
                    marcada
                      ? [...borrador.channels, canal]
                      : borrador.channels.filter((otro) => otro !== canal),
                  );
                }}
              />
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Lista
              etiqueta={t('admin.consents.videoIds')}
              ayuda={t('admin.consents.piecesHelp')}
              valor={borrador.videoIds}
              onCambiar={(v) => {
                campo('videoIds', v);
              }}
            />
            <Lista
              etiqueta={t('admin.consents.photoPaths')}
              ayuda={t('admin.consents.piecesHelp')}
              valor={borrador.photoPaths}
              onCambiar={(v) => {
                campo('photoPaths', v);
              }}
            />
          </div>

          <Lista
            etiqueta={t('admin.consents.notes')}
            valor={borrador.notes}
            onCambiar={(v) => {
              campo('notes', v);
            }}
          />

          {problema !== null && (
            <p
              className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {problema}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="ft-btn-primary" disabled={guardando}>
              {guardando && <SpinnerIcon className="h-4 w-4" />}
              {t('admin.consents.save')}
            </button>
            <button
              type="button"
              className="ft-btn-ghost"
              onClick={() => {
                setEditando(null);
                setProblema(null);
              }}
              disabled={guardando}
            >
              {t('admin.consents.cancel')}
            </button>
          </div>
        </form>
      )}

      {fichas.length === 0 ? (
        <p className="ft-card p-4 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.consents.empty')}
        </p>
      ) : (
        <ul className="list-none space-y-3 p-0">
          {fichas.map((ficha) => {
            const retirado = ficha.revokedAt !== null;
            const retirada = removalState(
              {
                requestedAt: ficha.removalRequestedAt,
                removalDays: ficha.consent.removalDays,
                revoked: retirado,
              },
              hoy,
            );

            return (
              <li
                key={ficha.id}
                className={'ft-card space-y-2 p-4' + (retirado ? ' opacity-70' : '')}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {ficha.consent.reference}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {ficha.consent.customerName}
                  </span>
                  {retirado && (
                    <span className="ft-chip bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                      {t('admin.consents.revokedChip')}
                    </span>
                  )}
                  {!retirado && ficha.consent.allowsBefore && (
                    <span className="ft-chip bg-sun-100 text-slate-800 dark:bg-night-700 dark:text-slate-200">
                      {t('admin.consents.beforeChip')}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {ficha.consent.propertyAddress}
                </p>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t('admin.consents.summary', {
                    videos: ficha.consent.videoIds.length,
                    photos: ficha.consent.photoPaths.length,
                    days: ficha.consent.removalDays,
                  })}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {retirado && ficha.revokedAt !== null
                    ? t('admin.consents.revokedOn', {
                        when: formatTimestamp(ficha.revokedAt, locale),
                      })
                    : t('admin.consents.signedOn', { when: ficha.consent.signedAt })}
                  {ficha.updatedBy !== null && ` · ${ficha.updatedBy}`}
                </p>

                {/*
                 * EL PLAZO DE RETIRADA.
                 *
                 * Es lo unico de esta pantalla con FECHA LIMITE, asi que se
                 * pinta como una alarma y no como un dato mas: en rojo si se
                 * paso, en ambar mientras corre. Una promesa que vence hoy no
                 * puede verse igual que la referencia del papel.
                 */}
                {retirada.requested && (
                  <p
                    className={
                      'rounded-md px-2 py-1 text-xs font-medium ' +
                      (retirada.overdue
                        ? 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100'
                        : retirada.fulfilled
                          ? 'bg-slate-100 text-slate-700 dark:bg-night-700 dark:text-slate-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100')
                    }
                  >
                    {retirada.fulfilled
                      ? t('admin.consents.removalDone', {
                          when: ficha.removalRequestedAt,
                          fulfilled: ficha.revokedAt === null ? '' : ficha.revokedAt.slice(0, 10),
                        })
                      : retirada.overdue
                        ? t('admin.consents.removalOverdue', {
                            count: Math.abs(retirada.daysLeft ?? 0),
                            when: ficha.removalRequestedAt,
                            deadline: retirada.deadline,
                          })
                        : retirada.daysLeft === 0
                          ? t('admin.consents.removalToday', {
                              when: ficha.removalRequestedAt,
                              deadline: retirada.deadline,
                            })
                          : t('admin.consents.removalPending', {
                              count: retirada.daysLeft ?? 0,
                              when: ficha.removalRequestedAt,
                              deadline: retirada.deadline,
                            })}
                    {!retirada.fulfilled && ` ${t('admin.consents.removalStillPublished')}`}
                  </p>
                )}

                {/*
                 * LA PRUEBA, EN SU PROPIA LINEA Y CON SU AVISO.
                 *
                 * Una ficha sin archivo no esta rota —ampara lo que ampara—
                 * pero es un permiso que no se puede ensenar, y eso tiene
                 * que verse sin abrir nada.
                 */}
                {ficha.evidencePath === null ? (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                    <AlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('admin.consents.noEvidence')}
                    <SubirPrueba
                      etiqueta={t('admin.consents.attachEvidence')}
                      deshabilitado={guardando}
                      onArchivo={(file) => void subirPrueba(ficha, file)}
                    />
                  </p>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    {t('admin.consents.hasEvidence')}
                    <button
                      type="button"
                      className="ft-btn-ghost"
                      onClick={() => void verPrueba(ficha)}
                    >
                      {t('admin.consents.viewEvidence')}
                    </button>
                    <SubirPrueba
                      etiqueta={t('admin.consents.replaceEvidence')}
                      deshabilitado={guardando}
                      onArchivo={(file) => void subirPrueba(ficha, file)}
                    />
                    <button
                      type="button"
                      className="ft-btn-ghost"
                      onClick={() => void borrarPrueba(ficha)}
                      disabled={guardando}
                    >
                      {t('admin.consents.deleteEvidence')}
                    </button>
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ft-btn-ghost"
                    onClick={() => {
                      setBorrador(aBorrador(ficha.consent));
                      setEditando(ficha.id);
                      setProblema(null);
                    }}
                    disabled={guardando}
                  >
                    {t('admin.consents.edit')}
                  </button>
                  <button
                    type="button"
                    className="ft-btn-ghost"
                    onClick={() => void cambiarRetirada(ficha)}
                    disabled={guardando}
                  >
                    {retirado ? t('admin.consents.restore') : t('admin.consents.revoke')}
                  </button>

                  {retirada.requested ? (
                    <button
                      type="button"
                      className="ft-btn-ghost"
                      onClick={() => void anotarRetirada(ficha, null)}
                      disabled={guardando}
                    >
                      {t('admin.consents.removalCancel')}
                    </button>
                  ) : (
                    <PedirRetirada
                      etiqueta={t('admin.consents.removalAsk')}
                      ayuda={t('admin.consents.removalAskHelp')}
                      hoy={hoy}
                      deshabilitado={guardando}
                      onFecha={(fecha) => void anotarRetirada(ficha, fecha)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * EL BOTON QUE ANOTA LA PETICION, CON SU FECHA.
 *
 * LA FECHA SE PIDE Y NO SE SUPONE. Poner «hoy» sin preguntar regalaria los
 * dias que el correo del cliente lleve en el buzon, y el plazo se mediria
 * desde que nos enteramos en vez de desde que lo pidio — que es justo la
 * promesa que se firmo. Viene rellena con hoy, que es el caso frecuente,
 * pero se puede cambiar.
 *
 * NO ADMITE UNA FECHA FUTURA: nadie pide algo manana.
 */
function PedirRetirada({
  etiqueta,
  ayuda,
  hoy,
  deshabilitado,
  onFecha,
}: {
  etiqueta: string;
  ayuda: string;
  hoy: string;
  deshabilitado: boolean;
  onFecha: (fecha: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoy);

  if (!abierto) {
    return (
      <button
        type="button"
        className="ft-btn-ghost"
        onClick={() => {
          setFecha(hoy);
          setAbierto(true);
        }}
        disabled={deshabilitado}
      >
        {etiqueta}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="ft-label">{etiqueta}</span>
        <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{ayuda}</span>
        <input
          type="date"
          className="ft-input"
          max={hoy}
          value={fecha}
          onChange={(evento) => {
            setFecha(evento.target.value);
          }}
        />
      </label>
      <button
        type="button"
        className="ft-btn-primary"
        onClick={() => {
          setAbierto(false);
          onFecha(fecha);
        }}
        disabled={deshabilitado || fecha === ''}
      >
        {etiqueta}
      </button>
    </div>
  );
}

/**
 * UN BOTON DE VERDAD, NO UN TEXTO AZUL.
 *
 * Un `<input type="file">` suelto se pinta distinto en cada navegador y no
 * parece que se pueda pulsar. Se esconde dentro de una etiqueta con aspecto
 * de boton, que es lo que ya se hizo en la pantalla de la galeria.
 */
function SubirPrueba({
  etiqueta,
  deshabilitado,
  onArchivo,
}: {
  etiqueta: string;
  deshabilitado: boolean;
  onArchivo: (file: File) => void;
}) {
  return (
    <label className={'ft-btn-ghost' + (deshabilitado ? ' pointer-events-none opacity-60' : '')}>
      {etiqueta}
      <input
        type="file"
        className="sr-only"
        accept={CONSENT_EVIDENCE_TYPES.join(',')}
        disabled={deshabilitado}
        onChange={(evento) => {
          const file = evento.target.files?.[0];
          // Se limpia para que elegir el MISMO archivo otra vez vuelva a
          // disparar el cambio: si no, un segundo intento no haria nada.
          evento.target.value = '';
          if (file) onArchivo(file);
        }}
      />
    </label>
  );
}

/** La extension con la que se guardo, para nombrar la descarga. */
function extensionDe(path: string | null): string {
  const punto = path?.lastIndexOf('.') ?? -1;
  return punto === -1 || path === null ? '' : path.slice(punto);
}

function Texto({
  etiqueta,
  ayuda,
  tipo = 'text',
  valor,
  onCambiar,
}: {
  etiqueta: string;
  ayuda?: string;
  tipo?: 'text' | 'date' | 'number';
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="block">
      <span className="ft-label">{etiqueta}</span>
      {ayuda !== undefined && (
        <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{ayuda}</span>
      )}
      <input
        type={tipo}
        className="ft-input"
        value={valor}
        onChange={(evento) => {
          onCambiar(evento.target.value);
        }}
      />
    </label>
  );
}

function Lista({
  etiqueta,
  ayuda,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="block">
      <span className="ft-label">{etiqueta}</span>
      {ayuda !== undefined && (
        <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">{ayuda}</span>
      )}
      <textarea
        rows={3}
        className="ft-input"
        value={valor}
        onChange={(evento) => {
          onCambiar(evento.target.value);
        }}
      />
    </label>
  );
}

function Casilla({
  etiqueta,
  marcada,
  onCambiar,
}: {
  etiqueta: string;
  marcada: boolean;
  onCambiar: (marcada: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(evento) => {
          onCambiar(evento.target.checked);
        }}
      />
      {etiqueta}
    </label>
  );
}

/* ------------------------------------------------------------------------ */

/** Una lista tecleada por lineas, sin las vacias. */
function porLineas(texto: string): string[] {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');
}

function aContrato(borrador: Borrador): unknown {
  return {
    reference: borrador.reference.trim(),
    evidenceKind: borrador.evidenceKind,
    customerName: borrador.customerName.trim(),
    propertyAddress: borrador.propertyAddress.trim(),
    occupiedByOthers: borrador.occupiedByOthers,
    /*
     * Si no vive alli nadie mas, la casilla del segundo permiso no se ensena
     * y se manda en falso. Dejar pasar un `true` escondido convertiria una
     * casilla invisible en la que levanta la restriccion.
     */
    occupantConsent: borrador.occupiedByOthers && borrador.occupantConsent,
    serviceDate: borrador.serviceDate,
    signedAt: borrador.signedAt,
    coversInterior: borrador.coversInterior,
    coversExterior: borrador.coversExterior,
    allowsBefore: borrador.allowsBefore,
    channels: borrador.channels,
    /*
     * El tope lo comprueba el contrato; aqui solo se convierte. Un campo
     * numerico vacio da `''`, y `Number('')` es cero — que el contrato
     * rechaza con su propio mensaje en vez de colar un plazo de cero dias.
     */
    removalDays: Number(borrador.removalDays),
    videoIds: porLineas(borrador.videoIds),
    photoPaths: porLineas(borrador.photoPaths),
    notes: borrador.notes.trim() === '' ? null : borrador.notes.trim(),
  };
}

function aBorrador(consent: MediaConsent): Borrador {
  return {
    reference: consent.reference,
    evidenceKind: consent.evidenceKind,
    customerName: consent.customerName,
    propertyAddress: consent.propertyAddress,
    occupiedByOthers: consent.occupiedByOthers,
    occupantConsent: consent.occupantConsent,
    serviceDate: consent.serviceDate,
    signedAt: consent.signedAt,
    coversInterior: consent.coversInterior,
    coversExterior: consent.coversExterior,
    allowsBefore: consent.allowsBefore,
    channels: consent.channels,
    removalDays: String(consent.removalDays),
    videoIds: consent.videoIds.join('\n'),
    photoPaths: consent.photoPaths.join('\n'),
    notes: consent.notes ?? '',
  };
}
