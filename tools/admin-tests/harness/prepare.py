#!/usr/bin/env python3
"""Builds ./site from the real admin files (admin.js included) with the Firebase SDK swapped for the
in-memory stubs shared with tools/costing-tests. Run: python3 tools/admin-tests/harness/prepare.py"""
import re, shutil, pathlib
here = pathlib.Path(__file__).resolve().parent
repo = here.parents[2]
costing = repo / 'tools' / 'costing-tests' / 'harness'
site = here / 'site'
if site.exists(): shutil.rmtree(site)
(site / 'admin').mkdir(parents=True); (site / 'js').mkdir(); (site / 'stubs').mkdir(); (site / 'vendor').mkdir()
for f in (repo / 'admin').iterdir():
    if f.is_file() and not f.name.endswith(('_part', '_snippet', '_calendar')): shutil.copy(f, site / 'admin' / f.name)
shutil.copy(repo / 'js' / 'firebase-config.js', site / 'js' / 'firebase-config.js')
for f in (costing / 'stubs').glob('*.js'): shutil.copy(f, site / 'stubs' / f.name)
shutil.copy(costing / 'vendor' / 'chart.umd.js', site / 'vendor' / 'chart.umd.js')

s = (site / 'admin' / 'index.html').read_text()
s = re.sub(r'<script src="https://cdn.jsdelivr.net/npm/chart.js[^"]*"></script>', '<script src="/vendor/chart.umd.js"></script>', s)
s = s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js"></script>',
              '<script>window.Sortable = class { constructor() {} option() {} };</script>')
importmap = """<script type="importmap">{"imports":{
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js":"/stubs/app.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js":"/stubs/auth.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js":"/stubs/firestore.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js":"/stubs/storage.js"}}</script>"""
s = s.replace('</head>', importmap + '\n</head>')
(site / 'admin' / 'index.html').write_text(s)
print('site built at', site)
