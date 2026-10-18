#!/usr/bin/env python3
"""
Prepare a small Qelvaris Chess puzzle library from the official Lichess puzzle CSV.

Input:
  lichess_db_puzzle.csv.zst

Output:
  public/data/qelvaris-puzzles.json

Install once:
  py -m pip install zstandard python-chess

Run:
  py prepare_lichess_puzzles.py --input lichess_db_puzzle.csv.zst --output public/data/qelvaris-puzzles.json --count 10000
"""
import argparse
import csv
import io
import json
import random
from pathlib import Path

import chess
import zstandard as zstd


def theme_title(themes):
    theme_set = set(themes)
    friendly = [
        ("mateIn1", "Mate in 1"),
        ("mateIn2", "Mate in 2"),
        ("mateIn3", "Mate in 3"),
        ("fork", "Fork"),
        ("pin", "Pin"),
        ("skewer", "Skewer"),
        ("discoveredAttack", "Discovered attack"),
        ("doubleCheck", "Double check"),
        ("sacrifice", "Sacrifice"),
        ("backRankMate", "Back-rank mate"),
        ("promotion", "Promotion"),
        ("deflection", "Deflection"),
        ("attraction", "Attraction"),
        ("hangingPiece", "Hanging piece"),
        ("trappedPiece", "Trapped piece"),
        ("endgame", "Endgame"),
        ("opening", "Opening"),
        ("middlegame", "Middlegame"),
    ]
    for tag, label in friendly:
        if tag in theme_set:
            return label
    return "Tactics"


def difficulty_for(rating):
    if rating < 1200:
        return "Easy"
    if rating < 1800:
        return "Medium"
    return "Hard"


def to_puzzle(row):
    puzzle_id = row["PuzzleId"]
    fen_before = row["FEN"]
    uci_moves = row["Moves"].split()
    if len(uci_moves) < 2:
        return None

    try:
        board = chess.Board(fen_before)
        # Lichess FEN is before the opponent's initial move. Apply it so the
        # player sees the actual puzzle position.
        first = chess.Move.from_uci(uci_moves[0])
        if first not in board.legal_moves:
            return None
        board.push(first)
        display_fen = board.fen()

        solution = []
        # The first remaining move belongs to the puzzle solver. Keep all
        # subsequent solver moves and opponent replies for multi-move play.
        for uci in uci_moves[1:]:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                return None
            solution.append({
                "from": chess.square_name(move.from_square),
                "to": chess.square_name(move.to_square),
                "promotion": chess.piece_symbol(move.promotion).lower() if move.promotion else None,
            })
            board.push(move)

        if not solution:
            return None

        rating = int(row["Rating"])
        themes = [t for t in row.get("Themes", "").split() if t]
        theme = theme_title(themes)
        return {
            "id": f"lichess-{puzzle_id}",
            "title": f"{theme} · {puzzle_id}",
            "difficulty": difficulty_for(rating),
            "theme": theme,
            "fen": display_fen,
            "solution": solution,
            "rating": rating,
            "tags": themes,
            "gameUrl": row.get("GameUrl", ""),
            "hint": [
                "Look for forcing moves: checks, captures, and direct threats.",
                f"Theme to consider: {theme}. Calculate the opponent's best reply too.",
            ],
            "explanation": (
                f"Lichess puzzle rated {rating}. Main theme: {theme}. "
                "Try to calculate the complete line, including the opponent's replies."
            ),
        }
    except (ValueError, AssertionError, IndexError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="lichess_db_puzzle.csv.zst")
    parser.add_argument("--output", default="public/data/qelvaris-puzzles.json")
    parser.add_argument("--count", type=int, default=10000)
    parser.add_argument("--min-rating", type=int, default=600)
    parser.add_argument("--max-rating", type=int, default=2400)
    parser.add_argument("--min-popularity", type=int, default=70)
    parser.add_argument("--min-plays", type=int, default=20)
    parser.add_argument("--seed", type=int, default=20261016)
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(
            f"Input file not found: {input_path}\n"
            "Download lichess_db_puzzle.csv.zst from https://database.lichess.org/#puzzles "
            "and put it beside this script."
        )

    rng = random.Random(args.seed)
    reservoir = []
    eligible_seen = 0

    print("Reading the compressed Lichess dataset and selecting candidate puzzles...")
    with input_path.open("rb") as compressed:
        reader = zstd.ZstdDecompressor().stream_reader(compressed)
        text_stream = io.TextIOWrapper(reader, encoding="utf-8", newline="")
        csv_reader = csv.DictReader(text_stream)

        for row in csv_reader:
            try:
                rating = int(row["Rating"])
                popularity = int(row["Popularity"])
                plays = int(row["NbPlays"])
            except (ValueError, TypeError):
                continue

            if not (args.min_rating <= rating <= args.max_rating):
                continue
            if popularity < args.min_popularity or plays < args.min_plays:
                continue

            eligible_seen += 1
            if len(reservoir) < args.count:
                reservoir.append(row)
            else:
                j = rng.randrange(eligible_seen)
                if j < args.count:
                    reservoir[j] = row

            if eligible_seen % 250000 == 0:
                print(f"Eligible rows scanned: {eligible_seen:,}")

    print(f"Candidate pool selected: {len(reservoir):,}. Validating legal lines...")
    puzzles = []
    for row in reservoir:
        item = to_puzzle(row)
        if item:
            puzzles.append(item)

    rng.shuffle(puzzles)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(puzzles, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Done. Exported {len(puzzles):,} validated puzzles to: {output_path}")
    print("The generated JSON supports multi-move solution lines.")
    print("Note: the React Puzzle Lab must load this JSON and auto-play opponent replies to use full lines.")


if __name__ == "__main__":
    main()
