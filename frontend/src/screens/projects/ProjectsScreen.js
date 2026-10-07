import { operationError } from '../../services/operationError';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Button, StyleSheet } from 'react-native';
import { projectsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { tokens } from '../../theme/tokens';
import PageHeader from '../../components/layout/PageHeader';
import RecordEditor, { validateRecord } from '../../components/RecordEditor';
import { money } from '../sales/invoiceDocument';
const projectFields = [{ key: 'name', label: 'Nombre del proyecto', required: true }, { key: 'description', label: 'Objetivo y alcance', maxLength: 2000, multiline: true }, { key: 'budget', label: 'Presupuesto de referencia', numeric: true, hint: 'No genera gastos ni reserva dinero.' }];
const taskFields = [{ key: 'title', label: 'Nombre de la tarea', required: true }, { key: 'description', label: 'Descripción de la tarea', maxLength: 2000, multiline: true }, { key: 'dueDate', label: 'Fecha límite', date: true, maxLength: 10, hint: 'AAAA-MM-DD. Puedes dejarla vacía.' }];
const labels = { PLANNING: 'En planificación', ACTIVE: 'Activo', ON_HOLD: 'En pausa', COMPLETED: 'Terminado', CANCELLED: 'Cancelado', TODO: 'Pendiente', IN_PROGRESS: 'En curso', DONE: 'Completada' };
export default function ProjectsScreen({ onBack }) {
  const { has } = useAuth();
  const [projects, setProjects] = useState([]), [selected, setSelected] = useState(null), [tasks, setTasks] = useState([]), [form, setForm] = useState(null), [editing, setEditing] = useState(null), [formType, setFormType] = useState('project');
  const [error, setError] = useState(''), [formError, setFormError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [taskPage, setTaskPage] = useState(1), [taskTotal, setTaskTotal] = useState(0);
  const running = useRef(false), version = useRef(0), taskVersion = useRef(0);
  async function load() {
    const request = ++version.current;
    try { const data = await projectsApi.getProjects({ page, limit: 20 }); if (request === version.current) { setProjects(data.items || []); setTotal(data.total || 0); if (selected) setSelected(data.items.find(item => item._id === selected._id) || selected); } }
    catch (err) { if (request === version.current) setError(err.response?.data?.message || 'No se pudieron cargar los proyectos.'); }
  }
  async function loadTasks(id = selected?._id) {
    if (!id || !has('projects.tasks.read')) return;
    const request = ++taskVersion.current;
    try { const data = await projectsApi.getTasks({ projectId: id, page: taskPage, limit: 20 }); if (request === taskVersion.current) { setTasks(data.items || []); setTaskTotal(data.total || 0); } }
    catch (err) { if (request === taskVersion.current) setError(err.response?.data?.message || 'No se pudieron cargar las tareas.'); }
  }
  useEffect(() => { load(); return () => { version.current++; }; }, [page]);
  useEffect(() => { setTasks([]); loadTasks(); return () => { taskVersion.current++; }; }, [selected?._id, taskPage]);
  function open(type, record = null) {
    setFormType(type); setEditing(record); setForm(Object.fromEntries((type === 'project' ? projectFields : taskFields).map(field => [field.key, field.date ? record?.[field.key]?.slice(0, 10) || '' : String(record?.[field.key] ?? '')]))); setFormError('');
  }
  async function action(work, text) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await work(); setMessage(text); await load(); await loadTasks(); return result; }
    catch (err) { const text = operationError(err); setError(text); setFormError(text); }
    finally { running.current = false; setBusy(false); }
  }
  async function save() {
    const invalid = validateRecord(formType === 'project' ? projectFields : taskFields, form); if (invalid) { setFormError(invalid); return; }
    const data = formType === 'project' ? { name: form.name.trim(), description: form.description.trim(), budget: Number(form.budget || 0) } : { title: form.title.trim(), description: form.description.trim(), ...(form.dueDate ? { dueDate: form.dueDate } : {}), projectId: selected._id };
    const result = await action(() => formType === 'project' ? editing ? projectsApi.updateProject(editing._id, data) : projectsApi.createProject(data) : editing ? projectsApi.updateTask(editing._id, data) : projectsApi.createTask(data), formType === 'project' ? 'Proyecto guardado' : 'Tarea guardada');
    if (result) setForm(null);
  }
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <PageHeader title="Proyectos" subtitle="Organiza objetivos, tareas y fechas sin perder de vista lo pendiente." />
    <View style={styles.row}>{onBack && <Button title="Volver" onPress={onBack} />}<Button title="Actualizar" disabled={busy} onPress={async () => { await load(); await loadTasks(); }} />{has('projects.create') && <Button title="Nuevo proyecto" disabled={busy} onPress={() => open('project')} />}</View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert">{message}</Text>}
    {form && <RecordEditor title={formType === 'project' ? editing ? 'Editar proyecto' : 'Nuevo proyecto' : editing ? 'Editar tarea' : 'Nueva tarea'} fields={formType === 'project' ? projectFields : taskFields} values={form} onChange={setForm} onSave={save} onCancel={() => setForm(null)} busy={busy} error={formError} />}
    {!projects.length && <Text>No hay proyectos en esta página.</Text>}
    {projects.map(project => <View key={project._id} style={styles.card}><Text style={styles.title}>{project.name}</Text><Text>{project.description || 'Sin descripción'}</Text><Text>Estado: {labels[project.status] || project.status}</Text><Text>Presupuesto: {money(project.budget || 0)}</Text>
      <View style={styles.row}>{has('projects.tasks.read') && <Button title={'Ver tareas de ' + project.name} disabled={busy} onPress={() => { setSelected(project); setTaskPage(1); setForm(null); }} />}
      {has('projects.update') && <><Button title={'Editar ' + project.name} disabled={busy} onPress={() => open('project', project)} />{!['COMPLETED', 'CANCELLED'].includes(project.status) && <><Button title={project.status === 'ACTIVE' ? 'Pausar proyecto' : 'Activar proyecto'} disabled={busy} onPress={() => setConfirmation({ id: project._id, type: 'project', status: project.status === 'ACTIVE' ? 'ON_HOLD' : 'ACTIVE', name: project.name })} /><Button title="Finalizar proyecto" disabled={busy} onPress={() => setConfirmation({ id: project._id, type: 'project', status: 'COMPLETED', name: project.name })} /></>}</>}</View>
    </View>)}
    {selected && <View style={styles.card}>
      <Text style={styles.title}>Tareas · {selected.name}</Text><View style={styles.row}>{has('projects.tasks.create') && !['COMPLETED', 'CANCELLED'].includes(selected.status) && <Button title="Nueva tarea" disabled={busy} onPress={() => open('task')} />}<Button title="Cerrar tareas" disabled={busy} onPress={() => { setSelected(null); setForm(null); }} /></View>
      {!tasks.length && <Text>No hay tareas en esta página.</Text>}
      {tasks.map(task => <View key={task._id} style={styles.card}><Text style={styles.title}>{task.title}</Text><Text>Estado: {labels[task.status] || task.status}</Text><Text>{task.description || 'Sin descripción'}</Text><Text>Fecha límite: {task.dueDate?.slice(0, 10) || 'Sin definir'}</Text>
        {has('projects.tasks.update') && !['COMPLETED', 'CANCELLED'].includes(selected.status) && <View style={styles.row}><Button title={'Editar tarea ' + task.title} disabled={busy} onPress={() => open('task', task)} />{['TODO', 'IN_PROGRESS'].includes(task.status) && <Button title={task.status === 'TODO' ? 'Iniciar tarea' : 'Completar tarea'} disabled={busy} onPress={() => setConfirmation({ id: task._id, type: 'task', status: task.status === 'TODO' ? 'IN_PROGRESS' : 'DONE', name: task.title })} />}</View>}
      </View>)}
      <View style={styles.row}><Button title="Tareas anteriores" disabled={busy || taskPage === 1} onPress={() => setTaskPage(taskPage - 1)} /><Text>Página de tareas {taskPage}</Text><Button title="Tareas siguientes" disabled={busy || taskPage * 20 >= taskTotal} onPress={() => setTaskPage(taskPage + 1)} /></View>
    </View>}
    {confirmation && <View style={styles.card}><Text>Cambiar {confirmation.name} a {labels[confirmation.status]}. {confirmation.status === 'COMPLETED' ? 'Primero deben estar resueltas todas sus tareas.' : ''}</Text><Button title="Confirmar cambio de proyecto o tarea" disabled={busy} onPress={async () => { const result = await action(() => confirmation.type === 'project' ? projectsApi.updateProject(confirmation.id, { status: confirmation.status }) : projectsApi.updateTask(confirmation.id, { status: confirmation.status }), 'Estado actualizado'); if (result) setConfirmation(null); }} /><Button title="Volver sin cambios" disabled={busy} onPress={() => setConfirmation(null)} /></View>}
    <View style={styles.row}><Button title="Anterior" disabled={busy || page === 1} onPress={() => setPage(page - 1)} /><Text>Página {page}</Text><Button title="Siguiente" disabled={busy || page * 20 >= total} onPress={() => setPage(page + 1)} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { padding: tokens.spacing.md, gap: tokens.spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }, card: { padding: 16, gap: 8, backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12 }, title: { fontSize: 18, fontWeight: '700' }, error: { color: tokens.colors.error } });
