import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dashboardApi } from '../services/api';
import { MENU_BY_PERMISSION } from '../constants/config';
import { tokens } from '../theme/tokens';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import MetricCard from '../components/data-display/MetricCard';
import ModuleCard from '../components/data-display/ModuleCard';
import LoadingSkeleton from '../components/data-display/LoadingSkeleton';

import ProductsScreen from './products/ProductsScreen';
import InventoryScreen from './inventory/InventoryScreen';
import CrmScreen from './crm/CrmScreen';
import SalesScreen from './sales/SalesScreen';
import PurchasesScreen from './purchases/PurchasesScreen';
import FinanceScreen from './finance/FinanceScreen';
import HrScreen from './hr/HrScreen';
import ProjectsScreen from './projects/ProjectsScreen';
import ProductionScreen from './production/ProductionScreen';
import AdminScreen from './admin/AdminScreen';
import AuditScreen from './audit/AuditScreen';
import AIAssistantScreen from './AIAssistantScreen';

export default function DashboardScreen() {
  const { user, has } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentRoute === 'dashboard') {
      loadDashboard();
    }
  }, [currentRoute]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await dashboardApi.getSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const menu = MENU_BY_PERMISSION.filter((m) => m.route !== 'dashboard' && (!m.permission || has(m.permission)));

  const renderContent = () => {
    switch (currentRoute) {
      case 'products':
        return <ProductsScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'inventory':
        return <InventoryScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'crm':
        return <CrmScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'sales':
        return <SalesScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'purchases':
        return <PurchasesScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'finance':
        return <FinanceScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'hr':
        return <HrScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'projects':
        return <ProjectsScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'production':
        return <ProductionScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'admin':
        return <AdminScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'audit':
        return <AuditScreen onBack={() => setCurrentRoute('dashboard')} />;
      case 'ai':
        return <AIAssistantScreen onBack={() => setCurrentRoute('dashboard')} />;
      default:
        break;
    }

    if (loading) {
      return <LoadingSkeleton />;
    }

    return (
      <ScrollView contentContainerStyle={styles.dashboardScroll}>
        <PageHeader
          title={`Bienvenido, ${user ? user.name : 'Usuario'}`}
          subtitle={`Rol: ${user ? user.role : ''} — Panel general del ERP`}
        />

        {!user?.companyId && <Text style={{ padding: 16 }}>Tu cuenta está pendiente de asignación a una empresa. Contacta al administrador.</Text>}
        <View style={styles.metricsRow}>
          {summary?.sales && <MetricCard
            title="Ventas Totales"
            value={summary && summary.sales ? `$${summary.sales.totalInvoiced || 0}` : '$0'}
            subtitle="Ingresos registrados"
          />}
          {summary?.crm && <MetricCard
            title="Clientes Activos"
            value={summary && summary.crm ? summary.crm.customersCount || 0 : '0'}
            subtitle="Cartera CRM"
            color={tokens.colors.secondary}
          />}
          {summary?.inventory && <MetricCard
            title="Productos"
            value={summary && summary.products ? summary.products.totalProducts || 0 : '0'}
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
              onPress={() => setCurrentRoute(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <AppShell currentRoute={currentRoute} onSelectRoute={setCurrentRoute}>
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
