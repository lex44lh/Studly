"""Local read-only HTTP smoke. Browser journeys are recorded separately."""
import json
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
root = Path(__file__).parent
cases = json.loads((root / 'routes-input.json').read_text())
cases += [('category-' + slug, '/category/' + slug) for slug in ['homework','courseworks','tutoring','engineering','presentations','reports','video']]
rows=[]
for label, route in cases:
    try:
        with urlopen('http://127.0.0.1:3101' + route) as response:
            status = response.status
    except HTTPError as error:
        status = error.code
    rows.append({'label':label,'route':route,'status':status,'expected':404 if label=='not-found' else 200})
(root/'routes.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('HTTP smoke:', len(rows), 'routes;', sum(row['status']==row['expected'] for row in rows), 'as expected')
if any(row['status']!=row['expected'] for row in rows):
    raise SystemExit(1)
