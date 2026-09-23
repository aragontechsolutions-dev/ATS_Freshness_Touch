import { describe, expect, it } from 'vitest';
import { StaffCreateSchema, StaffUpdateSchema } from './staff';

const VALIDA = {
  firstName: 'Ana',
  lastName: 'Garcia',
  email: 'ana@example.com',
  phone: '+14045550123',
  role: 'CLEANER',
};

describe('alta de personal', () => {
  it('acepta una ficha completa', () => {
    expect(StaffCreateSchema.safeParse(VALIDA).success).toBe(true);
  });

  it('el telefono puede faltar: no todo el mundo da uno', () => {
    expect(StaffCreateSchema.safeParse({ ...VALIDA, phone: null }).success).toBe(true);
  });

  it('normaliza el correo a minusculas y sin espacios', () => {
    const ficha = StaffCreateSchema.parse({ ...VALIDA, email: '  Ana.Garcia@Example.COM ' });
    expect(ficha.email).toBe('ana.garcia@example.com');
  });

  it('recorta los espacios del nombre', () => {
    const ficha = StaffCreateSchema.parse({ ...VALIDA, firstName: '  Ana  ' });
    expect(ficha.firstName).toBe('Ana');
  });

  it.each([
    ['', 'vacio'],
    ['   ', 'solo espacios'],
  ])('rechaza un nombre %s', (valor) => {
    expect(StaffCreateSchema.safeParse({ ...VALIDA, firstName: valor }).success).toBe(false);
  });

  it('rechaza un correo que no lo es', () => {
    expect(StaffCreateSchema.safeParse({ ...VALIDA, email: 'ana' }).success).toBe(false);
  });

  it('rechaza un telefono que no va en formato internacional', () => {
    expect(StaffCreateSchema.safeParse({ ...VALIDA, phone: '404-555-0123' }).success).toBe(false);
  });

  it('rechaza un puesto inventado', () => {
    expect(StaffCreateSchema.safeParse({ ...VALIDA, role: 'DUENO' }).success).toBe(false);
  });

  /*
   * LA PRUEBA QUE IMPORTA AQUI. El contrato es estricto para que por esta
   * puerta no entre NADA relacionado con credenciales ni con el acceso.
   *
   *   - Una contrasena no debe poder escribirse jamas: no se guardan aqui,
   *     viven en el proveedor de identidad.
   *   - `authUserId` es lo que decide si alguien puede entrar al panel. Si se
   *     pudiera mandar en el alta, cualquiera con permiso para crear personal
   *     podria vincular una ficha a una cuenta ajena, o a la suya, y eso es
   *     conceder acceso sin pasar por la invitacion.
   *   - `isActive` no se elige al crear: todo el mundo nace activo. Aceptarlo
   *     solo permitiria crear fichas fantasma.
   */
  it.each(['password', 'authUserId', 'isActive', 'invitedAt', 'staffId'])(
    'rechaza que se cuele el campo %s',
    (campo) => {
      const resultado = StaffCreateSchema.safeParse({ ...VALIDA, [campo]: 'algo' });
      expect(resultado.success).toBe(false);
    },
  );
});

describe('edicion de personal', () => {
  const EDICION = { ...VALIDA, isActive: true };

  it('acepta la ficha entera con el estado', () => {
    expect(StaffUpdateSchema.safeParse(EDICION).success).toBe(true);
  });

  it('dar de baja es un valor valido, no un error', () => {
    expect(StaffUpdateSchema.safeParse({ ...EDICION, isActive: false }).success).toBe(true);
  });

  /*
   * Falta `isActive` a proposito: el contrato de edicion lo exige. Mandar la
   * ficha sin el dejaria que un formulario a medio construir diera de baja a
   * alguien sin querer, o peor, lo reactivara.
   */
  it('exige el estado: no se edita a medias', () => {
    expect(StaffUpdateSchema.safeParse(VALIDA).success).toBe(false);
  });

  it.each(['password', 'authUserId'])('rechaza que se cuele el campo %s', (campo) => {
    expect(StaffUpdateSchema.safeParse({ ...EDICION, [campo]: 'algo' }).success).toBe(false);
  });
});
