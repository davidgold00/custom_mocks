import pandas as pd
import json

# Load your master cheatsheet Excel
df = pd.read_excel("ADP Master Cheatsheet.xlsx", sheet_name="Overall")

players = []
for i, row in df.iterrows():
    players.append({
        "id": f"p{i+1}",
        "name": str(row["Name"]),
        "team": "NA",  # Team not in this sheet, can be added later
        "pos": str(row["Pos"]),
        "adp": float(row["Master ADP"]),
    })

# Write into the file your React app already uses
with open("src/data/players.json", "w") as f:
    json.dump(players, f, indent=2)

print(f"✅ Converted {len(players)} players → src/data/players.json")
