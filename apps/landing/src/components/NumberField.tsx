/**
 * CAMPO NUMERICO ACOTADO
 * ----------------------
 * Vivia dentro del cotizador. Se saco aqui cuando el dialogo de reserva
 * paso a pedir habitaciones y banos: son el mismo campo con los mismos
 * limites, y copiarlo habria dejado dos sitios donde corregir el mismo
 * fallo.
 *
 * EL VALOR SE ACOTA AL ESCRIBIR, no al enviar. Los `min` y `max` de un
 * `input type="number"` los respeta el navegador con las flechas, pero no
 * impiden teclear ni pegar cualquier cosa; sin acotar aqui, un 99999 en los
 * pies cuadrados llegaria al servidor y volveria como un error de contrato
 * en vez de corregirse solo.
 */
interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Texto de apoyo bajo el campo, cuando hace falta explicar para que sirve. */
  help?: string;
  onChange: (value: number) => void;
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  help,
  onChange,
}: NumberFieldProps) {
  const ayudaId = help === undefined ? undefined : `${id}-help`;

  return (
    <div>
      <label className="ft-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className="ft-input"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={ayudaId}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))}
      />
      {help !== undefined && (
        <p id={ayudaId} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {help}
        </p>
      )}
    </div>
  );
}

/**
 * Un campo vacio da `NaN`: se cae al minimo en vez de propagar el fallo.
 *
 * Se exporta porque la cantidad de cada extra del cotizador es otro numero
 * tecleado a mano con su propio maximo, y necesita exactamente esto.
 */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}
