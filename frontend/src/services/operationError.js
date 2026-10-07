export function operationError(error, fallback = 'No se pudo completar la operación. Intenta nuevamente.') {
  const response = error?.response?.data;
  if (response?.code === 'VALIDATION_ERROR' && response.fields?.length) {
    const names = { name: 'nombre', email: 'correo electrónico', phone: 'teléfono', sku: 'SKU', amount: 'importe', method: 'forma de pago', customerId: 'cliente', supplierId: 'proveedor', warehouseId: 'almacén', productId: 'producto', quantity: 'cantidad', unitPrice: 'precio unitario', unitCost: 'costo unitario', taxRate: 'impuesto', employeeId: 'código de empleado', hireDate: 'fecha de ingreso', dueDate: 'fecha límite', budget: 'presupuesto', title: 'nombre de la tarea' };
    const fields = response.fields.map(path => {
      const key = path.split('.').pop(), index = path.match(/\[(\d+)\]/)?.[1];
      return names[key] ? names[key] + (index !== undefined ? ' de partida ' + (Number(index) + 1) : '') : null;
    }).filter(Boolean);
    if (fields.length) return 'Revisa estos datos: ' + [...new Set(fields)].join(', ') + '.';
  }
  if (response?.message) return response.message;
  if (error?.request || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error?.code))
    return 'No pudimos confirmar el resultado. Reintenta desde este mismo formulario o actualiza para revisar si se guardó.';
  return fallback;
}
