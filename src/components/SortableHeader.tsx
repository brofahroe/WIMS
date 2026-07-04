import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { SortConfig } from '../hooks/useSortableData';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig<any> | null;
  requestSort: (key: string) => void;
  align?: 'left' | 'center' | 'right';
}

export function SortableHeader({ label, sortKey, currentSort, requestSort, align = 'left' }: SortableHeaderProps) {
  let sortIcon = <ChevronsUpDown size={12} className="sort-icon inactive" />;
  
  if (currentSort?.key === sortKey) {
    if (currentSort.direction === 'ascending') {
      sortIcon = <ChevronUp size={12} className="sort-icon active" />;
    } else if (currentSort.direction === 'descending') {
      sortIcon = <ChevronDown size={12} className="sort-icon active" />;
    }
  }

  return (
    <th 
      onClick={() => requestSort(sortKey)} 
      className={`sortable-header ${align === 'right' ? 'numeric' : ''}`}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title={`Sort by ${label}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', gap: 4 }}>
        {label}
        <span style={{ color: currentSort?.key === sortKey ? 'var(--primary)' : 'var(--text3)' }}>
          {sortIcon}
        </span>
      </div>
    </th>
  );
}
