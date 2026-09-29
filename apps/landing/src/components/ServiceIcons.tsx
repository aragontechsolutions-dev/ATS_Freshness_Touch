import type { ComponentType } from 'react';
import type { ServiceType } from '@freshness/types';
import type { IconProps } from './Icons';

/**
 * ============================================================================
 * UN ICONO POR SERVICIO
 * ============================================================================
 * Antes las seis tarjetas de la seccion de servicios llevaban la MISMA imagen
 * (el girasol de la marca). Un adorno repetido seis veces no distingue una
 * limpieza estandar de una post-obra: ocupa el sitio donde deberia haber
 * informacion y no dice nada.
 *
 * MISMO ESTILO QUE `Icons.tsx`, a proposito: `viewBox` de 24, trazo de 1.8 y
 * `currentColor`. Asi el color lo decide quien los usa (la placa de la tarjeta
 * en este caso) y el dibujo encaja con los iconos que ya habia en el sitio.
 * Sin libreria de iconos, por lo mismo que se decidio entonces: no arrastrar
 * una dependencia entera por unos pocos simbolos.
 *
 * SON DECORATIVOS (`aria-hidden`): cada tarjeta ya lleva su titulo como texto
 * de verdad. Un lector de pantalla que anunciase «pulverizador» antes de
 * «Limpieza estandar» solo estaria repitiendo con menos precision.
 *
 * Cada dibujo se eligio por ser LO QUE EL OFICIO RECONOCE, no por ser bonito:
 * el pulverizador, el cepillo, la caja de mudanza, la cama, el casco de obra y
 * el edificio de oficinas son los simbolos que ya usa el sector, y se leen sin
 * leyenda a 20 pixeles, que es el tamano al que se pintan.
 * ============================================================================
 */

const base = 'h-5 w-5';

/** Limpieza estandar: el pulverizador, la herramienta del dia a dia. */
export function SprayBottleIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Cuerpo del bote: ancho de verdad, o a 24 px parece un tubo */}
      <path d="M6.4 13.4a2.2 2.2 0 0 1 2.2-2.2h3.6a2.2 2.2 0 0 1 2.2 2.2v6a2.2 2.2 0 0 1-2.2 2.2H8.6a2.2 2.2 0 0 1-2.2-2.2Z" />
      {/* Cuello */}
      <path d="M9.4 11.2V7.4h2.6v3.8" />
      {/* Cabezal y gatillo */}
      <path d="M12 7.4h3.5M12.9 7.4v1.9" />
      {/* El chorro, en abanico: lo que convierte el bote en pulverizador */}
      <path d="M16.7 7.4h2.9M16.4 5.3 18.9 3.9M16.4 9.5 18.9 10.9" />
    </svg>
  );
}

/** Limpieza profunda: el cepillo de cerdas, lo que se usa cuando no basta pasar un pano. */
export function ScrubBrushIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Asa */}
      <path d="M9 10.2V8.6a3 3 0 0 1 6 0v1.6" />
      {/* Bloque del cepillo */}
      <path d="M4.8 10.2h14.4a1.4 1.4 0 0 1 1.4 1.4v2.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4v-2.2a1.4 1.4 0 0 1 1.4-1.4Z" />
      {/* Cerdas: alternas largas y cortas, que es como se ve un cepillo de verdad */}
      <path d="M6.8 15.2v4M9.6 15.2v2.8M12 15.2v4M14.4 15.2v2.8M17.2 15.2v4" />
    </svg>
  );
}

/** Entrada y salida de vivienda: la caja de mudanza. */
export function MovingBoxIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Tapa, mas ancha que el cuerpo: es lo que hace que se lea «caja» y no «cubo» */}
      <path d="M3 5.5h18v4H3Z" />
      {/* Cuerpo */}
      <path d="M4.5 9.5h15v10a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5Z" />
      {/* La ranura del asa */}
      <path d="M10 14h4" />
    </svg>
  );
}

/** Rotacion de Airbnb: la cama hecha, que es el entregable de una rotacion. */
export function BedIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Cabecero y pata izquierda, de una sola pieza */}
      <path d="M2.8 20.5V7.5" />
      {/* El colchon: recto y luego el vuelo del pie de la cama */}
      <path d="M2.8 12.8h12.4a6 6 0 0 1 6 6v1.7" />
      {/* La linea de la sabana */}
      <path d="M2.8 16.9h18.4" />
      {/* La almohada */}
      <path d="M6.2 12.8v-2.4h4.8v2.4" />
    </svg>
  );
}

/** Post-obra: el casco, el simbolo universal de que aun hay obra. */
export function HardHatIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* La cupula */}
      <path d="M4.6 15.4a7.4 7.4 0 0 1 14.8 0" />
      {/* La cresta central */}
      <path d="M9.6 15.4V9.4a1.6 1.6 0 0 1 1.6-1.6h1.6a1.6 1.6 0 0 1 1.6 1.6v6" />
      {/* La visera */}
      <path d="M3.4 15.4h17.2a1.5 1.5 0 0 1 1.5 1.5v.6a1.5 1.5 0 0 1-1.5 1.5H3.4a1.5 1.5 0 0 1-1.5-1.5v-.6a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

/** Comercial y oficinas: el edificio, no una casa. */
export function OfficeBuildingIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Torre principal */}
      <path d="M4 20.8V4.8a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15 4.8v16" />
      {/* Cuerpo bajo anexo: dos alturas distintas leen «edificio», una sola lee «puerta» */}
      <path d="M15 10.3h3.5A1.5 1.5 0 0 1 20 11.8v9" />
      {/* Ventanas en dos columnas y tres plantas */}
      <path d="M7.4 7.3h1.4M11.2 7.3h1.4M7.4 11.3h1.4M11.2 11.3h1.4M7.4 15.3h1.4M11.2 15.3h1.4" />
      {/* El suelo, para que el edificio no flote */}
      <path d="M2.5 20.8h19" />
    </svg>
  );
}

/**
 * EL MAPA ES `Record<ServiceType, …>` A PROPOSITO.
 *
 * Con un `Record` completo, anadir un servicio al catalogo y olvidar su icono
 * NO COMPILA. Si esto fuese un objeto parcial o un `?.`, el servicio nuevo
 * saldria en produccion con un hueco en blanco y nadie se enteraria hasta que
 * lo viese un cliente.
 */
export const ICONO_POR_SERVICIO: Record<ServiceType, ComponentType<IconProps>> = {
  STANDARD: SprayBottleIcon,
  DEEP: ScrubBrushIcon,
  MOVE_IN_OUT: MovingBoxIcon,
  AIRBNB_TURNOVER: BedIcon,
  POST_CONSTRUCTION: HardHatIcon,
  COMMERCIAL: OfficeBuildingIcon,
};
