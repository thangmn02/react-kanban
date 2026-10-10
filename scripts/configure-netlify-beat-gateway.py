"""Configure server-only preview gateway values without echoing credentials."""
import argparse
import json
from pathlib import Path
import runpy
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', required=True)
    parser.add_argument('--context', default='deploy-preview', choices=('deploy-preview', 'branch-deploy', 'production'))
    args = parser.parse_args()
    values = runpy.run_path(str(ROOT / 'scripts/configure-modal-beat-analysis.py'))['credentials']()
    values.pop('SUPABASE_ANON_KEY', None)  # Existing public frontend config remains unchanged.
    values.update({'BEAT_EVENT_CACHE_BACKEND': 'supabase',
                   'BEAT_ANALYSIS_URL': 'https://thangma999--kora-beat-analysis-enqueue.modal.run'})
    for name, value in values.items():
        command = ['npx.cmd', '--yes', 'netlify-cli', 'env:set', name, value, '--site', args.site,
                   '--scope', 'functions', '--context', args.context, '--force']
        if name in ('SUPABASE_SERVICE_ROLE_KEY', 'BEAT_ANALYSIS_KEY'):
            command.append('--secret')
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=90)
        if result.returncode:
            raise RuntimeError('Gateway configuration failed for ' + name + '; credential-bearing output withheld')
    print(json.dumps({'configured': True, 'context': args.context, 'scope': 'functions', 'variables': sorted(values)}))


if __name__ == '__main__':
    main()
