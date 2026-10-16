"""Record installed dependency license declarations; this is not distribution clearance."""
import importlib.metadata,json
from pathlib import Path
records=[]
for package in importlib.metadata.distributions():
    metadata=package.metadata
    records.append({'name':metadata['Name'],'version':package.version,
      'declaredLicense':metadata.get('License-Expression') or metadata.get('License') or None,
      'licenseClassifiers':[v for v in metadata.get_all('Classifier',[]) if v.startswith('License ::')],
      'projectUrls':metadata.get_all('Project-URL',[])})
output={'scope':'Installed package metadata, not legal certification or clearance to redistribute code, checkpoints or training audio.',
  'restrictions':'Candidate code/checkpoint and reference-data licenses remain separate; missing declarations stay unresolved.',
  'packages':sorted(records,key=lambda r:r['name'].lower())}
Path('scratch/beat-grid-v2/dependency-license-inventory.json').write_text(json.dumps(output,indent=2))
print(json.dumps({'dependencies':len(records),'missingLicenseMetadata':sum(not r['declaredLicense'] and not r['licenseClassifiers'] for r in records)}))
