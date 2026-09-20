import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
/*
 * Se importa desde "/pure" y no desde la raiz: el paquete normal descarga
 * Stripe.js nada mas cargarse el modulo, aunque nunca se llegue a pagar.
 *
 * Eso significaba contactar con un servidor de terceros por el simple hecho
 * de abrir el formulario de reserva, incluso con el simulador activo y sin
 * clave configurada. Ademas de innecesario, contradecia la promesa del sitio
 * de no cargar recursos externos. Con "/pure" la descarga ocurre en la
 * primera llamada a loadStripe, es decir, solo si de verdad se va a pagar.
 */
import { loadStripe } from '@stripe/stripe-js/pure';
import type { Stripe } from '@stripe/stripe-js';
import type { Locale } from '@freshness/types';

/**
 * PAGO REAL CON STRIPE
 * --------------------
 * Los datos de la tarjeta se escriben DENTRO de un marco servido por Stripe:
 * nunca pasan por nuestro codigo ni por nuestro servidor, que es lo que
 * mantiene el cumplimiento PCI en su ambito minimo (SAQ-A).
 *
 * Nosotros solo manejamos el `client_secret`, que sirve para una sola cosa:
 * confirmar ese pago concreto. No permite cobrar, ni consultar otros pagos,
 * ni acceder a datos del cliente.
 *
 * La clave publicable es publica por diseno y viaja en el paquete del
 * navegador; la secreta solo existe en el servidor.
 */
const PUBLISHABLE_KEY: string | undefined = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

/**
 * Se carga una sola vez y solo si hay clave configurada.
 *
 * Llamar a `loadStripe` sin clave lanza un error que romperia el dialogo
 * entero; sin ella se muestra el aviso de que el pago no esta disponible y se
 * ofrece el telefono, que es una salida util y no una pantalla rota.
 */
const stripePromise: Promise<Stripe | null> | null = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : null;

export const stripeIsConfigured = stripePromise !== null;

interface StripePaymentFormProps {
  clientSecret: string;
  amountLabel: string;
  locale: Locale;
  onAuthorised: () => void;
  onDeclined: (message: string) => void;
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  if (!stripePromise) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        locale: props.locale,
        // El formulario hereda los colores del sitio para que no parezca una
        // pieza pegada de otra web, que es lo que hace dudar al pagar.
        appearance: { theme: 'stripe', variables: { colorPrimary: '#145788' } },
      }}
    >
      <StripeFields {...props} />
    </Elements>
  );
}

function StripeFields({ amountLabel, onAuthorised, onDeclined }: StripePaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [working, setWorking] = useState(false);

  const submit = async (): Promise<void> => {
    if (!stripe || !elements) return;

    setWorking(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Sin redireccion siempre que sea posible: salir del sitio y volver
      // pierde clientes. Stripe solo redirige si el banco lo exige (3D Secure).
      redirect: 'if_required',
    });
    setWorking(false);

    if (error) {
      onDeclined(error.message ?? t('booking.errorTitle'));
      return;
    }

    /*
     * `requires_capture` es el exito aqui: el deposito quedo RETENIDO, no
     * cobrado. Esperar `succeeded` seria esperar algo que no va a pasar
     * todavia, porque la captura ocurre al terminar el servicio.
     */
    if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
      onAuthorised();
      return;
    }

    onDeclined(t('booking.errorTitle'));
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button
        type="button"
        className="ft-btn-primary w-full"
        disabled={!stripe || working}
        onClick={() => void submit()}
      >
        {working
          ? t('booking.payment.working')
          : t('booking.payment.authorise', { amount: amountLabel })}
      </button>
    </div>
  );
}
