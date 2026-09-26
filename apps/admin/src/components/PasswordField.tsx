import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeOffIcon, LockIcon } from './Icons';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (valor: string) => void;
  /**
   * `current-password` para entrar, `new-password` para elegir una.
   *
   * No es un detalle: con `new-password` el gestor de contrasenas ofrece
   * generar una y guardarla; con `current-password` autocompleta la que ya
   * tiene. Ponerlo al reves en la pantalla de elegir contrasena rellena la
   * vieja, que es justo la que se esta cambiando.
   */
  autoComplete: 'current-password' | 'new-password';
  /** El ojo lo controla quien usa el campo: en «elegir contrasena» hay dos y un solo boton. */
  visible: boolean;
  onToggleVisible: () => void;
  required?: boolean;
  maxLength?: number;
}

/**
 * CAMPO DE CONTRASENA CON VER / OCULTAR
 * -------------------------------------
 * Escribir a ciegas una contrasena larga en el movil, de pie y con prisa, es
 * el motivo numero uno de "no me deja entrar": la errata no se ve, y como el
 * mensaje de error es el mismo para correo y contrasena —a proposito, para no
 * chivar quien trabaja aqui— no hay forma de saber que fue una letra mal
 * puesta.
 *
 * LO QUE SE HA CUIDADO, QUE NO ES OBVIO:
 *
 *   - `type="button"`. Sin esto, el ojo ENVIA el formulario, porque dentro de
 *     un <form> el tipo por defecto de un boton es «submit». Se descubre el
 *     dia del despliegue.
 *
 *   - Empieza SIEMPRE oculta, y quien lo use la vuelve a ocultar al enviar.
 *     Dejarla a la vista tras un intento fallido la deja en pantalla mientras
 *     se mira el movil en un portal con gente detras.
 *
 *   - Se esconde el ojo NATIVO de Edge (`::-ms-reveal`). Si no, salen dos
 *     ojos pegados que hacen cosas distintas.
 *
 *   - El boton dice lo que HARA al pulsarlo («mostrar» cuando esta oculta) y
 *     lo dice en `aria-label`, porque no lleva texto visible.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
  required = false,
  maxLength = 200,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const etiquetaBoton = t(visible ? 'admin.hidePassword' : 'admin.showPassword');

  return (
    <div>
      <label className="ft-label" htmlFor={id}>
        {label}
      </label>

      <div className="relative">
        <LockIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />

        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="ft-input ft-input-password pr-12 pl-10"
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
        />

        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={etiquetaBoton}
          title={etiquetaBoton}
          /*
           * `aria-pressed` y no solo la etiqueta: asi un lector de pantalla
           * puede decir si la contrasena esta ahora mismo a la vista, que es
           * lo que hace falta saber antes de ensenarle la pantalla a alguien.
           */
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center
                     justify-center rounded-md text-slate-500 transition-colors
                     hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400
                     dark:hover:bg-night-600 dark:hover:text-slate-100"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
