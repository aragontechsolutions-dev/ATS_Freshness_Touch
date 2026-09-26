/**
 * React exige que se declare que esto es un entorno de pruebas antes de
 * usar `act()`. Sin la bandera, cada render escupe «The current testing
 * environment is not configured to support act(...)» y el ruido acaba
 * tapando los avisos que si importan.
 *
 * Va en un archivo aparte y no dentro de cada prueba porque tiene que estar
 * puesta ANTES de que se cargue React.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
