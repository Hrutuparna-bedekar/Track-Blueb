import sqlite3

c = sqlite3.connect('violation_tracking.db')

print("=== Videos Count ===")
print(c.execute("SELECT COUNT(*) FROM videos").fetchone()[0])

print("\n=== Videos Status ===")
for row in c.execute("SELECT id, status, total_violations, total_individuals FROM videos"):
    print(f"ID: {row[0]}, Status: {row[1]}, Violations: {row[2]}, Individuals: {row[3]}")

print("\n=== Tracked Individuals Count ===")
print(c.execute("SELECT COUNT(*) FROM tracked_individuals").fetchone()[0])

print("\n=== Violations Count ===")
print(c.execute("SELECT COUNT(*) FROM violations").fetchone()[0])

c.close()
