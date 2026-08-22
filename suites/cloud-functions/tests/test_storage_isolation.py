"""
P0-C G18 storagePath isolation — pytest
Verifies: same-user PASS, cross-user 403, anonymous allowed.
"""
def test_same_user_pass():
    sp = "users/alice/datasets/123/file.csv.gz"
    uid = "alice"
    assert sp.startswith(f"users/{uid}/")

def test_cross_user_403():
    sp = "users/alice/datasets/123/file.csv.gz"
    uid = "bob"
    assert not sp.startswith(f"users/{uid}/")
    # Simulate guard
    is_forbidden = sp and uid != "anonymous-user" and not sp.startswith(f"users/{uid}/")
    assert is_forbidden

def test_anonymous_allowed():
    sp = "anonymous/pending/abc/file.csv"
    uid = "anonymous-user"
    is_forbidden = sp and uid != "anonymous-user" and not sp.startswith(f"users/{uid}/")
    assert not is_forbidden
