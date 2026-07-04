import { useState, useMemo } from 'react';

export type SortDirection = 'ascending' | 'descending' | null;

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export function useSortableData<T>(items: T[], config: SortConfig<T> | null = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null && sortConfig.direction !== null) {
      sortableItems.sort((a, b) => {
        let aValue = getNestedValue(a, sortConfig.key as string);
        let bValue = getNestedValue(b, sortConfig.key as string);

        // Handle numeric sorting when values might be strings representing numbers or undefined
        if (typeof aValue === 'string' && typeof bValue === 'string') {
           const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
           const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
           if (!isNaN(aNum) && !isNaN(bNum) && String(aNum) === aValue && String(bNum) === bValue) {
               aValue = aNum;
               bValue = bNum;
           }
        }
        
        if (aValue === undefined || aValue === null) aValue = "";
        if (bValue === undefined || bValue === null) bValue = "";

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    } else if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'descending'
    ) {
      direction = null; // reset sort
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}

function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}
