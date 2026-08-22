import { describe, it, expect } from 'vitest';
import { applyCleaningConfig, buildDefaultConfig } from '@polymorpha/business-logic';
import type { Dataset } from '@/types';

describe('Columns Rename Transform', () => {
  const getMockDataset = (): Dataset => ({
    fileName: 'test.csv',
    uploadedAt: new Date(),
    columns: [
      { name: 'first_name', type: 'categorical', detectedType: 'categorical' },
      { name: 'last_name', type: 'categorical', detectedType: 'categorical' },
      { name: ' Age ', type: 'numeric', detectedType: 'numeric' }
    ],
    rows: [
      { 'first_name': 'John', 'last_name': 'Doe', ' Age ': 25 },
      { 'first_name': 'Jane', 'last_name': 'Smith', ' Age ': 30 }
    ]
  });

  it('renames columns correctly in both schema and rows', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.renameColumns = [
      { from: 'first_name', to: 'FirstName' },
      { from: 'last_name', to: 'LastName' }
    ];

    const result = applyCleaningConfig(dataset, config);

    // Schema checks
    const colNames = result.dataset.columns.map(c => c.name);
    expect(colNames).toContain('FirstName');
    expect(colNames).toContain('LastName');
    expect(colNames).not.toContain('first_name');
    expect(colNames).not.toContain('last_name');

    // Row data checks
    expect(result.dataset.rows[0].FirstName).toBe('John');
    expect(result.dataset.rows[0].LastName).toBe('Doe');
    expect(result.dataset.rows[0].first_name).toBeUndefined();
  });

  it('trims column names when trimColumnNames is true', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.trimColumnNames = true;

    const result = applyCleaningConfig(dataset, config);

    // Should have trimmed ' Age ' to 'Age'
    const colNames = result.dataset.columns.map(c => c.name);
    expect(colNames).toContain('Age');
    expect(colNames).not.toContain(' Age ');

    // Row data
    expect(result.dataset.rows[0].Age).toBe(25);
    expect(result.dataset.rows[0][' Age ']).toBeUndefined();
  });
  
  it('handles removeColumns correctly alongside rename', () => {
    const dataset = getMockDataset();
    const config = buildDefaultConfig(dataset);
    
    config.removeColumns = ['last_name'];
    config.renameColumns = [
      { from: 'first_name', to: 'FirstName' }
    ];

    const result = applyCleaningConfig(dataset, config);

    const colNames = result.dataset.columns.map(c => c.name);
    expect(colNames).toContain('FirstName');
    expect(colNames).not.toContain('last_name');

    expect(result.dataset.rows[0].LastName).toBeUndefined();
    expect(result.dataset.rows[0].last_name).toBeUndefined();
  });
});
