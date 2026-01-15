"""
Violation aggregation per tracked individual.

Aggregates violations per person, tracks patterns, and calculates risk scores.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class ViolationRecord:
    """Record of a single violation."""
    violation_type: str
    confidence: float
    frame_number: int
    timestamp: float
    bbox: tuple
    image_path: str = None  # Path to snapshot image of violation


@dataclass
class IndividualViolationProfile:
    """Aggregated violation profile for an individual."""
    track_id: int
    violations: List[ViolationRecord] = field(default_factory=list)
    
    # Tracking metadata
    first_seen_frame: int = 0
    last_seen_frame: int = 0
    first_seen_time: float = 0.0
    last_seen_time: float = 0.0
    total_frames: int = 0
    
    def add_violation(self, violation: ViolationRecord):
        """Add a violation to this individual's profile."""
        self.violations.append(violation)
    
    @property
    def violation_count(self) -> int:
        """Total number of violations."""
        return len(self.violations)
    
    @property
    def violation_types(self) -> Dict[str, int]:
        """Count of each violation type."""
        counts = defaultdict(int)
        for v in self.violations:
            counts[v.violation_type] += 1
        return dict(counts)
    
    @property
    def most_common_violation(self) -> Optional[str]:
        """The most frequently occurring violation type."""
        types = self.violation_types
        if not types:
            return None
        return max(types.keys(), key=lambda k: types[k])
    
    @property
    def duration_tracked(self) -> float:
        """Duration in seconds this individual was tracked."""
        return self.last_seen_time - self.first_seen_time
    
    @property
    def violation_frequency(self) -> float:
        """Violations per minute."""
        duration_mins = self.duration_tracked / 60.0
        if duration_mins <= 0:
            return 0.0
        return self.violation_count / duration_mins
    
    @property
    def risk_score(self) -> float:
        """Calculate risk score based on violations (0.0 to 1.0)."""
        if self.violation_count == 0:
            return 0.0
        # Base score from violation count
        count_score = min(self.violation_count / 10.0, 1.0)
        # Frequency score
        freq_score = min(self.violation_frequency / 5.0, 1.0)
        # Weighted average
        return min((count_score * 0.6) + (freq_score * 0.4), 1.0)


class ViolationAggregator:
    """
    Aggregates violations per tracked individual.
    
    Provides:
    - Per-ID violation history
    - Violation counts and types
    - Time interval analysis
    - Pattern detection (repeated offenses)
    """
    
    def __init__(self):
        """Initialize the aggregator."""
        self.profiles: Dict[int, IndividualViolationProfile] = {}
        self.fps: float = 30.0  # Default, updated when processing
        
    def reset(self, fps: float = 30.0):
        """
        Reset for a new video.
        
        Args:
            fps: Frames per second of the video.
        """
        self.profiles = {}
        self.fps = fps
        logger.info(f"Aggregator reset with FPS: {fps}")
    
    def update_individual(
        self,
        track_id: int,
        frame_number: int,
        first_seen_frame: Optional[int] = None
    ):
        """
        Update tracking metadata for an individual.
        
        Args:
            track_id: The track ID.
            frame_number: Current frame number.
            first_seen_frame: Frame where this individual was first detected.
        """
        timestamp = frame_number / self.fps
        
        if track_id not in self.profiles:
            self.profiles[track_id] = IndividualViolationProfile(
                track_id=track_id,
                first_seen_frame=first_seen_frame or frame_number,
                first_seen_time=timestamp,
                last_seen_frame=frame_number,
                last_seen_time=timestamp,
                total_frames=1
            )
        else:
            profile = self.profiles[track_id]
            profile.last_seen_frame = frame_number
            profile.last_seen_time = timestamp
            profile.total_frames += 1
    
    def add_violation(
        self,
        track_id: int,
        violation_type: str,
        confidence: float,
        frame_number: int,
        bbox: tuple
    ):
        """
        Add a violation to an individual's profile.
        
        Args:
            track_id: The track ID of the violator.
            violation_type: Type of violation detected.
            confidence: Detection confidence.
            frame_number: Frame where violation occurred.
            bbox: Bounding box of the violation.
        """
        timestamp = frame_number / self.fps
        
        # Ensure profile exists
        if track_id not in self.profiles:
            self.update_individual(track_id, frame_number)
        
        violation = ViolationRecord(
            violation_type=violation_type,
            confidence=confidence,
            frame_number=frame_number,
            timestamp=timestamp,
            bbox=bbox
        )
        
        self.profiles[track_id].add_violation(violation)
        
        logger.debug(
            f"Added violation: Track {track_id}, Type: {violation_type}, "
            f"Frame: {frame_number}, Confidence: {confidence:.2f}"
        )
    
    def get_profile(self, track_id: int) -> Optional[IndividualViolationProfile]:
        """Get the violation profile for a specific individual."""
        return self.profiles.get(track_id)
    
    def get_all_profiles(self) -> Dict[int, IndividualViolationProfile]:
        """Get all individual profiles."""
        return self.profiles.copy()
    
    def get_repeat_offenders(self, min_violations: int = 2) -> List[IndividualViolationProfile]:
        """
        Get individuals with multiple violations.
        
        Args:
            min_violations: Minimum violation count to be considered repeat offender.
            
        Returns:
            List of profiles sorted by violation count (descending).
        """
        offenders = [
            p for p in self.profiles.values()
            if p.violation_count >= min_violations
        ]
        return sorted(offenders, key=lambda p: p.violation_count, reverse=True)
    
    def calculate_risk_score(self, track_id: int) -> float:
        """
        Calculate risk score for an individual.
        
        Factors:
        - Number of violations
        - Violation frequency
        - Violation severity (some types are higher risk)
        
        Args:
            track_id: The track ID.
            
        Returns:
            Risk score from 0.0 to 1.0.
        """
        profile = self.profiles.get(track_id)
        if not profile:
            return 0.0
        
        # Base score from violation count
        count_score = min(profile.violation_count / 10.0, 1.0)
        
        # Frequency score
        freq = profile.violation_frequency
        freq_score = min(freq / 5.0, 1.0)  # Normalize to max 5 violations/min
        
        # Weighted average
        risk_score = (count_score * 0.6) + (freq_score * 0.4)
        
        return min(risk_score, 1.0)
    
    def get_summary(self) -> dict:
        """
        Get summary statistics across all individuals.
        
        Returns:
            Dictionary with summary statistics.
        """
        total_individuals = len(self.profiles)
        total_violations = sum(p.violation_count for p in self.profiles.values())
        
        violation_types = defaultdict(int)
        for profile in self.profiles.values():
            for vtype, count in profile.violation_types.items():
                violation_types[vtype] += count
        
        repeat_offenders = len(self.get_repeat_offenders())
        
        return {
            'total_individuals': total_individuals,
            'total_violations': total_violations,
            'violations_by_type': dict(violation_types),
            'repeat_offenders_count': repeat_offenders,
            'average_violations_per_person': (
                total_violations / total_individuals if total_individuals > 0 else 0
            )
        }
