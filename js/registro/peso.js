const PESO_POR_DEFECTO_KG = 0.5;

export function unidadesPorPack(nombre) {
    const x = /pack\s*x\s*(\d+)/i.exec(nombre ?? '');
    if (x) return Number(x[1]);
    if (/sixpack/i.test(nombre ?? '')) return 6;
    if (/tripack/i.test(nombre ?? '')) return 3;
    if (/fourpack/i.test(nombre ?? '')) return 4;
    return 1;
}

export function kgDePresentacion(texto) {
    const t = String(texto ?? '').toLowerCase();
    const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/.exec(t);
    if (m) {
        const n = Number(m[1].replace(',', '.'));
        if (m[2] === 'kg') return n;
        if (m[2] === 'g' || m[2] === 'ml') return n / 1000;
        return n;
    }
    if (/\bkilo\b/.test(t)) return 1;
    return null;
}

export function pesoProductoKg(producto) {
    const base = kgDePresentacion(producto.presentacion) ?? PESO_POR_DEFECTO_KG;
    return base * unidadesPorPack(producto.nombre);
}

export function pesoCarritoKg(lineas) {
    const total = lineas.reduce((a, l) => a + pesoProductoKg(l.p) * l.cant, 0);
    const limpio = Math.round(total * 1000) / 1000;
    return Math.ceil(limpio * 10) / 10;
}