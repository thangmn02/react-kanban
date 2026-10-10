"""Deploy only the protected, original-audio test site. No analysis or app deploy."""
import argparse
import ast
import hashlib
import json
import secrets
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'src-tauri/target/lead-cache-replay'
PACKAGE = WORK / 'netlify-test-site'
STATE = WORK / 'protected-test-site.json'
PRODUCTION = '0c8406d3-9d2e-4afd-8351-140813bfbaf9'
ACCOUNT = '68a241a9295253dd46a2e2b9'
TEAM = 'thangmn02'
NAME = 'kora-lead-audio-test-thangmn02'
PRIVATE = Path.home() / 'KoraBackups/lead-development-runtime/audio-test-access.json.dpapi'
CLI_VERSION = '27.12.0'


def dpapi():
    source = ROOT / 'scripts/configure-modal-beat-analysis.py'
    tree = ast.parse(source.read_text())
    tree.body = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom))
                 and not any(a.name == 'modal' for a in n.names)
                 or isinstance(n, (ast.ClassDef, ast.FunctionDef)) and n.name in ('Blob', 'protected')]
    scope = {}
    exec(compile(tree, str(source), 'exec'), scope)
    return scope['protected']


def call(arguments, cwd=ROOT, timeout=120):
    result = subprocess.run(['npx.cmd', '--yes', 'netlify-cli@' + CLI_VERSION, *arguments],
                            cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    if result.returncode:
        # CLI diagnostics may include credentials; never persist or print them.
        labels = [label for label in ('Forbidden', 'Unauthorized', 'Unprocessable Entity', 'Conflict')
                  if label in result.stdout + result.stderr]
        raise RuntimeError('Netlify command failed; output withheld (' + arguments[0] + '; ' + ','.join(labels) + ')')
    decoder = json.JSONDecoder()
    for i, character in enumerate(result.stdout):
        if character not in '{[':
            continue
        try:
            data, _ = decoder.raw_decode(result.stdout[i:])
            return data
        except ValueError:
            continue
    raise RuntimeError('Netlify returned no parseable metadata')


def api(method, arguments=None):
    return call(['api', method, '--data', json.dumps(arguments or {})])


def save(state):
    STATE.write_text(json.dumps(state, indent=2))


def validate_compiled_edge(package):
    directory = package / '.netlify/edge-functions-dist'
    manifest_path = directory / 'manifest.json'
    proof_path = package / '.netlify/edge-build-proof.json'
    if not manifest_path.is_file() or not proof_path.is_file():
        raise RuntimeError('Compiled Edge artifacts and successful build proof required')
    manifest = json.loads(manifest_path.read_text())
    routes = manifest.get('routes', [])
    if (len(routes) != 1 or routes[0].get('function') != 'auth' or routes[0].get('path') != '/*'
            or routes[0].get('pattern') != '^(?:/(.*))/?$' or routes[0].get('excluded_patterns')
            or manifest.get('post_cache_routes') or manifest.get('function_config') != {'auth': {'on_error': 'fail'}}):
        raise RuntimeError('Compiled all-path fail-closed auth declaration missing or changed')
    bundles = manifest.get('bundles', [])
    if len(bundles) != 1 or bundles[0].get('format') != 'eszip2':
        raise RuntimeError('Unexpected or missing compiled Edge bundle')
    asset = bundles[0]['asset']
    if Path(asset).name != asset or not asset.endswith('.eszip'):
        raise RuntimeError('Invalid Edge bundle path')
    bundle = directory / asset
    digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
    if asset != digest + '.eszip':
        raise RuntimeError('Compiled Edge bundle integrity failed')
    proof = json.loads(proof_path.read_text())
    if proof.get('cliVersion') != CLI_VERSION or proof.get('bundleSha256') != digest:
        raise RuntimeError('Compiled Edge bundle does not match the validated build')
    if not {'netlify.toml', 'netlify/edge-functions/auth.js'}.issubset(proof.get('inputs', {})):
        raise RuntimeError('Edge build source and configuration proof missing')
    for relative, expected in proof['inputs'].items():
        target = (package / relative).resolve()
        if not target.is_relative_to(package.resolve()) or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Edge build input changed; rebuild before deploying')
    if proof.get('manifestSha256') != hashlib.sha256(manifest_path.read_bytes()).hexdigest():
        raise RuntimeError('Compiled Edge manifest changed')
    return {'bundleSha256': digest, 'bundleBytes': bundle.stat().st_size, 'route': '/*', 'onError': 'fail'}


def configure_access(site_id, digest):
    # The CLI applies plan-specific scope checks before the API; the API supports
    # explicit secret contexts. Use its existing native credential without logging it.
    config = json.loads((Path.home() / 'AppData/Roaming/netlify/Config/config.json').read_text())
    token = config['users'][config['userId']]['auth']['token']
    variables = [
        {'key': 'KORA_AUDIO_TEST_CREDENTIAL_SHA256', 'is_secret': True,
         'scopes': ['builds', 'functions', 'runtime'],
         'values': [{'context': 'production', 'value': digest}]},
        {'key': 'KORA_AUDIO_TEST_SITE_ID',
         'values': [{'context': 'all', 'value': site_id}]},
    ]
    base = 'https://api.netlify.com/api/v1/accounts/' + ACCOUNT + '/env'
    headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
    try:
        with urlopen(Request(base + '?site_id=' + site_id, headers=headers), timeout=30) as response:
            existing = {item['key'] for item in json.loads(response.read())}
        for variable in variables:
            exists = variable['key'] in existing
            url = base + ('/' + variable['key'] if exists else '') + '?site_id=' + site_id
            request = Request(url, data=json.dumps(variable if exists else [variable]).encode(),
                              headers=headers, method='PUT' if exists else 'POST')
            with urlopen(request, timeout=30) as response:
                response.read()
    except HTTPError as error:
        raise RuntimeError('Isolated environment configuration failed: HTTP ' + str(error.code)) from None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    if STATE.exists() and json.loads(STATE.read_text()).get('removedAfterProtectionFailure'):
        raise RuntimeError('Stopped after protection failure; rebuild and validate the Edge package before another deployment')
    manifest = json.loads((WORK / 'https-source/test-asset.json').read_text())
    asset = manifest['asset']['id']
    expected = {'index.html', '_headers', 'kora-lead-test/' + asset + '.wav'}
    actual = {p.relative_to(PACKAGE / 'public').as_posix() for p in (PACKAGE / 'public').rglob('*') if p.is_file()}
    if actual != expected or hashlib.sha256((PACKAGE / 'public/kora-lead-test' / (asset + '.wav')).read_bytes()).hexdigest() != asset:
        raise RuntimeError('Unexpected public file or changed audio identity')
    if (PACKAGE / 'netlify/edge-functions/auth.js').read_bytes() != (ROOT / 'scripts/lead-test-edge-auth.mjs').read_bytes():
        raise RuntimeError('Gate source does not match tested implementation')
    before = api('getSite', {'site_id': PRODUCTION})
    production_fields = ('name', 'account_id', 'build_settings', 'custom_domain', 'deploy_id', 'sso_login', 'has_password')
    snapshot = hashlib.sha256(json.dumps({k: before.get(k) for k in production_fields}, sort_keys=True).encode()).hexdigest()
    if STATE.exists():
        state = json.loads(STATE.read_text())
        site = api('getSite', {'site_id': state['siteId']})
    else:
        existing = api('listSites')
        if any(s.get('name') == NAME for s in existing):
            raise RuntimeError('Named project exists without this task ownership record; refusing to modify it')
        site = api('createSiteInTeam', {'account_slug': TEAM, 'body': {'name': NAME}})
        state = {'siteId': site['id'], 'name': NAME, 'accountId': ACCOUNT, 'asset': manifest['asset'],
                 'analysisVersion': manifest['analysisVersion'], 'productionBefore': snapshot, 'deployed': False,
                 'createdByTask': True}
        save(state)
    if (site['id'] != PRODUCTION and site.get('account_id') == ACCOUNT and state.get('createdByTask')
            and site.get('name') != NAME and not site.get('published_deploy')):
        site = api('updateSite', {'site_id': site['id'], 'body': {'name': NAME}})
    if site['id'] == PRODUCTION or site.get('name') != NAME or site.get('account_id') != ACCOUNT:
        raise RuntimeError('Isolated project guard failed')
    protected = dpapi()
    if PRIVATE.exists():
        credential = json.loads(protected(PRIVATE.read_bytes(), True))
        if credential.get('siteId') != site['id']:
            raise RuntimeError('Credential belongs to another site')
    else:
        if not PRIVATE.parent.is_dir():
            raise RuntimeError('Private development credential directory missing')
        credential = {'siteId': site['id'], 'username': 'kora-test', 'password': secrets.token_urlsafe(32)}
        PRIVATE.write_bytes(protected(json.dumps(credential).encode()))
    digest = hashlib.sha256((credential['username'] + ':' + credential['password']).encode()).hexdigest()
    configure_access(site['id'], digest)
    state['secretConfigured'] = True
    save(state)
    print(json.dumps({'createdIsolatedSite': site['id'], 'name': NAME, 'secretConfigured': True,
                      'credentialStorage': 'DPAPI CurrentUser', 'audioHashVerified': True}), flush=True)
    if args.prepare_only:
        return
    # Source presence alone did not guarantee that the CLI shipped the gate.
    # Require a compiled package before allowing any static audio upload.
    validate_compiled_edge(PACKAGE)
    deployment = call(['deploy', '--site', site['id'], '--dir', str(PACKAGE / 'public'),
                       '--functions', str(PACKAGE / 'no-functions'), '--no-build', '--cwd', str(PACKAGE),
                       '--prod', '--json', '--message', 'Protected original audio development test'], cwd=PACKAGE, timeout=600)
    after = api('getSite', {'site_id': site['id']})
    state.update({'deployed': True, 'deployId': deployment.get('deploy_id'), 'deployUrl': deployment.get('deploy_ssl_url') or deployment.get('deploy_url'),
                  'playerUrl': after.get('ssl_url'), 'siteIdDomain': after.get('id_domain'), 'customDomain': after.get('custom_domain')})
    production = api('getSite', {'site_id': PRODUCTION})
    check = hashlib.sha256(json.dumps({k: production.get(k) for k in production_fields}, sort_keys=True).encode()).hexdigest()
    state['productionUnchanged'] = check == snapshot
    save(state)
    if not state['productionUnchanged']:
        raise RuntimeError('Production metadata changed during verification; investigate without modifying it')
    print(json.dumps({k: state[k] for k in ('name', 'siteId', 'playerUrl', 'deployUrl', 'deployId', 'productionUnchanged')}))


if __name__ == '__main__':
    main()
