import { z } from 'zod';
import { isInsideGeorgia } from './georgia-outline';

/**
 * LA UBICACION DE LA EMPRESA
 * --------------------------
 * El punto desde el que se mide TODO: la distancia de cada presupuesto, el
 * radio de traslado incluido, la zona que se le asigna a cada reserva y el
 * centro del mapa. Mover este punto mueve el precio de todos los trabajos
 * posteriores.
 *
 * VIVIA EN VARIABLES DE ENTORNO, y eso tenia dos problemas. El primero es
 * que mudarse exigia un redespliegue. El segundo es peor y ya estaba
 * pasando: el mapa del panel llevaba las coordenadas ESCRITAS A MANO, asi
 * que si alguien cambiaba la variable, administracion seguia dibujando
 * circulos alrededor del sitio antiguo mientras los precios se calculaban
 * desde el nuevo.
 *
 * QUIEN PUEDE VERLA Y TOCARLA. La pantalla y los dos endpoints son solo de
 * ADMIN: quien mueva este punto cambia lo que factura la empresa.
 *
 * LO QUE NO ES PRIVADO, Y CONVIENE SABERLO. Las coordenadas siguen saliendo
 * en el catalogo publico, y tienen que salir: el mapa del sitio dibuja el
 * circulo de las 35 millas centrado aqui, y un circulo en un mapa ensena
 * donde esta su centro. Lo que es solo de administracion es la ficha y
 * poder cambiarla, no el hecho de que el area de servicio tenga un centro
 * visible. Quien quiera el punto exacto fuera del alcance del publico
 * tendria que renunciar a dibujar esa zona en el sitio.
 */

/** Latitud y longitud con la precision que da un clic en el mapa. */
const LatitudSchema = z.number().min(-90).max(90);
const LongitudSchema = z.number().min(-180).max(180);

export const CompanyLocationSchema = z
  .strictObject({
    latitude: LatitudSchema,
    longitude: LongitudSchema,
    /** Para las pantallas y los correos. No entra en ningun calculo. */
    city: z.string().trim().min(1).max(80),
    /**
     * SI ENTRA EN UN CALCULO: el motor marca `outOfState` comparando el
     * estado del cliente con este. Puesto mal, TODOS los presupuestos de
     * Georgia saldrian fuera de estado y ninguno daria precio.
     */
    state: z.string().trim().toUpperCase().length(2),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/),
  })
  /*
   * EL PUNTO TIENE QUE CAER DENTRO DE GEORGIA.
   *
   * Es la guardia que de verdad importa, porque el fallo que atrapa no
   * rompe nada: un dedazo en una coordenada recentra el area de servicio y
   * recalcula todos los traslados en silencio. Con el signo cambiado, la
   * base acaba en el oceano Indico y cada cliente de Atlanta pasa a estar
   * a diez mil millas; con un digito de mas, en Kansas. Ninguna de las dos
   * cosas falla por ningun sitio: solo factura mal.
   */
  .refine(({ latitude, longitude }) => isInsideGeorgia(latitude, longitude), {
    message: 'La ubicacion tiene que estar dentro del estado de Georgia',
    path: ['latitude'],
  })
  /*
   * Y EL ESTADO TIENE QUE SER GEORGIA. Es la misma verdad dicha dos veces a
   * proposito: si el punto esta en Georgia y el campo dice otra cosa, una
   * de las dos esta mal, y la que se usa para decidir si un cliente queda
   * fuera de estado es esta.
   */
  .refine(({ state }) => state === 'GA', {
    message: 'La empresa opera en Georgia: el estado tiene que ser GA',
    path: ['state'],
  });

export type CompanyLocation = z.infer<typeof CompanyLocationSchema>;
export type CompanyLocationInput = z.input<typeof CompanyLocationSchema>;

/**
 * La de partida: el centro de Atlanta.
 *
 * Es la misma que llevaban las variables de entorno, para que una
 * instalacion que todavia no la haya tocado siga midiendo desde donde
 * media.
 */
export const DEFAULT_COMPANY_LOCATION: CompanyLocation = {
  latitude: 33.749,
  longitude: -84.388,
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
};

/**
 * La ubicacion mas quien la cambio por ultima vez.
 *
 * Misma forma que el resto de la configuracion administrativa: la pantalla
 * necesita poder decir «lo movio Fulanita el martes», que ante una factura
 * discutida es la mitad de la respuesta.
 */
export const AdminCompanyLocationSchema = z.strictObject({
  settings: CompanyLocationSchema,
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
});
export type AdminCompanyLocation = z.infer<typeof AdminCompanyLocationSchema>;
