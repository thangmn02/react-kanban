"""Build, deploy and verify only harmless protected Edge probe assets."""
import argparse
import base64
import hashlib
import json
import runpy
import secrets
import subprocess
import tomllib
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
H = runpy.run_path(str(ROOT / 'scripts/deploy-lead-audio-test.py'))
WORK = H['WORK']
PACKAGE = WORK / 'netlify-edge-probe'
STATE = WORK / 'edge-probe-state.json'
PRIVATE = Path.home() / 'KoraBackups/lead-development-runtime/edge-probe-access.json.dpapi'
NAME = 'kora-edge-probe-thangmn02'
SENTINEL = b'KORA_PROTECTED_EDGE_PROBE_V1\n'


def package_inputs():
    paths = ['netlify.toml', 'validate-probe.mjs', 'gate/auth.mjs', 'netlify/edge-functions/auth.js',
             'public/index.html', 'public/probe.txt', 'public/probe.bin', 'public/_headers']
    return {p: hashlib.sha256((PACKAGE / p).read_bytes()).hexdigest() for p in paths}


def validate_probe():
    published = PACKAGE / 'public'
    if {p.relative_to(published).as_posix() for p in published.rglob('*') if p.is_file()} != {'index.html', '_headers', 'probe.txt', 'probe.bin'}:
        raise RuntimeError('Probe publish allowlist failed; no audio/player is permitted')
    if (published / 'probe.txt').read_bytes() != SENTINEL or (published / 'probe.bin').read_bytes() != bytes(range(256)) * 4:
        raise RuntimeError('Harmless probe identity mismatch')
    if (PACKAGE / 'gate/auth.mjs').read_bytes() != (ROOT / 'scripts/lead-test-edge-auth.mjs').read_bytes():
        raise RuntimeError('Probe auth does not match tested source')
    config = tomllib.loads((PACKAGE / 'netlify.toml').read_text())
    build = config['build']
    if (Path(build['base']).resolve() != PACKAGE.resolve() or build['publish'] != 'public'
            or build['edge_functions'] != 'netlify/edge-functions' or build['functions'] != 'no-functions'
            or build['command'] != 'node validate-probe.mjs' or set(config) != {'build'}):
        raise RuntimeError('Isolated build configuration changed')
    if '<audio' in (published / 'index.html').read_text().lower():
        raise RuntimeError('Audio player is not allowed in this probe')


