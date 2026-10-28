import os
import subprocess
import sys
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GREET_PATH = os.path.join(ROOT, "greet.py")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import greet  # noqa: E402

TONES = ("friendly", "formal", "playful")


def first(seq):
    return seq[0]


def last(seq):
    return seq[-1]


def run_cli(*args):
    return subprocess.run(
        [sys.executable, GREET_PATH, *args],
        capture_output=True,
        text=True,
        timeout=30,
    )


def formatted_pool(tone, name):
    return [template.format(name=name) for template in greet.GREETINGS[tone]]


class GreetingsPoolTests(unittest.TestCase):
    def test_tones_are_exactly_the_expected_ones(self):
        self.assertEqual(set(greet.GREETINGS), set(TONES))

    def test_each_tone_has_at_least_three_distinct_templates(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                pool = list(greet.GREETINGS[tone])
                self.assertGreaterEqual(len(pool), 3)
                self.assertEqual(len(set(pool)), len(pool))

    def test_templates_are_nonempty_single_line_with_name_placeholder(self):
        for tone in TONES:
            for template in greet.GREETINGS[tone]:
                with self.subTest(tone=tone, template=template):
                    self.assertIsInstance(template, str)
                    self.assertTrue(template.strip())
                    self.assertNotIn("\n", template)
                    self.assertNotIn("\r", template)
                    self.assertIn("{name}", template)


class GenerateGreetingTests(unittest.TestCase):
    def test_first_and_last_templates_are_interpolated_for_every_tone(self):
        for tone in TONES:
            pool = list(greet.GREETINGS[tone])
            for picker, template in ((first, pool[0]), (last, pool[-1])):
                with self.subTest(tone=tone, template=template):
                    with mock.patch("random.choice", side_effect=picker):
                        result = greet.generate_greeting("Ada", tone)
                    self.assertEqual(result, template.format(name="Ada"))
                    self.assertIn("Ada", result)
                    self.assertNotIn("{name}", result)

    def test_choice_is_called_once_with_the_tone_pool(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                with mock.patch("random.choice", side_effect=first) as choice:
                    greet.generate_greeting("Ada", tone)
                choice.assert_called_once()
                (pool,), _ = choice.call_args
                self.assertEqual(list(pool), list(greet.GREETINGS[tone]))

    def test_defaults_are_world_and_friendly(self):
        friendly = list(greet.GREETINGS["friendly"])
        for picker, template in ((first, friendly[0]), (last, friendly[-1])):
            with self.subTest(template=template):
                with mock.patch("random.choice", side_effect=picker) as choice:
                    result = greet.generate_greeting()
                self.assertEqual(result, template.format(name="World"))
                (pool,), _ = choice.call_args
                self.assertEqual(list(pool), friendly)

    def test_default_name_with_explicit_tone(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                template = greet.GREETINGS[tone][0]
                with mock.patch("random.choice", side_effect=first):
                    result = greet.generate_greeting(tone=tone)
                self.assertEqual(result, template.format(name="World"))

    def test_default_tone_with_explicit_name(self):
        template = greet.GREETINGS["friendly"][-1]
        with mock.patch("random.choice", side_effect=last):
            result = greet.generate_greeting("Grace Hopper")
        self.assertEqual(result, template.format(name="Grace Hopper"))

    def test_keyword_arguments(self):
        template = greet.GREETINGS["formal"][0]
        with mock.patch("random.choice", side_effect=first):
            result = greet.generate_greeting(name="Ada", tone="formal")
        self.assertEqual(result, template.format(name="Ada"))


class CliTests(unittest.TestCase):
    def assert_single_greeting(self, proc, tone, name):
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stderr, "")
        self.assertTrue(proc.stdout.endswith("\n"))
        self.assertEqual(proc.stdout.count("\n"), 1)
        self.assertIn(proc.stdout.rstrip("\n"), formatted_pool(tone, name))

    def test_default(self):
        proc = run_cli()
        self.assert_single_greeting(proc, "friendly", "World")

    def test_every_tone_with_name(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                proc = run_cli("--name", "Ada", "--tone", tone)
                self.assert_single_greeting(proc, tone, "Ada")

    def test_name_only_uses_friendly(self):
        proc = run_cli("--name", "Ada")
        self.assert_single_greeting(proc, "friendly", "Ada")

    def test_tone_only_uses_world(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                proc = run_cli("--tone", tone)
                self.assert_single_greeting(proc, tone, "World")

    def test_flag_order_does_not_matter(self):
        proc = run_cli("--tone", "playful", "--name", "Ada")
        self.assert_single_greeting(proc, "playful", "Ada")

    def test_quoted_multiword_name(self):
        for tone in TONES:
            with self.subTest(tone=tone):
                proc = run_cli("--name", "Ada Lovelace", "--tone", tone)
                self.assert_single_greeting(proc, tone, "Ada Lovelace")

    def test_help_mentions_both_flags(self):
        for flag in ("--help", "-h"):
            with self.subTest(flag=flag):
                proc = run_cli(flag)
                self.assertEqual(proc.returncode, 0)
                self.assertIn("--name", proc.stdout)
                self.assertIn("--tone", proc.stdout)
                self.assertEqual(proc.stderr, "")

    def test_invalid_tones_fail(self):
        for tone in ("angry", "Friendly", "FORMAL", ""):
            with self.subTest(tone=tone):
                proc = run_cli("--name", "Ada", "--tone", tone)
                self.assertNotEqual(proc.returncode, 0)
                self.assertNotEqual(proc.stderr.strip(), "")
                self.assertEqual(proc.stdout, "")

    def test_unknown_flags_fail(self):
        for args in (("--bogus",), ("--name", "Ada", "--shout"), ("-x",)):
            with self.subTest(args=args):
                proc = run_cli(*args)
                self.assertNotEqual(proc.returncode, 0)
                self.assertNotEqual(proc.stderr.strip(), "")
                self.assertEqual(proc.stdout, "")

    def test_missing_values_fail(self):
        cases = (
            ("--name",),
            ("--tone",),
            ("--name", "--tone", "formal"),
            ("--name", "Ada", "--tone"),
            ("--tone", "--name", "Ada"),
        )
        for args in cases:
            with self.subTest(args=args):
                proc = run_cli(*args)
                self.assertNotEqual(proc.returncode, 0)
                self.assertNotEqual(proc.stderr.strip(), "")
                self.assertEqual(proc.stdout, "")


if __name__ == "__main__":
    unittest.main()
