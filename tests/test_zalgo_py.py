import subprocess
import sys
import unicodedata
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import zalgo  # noqa: E402


def strip_marks(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


class GlitchTest(unittest.TestCase):
    def test_garde_les_lettres(self):
        for level in zalgo.LEVELS:
            self.assertEqual(strip_marks(zalgo.glitch("il vient 42", level, seed=1)), "il vient 42")

    def test_graine_deterministe(self):
        self.assertEqual(zalgo.glitch("banale", 3, seed=7), zalgo.glitch("banale", 3, seed=7))

    def test_ponctuation_intacte(self):
        out = zalgo.glitch(", !?", 3, seed=1)
        self.assertEqual(out, ", !?")

    def test_niveau_2_barre_tout(self):
        out = zalgo.glitch("zalgo", 2, seed=3)
        self.assertEqual(sum(c in zalgo.OVERLAY for c in out), 5)

    def test_cli(self):
        run = lambda *args, stdin=None: subprocess.run(
            [sys.executable, str(ROOT / "zalgo.py"), *args], input=stdin, capture_output=True, text=True)
        self.assertEqual(run("--seed", "1", "-i", "1", "abc").stdout, zalgo.glitch("abc", 1, 1) + "\n")
        self.assertEqual(run("--seed", "1", stdin="abc\n").stdout, zalgo.glitch("abc", 2, 1) + "\n")
        self.assertNotEqual(run(stdin="").returncode, 0)


if __name__ == "__main__":
    unittest.main()
