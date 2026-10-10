"""Verify isolated page/audio protection without emitting authentication material."""
import base64
import hashlib
import json
import runpy
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

helpers = runpy.run_path('scripts/deploy-lead-audio-test.py')
work = helpers['WORK']
state = json.loads(helpers['STATE'].read_text())
credential = json.loads(helpers['dpapi']()(helpers['PRIVATE'].read_bytes(), True))
assert credential['siteId'] == state['siteId'] != helpers['PRODUCTION']
site = helpers['api']('getSite', {'site_id': state['siteId']})
deploys = helpers['api']('listSiteDeploys', {'site_id': state['siteId']})
branches = helpers['api']('listSiteDeployedBranches', {'site_id': state['siteId']})
splits = helpers['api']('getSplitTests', {'site_id': state['siteId']})
assert not any(test.get('active') for test in splits), 'Split testing can bypass Edge execution; stop.'
urls = {site['ssl_url']}
for deploy in deploys:
    for field in ('deploy_ssl_url', 'ssl_url'):
        value = deploy.get(field)
        if value:
            urls.add(value.rstrip('/'))
if site.get('id_domain'):
    urls.add('https://' + site['id_domain'].removeprefix('https://').rstrip('/'))
for domain in site.get('domain_aliases', []):
    urls.add('https://' + domain)
for branch in branches:
    if branch.get('url'):
        urls.add(branch['url'].replace('http://', 'https://').rstrip('/'))
authorization = 'Basic ' + base64.b64encode((credential['username'] + ':' + credential['password']).encode()).decode()
wrong = 'Basic ' + base64.b64encode(b'kora-test:' + b'z' * 43).decode()
audio = '/kora-lead-test/' + state['asset']['id'] + '.wav'
result = {'siteId': state['siteId'], 'aliases': sorted(urls), 'deployCount': len(deploys), 'branchCount': len(branches),
          'hasGitRepository': bool(site.get('build_settings', {}).get('repo_url')),
          'activeSplitTests': 0, 'checks': []}


def request(base, path, headers, method='GET', full=False):
    req = Request(base + path, headers=headers, method=method)
    try:
        response = urlopen(req, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        body = response.read() if full else response.read(256)
        return response.status, response.headers, body


def check(base, name, path, headers, expected, method='GET', full=False):
    status, response, body = request(base, path, headers, method, full)
    okay = status == expected and response.get('X-Kora-Test-Gate') == 'edge-auth-v1'
    okay = okay and 'no-store' in response.get('Cache-Control', '')
    item = {'alias': base, 'check': name, 'status': status, 'gate': response.get('X-Kora-Test-Gate'),
            'cacheControl': response.get('Cache-Control'), 'cacheStatus': response.get('Cache-Status'), 'passed': okay}
    if expected == 206:
        item['contentRange'] = response.get('Content-Range')
        item['passed'] = okay and item['contentRange'] == 'bytes 0-127/10584044' and len(body) == 128 and body.startswith(b'RIFF')
    if full and path == audio:
        item['hashMatches'] = hashlib.sha256(body).hexdigest() == state['asset']['id']
        item['passed'] = okay and item['hashMatches']
    result['checks'].append(item)
    if not item['passed']:
        (work / 'https-security.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(item), flush=True)
        raise RuntimeError('Protection verification failed; do not capture or analyze')
    return response


for base in sorted(urls):
    assert urlparse(base).hostname.endswith('.netlify.app')
    for path in ('/', '/index.html', audio):
        for name, auth in (('anonymous', ''), ('incorrect', wrong)):
            check(base, name + ':' + path, path, {'Authorization': auth}, 401)
            check(base, name + ':range:' + path, path, {'Authorization': auth, 'Range': 'bytes=0-127'}, 401)
        check(base, 'anonymous:head:' + path, path, {}, 401, method='HEAD')
    for path in ('/%69ndex.html', '/.netlify/images?url=' + audio, '/.netlify/functions/auth', '/unknown'):
        check(base, 'anonymous:bypass:' + path, path, {}, 401)
    check(base, 'authorized:page', '/', {'Authorization': authorization}, 200)
    check(base, 'authorized:range', audio, {'Authorization': authorization, 'Range': 'bytes=0-127'}, 206)
    response = check(base, 'authorized:full-audio', audio, {'Authorization': authorization}, 200, full=True)
    # Recheck after authenticated cache warming, including a conditional request.
    check(base, 'anonymous:after-warm', audio, {}, 401)
    check(base, 'anonymous:conditional', audio, {'If-None-Match': response.get('ETag', '*')}, 401)
    check(base, 'anonymous:options', audio, {}, 401, method='OPTIONS')
    print(json.dumps({'verifiedAlias': base, 'checksPassed': len(result['checks'])}), flush=True)
result['passed'] = all(item['passed'] for item in result['checks'])
result['productionUnchanged'] = state.get('productionUnchanged', False)
(work / 'https-security.json').write_text(json.dumps(result, indent=2))
print(json.dumps({'passed': result['passed'], 'checkCount': len(result['checks']), 'aliases': result['aliases'],
                  'deployCount': result['deployCount'], 'branchCount': result['branchCount'],
                  'hasGitRepository': result['hasGitRepository'], 'productionUnchanged': result['productionUnchanged']}))
