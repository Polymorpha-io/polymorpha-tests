import { describe, it, expect } from 'vitest';
import { applyCleaningConfig, buildDefaultConfig } from '@polymorpha/business-logic';
import type { Dataset } from '@/types';

describe('Log/Power Transform', () => {
  const getMockDataset = (): Dataset => ({
    fileName: 'test.csv',
    uploadedAt: new Date(),
    columns: [
      { name: 'val1', type: 'numeric', detectedType: 'numeric' },
      { name: 'val2', type: 'numeric', detectedType: 'numeric' },
      { name: 'val3', type: 'numeric', detectedType: 'numeric' }
    ],
    rows: [
      { val1: 10, val2: 100, val3: 4 },
      { val1: Math.E, val2: 1000, val3: 16 }
    ]
  });

  it('applies math transforms correctly', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.mathTransforms = [
      { column: 'val1', transform: 'log' }, // natural log
      { column: 'val2', transform: 'log10' },
      { column: 'val3', transform: 'sqrt' }
    ];

    const result = applyCleaningConfig(dataset, config);

    // Natural log of E is 1
    expect(result.dataset.rows[1].val1).toBeCloseTo(1);
    
    // log10 of 100 is 2, 1000 is 3
    expect(result.dataset.rows[0].val2).toBeCloseTo(2);
    expect(result.dataset.rows[1].val2).toBeCloseTo(3);
    
    // sqrt of 4 is 2, 16 is 4
    expect(result.dataset.rows[0].val3).toBeCloseTo(2);
    expect(result.dataset.rows[1].val3).toBeCloseTo(4);
  });
  
  it('handles negative values appropriately', () => {
    const dataset = getMockDataset();
    dataset.rows.push({ val1: -5, val2: 0, val3: -10 });
    
    const config = buildDefaultConfig(dataset);
    config.mathTransforms = [
      { column: 'val1', transform: 'log' },
      { column: 'val2', transform: 'reciprocal' },
      { column: 'val3', transform: 'sqrt' }
    ];

    const result = applyCleaningConfig(dataset, config);
    
    // Math transforms might set invalid math results to null/NaN
    const lastRow = result.dataset.rows[result.dataset.rows.length - 1];
    
    // Log of negative number -> null or NaN (testing actual behavior of business-logic)
    expect(lastRow.val1).toBeNull(); 
    
    // Reciprocal of 0 -> null or Infinity
    expect(lastRow.val2).toBeNull();
    
    // Sqrt of negative -> null
    expect(lastRow.val3).toBeNull();
  });
});
