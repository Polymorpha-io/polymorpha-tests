"""Deterministic PRNG utilities — mirrors tests/generators/seed.ts (mulberry32)."""

from __future__ import annotations

import math


def mulberry32(seed: int):
    """Return a function yielding float in [0,1) — deterministic, seed-driven."""
    a = seed & 0xFFFFFFFF

    def _next() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = (a ^ (a >> 15)) & 0xFFFFFFFF
        t = (t * (1 | a)) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t = (t ^ (t >> 14)) & 0xFFFFFFFF
        return (t & 0xFFFFFFFF) / 4294967296

    return _next


def hash_string(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h & 0xFFFFFFFF


def rand_int(rand, lo: int, hi: int) -> int:
    return lo + int(rand() * (hi - lo + 1))


def pick(rand, arr):
    if not arr:
        raise ValueError("pick() on empty array")
    return arr[int(rand() * len(arr))]


def seeded_shuffle(rand, arr):
    out = list(arr)
    for i in range(len(out) - 1, 0, -1):
        j = int(rand() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out


def rand_normal(rand) -> float:
    u = 0.0
    v = 0.0
    while u == 0:
        u = rand()
    while v == 0:
        v = rand()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def sample_indices(rand, n: int, k: int):
    k = min(k, n)
    return seeded_shuffle(rand, list(range(n)))[:k]
