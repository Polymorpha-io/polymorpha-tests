# Polymorpha Stats — Google Cloud Function

Python-based statistical computation API that mirrors the client-side Web Worker.

## Prerequisites

1. [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project with Cloud Functions API enabled
3. Billing enabled on the project

## Local Testing

```bash
cd cloud-functions/stats
pip install -r requirements.txt
functions-framework --target=stats_handler --port=8080
```

Then POST to `http://localhost:8080`:

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"action": "descriptive", "rows": [{"age": 25}, {"age": 30}, {"age": 35}], "params": {"column": "age"}}'
```

## Deploy

```bash
gcloud functions deploy polymorpha-stats \
  --gen2 \
  --runtime python312 \
  --region us-central1 \
  --source ./cloud-functions/stats \
  --entry-point stats_handler \
  --trigger-http \
  --allow-unauthenticated \
  --memory 512MB \
  --timeout 60s
```

After deploy you'll get a URL like:
`https://us-central1-YOUR_PROJECT.cloudfunctions.net/polymorpha-stats`

## API

Single endpoint, POST with JSON body:

```json
{
  "action": "computeAll | descriptive | frequency | correlation | normality | ttest | anova | levene | welchAnova | mannWhitney | kruskalWallis | chiSquare | fisherExact | regression | vif",
  "rows": [{"col1": val, "col2": val, ...}, ...],
  "numericCols": ["col1", ...],
  "catCols": ["col2", ...],
  "params": { ... }
}
```

### Actions

| Action | params |
|--------|--------|
| `computeAll` | uses top-level `numericCols`, `catCols` |
| `descriptive` | `{column}` |
| `frequency` | `{column}` |
| `correlation` | `{columns: [...]}` |
| `normality` | `{column, method?: "auto"|"shapiro-wilk"|"kolmogorov-smirnov"}` |
| `ttest` | `{type: "one-sample"|"paired"|"independent", column, column2?, mu?}` |
| `anova` | `{groups: [{label, values}], factor, responseVar}` |
| `levene` | `{groups: [{label, values}]}` |
| `welchAnova` | `{groups: [{label, values}], factor, responseVar}` |
| `mannWhitney` | `{column, groupCol, group1Label, group2Label}` |
| `kruskalWallis` | `{groups: [{label, values}], column}` |
| `chiSquare` | `{column1, column2}` |
| `fisherExact` | `{column1, column2}` |
| `regression` | `{dependentVar, predictors: [...]}` |
| `vif` | `{predictors: [...]}` |

## Costs

- Free tier: 2M invocations/month, 400K GB-seconds
- Beyond that: ~$0.40 per million invocations
- With 512MB memory and 60s timeout, very cost-efficient for statistical workloads
