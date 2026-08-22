import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { NormalityTab } from '@/components/AnalysePanel/tabs/NormalityTab';

vi.mock('@/store/useDataStore', () => ({
  useDataStore: (selector: any) => selector({
    cleaned: {
      columns: [{ name: 'Height', type: 'numeric' }],
      rows: [{ Height: 170 }, { Height: 180 }]
    }
  })
}));

vi.mock('@/lib/stats/normality', () => ({
  testNormality: vi.fn((rows, col, method) => {
    return Promise.resolve({
      column: col,
      test: method === 'auto' ? 'Shapiro-Wilk' : method,
      statistic: 0.95,
      pValue: 0.1,
      isNormal: true,
      skewness: 0.1,
      kurtosis: -0.2
    });
  })
}));

describe('NormalityTab', () => {
  it('renders correctly with precomputed stats', () => {
    const computed = {
      numericCols: ['Height'],
      normality: [
        {
          column: 'Height',
          test: 'Shapiro-Wilk',
          statistic: 0.98,
          pValue: 0.45,
          isNormal: true,
          skewness: 0.05,
          kurtosis: 0.1
        }
      ]
    } as any;
    
    render(<NormalityTab computed={computed} />);
    
    expect(screen.getByText('Height')).toBeInTheDocument();
    expect(screen.getByText('0.9800')).toBeInTheDocument();
    expect(screen.getByText('0.4500')).toBeInTheDocument();
    // Test the badge class text 'Yes'
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('triggers normality recalculation when method is changed', async () => {
    const computed = {
      numericCols: ['Height'],
      normality: [
        {
          column: 'Height',
          test: 'Shapiro-Wilk',
          statistic: 0.98,
          pValue: 0.45,
          isNormal: true,
          skewness: 0.05,
          kurtosis: 0.1
        }
      ]
    } as any;
    
    render(<NormalityTab computed={computed} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'lilliefors' } });
    
    await waitFor(() => {
      // It should display the new recalculated mocked values (statistic: 0.95, pValue: 0.1)
      expect(screen.getByText('0.9500')).toBeInTheDocument();
      expect(screen.getByText('0.1000')).toBeInTheDocument();
    });
  });
});
