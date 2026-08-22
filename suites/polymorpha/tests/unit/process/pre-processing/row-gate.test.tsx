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

describe('CleaningPanel - Row Gate', () => {
  beforeEach(() => {
    useConfigStore.setState({
      settings: {
        currentPlan: 'pro',
        plans: {
          pro: { canAdvancedCharts: true, canAdvancedCleaning: true }
        }
      } as any
    });
    
    useDataStore.setState({
      raw: mockDataset,
      cleaned: null,
      cleaningConfig: buildDefaultConfig(mockDataset),
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

  it('renders Row gate step by default and allows updating missing row threshold', async () => {
    render(<CleaningPanel />);
    
    // Switch to "Processing" tab — Row gate is the default active step
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    await waitFor(() => {
      expect(screen.getByText('Row filter')).toBeInTheDocument();
    });
    
    const thresholdInput = screen.getByLabelText(/Missing row threshold %/i);
    expect(thresholdInput).toBeInTheDocument();
    
    fireEvent.change(thresholdInput, { target: { value: '50' } });
    
    const state = useDataStore.getState();
    expect(state.cleaningConfig?.missingRowThresholdPct).toBe(50);
  });

  it('allows adding a row filter', async () => {
    render(<CleaningPanel />);
    
    // Switch to "Processing" tab — Row gate is the default active step
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    await waitFor(() => {
      expect(screen.getByText('Row filter')).toBeInTheDocument();
    });
    
    const filterCheckbox = screen.getByLabelText(/Apply row filter/i);
    fireEvent.click(filterCheckbox);
    
    const state = useDataStore.getState();
    expect(state.cleaningConfig?.rowFilter.enabled).toBe(true);
    
    const colSelect = screen.getByLabelText(/Column/i);
    fireEvent.change(colSelect, { target: { value: 'name' } });
    
    const valueInput = screen.getByLabelText(/Value/i);
    fireEvent.change(valueInput, { target: { value: 'Alice' } });
    
    const newState = useDataStore.getState();
    expect(newState.cleaningConfig?.rowFilter.column).toBe('name');
    expect(newState.cleaningConfig?.rowFilter.value).toBe('Alice');
  });
});
