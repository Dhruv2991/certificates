#!/usr/bin/env python3
"""
TeamCodeLocked & BitByBit Certificate Generator
-----------------------------------------------
Bulk generates orientation certificates for both Participants and Volunteers
using dedicated templates, pandas, and Pillow (PIL).

- Participant Template: 'template_participant.png' (or '2.png') -> IDs: PAR-001, PAR-002, ...
- Volunteer Template: 'template_volunteer.png' -> IDs: VOL-001, VOL-002, ...
- Output: '/public/certificates/{id}.png'
- Database: '/public/certificates.json', root 'certificates.json', and 'src/data/'
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    import pandas as pd
except ImportError:
    print("Error: pandas is required. Run: pip install pandas openpyxl")
    sys.exit(1)

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is required. Run: pip install Pillow")
    sys.exit(1)


def find_system_font(font_names: List[str]) -> Optional[str]:
    """Find system font across OS distributions."""
    search_dirs = []
    if sys.platform.startswith("win"):
        win_dir = os.environ.get("WINDIR", r"C:\Windows")
        search_dirs.append(Path(win_dir) / "Fonts")
    elif sys.platform.startswith("darwin"):
        search_dirs.extend([
            Path("/Library/Fonts"),
            Path("/System/Library/Fonts"),
            Path.home() / "Library/Fonts"
        ])
    else:
        search_dirs.extend([
            Path("/usr/share/fonts"),
            Path("/usr/local/share/fonts"),
            Path.home() / ".fonts"
        ])

    for font_name in font_names:
        for font_dir in search_dirs:
            if not font_dir.exists():
                continue
            candidate = font_dir / font_name
            if candidate.exists():
                return str(candidate)
            for found in font_dir.rglob(font_name):
                if found.is_file():
                    return str(found)
    return None


def clean_name(raw_name: Any) -> str:
    """Strips square brackets, braces, and excess whitespace."""
    if raw_name is None:
        return ""
    s = str(raw_name).strip()
    for b_start, b_end in [("[", "]"), ("{", "}"), ("<", ">")]:
        if s.startswith(b_start) and s.endswith(b_end):
            s = s[1:-1].strip()
    s = s.replace("[", "").replace("]", "").strip()
    return s


def clean_email(raw_email: Any) -> str:
    """Normalize email string."""
    if raw_email is None:
        return ""
    return str(raw_email).strip().lower()


def load_sheet_entries(file_path: Path) -> List[Dict[str, str]]:
    """Loads Name and Email from Excel or CSV with no header."""
    if not file_path.exists():
        return []

    ext = file_path.suffix.lower()
    if ext in [".xlsx", ".xls"]:
        df = pd.read_excel(file_path, header=None)
    elif ext == ".csv":
        df = pd.read_csv(file_path, header=None)
    else:
        return []

    # Check if first row is header
    first_0 = str(df.iloc[0, 0]).strip().lower() if df.shape[1] > 0 else ""
    first_1 = str(df.iloc[0, 1]).strip().lower() if df.shape[1] > 1 else ""
    start_row = 1 if ("name" in first_0 or "email" in first_1) else 0

    entries = []
    for idx in range(start_row, len(df)):
        name_val = df.iloc[idx, 0] if df.shape[1] > 0 else None
        email_val = df.iloc[idx, 1] if df.shape[1] > 1 else None

        c_name = clean_name(name_val)
        c_email = clean_email(email_val)

        if not c_name or c_name.lower() in ["nan", "none"]:
            continue

        entries.append({"name": c_name, "email": c_email})

    return entries


def render_certificate_image(
    template_path: Path,
    recipient_name: str,
    output_path: Path,
    font_path: Optional[str] = None,
    name_x: int = 263,
    name_y: int = 745,
    font_size: int = 90
):
    """
    Cleans placeholder from template and writes clean name.
    """
    img = Image.open(template_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # 1. Clear [RECIPIENT NAME] bounding box
    draw.rectangle([(250, 725), (1700, 865)], fill=(255, 255, 255))

    # 2. Load font
    try:
        if font_path and os.path.exists(font_path):
            font = ImageFont.truetype(font_path, font_size)
        else:
            font = ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    # 3. Draw clean name strictly without brackets
    draw.text((name_x, name_y), recipient_name, font=font, fill=(17, 24, 39))

    # 4. Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(output_path), format="PNG", optimize=True)


def generate_all(
    participants_file: Path,
    volunteers_file: Path,
    participant_template: Path,
    volunteer_template: Path,
    output_dir: Path,
    json_paths: List[Path]
):
    output_dir.mkdir(parents=True, exist_ok=True)

    font_path = find_system_font([
        "segoeuib.ttf",
        "arialbd.ttf",
        "calibrib.ttf",
        "HelveticaBold.ttf",
        "DejaVuSans-Bold.ttf"
    ])

    all_records = []

    # 1. Process Participants
    print(f"--- Processing Participants ({participants_file.name}) ---")
    participants = load_sheet_entries(participants_file)
    print(f"Loaded {len(participants)} participants.")

    for i, p in enumerate(participants, start=1):
        cert_id = f"PAR-{i:03d}"
        out_filename = f"{cert_id}.png"
        out_path = output_dir / out_filename

        render_certificate_image(
            template_path=participant_template,
            recipient_name=p["name"],
            output_path=out_path,
            font_path=font_path
        )

        all_records.append({
            "id": cert_id,
            "name": p["name"],
            "email": p["email"],
            "type": "participant",
            "fileUrl": f"/certificates/{out_filename}",
            "certificateUrl": f"/certificates/{out_filename}",
            "filename": out_filename,
            "organization": "TeamCodeLocked",
            "college": "B.M.S. College of Engineering",
            "event": "Club Orientation 2026",
            "partner": "BitByBit",
            "partnerUrl": "https://bitbybit-9h8e.vercel.app"
        })

    # 2. Process Volunteers
    print(f"\n--- Processing Volunteers ({volunteers_file.name}) ---")
    volunteers = load_sheet_entries(volunteers_file)
    print(f"Loaded {len(volunteers)} volunteers.")

    for i, v in enumerate(volunteers, start=1):
        cert_id = f"VOL-{i:03d}"
        out_filename = f"{cert_id}.png"
        out_path = output_dir / out_filename

        render_certificate_image(
            template_path=volunteer_template,
            recipient_name=v["name"],
            output_path=out_path,
            font_path=font_path
        )

        all_records.append({
            "id": cert_id,
            "name": v["name"],
            "email": v["email"],
            "type": "volunteer",
            "fileUrl": f"/certificates/{out_filename}",
            "certificateUrl": f"/certificates/{out_filename}",
            "filename": out_filename,
            "organization": "TeamCodeLocked",
            "college": "B.M.S. College of Engineering",
            "event": "Club Orientation 2026",
            "partner": "BitByBit",
            "partnerUrl": "https://bitbybit-9h8e.vercel.app"
        })

    # 3. Save JSON Indexes
    for jp in json_paths:
        jp.parent.mkdir(parents=True, exist_ok=True)
        with open(jp, "w", encoding="utf-8") as f:
            json.dump(all_records, f, indent=2, ensure_ascii=False)
        print(f"Saved index database: {jp}")

    print(f"\n[SUCCESS] Generated {len(all_records)} total certificates ({len(participants)} Participants + {len(volunteers)} Volunteers)!")


def main():
    project_root = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(description="TeamCodeLocked Certificate Generator")
    parser.add_argument("--participants", default="Attendance Sheet Participants .xlsx")
    parser.add_argument("--volunteers", default="volunteers.xlsx")
    parser.add_argument("--part-template", default="template_participant.png")
    parser.add_argument("--vol-template", default="template_volunteer.png")
    parser.add_argument("--output-dir", default="public/certificates")
    parser.add_argument("--single", action="store_true", help="Generate a single certificate")
    parser.add_argument("--name", type=str, help="Recipient name for single generation")
    parser.add_argument("--id", type=str, help="Recipient ID for single generation")
    parser.add_argument("--type", choices=["participant", "volunteer"], default="participant", help="Certificate type")

    args = parser.parse_args()

    part_template = project_root / args.part_template
    if not part_template.exists():
        part_template = project_root / "2.png"

    vol_template = project_root / args.vol_template
    if not vol_template.exists():
        vol_template = project_root / "Volunteer 2.png"

    output_dir = (project_root / args.output_dir).resolve()

    if args.single:
        if not args.name or not args.id:
            print("Error: --name and --id are required for --single mode")
            sys.exit(1)
        
        target_template = vol_template if args.type == "volunteer" else part_template
        font_path = find_system_font([
            "segoeuib.ttf", "arialbd.ttf", "calibrib.ttf", "HelveticaBold.ttf", "DejaVuSans-Bold.ttf"
        ])
        out_file = output_dir / f"{args.id}.png"
        render_certificate_image(
            template_path=target_template,
            recipient_name=clean_name(args.name),
            output_path=out_file,
            font_path=font_path
        )
        print(f"[SUCCESS] Single certificate generated: {out_file}")
        sys.exit(0)

    # Bulk mode
    participants_path = project_root / args.participants
    if not participants_path.exists():
        participants_path = project_root / "Attendance Sheet Participants .xlsx"

    volunteers_path = project_root / args.volunteers
    if not volunteers_path.exists():
        volunteers_path = project_root / "volunteers.csv"

    json_paths = [
        project_root / "public" / "certificates.json",
        project_root / "certificates.json",
        project_root / "src" / "data" / "certificates.json"
    ]

    generate_all(
        participants_file=participants_path,
        volunteers_file=volunteers_path,
        participant_template=part_template,
        volunteer_template=vol_template,
        output_dir=output_dir,
        json_paths=json_paths
    )


if __name__ == "__main__":
    main()
