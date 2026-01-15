# Privacy Handling

## Privacy-First Design

This system is designed with privacy as a core principle. It uses **motion-based tracking only** and explicitly avoids storing biometric data.

## What We DO NOT Store

### 1. Face Embeddings ❌
- No facial recognition algorithms
- No facial feature extraction
- No face templates or encodings

### 2. Biometric Data ❌
- No fingerprints
- No iris patterns
- No voice recordings
- No gait analysis

### 3. Persistent Identifiers ❌
- No cross-video identity linking
- No long-term tracking database
- No individual profiles across sessions

## What We DO Store

### 1. Temporary Track IDs ✓
- Integer IDs (1, 2, 3, etc.)
- Session-scoped (per video only)
- Reset for each upload
- Not linked to real identities

### 2. Violation Records ✓
- Violation type (e.g., "No Helmet")
- Timestamp within video
- Bounding box coordinates
- Detection confidence score

### 3. Video Metadata ✓
- Filename and file size
- Duration and resolution
- Processing status

### 4. Aggregated Statistics ✓
- Violation counts per track ID
- Violation frequency
- Risk scores (calculated, not biometric)

## Privacy Compliance

### GDPR Considerations

| Requirement | How We Address It |
|-------------|-------------------|
| Data Minimization | Store only necessary violation data |
| Purpose Limitation | Used only for safety violation tracking |
| Storage Limitation | Temporary IDs, no persistent profiles |
| Right to Erasure | Delete video removes all associated data |

### Technical Safeguards

1. **Session Isolation**
   ```python
   def reset(self):
       """Reset tracker for new video session."""
       self.tracker = DeepSort(...)  # Fresh instance
       self.track_history = {}       # Clear history
   ```

2. **Cascade Deletion**
   - Deleting a video removes:
     - All tracked individuals
     - All violations
     - All review records
     - Video snippets

3. **No External Data Sharing**
   - Processing happens locally
   - No cloud-based face recognition
   - No third-party identity services

## Appearance Embeddings Clarification

The Deep SORT tracker uses a lightweight "appearance embedder" but:

- It extracts general visual features (colors, shapes)
- NOT specific to individuals
- NOT suitable for re-identification across sessions
- Used ONLY for short-term tracking continuity

## Data Flow

```
Video Upload
     │
     ▼
Frame Extraction (temporary)
     │
     ▼
Detection (YOLO) ─────────────────────────────┐
     │                                        │
     ▼                                        │
Tracking (Deep SORT) ──► Temp IDs ────► Stored
     │                   (session only)       │
     ▼                                        │
Violation Association ────────────────────────┘
     │
     ▼
Admin Review ──► Confirmation
     │
     ▼
Analytics Dashboard
```

## Recommendations for Deployment

1. **Access Control**
   - Implement authentication for admin interface
   - Restrict video upload to authorized personnel
   
2. **Data Retention**
   - Define retention policies
   - Automatically delete old videos
   - Regularly audit stored data

3. **Audit Logging**
   - Log admin actions (reviews, deletions)
   - Maintain access logs
   - Review logs periodically

4. **Notice & Consent**
   - Post visible notices in monitored areas
   - Inform individuals about safety monitoring
   - Provide contact for privacy inquiries

## Disclaimer

This system is designed for workplace safety monitoring and compliance. It should be used in accordance with:
- Local privacy laws
- Workplace regulations
- Industry standards

Organizations should consult legal counsel before deployment.
