/**
 * Cache en memoria con caducidad y tamano maximo.
 *
 * Vive en `common/` porque la usan dos cosas que no tienen nada que ver:
 *
 *   - LA DISTANCIA. Cada consulta al proveedor real cuesta dinero, y la
 *     distancia entre dos codigos postales no cambia.
 *   - LA AUDITORIA DEL ACCESO. Recuerda que sesiones ya se registraron, para
 *     no escribir una fila por cada vez que alguien cambia de pestana.
 *
 * El limite de entradas es tambien una medida de seguridad: sin el, se podria
 * inflar la memoria del servidor hasta agotarla generando claves distintas.
 */
export class TtlCache<TValue> {
  private readonly entries = new Map<string, { value: TValue; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get(key: string, now: number = Date.now()): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: TValue, now: number = Date.now()): void {
    if (this.ttlMs <= 0) return;

    // Evicta la entrada mas antigua (las claves de Map conservan orden de insercion).
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
