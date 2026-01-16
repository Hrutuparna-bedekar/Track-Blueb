"""
Database migration script to add is_reviewed and reviewed_at columns to videos table.
Run this script once to update the database schema.
"""

import sqlite3
import os

# Database path (same as in config.py)
DB_PATH = "./violation_tracking.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        print("The columns will be created automatically when the app starts for the first time.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(videos)")
    columns = [col[1] for col in cursor.fetchall()]
    
    migrations_run = 0
    
    # Add is_reviewed column if it doesn't exist
    if 'is_reviewed' not in columns:
        print("Adding 'is_reviewed' column to videos table...")
        cursor.execute("ALTER TABLE videos ADD COLUMN is_reviewed INTEGER DEFAULT 0")
        migrations_run += 1
    else:
        print("Column 'is_reviewed' already exists.")
    
    # Add reviewed_at column if it doesn't exist
    if 'reviewed_at' not in columns:
        print("Adding 'reviewed_at' column to videos table...")
        cursor.execute("ALTER TABLE videos ADD COLUMN reviewed_at DATETIME NULL")
        migrations_run += 1
    else:
        print("Column 'reviewed_at' already exists.")
    
    conn.commit()
    conn.close()
    
    if migrations_run > 0:
        print(f"\n✅ Migration complete! Added {migrations_run} new column(s).")
    else:
        print("\n✅ No migrations needed. Database is up to date.")

if __name__ == "__main__":
    migrate()
