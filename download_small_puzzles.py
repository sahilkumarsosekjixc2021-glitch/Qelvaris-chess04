
import json
import urllib.request
from pathlib import Path

url = (
    "https://datasets-server.huggingface.co/rows"
    "?dataset=Lichess/chess-puzzles"
    "&config=default&split=train&offset=0&length=100"
)

print("Downloading 100 puzzles...")

request = urllib.request.Request(
    url,
    headers={"User-Agent": "QelvarisChess/1.0"}
)

with urllib.request.urlopen(request, timeout=60) as response:
    data = json.loads(response.read().decode("utf-8"))

puzzles = []

for item in data["rows"]:
    row = item["row"]
    puzzles.append({
        "id": row["PuzzleId"],
        "fen": row["FEN"],
        "moves": row["Moves"].split(),
        "rating": row["Rating"],
        "themes": row["Themes"] or []
    })

output = Path("public/data/qelvaris-puzzles.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(
    json.dumps(puzzles, indent=2),
    encoding="utf-8"
)

print(f"Success! Saved {len(puzzles)} puzzles to {output}")
