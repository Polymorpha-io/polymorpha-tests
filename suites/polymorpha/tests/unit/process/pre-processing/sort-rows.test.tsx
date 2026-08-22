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

describe('CleaningPanel - Sort Rows', () => {
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

  it('allows adding and removing a sort rule', async () => {
    render(<CleaningPanel />);
    
    // Switch to "Processing" tab (sidebar only renders in this tab)
    const processingTab = screen.getByRole('tab', { name: /Processing/i });
    fireEvent.click(processingTab);
    
    // "Pre-processing" accordion is open by default — wait for step buttons
    await waitFor(() => {
      expect(screen.getByText('Sort rows')).toBeInTheDocument();
    });
    
    // Click "Sort rows" step button
    fireEvent.click(screen.getByText('Sort rows'));
    
    // Verify step content rendered
    expect(screen.getByText(/Sort the dataset by one or more columns/i)).toBeInTheDocument();
    
    // Add a sort rule
    const addRuleBtn = screen.getByRole('button', { name: /\+ Add sort rule/i });
    fireEvent.click(addRuleBtn);
    
    let state = useDataStore.getState();
    expect(state.cleaningConfig?.sortRules.length).toBe(1);
    expect(state.cleaningConfig?.sortRules[0].column).toBe('id');
    expect(state.cleaningConfig?.sortRules[0].direction).toBe('asc');
    
    // Change direction to desc via the Direction select
    const directionSelects = screen.getAllByRole('combobox');
    // The Direction select is the second combobox in the rule row
    const directionSelect = directionSelects.find(
      (s) => (s as HTMLSelectElement).value === 'asc'
    );
    if (directionSelect) {
      fireEvent.change(directionSelect, { target: { value: 'desc' } });
    }
    
    state = useDataStore.getState();
    expect(state.cleaningConfig?.sortRules[0].direction).toBe('desc');
    
    // Remove the rule via the remove button
    const removeBtn = document.querySelector('.clean-remove-btn');
    if (removeBtn) fireEvent.click(removeBtn);
    
    state = useDataStore.getState();
    expect(state.cleaningConfig?.sortRules.length).toBe(0);
  });
});
