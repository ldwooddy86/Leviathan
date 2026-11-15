import json, sys, re
t = open(sys.argv[1], encoding='utf-8').read()
key = sys.argv[2]
start = t.index(key)
# brace-match from start
depth = 0; i = start; ins = False; esc = False
while True:
    c = t[i]
    if ins:
        if esc: esc = False
        elif c == '\\': esc = True
        elif c == '"': ins = False
    else:
        if c == '"': ins = True
        elif c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: break
    i += 1
s = t[start:i+1]
# unescape the \\u0026 style double escapes if present
s2 = s.replace('\\\\u', '\\u')
try:
    d = json.loads(s2)
except Exception as e:
    print('json err', e); d = None
json.dump(d, open(sys.argv[3], 'w'), indent=1, ensure_ascii=False)
print(len(s), list(d.keys()) if d else None)
