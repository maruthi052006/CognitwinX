import os, json

root = r'c:\Users\vasan\Desktop\CognitwinX'
exclude_dirs = {'.venv', 'node_modules', '.git', 'dist', 'build', '__pycache__', '.vscode', 'bhuvan_cache', 'explanations'}

files_info = []

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for f in filenames:
        if f.endswith('.pyc') or f.endswith('.png') or f.endswith('.jpg') or f.endswith('.jpeg') or f.endswith('.tif') or f.endswith('.ico') or f == 'db.sqlite3':
            continue
        rel = os.path.relpath(os.path.join(dirpath, f), root).replace('\\', '/')
        if rel in ['scratch_analysis.json', 'scratch_scan.py', 'scratch_tree.json', 'Untitled-1.txt']:
            continue
        path = os.path.join(dirpath, f)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                lines = fp.readlines()
            line_count = len(lines)
            content = "".join(lines)
            
            # Simple heuristic for state
            is_empty = line_count == 0 or len(content.strip()) == 0
            has_unimpl = "NotImplementedError" in content or "pass  #" in content
            
            files_info.append({
                'path': rel,
                'lines': line_count,
                'is_empty': is_empty,
                'has_unimpl': has_unimpl,
            })
        except Exception as e:
            files_info.append({
                'path': rel,
                'error': str(e)
            })

files_info.sort(key=lambda x: x['path'])

with open(r'c:\Users\vasan\Desktop\CognitwinX\scratch_inventory.json', 'w', encoding='utf-8') as f:
    json.dump(files_info, f, indent=2)

print(f"Inventoried {len(files_info)} project source files.")
