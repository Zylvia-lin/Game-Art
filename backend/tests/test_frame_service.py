from fastapi import HTTPException

from services.frame_service import normalize_selection, selection_hash


def test_normalize_selection_is_one_based_unique_and_sorted():
    assert normalize_selection([5, 1, 3, 3], 5) == [1, 3, 5]


def test_normalize_selection_rejects_zero_and_out_of_range():
    for values in ([0], [6]):
        try:
            normalize_selection(values, 5)
        except HTTPException as exc:
            assert exc.status_code == 422
        else:
            raise AssertionError("expected invalid selection to be rejected")


def test_selection_hash_is_stable_for_same_ordered_selection():
    assert selection_hash([1, 3, 5]) == selection_hash([1, 3, 5])
    assert selection_hash([1, 3, 5]) != selection_hash([1, 5])

