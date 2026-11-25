"""Exercise CI scoping with real Git histories and unsupported path changes.
The fixtures run without GitHub credentials or product dependencies.
"""
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import ci_change_scope as scope


class ChangeScopeTests(unittest.TestCase):
    def setUp(self):
        folder = TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'ci@example.test')
        self.git('config', 'user.name', 'CI')
        self.base = self.commit('README.md')
        self.mock = patch.object(scope, 'git', side_effect=self.git)
        self.mock.start()
        self.addCleanup(self.mock.stop)

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args])

    def commit(self, name):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('Edited documentation\n')
        return self.commit_changes()

    def commit_changes(self):
        self.git('add', '-A')
        self.git('commit', '-qm', 'Fixture change')
        return self.git('rev-parse', 'HEAD').decode().strip()

    def test_push_checks_exact_head_and_classifies_markdown(self):
        head = self.commit('docs/guide.md')
        data = {'before': self.base, 'after': head}
        base = scope.checkout_base(head, 'push', 'refs/heads/main', 'owner/repo', data)
        self.assertEqual(base, self.base)
        self.assertTrue(scope.housekeeping(base, head))
        self.assertIsNone(scope.checkout_base(self.base, 'push', 'refs/heads/main', 'owner/repo', data))
        self.assertIsNone(scope.checkout_base(head, 'workflow_dispatch', 'refs/heads/main', 'owner/repo', data))

    def test_mixed_diff_requires_runtime(self):
        self.commit('docs/guide.md')
        head = self.commit('src/auth.ts')
        self.assertFalse(scope.housekeeping(self.base, head))

    def test_workspace_path_must_be_explicit(self):
        file = self.root / 'Puck Buddy.code-workspace'
        file.write_text('{"folders": [{"path": "."}]}')
        head = self.commit_changes()
        self.assertFalse(scope.housekeeping(self.base, head))
        self.assertTrue(scope.housekeeping(self.base, head, file.name))
        file.write_text('{"folders": [{"path": "."}], "tasks": {}}')
        self.assertFalse(scope.housekeeping(head, self.commit_changes(), file.name))

    def test_mode_changes_and_deletions_require_runtime(self):
        os.chmod(self.root / 'README.md', 0o755)
        head = self.commit_changes()
        self.assertFalse(scope.housekeeping(self.base, head))
        (self.root / 'README.md').unlink()
        self.assertFalse(scope.housekeeping(head, self.commit_changes()))

    def test_pr_requires_verified_merge_parents_and_same_repository(self):
        self.git('checkout', '-qb', 'change')
        head = self.commit('docs/guide.md')
        self.git('checkout', '-qb', 'target', self.base)
        self.git('merge', '--no-ff', '-qm', 'Integration', head)
        sha = self.git('rev-parse', 'HEAD').decode().strip()
        repo = {'full_name': 'owner/repo'}
        data = {'number': 42, 'pull_request': {
            'base': {'repo': repo, 'ref': 'main', 'sha': self.base},
            'head': {'repo': repo, 'sha': head},
        }}
        args = (sha, 'pull_request', 'refs/pull/42/merge', 'owner/repo', data)
        self.assertEqual(scope.checkout_base(*args), self.base)
        data['pull_request']['head']['repo'] = {'full_name': 'other/repo'}
        self.assertIsNone(scope.checkout_base(*args))


if __name__ == '__main__':
    unittest.main()
