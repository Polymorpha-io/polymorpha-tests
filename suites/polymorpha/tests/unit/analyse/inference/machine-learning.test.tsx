import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MachineLearningTab } from '@/components/AnalysePanel/tabs/MachineLearningTab';

describe('MachineLearningTab', () => {
  it('renders correctly', () => {
    const cleaned = {
      columns: [{ name: 'A', type: 'numeric' }, { name: 'B', type: 'categorical' }],
      rows: [{ A: 1, B: 'yes' }, { A: 2, B: 'no' }]
    } as any;
    
    const computed = {
      numericCols: ['A'],
      normality: []
    } as any;
    
    const results = {} as any;

    render(<MachineLearningTab 
      cleaned={cleaned} 
      computed={computed} 
      results={results} 
      cleaningDiff={null} 
    />);

    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Classification')).toBeInTheDocument();
    expect(screen.getByText('Algorithm')).toBeInTheDocument();
    
    // By default, K-Nearest Neighbors might be selected if it is first in the list
    expect(screen.getByText('K-Nearest Neighbors')).toBeInTheDocument();
  });
});
