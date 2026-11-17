# Metric Dimension Configuration Feature

**Version:** 0.4.106 | **Status:** Deployed to guu84124

## Overview

This release adds customizable dimension configuration to NavigatorIQ metrics, allowing users to control how data is split when drilling down in the "Follow the Red" explore view.

## What's New

### 1. Dimension Configuration in Metrics
Each metric can now have an associated `dimensionConfig` that specifies:
- **dimensions** (required): Comma-separated list of dimension keys or DQL expressions
- **label** (optional): Display name for the dimension split (e.g., "by Service & Handler")

### 2. Settings UI Enhancement
The SettingsPanel now includes a new **"Follow the Red — Dimension Split"** section for each metric with:
- **Dimensions input**: Enter custom dimensions (e.g., `entityName(dt.entity.service), entityName(dt.entity.service).handler`)
- **Dimension presets**: Quick-select buttons for common metric types (services, frontend, hosts, K8s, etc.)
- **Label input**: Optional display name for the dimension configuration

### 3. Dimension Presets
Common metrics now have predefined dimension splits available as quick-select buttons:

**Service Metrics:**
- `dt.service.request.failure_count` → by Service, by Service & Handler
- `dt.service.request.response_time` → by Service, by Service & Handler

**Frontend/RUM Metrics:**
- `dt.frontend.web.page.largest_contentful_paint` → by App & Page, by App
- `dt.frontend.user_action.duration` → by App & Page, by App
- `dt.frontend.error.count` → by App, by App & Page

**Host Metrics:**
- `dt.host.cpu.usage` → by Host, by Host & OS
- `dt.host.memory.usage` → by Host, by Host & OS

**Network Metrics:**
- `dt.process.network.bytes_tx` → by Host, by Process & Host
- `dt.process.network.bytes_rx` → by Host, by Process & Host

**Kubernetes Metrics:**
- `dt.kubernetes.container.cpu_usage` → by Cluster & Namespace, by Cluster & Namespace & Pod
- `dt.kubernetes.container.memory_working_set` → by Cluster & Namespace, by Cluster & Namespace & Pod

### 4. Default Dimensions
Built-in personas now include default dimension configurations for key metrics:

**Developer Persona:**
- Error Count: by Service
- Response Time: by Service
- Error Rate: by Service

**SRE Persona:**
- Errors: by Service
- Latency: by Service
- CPU Saturation: by Host
- Memory Saturation: by Host

**Digital Experience Persona:**
- LCP: by App & Page
- Duration: by App & Page
- TTFB: by App & Page
- INP: by App & Page
- CLS: by App & Page
- Errors: by App
- Requests: by App

### 5. Custom Personas Support
When creating custom personas (e.g., "Mobile", "Payment Services"), users can now define dimension splits for each metric when configuring the persona in personal settings.

## Implementation Details

### Type Changes (`types.ts`)
```typescript
export interface DimensionConfig {
  dimensions: string;
  label?: string;
}

export interface HeatMetricConfig {
  // ... existing fields ...
  dimensionConfig?: DimensionConfig;
}
```

### Query Building (`ExploreModal.tsx`)
The `buildExploreQuery` function now:
- Accepts an optional `dimensionConfig` parameter
- Uses custom dimensions in the `by:` clause when provided
- Fallback to default entity field if no dimension config exists
- Passes dimensions through both current and previous period queries for trend comparison

### Data Flow
1. User configures metric dimensions in Settings Panel
2. Settings are saved to Dynatrace user state
3. When user clicks "Follow the Red", AssessmentPanel passes dimensionConfig to ExploreModal
4. ExploreModal uses dimensions to build the DQL query
5. Query results are grouped and displayed by configured dimensions

## User Guide Updates

Updated `USER_GUIDE.md` with comprehensive documentation:
- **Section 15.3**: "Follow the Red — Dimension Split" under Hotness Metrics
  - How to configure dimensions
  - Examples for single/multiple dimensions
  - Preset buttons and selection
  - How dimensions affect drill-down behavior

- **Section 16.1**: Custom Personas guidance on dimensions
  - Setting up dimensions for custom personas
  - Benefits of customizable dimensions
  - Real-world examples (Mobile persona)

## Testing Recommendations

### Test Case 1: Basic Dimension Configuration
1. Open Settings → Metrics tab
2. Edit "Error Count" metric for Developer persona
3. Scroll to "Follow the Red — Dimension Split" section
4. Verify dimension presets appear for `dt.service.request.failure_count`
5. Click a preset and verify it populates the Dimensions field
6. Save settings

### Test Case 2: Follow the Red with Custom Dimensions
1. Navigate to Assessment Panel with Developer persona
2. Find a Red/Yellow "Error Count" metric
3. Click the "Follow the Red" (↗) button
4. Verify the drill-down query groups by your configured dimensions
5. Results should be sorted by error count
6. Verify dimension label appears in the UI (if set)

### Test Case 3: Multiple Dimensions
1. Edit a frontend metric (e.g., "LCP")
2. Set dimensions to: `frontend.name, page.name`
3. Set label to: "by App & Page"
4. Click "Follow the Red" for LCP
5. Verify results show combinations of frontend name and page name
6. Rows should be grouped by both dimensions

### Test Case 4: Custom Persona Dimensions
1. Create a custom persona (Settings → Personas tab)
2. Add a metric (e.g., Error Count)
3. Configure dimensions for that metric
4. Switch to your custom persona
5. Verify "Follow the Red" uses your custom dimensions

### Test Case 5: Empty Dimensions Fallback
1. Edit a metric and clear the Dimensions field
2. Save and use "Follow the Red"
3. Verify it falls back to the default entity field for that metric type
4. No errors should occur

## Breaking Changes

None. The `dimensionConfig` field is optional on `HeatMetricConfig`, so existing metrics continue to work with their default entity fields.

## Backward Compatibility

- Metrics without `dimensionConfig` use the original behavior (grouping by entity field)
- Existing saved settings are not affected
- Existing metrics in custom personas continue to work without dimension config

## Files Modified

- `ui/app/types.ts` — Added `DimensionConfig` interface
- `ui/app/constants.ts` — Added `DIMENSION_PRESETS` and updated `DEFAULT_HEAT_METRICS`
- `ui/app/components/SettingsPanel.tsx` — Added dimension UI section and preset buttons
- `ui/app/components/ExploreModal.tsx` — Updated to use dimensionConfig in query building
- `ui/app/components/AssessmentPanel.tsx` — Pass dimensionConfig to ExploreModal
- `USER_GUIDE.md` — Added comprehensive documentation
- `app.config.json` — Bumped version to 0.4.106

## Deployment Info

- **Built:** November 17, 2026
- **Deployed to:** guu84124.apps.dynatrace.com (primary test tenant)
- **Build Status:** ✅ Successful
- **Deployment Status:** ✅ Successful

## Future Enhancements

Potential additions in future releases:
- DQL expression builder UI for custom dimensions
- Dimension picker showing available entity fields per metric type
- Save dimension templates for quick application across multiple metrics
- Dimension analytics (e.g., "which dimension splits produce most insights?")
