"""
Migration script to add 'source' column to videos table.
Run this script to update existing databases.
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "violation_tracking.db"

def migrate():
    """Add source column to videos table if it doesn't exist."""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return False
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(videos)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "source" in columns:
            print("Column 'source' already exists in videos table. Skipping migration.")
            return True
        
        # Add the source column with default value 'upload'
        print("Adding 'source' column to videos table...")
        cursor.execute("ALTER TABLE videos ADD COLUMN source VARCHAR(50) DEFAULT 'upload'")
        
        # Update existing records to have 'upload' as source
        cursor.execute("UPDATE videos SET source = 'upload' WHERE source IS NULL")
        
        conn.commit()
        print("Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
