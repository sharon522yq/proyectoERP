import { Platform } from 'react-native';
export const shadows = {
  sm: Platform.select({ web: { boxShadow: '0 3px 10px rgba(7,12,25,0.16)' }, default: { elevation: 2, shadowColor: '#070C19', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } } }),
  md: Platform.select({ web: { boxShadow: '0 12px 32px rgba(7,12,25,0.22)' }, default: { elevation: 4, shadowColor: '#070C19', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } } }),
  lg: Platform.select({ web: { boxShadow: '0 18px 48px rgba(7,12,25,0.24)' }, default: { elevation: 6, shadowColor: '#070C19', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } } })
};
