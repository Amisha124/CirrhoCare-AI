import sqlite3
import hashlib
import json

def verify():
    with open('tests/pre_test_db_snapshot.json', 'r') as f:
        pre_snap = json.load(f)

    conn = sqlite3.connect('instance/cirrhosis.db')
    c = conn.cursor()
    integrity = c.execute('PRAGMA integrity_check').fetchall()
    fk = c.execute('PRAGMA foreign_key_check').fetchall()
    tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
    counts = {t: c.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in tables}
    conn.close()

    with open('instance/cirrhosis.db', 'rb') as f:
        sha = hashlib.sha256(f.read()).hexdigest()

    post_snap = {
        'sha256': sha,
        'integrity': integrity,
        'foreign_key_check': fk,
        'counts': counts
    }

    print("=== PRE-TEST SNAPSHOT ===")
    print(json.dumps(pre_snap, indent=2))
    print("=== POST-TEST SNAPSHOT ===")
    print(json.dumps(post_snap, indent=2))

    # Assertions
    assert post_snap['sha256'] == pre_snap['sha256'], f"SHA256 mismatch! {post_snap['sha256']} != {pre_snap['sha256']}"
    assert post_snap['counts'] == pre_snap['counts'], f"Row counts mismatch! {post_snap['counts']} != {pre_snap['counts']}"
    assert post_snap['integrity'] in [[("ok",)], [["ok"]]], f"Integrity check failed: {post_snap['integrity']}"
    assert post_snap['foreign_key_check'] == [], f"Foreign key check failed: {post_snap['foreign_key_check']}"
    print("\n>>> DATABASE SAFETY VERIFICATION PASSED: Active database remains 100% IDENTICAL and untouched! <<<")

if __name__ == '__main__':
    verify()
