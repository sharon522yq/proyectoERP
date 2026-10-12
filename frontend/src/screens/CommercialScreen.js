import React, { useEffect, useState, useRef } from 'react';
import { View, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { Text as DesignText, TextInput, ScrollView } from '../design/ui';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
const Text = props => <DesignText {...props} style={[{ color: '#163655' }, props.style]} />;

const readRoute = () => Platform.OS !== 'web' || typeof window === 'undefined' || !window.location ? 'home' : window.location.hash.slice(1).split('?')[0] || 'home';
const readToken = () => Platform.OS !== 'web' || typeof window === 'undefined' || !window.location ? '' : new URLSearchParams(window.location.hash.split('?')[1] || '').get('token') || '';

export default function CommercialScreen({ onLogin, onDashboard, initialRoute }) {
  const auth = useAuth();
  const [route, setRoute] = useState(() => initialRoute || readRoute());
  const [plan, setPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', token: readToken(), branchName: '', inviteEmail: '', invitePassword: '', acceptTerms: false });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const go = next => {
    setRoute(next); setError(''); setMessage(''); setInviteAccepted(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.hash = next;
  };
  const call = async (path, data, method = 'post') => (await api[method](`/commercial/${path}`, data)).data.data;
  const run = async fn => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) {
      const explanations = { COMMERCIAL_DISABLED: 'El alta de empresas nuevas no está disponible en este momento. Si te invitaron a una empresa, abre el enlace de invitación.',
        MAIL_DISABLED: 'El correo transaccional aún no está configurado.', PAYMENT_PROVIDER_ERROR: 'No pudimos contactar al proveedor. Revisa el estado antes de volver a pagar.' };
      setError(explanations[e.response?.data?.code] || e.response?.data?.message || (e.message === 'INVALID_FORM' ? 'Revisa los campos, confirma la contraseña y acepta los términos.' : 'No se pudo conectar. Intenta nuevamente.'));
    }
    finally { pending.current = false; setBusy(false); }
  };
  const reload = async () => {
    setMemberships(await call('memberships', undefined, 'get'));
    try { setSubscription(await call('subscription', undefined, 'get')); }
    catch (error) { if (error.response?.status !== 404) throw error; setSubscription(null); }
  };
  useEffect(() => {
    run(async () => { setPlan(await call('catalog', undefined, 'get')); if (auth.user) await reload(); });
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => { setRoute(readRoute()); setForm(previous => ({ ...previous, token: readToken() })); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [auth.user]);
  const field = (key, label, secure = false) => <View key={key} style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={form[key]} secureTextEntry={secure}
      autoCapitalize={key.toLowerCase().includes('email') || secure || key === 'token' ? 'none' : 'sentences'}
      keyboardType={key.toLowerCase().includes('email') ? 'email-address' : 'default'}
      onChangeText={value => setForm(previous => ({ ...previous, [key]: value }))} style={styles.input} />
  </View>;
  const button = (label, fn, secondary = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={fn}
    style={[styles.button, secondary && styles.secondary, busy && { opacity: 0.5 }]}><Text style={[styles.buttonText, secondary && { color: '#163655' }]}>{label}</Text></Pressable>;
  const open = async path => { const result = await call(path); await Linking.openURL(result.url); };
  const price = plan?.amount == null ? 'Precio pendiente de configuración' :
    `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: plan.currency.toUpperCase() }).format(plan.amount / 100)} / ${plan.interval === 'month' ? 'mes' : 'año'}`;
  return <ScrollView style={styles.page} contentContainerStyle={styles.container}>
    <View style={styles.nav}><Text style={styles.brand}>NexusERP</Text><View style={styles.actions}>
      {button('Inicio', () => go('home'), true)}
      {auth.user ? button('Mi suscripción', () => go('subscription'), true) : button('Iniciar sesión', onLogin, true)}
      {auth.user && button('Salir', () => auth.logout(), true)}
      {auth.user && plan?.checkoutEnabled && button('Contratar otra empresa', () => go('new-contract'), true)}
    </View></View>
    {busy && <Text accessibilityLiveRegion="polite">Procesando…</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
    {plan && !plan.checkoutEnabled && <Text style={styles.body}>La contratación de empresas nuevas está deshabilitada. Puedes iniciar sesión o aceptar una invitación existente.</Text>}
    {route === 'home' && <>
      <View style={styles.hero}><Text style={styles.eyebrow}>GESTIÓN PARA TU EMPRESA</Text>
        <Text style={styles.title}>Tu operación, conectada en un solo lugar.</Text>
        <Text style={styles.lead}>Organiza clientes, productos, inventario y ventas con NexusERP. Trabaja con permisos por rol y datos separados por empresa.</Text>
        {plan?.checkoutEnabled && button(auth.user ? 'Continuar mi contratación' : 'Elegir el plan', () => go(auth.user ? 'subscription' : 'register'))}
      </View>
      <View style={styles.cards}>{[['Clientes y ventas', 'Consulta oportunidades, cotizaciones, pedidos y facturas.'], ['Operación', 'Gestiona productos, movimientos de inventario y compras.'], ['Administración', 'Reúne finanzas, recursos humanos, proyectos y producción.']].map(([title, text]) => <View key={title} style={styles.card}><Text style={styles.heading}>{title}</Text><Text style={styles.body}>{text}</Text></View>)}</View>
      <View style={styles.card}><Text style={styles.heading}>Demostración · datos ficticios</Text><Text style={styles.body}>Empresa Ejemplo · 12 productos · 3 pedidos pendientes. Estos valores son ilustrativos y no pertenecen a clientes.</Text></View>
      <View style={styles.card}><Text style={styles.heading}>{plan?.name || 'Plan inicial'}</Text><Text style={styles.price}>{price}</Text>
        <Text style={styles.body}>{plan?.testData ? 'Oferta de prueba. No es un precio comercial definitivo.' : 'Oferta configurada por la plataforma.'}</Text>
        <Text style={styles.body}>Hasta {plan?.maxUsers || '—'} usuarios. Cancelación al final del periodo. Sin periodo de gracia.</Text>
        {plan?.checkoutEnabled && button('Contratar', () => go(auth.user ? 'subscription' : 'register'))}</View>
      <View style={styles.card}><Text style={styles.heading}>Preguntas frecuentes</Text><Text style={styles.body}>¿Cuándo accedo? Después de verificar tu correo y recibir la confirmación del proveedor de pagos.</Text><Text style={styles.body}>¿Puedo cerrar el navegador? Sí. Tu contratación se recupera al iniciar sesión. No repitas un pago mientras está pendiente.</Text><Text style={styles.body}>¿Cómo cancelo? Desde Mi suscripción; el acceso dura hasta la vigencia pagada.</Text>
        <Text style={styles.body}>Contacto: el canal comercial está pendiente de configuración. No hay un servicio de soporte publicado todavía.</Text></View>
    </>}
    {route === 'register' && plan?.checkoutEnabled && <View style={styles.card}><Text style={styles.heading}>Crea tu cuenta</Text>
      {field('name', 'Nombre')}{field('email', 'Correo')}{field('companyName', 'Nombre de empresa')}{field('password', 'Contraseña (mínimo 8 caracteres, máximo 72 bytes)', true)}{field('confirmPassword', 'Confirma la contraseña', true)}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.acceptTerms }} onPress={() => setForm(p => ({ ...p, acceptTerms: !p.acceptTerms }))}><Text style={styles.body}>{form.acceptTerms ? '☑' : '☐'} Acepto la versión {plan?.termsVersion} de los términos y privacidad para pruebas.</Text></Pressable>
      {button('Leer términos y privacidad', () => go('legal'), true)}
      {button('Registrar cuenta', () => run(async () => {
        if (form.password !== form.confirmPassword || form.password.length < 8 || !form.acceptTerms || !form.companyName.trim() || !form.name.trim() || !form.email.includes('@')) throw new Error('INVALID_FORM');
        await api.post('/auth/register', { ...form, termsVersion: plan?.termsVersion });
        await auth.login(form.email, form.password); go('subscription');
      }))}
    </View>}
    {route === 'new-contract' && plan?.checkoutEnabled && <View style={styles.card}><Text style={styles.heading}>Contratar una empresa nueva</Text>
      {field('companyName', 'Nombre de empresa')}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.acceptTerms }} onPress={() => setForm(p => ({ ...p, acceptTerms: !p.acceptTerms }))}><Text style={styles.body}>{form.acceptTerms ? '☑' : '☐'} Acepto términos versión {plan?.termsVersion}.</Text></Pressable>
      {button('Guardar contratación', () => run(async () => { await call('contracts', { companyName: form.companyName, acceptTerms: form.acceptTerms, termsVersion: plan?.termsVersion }); await reload(); go('subscription'); }))}
    </View>}
    {route === 'verify' && <View style={styles.card}><Text style={styles.heading}>Verificar correo</Text>{field('token', 'Token de verificación')}{button('Verificar', () => run(async () => { await call('verify', { token: form.token }); setMessage('Correo verificado. Inicia sesión o continúa la contratación.'); }))}</View>}
    {['forgot', 'reset'].includes(route) && <View style={styles.card}><Text style={styles.heading}>Recuperar contraseña</Text>
      {route === 'forgot' ? field('email', 'Correo') : <>{field('token', 'Token de recuperación')}{field('password', 'Nueva contraseña', true)}</>}
      {button('Enviar', () => run(async () => { await api.post(`/auth/${route === 'forgot' ? 'forgot-password' : 'reset-password'}`, route === 'forgot' ? { email: form.email } : { token: form.token, newPassword: form.password }); setMessage(route === 'forgot' ? 'Si la cuenta existe, recibirás instrucciones.' : 'Contraseña actualizada. Inicia sesión.'); }))}
    </View>}
    {route === 'invite' && <View style={styles.card}><Text style={styles.heading}>Aceptar invitación</Text>
      <Text style={styles.body}>La invitación solo funciona para el correo al que fue enviada. Si ya tienes cuenta, inicia sesión para agregar la empresa.</Text>
      {inviteAccepted ? <>
        <Text style={styles.message}>La invitación fue aceptada. Inicia sesión otra vez para cargar los permisos actualizados.</Text>
        {button('Iniciar sesión', onLogin)}
      </> : <>{field('token', 'Token de invitación')}
      {auth.user ? button('Aceptar invitación', () => run(async () => {
        await call('invitations/accept', { token: form.token });
        setInviteAccepted(true);
        await auth.logout();
      })) : <>
        <Text style={styles.heading}>Crear cuenta con invitación</Text>
        {field('name', 'Nombre')}{field('invitePassword', 'Contraseña (mínimo 8 caracteres)', true)}
        {field('confirmPassword', 'Confirma la contraseña', true)}
        {button('Crear cuenta y aceptar', () => run(async () => {
          if (form.invitePassword !== form.confirmPassword || form.invitePassword.length < 8 || !form.name.trim() || !form.token) throw new Error('INVALID_FORM');
          const result = await call('invitations/complete', { token: form.token, name: form.name, password: form.invitePassword });
          await auth.login(result.email, form.invitePassword);
          onDashboard();
        }))}
        <Text style={styles.body}>¿Ya tienes cuenta?</Text>
        {field('inviteEmail', 'Correo de tu cuenta')}{field('password', 'Contraseña', true)}
        {button('Iniciar sesión y aceptar', () => run(async () => {
          if (!form.inviteEmail.trim() || !form.password || !form.token) throw new Error('INVALID_FORM');
          await auth.login(form.inviteEmail, form.password);
          await call('invitations/accept', { token: form.token });
          setInviteAccepted(true);
          await auth.logout();
        }), true)}
      </>}
      </>}
    </View>}
    {route === 'subscription' && <View style={styles.card}><Text style={styles.heading}>Mi suscripción</Text>
      {!auth.user ? button('Iniciar sesión', onLogin) : <>
        {memberships.map(membership => button(`Cambiar a ${membership.companyId?.name || 'empresa'}`, () => run(async () => { await call('switch-company', { companyId: membership.companyId._id }); await auth.refreshProfile(); await reload(); }), true))}
        {!auth.user.commercialAccount && button('Entrar al ERP existente', onDashboard, true)}
        <Text style={styles.body}>Empresa: {subscription?.companyName || 'Sin contratación comercial'}</Text><Text style={styles.body}>Estado: {subscription?.status || 'Sin suscripción'}</Text>
        <Text style={styles.body}>Vigencia: {subscription?.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString('es-MX') : 'Aún no activada'}</Text>
        <Text style={styles.body}>Usuarios reservados: {subscription?.seats || 1} / {subscription?.plan?.maxUsers || plan?.maxUsers}</Text>
        <Text style={styles.body}>{subscription?.cancelAtPeriodEnd ? 'Cancelación programada al fin de vigencia.' : 'La redirección de pago no activa el servicio. Espera la confirmación.'}</Text>
        {button('Actualizar estado', () => run(reload), true)}
        {!subscription?.companyId && <>{button('Reenviar verificación', () => run(async () => { await call('verification'); setMessage('Revisa tu correo.'); }), true)}{plan?.checkoutEnabled && button('Ir al checkout', () => run(() => open('checkout')))}</>}
        {!!subscription?.companyId && <>
          {subscription.isOwner && <>
          {!subscription.configuredAt && <>{field('branchName', 'Nombre de sucursal principal')}{button('Guardar configuración', () => run(async () => { await call('setup', { branchName: form.branchName }); await reload(); }))}</>}
          {field('inviteEmail', 'Correo del colaborador (rol Ventas)')}{button('Invitar colaborador', () => run(async () => { await call('invitations', { email: form.inviteEmail }); setMessage('Invitación enviada.'); }), true)}
          {button('Método de pago y comprobantes', () => run(() => open('portal')), true)}
          {button('Cancelar al finalizar vigencia', () => go('cancel'), true)}
          {(subscription.payments || []).map((payment, index) => <View key={index}><Text style={styles.body}>Pago confirmado: {payment.amount / 100} {payment.currency?.toUpperCase()}</Text>{payment.receiptUrl && button('Ver comprobante', () => Linking.openURL(payment.receiptUrl), true)}</View>)}
          </>}
          {subscription.status === 'active' && button('Entrar al ERP', () => run(async () => { await auth.refreshProfile(); onDashboard(); }))}
        </>}
      </>}
    </View>}
    {route === 'cancel' && <View style={styles.card}><Text style={styles.heading}>Confirmar cancelación</Text><Text style={styles.body}>No se renovará la suscripción. Conservas el acceso hasta el final de la vigencia pagada.</Text>{button('Confirmar cancelación', () => run(async () => { await call('cancel'); await reload(); go('subscription'); }))}{button('Volver', () => go('subscription'), true)}</View>}
    {route === 'legal' && <View style={styles.card}><Text style={styles.heading}>Términos y privacidad · revisión pendiente</Text><Text style={styles.body}>Versión {plan?.termsVersion}. Este entorno permite evaluar el registro y contratación con datos de prueba. No introduzcas información personal innecesaria. Correo, nombre y empresa se utilizan para gestionar la cuenta y acceso. La política definitiva de tratamiento, conservación, exportación, obligaciones fiscales y jurisdicción requiere revisión antes de ofrecer el servicio comercial.</Text><Text style={styles.body}>Este texto no constituye términos comerciales aprobados.</Text>{button('Volver al registro', () => go('register'), true)}</View>}
    <View style={styles.actions}>{button('Términos y privacidad', () => go('legal'), true)}{button('Recuperar contraseña', () => go('forgot'), true)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7fb' }, container: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 24, gap: 24 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }, brand: { fontSize: 27, fontWeight: '800', color: '#163655' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexShrink: 1, maxWidth: '100%' }, hero: { paddingVertical: 48, gap: 24, maxWidth: 800 }, eyebrow: { color: '#365d81', fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 46, lineHeight: 54, fontWeight: '800', color: '#102c46' }, lead: { fontSize: 20, lineHeight: 30, color: '#40546a' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, card: { backgroundColor: '#fff', borderRadius: 18, padding: 24, gap: 16, flexGrow: 1, flexShrink: 1, minWidth: 0, flexBasis: 280, borderWidth: 1, borderColor: '#dce5ee' },
  heading: { fontSize: 23, fontWeight: '700', color: '#163655' }, body: { fontSize: 16, lineHeight: 25, color: '#40546a' }, price: { fontSize: 26, color: '#163655', fontWeight: '700' },
  field: { gap: 8 }, label: { fontSize: 15, color: '#163655', fontWeight: '600' }, input: { borderWidth: 1, borderColor: '#8a9bad', padding: 14, borderRadius: 8, fontSize: 16, color: '#102c46' },
  button: { backgroundColor: '#163655', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 9, alignSelf: 'flex-start', maxWidth: '100%' }, secondary: { backgroundColor: '#e7eef5' }, buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { color: '#9f1c28', backgroundColor: '#ffe9ec', padding: 16 }, message: { color: '#125332', backgroundColor: '#e4f4eb', padding: 16 }
});
