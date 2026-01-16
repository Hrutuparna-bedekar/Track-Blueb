
import sqlite3
import os
import sys

# Database Path
DB_PATH = "violation_tracking.db"

def debug_counts():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    today = "2026-01-17"
    # Write output to file
    with open("debug_output.txt", "w") as f:
        f.write(f"\n--- Debugging Violations for {today} ---\n\n")

        # 1. Total Violations Today
        cursor.execute("SELECT COUNT(*) FROM violations WHERE date(detected_at) = ?", (today,))
        total = cursor.fetchone()[0]
        f.write(f"Total Violations (ALL statuses): {total}\n")

        # 2. Confirmed Violations Today
        cursor.execute("SELECT COUNT(*) FROM violations WHERE date(detected_at) = ? AND review_status = 'confirmed'", (today,))
        confirmed = cursor.fetchone()[0]
        f.write(f"Confirmed Violations: {confirmed}\n")

        # 3. Pending Violations Today
        cursor.execute("SELECT COUNT(*) FROM violations WHERE date(detected_at) = ? AND review_status = 'pending'", (today,))
        pending = cursor.fetchone()[0]
        f.write(f"Pending Violations: {pending}\n")

        # 4. Rejected Violations Today
        cursor.execute("SELECT COUNT(*) FROM violations WHERE date(detected_at) = ? AND review_status = 'rejected'", (today,))
        rejected = cursor.fetchone()[0]
        f.write(f"Rejected Violations: {rejected}\n")

        f.write("-" * 30 + "\n")

        # 5. Confirmed by Type
        f.write("\nConfirmed by Type:\n")
        cursor.execute("SELECT violation_type, COUNT(*) FROM violations WHERE date(detected_at) = ? AND review_status = 'confirmed' GROUP BY violation_type", (today,))
        rows = cursor.fetchall()
        for row in rows:
            f.write(f"  {row[0]}: {row[1]}\n")

        # 6. Pending by Type
        f.write("\nPending by Type:\n")
        cursor.execute("SELECT violation_type, COUNT(*) FROM violations WHERE date(detected_at) = ? AND review_status = 'pending' GROUP BY violation_type", (today,))
        rows = cursor.fetchall()
        for row in rows:
            f.write(f"  {row[0]}: {row[1]}\n")

        f.write("-" * 30 + "\n")
        
        # 7. Inconsistency Check
        f.write("\nInconsistency Check: Pending Violations in Reviewed Videos\n")
        sql = """
            SELECT v.id, v.original_filename, COUNT(vi.id) 
            FROM videos v
            JOIN tracked_individuals t ON v.id = t.video_id
            JOIN violations vi ON t.id = vi.individual_id
            WHERE v.is_reviewed = 1 AND vi.review_status = 'pending'
            GROUP BY v.id
        """
        cursor.execute(sql)
        rows = cursor.fetchall()
        
        if rows:
            f.write(f"Found {len(rows)} reviewed videos with pending violations:\n")
            for row in rows:
                f.write(f"  Video {row[0]} ({row[1]}): {row[2]} pending violations\n")
        else:
            f.write("No inconsistencies found.\n")

    conn.close()

if __name__ == "__main__":
    debug_counts()
