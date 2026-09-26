import { useTranslation } from 'react-i18next';

/**
 * ESQUELETOS DE CARGA
 * -------------------
 * Antes, cada pantalla que esperaba datos pintaba la palabra «Calculando…»
 * —literalmente esa, porque la clave venia del calculador de precios del
 * sitio publico— y al llegar los datos la pagina daba un salto de medio
 * metro.
 *
 * LA REGLA QUE HACE QUE ESTO SIRVA DE ALGO: el esqueleto tiene que tener LA
 * FORMA Y EL TAMANO de lo que va a llegar. Si no, no ahorra el salto, solo lo
 * retrasa; y un esqueleto generico de tres rayas grises es peor que un texto
 * honesto, porque promete una cosa y aparece otra.
 *
 * COMO SE ANUNCIA: el hueco visual es `aria-hidden`, y la unica cosa que oye
 * quien usa lector de pantalla es un texto de «cargando». Leer en alto
 * catorce rectangulos vacios no informa de nada.
 */

/** Un rectangulo gris. Sin bordes ni texto: es un hueco, no una tarjeta. */
function Barra({ className }: { className: string }) {
  return <div className={`ft-skeleton ${className}`} />;
}

/**
 * Envoltorio comun: anuncia una sola vez que se esta cargando y esconde del
 * lector todo el andamiaje.
 */
function Hueco({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true">
      <span className="sr-only">{t('admin.loading')}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Agenda: los filtros ya estan pintados, lo que falta es la lista. */
export function SkeletonListaReservas({ filas = 4 }: { filas?: number }) {
  return (
    <Hueco>
      <ul className="space-y-2">
        {Array.from({ length: filas }, (_, indice) => (
          <li key={indice} className="ft-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Barra className="h-4 w-28" />
                <Barra className="h-3.5 w-48 max-w-full" />
                <Barra className="h-3 w-40 max-w-full" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Barra className="h-5 w-24 rounded-full" />
                <Barra className="h-4 w-16" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Hueco>
  );
}

/** Detalle de una reserva: cabecera, ficha del cliente, equipo y precio. */
export function SkeletonDetalleReserva() {
  return (
    <Hueco>
      <div className="space-y-5">
        <div className="ft-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Barra className="h-5 w-32" />
              <Barra className="h-3.5 w-56 max-w-full" />
            </div>
            <Barra className="h-5 w-24 rounded-full" />
          </div>
        </div>

        {[5, 3, 4].map((lineas, indice) => (
          <div key={indice} className="ft-card space-y-3 p-5">
            <Barra className="h-4 w-24" />
            {Array.from({ length: lineas }, (_, fila) => (
              <div key={fila} className="flex justify-between gap-4">
                <Barra className="h-3.5 w-24" />
                <Barra className="h-3.5 w-36 max-w-[45%]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Hueco>
  );
}

/**
 * Mis trabajos: tarjetas altas de una sola columna, como las de verdad. Es la
 * pantalla donde mas se nota, porque se abre con datos moviles en la calle.
 */
export function SkeletonMisTrabajos({ tarjetas = 2 }: { tarjetas?: number }) {
  return (
    <Hueco>
      <div className="space-y-4">
        <Barra className="ml-1 h-3 w-20" />
        {Array.from({ length: tarjetas }, (_, indice) => (
          <div key={indice} className="ft-card space-y-4 p-5">
            <div className="space-y-2">
              <Barra className="h-5 w-52 max-w-full" />
              <Barra className="h-3.5 w-40" />
            </div>
            <div className="space-y-2">
              <Barra className="h-4 w-60 max-w-full" />
              <Barra className="h-3.5 w-44 max-w-full" />
            </div>
            <Barra className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </Hueco>
  );
}

/** Personal: la cabecera de la seccion y varias fichas. */
export function SkeletonPersonal({ fichas = 3 }: { fichas?: number }) {
  return (
    <Hueco>
      <div className="space-y-4">
        {Array.from({ length: fichas }, (_, indice) => (
          <div key={indice} className="ft-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Barra className="h-4 w-44 max-w-full" />
                <Barra className="h-3.5 w-56 max-w-full" />
                <Barra className="h-3 w-64 max-w-full" />
              </div>
              <Barra className="h-10 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Hueco>
  );
}

/**
 * Formularios de configuracion y de avisos. Sirve para los dos porque son la
 * misma forma: un titulo y dos bloques de campos.
 */
export function SkeletonFormulario({
  bloques = 2,
  campos = 3,
}: {
  bloques?: number;
  campos?: number;
}) {
  return (
    <Hueco>
      <div className="space-y-6">
        <div className="space-y-2">
          <Barra className="h-5 w-56 max-w-full" />
          <Barra className="h-3.5 w-full max-w-md" />
        </div>

        {Array.from({ length: bloques }, (_, bloque) => (
          <div key={bloque} className="ft-card space-y-4 p-4">
            <Barra className="h-4 w-32" />
            {Array.from({ length: campos }, (_, campo) => (
              <div key={campo} className="space-y-1.5">
                <Barra className="h-3 w-24" />
                <Barra className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ))}

        <Barra className="h-10 w-32 rounded-lg" />
      </div>
    </Hueco>
  );
}

/** Lista de personal asignable dentro del detalle de una reserva. */
export function SkeletonSelectorEquipo({ filas = 3 }: { filas?: number }) {
  return (
    <Hueco>
      <ul className="space-y-2">
        {Array.from({ length: filas }, (_, indice) => (
          <li
            key={indice}
            className="flex items-center gap-2 border-b border-slate-200 pb-2 last:border-0 dark:border-night-600"
          >
            <Barra className="h-4 w-4 rounded" />
            <Barra className="h-3.5 w-40 max-w-full" />
          </li>
        ))}
      </ul>
    </Hueco>
  );
}
