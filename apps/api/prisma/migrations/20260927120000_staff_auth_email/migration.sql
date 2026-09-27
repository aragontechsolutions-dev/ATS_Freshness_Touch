-- EL CORREO CON EL QUE SE CREO LA CUENTA DE ACCESO
-- ================================================
-- `staff.email` es el correo de CONTACTO y se puede editar desde el panel.
-- Editarlo no cambia la cuenta del proveedor de identidad, que sigue pidiendo
-- el correo original al iniciar sesion.
--
-- Esa diferencia causo un incidente real: se invito a alguien, se le corrigio
-- despues el correo en su ficha, y la pantalla paso a mostrar una direccion
-- con la que esa persona no podia entrar. Nadie podia darse cuenta mirando.
--
-- Con las dos columnas, el panel puede decir "entra con ...".

ALTER TABLE "staff" ADD COLUMN "authEmail" TEXT;

-- NO SE RELLENA CON `email`, Y ES LO IMPORTANTE DE ESTA MIGRACION.
--
-- Copiar el correo actual afirmaria que ambos coinciden, que es exactamente
-- lo que puede ser falso en las fichas que ya existen: en una de ellas se
-- sabe que NO coinciden, y es la que provoco todo esto.
--
-- Nulo significa "no lo sabemos" y el panel no avisa de nada. Las
-- invitaciones nuevas si lo rellenan, y una ficha antigua queda al dia la
-- proxima vez que se le reenvie la invitacion.
