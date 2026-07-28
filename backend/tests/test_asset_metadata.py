from routers.assets import AssetCreate


def test_asset_create_accepts_editable_ui_layout_metadata():
    metadata = {
        "kind": "ui_component_layout",
        "version": 1,
        "ratio": "16:9",
        "components": [{"id": "one", "shape": "circle"}],
    }

    payload = AssetCreate(
        project_id="00000000-0000-0000-0000-000000000001",
        name="UI reference",
        type="ui",
        url="/uploads/reference.png",
        metadata=metadata,
    )

    assert payload.metadata == metadata

