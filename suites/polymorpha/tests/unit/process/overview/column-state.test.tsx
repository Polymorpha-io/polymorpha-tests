import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CleaningPanel } from '@/components/CleaningPanel/CleaningPanel';
import { useDataStore } from '@/store/useDataStore';
import { useConfigStore } from '@/store/useConfigStore';
import { buildDefaultConfig } from '@polymorpha/business-logic';
import type { Dataset } from '@/types';

vi.mock('@/lib/stats/descriptive', () => ({
  computeDescriptive: vi.fn().mockResolvedValue({}),
  computeFrequency: vi.fn().mockResolvedValue({})
}));
vi.mock('@/lib/stats/recommendations', () => ({
  useRecommendations: () => ({ recommendations: [], state: {}, loading: false, error: null, offline: false })
}));

const mockDataset: Dataset = {
  fileName: 'test.csv',
  uploadedAt: new Date(),
  columns: [
    { name: 'id', type: 'numeric', detectedType: 'numeric' },
    { name: 'name', type: 'categorical', detectedType: 'categorical' }
  ],
  rows: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
};

describe('CleaningPanel - Column State', () => {
  beforeEach(() => {
    useConfigStore.setState({
      settings: {
        currentPlan: 'pro',
        plans: {
          pro: { canAdvancedCharts: true, canAdvancedCleaning: true }
        }
      } as any
    });
    
    const config = buildDefaultConfig(mockDataset);
    config.missing['id'] = { strategy: 'median' };
    config.outliers['id'] = { method: 'iqr', action: 'nullify' };
    
    useDataStore.setState({
      raw: mockDataset,
      cleaned: null,
      cleaningConfig: config,
      appliedSteps: [],
      stepCache: new Map(),
      cleaningDiff: {
        rowsRemoved: 0,
        valuesImputed: {},
        outliersHandled: {},
        columnsRemoved: 0,
      } as any,
    });
  });

  it('renders the column state table with correct configurations', async () => {
    render(<CleaningPanel />);
    
    // Switch to Processing tab
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    
    // Expand "Overview" accordion group (column state is under Overview)
    fireEvent.click(screen.getByRole('button', { name: /Overview/i }));
    
    // Click "Column state" step
    await waitFor(() => {
      expect(screen.getByText('Column state')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Column state'));
    
    expect(screen.getByText(/Overview of all columns and their current processing configuration/i)).toBeInTheDocument();
    
    // table should be present
    const table = screen.getAllByRole('table')[0];
    expect(table).toBeInTheDocument();
    
    // Column headers should be visible (may appear in both th and td)
    expect(screen.getAllByText('id').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('name').length).toBeGreaterThanOrEqual(1);
  });
});
