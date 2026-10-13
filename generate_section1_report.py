import os, json, re

root = r'c:\Users\vasan\Desktop\CognitwinX'
exclude_dirs = {'.venv', 'node_modules', '.git', 'dist', 'build', '__pycache__', '.vscode', 'bhuvan_cache', 'explanations'}

spec_map = {
    # Backend core & config
    'backend/manage.py': ('Django management script', 'Complete'),
    'backend/Dockerfile': ('Docker container spec for backend', 'Complete'),
    'backend/requirements.txt': ('Python dependencies list', 'Complete'),
    'backend/docker-compose.yml': ('Docker compose multi-container orchestration', 'Complete'),
    'docker-compose.yml': ('Root Docker compose multi-container orchestration', 'Complete'),
    'backend/config/__init__.py': ('Config module init', 'Complete'),
    'backend/config/settings.py': ('Django settings & environment config', 'Complete'),
    'backend/config/urls.py': ('Root API URL routing', 'Complete'),
    'backend/config/asgi.py': ('ASGI config for WebSockets/Channels', 'Complete'),
    'backend/config/wsgi.py': ('WSGI config for HTTP', 'Complete'),
    'backend/config/celery.py': ('Celery app and task autodiscovery config', 'Complete'),
    
    # Digital Twin Core App
    'backend/apps/digital_twin/models.py': ('Spatial models (Zone, Sensor, Prediction, Simulation, Building, etc.)', 'Complete'),
    'backend/apps/digital_twin/views.py': ('REST API ViewSets for digital twin entities', 'Complete'),
    'backend/apps/digital_twin/urls.py': ('URL routes for digital twin endpoints', 'Complete'),
    'backend/apps/digital_twin/serializers.py': ('DRF Serializers for models', 'Complete'),
    'backend/apps/digital_twin/consumers.py': ('Channels WebSocket consumers for live updates', 'Complete'),
    'backend/apps/digital_twin/routing.py': ('WebSocket routing for twin live feeds', 'Complete'),
    'backend/apps/digital_twin/admin.py': ('Django admin configuration', 'Complete'),
    'backend/apps/digital_twin/signals.py': ('Signal handlers for broadcast triggers', 'Complete'),
    'backend/apps/digital_twin/apps.py': ('App configuration for digital_twin', 'Complete'),
    'backend/apps/digital_twin/management/commands/seed_chennai.py': ('Data seeding command for Chennai zones and buildings', 'Complete'),
    'backend/apps/digital_twin/management/commands/run_cognitive_cycle.py': ('CLI command to trigger end-to-end cognitive loop', 'Complete'),
}

# Scan all files
files_data = []
all_todos = []
all_passes = []
all_debugs = []
all_hardcoded = []
commented_blocks = []

todo_regex = re.compile(r'\b(TODO|FIXME|XXX)\b', re.IGNORECASE)
pass_regex = re.compile(r'^\s*pass\s*(#.*)?$')
debug_regex = re.compile(r'console\.(log|debug|warn|error)\(')
hardcoded_regex = re.compile(r'\b(hardcoded|dummy|mock|placeholder)\b', re.IGNORECASE)

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for f in filenames:
        if f.endswith(('.pyc', '.png', '.jpg', '.jpeg', '.tif', '.ico')) or f == 'db.sqlite3':
            continue
        rel = os.path.relpath(os.path.join(dirpath, f), root).replace('\\', '/')
        if rel in ['scratch_analysis.json', 'scratch_scan.py', 'scratch_inventory.py', 'generate_section1_report.py', 'scratch_tree.json', 'Untitled-1.txt']:
            continue
        
        filepath = os.path.join(dirpath, f)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                lines = fp.readlines()
        except Exception as e:
            continue
        
        line_count = len(lines)
        file_todos = []
        file_passes = []
        file_debugs = []
        file_hardcoded = []
        comment_block_count = 0
        in_comment_block = False
        
        for idx, line in enumerate(lines, 1):
            sline = line.strip()
            if todo_regex.search(line):
                file_todos.append((idx, sline))
                all_todos.append((rel, idx, sline))
            if pass_regex.match(line):
                file_passes.append((idx, sline))
                all_passes.append((rel, idx, sline))
            if debug_regex.search(line):
                file_debugs.append((idx, sline))
                all_debugs.append((rel, idx, sline))
            if hardcoded_regex.search(line):
                # Filter legitimate names
                if not any(k in sline for k in ['USE_MOCK_DATA', 'mock_data', 'MockData', 'is_mock', 'mock_generator', 'MOCK_REASONING']):
                    file_hardcoded.append((idx, sline))
                    all_hardcoded.append((rel, idx, sline))
            
            # Check commented code blocks (3 or more consecutive commented lines that look like code)
            if (sline.startswith('//') or sline.startswith('#')) and any(c in sline for c in ['=', '(', ')', '{', '}', 'import ', 'def ', 'class ', 'const ', 'return ']):
                if not in_comment_block:
                    in_comment_block = True
                    comment_block_count += 1
            else:
                in_comment_block = False

        # Determine purpose and state
        purpose = "Source code component"
        state = "Complete"
        if line_count == 0:
            state = "Empty/Stub"
            purpose = "Empty file"
        elif "NotImplementedError" in "".join(lines):
            state = "Stub"
            purpose = "Partial / uncompleted implementation"
        
        # Spec categorization
        notes = f"{line_count} lines"
        if file_todos:
            notes += f", {len(file_todos)} TODOs"
        if file_passes:
            notes += f", {len(file_passes)} passes"
        if file_debugs:
            notes += f", {len(file_debugs)} debug logs"
        if file_hardcoded:
            notes += f", {len(file_hardcoded)} suspicious hardcoded values"
        if comment_block_count > 0:
            notes += f", {comment_block_count} commented code sections"

        files_data.append({
            'path': rel,
            'lines': line_count,
            'purpose': purpose,
            'state': state,
            'notes': notes,
            'todos': file_todos,
            'passes': file_passes,
            'debugs': file_debugs,
            'hardcoded': file_hardcoded
        })

print(f"Total evaluated files: {len(files_data)}")
print(f"Total TODOs: {len(all_todos)}")
print(f"Total pass statements: {len(all_passes)}")
print(f"Total console.* calls: {len(all_debugs)}")
print(f"Total hardcoded notes: {len(all_hardcoded)}")

with open(r'c:\Users\vasan\Desktop\CognitwinX\section1_summary.json', 'w', encoding='utf-8') as out:
    json.dump({
        'files': files_data,
        'all_todos': all_todos,
        'all_passes': all_passes,
        'all_debugs': all_debugs,
        'all_hardcoded': all_hardcoded
    }, out, indent=2)

print("Saved to section1_summary.json")
