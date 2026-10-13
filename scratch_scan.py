import json

with open(r'c:\Users\vasan\Desktop\CognitwinX\scratch_analysis.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

todo_count = sum(len(d['todos']) for d in data)
pass_count = sum(len(d['passes']) for d in data)
debug_count = sum(len(d['debugs']) for d in data)
hardcoded_count = sum(len(d['hardcodeds']) for d in data)

print(f"Total files scanned: {len(data)}")
print(f"Total TODOs/FIXMEs: {todo_count}")
print(f"Total pass # placeholders: {pass_count}")
print(f"Total console logs: {debug_count}")
print(f"Total hardcoded/mock notes: {hardcoded_count}")

print("\n--- ALL TODOS/FIXMES ---")
for d in data:
    if d['todos']:
        print(f"{d['file']}:")
        for line_no, text in d['todos']:
            print(f"  L{line_no}: {text}")

print("\n--- ALL PASS # PLACEHOLDERS ---")
for d in data:
    if d['passes']:
        print(f"{d['file']}:")
        for line_no, text in d['passes']:
            print(f"  L{line_no}: {text}")

print("\n--- NOTABLE HARDCODED PATTERNS ---")
for d in data:
    if d['hardcodeds']:
        # filter to really suspicious ones
        suspicious = [h for h in d['hardcodeds'] if any(k in h[1].lower() for k in ['hardcoded', 'dummy', 'todo', 'temp'])]
        if suspicious:
            print(f"{d['file']}:")
            for line_no, text in suspicious:
                print(f"  L{line_no}: {text}")
