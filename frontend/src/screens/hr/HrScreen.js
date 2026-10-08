import { operationError } from '../../services/operationError';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, ScrollView, Button } from '../../design/ui';
import { hrApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import RecordEditor, { validateRecord } from '../../components/RecordEditor';
const fields = [
  { key: 'employeeId', label: 'Código de empleado', required: true, maxLength: 20, hint: 'Un código único dentro de tu empresa, por ejemplo EMP-001.' },
  { key: 'name', label: 'Nombre completo', required: true, maxLength: 150 }, { key: 'email', label: 'Correo electrónico', email: true },
  { key: 'phone', label: 'Teléfono', maxLength: 30 }, { key: 'position', label: 'Puesto', maxLength: 100 },
  { key: 'hireDate', label: 'Fecha de ingreso', date: true, maxLength: 10, hint: 'AAAA-MM-DD. Puedes dejarla vacía.' },
  { key: 'salary', label: 'Salario de referencia', numeric: true, hint: 'Este dato no calcula nómina ni genera pagos.' }
];
export default function HrScreen({ onBack }) {
  const { has } = useAuth();
  const [employees, setEmployees] = useState([]), [form, setForm] = useState(null), [editing, setEditing] = useState(null), [error, setError] = useState(''), [formError, setFormError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [total, setTotal] = useState(0), [confirmation, setConfirmation] = useState(null);
  const running = useRef(false), version = useRef(0);
  async function load() {
    const request = ++version.current;
    try { const data = await hrApi.getEmployees({ search, page, limit: 20 }); if (request === version.current) { setEmployees(data.items || []); setTotal(data.total || 0); } }
    catch (err) { if (request === version.current) setError(err.response?.data?.message || 'No se pudo cargar el personal. Pulsa Actualizar para reintentar.'); }
  }
  useEffect(() => { load(); return () => { version.current++; }; }, [search, page]);
  function open(employee = null) {
    setEditing(employee); setForm(Object.fromEntries(fields.map(field => [field.key, field.date ? employee?.[field.key]?.slice(0, 10) || '' : String(employee?.[field.key] ?? '')]))); setFormError('');
  }
  async function action(work, text) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(text); await load(); return result; }
    catch (err) { const text = operationError(err); setError(text); setFormError(text); }
    finally { running.current = false; setBusy(false); }
  }
  async function save() {
    const invalid = validateRecord(fields, form); if (invalid) { setFormError(invalid); return; }
    const data = { employeeId: form.employeeId.trim(), name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), position: form.position.trim(), ...(form.hireDate ? { hireDate: form.hireDate } : {}), ...(form.salary.trim() ? { salary: Number(form.salary) } : {}) };
    const result = await action(() => editing ? hrApi.updateEmployee(editing._id, data) : hrApi.createEmployee(data), 'Registro de personal guardado');
    if (result) setForm(null);
  }
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <PageHeader title="Personal" subtitle="Mantén los datos de tus empleados. Su ficha no crea una cuenta de acceso al ERP." />
    <View style={styles.row}>{onBack && <Button title="Volver" onPress={onBack} />}<Button title="Actualizar" disabled={busy} onPress={load} />{has('hr.employees.create') && <Button title="Nuevo empleado" disabled={busy} onPress={() => open()} />}</View>
    <TextInput accessibilityLabel="Buscar empleado" placeholder="Buscar por nombre o código…" style={styles.input} value={search} onChangeText={value => { setSearch(value); setPage(1); }} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert">{message}</Text>}
    {form && <RecordEditor title={editing ? 'Editar empleado' : 'Nuevo empleado'} fields={fields} values={form} onChange={setForm} onSave={save} onCancel={() => setForm(null)} busy={busy} error={formError} />}
    {!employees.length && <Text>No hay empleados en esta página.</Text>}
    {employees.map(employee => <View key={employee._id} style={styles.card}><Text style={styles.title}>{employee.name}</Text><Text>{employee.employeeId} · {employee.position || 'Puesto sin definir'}</Text><Text>{employee.email || 'Sin correo'} · {employee.phone || 'Sin teléfono'}</Text><Text>Estado: {employee.status === 'ACTIVE' ? 'Activo' : employee.status === 'INACTIVE' ? 'Inactivo' : 'Baja registrada'}</Text>
      {has('hr.employees.update') && <View style={styles.row}><Button title={'Editar ' + employee.name} disabled={busy} onPress={() => open(employee)} />{employee.status !== 'TERMINATED' && <Button title={employee.status === 'ACTIVE' ? 'Desactivar ficha' : 'Activar ficha'} disabled={busy} onPress={() => setConfirmation(employee)} />}</View>}
    </View>)}
    {confirmation && <View style={styles.card}><Text>¿Cambiar el estado de la ficha de {confirmation.name}? Esto no modifica su cuenta de acceso ni representa una baja laboral.</Text><Button title="Confirmar estado de ficha" disabled={busy} onPress={async () => { const result = await action(() => hrApi.updateEmployee(confirmation._id, { status: confirmation.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }), 'Estado de ficha actualizado'); if (result) setConfirmation(null); }} /><Button title="Volver sin cambios" disabled={busy} onPress={() => setConfirmation(null)} /></View>}
    <View style={styles.row}><Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: tokens.spacing.md, gap: tokens.spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }, card: { padding: 16, gap: 8, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12 }, title: { fontSize: 18, fontWeight: '700' }, input: { borderWidth: 1, borderColor: tokens.colors.border, padding: 12, borderRadius: 8 }, error: { color: tokens.colors.error } });
