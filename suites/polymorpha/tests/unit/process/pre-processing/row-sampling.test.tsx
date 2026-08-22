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

describe('CleaningPanel - Row Sampling', () => {
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

  it('allows updating sampling method and count', async () => {
    render(<CleaningPanel />);
    
    // Switch to "Processing" tab
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    
    // "Pre-processing" accordion is open by default — wait for "Row sampling" step
    await waitFor(() => {
      expect(screen.getByText('Row sampling')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Row sampling'));
    
    expect(screen.getByText(/Limit the output to a subset of rows/i)).toBeInTheDocument();
    
    const methodSelect = screen.getByLabelText(/Method/i);
    fireEvent.change(methodSelect, { target: { value: 'head' } });
    
    let state = useDataStore.getState();
    expect(state.cleaningConfig?.sampling.method).toBe('head');
    
    const countInput = screen.getByLabelText(/Count/i);
    fireEvent.change(countInput, { target: { value: '10' } });
    
    state = useDataStore.getState();
    expect(state.cleaningConfig?.sampling.count).toBe(10);
  });
});
