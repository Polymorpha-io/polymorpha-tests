import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { DescriptiveTab } from '@/components/AnalysePanel/tabs/DescriptiveTab';
import type { ComputedStats } from '@/components/AnalysePanel/analyseHelpers';

describe('DescriptiveTab', () => {
  const mockComputed: ComputedStats = {
    descriptive: [
      {
        column: 'age',
        count: 100,
        missing: 5,
        missingPct: 5,
        mean: 35.5,
        median: 34,
        std: 10.2,
        variance: 104.04,
        min: 18,
        max: 80,
        q1: 28,
        q3: 45,
        skewness: 1.2,
        kurtosis: 4.5,
      },
      {
        column: 'income',
        count: 100,
        missing: 10,
        missingPct: 10,
        mean: 55000,
        median: 50000,
        std: 20000,
        variance: 400000000,
        min: 20000,
        max: 150000,
        q1: 40000,
        q3: 65000,
        skewness: 0.8,
        kurtosis: 2.1,
      },
    ],
    frequencies: [],
    correlation: null,
    normality: [],
    numericCols: ['age', 'income'],
    catCols: [],
  };

  it('renders descriptive statistics table with correct data', () => {
    render(<DescriptiveTab computed={mockComputed} />);
    
    // Check if column names are formatted and rendered
    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('income')).toBeInTheDocument();

    // Check specific values
    expect(screen.getByText('35.500')).toBeInTheDocument(); // mean for age
    expect(screen.getByText('55000.000')).toBeInTheDocument(); // mean for income
    
    expect(screen.getByText('5.0%')).toBeInTheDocument(); // missing pct age
    expect(screen.getByText('10.0%')).toBeInTheDocument(); // missing pct income
  });

  it('renders insights based on computed stats', () => {
    const recommendations = [
      {
        id: "rec_missing_income",
        type: "cleaning" as const,
        reason: "Column 'income' has 10.0% missing values.",
        action: "Recommend imputation or removing the column."
      },
      {
        id: "rec_skew_age",
        type: "cleaning" as const,
        reason: "Column 'age' is highly skewed (skewness = 1.20).",
        action: "Recommend non-parametric tests over t-test/ANOVA."
      }
    ];

    render(<DescriptiveTab computed={mockComputed} recommendations={recommendations} />);
    
    // High missing values (>5%) - income has 10%
    expect(screen.getByText(/Column 'income' has 10.0% missing values/)).toBeInTheDocument();
    
    // Skewness (>1) - age has 1.2
    expect(screen.getByText(/Column 'age' is highly skewed \(skewness = 1.20\)/)).toBeInTheDocument();
  });
});
