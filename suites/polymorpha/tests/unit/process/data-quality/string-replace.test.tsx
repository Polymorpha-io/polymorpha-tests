import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CleaningPanel } from '@/components/CleaningPanel/CleaningPanel';
import { useDataStore } from '@/store/useDataStore';
import { useConfigStore } from '@/store/useConfigStore';
import { buildDefaultConfig } from '@polymorpha/business-logic';

vi.mock('@/lib/stats/descriptive', () => ({
  computeDescriptive: vi.fn().mockResolvedValue({}),
  computeFrequency: vi.fn().mockResolvedValue({})
}));
vi.mock('@/lib/stats/recommendations', () => ({
  useRecommendations: () => ({ recommendations: [], state: {}, loading: false, error: null, offline: false })
}));
vi.mock('@/lib/stats/api', () => ({
  computeStats: vi.fn().mockResolvedValue({}),
  fetchStats: vi.fn().mockResolvedValue({}),
  callStatsApi: vi.fn().mockResolvedValue({})
}));

describe('String Replace Data Quality', () => {
  beforeEach(() => {
    useConfigStore.setState({
      settings: { currentPlan: 'premium', plans: { premium: { canAdvancedCharts: true, canAdvancedCleaning: true } } }
    } as any);

    useDataStore.setState({
      raw: {
        fileName: 'test.csv',
        uploadedAt: new Date(),
        columns: [
          { name: 'Age', type: 'numeric', detectedType: 'numeric' },
          { name: 'Name', type: 'categorical', detectedType: 'categorical' }
        ],
        rows: [
          { Age: 25, Name: 'John Smith' },
          { Age: 30, Name: 'Jane Doe' },
          { Age: 35, Name: 'Bob Smith' }
        ]
      },
      appliedSteps: [],
      stepCache: new Map(),
      cleaningConfig: buildDefaultConfig({
        fileName: 'test.csv', uploadedAt: new Date(),
        columns: [{ name: 'Age', type: 'numeric', detectedType: 'numeric' }, { name: 'Name', type: 'categorical', detectedType: 'categorical' }],
        rows: [{ Age: 25, Name: 'John Smith' }, { Age: 30, Name: 'Jane Doe' }, { Age: 35, Name: 'Bob Smith' }]
      }),
      setCleaningConfig: (cfg: any) => useDataStore.setState({ cleaningConfig: cfg }),
    } as any);
  });

  it('renders string replace tab', async () => {
    render(<CleaningPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Processing/i }));
    fireEvent.click(screen.getByRole('button', { name: /Data quality/i }));
    await waitFor(() => {
      expect(screen.getByText('String replace')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('String replace'));
    expect(screen.getByRole('heading', { name: /String replace/i, level: 3 })).toBeInTheDocument();
  });
});
