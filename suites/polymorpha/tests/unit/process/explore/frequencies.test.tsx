import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrequenciesTab } from '@/components/AnalysePanel/tabs/FrequenciesTab';
import type { ComputedStats } from '@/components/AnalysePanel/analyseHelpers';

describe('FrequenciesTab', () => {
  const mockComputed: ComputedStats = {
    descriptive: [],
    frequencies: [
      {
        column: 'gender',
        entries: [
          { value: 'Male', count: 60, pct: 60 },
          { value: 'Female', count: 40, pct: 40 },
        ],
        totalUnique: 2,
      },
      {
        column: 'department',
        entries: Array.from({ length: 12 }, (_, i) => ({
          value: `Dept ${i + 1}`,
          count: 10,
          pct: 100 / 12,
        })),
        totalUnique: 12,
      },
    ],
    correlation: null,
    normality: [],
    numericCols: [],
    catCols: ['gender', 'department'],
  };

  it('renders empty message when no categorical columns', () => {
    const emptyComputed = { ...mockComputed, frequencies: [] };
    render(<FrequenciesTab computed={emptyComputed} />);
    expect(screen.getByText('No categorical columns detected.')).toBeInTheDocument();
  });

  it('renders frequency cards and data', () => {
    render(<FrequenciesTab computed={mockComputed} />);
    
    // Check headers
    expect(screen.getByText('gender')).toBeInTheDocument();
    expect(screen.getByText('department')).toBeInTheDocument();
    
    // Check specific values
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('handles expansion of values when more than 8 categories', () => {
    render(<FrequenciesTab computed={mockComputed} />);
    
    // Initially only 8 items should be shown for 'department'
    expect(screen.getByText('Dept 1')).toBeInTheDocument();
    expect(screen.getByText('Dept 8')).toBeInTheDocument();
    expect(screen.queryByText('Dept 9')).not.toBeInTheDocument();
    
    // Check for show all button
    const showAllButton = screen.getByText('Show all 12 values');
    fireEvent.click(showAllButton);
    
    // Now it should show all
    expect(screen.getByText('Dept 9')).toBeInTheDocument();
    expect(screen.getByText('Dept 12')).toBeInTheDocument();
    
    // Check for show less button
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('renders insights based on computed stats', () => {
    render(<FrequenciesTab computed={mockComputed} />);
    
    expect(screen.getByText(/2 categorical columns with 14 total unique values/)).toBeInTheDocument();
  });
});
