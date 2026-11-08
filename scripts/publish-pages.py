"""Validate and publish dist/ to the existing gh-pages branch with a normal push."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent

def run(*args, cwd=root):
    return subprocess.run(args, cwd=cwd, check=True)

run('node', 'scripts/check.mjs')
run('node', '--test', *map(str, sorted((root / 'tests').glob('*.test.cjs'))))
remote = subprocess.check_output(['git', 'remote', 'get-url', 'origin'], cwd=root, text=True).strip()
with tempfile.TemporaryDirectory(prefix='susto-pages-') as folder:
    checkout = Path(folder) / 'pages'
    run('git', 'clone', '--single-branch', '--branch', 'gh-pages', remote, str(checkout))
    for item in checkout.iterdir():
        if item.name != '.git':
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(root / 'dist', checkout, dirs_exist_ok=True)
    run('git', 'add', '--all', cwd=checkout)
    changed = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=checkout).returncode
    if changed == 1:
        run('git', 'commit', '-m', 'chore: atualize página pública', cwd=checkout)
        run('git', 'push', 'origin', 'gh-pages', cwd=checkout)
    elif changed != 0:
        raise SystemExit(changed)
    else:
        print('A página já está atualizada.')
