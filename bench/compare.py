#!/usr/bin/env python3
"""Affiche le Δ entre les versions A et B d'un fichier de résultats de bench.py."""
import json
import sys

r = json.load(open(sys.argv[1]))
A = r["versions"]["A"]["summary"]
B = r["versions"].get("B", r["versions"]["A"])["summary"]
print(f"render={r['env'].get('render', 'software')}")
for k in A:
    a, b = A[k]["median"], B[k]["median"]
    d = 100 * (b - a) / a if a else 0.0
    print(f"{k:22s} A {a:>9} (cv {A[k]['cv_pct']:>5}%)  B {b:>9} (cv {B[k]['cv_pct']:>5}%)  Δ {d:+6.1f}%")
