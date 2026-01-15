# Admin Workflow Guide

## Overview

This guide explains the admin workflow for reviewing and managing violations detected by the AI system. The admin interface is designed to be efficient and reduce false positives through human confirmation.

## Core Workflow

```
Video Upload → AI Processing → Admin Review → Confirmed Violations
                                    │
                                    └──► Rejected Violations
```

## Step-by-Step Guide

### 1. Upload Video

1. Navigate to **Videos** page
2. Drag and drop a video file OR click to browse
3. Supported formats: MP4, AVI, MOV, MKV
4. Maximum file size: 500MB
5. Processing begins automatically

### 2. Monitor Processing

- **Pending**: Video is in queue
- **Processing**: AI is analyzing the video
  - Progress percentage is displayed
  - Polls for updates every 3 seconds
- **Completed**: Ready for review
- **Failed**: Check error message for details

### 3. Review Violations

Each detected violation requires admin review:

#### Quick Review
- Click ✓ (checkmark) to confirm
- Click ✗ (X) to reject
- No notes required for quick actions

#### Detailed Review
- View video snippet (if available)
- Check detection confidence
- Add notes for documentation
- Make informed decision

### 4. Bulk Actions

For efficiency with multiple violations:

1. Select violations using checkboxes
2. Click "Confirm All" or "Reject All"
3. Optionally add notes for the batch
4. All selected violations are updated

### 5. Analyze Individuals

For repeat offenders:

1. Go to **Individuals** page for a video
2. View risk scores and violation counts
3. Click individual for detailed analysis
4. Review violation timeline
5. Access all violations for that person

## Review Criteria

### When to CONFIRM

✓ Violation is clearly visible
✓ Detection bounding box is accurate
✓ Violation type matches the detection
✓ Individual is identifiable in the frame

### When to REJECT

✗ False positive (e.g., shadow detected as person)
✗ Incorrect violation type
✗ Detection captures wrong individual
✗ Poor video quality makes verification impossible

## Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total Violations | All detected violations |
| Confirmed | Admin-approved violations |
| Rejected | Admin-rejected violations |
| Pending | Awaiting review |
| Repeat Offenders | Individuals with 2+ violations |

## Best Practices

### 1. Review Promptly
- Regular reviews ensure up-to-date data
- Pending violations don't appear in final reports

### 2. Use Filters
- Filter by status to focus on pending
- Filter by type to review similar violations

### 3. Document Rejections
- Add notes explaining why rejected
- Helps identify model improvement areas

### 4. Monitor Repeat Offenders
- High-risk individuals need attention
- Consider additional safety measures

### 5. Verify False Positive Patterns
- If many rejections for same type, model may need retraining
- Document patterns for model improvement

## Violation Types

Common violation types detected by the system:

| Type | Description |
|------|-------------|
| No Helmet | Head protection missing |
| No Safety Vest | High-visibility vest missing |
| No Gloves | Hand protection missing |
| No Safety Boots | Foot protection missing |
| Restricted Zone | Unauthorized area entry |

## Access Levels

Current system has single admin role. For multi-admin deployment:

- **Reviewer**: Can view and review violations
- **Manager**: Can delete videos and access reports
- **Admin**: Full system access

## Troubleshooting

### Video Won't Upload
- Check file format (MP4, AVI, MOV, MKV)
- Verify file size < 500MB
- Ensure stable network connection

### Processing Stuck
- Check server logs for errors
- Verify YOLO model is loaded
- Ensure sufficient GPU memory

### No Violations Detected
- Check if video contains relevant content
- Verify model is trained for your use case
- Review confidence threshold settings

### False Positives
- Adjust confidence threshold in config
- Consider retraining model with local data
- Document patterns for future improvement

## Keyboard Shortcuts (Future)

Planning for efficiency:
- `C` - Confirm current violation
- `R` - Reject current violation
- `N` - Next violation
- `P` - Previous violation
- `Space` - Play/Pause video

## API Reference

Admins can also use the REST API:

```bash
# List pending violations
GET /api/violations?review_status=pending

# Confirm a violation
POST /api/violations/{id}/review
{
  "is_confirmed": true,
  "notes": "Clearly visible helmet violation"
}

# Bulk review
POST /api/violations/bulk-review
{
  "violation_ids": [1, 2, 3],
  "is_confirmed": true
}
```

## Support

For technical issues:
1. Check logs in console
2. Verify API connectivity
3. Review error messages
4. Contact system administrator
