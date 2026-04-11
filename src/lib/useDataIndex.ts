import { useContext } from 'react';
import { DataIndexContext, type DataIndex } from './dataIndexContext';

export function useDataIndex(): DataIndex {
  const ctx = useContext(DataIndexContext);
  if (!ctx) throw new Error('useDataIndex must be used within DataIndexProvider');
  return ctx;
}
