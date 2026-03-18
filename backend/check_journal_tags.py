import sqlite3
import json

def check_db():
    conn = sqlite3.connect('timejournal.db')
    cursor = conn.cursor()
    
    print("--- Journal Tags ---")
    cursor.execute("SELECT * FROM journal_tags")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- Daily Tags ---")
    cursor.execute("SELECT * FROM daily_tags")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- Recent Trades with Setup/Emotion ---")
    cursor.execute("SELECT ticket, data FROM trades ORDER BY synced_at DESC LIMIT 5")
    for ticket, data_str in cursor.fetchall():
        data = json.loads(data_str)
        print(f"Ticket: {ticket}, Setup: {data.get('setup')}, Emotion: {data.get('emotion')}")

    conn.close()

if __name__ == "__main__":
    check_db()
