import json
import shutil
import subprocess
import sys
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent
UPDATE_SCRIPTS = [
    "chaos/update-latest-chaos.mjs",
    "fiction/update-latest-fiction.mjs",
    "shadow/update-latest-shadow.mjs",
    "arbitration/update-latest-arbitration.mjs",
    "monster/update-monsters.mjs",
    "catalog/update-character-lightcone-relic.mjs",
    "achievement/update-achievements.mjs",
    "item/update-items.mjs",
    "home/update-home-featured.mjs",
]


def read_site_version():
    home_data_path = PROJECT_ROOT / "data" / "home" / "home.json"
    if not home_data_path.exists():
        return "未知版本"

    data = json.loads(home_data_path.read_text(encoding="utf-8"))
    home_data = data.get("homeData", {})
    version = home_data.get("siteVersion") or home_data.get("featured", {}).get("version")
    if version:
        return version

    return "未知版本"


def run_script(node_path, script_name, extra_args):
    script_path = TOOLS_DIR / script_name
    command = [node_path, str(script_path), *extra_args]

    print("=" * 72, flush=True)
    print(f"运行：{script_name}", flush=True)
    print("=" * 72, flush=True)

    return subprocess.run(command, cwd=PROJECT_ROOT)


def main():
    node_path = shutil.which("node")
    if not node_path:
        print("没有找到 node，请先安装 Node.js，或者把 node 加入 PATH。", flush=True)
        return 1

    extra_args = sys.argv[1:]
    failed_scripts = []

    for script_name in UPDATE_SCRIPTS:
        result = run_script(node_path, script_name, extra_args)
        if result.returncode != 0:
            failed_scripts.append(script_name)

    print("=" * 72, flush=True)
    if failed_scripts:
        print("更新脚本执行失败：", flush=True)
        for script_name in failed_scripts:
            print(f"- {script_name}", flush=True)
        status_code = 1
    else:
        print(f"更新脚本已经完成，网站已更新至{read_site_version()}", flush=True)
        status_code = 0

    if sys.stdin.isatty():
        try:
            input("按回车退出...")
        except EOFError:
            pass

    return status_code


if __name__ == "__main__":
    raise SystemExit(main())
