import sqlite3
import datetime
import os

# Print current working directory
print(f"Current working directory: {os.getcwd()}")

# Ensure the instance folder exists
instance_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "instance"))
os.makedirs(instance_dir, exist_ok=True)
print(f"Instance directory created at: {instance_dir}")

# Database path
db_path = os.path.join(instance_dir, "rh_database.db")
print(f"Database will be created at: {db_path}")

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create the employees table
cursor.execute('''
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    position TEXT,
    hire_date TEXT,
    vacation_days INTEGER DEFAULT 25,
    days_taken INTEGER DEFAULT 0
)
''')

# Sample employee data
employees = [
    {"email": "john.doe@finelog-biseum.com", "full_name": "John Doe", "position": "Développeur", "hire_date": datetime.date(2022, 1, 15), "vacation_days": 25, "days_taken": 5},
    {"email": "jane.smith@finelog-biseum.com", "full_name": "Jane Smith", "position": "Designer", "hire_date": datetime.date(2021, 6, 20), "vacation_days": 30, "days_taken": 10},
    {"email": "cedric.kabore@finelog-biseum.com", "full_name": "Cédric Kaboré", "position": "Chef de Projet", "hire_date": datetime.date(2020, 3, 10), "vacation_days": 28, "days_taken": 7},
]

# Insert data into the database
print("Inserting employee data...")
for employee in employees:
    try:
        cursor.execute('''
        INSERT OR REPLACE INTO employees 
        (email, full_name, position, hire_date, vacation_days, days_taken)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            employee["email"],
            employee["full_name"],
            employee["position"],
            employee["hire_date"].isoformat(),  # Convert date to string
            employee["vacation_days"],
            employee["days_taken"]
        ))
        print(f"Added employee: {employee['full_name']}")
    except Exception as e:
        print(f"Error adding employee {employee['full_name']}: {e}")

# Commit the transaction
conn.commit()
print("All changes committed to database")

# Verify data insertion
cursor.execute("SELECT * FROM employees")
rows = cursor.fetchall()
print(f"\nDatabase now contains {len(rows)} employees:")
for row in rows:
    print(f"ID: {row[0]}, Name: {row[2]}, Email: {row[1]}")

# Close the connection
conn.close()
print("Database connection closed")