def build():
    validate_probe()
    result = subprocess.run(['npx.cmd', '--yes', 'netlify-cli@' + H['CLI_VERSION'], 'build', '--offline',
                             '--context', 'production', '--cwd', str(PACKAGE)], cwd=PACKAGE,
                            capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    if result.returncode:
        raise RuntimeError('Local Edge build failed; diagnostic output withheld')
    path = PACKAGE / '.netlify/edge-functions-dist/manifest.json'
    manifest = json.loads(path.read_text())
    bundle = path.parent / manifest['bundles'][0]['asset']
    proof = {'cliVersion': H['CLI_VERSION'], 'inputs': package_inputs(),
             'bundleSha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
             'manifestSha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    (PACKAGE / '.netlify/edge-build-proof.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps({'built': True, **H['validate_compiled_edge'](PACKAGE)}))


def production_fingerprint():
    site = H['api']('getSite', {'site_id': H['PRODUCTION']})
    fields = ('name', 'account_id', 'build_settings', 'custom_domain', 'deploy_id', 'sso_login', 'has_password')
    return hashlib.sha256(json.dumps({k: site.get(k) for k in fields}, sort_keys=True).encode()).hexdigest()


def netlify_request(path, method='GET', body=None):
    config = json.loads((Path.home() / 'AppData/Roaming/netlify/Config/config.json').read_text())
    token = config['users'][config['userId']]['auth']['token']
    request = Request('https://api.netlify.com/api/v1/' + path, method=method,
                      headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
                      data=json.dumps(body).encode() if body is not None else None)
    with urlopen(request, timeout=30) as response:
        content = response.read()
        return json.loads(content) if content else None


def save(state):
    STATE.write_text(json.dumps(state, indent=2))


def remove_failed_site(state):
    if state['siteId'] == H['PRODUCTION'] or not state.get('createdByTask'):
        raise RuntimeError('Removal isolation guard failed')
    netlify_request('sites/' + state['siteId'], method='DELETE')
    state.update({'removedAfterProtectionFailure': True, 'verified': False})
    save(state)
    print(json.dumps({'removedFailedProbe': state['siteId']}))


def deploy():
    if STATE.exists():
        previous = json.loads(STATE.read_text())
        if previous.get('deploymentAttempted') or previous.get('deployed') or previous.get('removedAfterProtectionFailure'):
            raise RuntimeError('One probe deployment only; refusing another upload')
    try:
        _deploy()
    except Exception:
        if STATE.exists():
            state = json.loads(STATE.read_text())
            if state.get('createdByTask') and not state.get('removedAfterProtectionFailure'):
                remove_failed_site(state)
        raise


def _deploy():
    validate_probe()
    compiled = H['validate_compiled_edge'](PACKAGE)
    before = production_fingerprint()
    if STATE.exists():
        state = json.loads(STATE.read_text())
        if state.get('deploymentAttempted') or state.get('deployed') or state.get('removedAfterProtectionFailure'):
            raise RuntimeError('One probe deployment only; refusing another upload')
        site = H['api']('getSite', {'site_id': state['siteId']})
    else:
        if PRIVATE.exists():
            raise RuntimeError('Fresh probe credential path already exists without a site record')
        site = H['api']('createSiteInTeam', {'account_slug': H['TEAM'], 'body': {'name': NAME}})
        state = {'siteId': site['id'], 'createdByTask': True, 'name': NAME, 'deployed': False,
                 'productionBefore': before, 'compiled': compiled}
        save(state)
    if site['id'] == H['PRODUCTION'] or site.get('account_id') != H['ACCOUNT'] or site.get('name') != NAME:
        raise RuntimeError('New probe site ownership/name guard failed')
    if H['api']('getSplitTests', {'site_id': site['id']}):
        raise RuntimeError('Split tests are not permitted')
    protected = H['dpapi']()
    if PRIVATE.exists():
        access = json.loads(protected(PRIVATE.read_bytes(), True))
        if access['siteId'] != site['id']:
            raise RuntimeError('Fresh probe credential belongs to another site')
    else:
        access = {'siteId': site['id'], 'username': 'kora-test', 'password': secrets.token_urlsafe(32)}
        PRIVATE.write_bytes(protected(json.dumps(access).encode()))
    digest = hashlib.sha256((access['username'] + ':' + access['password']).encode()).hexdigest()
    H['configure_access'](site['id'], digest)
    H['validate_compiled_edge'](PACKAGE)
    state['deploymentAttempted'] = True
    save(state)
    deployment = H['call'](['deploy', '--site', site['id'], '--cwd', str(PACKAGE), '--dir', str(PACKAGE / 'public'),
                            '--functions', str(PACKAGE / 'no-functions'), '--no-build', '--prod', '--json',
                            '--message', 'Harmless protected Edge packaging probe'], cwd=PACKAGE, timeout=600)
    state.update({'deployed': True, 'deployId': deployment['deploy_id'], 'probeUrl': deployment['url'],
                  'deployUrl': deployment['deploy_url']})
    state['productionUnchanged'] = production_fingerprint() == before
    save(state)
    validate_probe()
    state['compiledAfterDeploy'] = H['validate_compiled_edge'](PACKAGE)
    save(state)
    if not state['productionUnchanged']:
        raise RuntimeError('Production fingerprint changed; investigate without writing production')
    print(json.dumps({k: state[k] for k in ['siteId', 'probeUrl', 'deployUrl', 'productionUnchanged', 'compiledAfterDeploy']}))
    verify()


def verify():
    state = json.loads(STATE.read_text())
    if state.get('removedAfterProtectionFailure') or state['siteId'] == H['PRODUCTION']:
        raise RuntimeError('Probe verification isolation guard failed')
    access = json.loads(H['dpapi']()(PRIVATE.read_bytes(), True))
    assert access['siteId'] == state['siteId']
    auth = 'Basic ' + base64.b64encode((access['username'] + ':' + access['password']).encode()).decode()
    wrong = 'Basic ' + base64.b64encode(b'kora-test:' + b'z' * 43).decode()
    site = H['api']('getSite', {'site_id': state['siteId']})
    deployments = H['api']('listSiteDeploys', {'site_id': state['siteId']})
    branches = H['api']('listSiteDeployedBranches', {'site_id': state['siteId']})
    urls = {site['ssl_url'], state['deployUrl']}
    for item in deployments:
        if item.get('deploy_ssl_url'):
            urls.add(item['deploy_ssl_url'])
    if site.get('id_domain'):
        urls.add('https://' + site['id_domain'].removeprefix('https://'))
    urls.update('https://' + domain for domain in site.get('domain_aliases', []))
    urls.update(item['url'].replace('http://', 'https://') for item in branches if item.get('url'))
    evidence = {'aliases': sorted(urls), 'checks': [], 'deployCount': len(deployments), 'branches': len(branches)}

    def check(base, path, expected, credential='', method='GET', range_request=False, uncaught=False):
        headers = {'Authorization': credential} if credential else {}
        if range_request:
            headers['Range'] = 'bytes=0-127'
        request = Request(base.rstrip('/') + path, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=30)
        except HTTPError as error:
            response = error
        with response:
            body = response.read()
            gate = response.headers.get('X-Kora-Test-Gate')
            cache = response.headers.get('Cache-Control', '')
            passed = response.status == expected and (uncaught or gate == 'edge-auth-v1')
            passed = passed and (uncaught or 'no-store' in cache)
            if expected >= 400:
                passed = passed and SENTINEL not in body and b'Protected packaging probe' not in body and body != bytes(range(256)) * 4
            if expected == 206:
                passed = passed and body == bytes(range(128)) and response.headers.get('Content-Range') == 'bytes 0-127/1024'
            if expected == 200 and path.split('?')[0] == '/probe.txt' and method == 'GET':
                passed = passed and body == SENTINEL
            if method == 'HEAD':
                passed = passed and not body
            evidence['checks'].append({'alias': base, 'path': path, 'method': method, 'range': range_request,
                                        'auth': 'correct' if credential == auth else 'wrong' if credential else 'missing',
                                        'status': response.status, 'gate': gate, 'cacheControl': cache,
                                        'requestId': response.headers.get('X-Nf-Request-Id'), 'passed': passed})
        if not passed:
            raise RuntimeError('Live probe protection check failed: ' + path + ' HTTP ' + str(response.status))

    try:
        if H['api']('getSplitTests', {'site_id': state['siteId']}):
            raise RuntimeError('Split testing can bypass Edge execution')
        for base in sorted(urls):
            for path in ['/', '/index.html', '/probe.txt', '/probe.bin', '/probe.txt?test=1', '/%70robe.txt', '/probe%2Etxt']:
                for credential in ['', wrong]:
                    check(base, path, 401, credential)
                check(base, path, 200, auth)
            for credential in ['', wrong]:
                check(base, '/probe.bin', 401, credential, range_request=True)
                check(base, '/probe.txt', 401, credential, method='HEAD')
            check(base, '/probe.bin', 206, auth, range_request=True)
            check(base, '/probe.txt', 200, auth, method='HEAD')
            for method in ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']:
                check(base, '/probe.txt', 401, method=method)
                check(base, '/probe.txt', 405, auth, method=method)
            check(base, '/probe.txt?edgeFault=1', 503, auth)
            check(base, '/probe.txt?edgeUncaught=1', 500, auth, uncaught=True)
            # Verify after authorized cache warming; do not accept a missing asset as proof.
            check(base, '/probe.txt', 401)
            check(base, '/probe.bin', 401, range_request=True)
            print(json.dumps({'verifiedAlias': base, 'checks': len(evidence['checks'])}), flush=True)
        state['verified'] = True
        save(state)
    except Exception:
        (WORK / 'edge-probe-http.json').write_text(json.dumps(evidence, indent=2))
        remove_failed_site(state)
        raise
    evidence['passed'] = True
    (WORK / 'edge-probe-http.json').write_text(json.dumps(evidence, indent=2))
    print(json.dumps({'passed': True, 'checks': len(evidence['checks']), 'aliases': evidence['aliases']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['build', 'deploy', 'verify'])
    globals()[parser.parse_args().action]()
