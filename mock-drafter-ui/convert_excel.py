import os
import json
import pandas as pd

EXCEL_PATH = "REDRAFT-rankings.xlsx"
PREFERRED_SHEETS = ["Sheet1", "Sheet 1 - REDRAFT-rankings"]  # try these in order
OUTPUT_PATH = "src/data/players.json"

def pick_sheet(excel_path: str) -> str:
    xls = pd.ExcelFile(excel_path)
    # prefer specific names, else fall back to the first sheet
    for name in PREFERRED_SHEETS:
        if name in xls.sheet_names:
            return name
    return xls.sheet_names[0]

def load_table(excel_path: str, sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(excel_path, sheet_name=sheet_name, header=0)
    # If the first row actually contains the headers (common in your file),
    # set columns from that row and drop it.
    if df.shape[0] > 0:
        first_cell = str(df.iloc[0, 0]).strip()
        if first_cell.lower() == "name" and "Name" not in df.columns:
            df.columns = df.iloc[0]
            df = df.iloc[1:].reset_index(drop=True)
    return df

def normalize(df: pd.DataFrame) -> pd.DataFrame:
    # Standardize column access regardless of exact casing/spaces
    colmap = {
        "name": None,
        "team": None,
        "position": None,
        "expert rank": None,
    }
    # Build a case-insensitive lookup
    lower_cols = {c.lower().strip(): c for c in df.columns}
    for key in list(colmap.keys()):
        if key in lower_cols:
            colmap[key] = lower_cols[key]

    # Validate we have the essentials
    required = ["name", "position"]
    missing = [k for k in required if colmap[k] is None]
    if missing:
        raise ValueError(
            f"Missing expected columns in sheet: {missing}. "
            f"Found columns: {list(df.columns)}"
        )

    # Pull values with safe defaults
    out = pd.DataFrame({
        "Name": df[colmap["name"]].astype(str).str.strip(),
        "Team": (df[colmap["team"]] if colmap["team"] else "NA"),
        "Position": df[colmap["position"]].astype(str).str.upper().str.strip(),
        "Expert Rank": (
            pd.to_numeric(df[colmap["expert rank"]], errors="coerce")
            if colmap["expert rank"] else pd.Series([None] * len(df))
        ),
    })

    # Clean team abbreviations
    if isinstance(out["Team"], pd.Series):
        out["Team"] = out["Team"].astype(str).str.upper().str.strip()
    else:
        out["Team"] = str(out["Team"]).upper()

    # Drop totally blank names
    out = out[out["Name"].str.len() > 0].reset_index(drop=True)

    # Optional: sort by Expert Rank if present
    if "Expert Rank" in out.columns:
        out = out.sort_values(by=["Expert Rank"], na_position="last").reset_index(drop=True)

    return out

def to_players(df: pd.DataFrame):
    players = []
    for i, row in df.iterrows():
        adp_val = row.get("Expert Rank")
        adp = float(adp_val) if pd.notna(adp_val) else None
        players.append({
            "id": f"p{i+1}",
            "name": str(row.get("Name", "")).strip(),
            "team": str(row.get("Team", "NA")).strip(),
            "pos": str(row.get("Position", "")).strip(),
            "adp": adp,  # storing Expert Rank under 'adp' for now
        })
    return players

def main():
    sheet = pick_sheet(EXCEL_PATH)
    df_raw = load_table(EXCEL_PATH, sheet)
    df = normalize(df_raw)
    players = to_players(df)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2, ensure_ascii=False)

    print(f"✅ Converted {len(players)} players from sheet '{sheet}' → {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
