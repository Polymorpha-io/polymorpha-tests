# Polymorpha ML Cloud Function

Machine learning inference and training service for Polymorpha.

## Setup

```bash
cd cloud-functions/ml
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
```

## Local development

```bash
functions-framework --target=ml_handler --port=8081 --debug
```

## Deploy

```bash
gcloud functions deploy polymorpha-ml \
  --gen2 --runtime python312 --region us-central1 \
  --source ./cloud-functions/ml \
  --entry-point ml_handler \
  --trigger-http --allow-unauthenticated \
  --memory 1024MB --timeout 120s \
  --project polymorpha-io
```

## API

All requests are `POST` with JSON body:

```json
{
  "action": "extract_features | recommend_cleaning | recommend_tests | detect_anomalies | train",
  "rows": [...],
  "columns": [...],
  "cleaningDiff": {...},
  "statsResults": {...},
  "params": {...}
}
```

### Actions

| Action | Description | Key params |
|--------|-------------|------------|
| `extract_features` | Build dataset and column feature vectors | — |
| `recommend_cleaning` | Rank cleaning actions per column | — |
| `recommend_tests` | Rank statistical tests | — |
| `detect_anomalies` | Isolation Forest anomaly scoring | `contamination` (0.01–0.25) |
| `train` | Trigger model training pipeline | `task` |

### Response format

```json
{
  "recommendations": [...],
  "datasetFeatures": {...},
  "columnFeatures": [...],
  "scores": [...],
  "flaggedIndices": [...]
}
```

## Architecture

```
main.py         → Cloud Function entry point and router
features.py     → Feature extraction from cleaned datasets
models.py       → Recommendation, anomaly detection, and training logic
```

The ML service consumes the same cleaned-dataset schema that the frontend
Analyse tab uses (`Dataset`, `CleaningDiff`, `StatsResults`), so feature
extraction stays consistent between the UI preview and server-side inference.
