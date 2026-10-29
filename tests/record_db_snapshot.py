import sqlite3
import hashlib
import json

def get_snapshot():
    conn = sqlite3.connect('instance/cirrhosis.db')
    c = conn.cursor()
    integrity = c.execute('PRAGMA integrity_check').fetchall()
    fk = c.execute('PRAGMA foreign_key_check').fetchall()
    tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
    counts = {t: c.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in tables}
    conn.close()

    with open('instance/cirrhosis.db', 'rb') as f:
        sha = hashlib.sha256(f.read()).hexdigest()

    snapshot = {
        'sha256': sha,
        'integrity': integrity,
        'foreign_key_check': fk,
        'counts': counts
    }
    return snapshot

if __name__ == '__main__':
    snap = get_snapshot()
    print(json.dumps(snap, indent=2))
    with open('tests/pre_test_db_snapshot.json', 'w') as f:
        json.dump(snap, f, indent=2)
