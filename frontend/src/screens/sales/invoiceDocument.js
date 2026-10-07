export const money = (value, currency = 'MXN') => Number(value || 0).toFixed(2) + ' ' + currency;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function invoiceText(invoice, customer) {
  return [
    'FACTURA INTERNA ' + invoice.folio, 'Empresa: ' + (invoice.issuerName || 'Empresa emisora'), 'Cliente: ' + (invoice.customerName || customer),
    'Fecha: ' + String(invoice.createdAt || '').slice(0, 10),
    ...(invoice.items || []).map(item => (item.description || item.productId) + ': ' + item.quantity + ' × ' + money(item.unitPrice, invoice.currency)),
    'Subtotal neto: ' + money(invoice.subtotal, invoice.currency),
    'Descuento incluido: ' + money(invoice.discountTotal, invoice.currency),
    'Impuestos: ' + money(invoice.taxTotal, invoice.currency),
    'Total: ' + money(invoice.total, invoice.currency),
    'Documento interno del ERP. No es un comprobante fiscal.'
  ].join('\n');
}
export function invoiceHtml(invoice, customer) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + escape(invoice.folio) +
    '</title><style>body{font:16px Arial;padding:32px;color:#172033}pre{white-space:pre-wrap;line-height:1.7}</style></head><body><h1>Factura interna</h1><pre>' +
    escape(invoiceText(invoice, customer)) + '</pre></body></html>';
}
