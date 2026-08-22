import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CorrelationTab } from '@/components/AnalysePanel/tabs/CorrelationTab';

// Mock HeatmapChart because it probably uses Plotly which fails in jsdom
vi.mock('@/components/Charts/HeatmapChart', () => ({
  HeatmapChart: () => <div data-testid="heatmap-chart-mock">Heatmap Mock</div>
}));

describe('CorrelationTab', () => {
  it('renders "Need at least 2 numeric columns" if correlation data is missing', () => {
    const computed = {
      descriptive: [],
      frequencies: [],
      correlation: null,
      normality: [],
      numericCols: []
    } as any;
    render(<CorrelationTab computed={computed} canAdvancedCharts={true} />);
    expect(screen.getByText('Need at least 2 numeric columns.')).toBeInTheDocument();
  });

  it('renders correlation table and insights correctly when data is provided', () => {
    const computed = {
      correlation: {
        columns: ['Age', 'Income', 'Score'],
        values: [
          [1, 0.8, -0.4],
          [0.8, 1, 0.1],
          [-0.4, 0.1, 1]
        ]
      }
    } as any;
    
    const recommendations = [
      {
        id: "rec_corr_Age_Income",
        type: "test" as const,
        reason: "High correlation (0.80) between 'Age' and 'Income'.",
        action: "Warning: Multicollinearity possible in regression models."
      }
    ];

    render(<CorrelationTab computed={computed} canAdvancedCharts={true} recommendations={recommendations} />);
    
    // Check that HeatmapChart is rendered
    expect(screen.getByTestId('heatmap-chart-mock')).toBeInTheDocument();

    // Check table data initially (not shown if showTable is false? wait, showTable defaults to false in full version, wait, let's see)
    // Actually, when canAdvancedCharts is true, table toggle is present
    expect(screen.getByText('+ Show numeric table')).toBeInTheDocument();
    
    // Click show table
    fireEvent.click(screen.getByText('+ Show numeric table'));
    
    // Now table should be visible
    expect(screen.getAllByText('Age').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.800')[0]).toBeInTheDocument();
    
    // Insights
    expect(screen.getByText(/High correlation \(0.80\)/i)).toBeInTheDocument();
  });

  it('shows table by default if canAdvancedCharts is false', () => {
    const computed = {
      correlation: {
        columns: ['A', 'B'],
        values: [
          [1, 0.5],
          [0.5, 1]
        ]
      }
    } as any;
    
    render(<CorrelationTab computed={computed} canAdvancedCharts={false} />);
    
    expect(screen.queryByTestId('heatmap-chart-mock')).not.toBeInTheDocument();
    expect(screen.getByText(/Heatmap view is available on Member and Premium plans/i)).toBeInTheDocument();
    
    // Table should be shown directly
    expect(screen.getAllByText('0.500')[0]).toBeInTheDocument();
  });
});
