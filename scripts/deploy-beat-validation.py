"""Deploy an already-built private configuration without printing secrets."""
import argparse
import json
from pathlib import Path
import runpy
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', required=True)
    args = parser.parse_args()
    values = runpy.run_path(str(ROOT / 'scripts/configure-modal-beat-analysis.py'))['credentials']()
    values.update({'BEAT_EVENT_CACHE_BACKEND': 'supabase',
                   'BEAT_ANALYSIS_URL': 'https://thangma999--kora-beat-analysis-enqueue.modal.run'})
    command = ['npx.cmd', '--yes', 'netlify-cli', 'deploy', '--site', args.site, '--dir', 'dist',
               '--functions', 'netlify/functions', '--no-build', '--json', '--message', 'Beat range cache validation']
    for name, value in values.items():
        command.extend(['--secret-env' if name in ('SUPABASE_SERVICE_ROLE_KEY', 'BEAT_ANALYSIS_KEY') else '--env', name + '=' + value])
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=600)
    if result.returncode:
        # CLI output can echo configured values. Keep only an explicit safe
        # status in the operator-facing error rather than forwarding that log.
        raise RuntimeError('Validation draft deployment failed; credential-bearing output withheld')
    decoder = json.JSONDecoder()
    for index, character in enumerate(result.stdout):
        if character != '{':
            continue
        try:
            data, _ = decoder.raw_decode(result.stdout[index:])
        except ValueError:
            continue
        if isinstance(data, dict) and data.get('deploy_url'):
            record = {key: data[key] for key in ('deploy_id', 'deploy_url', 'deploy_ssl_url') if key in data}
            (ROOT / 'src-tauri/target/netlify-beat-validation.json').write_text(json.dumps(record))
            print(json.dumps(record))
            return
    raise RuntimeError('Draft uploaded, but deployment URL could not be resolved from safe metadata')


if __name__ == '__main__':
    main()
