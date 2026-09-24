#!/usr/bin/env python3
"""Pile combining diacritics around letters for a glitched "zalgo" look.

Examples:
    ./zalgo.py "he comes"
    echo "extraordinary" | ./zalgo.py -i 1
    ./zalgo.py -i 3 --seed 42 "nothing to see here"
"""

import argparse
import random
import sys

# Traits qui barrent la lettre (U+0334 à U+0338) : c'est ce qui donne l'effet « rayé »
OVERLAY = [chr(c) for c in range(0x0334, 0x0339)]

# Marques au-dessus de la lettre, dont les petites lettres latines (U+0363 à U+036F)
ABOVE = [chr(c) for c in (
    *range(0x0300, 0x0316), 0x031A, 0x033D, 0x033E, 0x033F,
    0x0346, 0x034A, 0x034B, 0x034C, 0x0350, 0x0351, 0x0352, 0x0357, 0x035B,
    *range(0x0363, 0x0370),
)]

# Marques sous la lettre
BELOW = [chr(c) for c in (
    *range(0x0316, 0x031A), *range(0x031B, 0x0334), 0x0339, 0x033A, 0x033B,
    0x033C, 0x0345, 0x0347, 0x0348, 0x0349, 0x034D, 0x034E, 0x0353, 0x0354,
    0x0355, 0x0356, 0x0359, 0x035A,
)]

# Niveau -> (probabilité de barrer, max au-dessus, max en dessous)
LEVELS = {
    1: (0.15, 2, 2),  # discret, proche de « eͪẍt̶̜̯ṟ̑aͨ͟ord́̀i͕̾̄n͓̳͗ạͯi̹r͕ė͊͗ »
    2: (1.0, 3, 4),   # proche de « b̵̨̥̞͓̋a̶̮̖͂̄͌̃͜ń̴̯̝ă̴͈l̵̯͇̜̪̍̃e̵̟͎͌̓͋͋ »
    3: (1.0, 8, 8),   # déborde sur les lignes voisines
}


def glitch_char(ch: str, level: int, rng: random.Random) -> str:
    if not ch.isalnum():
        return ch
    strike_prob, max_above, max_below = LEVELS[level]
    marks = []
    if rng.random() < strike_prob:
        marks.append(rng.choice(OVERLAY))
    marks += rng.choices(BELOW, k=rng.randint(0, max_below))
    marks += rng.choices(ABOVE, k=rng.randint(0, max_above))
    return ch + "".join(marks)


def glitch(text: str, level: int = 2, seed: int | None = None) -> str:
    rng = random.Random(seed)
    return "".join(glitch_char(ch, level, rng) for ch in text)


def main() -> None:
    parser = argparse.ArgumentParser(description="Turn text into glitched zalgo text.")
    parser.add_argument("text", nargs="*", help="text to transform (read from stdin otherwise)")
    parser.add_argument("-i", "--intensity", type=int, choices=LEVELS, default=2,
                        help="1 = subtle, 2 = medium (default), 3 = chaotic")
    parser.add_argument("--seed", type=int, help="seed to always get the same output")
    args = parser.parse_args()

    text = " ".join(args.text) if args.text else sys.stdin.read().rstrip("\n")
    if not text:
        parser.error("give some text as an argument or on stdin")
    print(glitch(text, args.intensity, args.seed))


if __name__ == "__main__":
    main()
