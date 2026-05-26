#!/usr/bin/env python3

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

WHITE = (255, 255, 255, 255)
DARK_TEXT = (41, 45, 50, 255)


def _quote_applescript_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _create_alias(dest: Path, original: Path) -> None:
    script = textwrap.dedent(
        f"""
        set originalRef to POSIX file "{_quote_applescript_string(original.as_posix())}"
        set destRef to POSIX file "{_quote_applescript_string(dest.parent.as_posix())}"
        tell application "Finder"
            set newAlias to make new alias to originalRef at destRef
            set name of newAlias to "{_quote_applescript_string(dest.name)}"
        end tell
        """
    )
    subprocess.run(["osascript", "-e", script], check=True)
    if not dest.exists():
        raise SystemExit(f"Failed to create Applications alias at {dest}")


def _copy_icns(src: Path, dest: Path) -> None:
    if src.exists():
        shutil.copy2(src, dest)
        return

    if not shutil.which("sips"):
        raise SystemExit(f"Missing source icon and sips is unavailable: {src}")

    parent = src.parent
    candidates = [
        parent / "appicon.png",
        parent.parent / "appicon.png",
        parent.parent.parent / "appicon.png",
        parent.parent.parent.parent / "build" / "appicon.png",
        parent.parent.parent.parent / "build" / "darwin" / "icons.icns",
    ]
    fallback = next((path for path in candidates if path.exists()), None)
    if fallback is None:
        raise SystemExit(f"Missing source icon and no usable fallback found near {src}")

    if fallback.suffix.lower() == ".icns":
        shutil.copy2(fallback, dest)
        return

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "icon_1024.png"
        subprocess.run(
            ["sips", "-s", "format", "png", str(fallback), "--out", str(out)],
            check=True,
        )
        subprocess.run(
            ["sips", "-s", "format", "icns", str(out), "--out", str(dest)],
            check=True,
        )


