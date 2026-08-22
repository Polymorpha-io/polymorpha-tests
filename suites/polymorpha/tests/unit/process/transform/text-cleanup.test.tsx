import { describe, it, expect } from 'vitest';
import { applyCleaningConfig, buildDefaultConfig } from '@polymorpha/business-logic';
import type { Dataset } from '@/types';

describe('Text Cleanup Transform', () => {
  const getMockDataset = (): Dataset => ({
    fileName: 'test.csv',
    uploadedAt: new Date(),
    columns: [
      { name: 'name', type: 'categorical', detectedType: 'categorical' },
      { name: 'description', type: 'categorical', detectedType: 'categorical' },
      { name: 'age', type: 'numeric', detectedType: 'numeric' }
    ],
    rows: [
      { name: '  john DOE  ', description: 'User-123 is active', age: 25 },
      { name: 'JANE smith', description: 'User-456 left', age: 30 }
    ]
  });

  it('trims whitespace and applies case mode correctly', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.stringCleaning = {
      enabled: true,
      trim: true,
      caseMode: 'title',
      regexPattern: '',
      regexReplacement: ''
    };

    const result = applyCleaningConfig(dataset, config);

    expect(result.dataset.rows[0].name).toBe('John Doe');
    expect(result.dataset.rows[1].name).toBe('Jane Smith');
    
    // Numeric column should not be affected
    expect(result.dataset.rows[0].age).toBe(25);
  });

  it('applies regex replacement correctly', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.stringCleaning = {
      enabled: true,
      trim: false,
      caseMode: 'none',
      regexPattern: 'User-\\d+',
      regexReplacement: 'User-REDACTED'
    };

    const result = applyCleaningConfig(dataset, config);

    expect(result.dataset.rows[0].description).toBe('User-REDACTED is active');
    expect(result.dataset.rows[1].description).toBe('User-REDACTED left');
  });
  
  it('does nothing if stringCleaning is disabled', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.stringCleaning = {
      enabled: false,
      trim: true,
      caseMode: 'upper',
      regexPattern: '',
      regexReplacement: ''
    };

    const result = applyCleaningConfig(dataset, config);

    expect(result.dataset.rows[0].name).toBe('  john DOE  ');
  });
});
