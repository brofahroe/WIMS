from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "WIMS V1_GCI-EJ-EMR-MALANG.xlsm"
OUT_DIR = ROOT / ".codex_tmp" / "vba"
PYDEPS = ROOT / ".codex_tmp" / "pydeps"

sys.path.insert(0, str(PYDEPS))

from oletools.olevba import VBA_Parser  # noqa: E402


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    parser = VBA_Parser(str(WORKBOOK))
    modules = []
    for filename, stream_path, vba_filename, vba_code in parser.extract_macros():
        safe_name = vba_filename.replace("\\", "_").replace("/", "_").replace(":", "_")
        if not safe_name.lower().endswith((".bas", ".cls", ".frm")):
            safe_name = f"{safe_name}.txt"
        out_path = OUT_DIR / safe_name
        out_path.write_text(vba_code, encoding="utf-8", errors="replace")
        modules.append(
            {
                "filename": filename,
                "stream_path": stream_path,
                "vba_filename": vba_filename,
                "output": str(out_path.relative_to(ROOT)),
                "chars": len(vba_code),
                "lines": len(vba_code.splitlines()),
            }
        )
    parser.close()
    summary_path = OUT_DIR / "summary.json"
    summary_path.write_text(json.dumps(modules, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Extracted {len(modules)} VBA modules to {OUT_DIR}")
    for module in modules:
        print(f"- {module['vba_filename']}: {module['lines']} lines")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