def _make_background_image(dest: Path, app_icon: Path, volume_name: str = "CCX Desktop") -> None:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    if not app_icon.exists():
        app_icon = Path(__file__).resolve().parent.parent / "appicon.png"

    width, height = 600, 400
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((46, 98, 270, 302), radius=26, fill=(255, 255, 255, 55))
    draw.rounded_rectangle((330, 98, 554, 302), radius=26, fill=(255, 255, 255, 55))

    app_img = Image.open(app_icon).convert("RGBA")
    app_size = 200
    app_img = app_img.resize((app_size, app_size), Image.Resampling.LANCZOS)

    app_x, app_y = 158 - app_size // 2, 195 - app_size // 2
    shadow = Image.new("RGBA", (app_size + 20, app_size + 20), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((10, 16, 10 + app_size + 8, 16 + app_size + 8), radius=32, fill=(0, 0, 0, 48))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(shadow, (app_x - 10, app_y - 4))
    img.alpha_composite(app_img, (app_x, app_y))

    folder_img = Image.new("RGBA", (app_size, app_size), (0, 0, 0, 0))
    folder_draw = ImageDraw.Draw(folder_img)
    folder_draw.rounded_rectangle((12, 28, app_size - 12, app_size - 12), radius=28, fill=(34, 197, 94, 255))
    folder_draw.polygon(((18, 28), (72, 28), (78, 14), (18, 14)), fill=(22, 163, 74, 255))
    folder_draw.rounded_rectangle((12, 28, app_size - 12, app_size - 12), radius=28, outline=(21, 128, 61, 255), width=3)

    try:
        font_path = "/System/Library/Fonts/SFNSRounded.ttf"
        font = ImageFont.truetype(font_path, 98) if Path(font_path).exists() else ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 110)
    except Exception:
        font = ImageFont.load_default(size=92)

    bbox = font.getbbox("A")
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    folder_draw.text(
        ((app_size - text_w) // 2, (app_size - text_h) // 2 - 6),
        "A",
        font=font,
        fill=WHITE,
        stroke_width=4,
        stroke_fill=DARK_TEXT,
    )

    folder_x, folder_y = 442 - app_size // 2, 195 - app_size // 2
    folder_shadow = Image.new("RGBA", (app_size + 20, app_size + 20), (0, 0, 0, 0))
    ImageDraw.Draw(folder_shadow).rounded_rectangle((10, 16, 10 + app_size + 8, 16 + app_size + 8), radius=32, fill=(0, 0, 0, 48))
    folder_shadow = folder_shadow.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(folder_shadow, (folder_x - 10, folder_y - 4))
    img.alpha_composite(folder_img, (folder_x, folder_y))

    arrow = Image.new("RGBA", (120, 24), (0, 0, 0, 0))
    arrow_draw = ImageDraw.Draw(arrow)
    arrow_draw.rounded_rectangle((0, 4, 104, 20), radius=10, fill=(255, 255, 255, 210))
    arrow_draw.polygon(((100, 0), (120, 12), (100, 24)), fill=(255, 255, 255, 210))
    img.alpha_composite(arrow, (240, 188))

    try:
        label_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
    except Exception:
        label_font = ImageFont.load_default(size=22)

    app_label = volume_name
    app_bbox = label_font.getbbox(app_label)
    app_label_w = app_bbox[2] - app_bbox[0]
    draw.text(((308 - app_label_w) // 2 + 36, 316), app_label, font=label_font, fill=DARK_TEXT)

    applications_label = "Applications"
    applications_bbox = label_font.getbbox(applications_label)
    applications_label_w = applications_bbox[2] - applications_bbox[0]
    draw.text(((608 - applications_label_w) // 2 + 36, 316), applications_label, font=label_font, fill=DARK_TEXT)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="PNG")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pack a macOS .app into a Finder-styled DMG.")
    parser.add_argument("--dmg", required=True, help="Output .dmg path.")
    parser.add_argument("--app", required=True, help="Path to the .app bundle.")
    parser.add_argument("--volume-name", default="CCX Desktop", help="Volume name shown when DMG is mounted.")
    parser.add_argument("--background", help="Optional DMG background image path.")
    parser.add_argument("--volume-icon", help="Optional volume icon path.")
    parser.add_argument("--window-size", default="600,400", help="Window width,height.")
    parser.add_argument("--app-icon-size", type=int, default=96, help="Primary icon size for the Finder window.")
    parser.add_argument("--applications-icon-size", type=int, default=96, help="Legacy option; kept for CLI compatibility but Finder applies the window-wide icon size.")
    parser.add_argument("--app-position", default="150,190", help="App icon position x,y.")
    parser.add_argument("--applications-position", default="450,190", help="Applications alias position x,y.")
    parser.add_argument("--applications-alias", help="Path for temporary Applications alias.")
    parser.add_argument("--applications-name", default="Applications", help="Applications alias display name.")
    parser.add_argument("--cleanup", action="store_true", default=True, help="Remove temporary Applications alias after DMG creation.")
    parser.add_argument("--no-cleanup", action="store_false", dest="cleanup", help="Keep temporary Applications alias after DMG creation.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    app_path = Path(args.app).resolve()
    dmg_path = Path(args.dmg).resolve()
    background = Path(args.background).resolve() if args.background else None
    volume_icon = Path(args.volume_icon).resolve() if args.volume_icon else None
    work_root = Path(tempfile.mkdtemp(prefix="ccx-dmg-"))
    work = work_root / "image"
    work.mkdir()
    mounted = None
    alias_path = Path(args.applications_alias).resolve() if args.applications_alias else None
    created_alias = False

    try:
        if not app_path.exists():
            raise SystemExit(f"App not found: {app_path}")

        app_name = app_path.name
        display_app = work / app_name
        shutil.copytree(app_path, display_app)

        display_name = args.volume_name or app_name
        alias_path = alias_path or (work / "Applications")
        alias_path.unlink(missing_ok=True)

        _create_alias(alias_path, Path("/Applications"))
        created_alias = True

        if background is None:
            auto_bg = work / "dmg-background.png"
            app_icon = app_path.parent / "Resources" / "appicon.icns"
            if not app_icon.exists():
                app_icon = app_path.parent.parent.parent.parent / "build" / "appicon.png"
            _make_background_image(auto_bg, app_icon, volume_name=display_name)
            background = auto_bg

        dmg_path.parent.mkdir(parents=True, exist_ok=True)
        if dmg_path.exists():
            dmg_path.unlink()

        width, height = map(int, args.window_size.split(","))
        app_x, app_y = map(int, args.app_position.split(",")) if args.app_position else (150, 190)
        applications_x, applications_y = map(int, args.applications_position.split(",")) if args.applications_position else (450, 190)

        scratch_dmg = Path(str(dmg_path) + ".scratch.dmg")
        subprocess.run(
            [
                "hdiutil",
                "create",
                "-srcfolder",
                str(work),
                "-volname",
                display_name,
                "-fs",
                "HFS+",
                "-fsargs",
                "-c c=64,a=16,e=16",
                "-format",
                "UDRW",
                str(scratch_dmg),
            ],
            check=True,
        )

        mount_point = Path(tempfile.mkdtemp(prefix="ccx-dmg-mount-"))
        subprocess.run(
            [
                "hdiutil",
                "attach",
                str(scratch_dmg),
                "-mountpoint",
                str(mount_point),
                "-nobrowse",
                "-noverify",
                "-noautoopen",
            ],
            check=True,
        )
        mounted = mount_point

        if volume_icon and volume_icon.exists():
            icon_dest = mount_point / ".VolumeIcon.icns"
            shutil.copy2(volume_icon, icon_dest)

        if background and background.exists():
            background_dest = mount_point / ".background"
            background_dest.mkdir(exist_ok=True)
            shutil.copy2(background, background_dest / "background.png")

        background_picture_line = (
            "    set background picture of viewOptions to POSIX file \""
            + str((mount_point / ".background" / "background.png").as_posix())
            + "\""
            if (background and background.exists())
            else ""
        )
        base_script = [
            'tell application "Finder"',
            "    set dg to POSIX file \"" + str(mount_point.as_posix()) + "\" as alias",
            "    open dg",
            "    set current view of front window to icon view",
            "    set toolbar visible of front window to false",
            "    set statusbar visible of front window to false",
            "    set the bounds of front window to {100, 100, " + str(100 + width) + ", " + str(100 + height) + "}",
            "    set viewOptions to the icon view options of front window",
            "    set arrangement of viewOptions to not arranged",
            "    set icon size of viewOptions to " + str(args.app_icon_size),
        ]
        if background_picture_line:
            base_script.append(background_picture_line)
        base_script.append("end tell")
        subprocess.run(["osascript", "-e", "\n".join(base_script)], check=True)

        position_script = [
            'tell application "Finder"',
            "    set dg to POSIX file \"" + str(mount_point.as_posix()) + "\" as alias",
            "    set position of item \"" + app_path.name + "\" of front window to {" + str(app_x) + ", " + str(app_y) + "}",
            "    set position of item \"Applications\" of front window to {" + str(applications_x) + ", " + str(applications_y) + "}",
            "end tell",
        ]
        subprocess.run(["osascript", "-e", "\n".join(position_script)], check=True)

        refresh_script = [
            'tell application "Finder"',
            "    set dg to POSIX file \"" + str(mount_point.as_posix()) + "\" as alias",
            "    open dg",
            "    delay 2",
            "end tell",
        ]
        subprocess.run(["osascript", "-e", "\n".join(refresh_script)], check=True)

        subprocess.run(["sync"], check=False)
        subprocess.run(["hdiutil", "detach", str(mount_point), "-force"], check=False)
        mounted = None

        subprocess.run(
            [
                "hdiutil",
                "convert",
                str(scratch_dmg),
                "-format",
                "UDZO",
                "-imagekey",
                "zlib-level=9",
                "-o",
                str(dmg_path),
            ],
            check=True,
        )
        scratch_dmg.unlink(missing_ok=True)
        return 0
    except BaseException as exc:
        if mounted is not None:
            subprocess.run(["hdiutil", "detach", str(mounted), "-force"], check=False)
        raise
    finally:
        if created_alias and alias_path is not None and alias_path.exists() and args.cleanup:
            alias_path.unlink(missing_ok=True)
        shutil.rmtree(work_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
