"""Identify ordinary Markdown and editor-workspace changes from a verified GitHub checkout.
Anything outside that scope continues through the repository's existing quality checks.
"""
import json
import os
from pathlib import Path
import re
import subprocess

SHA = re.compile(r'[0-9a-f]{40}')


def git(*args):
    return subprocess.check_output(['git', *args], stderr=subprocess.DEVNULL)


def checkout_base(sha, event, ref, repository, data):
    if not SHA.fullmatch(sha) or git('rev-parse', 'HEAD').decode().strip() != sha:
        return None
    if event == 'pull_request':
        pr = data['pull_request']
        base, head = pr['base'], pr['head']
        if (ref != f"refs/pull/{data['number']}/merge" or base['ref'] != 'main'
                or not all(branch['repo']['full_name'] == repository for branch in (base, head))
                or not all(SHA.fullmatch(branch['sha']) for branch in (base, head))):
            return None
        parents = git('rev-list', '--parents', '-n', '1', sha).decode().split()
        return base['sha'] if parents == [sha, base['sha'], head['sha']] else None
    if event == 'push' and ref == 'refs/heads/main' and data.get('after') == sha:
        base = data.get('before', '')
        if SHA.fullmatch(base) and base != '0' * 40:
            git('merge-base', '--is-ancestor', base, sha)
            return base
    return None


def housekeeping(base, sha, workspace=None):
    if not base:
        return False
    fields = git('diff', '--raw', '-z', '--no-renames', base, sha, '--').split(b'\0')
    fields.pop()
    if not fields or len(fields) % 2:
        return False
    for metadata, path in zip(fields[::2], fields[1::2]):
        old, new, _, _, change = metadata.decode().split()
        if (old, new, change) not in {
            (':000000', '100644', 'A'), (':100644', '100644', 'M')
        }:
            return False
        name = path.decode()
        if name == workspace:
            config = json.loads(git('show', f'{sha}:{name}'))
            if not isinstance(config, dict) or set(config) != {'folders'}:
                return False
            folders = config['folders']
            if not isinstance(folders, list) or not folders or not all(
                isinstance(folder, dict) and set(folder) <= {'name', 'path'}
                and isinstance(folder.get('path'), str) and bool(folder['path'])
                and all(isinstance(value, str) for value in folder.values())
                for folder in folders
            ):
                return False
            continue
        if name not in {'README.md', 'CONTRIBUTING.md'} and not (
            name.startswith('docs/') and name.endswith('.md')
        ):
            return False
    return True


def main():
    env = os.environ
    scope = 'runtime'
    try:
        sha = env['GITHUB_SHA']
        base = checkout_base(sha, env['GITHUB_EVENT_NAME'], env['GITHUB_REF'],
                             env['GITHUB_REPOSITORY'], json.loads(Path(env['GITHUB_EVENT_PATH']).read_text()))
        if housekeeping(base, sha, env.get('CI_EDITOR_WORKSPACE')):
            scope = 'housekeeping'
    except (KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError):
        pass
    print(f'CI scope: {scope}')
    with open(env['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'scope={scope}\n')


if __name__ == '__main__':
    main()
