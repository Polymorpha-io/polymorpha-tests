import { describe, it, expect } from 'vitest';
import { applyCleaningConfig, buildDefaultConfig } from '@polymorpha/business-logic';
import type { Dataset } from '@/types';

describe('Type Conversion Transform', () => {
  const getMockDataset = (): Dataset => ({
    fileName: 'test.csv',
    uploadedAt: new Date(),
    columns: [
      { name: 'age_str', type: 'categorical', detectedType: 'categorical' },
      { name: 'is_active', type: 'categorical', detectedType: 'categorical' },
      { name: 'date_str', type: 'categorical', detectedType: 'categorical' }
    ],
    rows: [
      { age_str: '25', is_active: 'true', date_str: '2023-01-01' },
      { age_str: '30.5', is_active: 'false', date_str: '2023-12-31' },
      { age_str: 'invalid', is_active: 'yes', date_str: 'invalid-date' }
    ]
  });

  it('applies type overrides correctly to dataset columns', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    // Set up type overrides
    config.typeOverrides = [
      { columnName: 'age_str', type: 'numeric' },
      { columnName: 'is_active', type: 'boolean' },
      { columnName: 'date_str', type: 'date' }
    ];

    const result = applyCleaningConfig(dataset, config);

    // Check if columns were updated
    const ageCol = result.dataset.columns.find(c => c.name === 'age_str');
    expect(ageCol?.type).toBe('numeric');

    const activeCol = result.dataset.columns.find(c => c.name === 'is_active');
    expect(activeCol?.type).toBe('boolean');
    
    const dateCol = result.dataset.columns.find(c => c.name === 'date_str');
    expect(dateCol?.type).toBe('date');
  });

  it('converts types based on typeOverrides during processing', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.typeOverrides = [
      { columnName: 'age_str', type: 'numeric' },
      { columnName: 'is_active', type: 'boolean' }
    ];
    // Enable type conversion
    config.typeConversion = {
      enabled: true,
      numericParseMode: 'lenient',
      booleanConversion: true,
      dateParseMode: 'iso'
    };

    const result = applyCleaningConfig(dataset, config);

    expect(result.dataset.rows[0].age_str).toBe(25);
    expect(result.dataset.rows[1].age_str).toBe(30.5);
    // Invalid numeric might become null/NaN depending on lenient mode
    
    expect(result.dataset.rows[0].is_active).toBe(true);
    expect(result.dataset.rows[1].is_active).toBe(false);
  });
});
