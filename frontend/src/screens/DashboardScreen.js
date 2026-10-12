import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, ScrollView } from '../design/ui';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/api';
import { MENU_BY_PERMISSION, canOpenMenu } from '../constants/config';
import { tokens } from '../theme/tokens';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import MetricCard from '../components/data-display/MetricCard';
import ModuleCard from '../components/data-display/ModuleCard';
import LoadingSkeleton from '../components/data-display/LoadingSkeleton';
import ErrorState from '../components/data-display/ErrorState';

import ProductsScreen from './products/ProductsScreen';
import InventoryScreen from './inventory/InventoryScreen';
import CrmScreen from './crm/CrmScreen';
import SalesScreen from './sales/SalesScreen';
import PurchasesScreen from './purchases/PurchasesScreen';
import FinanceScreen from './finance/FinanceScreen';
import HrScreen from './hr/HrScreen';
import ProjectsScreen from './projects/ProjectsScreen';
import ProductionScreen from './production/ProductionScreen';
import SettingsScreen from './settings/SettingsScreen';
import AdminScreen from './admin/AdminScreen';
import AuditScreen from './audit/AuditScreen';
import AIAssistantScreen from './AIAssistantScreen';

const readModule = () => Platform.OS === 'web' && typeof window !== 'undefined' ?
  new URLSearchParams(window.location.hash.slice(1)).get('module') || 'dashboard' : 'dashboard';

export default function DashboardScreen() {
  const { user, has } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(readModule);
  const selectRoute = route => {
    setCurrentRoute(route);
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.hash = `module=${route}`;
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setCurrentRoute(readModule());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentRoute === 'dashboard' || !summary) {
      loadDashboard();
    }
  }, [currentRoute]);

  const loadDashboard = async () => {
    try {
      setLoading(true); setError(null);
      const data = await dashboardApi.getSummary();
      setSummary(data);
    } catch (failure) {
      setError(failure.response?.data?.message || 'No se pudo cargar el dashboard');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const menu = MENU_BY_PERMISSION.filter((m) => m.route !== 'dashboard' && canOpenMenu(m, has) && (!['hr', 'projects', 'production', 'ai'].includes(m.route) || summary?.enabledModules?.includes(m.route)));

  const renderContent = () => {
    if (currentRoute !== 'dashboard' && !menu.some(item => item.route === currentRoute)) {
      if (loading || !summary && !error) return <LoadingSkeleton />;
      return <ErrorState message={error || 'Este módulo no está disponible para tu cuenta.'} onRetry={() => selectRoute('dashboard')} />;
    }
    switch (currentRoute) {
      case 'products':
        return <ProductsScreen onBack={() => selectRoute('dashboard')} />;
      case 'inventory':
        return <InventoryScreen onBack={() => selectRoute('dashboard')} />;
      case 'crm':
        return <CrmScreen onBack={() => selectRoute('dashboard')} />;
      case 'sales':
        return <SalesScreen onBack={() => selectRoute('dashboard')} />;
      case 'purchases':
        return <PurchasesScreen onBack={() => selectRoute('dashboard')} />;
      case 'finance':
        return <FinanceScreen onBack={() => selectRoute('dashboard')} />;
      case 'hr':
        return <HrScreen onBack={() => selectRoute('dashboard')} />;
      case 'projects':
        return <ProjectsScreen onBack={() => selectRoute('dashboard')} />;
      case 'production':
        return <ProductionScreen onBack={() => selectRoute('dashboard')} />;
      case 'settings':
        return <SettingsScreen onBack={() => selectRoute('dashboard')} />;
      case 'admin':
        return <AdminScreen onBack={() => selectRoute('dashboard')} />;
      case 'audit':
        return <AuditScreen onBack={() => selectRoute('dashboard')} />;
      case 'ai':
        return <AIAssistantScreen onBack={() => selectRoute('dashboard')} />;
      default:
        break;
    }

    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error) return <ErrorState message={error} onRetry={loadDashboard} />;
    return (
      <ScrollView contentContainerStyle={styles.dashboardScroll}>
        <PageHeader
          title={`Bienvenido, ${user ? user.name : 'Usuario'}`}
          subtitle={`Rol: ${user ? user.role : ''} — Panel general del ERP`}
        />

        {!user?.companyId && <Text style={{ padding: 16 }}>Tu cuenta está pendiente de asignación a una empresa. Contacta al administrador.</Text>}
        <View style={styles.metricsRow}>
          {summary?.sales && <MetricCard
            title="Total facturado"
            value={summary && summary.sales ? `$${summary.sales.totalInvoiced || 0}` : '$0'}
            subtitle="Documentos de venta · no equivale a cobros"
          />}
          {summary?.sales && <MetricCard title="Total cobrado" value={summary.sales.totalPaid} subtitle="Pagos registrados · agregado sin desglose de moneda" />}
          {summary?.crm && <MetricCard
            title="Clientes Activos"
            value={summary && summary.crm ? summary.crm.activeCustomers || 0 : '0'}
            subtitle="Cartera CRM"
            color={tokens.colors.secondary}
          />}
          {summary?.inventory && <MetricCard
            title="Productos"
            value={summary && summary.inventory ? summary.inventory.totalProducts || 0 : '0'}
            subtitle="Catálogo general"
            color={tokens.colors.success}
          />}
        </View>

        <Text style={styles.sectionTitle}>Módulos del Sistema</Text>
        <View style={styles.modulesGrid}>
          {menu.map((item) => (
            <ModuleCard
              key={item.route}
              title={item.label}
              description={`Gestionar ${item.label.toLowerCase()} y operaciones asociadas`}
              onPress={() => selectRoute(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <AppShell visibleRoutes={['dashboard', ...menu.map(item => item.route)]} currentRoute={currentRoute} onSelectRoute={selectRoute}>
      {renderContent()}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  dashboardScroll: {
    paddingBottom: tokens.spacing.xxl
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.xl
  },
  sectionTitle: {
    fontSize: tokens.typography.sizes.lg,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: tokens.spacing.md
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.md
  }
});
