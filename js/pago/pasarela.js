import { sql } from '../config/neon-config.js';
import { soloDigitos, enmascararTarjeta, enmascararCelular, generarCodigoOperacion } from './validaciones.js';

// El monto SIEMPRE se lee de la base de datos, nunca del formulario
export async function obtenerRegistro(idRegistro, idUsuario) {
  const filas = await sql`
    SELECT id, codigo_seguimiento, monto_calculado, estado_pago
    FROM pedidos_delivery_megamercado
    WHERE id = ${idRegistro} AND id_usuario = ${idUsuario};
  `;
  return filas[0] ?? null;
}

export async function listarPendientesCliente(idUsuario) {
  return await sql`
    SELECT id, codigo_seguimiento, monto_calculado
    FROM pedidos_delivery_megamercado
    WHERE id_usuario = ${idUsuario} AND estado_pago = 'pendiente'
    ORDER BY fecha_registro DESC;
  `;
}

async function registrarRechazo({ registro, usuario, metodo, proveedor = null, marca = null, referencia, motivo }) {
  const codigo = generarCodigoOperacion('RCH');
  await sql`
    INSERT INTO pagos (codigo_operacion, id_registro, id_usuario, canal, metodo, proveedor_billetera,
                       marca_tarjeta, referencia, monto, estado, motivo_rechazo)
    VALUES (${codigo}, ${registro.id}, ${usuario.id}, 'pasarela', ${metodo}, ${proveedor},
            ${marca}, ${referencia}, ${registro.monto_calculado}, 'rechazado', ${motivo});
  `;
  return { aprobado: false, codigo, motivo };
}

function motivoDesdeError(error) {
  if (error.code === '23514') return 'Saldo insuficiente al momento de confirmar.';
  if (error.code === '23505') return 'Esta solicitud ya fue pagada.';
  return 'Error de comunicación con la entidad. No se realizó ningún cargo.';
}

function confirmarCobro({ actualizarSaldo, registro, usuario, codigo, metodo, proveedor = null, marca = null, referencia, monto }) {
  return sql.transaction([
    actualizarSaldo,
    sql`INSERT INTO pagos (codigo_operacion, id_registro, id_usuario, canal, metodo, proveedor_billetera,
                           marca_tarjeta, referencia, monto, estado)
        VALUES (${codigo}, ${registro.id}, ${usuario.id}, 'pasarela', ${metodo}, ${proveedor},
                ${marca}, ${referencia}, ${monto}, 'aprobado');`,
    sql`UPDATE pedidos_delivery_megamercado
        SET estado_pago = 'pagado', canal_pago = 'pasarela', fecha_pago = NOW()
        WHERE id = ${registro.id} AND estado_pago = 'pendiente';`
  ]);
}

export async function pagarConTarjeta({ registro, usuario, numero, mes, anio, cvv, marca }) {
  const pan = soloDigitos(numero);
  const referencia = enmascararTarjeta(pan);

  const filas = await sql`
    SELECT t.tipo, t.mes_venc, t.anio_venc, t.cvv, t.estado,
           c.id AS id_cuenta, c.saldo_disponible
    FROM banco_tarjetas t
    JOIN banco_cuentas c ON c.id = t.id_cuenta
    WHERE t.numero = ${pan};
  `;
  const tarjeta = filas[0];
  const metodo = tarjeta?.tipo === 'credito' ? 'tarjeta_credito' : 'tarjeta_debito';
  const base = { registro, usuario, metodo, marca, referencia };
  const monto = Number(registro.monto_calculado);

  if (!tarjeta) return registrarRechazo({ ...base, motivo: 'Tarjeta no reconocida por la entidad emisora.' });
  if (tarjeta.estado !== 'activa') return registrarRechazo({ ...base, motivo: 'Tarjeta bloqueada. Comunícate con tu entidad.' });
  if (tarjeta.mes_venc !== mes || tarjeta.anio_venc !== anio) return registrarRechazo({ ...base, motivo: 'Fecha de vencimiento incorrecta.' });
  if (tarjeta.cvv !== cvv) return registrarRechazo({ ...base, motivo: 'Código de seguridad incorrecto.' });
  if (Number(tarjeta.saldo_disponible) < monto) {
    const motivo = tarjeta.tipo === 'credito' ? 'Línea de crédito insuficiente.' : 'Saldo insuficiente en la cuenta de ahorros.';
    return registrarRechazo({ ...base, motivo });
  }

  const codigo = generarCodigoOperacion('OP');
  try {
    await confirmarCobro({
      ...base, codigo, monto,
      actualizarSaldo: sql`UPDATE banco_cuentas SET saldo_disponible = saldo_disponible - ${monto}
                           WHERE id = ${tarjeta.id_cuenta};`
    });
    return { aprobado: true, codigo };
  } catch (error) {
    console.error(error);
    return registrarRechazo({ ...base, motivo: motivoDesdeError(error) });
  }
}

export async function pagarConBilletera({ registro, usuario, proveedor, celular, codigoAprobacion }) {
  const cel = soloDigitos(celular);
  const base = { registro, usuario, metodo: 'billetera', proveedor, referencia: enmascararCelular(cel) };
  const monto = Number(registro.monto_calculado);

  const filas = await sql`
    SELECT id, saldo_disponible, codigo_aprobacion
    FROM billeteras
    WHERE proveedor = ${proveedor} AND celular = ${cel};
  `;
  const billetera = filas[0];

  if (!billetera) return registrarRechazo({ ...base, motivo: 'El celular no está afiliado a esa billetera.' });
  if (billetera.codigo_aprobacion !== codigoAprobacion) return registrarRechazo({ ...base, motivo: 'Código de aprobación incorrecto.' });
  if (Number(billetera.saldo_disponible) < monto) return registrarRechazo({ ...base, motivo: 'Saldo insuficiente en la billetera.' });

  const codigo = generarCodigoOperacion('OP');
  try {
    await confirmarCobro({
      ...base, codigo, monto,
      actualizarSaldo: sql`UPDATE billeteras SET saldo_disponible = saldo_disponible - ${monto}
                           WHERE id = ${billetera.id};`
    });
    return { aprobado: true, codigo };
  } catch (error) {
    console.error(error);
    return registrarRechazo({ ...base, motivo: motivoDesdeError(error) });
  }
}